import assert from 'node:assert/strict';

const base = String(process.env.ABL_STAGING_BASE_URL || '').replace(/\/$/, '');
const expectedRelease = String(process.env.ABL_EXPECTED_RELEASE || '');
const waitSeconds = Math.max(60, Number(process.env.ABL_DEPLOY_WAIT_SECONDS || 720));
const affinityCookie = 'GOOGAPPUID=731';
let activeRevision = '';

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
        Cookie: affinityCookie,
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
  let candidateRevision = '';
  let consecutive = 0;
  const requiredConsecutive = 20;

  while (Date.now() < deadline) {
    try {
      const response = await request(`/api/abl/deployment?audit=${Date.now()}`, { cache: 'no-store' });
      const raw = await response.text();
      if (response.ok) {
        const body = JSON.parse(raw);
        const info = body.data || {};
        const release = String(info.release || '');
        const revision = String(info.revision || '');
        last = `${release || 'missing release'} @ ${revision || 'missing revision'}`;

        if (release === expectedRelease && revision && revision !== 'local') {
          if (revision === candidateRevision) consecutive += 1;
          else {
            candidateRevision = revision;
            consecutive = 1;
          }
          console.log(`Staging revision stability: ${consecutive}/${requiredConsecutive} · ${last}`);
          if (consecutive >= requiredConsecutive) {
            activeRevision = revision;
            console.log(`Dynamic deployment confirmed: ${expectedRelease} on ${activeRevision}`);
            return;
          }
          await sleep(1500);
          continue;
        }
      } else {
        last = `HTTP ${response.status}`;
      }
    } catch (error) {
      last = error.message;
    }

    candidateRevision = '';
    consecutive = 0;
    console.log(`Waiting for staging deployment; currently ${last}`);
    await sleep(10000);
  }
  throw new Error(`Staging did not serve ${expectedRelease} consistently within ${waitSeconds}s; last result: ${last}`);
}

function hasNoStore(response, label) {
  const cache = String(response.headers.get('cache-control') || '').toLowerCase();
  assert.ok(cache.includes('no-store'), `${label} must be no-store; received ${cache || 'no cache-control'}`);
}

function assertRevisionHeaders(response, label) {
  const release = String(response.headers.get('x-abl-release') || '');
  const revision = String(response.headers.get('x-abl-revision') || '');
  assert.equal(release, expectedRelease, `${label} was served by a different release: ${release || 'missing header'}`);
  assert.equal(revision, activeRevision, `${label} was served by a different Cloud Run revision: ${revision || 'missing header'}`);
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
  const { response, body } = await text('/studio/ai-leadership-workspace', { redirect: 'manual' });
  if (response.status !== 302) {
    console.error('Studio route diagnostic:', JSON.stringify({
      status: response.status,
      location: response.headers.get('location'),
      release: response.headers.get('x-abl-release'),
      revision: response.headers.get('x-abl-revision'),
      cacheControl: response.headers.get('cache-control'),
      contentType: response.headers.get('content-type'),
      body: body.slice(0, 1000),
    }));
  }
  assertRevisionHeaders(response, 'Studio route');
  assert.equal(response.status, 302, `private Studio must redirect to login; received ${response.status}`);
  assert.match(String(response.headers.get('location') || ''), /^\/studio\/login/, 'Studio redirect must go to private login');
  hasNoStore(response, 'Studio redirect');
}

{
  const { response, body } = await text('/api/studio/status', { redirect: 'manual' });
  if (response.status !== 200) {
    console.error('Studio status diagnostic:', JSON.stringify({
      status: response.status,
      contentType: response.headers.get('content-type'),
      body: body.slice(0, 1000),
    }));
  }
  assert.equal(response.status, 200, `Studio must be explicitly configured on staging; received ${response.status}`);
  const parsed = JSON.parse(body);
  assert.equal(parsed.authed, false, 'anonymous staging request must not be Studio-authenticated');
  assert.equal(parsed.enabled, true, 'staging Studio must report that private access is configured');
}

console.log(`Deployed staging HTTP audit passed on ${activeRevision}: health, OTP privacy, participant isolation, no-store caching and Studio gate.`);
