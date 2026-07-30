import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const port = 18089;
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['backend/src/server.js'], {
  env: {
    ...process.env,
    PORT: String(port),
    K_SERVICE: 'vinay-site-staging',
    STUDIO_PASSPHRASE: 'launch-audit-private-key',
    ADMIN_TOKEN: 'launch-audit-admin-token',
    ABL_AUTH_SECRET: 'launch-audit-participant-secret',
    FIRESTORE_COLLECTION_PREFIX: 'launch_audit_',
    GOOGLE_CLOUD_PROJECT: 'launch-audit-project',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
child.stdout.on('data', (chunk) => { output += chunk.toString(); });
child.stderr.on('data', (chunk) => { output += chunk.toString(); });

function stop() {
  if (!child.killed) child.kill('SIGTERM');
}

async function waitForServer() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (child.exitCode != null) throw new Error(`Server exited with ${child.exitCode}:\n${output}`);
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) return;
    } catch (e) {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Server did not become healthy:\n${output}`);
}

try {
  await waitForServer();

  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 200, 'local container-equivalent health endpoint must work');

  const studio = await fetch(`${base}/studio/ai-leadership-workspace`, { redirect: 'manual' });
  assert.equal(studio.status, 302, `anonymous Studio request must redirect, received ${studio.status}`);
  assert.equal(studio.headers.get('location'), '/studio/login', 'Studio redirect must point to private login');
  assert.match(String(studio.headers.get('cache-control') || ''), /no-store/i, 'Studio redirect must not be cached');

  const status = await fetch(`${base}/api/studio/status`);
  assert.equal(status.status, 200, 'Studio status endpoint must work');
  const statusBody = await status.json();
  assert.equal(statusBody.authed, false, 'anonymous request must not be Studio authenticated');
  assert.equal(statusBody.enabled, true, 'configured Studio must report enabled');

  console.log('Container-equivalent server startup passed: health, Studio redirect and Studio status.');
} finally {
  stop();
}
