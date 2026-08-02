// Direct Notebook publishing for the private Studio.
// Essays live in Firestore; images remain private in Cloud Storage and are
// streamed through a public, unguessable URL used only by published essays.
import { Storage } from '@google-cloud/storage';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, COLLECTIONS } from './firestore.js';
import { completeModel } from './services/ai.js';
import { extractJson } from './abl/json.js';

const MAX_TEXT = 30000;
const MAX_BODY = 80000;
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const BUCKET = process.env.NOTEBOOK_BUCKET || process.env.MATERIALS_BUCKET || 'vinaypasricha-course-materials';
const IMAGE_ID = /^[a-f0-9-]{36}\.(?:png|jpg|webp)$/;
let storage;
const here = path.dirname(fileURLToPath(import.meta.url));
const STATIC_NOTEBOOK = path.resolve(here, '..', '..', 'assets', 'data', 'notebook.json');

function bucket() {
  if (!storage) storage = new Storage();
  return storage.bucket(BUCKET);
}

function text(value, max) {
  return String(value == null ? '' : value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max);
}

export function notebookSlug(value) {
  return text(value, 180).toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 64) || 'untitled';
}

function validImage(image) {
  const url = text(image && image.url, 240);
  const match = url.match(/^\/api\/notebook\/images\/([a-f0-9-]{36}\.(?:png|jpg|webp))$/);
  if (!match) return null;
  return { id: match[1], url, alt: text(image.alt, 180) || 'Essay image' };
}

export function sanitizeNotebookEssay(input = {}) {
  const title = text(input.title, 180).replace(/<[^>]*>/g, '');
  if (title.length < 3) throw new Error('Add a headline before saving.');
  const slug = notebookSlug(input.slug || title);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(input.date || '')) ? String(input.date) : new Date().toISOString().slice(0, 10);
  const body = text(input.body, MAX_BODY);
  if (body.length < 20) throw new Error('Add the article text before saving.');
  const tags = [...new Set((Array.isArray(input.tags) ? input.tags : String(input.tags || '').split(','))
    .map((tag) => text(tag, 36).toLowerCase().replace(/^#/, ''))
    .filter(Boolean))].slice(0, 6);
  const images = (Array.isArray(input.images) ? input.images : []).map(validImage).filter(Boolean).slice(0, 8);
  const words = body.split(/\s+/).filter(Boolean).length;
  return {
    slug,
    title,
    dek: text(input.dek, 300).replace(/<[^>]*>/g, ''),
    date,
    monthLabel: new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    tags,
    readingMin: Math.max(1, Math.round(words / 220)),
    status: input.status === 'published' ? 'published' : 'draft',
    body,
    images,
    updated_at: new Date().toISOString(),
  };
}

export function decodeNotebookImage(data) {
  const match = String(data || '').match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) throw new Error('Use a PNG, JPG or WebP image.');
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length) throw new Error('That image is empty.');
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error('That image is larger than 6 MB.');
  const png = buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  const jpg = buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const webp = buffer.length > 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  if (!png && !jpg && !webp) throw new Error('The file does not appear to be a valid PNG, JPG or WebP image.');
  const ext = png ? 'png' : (jpg ? 'jpg' : 'webp');
  return { buffer, ext, contentType: ext === 'jpg' ? 'image/jpeg' : `image/${ext}` };
}

function staticEssays() {
  try {
    const parsed = JSON.parse(fs.readFileSync(STATIC_NOTEBOOK, 'utf8'));
    return Array.isArray(parsed.essays) ? parsed.essays.map(sanitizeNotebookEssay) : [];
  } catch (error) { return []; }
}

