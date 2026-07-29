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
  listLeads,
} from './services/store.js';
import { complete as aiComplete } from './services/ai.js';
import {
  runResearch,
  buildStore,
  saveCompanyProfile,
  getCompanyProfile,
  listCompanyProfiles,
  renderCompanyPage,
  slugify,
  profileAccuracy,
  STAGE_LABELS,
} from './services/companyProfiles.js';
import { existsSync, statSync, readFileSync } from 'node:fs';
import { translateHtml, SUPPORTED as I18N_LANGS } from './services/i18nServer.js';
import { registerAbl } from './abl/routes.js';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Repo root is two levels up from backend/src -> serves index.html, paths/, etc.
const SITE_ROOT = path.resolve(__dirname, '..', '..');

// Folders that live in the repo but must never be served publicly.
const BLOCKED_PREFIXES = ['/uploads', '/_brief', '/_prompts', '/scraps', '/_audit', '/_explorations', '/backend', '/server', '/.git'];

// /studio is the operator backend (all pages are noindex admin tooling). It is
// served on a local dev machine but BLOCKED on the public deployment. Cloud Run
// always sets K_SERVICE, so we use that to detect "running in production".
const IS_PUBLIC_DEPLOY = !!process.env.K_SERVICE;
// /studio is no longer hard-blocked in prod — it is access-gated behind an admin
// login (see the studio gate below). Locally it stays fully open.
const blockedPrefixes = () => BLOCKED_PREFIXES;

// ---- Studio admin access ----
// In production /studio opens only after the admin posts the ADMIN_TOKEN once and
// receives an httpOnly cookie. The cookie stores a hash of the token, never the
// token itself. Locally (no K_SERVICE) studio is open with no login.
// NOTE: the cookie MUST be named "__session" — Firebase Hosting strips every
// other cookie when proxying to Cloud Run, so any other name never arrives.
const STUDIO_COOKIE = '__session';
// The Studio login passphrase. Memorable by design (override with STUDIO_PASSPHRASE
// env). The long ADMIN_TOKEN also works as a master key.
const STUDIO_PASSPHRASE = process.env.STUDIO_PASSPHRASE || 'vik123';
function studioHash() {
  return crypto.createHash('sha256').update('studio:' + STUDIO_PASSPHRASE).digest('hex');
}
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}
function studioAuthed(req) {
  const expected = studioHash();
  return !!expected && parseCookies(req)[STUDIO_COOKIE] === expected;
}

// Require the admin token (header `x-admin-token` or `?token=`) for endpoints
// that expose stored visitor data. Fail-closed: if ADMIN_TOKEN is not set, the
// endpoint is unavailable rather than open.
function requireAdmin(req, res, next) {
  // An authenticated Studio session (the gate cookie) counts as admin.
  if (studioAuthed(req)) return next();
  const expected = config.adminToken;
  if (!expected) return res.status(503).json({ error: 'admin_disabled', detail: 'Admin API is not configured.' });
  const got = req.get('x-admin-token') || (req.query && req.query.token) || '';
  if (got !== expected) return res.status(401).json({ error: 'unauthorized' });
  next();
}

