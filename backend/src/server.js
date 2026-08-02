// Entry point: start the HTTP server. Firestore connects lazily on first use,
// so there is no database connection step here.
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { config } from './config.js';
import { createApp, rateLimit } from './app.js';
import { registerWorkspaceRoutes } from './abl/workspaceRoutes.js';
import { registerAuthRoutes } from './abl/authRoutes.js';
import { participantApiGuard } from './abl/participantGuard.js';
import { registerSecureParticipantPages } from './abl/securePageRoutes.js';
import { registerFocusedWorkspaceRoute } from './abl/focusedWorkspaceRoute.js';
import { registerAnalyticsIntelligenceRoutes } from './analyticsIntelligence.js';

const app = createApp();
const stack = app._router && app._router.stack;

function deploymentInfo() {
  try {
    const parsed = JSON.parse(readFileSync(new URL('../../assets/data/staging-release.json', import.meta.url), 'utf8'));
    return {
      release: String(parsed.release || ''),
      contains_all_changes_through: String(parsed.contains_all_changes_through || ''),
      service: String(process.env.K_SERVICE || 'local'),
      revision: String(process.env.K_REVISION || 'local'),
    };
  } catch (e) {
    return {
      release: 'unknown',
      contains_all_changes_through: '',
      service: String(process.env.K_SERVICE || 'local'),
      revision: String(process.env.K_REVISION || 'local'),
    };
  }
}
const DEPLOYMENT = deploymentInfo();
function markDeployment(res) {
  res.setHeader('X-ABL-Release', DEPLOYMENT.release);
  res.setHeader('X-ABL-Revision', DEPLOYMENT.revision);
}

function studioCookie(req) {
  const raw = String(req.headers.cookie || '');
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i < 0 || part.slice(0, i).trim() !== '__session') continue;
    try { return decodeURIComponent(part.slice(i + 1).trim()); }
    catch (e) { return ''; }
  }
  return '';
}

function explicitStudioHash() {
  const passphrase = String(process.env.STUDIO_PASSPHRASE || '').trim();
  if (!passphrase) return '';
  return crypto.createHash('sha256').update('studio:' + passphrase).digest('hex');
}

function requireStudioAdmin(req, res, next) {
  if (!process.env.K_SERVICE) return next();
  const expected = explicitStudioHash();
  const token = req.get('x-admin-token') || (req.query && req.query.token) || '';
  const tokenAllowed = !!process.env.ADMIN_TOKEN && token === process.env.ADMIN_TOKEN;
  if ((expected && studioCookie(req) === expected) || tokenAllowed) return next();
  if (!expected && !process.env.ADMIN_TOKEN) return res.status(503).json({ ok: false, error: 'studio_not_configured' });
  return res.status(401).json({ ok: false, error: 'unauthorized' });
}

// Launch hardening: the older central Studio gate contains a development fallback
// passphrase. On every Cloud Run deployment, refuse all Studio UI/login traffic
// unless STUDIO_PASSPHRASE has been explicitly configured. This middleware is
// moved to the front of the stack, so a guessed cookie cannot bypass it.
if (stack) {
  const hardeningStart = stack.length;
  app.use((req, res, next) => {
    const pathname = String(req.url || '').split('?')[0];
    const studioRequest = pathname === '/studio' || pathname.startsWith('/studio/') || pathname.startsWith('/api/studio/');
    if (process.env.K_SERVICE && studioRequest && !String(process.env.STUDIO_PASSPHRASE || '').trim()) {
      markDeployment(res);
      if (pathname.startsWith('/api/')) return res.status(503).json({ error: 'studio_not_configured' });
      return res.status(503).send('Vinay Studio is temporarily unavailable because its private access key is not configured.');
    }
    return next();
  });
  const hardeningLayers = stack.splice(hardeningStart);
  stack.splice(0, 0, ...hardeningLayers);

  // Handle anonymous Studio UI requests before the older gate. Using explicit
  // status and Location headers avoids the legacy redirect path that returned a
  // 500 on Cloud Run. Authenticated requests continue through to the existing
  // Studio routes using the same cookie hash.
  const studioGateStart = stack.length;
  app.use((req, res, next) => {
    const pathname = String(req.url || '').split('?')[0];
    const studioUi = pathname === '/studio' || pathname.startsWith('/studio/');
    if (!studioUi) return next();

    markDeployment(res);
    res.setHeader('Cache-Control', 'private, no-store');
    if (!process.env.K_SERVICE) return next();
    if (pathname === '/studio/login' || pathname === '/studio/login.html') return next();

    const expected = explicitStudioHash();
    if (!expected) {
      res.statusCode = 503;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.end('Vinay Studio is not configured.');
    }
    if (studioCookie(req) === expected) return next();

    if (req.method === 'GET' || req.method === 'HEAD') {
      res.statusCode = 302;
      res.setHeader('Location', '/studio/login');
      return res.end();
    }
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'unauthorized' }));
  });
  const studioGateLayers = stack.splice(studioGateStart);
  const expressInitAt = stack.findIndex((layer) => layer.name === 'expressInit');
  stack.splice(expressInitAt >= 0 ? expressInitAt + 1 : 1, 0, ...studioGateLayers);
}

