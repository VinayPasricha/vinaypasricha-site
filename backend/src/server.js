// Entry point: start the HTTP server. Firestore connects lazily on first use,
// so there is no database connection step here.
import { config } from './config.js';
import { createApp, rateLimit } from './app.js';
import { registerWorkspaceRoutes } from './abl/workspaceRoutes.js';
import { registerAuthRoutes } from './abl/authRoutes.js';
import { registerRuntimeRoutes } from './abl/runtimeRoutes.js';
import { participantApiGuard } from './abl/participantGuard.js';

const app = createApp();
const stack = app._router && app._router.stack;

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
}

// createApp installs the site's static handler and JSON API 404 before returning.
// Register the newer workspace, sign-in and runtime routes, then move only those
// newly-added Express layers immediately before the API 404.
const before = stack ? stack.length : 0;
registerWorkspaceRoutes(app);
registerAuthRoutes(app, { rateLimit });
registerRuntimeRoutes(app, { rateLimit });
if (stack) {
  const added = stack.splice(before);
  let insertAt = stack.findIndex((layer) => !layer.route && String(layer.regexp || '').includes('^\\/api\\/?(?=\\/|$)'));
  if (insertAt < 0) insertAt = Math.max(0, stack.length - 1);
  stack.splice(insertAt, 0, ...added);
}

app.listen(config.port, () => {
  console.log(`[server] listening on port ${config.port}`);
  console.log('[server] storage: Firestore (including AI Leadership Workspace collections)');
  console.log('[server] participant access: passwordless email verification required');
  console.log(`[server] conversations expire after ${config.conversationTtlDays} days (via Firestore TTL policy)`);
});