// Tiny in-memory per-IP rate limiter (per Cloud Run instance). Caps abuse/cost
// on the open AI endpoint without any external store. Best-effort, not exact.
export function rateLimit({ windowMs, max }) {
  const hits = new Map(); // ip -> number[] (timestamps)
  return (req, res, next) => {
    // Admin token (e.g. the translation pipeline) bypasses the limit.
    if (config.adminToken && req.get('x-admin-token') === config.adminToken) return next();
    const ip = String(req.get('x-forwarded-for') || req.ip || 'unknown').split(',')[0].trim();
    const now = Date.now();
    const recent = (hits.get(ip) || []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
      return res.status(429).json({ error: 'rate_limited', detail: 'Too many requests — please slow down.' });
    }
    recent.push(now);
    hits.set(ip, recent);
    if (hits.size > 5000) { // opportunistic cleanup
      for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
    }
    next();
  };
}

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

  // ---- Canonical host: send non-canonical hosts to vinaypasricha.com ----
  // Firebase proxies the custom domain to Cloud Run with Host=<run.app> but
  // X-Forwarded-Host=<the real domain>, so we key off the forwarded host. This
  // 301s the bare *.run.app / *.web.app / www.* URLs to the apex domain (one
  // canonical host for SEO) and never loops real custom-domain traffic
  // (whose forwarded host is already vinaypasricha.com).
  const CANONICAL_HOST = 'vinaypasricha.com';
  const ALT_HOST = /(\.run\.app|\.web\.app|\.firebaseapp\.com)$/;
  // Keep branch-deployed staging services reachable on their own hostname so
  // reviewers are not redirected to production. Cloud Run exposes the service
  // name through K_SERVICE.
  const IS_STAGING_SERVICE = /(^|-)staging($|-)/i.test(process.env.K_SERVICE || '');
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const eff = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(':')[0].toLowerCase();
    if (!IS_STAGING_SERVICE && eff && eff !== CANONICAL_HOST && (ALT_HOST.test(eff) || eff === 'www.' + CANONICAL_HOST)) {
      return res.redirect(301, 'https://' + CANONICAL_HOST + req.originalUrl);
    }
    next();
  });

  // ---- Studio admin gate (production only) ----
  // Everything under /studio requires the admin cookie in prod; unauthenticated
  // visitors are sent to the login page. The login page itself stays reachable.
  app.use((req, res, next) => {
    const p = req.path;
    if (p !== '/studio' && !p.startsWith('/studio/')) return next();
    // Never let a CDN cache admin pages — the gate must run on every request.
    res.setHeader('Cache-Control', 'private, no-store');
    if (!IS_PUBLIC_DEPLOY) return next(); // local dev: open
    if (p === '/studio/login' || p === '/studio/login.html') return next();
    if (studioAuthed(req)) return next();
    if (req.method === 'GET' || req.method === 'HEAD') return res.redirect(302, '/studio/login');
    return res.status(401).json({ error: 'unauthorized' });
  });

  // Studio login — POST the admin token, receive the gate cookie.
  // Rate-limited to blunt brute-force guessing of the passphrase.
  app.post('/api/studio/login', rateLimit({ windowMs: 60000, max: 10 }), (req, res) => {
    const pw = String((req.body && req.body.password) || '');
    // The passphrase, or the long ADMIN_TOKEN as a master key.
    if (pw !== STUDIO_PASSPHRASE && !(config.adminToken && pw === config.adminToken)) {
      return res.status(401).json({ error: 'invalid' });
    }
    const secure = IS_PUBLIC_DEPLOY ? '; Secure' : '';
    res.setHeader('Set-Cookie', STUDIO_COOKIE + '=' + studioHash() + '; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800' + secure);
    res.json({ ok: true });
  });
  app.post('/api/studio/logout', (req, res) => {
    res.setHeader('Set-Cookie', STUDIO_COOKIE + '=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
    res.json({ ok: true });
  });
  app.get('/api/studio/status', (req, res) => res.json({ authed: studioAuthed(req), enabled: !!config.adminToken }));

  // ---- Health ----
  app.get('/api/health', (req, res) => res.json({ ok: true }));

  // ---- AI for Business Leaders (course-prep agent) ----
  // Participant + admin endpoints and the participant/doc pages. Admin routes
  // reuse the studio gate via requireAdmin; rateLimit/studioAuthed are shared so
  // ABL can throttle its expensive AI routes and gate the private brief.
  registerAbl(app, { requireAdmin, rateLimit, studioAuthed });

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

  // Read one conversation back by its session id. (Admin — contains PII.)
  app.get('/api/runtimes/:runtime/conversations/:sessionId', requireAdmin, async (req, res) => {
    try {
      const item = await getConversation(req.params.sessionId);
      if (!item) return res.status(404).json({ error: 'not_found' });
      res.json(item);
    } catch (err) {
      res.status(500).json({ error: 'server_error', detail: err.message });
    }
  });

  // List recent conversations (admin view — exposes every visitor's PII).
  app.get('/api/runtimes/:runtime/conversations', requireAdmin, async (req, res) => {
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
  app.post('/api/ai/complete', rateLimit({ windowMs: 60000, max: 60 }), async (req, res) => {
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

  // List captured leads (admin / Studio).
  app.get('/api/leads', requireAdmin, async (req, res) => {
    try {
      res.json({ leads: await listLeads({ limit: 300 }) });
    } catch (err) {
      res.status(500).json({ error: 'server_error', detail: err.message });
    }
  });

  // List every conversation across all runtimes (admin / Studio).
  app.get('/api/conversations', requireAdmin, async (req, res) => {
    try {
      res.json({ conversations: await listConversations({ limit: 200 }) });
    } catch (err) {
      res.status(500).json({ error: 'server_error', detail: err.message });
    }
  });

  // ---- Company Frequency profiles: live research → shareable page ----
  // POST { name, url } → runs LIVE grounded research, builds the 12-dimension
  // profile, persists it, and returns its shareable URL. Research is expensive
  // (live web search + generation), so the limit is tight.
  app.post('/api/company-profiles', rateLimit({ windowMs: 60000, max: 6 }), async (req, res) => {
    try {
      const name = String((req.body && req.body.name) || '').trim();
      const url = String((req.body && req.body.url) || '').trim();
      const context = String((req.body && req.body.context) || '').slice(0, 4000);
      const stage = Math.min(4, Math.max(2, parseInt((req.body && req.body.stage) || 2, 10) || 2));
      const sessionId = (req.body && req.body.sessionId) || '';
      if (!name) return res.status(400).json({ error: 'bad_request', detail: 'name is required' });
      const slug = slugify(name);
      if (!slug) return res.status(400).json({ error: 'bad_request', detail: 'name produces an empty slug' });

      const prof = await runResearch(name, url, context);
      // Refuse to publish a failed or empty research — no misleading blank pages.
      const realDims = prof.dimensions ? Object.values(prof.dimensions).filter((d) => d && d.level).length : 0;
      if (prof._error || realDims < 4) {
        return res.json({
          ok: false,
          error: 'research_incomplete',
          detail: 'Could not assemble a profile for "' + name + '" right now — it may be too broad or ambiguous. Try the exact company name and its website, or run it again.',
        });
      }
      const store = buildStore(name, url, prof, stage);
      await saveCompanyProfile({
        slug, name, domain: prof.domain || '', url, store, stage, sessionId,
        research: { essence: prof.essence || '', queries: prof._searchQueries || [], sources: prof.sources || [], error: prof._error || null },
      });
      res.json({
        ok: true, slug, url: '/frequency/company/' + slug, grounded: !prof._error,
        stage, stageLabel: STAGE_LABELS[stage] || '',
        accuracy: profileAccuracy(store, stage), essence: prof.essence || '',
      });
    } catch (err) {
      res.status(500).json({ error: 'server_error', detail: err.message });
    }
  });

  // List published profiles (admin — operator view).
  app.get('/api/company-profiles', requireAdmin, async (req, res) => {
    try {
      res.json({ profiles: await listCompanyProfiles() });
    } catch (err) {
      res.status(500).json({ error: 'server_error', detail: err.message });
    }
  });

  // Serve a generated profile page from Firestore at /frequency/company/<slug>.
  // Falls through to the static handler (404) when the slug isn't found.
  let companyTemplate = null;
  app.get('/frequency/company/:slug', async (req, res, next) => {
    try {
      const prof = await getCompanyProfile(req.params.slug);
      if (!prof || !prof.store) return next();
      if (companyTemplate == null) {
        companyTemplate = readFileSync(path.join(SITE_ROOT, 'frequency', 'company.html'), 'utf8');
      }
      const html = renderCompanyPage(companyTemplate, { name: prof.name, domain: prof.domain, slug: prof.slug }, prof.store);
      res.set('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    } catch (err) {
      return next();
    }
  });

  // ---- Clean URLs: redirect *.html to extensionless paths ----
  // The address bar should never show "index.html" or a page's filename. The
  // static server already serves extensionless paths (extensions: ['html']);
  // this 301-redirects any .html request to its clean form so links, bookmarks,
  // and typed URLs all land on the clean version.
  //   /index.html          -> /
  //   /paths/decisions.html -> /paths/decisions
  //   /runtime/index.html   -> /runtime/
  app.get(/\.html$/, (req, res, next) => {
    const p = req.path;
    const qs = req.originalUrl.slice(req.path.length); // preserve ?query (e.g. ?lang=hi)
    const clean = p.endsWith('/index.html')
      ? p.slice(0, -'index.html'.length) // '/' or '/dir/'
      : p.slice(0, -'.html'.length);     // '/dir/page'
    if (clean && clean !== p) return res.redirect(301, clean + qs);
    next();
  });

  // Also fold extensionless directory-index paths to the directory:
  //   /signal/index -> /signal/   ,   /index -> /
  app.get(/\/index$/, (req, res) => {
    const qs = req.originalUrl.slice(req.path.length);
    return res.redirect(301, req.path.slice(0, -'index'.length) + qs);
  });

  // ---- Server-side i18n: render translated HTML for ?lang=XX (SEO) ----
  // So crawlers (and users) get real translated content at the hreflang URLs,
  // not English that only translates client-side. Cached per (file,lang,mtime);
  // any failure falls through to the original English page — never breaks.
  const i18nHtmlCache = new Map(); // key -> html
  app.get(/.*/, (req, res, next) => {
    const lang = String((req.query && req.query.lang) || '').toLowerCase();
    if (!I18N_LANGS.includes(lang)) return next();
    let rel = decodeURIComponent(req.path);
    if (rel.endsWith('/')) rel += 'index.html';
    else if (!path.extname(rel)) rel += '.html';
    else return next(); // a real asset (.css/.js/.png/…) — leave to static
    if (blockedPrefixes().some((p) => rel === p || rel.startsWith(p + '/'))) return next();
    const abs = path.join(SITE_ROOT, rel);
    if (!abs.startsWith(SITE_ROOT) || !existsSync(abs)) return next();
    try {
      const key = lang + '\0' + abs + '\0' + statSync(abs).mtimeMs;
      let out = i18nHtmlCache.get(key);
      if (out === undefined) {
        out = translateHtml(readFileSync(abs, 'utf8'), lang, SITE_ROOT) || null;
        i18nHtmlCache.set(key, out);
        if (i18nHtmlCache.size > 2000) i18nHtmlCache.clear();
      }
      if (!out) return next(); // nothing translated → serve English
      res.set('Content-Type', 'text/html; charset=utf-8');
      res.set('Content-Language', lang);
      return res.send(out);
    } catch (e) {
      return next(); // safe fallback
    }
  });

  // ---- Static site (frontend + backend served from one place) ----
  app.use((req, res, next) => {
    if (req.method === 'GET' && blockedPrefixes().some((p) => req.path === p || req.path.startsWith(p + '/'))) {
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
