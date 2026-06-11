// migrate.mjs — one-time upload of exported of.runtime.v1 into the Essence Log.
// Export of.runtime.v1 from the browser to a JSON file first, then:  npm run migrate -- ./of.runtime.v1.json
// Use --dry to count-match without writing.  FAILS LOUD on count mismatch — nothing is lost silently.
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import * as store from '../src/store.js';

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const path = args.find(a => !a.startsWith('--')) || './of.runtime.v1.json';

function ev(user_id, type, content, status) {
  return { event_id: randomUUID(), user_id, ts: new Date().toISOString(), runtime: 'org_frequency',
    agent: { name: 'migration', version: 'v1' }, session_id: null, pass: 'live', type, content,
    provenance: { source: 'migration', confidence: 1, status: status || 'provisional', supersedes: null } };
}

export function mapRecords(s, user_id) {
  const events = []; let counted = 0;
  (s.organizations || []).forEach(o => { counted++; events.push(ev(user_id, 'fact', { statement: 'Organization: ' + (o.organization_name || o.organization_id), subject: 'org:' + o.organization_id, evidence: 'migrated' }));
    ((o.living_frequency && o.living_frequency.dimensions) || []).forEach(d => { counted++; events.push(ev(user_id, 'frequency_update', { target: 'org:' + o.organization_id, dimension: d.dimension, previous_value: 0, new_value: typeof d.confidence === 'number' ? d.confidence : 0.5, stage: 'validated', evidence: d.source || 'migrated' }, 'validated')); });
  });
  (s.missions || []).forEach(m => { counted++; events.push(ev(user_id, 'fact', { statement: 'Mission: ' + (m.mission_statement || m.mission_id), subject: 'org:' + m.organization_id, evidence: 'migrated' })); });
  (s.validated_understandings || []).forEach(u => { counted++; events.push(ev(user_id, 'fact', { statement: u.statement || 'validated understanding', subject: 'org:' + (u.organization_id || ''), evidence: 'migrated' }, 'validated')); });
  (s.pub_estimates || []).forEach(e => { counted++; events.push(ev(user_id, 'fact', { statement: 'Public estimate: ' + (e.company_name || ''), subject: 'org:' + (e.research_id || ''), evidence: 'public-intel' })); });
  return { events, counted };
}

async function run() {
  const raw = JSON.parse(await readFile(path, 'utf8'));
  const user_id = raw.user_id || randomUUID();
  const { events, counted } = mapRecords(raw, user_id);
  console.log('source records mapped: ' + counted + ' -> events: ' + events.length);
  if (counted !== events.length) { console.error('COUNT MISMATCH (in ' + counted + ' != out ' + events.length + ') — aborting, nothing lost.'); process.exit(1); }
  if (dry) { console.log('dry run OK — count-match green. Re-run without --dry to write.'); return; }
  const res = await store.appendEvents(user_id, events);
  console.log('migrated: accepted ' + res.accepted.length + ', rejected ' + res.rejected.length);
  if (res.accepted.length !== events.length) { console.error('WRITE MISMATCH — investigate before trusting the migration.'); process.exit(1); }
  console.log('migration report:', JSON.stringify({ user_id, in: counted, out: events.length, accepted: res.accepted.length }));
}
if (process.argv[1] && process.argv[1].endsWith('migrate.mjs')) run().catch(e => { console.error(e); process.exit(1); });