async function listEssays({ publishedOnly = false } = {}) {
  const snap = await db.collection(COLLECTIONS.notebookEssays).get();
  const merged = new Map(staticEssays().map((essay) => [essay.slug, essay]));
  snap.docs.forEach((doc) => merged.set(doc.id, doc.data()));
  return [...merged.values()]
    .filter((essay) => essay.status !== 'archived' && (!publishedOnly || essay.status === 'published'))
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

function imageContentType(id) {
  return id.endsWith('.png') ? 'image/png' : (id.endsWith('.webp') ? 'image/webp' : 'image/jpeg');
}

export function registerNotebook(app, { requireAdmin, rateLimit }) {
  app.get('/api/notebook', async (req, res) => {
    try {
      res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
      res.json({ ok: true, essays: await listEssays({ publishedOnly: true }) });
    } catch (error) {
      console.error('[notebook] public list failed:', error.message);
      res.status(503).json({ ok: false, error: 'notebook_unavailable' });
    }
  });

  app.get('/api/notebook/images/:id', async (req, res) => {
    const id = String(req.params.id || '');
    if (!IMAGE_ID.test(id)) return res.status(404).send('Not found');
    try {
      const file = bucket().file(`notebook/${id}`);
      const [exists] = await file.exists();
      if (!exists) return res.status(404).send('Not found');
      res.set('Content-Type', imageContentType(id));
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
      return file.createReadStream().on('error', () => { if (!res.headersSent) res.status(404).end(); }).pipe(res);
    } catch (error) {
      return res.status(404).send('Not found');
    }
  });

  app.get('/api/studio/notebook', requireAdmin, async (req, res) => {
    try { res.json({ ok: true, essays: await listEssays() }); }
    catch (error) { res.status(500).json({ ok: false, error: 'load_failed', detail: error.message }); }
  });

  app.post('/api/studio/notebook/essays', requireAdmin, async (req, res) => {
    try {
      const essay = sanitizeNotebookEssay(req.body || {});
      const original = notebookSlug(req.body && req.body.original_slug || essay.slug);
      await db.collection(COLLECTIONS.notebookEssays).doc(essay.slug).set(essay, { merge: false });
      if (original !== essay.slug) await db.collection(COLLECTIONS.notebookEssays).doc(original).set({ slug: original, status: 'archived', updated_at: new Date().toISOString() }, { merge: false });
      res.json({ ok: true, essay, live_url: `/paths/essay?slug=${encodeURIComponent(essay.slug)}` });
    } catch (error) {
      res.status(400).json({ ok: false, error: 'save_failed', detail: error.message });
    }
  });

  app.post('/api/studio/notebook/images', requireAdmin, async (req, res) => {
    try {
      const decoded = decodeNotebookImage(req.body && req.body.data);
      const id = `${crypto.randomUUID()}.${decoded.ext}`;
      await bucket().file(`notebook/${id}`).save(decoded.buffer, {
        resumable: false,
        contentType: decoded.contentType,
        metadata: { cacheControl: 'public, max-age=31536000, immutable' },
      });
      const image = { id, url: `/api/notebook/images/${id}`, alt: text(req.body && req.body.alt, 180) || 'Essay image' };
      res.status(201).json({ ok: true, image });
    } catch (error) {
      res.status(400).json({ ok: false, error: 'upload_failed', detail: error.message });
    }
  });

  app.post('/api/studio/notebook/assist', requireAdmin, rateLimit({ windowMs: 60 * 60 * 1000, max: 12 }), async (req, res) => {
    try {
      const source = text(req.body && req.body.text, MAX_TEXT);
      if (source.length < 40) return res.status(400).json({ ok: false, error: 'text_required', detail: 'Paste a little more of the article first.' });
      const raw = await completeModel({
        model: process.env.VERTEX_MODEL || 'gemini-2.5-flash',
        generationConfig: { temperature: 0.2, maxOutputTokens: 8192, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
        system: `You are Vinay Pasricha's careful editorial assistant. Turn supplied draft text into a clean web essay without changing its argument, voice, facts or meaning. Do not invent examples, evidence or claims. Correct obvious spelling and punctuation, use short readable paragraphs, and add only genuinely helpful Markdown headings. Return JSON only with: title, dek, tags (3-5 short lowercase strings), body. The body must contain the complete edited article, not a summary. Do not include the title inside body.`,
        messages: [{ role: 'user', content: source }],
      });
      const prepared = extractJson(raw);
      if (!prepared || !prepared.title || !prepared.body) throw new Error('The editor returned an incomplete draft. Please try again.');
      res.json({ ok: true, prepared: {
        title: text(prepared.title, 180).replace(/<[^>]*>/g, ''),
        dek: text(prepared.dek, 300).replace(/<[^>]*>/g, ''),
        tags: (Array.isArray(prepared.tags) ? prepared.tags : []).map((tag) => text(tag, 36).toLowerCase()).filter(Boolean).slice(0, 6),
        body: text(prepared.body, MAX_BODY),
      } });
    } catch (error) {
      console.error('[notebook] AI preparation failed:', error.message);
      res.status(500).json({ ok: false, error: 'assist_failed', detail: error.message || 'The AI editor could not prepare this draft.' });
    }
  });
}

export const notebookLimits = { maxText: MAX_TEXT, maxBody: MAX_BODY, maxImageBytes: MAX_IMAGE_BYTES };
