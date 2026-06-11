// app.js — the five Stage-1 endpoints. Express. Starts the inactivity finalizer.
import express from 'express';
import { randomUUID } from 'node:crypto';
import * as store from './store.js';
import * as sessions from './sessions.js';

const app = express();
app.use(express.json({ limit: '1mb' }));

const INACTIVITY_MIN = Number(process.env.INACTIVITY_MINUTES || 30);

// --- identity (in-memory; TODO: Postgres `users` table) ---
const bySub = new Map();   // google_sub -> user_id
const users = new Map();   // user_id -> { email, phone, google_sub }

async function verifyGoogle(token) {
  // TODO production: const { OAuth2Client } = await import('google-auth-library');
  //   const t = await new OAuth2Client(process.env.GOOGLE_CLIENT_ID).verifyIdToken({ idToken: token, audience: process.env.GOOGLE_CLIENT_ID });
  //   return t.getPayload();   // { sub, email, ... }
  if (process.env.GOOGLE_CLIENT_ID && token) throw new Error('configure google-auth-library verifyIdToken');
  return null; // local/dev: identity comes from the posted email instead
}

// POST /auth  { google_token?, email, phone }  -> { user_id, session }
app.post('/auth', async (req, res) => {
  try {
    const { google_token, email, phone } = req.body || {};
    let sub, addr = email;
    const g = await verifyGoogle(google_token).catch(() => null);
    if (g) { sub = g.sub; addr = g.email; } else { sub = 'local:' + (email || ''); }
    if (!sub || sub === 'local:') return res.status(400).json({ error: 'email or google_token required' });
    if (!phone) return res.status(400).json({ error: 'phone required (collected, not OTP-verified)' });
    let uid = bySub.get(sub);
    if (!uid) { uid = randomUUID(); bySub.set(sub, uid); }
    users.set(uid, { email: addr, phone, google_sub: sub });   // phone stored, never gates access
    res.json({ user_id: uid, session: { user_id: uid } });
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

// POST /turns  -> Holding Buffer (backups-off DB)
app.post('/turns', (req, res) => {
  const t = req.body || {};
  if (!t.session_id || !t.user_id) return res.status(400).json({ error: 'session_id + user_id required' });
  sessions.ensureSession(t.session_id, t.user_id, t.runtime, t.agent);
  store.recordTurn({ session_id: t.session_id, user_id: t.user_id, turn_index: t.turn_index || 0, role: t.role, text: t.text, ts: t.ts || new Date().toISOString() });
  res.json({ accepted: true });
});

// POST /events  -> append to the Essence Log (TRUTH in object storage) + projection
app.post('/events', async (req, res) => {
  const { user_id, events } = req.body || {};
  if (!user_id || !Array.isArray(events)) return res.status(400).json({ error: 'user_id + events[] required' });
  res.json(await store.appendEvents(user_id, events));
});

// GET /memory/:user_id
app.get('/memory/:user_id', async (req, res) => res.json(await store.getMemory(req.params.user_id)));

// POST /erase  -> crypto-shred + tombstone
app.post('/erase', async (req, res) => {
  const { user_id, reason } = req.body || {};
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  res.json(await store.erase(user_id, reason));
});

// inactivity finalizer (the non-explicit finalize path; the boot sweeper covers abandoned ones)
setInterval(() => { sessions.sweepInactive(INACTIVITY_MIN).catch(() => {}); }, 60 * 1000);

const PORT = process.env.PORT || 3000;
if (process.argv[1] && process.argv[1].endsWith('app.js')) app.listen(PORT, () => console.log('memory server on :' + PORT));
export default app;
