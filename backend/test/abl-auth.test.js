import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

process.env.ABL_AUTH_SECRET = process.env.ABL_AUTH_SECRET || 'test-only-participant-auth-secret';

const auth = await import('../src/abl/auth.js');

test('participant token is signed, scoped and readable', () => {
  const participant = { id: 'participant-123', slug: 'meridian-logistics' };
  const token = auth.createParticipantToken(participant);
  assert.match(token, /^abl\./);
  assert.deepEqual(
    { sub: auth.verifyParticipantToken(token).sub, slug: auth.verifyParticipantToken(token).slug },
    { sub: participant.id, slug: participant.slug }
  );
  assert.equal(auth.verifyParticipantToken(token + 'changed'), null);
});

test('six-digit course codes are hashed and verified without storing plaintext', () => {
  const email = ' Leader@Example.com ';
  const code = auth.createLoginCode();
  const hash = auth.hashLoginCode(email, code);
  assert.match(code, /^\d{6}$/);
  assert.notEqual(hash, code);
  assert.equal(auth.verifyLoginCode('leader@example.com', code, hash), true);
  assert.equal(auth.verifyLoginCode('leader@example.com', '000001', hash), false);
});

test('course email normalization rejects malformed addresses', () => {
  assert.equal(auth.normalizeEmail('  LEADER@EXAMPLE.COM '), 'leader@example.com');
  assert.equal(auth.validEmail('leader@example.com'), true);
  assert.equal(auth.validEmail('not-an-email'), false);
});

test('opaque participant tokens are random and stored only by hash', () => {
  const first = auth.createOpaqueParticipantToken();
  const second = auth.createOpaqueParticipantToken();
  assert.match(first, /^ablr\.[A-Za-z0-9_-]+$/);
  assert.notEqual(first, second);
  assert.match(auth.hashParticipantToken(first), /^[a-f0-9]{64}$/);
  assert.notEqual(auth.hashParticipantToken(first), first);
  assert.ok(Date.parse(auth.participantTokenExpiry()) > Date.now());
});

test('preview login codes are still checked when no deployment secret exists', () => {
  const script = `
    const auth = await import('./src/abl/auth.js');
    const hash = auth.hashLoginCode('leader@example.com', '482913');
    if (!auth.verifyLoginCode('leader@example.com', '482913', hash)) process.exit(2);
    if (auth.verifyLoginCode('leader@example.com', '111111', hash)) process.exit(3);
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, ABL_AUTH_SECRET: '', ADMIN_TOKEN: '' },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
