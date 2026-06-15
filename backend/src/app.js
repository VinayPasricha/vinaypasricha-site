// The Express application: API routes + serving the static site.
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import {
  saveConversation,
  getConversation,
  listConversations,
  appendExchange,
  saveLead,
} from './services/store.js';
import { complete as aiComplete } from './services/ai.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Repo root is two levels up from backend/src -> serves index.html, paths/, etc.
const SITE_ROOT = path.resolve(__dirname, '..', '..');

// Folders that live in the repo but must never be served publicly.
const BLOCKED_PREFIXES = ['/uploads', '/_brief', '/_prompts', '/scraps', '/_audit', '/_explorations', '/backend', '/server', '/.git'];

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.use(
    cors({
      origin(origin, cb) {
        // Allow same-origin / tools with no Origin header. If an allow-list is
        // configured, enforce it; otherwise allow all (the API is anonymous).
        if (!origin) return cb(null, true);
        if (!config.allowedOrigins.length || config.allowedOrigins.includes(origin)) {
          return cb(null, true);
        }
        cb(new Error('Origin not allowed by CORS'));
      },
    })
  );

  // ---- Health ----
  app.get('/api/health', (req, res) => res.json({ ok: true }));

  // ---- Conversations (anonymous) ----
  // Any runtime saves here: POST /api/runtimes/:runtime/conversations
  // The client generates a sessionId; lead details come from the chat itself.
  app.post('/api/runtimes/:runtime/conversations', async (req, res) => {
    try {
      const { sessionId, messages, artefact, status, email, name, organizationName, ai } = req.body || {};
      const doc = await saveConversation({
        runtime: req.params.runtime,
        sessionId, messages, artefact, status, email, name, organizationName, ai,
      });
      res.json({
        ok: true,
        sessionId: doc.sessionId,
        savedMessages: Array.isArray(doc.messages) ? doc.messages.length : 0,
        expiresAt: doc.expiresAt,
      });
    } catch (err) {
      res.status(400).json({ error: 'bad_request', detail: err.message });
    }
  });

  // Read one conversation back by its session id.
  app.get('/api/runtimes/:runtime/conversations/:sessionId', async (req, res) => {
    try {
      const item = await getConversation(req.params.sessionId);
      if (!item) return res.status(404).json({ error: 'not_found' });
      res.json(item);
    } catch (err) {
      res.status(500).json({ error: 'server_error', detail: err.message });
    }
  });

  // List recent conversations (simple admin/debug view), optional ?runtime=of
  app.get('/api/runtimes/:runtime/conversations', async (req, res) => {
    try {
      const items = await listConversations({ runtime: req.params.runtime, limit: 100 });
      res.json({ conversations: items });
    } catch (err) {
      res.status(500).json({ error: 'server_error', detail: err.message });
    }
  });

  // ---- AI bridge (Gemini via Vertex AI) ----
  // The whole site calls window.claude.complete({system, messages}); the
  // browser bridge forwards here. Returns { completion: "<text>" }.
  app.post('/api/ai/complete', async (req, res) => {
    try {
      const { system, messages } = req.body || {};
      const completion = await aiComplete({ system, messages });
      res.json({ completion });
    } catch (err) {
      res.status(500).json({ error: 'ai_error', detail: err.message });
    }
  });

  // ---- Universal capture: every AI exchange, from any page ----
  // The browser bridge calls this after each LLM reply so all chats site-wide
  // are logged to Firestore automatically. Anonymous, best-effort.
  app.post('/api/capture', async (req, res) => {
    try {
      const { sessionId, runtime, page, userText, completion, ai, name, email, phone } = req.body || {};
      const r = await appendExchange({ sessionId, runtime, page, userText, completion, ai, name, email, phone });
      res.json(r);
    } catch (err) {
      res.status(400).json({ error: 'bad_request', detail: err.message });
    }
  });

  // ---- Leads (captured emails / contacts) ----
  app.post('/api/leads', async (req, res) => {
    try {
      const { email, name, phone, organizationName, source, sessionId } = req.body || {};
      const lead = await saveLead({ email, name, phone, organizationName, source, sessionId });
      res.json({ ok: true, id: lead.id });
    } catch (err) {
      res.status(400).json({ error: 'bad_request', detail: err.message });
    }
  });

  // ---- Static site (frontend + backend served from one place) ----
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