// createApp already contains the original preparation and Initiative Builder
// endpoints. Insert one authentication guard immediately before the first of
// those participant routes. It also protects workspace and runtime routes added
// below, while explicitly ignoring Studio/admin and sign-in endpoints.
if (stack) {
  const guardStart = stack.length;
  app.use(participantApiGuard);
  const guardLayers = stack.splice(guardStart);
  let firstParticipantApi = stack.findIndex((layer) => {
    const routePath = layer.route && layer.route.path;
    return typeof routePath === 'string' && (
      routePath.startsWith('/api/abl/session/') ||
      routePath.startsWith('/api/abl/course/') ||
      routePath.startsWith('/api/abl/workspace/')
    );
  });
  if (firstParticipantApi < 0) firstParticipantApi = 0;
  stack.splice(firstParticipantApi, 0, ...guardLayers);

  // The original HTML shells predate passwordless sign-in. Serve equivalent
  // shells with auth-client.js and Workspace Home navigation inserted before
  // their existing JavaScript, and place them before the original routes.
  const pageStart = stack.length;
  registerSecureParticipantPages(app);
  const securePageLayers = stack.splice(pageStart);
  let firstParticipantPage = stack.findIndex((layer) => {
    const routePath = layer.route && layer.route.path;
    return routePath === '/ai-business-leaders/s/:slug' || routePath === '/ai-business-leaders/course/:slug';
  });
  // These shells are now the only ones serving those URLs, so there may be no
  // original route to sit in front of. Fall back to just before the static
  // handler — never to index 0, which is ahead of Express's own initialisation
  // middleware and would leave the routes unreachable.
  if (firstParticipantPage < 0) {
    firstParticipantPage = stack.findIndex((layer) => layer.name === 'serveStatic');
  }
  if (firstParticipantPage < 0) firstParticipantPage = Math.max(0, stack.length - 1);
  stack.splice(firstParticipantPage, 0, ...securePageLayers);
} else {
  registerSecureParticipantPages(app);
}

// createApp installs generic translation/static handlers and the JSON API 404
// before returning. Register the focused participant shell, data, sign-in,
// guided-conversation and Website Intelligence routes, then move them ahead of
// express.static. Otherwise extensionless paths and APIs may be intercepted by
// generic static/404 handlers.
const before = stack ? stack.length : 0;
app.get('/api/abl/deployment', (req, res) => {
  markDeployment(res);
  res.set('Cache-Control', 'private, no-store');
  res.json({ ok: true, data: DEPLOYMENT });
});
registerFocusedWorkspaceRoute(app);
registerWorkspaceRoutes(app);
registerAuthRoutes(app, { rateLimit });
registerAnalyticsIntelligenceRoutes(app, { requireAdmin: requireStudioAdmin });
if (stack) {
  const added = stack.splice(before);
  let insertAt = stack.findIndex((layer) => layer.name === 'serveStatic');
  if (insertAt < 0) {
    insertAt = stack.findIndex((layer) => !layer.route && String(layer.regexp || '').includes('^\\/api\\/?(?=\\/|$)'));
  }
  if (insertAt < 0) insertAt = Math.max(0, stack.length - 1);
  stack.splice(insertAt, 0, ...added);
}

app.listen(config.port, () => {
  console.log(`[server] listening on port ${config.port}`);
  console.log(`[server] release: ${DEPLOYMENT.release} · revision: ${DEPLOYMENT.revision}`);
  console.log('[server] storage: Firestore (including AI Leadership Workspace collections)');
  console.log('[server] participant access: passwordless email verification required');
  console.log('[server] Studio access: explicit STUDIO_PASSPHRASE required on Cloud Run');
  console.log('[server] Website Intelligence: protected production analytics and drill-down enabled');
  console.log(`[server] conversations expire after ${config.conversationTtlDays} days (via Firestore TTL policy)`);
});
