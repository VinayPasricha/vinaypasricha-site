import test from 'node:test';
import assert from 'node:assert/strict';

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
