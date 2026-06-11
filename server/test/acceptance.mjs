// acceptance.mjs — scripted Stage-1 gate. `npm test`. Runs the battery in
// _brief/stage1-acceptance-battery.json against the in-memory backends.
// Exit 0 = Stage 1 logic proven; exit 1 = a gate failed.
import { randomUUID } from 'node:crypto';
import * as store from '../src/store.js';
import * as sessions from '../src/sessions.js';
import { verifyChain } from '../src/essence.js';
import { runRetention } from '../jobs/retention.mjs';
import { mapRecords } from '../scripts/migrate.mjs';

let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log('  PASS ' + name); } else { fail++; console.log('  FAIL ' + name); } }
function evt(user_id, type, content, prov) {
  return { event_id: randomUUID(), user_id, ts: new Date().toISOString(), runtime: 'org_frequency',
    agent: { name: 'aeon1', version: 'v1' }, session_id: null, pass: 'live', type, content,
    provenance: Object.assign({ source: 'agent_inferred', confidence: 0.6, status: 'provisional', supersedes: null }, prov || {}) };
}

console.log('\n--- PARITY (P1-P7) ---');

// P1 idempotent finalization (3x concurrent → one summary)
{ const uid = randomUUID(); const sid = sessions.startSession(uid, 'signal');
  store.recordTurn({ session_id: sid, user_id: uid, turn_index: 0, role: 'user', text: 'a', ts: new Date().toISOString() });
  store.recordTurn({ session_id: sid, user_id: uid, turn_index: 1, role: 'user', text: 'b', ts: new Date().toISOString() });
  await Promise.all([sessions.finalize(sid, 'explicit'), sessions.finalize(sid, 'inactivity'), sessions.finalize(sid, 'sweeper')]);
  const evs = await store.readEvents(uid);
  ok(evs.filter(e => e.type === 'conversation_summary' && e.session_id === sid && e.pass === 'live').length === 1, 'P1 idempotent finalization → exactly one live summary'); }

// P2 summary uniqueness
{ const uid = randomUUID(); const sid = sessions.startSession(uid);
  await sessions.finalize(sid, 'explicit');
  const dupe = evt(uid, 'conversation_summary', { summary: 'x', ended_by: 'explicit' }); dupe.session_id = sid; dupe.pass = 'live';
  const res = await store.appendEvents(uid, [dupe]);
  ok(res.rejected.some(r => r.reason === 'finalized_session'), 'P2 second (session,pass) summary rejected'); }

// P3 dedupe
{ const uid = randomUUID(); const e = evt(uid, 'fact', { statement: 'x', subject: 'user', evidence: 'y' }, { source: 'user_said' });
  await store.appendEvents(uid, [e]); const r2 = await store.appendEvents(uid, [e]);
  ok(r2.rejected.length === 1 && r2.rejected[0].reason === 'duplicate', 'P3 duplicate event_id rejected'); }

// P4 supersede / contradiction
{ const uid = randomUUID(); const A = evt(uid, 'fact', { statement: 'concise', subject: 'user', evidence: 'q' }, { source: 'user_said', status: 'validated' });
  await store.appendEvents(uid, [A]);
  const B = evt(uid, 'fact', { statement: 'detail', subject: 'user', evidence: 'r' }, { source: 'user_said', supersedes: A.event_id });
  await store.appendEvents(uid, [B]);
  const evs = await store.readEvents(uid);
  const a2 = evs.find(e => e.event_id === A.event_id);
  ok(evs.length === 2 && a2.content.statement === 'concise' && B.provenance.supersedes === A.event_id, 'P4 both kept, A unedited, B supersedes A'); }

// P5 reconciliation pass
{ const uid = randomUUID(); const sid = sessions.startSession(uid);
  store.recordTurn({ session_id: sid, user_id: uid, turn_index: 0, role: 'user', text: 'hello there', ts: new Date().toISOString() });
  await sessions.finalize(sid, 'explicit');
  const live = (await store.readEvents(uid)).find(e => e.pass === 'live' && e.session_id === sid);
  await sessions.reconcile(sid, uid);
  const rec = (await store.readEvents(uid)).find(e => e.pass === 'reconciliation' && e.session_id === sid);
  ok(rec && rec.provenance.supersedes === live.event_id, 'P5 reconciliation accepted + supersedes live'); }

// P6 rehydrate
{ const uid = randomUUID(); await store.appendEvents(uid, [evt(uid, 'journey_position', { book: 'civilization', concept: 'continuity', next_step: 'read Truth' })]);
  const m = await store.getMemory(uid);
  ok(m.journey_position && 'living_summary' in m && 'chain_head' in m && 'as_of' in m, 'P6 GET /memory shape'); }

