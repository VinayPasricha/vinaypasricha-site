// retention.mjs — the 30-day job. Reconcile FIRST (essence confirmed + chained), THEN hard-delete raw.
// The Holding Buffer DB has backups DISABLED, so this deletion is truly real (no ~day-37 backup leak).
import * as store from '../src/store.js';
import * as sessions from '../src/sessions.js';

const DAYS = Number(process.env.RAW_RETENTION_DAYS || 30);

export async function runRetention(now = Date.now()) {
  const cutISO = new Date(now - DAYS * 86400000).toISOString();
  // group expiring raw turns by session
  const turns = store.allTurns().filter(t => t.ts < cutISO);
  const bySession = new Map();
  for (const t of turns) { const a = bySession.get(t.session_id) || { user_id: t.user_id, n: 0 }; a.n++; bySession.set(t.session_id, a); }

  let reconciled = 0;
  for (const [sid, info] of bySession) { await sessions.reconcile(sid, info.user_id); reconciled++; }  // 1) essence first
  store.deleteRawOlderThan(cutISO);                                                                     // 2) then delete raw

  const report = { cutoff: cutISO, sessions_reconciled: reconciled, raw_turns_deleted: turns.length };
  return report;
}

if (process.argv[1] && process.argv[1].endsWith('retention.mjs')) {
  runRetention().then(r => console.log('retention:', JSON.stringify(r))).catch(e => { console.error(e); process.exit(1); });
}
