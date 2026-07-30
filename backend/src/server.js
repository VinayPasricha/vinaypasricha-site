// Entry point: start the HTTP server. Firestore connects lazily on first use,
// so there is no database connection step here.
import { config } from './config.js';
import { createApp, rateLimit } from './app.js';
import { registerWorkspaceRoutes } from './abl/workspaceRoutes.js';
import { registerAuthRoutes } from './abl/authRoutes.js';
import { registerRuntimeRoutes } from './abl/runtimeRoutes.js';
import { participantApiGuard } from './abl/participantGuard.js';
import { registerSecureParticipantPages } from './abl/securePageRoutes.js';
import { registerFocusedWorkspaceRoute } from './abl/focusedWorkspaceRoute.js';

const app = createApp();
const stack = app._router && app._router.stack;

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
      if (pathname.startsWith('/api/')) return res.status(503).json({ error: 'studio_not_configured' });
      return res.status(503).send('Vinay Studio is temporarily unavailable because its private access key is not configured.');
    }
    return next();
  });
  const hardeningLayers = stack.splice(hardeningStart);
  stack.splice(0, 0, ...hardeningLayers);
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
  if (firstParticipantPage < 0) firstParticipantPage = 0;
  stack.splice(firstParticipantPage, 0, ...securePageLayers);
} else {
  registerSecureParticipantPages(app);
}

// createApp installs generic translation/static handlers and the JSON API 404
// before returning. Register the focused participant shell, data, sign-in and
// guided-conversation routes, then move them ahead of express.static. Otherwise
// extensionless paths such as /ai-business-leaders/login are served as public
// static files before their private no-store route can run.
const before = stack ? stack.length : 0;
registerFocusedWorkspaceRoute(app);
registerWorkspaceRoutes(app);
registerAuthRoutes(app, { rateLimit });
registerRuntimeRoutes(app, { rateLimit });
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
  console.log('[server] storage: Firestore (including AI Leadership Workspace collections)');
  console.log('[server] participant access: passwordless email verification required');
  console.log('[server] Studio access: explicit STUDIO_PASSPHRASE required on Cloud Run');
  console.log(`[server] conversations expire after ${config.conversationTtlDays} days (via Firestore TTL policy)`);
});
