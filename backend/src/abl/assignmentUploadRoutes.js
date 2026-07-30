import crypto from 'node:crypto';
import express from 'express';
import { Storage } from '@google-cloud/storage';
import { db, COLLECTIONS } from '../firestore.js';
import * as repo from './store.js';

const storage = new Storage();
const col = (name) => db.collection(name);
const nowISO = () => new Date().toISOString();
const docData = (d) => (d.exists ? { id: d.id, ...d.data() } : null);
const ok = (res, data, code = 200) => res.status(code).json({ ok: true, data });
const fail = (res, error, code = 400) => res.status(code).json({ ok: false, error });
const MAX_BYTES = 15 * 1024 * 1024;
const TYPES = new Set([
  'application/pdf','application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg','image/png','image/webp',
]);

function bucketName() {
  const project = String(process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || '').trim();
  return String(process.env.ABL_UPLOAD_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || (project ? `${project}.appspot.com` : '')).trim();
}
function safeName(v) {
  return (String(v || 'assignment-file').replace(/[\\/\0]/g, '-').replace(/[^a-zA-Z0-9._() -]+/g, '-').trim() || 'assignment-file').slice(0, 180);
}
function cookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}
function requireStudio(req, res, next) {
  const pass = String(process.env.STUDIO_PASSPHRASE || '').trim();
  const expected = pass ? crypto.createHash('sha256').update(`studio:${pass}`).digest('hex') : '';
  const token = req.get('x-admin-token') || '';
  if ((expected && cookies(req).__session === expected) || (process.env.ADMIN_TOKEN && token === process.env.ADMIN_TOKEN)) return next();
  return fail(res, 'unauthorized', 401);
}
async function sendFile(res, submission) {
  const bucket = bucketName();
  if (!bucket) return fail(res, 'Assignment file storage is not configured.', 503);
  if (!submission || !submission.uploaded_object) return fail(res, 'Uploaded file not found.', 404);
  const file = storage.bucket(bucket).file(submission.uploaded_object);
  const [exists] = await file.exists();
  if (!exists) return fail(res, 'Uploaded file not found.', 404);
  res.set('Cache-Control', 'private, no-store');
  res.set('Content-Type', submission.uploaded_file_mime || 'application/octet-stream');
  res.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(safeName(submission.uploaded_file_name))}`);
  file.createReadStream().on('error', (e) => res.destroy(e)).pipe(res);
}

export function registerAssignmentUploadRoutes(app) {
  const raw = express.raw({ type: () => true, limit: MAX_BYTES });

  app.post('/api/abl/workspace/:slug/submissions/:assignmentId/upload', raw, async (req, res) => {
    try {
      const participant = req.ablParticipant;
      if (!participant || participant.slug !== req.params.slug) return fail(res, 'Sign-in required.', 401);
      const assignment = docData(await col(COLLECTIONS.ablAssignments).doc(req.params.assignmentId).get());
      const id = `${req.params.assignmentId}_${participant.id}`;
      const existing = docData(await col(COLLECTIONS.ablSubmissions).doc(id).get());
      if (!assignment && !existing) return fail(res, 'Assignment not available.', 404);
      const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      const mime = String(req.get('content-type') || '').split(';')[0].toLowerCase();
      const name = safeName(req.get('x-file-name'));
      if (!body.length) return fail(res, 'Choose a file to upload.');
      if (!TYPES.has(mime)) return fail(res, 'Upload a PDF, Word, PowerPoint, JPG, PNG or WebP file.', 415);
      const bucket = bucketName();
      if (!bucket) return fail(res, 'Assignment uploads are not configured yet.', 503);
      const objectName = `abl-assignments/${participant.id}/${req.params.assignmentId}/${crypto.randomUUID()}-${name}`;
      await storage.bucket(bucket).file(objectName).save(body, { resumable: false, validation: 'crc32c', contentType: mime, metadata: { cacheControl: 'private, no-store' } });
      const row = {
        assignment_id: req.params.assignmentId, participant_id: participant.id,
        status: existing && existing.status || 'draft', response_text: existing && existing.response_text || '',
        uploaded_object: objectName, uploaded_file_name: name, uploaded_file_mime: mime,
        uploaded_file_size: body.length, uploaded_at: nowISO(), updated_at: nowISO(),
        file_url: `/api/abl/workspace/admin/submissions/${encodeURIComponent(id)}/file`,
      };
      if (!existing) row.created_at = nowISO();
      await col(COLLECTIONS.ablSubmissions).doc(id).set(row, { merge: true });
      if (existing && existing.uploaded_object && existing.uploaded_object !== objectName) {
        storage.bucket(bucket).file(existing.uploaded_object).delete({ ignoreNotFound: true }).catch(() => {});
      }
      await repo.updateParticipant(participant.id, { course_last_activity_at: nowISO() });
      return ok(res, { ...row, uploaded_file_url: `/api/abl/workspace/${encodeURIComponent(participant.slug)}/submissions/${encodeURIComponent(req.params.assignmentId)}/file` }, 201);
    } catch (e) {
      if (e && e.type === 'entity.too.large') return fail(res, 'The file must be 15 MB or smaller.', 413);
      console.error('[abl-assignment-upload]', e);
      return fail(res, 'Could not upload this file.', 500);
    }
  });

  app.get('/api/abl/workspace/:slug/submissions/:assignmentId/file', async (req, res) => {
    const p = req.ablParticipant;
    if (!p || p.slug !== req.params.slug) return fail(res, 'Sign-in required.', 401);
    return sendFile(res, docData(await col(COLLECTIONS.ablSubmissions).doc(`${req.params.assignmentId}_${p.id}`).get()));
  });

  app.get('/api/abl/workspace/admin/submissions/:id/file', requireStudio, async (req, res) => {
    return sendFile(res, docData(await col(COLLECTIONS.ablSubmissions).doc(req.params.id).get()));
  });
}
