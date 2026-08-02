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
import { askBook } from './services/bookAgent.js';
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
import { recordEvent, analyticsSummary, listPeople, personTimeline, pageStats, listChannels, channelStats, createChannel, deleteChannel, resolveChannelClick } from './services/analytics.js';
import { alertPriorityLead } from './services/leadAlerts.js';
import { db, COLLECTIONS } from './firestore.js';
import crypto from 'node:crypto';
import { registerNotebook } from './notebook.js';

// First-party analytics: a tiny tracker script is injected into every served
// HTML page (see the injection points below), so the Studio Analytics dashboard
// can "track everything" without editing all 100+ pages by hand.
const TRACKER_TAG = '<script defer src="/js/track.js"></script>';
function injectTracker(html) {
  if (typeof html !== 'string' || html.indexOf('/js/track.js') !== -1) return html;
  if (html.includes('</head>')) return html.replace('</head>', '  ' + TRACKER_TAG + '\n</head>');
  if (html.includes('</body>')) return html.replace('</body>', TRACKER_TAG + '</body>');
  return html;
}

// CSS/JS are cached for a day but aren't fingerprinted, so stamp every local
// stylesheet/script URL with the deploy revision. Each deploy then gets fresh
// URLs and cached copies from earlier revisions are never served stale.
// K_REVISION is set by Cloud Run; boot time covers local runs.
const ASSET_VERSION = encodeURIComponent(process.env.K_REVISION || String(Date.now()));
function stampAssetVersions(html) {
  if (typeof html !== 'string') return html;
  return html.replace(
    /((?:href|src)=")([^"]+\.(?:css|js|mjs))(")/g,
    (m, pre, url, post) => {
      if (/^(?:https?:)?\/\//i.test(url) || url.includes('?')) return m; // external or already versioned
      return pre + url + '?v=' + ASSET_VERSION + post;
    },
  );
}

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
  // Transcript uploads are admin-only and capped again at 6 MB by the ABL
  // parser. The larger envelope allows PDF/DOCX bytes to travel as base64.
  app.use(express.json({ limit: '10mb' }));

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
  // Staging services must remain reachable on their own run.app hostname so
  // reviewers can inspect branch deployments without being sent to production.
  // Cloud Run exposes the service name through K_SERVICE.
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

  // Direct Notebook publishing: public reading plus Studio-gated editing.
  registerNotebook(app, { requireAdmin, rateLimit });

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

  // Public, manuscript-grounded reading companion. The manuscript index stays
  // in private Cloud Storage; only the final answer and page references leave
  // the server.
  app.post('/api/books/ai-for-business-leaders/ask', rateLimit({ windowMs: 60000, max: 12 }), async (req, res) => {
    try {
      const result = await askBook(req.body || {});
      res.json(result);
    } catch (err) {
      console.error('[book-agent] request failed:', err);
      const limited = err.code === 'BOOK_LIMIT';
      const status = limited ? 429 : (/required|valid conversation/i.test(err.message) ? 400 : 503);
      res.status(status).json({
        error: limited ? 'book_limit_reached' : 'book_agent_error',
        detail: limited ? 'You have reached the free conversation limit. Continue with the complete book.' : (status === 400 ? err.message : 'The reading companion is temporarily unavailable.'),
        limitReached: limited,
        purchaseUrl: limited ? 'https://www.amazon.in/dp/B0GFXXPGP7' : undefined,
      });
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

  // High-intent lead form (js/lead-form.js): stores the full submission and
  // alerts Vinay immediately by email + Slack. The `hp` field is a honeypot —
  // bots that fill it get a fake success and nothing is stored or sent.
  app.post('/api/leads/priority', rateLimit({ windowMs: 60000, max: 5 }), async (req, res) => {
    try {
      const b = req.body || {};
      if (String(b.hp || '').trim()) return res.json({ ok: true });
      const lead = {
        form: String(b.form || 'general').slice(0, 60),
        name: String(b.name || '').trim().slice(0, 120),
        email: String(b.email || '').trim().toLowerCase().slice(0, 160),
        company: String(b.company || '').trim().slice(0, 160),
        role: String(b.role || '').trim().slice(0, 120),
        message: String(b.message || '').trim().slice(0, 2000),
        path: String(b.path || '').slice(0, 200),
        context: String(b.context || '').slice(0, 120),
        createdAt: new Date(),
      };
      if (!lead.name || !lead.message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) {
        return res.status(400).json({ error: 'invalid', detail: 'Name, a valid email, and a message are required.' });
      }
      const doc = await db.collection(COLLECTIONS.priorityLeads).add(lead);
      // Also file them in the unified leads directory (keyed by email).
      await saveLead({
        email: lead.email,
        name: lead.name,
        organizationName: lead.company,
        source: `priority:${lead.form}${lead.context ? ':' + lead.context : ''}`,
      }).catch(() => {});
      const notified = await alertPriorityLead(lead);
      res.json({ ok: true, id: doc.id, notified: { email: notified.email.sent, slack: notified.slack.sent } });
    } catch (err) {
      res.status(500).json({ error: 'server_error', detail: err.message });
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

  // ---- First-party website analytics ----
  // Anonymous, best-effort event ingest from js/track.js (page views, duration
  // beacons, custom events). recordEvent never throws, so we await it (Cloud Run
  // throttles CPU after the response, so post-response work isn't reliable) and
  // then answer 204. Rate-limited generously per IP.
  app.post('/api/track', rateLimit({ windowMs: 60000, max: 300 }), async (req, res) => {
    const ip = String(req.get('x-forwarded-for') || req.ip || '').split(',')[0].trim();
    const ua = req.get('user-agent') || '';
    // The client batches events into { events: [...] }; single bare events
    // still arrive from cached copies of the old track.js.
    const body = req.body || {};
    const events = Array.isArray(body.events) ? body.events.slice(0, 50) : [body];
    for (const event of events) await recordEvent(event || {}, { ip, ua });
    res.status(204).end();
  });

  // The Studio Analytics dashboard reads its aggregated numbers here (admin only).
  app.get('/api/analytics/summary', requireAdmin, async (req, res) => {
    try {
      res.json({ ok: true, ...(await analyticsSummary({ days: req.query.days })) });
    } catch (err) {
      res.status(500).json({ ok: false, error: 'server_error', detail: err.message });
    }
  });

  // Person-level: the directory of known people, and one person's full timeline.
  app.get('/api/analytics/people', requireAdmin, async (req, res) => {
    try {
      res.json({ ok: true, people: await listPeople({ limit: req.query.limit }) });
    } catch (err) {
      res.status(500).json({ ok: false, error: 'server_error', detail: err.message });
    }
  });
  app.get('/api/analytics/person/:pid', requireAdmin, async (req, res) => {
    try {
      const t = await personTimeline(req.params.pid, { limit: req.query.limit });
      if (!t) return res.status(404).json({ ok: false, error: 'not_found' });
      res.json({ ok: true, ...t });
    } catch (err) {
      res.status(500).json({ ok: false, error: 'server_error', detail: err.message });
    }
  });
  // Per-page drill-down (admin): ?path=/books&days=30
  app.get('/api/analytics/page', requireAdmin, async (req, res) => {
    try {
      if (!req.query.path) return res.status(400).json({ ok: false, error: 'path_required' });
      res.json({ ok: true, ...(await pageStats(req.query.path, { days: req.query.days })) });
    } catch (err) {
      res.status(500).json({ ok: false, error: 'server_error', detail: err.message });
    }
  });

  // Traffic channels — branded short links (/go/<slug>) for the social team.
  // Admin CRUD; the redirect itself is public (below, before the HTML handlers).
  app.get('/api/analytics/channels', requireAdmin, async (req, res) => {
    try {
      // With ?days, return each channel's clicks split against visitors /
      // sessions / signups for that window; without it, just the list.
      const channels = req.query.days ? await channelStats({ days: req.query.days }) : await listChannels();
      res.json({ ok: true, channels });
    } catch (err) {
      res.status(500).json({ ok: false, error: 'server_error', detail: err.message });
    }
  });
  app.post('/api/analytics/channels', requireAdmin, async (req, res) => {
    try {
      res.json({ ok: true, channel: await createChannel(req.body || {}) });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });
  app.delete('/api/analytics/channels/:slug', requireAdmin, async (req, res) => {
    try {
      await deleteChannel(req.params.slug);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: 'server_error', detail: err.message });
    }
  });

  // Public branded short link: /go/<slug> counts the click and redirects to the
  // channel's destination, tagged so the tracker attributes the visit. Unknown
  // slugs fall through to the home page. Registered before the HTML handlers so
  // the tracker-injection catch-all never sees it.
  app.get('/go/:slug', async (req, res) => {
    try {
      const target = await resolveChannelClick(req.params.slug);
      return res.redirect(302, target || '/');
    } catch (e) {
      return res.redirect(302, '/');
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
      const html = injectTracker(renderCompanyPage(companyTemplate, { name: prof.name, domain: prof.domain, slug: prof.slug }, prof.store));
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
      return res.send(injectTracker(out));
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
  // Inject the analytics tracker into plain (untranslated) HTML pages before
  // express.static would stream them verbatim. Real assets (.css/.js/.png, and
  // js/track.js itself) fall through untouched. Cached per file+mtime; any
  // failure falls back to static so a page never breaks over analytics.
  const trackedHtmlCache = new Map(); // abs+mtime -> injected html
  app.get(/.*/, (req, res, next) => {
    if (req.method !== 'GET') return next();
    let rel = decodeURIComponent(req.path);
    if (rel.endsWith('/')) rel += 'index.html';
    else if (!path.extname(rel)) rel += '.html';
    else if (!rel.endsWith('.html')) return next(); // a real asset — leave to static
    if (blockedPrefixes().some((p) => rel === p || rel.startsWith(p + '/'))) return next();
    const abs = path.join(SITE_ROOT, rel);
    if (!abs.startsWith(SITE_ROOT) || !existsSync(abs)) return next();
    try {
      const key = abs + '\0' + statSync(abs).mtimeMs;
      let out = trackedHtmlCache.get(key);
      if (out === undefined) {
        out = stampAssetVersions(injectTracker(readFileSync(abs, 'utf8')));
        trackedHtmlCache.set(key, out);
        if (trackedHtmlCache.size > 2000) trackedHtmlCache.clear();
      }
      res.set('Content-Type', 'text/html; charset=utf-8');
      res.set('Cache-Control', 'no-cache'); // always revalidate HTML so deploys show immediately
      return res.send(out);
    } catch (e) {
      return next(); // safe fallback to static
    }
  });
  // Assets aren't fingerprinted, so rely on revalidation windows rather than
  // immutable: a day for css/js, a week for images/fonts (they change rarely).
  const LONG_CACHE = /\.(png|jpe?g|webp|avif|gif|svg|ico|woff2?)$/i;
  const DAY_CACHE = /\.(css|js|mjs|json)$/i;
  app.use(express.static(SITE_ROOT, {
    extensions: ['html'],
    setHeaders(res, filePath) {
      if (LONG_CACHE.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
      } else if (DAY_CACHE.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
      } else if (/\.html$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  }));

  // JSON 404 for unmatched API routes; otherwise let static 404 stand.
  app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }));

  // Express error handler (e.g. malformed JSON body).
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    res.status(400).json({ error: 'request_error', detail: err.message });
  });

  return app;
}
