// The Express application: API routes + (optionally) serving the static site.
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { requireAuth, verifyGoogleIdToken } from './auth.js';
import { upsertUser } from './services/users.js';
import {
  saveSivConversation,
  listSivConversations,
  getSivConversation,
} from './services/sivStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Repo root is one level up from backend/  ->  serves index.html, paths/, etc.
const SITE_ROOT = path.resolve(__dirname, '..', '..');

// Folders that must never be served even though they live in the repo.
const BLOCKED_PREFIXES = ['/uploads', '/_brief', '/_prompts', '/scraps', '/_audit', '/backend', '/server', '/.git'];

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.use(
    cors({
      origin(origin, cb) {
        // Allow same-origin / tools with no Origin header, and the allow-list.
        if (!origin || config.allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error('Origin not allowed by CORS'));
      },
    })
  );

  // ---- Health + public config ----
  app.get('/api/health', (req, res) => res.json({ ok: true }));

  // The browser needs the Google Client ID to render the sign-in button.
  // (This value is not a secret — it is designed to be public.)
  app.get('/api/config', (req, res) => {
    res.json({ googleClientId: config.googleClientId });
  });

  // ---- Auth ----
  // The frontend posts the Google credential here right after sign-in so we can
  // create/refresh the user record. The browser keeps the token for later calls.
  app.post('/api/auth/google', async (req, res) => {
    try {
      const profile = await verifyGoogleIdToken(req.body?.credential);
      const user = await upsertUser(profile);
      res.json({ userId: user.googleId, email: user.email, name: user.name, picture: user.picture });
    } catch (err) {
      res.status(401).json({ error: 'unauthorized', detail: 'Could not verify Google sign-in.' });
    }
  });

  // ---- SIV runtime: conversation storage (auth required) ----
  app.post('/api/runtimes/siv/conversations', requireAuth, async (req, res) => {
    try {
      const { sessionId, messages, artefact, status } = req.body || {};
      const doc = await saveSivConversation({
        userId: req.user.googleId,
        email: req.user.email,
        sessionId,
        messages,
        artefact,
        status,
      });
      res.json({ ok: true, sessionId: doc.sessionId, savedMessages: doc.messages.length, expiresAt: doc.expiresAt });
    } catch (err) {
      res.status(400).json({ error: 'bad_request', detail: err.message });
    }
  });

  app.get('/api/runtimes/siv/conversations', requireAuth, async (req, res) => {
    const items = await listSivConversations(req.user.googleId);
    res.json({ conversations: items });
  });

  app.get('/api/runtimes/siv/conversations/:sessionId', requireAuth, async (req, res) => {
    const item = await getSivConversation(req.user.googleId, req.params.sessionId);
    if (!item) return res.status(404).json({ error: 'not_found' });
    res.json(item);
  });

  // ---- Static site (so frontend + backend run from one place) ----
  app.use((req, res, next) => {
    if (req.method === 'GET' && BLOCKED_PREFIXES.some((p) => req.path === p || req.path.startsWith(p + '/'))) {
      return res.status(404).send('Not found');
    }
    next();
  });
  app.use(express.static(SITE_ROOT, { extensions: ['html'] }));

  // JSON 404 for unmatched API routes; otherwise let static 404 stand.
  app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }));

  // Express error handler (e.g. malformed JSON body).
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    res.status(400).json({ error: 'request_error', detail: err.message });
  });

  return app;
}
