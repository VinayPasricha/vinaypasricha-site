// Storage logic for the whole site, backed by Firestore.
//
// Two collections (the "two folders"):
//   • conversations — one document per chat sitting, keyed by sessionId.
//     Holds the transcript, the AI's result (artefact), status, lead details,
//     and which runtime it came from.
//   • leads — one document per captured email/contact.
//
// Everything is anonymous-friendly: no sign-in required.
import { db, COLLECTIONS } from '../firestore.js';
import { config } from './../config.js';

function cleanMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((m) => m && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({
      role: ['user', 'assistant', 'system'].includes(m.role) ? m.role : 'user',
      content: String(m.content),
      at: m.at ? new Date(m.at) : new Date(),
    }));
}

function expiryDate() {
  const days = config.conversationTtlDays;
  if (!days || days <= 0) return null;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

// Save (create or update) one conversation. Idempotent on sessionId, so the
// client can save after every turn without creating duplicates.
export async function saveConversation({
  runtime,
  sessionId,
  messages,
  artefact,
  status,
  name,
  email,
  organizationName,
  userId,
  ai, // optional { model, promptVersion, inputTokens, outputTokens }
}) {
  if (!sessionId) throw new Error('sessionId is required');

  const ref = db.collection(COLLECTIONS.conversations).doc(sessionId);
  const snap = await ref.get();
  const now = new Date();

  const base = snap.exists
    ? {}
    : { createdAt: now, runtime: runtime || 'unknown' };

  const data = {
    ...base,
    runtime: runtime || (snap.exists ? snap.get('runtime') : 'unknown'),
    sessionId,
    messages: cleanMessages(messages),
    updatedAt: now,
    expiresAt: expiryDate(),
  };
  if (artefact !== undefined) data.artefact = artefact;
  if (status) data.status = status;
  if (name) data.name = name;
  if (email) data.email = email;
  if (organizationName) data.organizationName = organizationName;
  if (userId) data.userId = userId;
  if (ai) data.ai = ai;

  await ref.set(data, { merge: true });
  const saved = await ref.get();
  return { id: saved.id, ...saved.data() };
}

// Read one conversation back by its session id.
export async function getConversation(sessionId) {
  const snap = await db.collection(COLLECTIONS.conversations).doc(sessionId).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

// List recent conversations (for an admin view), optionally filtered by runtime.
export async function listConversations({ runtime, limit = 100 } = {}) {
  let q = db.collection(COLLECTIONS.conversations).orderBy('updatedAt', 'desc').limit(limit);
  if (runtime) q = db.collection(COLLECTIONS.conversations).where('runtime', '==', runtime).limit(limit);
  const snap = await q.get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Append one AI exchange (a user turn + the assistant reply) to a conversation.
// Called by the universal bridge so EVERY AI interaction on EVERY page is
// logged automatically, keyed by a per-tab sessionId. Builds the transcript
// incrementally without duplicating earlier turns.
export async function appendExchange({ sessionId, runtime, page, userText, completion, ai, name, email, phone }) {
  if (!sessionId) throw new Error('sessionId is required');

  const ref = db.collection(COLLECTIONS.conversations).doc(sessionId);
  const snap = await ref.get();
  const now = new Date();
  const existing = (snap.exists && Array.isArray(snap.get('messages'))) ? snap.get('messages') : [];

  const turns = [];
  if (userText && String(userText).trim()) {
    turns.push({ role: 'user', content: String(userText).slice(0, 8000), at: now });
  }
  if (completion && String(completion).trim()) {
    turns.push({ role: 'assistant', content: String(completion).slice(0, 8000), at: now });
  }
  if (!turns.length) return { ok: true, count: existing.length };

  const data = {
    runtime: runtime || (snap.exists ? snap.get('runtime') : 'site'),
    page: page || (snap.exists ? snap.get('page') : ''),
    sessionId,
    source: 'bridge',
    messages: existing.concat(turns),
    updatedAt: now,
    expiresAt: expiryDate(),
  };
  if (!snap.exists) data.createdAt = now;
  if (ai) data.ai = ai;
  if (name) data.name = name;
  if (email) data.email = email;
  if (phone) data.phone = phone;

  await ref.set(data, { merge: true });
  return { ok: true, count: data.messages.length };
}

// List recent leads (for the admin/studio view).
export async function listLeads({ limit = 300 } = {}) {
  const snap = await db.collection(COLLECTIONS.leads).orderBy('updatedAt', 'desc').limit(limit).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Save a captured lead (email/contact). De-dupes on email when one is given.
export async function saveLead({ email, name, phone, organizationName, source, sessionId }) {
  const now = new Date();
  const doc = {
    email: email || '',
    name: name || '',
    phone: phone || '',
    organizationName: organizationName || '',
    source: source || 'unknown',
    sessionId: sessionId || '',
    updatedAt: now,
  };

  // If we have an email, use it as the id so the same person isn't duplicated.
  if (email && email.trim()) {
    const id = email.trim().toLowerCase();
    const ref = db.collection(COLLECTIONS.leads).doc(id);
    const snap = await ref.get();
    if (!snap.exists) doc.createdAt = now;
    await ref.set(doc, { merge: true });
    return { id, ...doc };
  }

  doc.createdAt = now;
  const ref = await db.collection(COLLECTIONS.leads).add(doc);
  return { id: ref.id, ...doc };
}

// Delete a single captured lead by id (admin cleanup).
export async function deleteLead(id) {
  await db.collection(COLLECTIONS.leads).doc(String(id)).delete();
  return { deleted: true };
}
