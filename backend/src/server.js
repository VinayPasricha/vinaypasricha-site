// Entry point: connect to MongoDB, then start the HTTP server.
import { config, assertProductionConfig } from './config.js';
import { connectDb } from './db.js';
import { createApp } from './app.js';

async function main() {
  assertProductionConfig(); // fail loudly if MONGODB_URI / GOOGLE_CLIENT_ID missing
  await connectDb();
  console.log('[server] connected to MongoDB');

  const app = createApp();
  app.listen(config.port, () => {
    console.log(`[server] listening on http://localhost:${config.port}`);
    console.log(`[server] SIV runtime storage ready · conversations expire after ${config.conversationTtlDays} days`);
  });
}

main().catch((err) => {
  console.error('[server] failed to start:', err.message);
  process.exit(1);
});
