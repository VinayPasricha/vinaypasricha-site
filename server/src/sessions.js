// sessions.js — session lifecycle + finalization (the compare-and-set + the two AI passes).
// Used by app.js (live), jobs/retention.mjs (reconciliation), and the acceptance tests.
import { randomUUID } from 'node:crypto';
import * as store from './store.js';
import { summariseTurns } from './inference.js';

const sessions = new Map();   // session_id -> { user_id, state, runtime, agent, started, lastActivity }

export function startSession(user_id, runtime, agent) {
  const id = randomUUID();
  sessions.set(id, { user_id, state: 'open', runtime: runtime || 'org_frequency',
    agent: agent || { name: 'aeon1', version: 'v1' }, started: Date.now(), lastActivity: Date.now() });
  return id;
}
export function touch(session_id) { const s = sessions.get(session_id); if (s) s.lastActivity = Date.now(); }
export function getSession(session_id) { return sessions.get(session_id) || null; }
// Register an externally-created session_id (the client generates it, then streams turns).
export function ensureSession(session_id, user_id, runtime, agent) {
  let s = sessions.get(session_id);
  if (!s) { s = { user_id, state: 'open', runtime: runtime || 'org_frequency', agent: agent || { name: 'aeon1', version: 'v1' }, started: Date.now(), lastActivity: Date.now() }; sessions.set(session_id, s); }
  else s.lastActivity = Date.now();
  return s;
}

function summaryEvent(user_id, sess, content, pass, supersedes) {
  return {
    event_id: randomUUID(), user_id, ts: new Date().toISOString(),
    runtime: sess.runtime, agent: sess.agent, session_id: null /* set by caller */, pass,
    type: 'conversation_summary', content,
    provenance: { source: 'agent_inferred', confidence: pass === 'reconciliation' ? 0.7 : 0.6, status: 'provisional', supersedes: supersedes || null }
  };
}

// Finalize a live session. Compare-and-set open->finalizing; only the winner writes essence.
export async function finalize(session_id, endedBy) {
  const sess = sessions.get(session_id);
  if (!sess) return null;
  if (sess.state !== 'open') return null;            // lost the race (idempotency — P1/B3)
  sess.state = 'finalizing';
  const turns = store.turnsForSession(session_id);
  const content = await summariseTurns(turns, endedBy);   // ← Stage 1's AI call
  const ev = summaryEvent(sess.user_id, sess, content, 'live', null);
  ev.session_id = session_id;
  const res = await store.appendEvents(sess.user_id, [ev]);
  sess.state = 'finalized';
  return { event: ev, result: res };
}

// Reconciliation pass (run before raw deletion). Never blocked by the live pass; supersedes it.
export async function reconcile(session_id, user_id) {
  const sess = sessions.get(session_id) || { user_id, runtime: 'org_frequency', agent: { name: 'aeon1', version: 'v1' } };
  const events = await store.readEvents(user_id || sess.user_id);
  const live = events.find(e => e.type === 'conversation_summary' && e.session_id === session_id && e.pass === 'live');
  const turns = store.turnsForSession(session_id);
  const content = await summariseTurns(turns, live ? live.content.ended_by : 'explicit');
  const ev = summaryEvent(user_id || sess.user_id, sess, content, 'reconciliation', live ? live.event_id : null);
  ev.session_id = session_id;
  return store.appendEvents(user_id || sess.user_id, [ev]);
}

// Finalize every still-open session idle longer than `minutes` (inactivity + boot sweeper).
export async function sweepInactive(minutes) {
  const cut = Date.now() - minutes * 60 * 1000;
  const out = [];
  for (const [id, s] of sessions) if (s.state === 'open' && s.lastActivity < cut) out.push(await finalize(id, 'sweeper'));
  return out.filter(Boolean);
}
