import assert from 'node:assert/strict';

const base = String(process.env.ABL_STAGING_BASE_URL || '').replace(/\/$/, '');
const expectedRelease = String(process.env.ABL_EXPECTED_RELEASE || '');
const waitSeconds = Math.max(60, Number(process.env.ABL_DEPLOY_WAIT_SECONDS || 720));

assert.ok(base.startsWith('https://'), 'ABL_STAGING_BASE_URL must be an https URL');
assert.ok(expectedRelease, 'ABL_EXPECTED_RELEASE is required');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(path, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    return await fetch(base + path, {
      ...init,
      signal: controller.signal,
      headers: {
        'User-Agent': 'abl-staging-launch-audit/1.0',
        ...(init.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function text(path, init) {
  const response = await request(path, init);
  return { response, body: await response.text() };
}

async function waitForRelease() {
  const deadline = Date.now() + waitSeconds * 1000;
  let last = 'no response';
  while (Date.now() < deadline) {
    try {
      const response = await request(`/assets/data/staging-release.json?audit=${Date.now()}`, {
        cache: 'no-store',
      });
      const body = await response.text();
      if (response.ok) {
        const release = JSON.parse(body);
        last = release.release || 'missing release field';
        if (release.release === expectedRelease) {
          console.log(`Deployment fingerprint confirmed: ${expectedRelease}`);
          return;
        }
      } else {
        last = `HTTP ${response.status}`;
      }
    } catch (error) {
      last = error.message;
    }
    console.log(`Waiting for staging deployment; currently ${last}`);
    await sleep(15000);
  }
  throw new Error(`Staging did not serve ${expectedRelease} within ${waitSeconds}s; last result: ${last}`);
}

function hasNoStore(response, label) {
  const cache = String(response.headers.get('cache-control') || '').toLowerCase();
  assert.ok(cache.includes('no-store'), `${label} must be no-store; received ${cache || 'no cache-control'}`);
}

await waitForRelease();

{
  const response = await request('/api/health');
  assert.equal(response.status, 200, 'health endpoint must return 200');
  const body = await response.json();
  assert.equal(body.ok, true, 'health endpoint must report ok');
}

{
  const { response, body } = await text(`/ai-business-leaders/login?audit=${Date.now()}`);
  assert.equal(response.status, 200, 'participant login page must load');
  assert.match(body, /six-digit sign-in code/i, 'login page must explain OTP sign-in');
  assert.match(body, /auth-client\.js/, 'login page must load participant auth client');
  hasNoStore(response, 'participant login');
}

{
  const { response, body } = await text(`/ai-business-leaders/focused-workspace-preview?audit=${Date.now()}`);
  assert.equal(response.status, 200, 'participant-only staging preview must load');
  assert.match(body, /workspace-home-focus\.js/, 'focused homepage layer must be present');
  assert.match(body, /participant-only-nav\.js/, 'participant-only navigation layer must be present');
  assert.match(body, /id="studioMode"[^>]*hidden[^>]*aria-hidden="true"/, 'private Studio control must be hidden in server HTML');
  hasNoStore(response, 'participant preview');
}

{
  const response = await request('/api/abl/workspace/not-a-real-participant', { redirect: 'manual' });
  assert.equal(response.status, 401, 'participant data API must reject requests without a verified session');
}

{
  const response = await request('/api/abl/auth/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `launch-audit-${Date.now()}@example.invalid` }),
  });
  assert.equal(response.status, 200, 'unknown email request must return a non-disclosing response');
  const body = await response.json();
  assert.match(String(body.data?.message || ''), /if this email has active course access/i, 'OTP request must not disclose membership');
  assert.equal(body.data?.preview_code, undefined, 'deployed staging must never expose an OTP code');
}

{
  const response = await request('/studio/ai-leadership-workspace', { redirect: 'manual' });
  assert.equal(response.status, 302, `private Studio must redirect to login; received ${response.status}`);
  assert.match(String(response.headers.get('location') || ''), /^\/studio\/login/, 'Studio redirect must go to private login');
  hasNoStore(response, 'Studio redirect');
}

{
  const response = await request('/api/studio/status', { redirect: 'manual' });
  assert.equal(response.status, 200, `Studio must be explicitly configured on staging; received ${response.status}`);
  const body = await response.json();
  assert.equal(body.authed, false, 'anonymous staging request must not be Studio-authenticated');
}

console.log('Deployed staging HTTP audit passed: fingerprint, health, OTP privacy, participant isolation, no-store caching and Studio gate.');