// P7 provenance integrity
{ const uid = randomUUID(); await store.appendEvents(uid, [evt(uid, 'fact', { statement: 'z', subject: 'user', evidence: 'e' }, { source: 'user_said' })]);
  const evs = await store.readEvents(uid);
  ok(evs.every(e => ['user_said', 'agent_inferred', 'operator_asserted', 'migration'].includes(e.provenance.source)), 'P7 every event has valid provenance.source'); }

console.log('\n--- BACKEND-ONLY (B1-B5) ---');

// B1 chain integrity + tamper detection
{ const uid = randomUUID();
  await store.appendEvents(uid, [evt(uid, 'fact', { statement: '1', subject: 'user', evidence: 'e' })]);
  await store.appendEvents(uid, [evt(uid, 'fact', { statement: '2', subject: 'user', evidence: 'e' })]);
  const evs = await store.readEvents(uid);
  const clean = verifyChain(evs).ok;
  const tampered = evs.map((e, i) => i === 0 ? Object.assign({}, e, { content: { statement: 'HACKED', subject: 'user', evidence: 'e' } }) : e);
  const caught = !verifyChain(tampered).ok;
  ok(clean && caught, 'B1 chain verifies clean and detects tampering'); }

// B2 crypto-shred
{ const uid = randomUUID(); await store.appendEvents(uid, [evt(uid, 'fact', { statement: 'secret', subject: 'user', evidence: 'e' })]);
  await store.erase(uid, 'user_command');
  const evs = await store.readEvents(uid); const m = await store.getMemory(uid);
  ok(evs.length === 0 && !m.living_summary && store.isErased(uid), 'B2 erase destroys access (key gone, unreadable)'); }

// B3 finalization CAS under concurrency (10 parallel)
{ const uid = randomUUID(); const sid = sessions.startSession(uid);
  store.recordTurn({ session_id: sid, user_id: uid, turn_index: 0, role: 'user', text: 'x', ts: new Date().toISOString() });
  await Promise.all(Array.from({ length: 10 }, (_, i) => sessions.finalize(sid, 'w' + i)));
  const n = (await store.readEvents(uid)).filter(e => e.type === 'conversation_summary' && e.pass === 'live').length;
  ok(n === 1, 'B3 CAS admits exactly one winner under 10x concurrency'); }

// B4 30-day deletion is real (reconcile first, then delete)
{ const uid = randomUUID(); const sid = sessions.startSession(uid); const old = new Date(Date.now() - 40 * 86400000).toISOString();
  store.recordTurn({ session_id: sid, user_id: uid, turn_index: 0, role: 'user', text: 'old turn', ts: old });
  const before = store.allTurns().filter(t => t.session_id === sid).length;
  const rep = await runRetention();
  const after = store.allTurns().filter(t => t.session_id === sid).length;
  const recExists = (await store.readEvents(uid)).some(e => e.session_id === sid && e.pass === 'reconciliation');
  ok(before === 1 && after === 0 && recExists && rep.raw_turns_deleted >= 1, 'B4 reconcile-then-delete; raw gone (buffer backups-off)'); }

// B5 projection rebuild from object-storage TRUTH
{ const uid = randomUUID();
  await store.appendEvents(uid, [evt(uid, 'fact', { statement: 'truth', subject: 'user', evidence: 'e' }, { status: 'validated' })]);
  await store.appendEvents(uid, [evt(uid, 'journey_position', { book: 'civilization', concept: 'truth', next_step: 'go' })]);
  const m1 = JSON.stringify((await store.getMemory(uid)));
  store.dropProjection(uid);                       // wipe Postgres projection
  await store.rebuildProjection(uid);              // rebuild from object storage
  const m2 = JSON.stringify((await store.getMemory(uid)));
  ok(m1.replace(/"as_of":"[^"]*"/g, '') === m2.replace(/"as_of":"[^"]*"/g, ''), 'B5 GET /memory identical after rebuild from TRUTH'); }

console.log('\n--- MIGRATION (M1) ---');
{ const sample = { user_id: randomUUID(), organizations: [{ organization_id: 'o1', organization_name: 'Acme', living_frequency: { dimensions: [{ dimension: 'autonomy_level', confidence: 0.7, source: 'validated' }] } }], missions: [{ mission_id: 'm1', organization_id: 'o1', mission_statement: 'ship' }], validated_understandings: [{ statement: 'fast', organization_id: 'o1' }], pub_estimates: [{ company_name: 'Beta', research_id: 'r1' }] };
  const { events, counted } = mapRecords(sample, sample.user_id);
  const res = await store.appendEvents(sample.user_id, events);
  ok(counted === events.length && res.accepted.length === events.length && events.every(e => e.provenance.source === 'migration'), 'M1 count-match green; all source="migration"'); }

console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
process.exit(fail ? 1 : 0);
