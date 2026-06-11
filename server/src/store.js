// store.js — the three stores, with adapter seams.
//
//   TRUTH      = per-user ENCRYPTED JSONL in object storage (S3/R2).  ← the permanent record
//   PROJECTION = Postgres; rebuildable from TRUTH at any time (see rebuildProjection / test B5).
//   BUFFER     = its OWN database with backups DISABLED; raw turns, deleted at 30 days.
//
// Local mode (default) uses in-memory backends so `npm test` runs with no accounts.
// Swap the three adapter objects for real pg / @aws-sdk/client-s3 / KMS — signatures stay.
import { randomUUID, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { hashEvent, validateEvent } from './essence.js';

/* ---------- adapters (replace bodies with real providers) ---------- */
const objectStore = (() => { const m = new Map(); return {            // TRUTH (S3/R2)
  async put(key, bytes){ m.set(key, Buffer.from(bytes)); },
  async get(key){ return m.has(key) ? m.get(key) : null; },
  async del(key){ m.delete(key); }
};})();
const projection = (() => { const db = new Map(); return {            // PROJECTION (Postgres)
  get(uid){ return db.get(uid) || null; }, set(uid,v){ db.set(uid,v); }, del(uid){ db.delete(uid); }
};})();
const buffer = (() => { const db = new Map(); return {                // BUFFER (backups OFF)
  push(t){ const a = db.get(t.session_id) || []; a.push(t); db.set(t.session_id, a); },
  bySession(sid){ return db.get(sid) || []; },
  all(){ return [...db.values()].flat(); },
  deleteOlderThan(cutISO){ for (const [sid,a] of db){ const keep=a.filter(t=>t.ts>=cutISO); keep.length?db.set(sid,keep):db.delete(sid);} }
};})();
const keyVault = (() => { const m = new Map(); return {               // KMS (per-user keys)
  ensure(uid){ if(!m.has(uid)) m.set(uid, randomBytes(32)); return m.get(uid); },
  get(uid){ return m.get(uid) || null; },
  destroy(uid){ m.delete(uid); }                                       // ← crypto-shred
};})();
const tombstones = new Set();

/* ---------- encryption (envelope; per-user key from KMS) ---------- */
function enc(uid, plain){ const key=keyVault.ensure(uid); const iv=randomBytes(12);
  const c=createCipheriv('aes-256-gcm',key,iv); const ct=Buffer.concat([c.update(plain,'utf8'),c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]); }
function dec(uid, blob){ const key=keyVault.get(uid); if(!key) return null;
  const iv=blob.subarray(0,12), tag=blob.subarray(12,28), ct=blob.subarray(28);
  const d=createDecipheriv('aes-256-gcm',key,iv); d.setAuthTag(tag);
  return Buffer.concat([d.update(ct),d.final()]).toString('utf8'); }

const truthKey = uid => 'essence/' + uid + '.jsonl';
async function readTruth(uid){ const blob=await objectStore.get(truthKey(uid)); if(!blob) return [];
  const txt=dec(uid,blob); if(txt==null) return []; return txt.split('\n').filter(Boolean).map(l=>JSON.parse(l)); }
async function writeTruth(uid, events){ await objectStore.put(truthKey(uid), enc(uid, events.map(e=>JSON.stringify(e)).join('\n'))); }

/* ---------- projection builder (TRUTH → fast read model) ---------- */
function buildProjection(events){
  const journey = [...events].reverse().find(e=>e.type==='journey_position');
  let living=''; events.forEach(e=>{ if(e.type==='conversation_summary'&&e.content&&e.content.summary) living=(e.content.summary+(living?'\n\n'+living:'')).slice(0,4000); });
  return {
    chain_head: events.length? events[events.length-1].hash : null,
    living_summary: living,
    journey_position: journey? journey.content : null,
    validated_facts: events.filter(e=>e.type==='fact'&&e.provenance.status==='validated').map(e=>e.content),
    events_index: events.map(e=>({event_id:e.event_id, type:e.type, session_id:e.session_id, pass:e.pass, hash:e.hash})),
    recent_events: events.slice().reverse().slice(0,20)
  };
}
function proj(uid){ let p=projection.get(uid); if(!p){ p={events_index:[]}; projection.set(uid,p); } return p; }

/* ---------- append (POST /events) ---------- */
export async function appendEvents(uid, incoming){
  if (tombstones.has(uid)) return { accepted:[], rejected: incoming.map(e=>({event_id:e.event_id, reason:'erased'})), chain_head:null };
  const events = await readTruth(uid);                       // TRUTH is authoritative
  const idx = new Set(events.map(e=>e.event_id));
  const summ = new Set(events.filter(e=>e.type==='conversation_summary').map(e=>e.session_id+'|'+e.pass));
  let prev = events.length? events[events.length-1].hash : null;
  const accepted=[], rejected=[];
  for (const ev of incoming){
    const bad = validateEvent(ev); if (bad){ rejected.push({event_id:ev&&ev.event_id, reason:bad}); continue; }
    if (idx.has(ev.event_id)){ rejected.push({event_id:ev.event_id, reason:'duplicate'}); continue; }
    if (ev.type==='conversation_summary'){ const k=ev.session_id+'|'+ev.pass; if(summ.has(k)){ rejected.push({event_id:ev.event_id, reason:'finalized_session'}); continue; } summ.add(k); }
    ev.prev_hash = prev; ev.hash = hashEvent(ev, prev); prev = ev.hash;   // server assigns the chain
    events.push(ev); idx.add(ev.event_id); accepted.push(ev.event_id);
  }
  await writeTruth(uid, events);                             // persist TRUTH first
  projection.set(uid, buildProjection(events));              // then the rebuildable projection
  return { accepted, rejected, chain_head: prev };
}

/* ---------- GET /memory ---------- */
export async function getMemory(uid){
  let p = projection.get(uid);
  if (!p) p = await rebuildProjection(uid);
  return { user_id: uid, journey_position: p.journey_position||null, living_summary: p.living_summary||'',
    recent_events: p.recent_events||[], validated_facts: p.validated_facts||[], chain_head: p.chain_head||null, as_of: new Date().toISOString() };
}

/* ---------- B5: rebuild projection purely from object-storage TRUTH ---------- */
export async function readEvents(uid){ return readTruth(uid); }      // decrypted chain, for sessions/reconcile
export async function rebuildProjection(uid){ const events = await readTruth(uid); const p = buildProjection(events); projection.set(uid, p); return p; }
export async function dropProjection(uid){ projection.del(uid); }   // for the B5 test

/* ---------- turns / buffer ---------- */
export function recordTurn(t){ buffer.push(t); }
export function turnsForSession(sid){ return buffer.bySession(sid); }
export function deleteRawOlderThan(cutISO){ buffer.deleteOlderThan(cutISO); }
export function allTurns(){ return buffer.all(); }

/* ---------- erase (crypto-shred) ---------- */
export async function erase(uid, reason){
  await objectStore.del(truthKey(uid));      // ciphertext gone
  keyVault.destroy(uid);                      // key gone → any stray ciphertext is unreadable
  projection.del(uid);                        // projection gone
  tombstones.add(uid);                        // tombstone retained (chain integrity record)
  return { erased:true, tombstone:{ user_id:uid, reason:reason||'user_command', ts:new Date().toISOString() } };
}
export function isErased(uid){ return tombstones.has(uid); }
export function newUserId(){ return randomUUID(); }
