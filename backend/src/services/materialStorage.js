// Course-material file storage on Google Cloud Storage.
//
// The bucket is PRIVATE (public access prevention enforced). Files never have a
// public URL: an admin uploads through a Studio-gated endpoint, and a
// participant downloads only through a slug-gated endpoint that streams the
// bytes back. So an uploaded case study is exactly as protected as the
// workspace it belongs to.
//
// On Cloud Run the client authenticates with the service account automatically.
// Locally it uses `gcloud auth application-default login` credentials.
import { Storage } from '@google-cloud/storage';
import crypto from 'node:crypto';

const BUCKET = process.env.MATERIALS_BUCKET || 'vinaypasricha-course-materials';
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB — fits within the 10 MB JSON body limit as base64.

let _storage = null;
function bucket() {
  if (!_storage) _storage = new Storage();
  return _storage.bucket(BUCKET);
}

function safeName(name) {
  return (String(name || '').replace(/[^\w.\- ]+/g, '_').trim().slice(0, 120)) || 'material.pdf';
}

// Turn a base64 payload (with or without a data: prefix) into a validated PDF
// buffer. Rejects anything that is not a real PDF or is over the size cap.
export function decodePdfUpload(data) {
  const b64 = String(data || '').replace(/^data:[^;]+;base64,/, '');
  if (!b64 || !/^[A-Za-z0-9+/=\s]+$/.test(b64)) throw new Error('The file could not be read.');
  const buffer = Buffer.from(b64, 'base64');
  if (!buffer.length) throw new Error('The file is empty.');
  if (buffer.length > MAX_BYTES) throw new Error('The file is larger than 8 MB. Upload a smaller PDF or paste a link instead.');
  if (buffer.slice(0, 5).toString('latin1') !== '%PDF-') throw new Error('Only PDF files can be uploaded. Use the link field for other file types.');
  return buffer;
}

// Store the PDF under an unguessable key and return that key. The key — never a
// URL — is what gets saved on the material record.
export async function uploadMaterialPdf({ buffer, fileName }) {
  const key = 'materials/' + crypto.randomUUID() + '.pdf';
  await bucket().file(key).save(buffer, {
    resumable: false,
    contentType: 'application/pdf',
    metadata: {
      cacheControl: 'private, max-age=0, no-store',
      contentDisposition: 'inline; filename="' + safeName(fileName) + '"',
    },
  });
  return { file_key: key };
}

// Stream a stored file to the response. Returns false when the object is gone
// (so the caller can 404) and never leaks the bucket or key to the client.
export async function streamMaterialFile(fileKey, res, { fileName } = {}) {
  if (!fileKey || String(fileKey).indexOf('..') !== -1) return false;
  const file = bucket().file(String(fileKey));
  const [exists] = await file.exists();
  if (!exists) return false;
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', 'inline; filename="' + safeName(fileName || 'material.pdf') + '"');
  res.set('Cache-Control', 'private, max-age=0, no-store');
  await new Promise((resolve, reject) => {
    file.createReadStream().on('error', reject).on('end', resolve).pipe(res);
  });
  return true;
}

// Best-effort delete when a material is removed or its file replaced.
export async function deleteMaterialFile(fileKey) {
  if (!fileKey) return;
  try { await bucket().file(String(fileKey)).delete({ ignoreNotFound: true }); } catch (e) { /* best-effort */ }
}

export const materialStorageInfo = { bucket: BUCKET, maxBytes: MAX_BYTES };
