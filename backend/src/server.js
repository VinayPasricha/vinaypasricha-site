// Entry point: start the HTTP server. Firestore connects lazily on first use,
// so there is no database connection step here.
import { config } from './config.js';
import { createApp } from './app.js';

const app = createApp();
app.listen(config.port, () => {
  console.log(`[server] listening on port ${config.port}`);
  console.log('[server] storage: Firestore (collections: conversations, leads)');
  console.log(`[server] conversations expire after ${config.conversationTtlDays} days (via Firestore TTL policy)`);
});
