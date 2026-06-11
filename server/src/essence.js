// essence.js — pure helpers: hashing, chain, event validation.
// No I/O. Used by store.js. Mirrors _brief/memory-event-schema-v1.1.md.
import { createHash } from 'node:crypto';

export const EVENT_TYPES = [
  'conversation_summary', 'fact', 'frequency_update', 'inner_change_note',
  'journey_position', 'operator_validation', 'erasure_tombstone'
];
export const SOURCES = ['user_said', 'agent_inferred', 'operator_asserted', 'migration'];
export const STATUSES = ['provisional', 'validated', 'retired'];

// Deterministic hash of an event's immutable payload + the prior hash = the chain link.
export function hashEvent(ev, prevHash) {
  const payload = JSON.stringify({
    event_id: ev.event_id, user_id: ev.user_id, ts: ev.ts, runtime: ev.runtime,
    agent: ev.agent, session_id: ev.session_id, pass: ev.pass, type: ev.type,
    content: ev.content, provenance: ev.provenance, prev_hash: prevHash || null
  });
  return createHash('sha256').update(payload).digest('hex');
}

// Validate one incoming event against the contract. Returns null if OK, else a reason string.
export function validateEvent(ev) {
  if (!ev || typeof ev !== 'object') return 'schema';
  if (!ev.event_id || !ev.user_id) return 'schema';
  if (EVENT_TYPES.indexOf(ev.type) === -1) return 'schema';
  const p = ev.provenance;
  if (!p || SOURCES.indexOf(p.source) === -1) return 'schema';
  if (p.status && STATUSES.indexOf(p.status) === -1) return 'schema';
  if (ev.type === 'conversation_summary' && (!ev.session_id || !ev.pass)) return 'schema';
  return null;
}

// Verify a full chain. Returns { ok, brokenAt }.
export function verifyChain(events) {
  let prev = null;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.prev_hash !== (prev || null)) return { ok: false, brokenAt: i, why: 'prev_hash mismatch' };
    if (e.hash !== hashEvent(e, prev)) return { ok: false, brokenAt: i, why: 'hash mismatch (tampered)' };
    prev = e.hash;
  }
  return { ok: true, brokenAt: -1 };
}
