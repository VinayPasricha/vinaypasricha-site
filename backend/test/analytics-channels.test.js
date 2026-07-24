import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeChannelDest } from '../src/services/analytics.js';

// A branded /go/<slug> link redirects to a channel's destination. That
// destination must never leave our origin, or the link becomes an open
// redirect an attacker could use for phishing under vinaypasricha.com/go/.
test('channel destinations can never redirect off-origin', () => {
  const offOrigin = (t) => /^\/\//.test(t) || /^[a-z][a-z0-9+.-]*:/i.test(t);

  // Every hostile form must reduce to a single-slash, same-origin path.
  for (const evil of [
    'https://evil.com/phish',
    'http://evil.com',
    '//evil.com/x',
    '///evil.com',
    '/\\evil.com',
    '/\\/evil.com',
    'javascript:alert(1)',
    'HTTPS://EVIL.COM/x',
  ]) {
    const out = sanitizeChannelDest(evil);
    assert.ok(out.startsWith('/'), `${evil} -> ${out} must start with /`);
    assert.ok(!offOrigin(out), `${evil} -> ${out} must not leave the origin`);
  }
});

test('channel destinations keep a genuine on-site path', () => {
  assert.equal(sanitizeChannelDest('/paths/connect'), '/paths/connect');
  assert.equal(sanitizeChannelDest('paths/connect'), '/paths/connect');
  assert.equal(sanitizeChannelDest(''), '/');
  assert.equal(sanitizeChannelDest('/books?ref=x'), '/books?ref=x');
  // The path of an on-site absolute URL survives; the host is dropped.
  assert.equal(sanitizeChannelDest('https://vinaypasricha.com/books'), '/books');
});
