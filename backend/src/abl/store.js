// ABL data-access layer over Firestore. Mirrors the shape the original Supabase
// repo exposed, but stores documents in the abl_* collections. Field names stay
// snake_case so the prompt builders read them directly.
//
// Query note: we keep Firestore queries to equality filters only and sort in
// memory, so no composite indexes are required.
import crypto from 'node:crypto';
import { FieldValue } from '@google-cloud/firestore';
import { db, COLLECTIONS } from '../firestore.js';

const nowISO = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();

// ---- slug helpers ----------------------------------------------------------
function nameSlug(name) {
  return (
    String(name || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'guest'
  );
}
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
function randomCode(len = 6) {
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}
export function sha256(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }
export function makeSlug(name) {
  // Company-based, clean slug — no random code appended. This slug IS the
  // private participant link, so callers MUST run it through uniqueSlug() so
  // two participants at the same company can't overwrite each other's session.
  return nameSlug(name);
}

// Append -2, -3, ... until the slug is free. Keeps same-named companies from
// colliding on (and hijacking) an existing participant's session.
async function uniqueSlug(base) {
  let slug = base;
  let n = 1;
  while (await getParticipantBySlug(slug)) { n += 1; slug = `${base}-${n}`; }
  return slug;
}

const col = (name) => db.collection(name);
const docData = (d) => (d.exists ? { id: d.id, ...d.data() } : null);

// ---- participants ----------------------------------------------------------
export async function listParticipants() {
  const snap = await col(COLLECTIONS.ablParticipants).orderBy('updated_at', 'desc').limit(500).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function getParticipant(id) {
  return docData(await col(COLLECTIONS.ablParticipants).doc(id).get());
}
export async function getParticipantBySlug(slug) {
  const snap = await col(COLLECTIONS.ablParticipants).where('slug', '==', slug).limit(1).get();
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}
export async function getParticipantByEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;
  const exact = await col(COLLECTIONS.ablParticipants).where('email_normalized', '==', normalized).limit(1).get();
  if (!exact.empty) return { id: exact.docs[0].id, ...exact.docs[0].data() };
  // Older participant records predate email_normalized. The dashboard holds a
  // small cohort, so this compatibility scan is bounded and avoids a migration.
  const legacy = await col(COLLECTIONS.ablParticipants).limit(500).get();
  const match = legacy.docs.find((d) => String(d.data().email || '').trim().toLowerCase() === normalized);
  return match ? { id: match.id, ...match.data() } : null;
}
export async function createParticipant(input) {
  const id = uuid();
  // Clean, company-based link (e.g. /s/acme-corp). The random code is retained
  // only for access_code_hash — it is no longer part of the shared URL.
  const code = randomCode(10);
  const slug = await uniqueSlug(makeSlug(input.company_name || input.name));
  const p = {
    slug, access_code_hash: sha256(code), name: input.name, company_name: input.company_name,
    email: input.email || null,
    email_normalized: input.email ? String(input.email).trim().toLowerCase() : null,
    login_enabled: input.login_enabled !== false,
    role_title: input.role_title || null,
    company_website: input.company_website || null, industry: input.industry || null,
    geography: input.geography || null, business_model: input.business_model || null,
    status: 'draft', qa_status: 'not_started', link_approved: false, current_stage: null,
    max_messages: 200, message_count: 0, vinay_brief_status: 'none',
    last_activity_at: null, created_at: nowISO(), updated_at: nowISO(), approved_at: null,
  };
  await col(COLLECTIONS.ablParticipants).doc(id).set(p);
  return { id, ...p };
}

// ---- passwordless participant access -------------------------------------
export async function saveAuthCode(email, input) {
  const id = sha256(String(email || '').trim().toLowerCase());
  const row = {
    participant_id: input.participant_id,
    email_normalized: String(email || '').trim().toLowerCase(),
    code_hash: input.code_hash,
    expires_at: input.expires_at,
    attempts: 0,
    created_at: nowISO(),
  };
  await col(COLLECTIONS.ablAuthCodes).doc(id).set(row);
  return { id, ...row };
}
export async function getAuthCode(email) {
  const id = sha256(String(email || '').trim().toLowerCase());
  return docData(await col(COLLECTIONS.ablAuthCodes).doc(id).get());
}
export async function incrementAuthAttempts(email) {
  const id = sha256(String(email || '').trim().toLowerCase());
  await col(COLLECTIONS.ablAuthCodes).doc(id).set({ attempts: FieldValue.increment(1) }, { merge: true });
}
export async function consumeAuthCode(email) {
  const id = sha256(String(email || '').trim().toLowerCase());
  await col(COLLECTIONS.ablAuthCodes).doc(id).delete();
}
export async function saveParticipantSession(tokenHash, input) {
  const row = {
    participant_id: input.participant_id,
    slug: input.slug,
    expires_at: input.expires_at,
    created_at: nowISO(),
  };
  await col(COLLECTIONS.ablParticipantSessions).doc(tokenHash).set(row);
  return { id: tokenHash, ...row };
}
export async function getParticipantSession(tokenHash) {
  return docData(await col(COLLECTIONS.ablParticipantSessions).doc(tokenHash).get());
}
export async function updateParticipant(id, patch) {
  const ref = col(COLLECTIONS.ablParticipants).doc(id);
  await ref.set({ ...patch, updated_at: nowISO() }, { merge: true });
  return docData(await ref.get());
}
export async function setStatus(id, status) { return updateParticipant(id, { status }); }
export async function touchActivity(id) { return updateParticipant(id, { last_activity_at: nowISO() }); }
export async function incMessageCount(id) {
  // Atomic increment (Firestore FieldValue) so concurrent turns can't corrupt
  // the counter; we read back the new value to enforce the cap.
  const ref = col(COLLECTIONS.ablParticipants).doc(id);
  await ref.set({ message_count: FieldValue.increment(1), last_activity_at: nowISO(), updated_at: nowISO() }, { merge: true });
  const snap = await ref.get();
  return (snap.exists && snap.data().message_count) || 0;
}

// ---- research --------------------------------------------------------------
export async function getResearch(participantId) {
  return docData(await col(COLLECTIONS.ablResearch).doc(participantId).get());
}
export async function upsertResearch(participantId, input) {
  const row = {
    participant_id: participantId,
    structured_context: input.structured_context || {},
    research_dossier: input.research_dossier || null,
    sources_notes: input.sources_notes || null,
    updated_at: nowISO(),
  };
  await col(COLLECTIONS.ablResearch).doc(participantId).set(row, { merge: true });
  return { id: participantId, ...row };
}

// ---- sessions & messages ---------------------------------------------------
export async function getSession(participantId, mode) {
  const snap = await col(COLLECTIONS.ablSessions)
    .where('participant_id', '==', participantId).where('mode', '==', mode).get();
  if (snap.empty) return null;
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  docs.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  return docs[0];
}

export async function getOrCreateSession(participantId, mode) {
  const existing = await getSession(participantId, mode);
  if (existing) return existing;
  const id = uuid();
  const s = {
    participant_id: participantId, mode, selected_depth: null, current_stage: null,
    status: 'open', consent_given: false, summary_reviewed: false, running_summary: null,
    created_at: nowISO(), updated_at: nowISO(),
  };
  await col(COLLECTIONS.ablSessions).doc(id).set(s);
  return { id, ...s };
}
export async function updateSession(id, patch) {
  const ref = col(COLLECTIONS.ablSessions).doc(id);
  await ref.set({ ...patch, updated_at: nowISO() }, { merge: true });
  return docData(await ref.get());
}
export async function listMessages(sessionId) {
  const snap = await col(COLLECTIONS.ablMessages).where('session_id', '==', sessionId).get();
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  rows.sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
  return rows;
}
export async function addMessage(m) {
  const id = uuid();
  const row = {
    session_id: m.session_id, participant_id: m.participant_id, role: m.role,
    content: String(m.content || ''), metadata: m.metadata || {}, created_at: nowISO(),
  };
  await col(COLLECTIONS.ablMessages).doc(id).set(row);
  return { id, ...row };
}
export async function deleteMessages(ids) {
  const cleanIds = Array.from(new Set((ids || []).filter(Boolean)));
  for (let offset = 0; offset < cleanIds.length; offset += 450) {
    const batch = db.batch();
    cleanIds.slice(offset, offset + 450).forEach((id) => batch.delete(col(COLLECTIONS.ablMessages).doc(id)));
    await batch.commit();
  }
  return { deleted: cleanIds.length };
}

// ---- shared course memory -------------------------------------------------
// One compact, participant-editable memory shared by AI Journey, VED, SIV and
// the post-course check-ins. Structured fields are merged so a later turn does
// not erase useful facts established earlier.
export async function getMemory(participantId) {
  return docData(await col(COLLECTIONS.ablMemory).doc(participantId).get());
}
export async function upsertMemory(participantId, input) {
  const current = await getMemory(participantId);
  const fields = { ...((current && current.fields) || {}), ...((input && input.fields) || {}) };
  const row = {
    participant_id: participantId,
    fields,
    participant_note: input && Object.prototype.hasOwnProperty.call(input, 'participant_note')
      ? String(input.participant_note || '').slice(0, 6000)
      : ((current && current.participant_note) || ''),
    updated_at: nowISO(),
  };
  await col(COLLECTIONS.ablMemory).doc(participantId).set(row, { merge: true });
  return { id: participantId, ...row };
}

// ---- meeting / conversation summaries ------------------------------------
export async function listNotes(participantId) {
  const snap = await col(COLLECTIONS.ablNotes).where('participant_id', '==', participantId).get();
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  rows.sort((a, b) => String(b.occurred_at || b.created_at || '').localeCompare(String(a.occurred_at || a.created_at || '')));
  return rows;
}
export async function addNote(participantId, input) {
  const id = uuid();
  const row = {
    participant_id: participantId,
    title: String((input && input.title) || 'Meeting summary').slice(0, 180),
    content: String((input && input.content) || '').slice(0, 30000),
    raw_transcript: String((input && input.raw_transcript) || '').slice(0, 300000),
    source_kind: input && input.source_kind === 'transcript' ? 'transcript' : 'summary',
    structured_context: (input && input.structured_context) || null,
    transcript_truncated: !!(input && input.transcript_truncated),
    processed_at: (input && input.processed_at) || null,
    review_status: (input && input.review_status) === 'draft' ? 'draft' : 'approved',
    approved_at: (input && input.approved_at) || null,
    share_with_participant: !!(input && input.share_with_participant),
    source_name: String((input && input.source_name) || '').slice(0, 240),
    visibility: input && input.visibility === 'private' ? 'private' : 'course_memory',
    occurred_at: (input && input.occurred_at) || nowISO(),
    created_at: nowISO(),
    updated_at: nowISO(),
  };
  await col(COLLECTIONS.ablNotes).doc(id).set(row);
  return { id, ...row };
}
export async function updateNote(participantId, id, input) {
  const ref = col(COLLECTIONS.ablNotes).doc(id);
  const note = await ref.get();
  if (!note.exists || note.data().participant_id !== participantId) return null;
  const patch = { updated_at: nowISO() };
  if (Object.prototype.hasOwnProperty.call(input || {}, 'content')) patch.content = String(input.content || '').slice(0, 30000);
  if (Object.prototype.hasOwnProperty.call(input || {}, 'title')) patch.title = String(input.title || 'Meeting summary').slice(0, 180);
  if (Object.prototype.hasOwnProperty.call(input || {}, 'visibility')) patch.visibility = input.visibility === 'private' ? 'private' : 'course_memory';
  if (Object.prototype.hasOwnProperty.call(input || {}, 'review_status')) patch.review_status = input.review_status === 'approved' ? 'approved' : 'draft';
  if (Object.prototype.hasOwnProperty.call(input || {}, 'approved_at')) patch.approved_at = input.approved_at || null;
  if (Object.prototype.hasOwnProperty.call(input || {}, 'share_with_participant')) patch.share_with_participant = !!input.share_with_participant;
  await ref.set(patch, { merge: true });
  return { id, ...note.data(), ...patch };
}
export async function deleteNote(participantId, id) {
  const ref = col(COLLECTIONS.ablNotes).doc(id);
  const note = await ref.get();
  if (!note.exists || note.data().participant_id !== participantId) return false;
  await ref.delete();
  return true;
}

// ---- participant files ----------------------------------------------------
// Files are kept in private Firestore chunks so they survive Cloud Run
// restarts. Each chunk stays comfortably below Firestore's 1 MiB document
// limit; only admin-gated routes can list or download them.
const ASSET_CHUNK_BYTES = 540_000;
export async function listAssets(participantId) {
  const snap = await col(COLLECTIONS.ablAssets).where('participant_id', '==', participantId).get();
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  rows.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  return rows;
}
export async function addAsset(participantId, input) {
  const id = uuid();
  const buffer = Buffer.isBuffer(input.buffer) ? input.buffer : Buffer.from(input.buffer || '');
  const chunks = [];
  for (let offset = 0; offset < buffer.length; offset += ASSET_CHUNK_BYTES) {
    chunks.push(buffer.subarray(offset, offset + ASSET_CHUNK_BYTES).toString('base64'));
  }
  const row = {
    participant_id: participantId,
    title: String(input.title || input.file_name || 'Participant file').slice(0, 180),
    description: String(input.description || '').slice(0, 2000),
    file_name: String(input.file_name || 'participant-file').replace(/[\\/\u0000-\u001f]/g, '_').slice(0, 240),
    mime_type: String(input.mime_type || 'application/octet-stream').slice(0, 160),
    byte_size: buffer.length,
    chunk_count: chunks.length,
    extracted_text: String(input.extracted_text || '').slice(0, 300000),
    extraction_status: input.extraction_error ? 'failed' : (input.extractable ? 'extracted' : 'not_supported'),
    extraction_error: String(input.extraction_error || '').slice(0, 500),
    context_truncated: !!input.context_truncated,
    review_status: 'draft',
    visibility: 'private',
    approved_at: null,
    created_at: nowISO(),
    updated_at: nowISO(),
  };
  await col(COLLECTIONS.ablAssets).doc(id).set(row);
  for (let i = 0; i < chunks.length; i += 450) {
    const batch = db.batch();
    chunks.slice(i, i + 450).forEach((data, relativeIndex) => {
      const index = i + relativeIndex;
      batch.set(col(COLLECTIONS.ablAssetChunks).doc(`${id}_${String(index).padStart(4, '0')}`), {
        asset_id: id, participant_id: participantId, index, data,
      });
    });
    await batch.commit();
  }
  return { id, ...row };
}
export async function getAsset(participantId, id) {
  const asset = docData(await col(COLLECTIONS.ablAssets).doc(id).get());
  return asset && asset.participant_id === participantId ? asset : null;
}
export async function getAssetBuffer(participantId, id) {
  const asset = await getAsset(participantId, id);
  if (!asset) return null;
  const snap = await col(COLLECTIONS.ablAssetChunks).where('asset_id', '==', id).get();
  const chunks = snap.docs.map((d) => d.data()).sort((a, b) => Number(a.index) - Number(b.index));
  if (chunks.length !== Number(asset.chunk_count || 0)) return null;
  return { asset, buffer: Buffer.concat(chunks.map((chunk) => Buffer.from(chunk.data, 'base64'))) };
}
export async function updateAsset(participantId, id, input) {
  const current = await getAsset(participantId, id);
  if (!current) return null;
  const patch = { updated_at: nowISO() };
  if (Object.prototype.hasOwnProperty.call(input || {}, 'title')) patch.title = String(input.title || current.file_name).slice(0, 180);
  if (Object.prototype.hasOwnProperty.call(input || {}, 'description')) patch.description = String(input.description || '').slice(0, 2000);
  if (Object.prototype.hasOwnProperty.call(input || {}, 'review_status')) {
    patch.review_status = input.review_status === 'approved' ? 'approved' : 'draft';
    patch.visibility = patch.review_status === 'approved' ? 'course_memory' : 'private';
    patch.approved_at = patch.review_status === 'approved' ? nowISO() : null;
  }
  await col(COLLECTIONS.ablAssets).doc(id).set(patch, { merge: true });
  return { ...current, ...patch };
}
export async function deleteAsset(participantId, id) {
  const asset = await getAsset(participantId, id);
  if (!asset) return false;
  const chunks = await col(COLLECTIONS.ablAssetChunks).where('asset_id', '==', id).get();
  for (let i = 0; i < chunks.docs.length; i += 450) {
    const batch = db.batch();
    chunks.docs.slice(i, i + 450).forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
  await col(COLLECTIONS.ablAssets).doc(id).delete();
  return true;
}

// ---- outputs ---------------------------------------------------------------
export async function getOutputs(participantId) {
  const snap = await col(COLLECTIONS.ablOutputs).where('participant_id', '==', participantId).get();
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  rows.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  return rows;
}
export async function getLatestOutput(participantId, type) {
  const snap = await col(COLLECTIONS.ablOutputs)
    .where('participant_id', '==', participantId).where('output_type', '==', type).get();
  if (snap.empty) return null;
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  rows.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  return rows[0];
}
export async function getOutput(id) {
  return docData(await col(COLLECTIONS.ablOutputs).doc(id).get());
}
export async function deleteOutput(participantId, type) {
  const snap = await col(COLLECTIONS.ablOutputs)
    .where('participant_id', '==', participantId).where('output_type', '==', type).get();
  if (snap.empty) return 0;
  const batch = db.batch();
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  return snap.size;
}
export async function saveOutput(o) {
  const existing = await getLatestOutput(o.participant_id, o.output_type);
  if (existing) {
    const ref = col(COLLECTIONS.ablOutputs).doc(existing.id);
    await ref.set({ session_id: o.session_id || null, content_markdown: o.content_markdown,
      content_json: o.content_json || null, updated_at: nowISO() }, { merge: true });
    return docData(await ref.get());
  }
  const id = uuid();
  const row = {
    participant_id: o.participant_id, session_id: o.session_id || null, output_type: o.output_type,
    content_markdown: o.content_markdown, content_json: o.content_json || null,
    reviewed_content_markdown: null, participant_approved: false, created_at: nowISO(), updated_at: nowISO(),
  };
  await col(COLLECTIONS.ablOutputs).doc(id).set(row);
  return { id, ...row };
}
export async function reviewShareSummary(id, reviewed_markdown, approved) {
  const ref = col(COLLECTIONS.ablOutputs).doc(id);
  await ref.set({ reviewed_content_markdown: reviewed_markdown, participant_approved: !!approved, updated_at: nowISO() }, { merge: true });
  return docData(await ref.get());
}

// ---- qa --------------------------------------------------------------------
export async function getQa(participantId) {
  return docData(await col(COLLECTIONS.ablQa).doc(participantId).get());
}
export async function upsertQa(participantId, input) {
  const row = { participant_id: participantId, ...input, updated_at: nowISO() };
  await col(COLLECTIONS.ablQa).doc(participantId).set(row, { merge: true });
  return { id: participantId, ...row };
}

// ---- delete (cascade) ------------------------------------------------------
// Remove a participant and everything belonging to them.
export async function deleteParticipant(id) {
  const refs = [];
  for (const c of [COLLECTIONS.ablSessions, COLLECTIONS.ablMessages, COLLECTIONS.ablOutputs]) {
    const snap = await col(c).where('participant_id', '==', id).get();
    snap.docs.forEach((d) => refs.push(d.ref));
  }
  const notes = await col(COLLECTIONS.ablNotes).where('participant_id', '==', id).get();
  notes.docs.forEach((d) => refs.push(d.ref));
  const assets = await col(COLLECTIONS.ablAssets).where('participant_id', '==', id).get();
  for (const asset of assets.docs) await deleteAsset(id, asset.id);
  refs.push(col(COLLECTIONS.ablResearch).doc(id));
  refs.push(col(COLLECTIONS.ablMemory).doc(id));
  refs.push(col(COLLECTIONS.ablQa).doc(id));
  refs.push(col(COLLECTIONS.ablParticipants).doc(id));
  let batch = db.batch(), n = 0;
  for (const ref of refs) {
    batch.delete(ref);
    if (++n % 450 === 0) { await batch.commit(); batch = db.batch(); }
  }
  await batch.commit();
  return { deleted: true, docs: refs.length };
}
