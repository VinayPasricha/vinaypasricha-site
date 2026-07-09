// Participant Room accounts + per-account outputs, backed by Firestore.
//
// The verified OTP email IS the account. A signed httpOnly cookie carries it,
// so every request knows who the participant is — their runtimes/outputs follow
// them across devices. Admins can assign a custom runtime set + note per account.
import crypto from 'node:crypto';
import { db } from '../firestore.js';
import { config } from '../config.js';

const ACCOUNTS = 'portal_accounts'; // one doc per email
const OUTPUTS = 'portal_outputs';   // one doc per (email + runtime + key)

const norm = (e) => String(e || '').trim().toLowerCase();
const acctId = (email) => crypto.createHash('sha256').update(norm(email)).digest('hex');
const outId = (email, runtime, key) =>
  crypto.createHash('sha256').update(norm(email) + '|' + runtime + '|' + (key || 'default')).digest('hex');

// NOTE: the session cookie lives in services/session.js (the shared "__session"
// cookie). This module only owns account + output data in Firestore.

/* ---------------- accounts ---------------- */
export async function ensureAccount(email, name) {
  email = norm(email);
  const ref = db.collection(ACCOUNTS).doc(acctId(email));
  const snap = await ref.get();
  const now = new Date();
  if (!snap.exists) {
    await ref.set({ email, name: name || '', assignedRuntimes: null, note: '', createdAt: now, lastLogin: now });
  } else {
    await ref.set({ lastLogin: now, name: name || snap.data().name || '' }, { merge: true });
  }
}
export async function getAccountDoc(email) {
  const snap = await db.collection(ACCOUNTS).doc(acctId(email)).get();
  return snap.exists ? snap.data() : null;
}
export async function listAccounts() {
  const q = await db.collection(ACCOUNTS).limit(1000).get();
  return q.docs.map((d) => d.data()).sort((a, b) => tms(b.lastLogin) - tms(a.lastLogin));
}
export async function setAssignment(email, { runtimes, note }) {
  email = norm(email);
  await ensureAccount(email, '');
  const patch = {};
  if (runtimes !== undefined) patch.assignedRuntimes = Array.isArray(runtimes) ? runtimes : null;
  if (note !== undefined) patch.note = String(note || '');
  await db.collection(ACCOUNTS).doc(acctId(email)).set(patch, { merge: true });
  return getAccountDoc(email);
}

/* ---------------- outputs ---------------- */
export async function saveOutput(email, { runtime, key, title, data }) {
  email = norm(email);
  if (!runtime) throw new Error('runtime required');
  await db.collection(OUTPUTS).doc(outId(email, runtime, key)).set(
    { email, runtime: String(runtime), key: key || 'default', title: String(title || ''), data: data || null, updatedAt: new Date() },
    { merge: true }
  );
}
export async function listOutputs(email) {
  email = norm(email);
  const q = await db.collection(OUTPUTS).where('email', '==', email).get();
  return q.docs.map((d) => d.data()).sort((a, b) => tms(b.updatedAt) - tms(a.updatedAt));
}

function tms(v) { return (v && typeof v.toMillis === 'function') ? v.toMillis() : (v ? new Date(v).getTime() : 0); }

// Full dashboard state for a signed-in account.
export async function accountState(email) {
  email = norm(email);
  const [doc, outputs] = await Promise.all([getAccountDoc(email), listOutputs(email)]);
  return {
    account: { email, name: (doc && doc.name) || '' },
    assignedRuntimes: (doc && doc.assignedRuntimes) || null, // null = all runtimes
    note: (doc && doc.note) || '',
    outputs: outputs.map((o) => ({ runtime: o.runtime, key: o.key, title: o.title, data: o.data, updatedAt: tms(o.updatedAt) })),
  };
}
