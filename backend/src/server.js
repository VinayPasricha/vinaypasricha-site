// Entry point: start the HTTP server. Firestore connects lazily on first use,
// so there is no database connection step here.
import { config } from './config.js';
import { createApp } from './app.js';
import { registerWorkspaceRoutes } from './abl/workspaceRoutes.js';

const app = createApp();

// createApp installs the site's static handler and JSON API 404 before returning.
// Register the workspace routes, then move only those newly-added Express layers
// immediately before the API 404. This keeps the workspace module independent
// from the established application while preserving normal static serving.
const stack = app._router && app._router.stack;
const before = stack ? stack.length : 0;
registerWorkspaceRoutes(app);
if (stack) {
  const added = stack.splice(before);
  let insertAt = stack.findIndex((layer) => !layer.route && String(layer.regexp || '').includes('^\\/api\\/?(?=\\/|$)'));
  if (insertAt < 0) insertAt = Math.max(0, stack.length - 1);
  stack.splice(insertAt, 0, ...added);
}

app.listen(config.port, () => {
  console.log(`[server] listening on port ${config.port}`);
  console.log('[server] storage: Firestore (including AI Leadership Workspace collections)');
  console.log(`[server] conversations expire after ${config.conversationTtlDays} days (via Firestore TTL policy)`);
});
