import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AI_INPUT_LIMITS, prepareAiComplete, createApp } from '../src/app.js';
import { renderCompanyPage, validCompanyName, hostnameOf } from '../src/services/companyProfiles.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

test('company names accept an ampersand and reject markup', () => {
  assert.equal(validCompanyName('Marks & Spencer'), true);
  assert.equal(validCompanyName("Ben & Jerry's"), true);
  assert.equal(validCompanyName('<script>alert(1)</script>'), false);
  assert.equal(hostnameOf('heliorobotics.com'), 'heliorobotics.com');
  assert.equal(hostnameOf('https://www.example.com/path'), 'www.example.com');
  assert.equal(hostnameOf('<script>alert(1)</script>'), '');
  assert.equal(hostnameOf('not a domain'), '');
});

test('a company name with & renders escaped, and a script in the store cannot break out', () => {
  const template = read('frequency/company.html');
  const named = renderCompanyPage(template, {
    name: 'Marks & Spencer',
    domain: 'marksandspencer.com',
    slug: 'marks-spencer',
  }, { pub_estimates: [] });
  assert.match(named, /Marks &amp; Spencer/);
  assert.doesNotMatch(named, /Marks & Spencer/);
  assert.match(named, /marksandspencer\.com/);

  const store = {
    pub_estimates: [{ note: '</script><script>alert(1)</script>' }],
    surprise: 'line\u2028break\u2029end',
  };
  const html = renderCompanyPage(template, {
    name: 'Acme Co',
    domain: 'acme.example',
    slug: 'acme-co',
  }, store);
  const marker = 'window.__OF_COMPANY_DATA__ = ';
  const start = html.indexOf(marker);
  assert.ok(start > 0);
  const end = html.indexOf('</script>', start);
  assert.ok(end > start);
  const literal = html.slice(start + marker.length, end).trim().replace(/;$/, '');
  assert.equal(literal.includes('<'), false);
  assert.match(literal, /\\u003c\/script>/);
  assert.match(literal, /\\u2028/);
  assert.match(literal, /\\u2029/);
  const parsed = JSON.parse(JSON.parse(literal));
  assert.equal(parsed.pub_estimates[0].note, '</script><script>alert(1)</script>');
  assert.equal(parsed.surprise, 'line\u2028break\u2029end');
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
});

test('live AI callers still fit the input cap', () => {
  const doctrine = read('library/execution-doctrine/full-text.txt');
  const spec = read('runtime/nodes/01-sequence-chamber.md');
  const chamber = prepareAiComplete({
    system: spec + '\n' + doctrine.slice(0, 28000) + '\nchamber instructions',
    messages: [{ role: 'user', content: 'x'.repeat(8000) }],
  });
  assert.ok(chamber.system.length > 32 * 1024);

  const ask = prepareAiComplete({
    system: 'You are a careful reading companion.\n\n--- BEGIN MANUSCRIPT ---\n' + doctrine + '\n--- END MANUSCRIPT ---',
    messages: [{ role: 'user', content: 'Reader question: What is the governing limit?' }],
  });
  assert.ok(ask.system.length < AI_INPUT_LIMITS.maxSystemChars);

  assert.throws(
    () => prepareAiComplete({
      system: 'z'.repeat(AI_INPUT_LIMITS.maxSystemChars + 1),
      messages: [{ role: 'user', content: 'hi' }],
    }),
    (err) => err.status === 400 && err.message === 'too_large',
  );
  const many = Array.from({ length: AI_INPUT_LIMITS.maxMessages + 1 }, () => ({ role: 'user', content: 'hi' }));
  assert.throws(
    () => prepareAiComplete({ system: 'ok', messages: many }),
    (err) => err.status === 400,
  );
});

test('the public AI proxy rejects foreign origins, oversize bodies, and forged rate-limit keys', async () => {
  const app = createApp();
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, { origin, referer, forwardedFor, body }) => fetch(base + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(origin ? { Origin: origin } : {}),
      ...(referer ? { Referer: referer } : {}),
      ...(forwardedFor ? { 'X-Forwarded-For': forwardedFor } : {}),
    },
    body: JSON.stringify(body),
  });

  try {
    const foreign = await post('/api/ai/complete', {
      origin: 'https://evil.example',
      body: { system: 'You are helpful.', messages: [{ role: 'user', content: 'Hello' }] },
    });
    assert.equal(foreign.status, 403);
    const foreignBody = await foreign.json();
    assert.equal(foreignBody.error, 'origin_required');
    assert.doesNotMatch(JSON.stringify(foreignBody), /at \//);

    const noCaller = await post('/api/ai/complete', {
      body: { system: 'You are helpful.', messages: [{ role: 'user', content: 'Hello' }] },
    });
    assert.equal(noCaller.status, 403);
    await noCaller.json();

    const refererOnly = await post('/api/ai/complete', {
      referer: 'https://evil.example/steal',
      body: { messages: [] },
    });
    assert.equal(refererOnly.status, 403);
    await refererOnly.json();

    const allowedShape = await post('/api/ai/complete', {
      origin: 'https://vinaypasricha.com',
      body: { system: 'You are helpful.', messages: [] },
    });
    assert.equal(allowedShape.status, 400);
    await allowedShape.json();

    const localDev = await post('/api/ai/complete', {
      origin: 'http://localhost:8000',
      body: { system: 'You are helpful.', messages: [{ role: 'user', content: '   ' }] },
    });
    assert.equal(localDev.status, 400);
    await localDev.json();

    const staging = await post('/api/ai/complete', {
      origin: 'https://vinay-site-staging-349140108061.asia-south1.run.app',
      body: { messages: 'not-a-list' },
    });
    assert.equal(staging.status, 400);
    await staging.json();

    const oversize = await post('/api/ai/complete', {
      origin: 'https://vinaypasricha.com',
      body: {
        system: 's'.repeat(AI_INPUT_LIMITS.maxSystemChars + 1),
        messages: [{ role: 'user', content: 'hello' }],
      },
    });
    assert.equal(oversize.status, 400);
    const oversizeBody = await oversize.json();
    assert.equal(oversizeBody.detail, 'That request is too large.');
    assert.doesNotMatch(oversizeBody.detail, /Error|credential|stack/i);

    const huge = await post('/api/ai/complete', {
      origin: 'https://vinaypasricha.com',
      body: { system: 's'.repeat(120 * 1024), messages: [{ role: 'user', content: 'hello' }] },
    });
    assert.equal(huge.status, 400);
    const hugeBody = await huge.json();
    assert.equal(hugeBody.detail, 'That request is too large.');

    const corsEvil = await fetch(base + '/api/health', { headers: { Origin: 'https://evil.example' } });
    assert.equal(corsEvil.status, 200);
    assert.equal(corsEvil.headers.get('access-control-allow-origin'), null);
    await corsEvil.json();
    const corsSite = await fetch(base + '/api/health', { headers: { Origin: 'https://vinaypasricha.com' } });
    assert.equal(corsSite.headers.get('access-control-allow-origin'), 'https://vinaypasricha.com');
    await corsSite.json();

    const scriptName = await post('/api/company-profiles', {
      body: { name: '<script>alert(1)</script>', url: 'https://evil.example' },
    });
    assert.equal(scriptName.status, 400);
    const scriptBody = await scriptName.json();
    assert.equal(scriptBody.error, 'bad_request');
    assert.doesNotMatch(scriptBody.detail, /<script>|alert\(1\)/);

    const badDomain = await post('/api/company-profiles', {
      body: { name: 'Acme Co', domain: '<script>alert(1)</script>' },
    });
    assert.equal(badDomain.status, 400);
    await badDomain.json();

    const tail = '203.0.113.5, 203.0.113.1';
    let limited = 0;
    for (let i = 0; i < 30; i += 1) {
      const res = await post('/api/studio/login', {
        forwardedFor: `forged-${i}, ${tail}`,
        body: { password: 'not-the-passphrase' },
      });
      limited = res.status;
      await res.json();
      if (limited === 429) break;
    }
    assert.equal(limited, 429);
    const stillLimited = await post('/api/studio/login', {
      forwardedFor: `forged-reset, ${tail}`,
      body: { password: 'not-the-passphrase' },
    });
    assert.equal(stillLimited.status, 429);
    await stillLimited.json();
    const otherAddress = await post('/api/studio/login', {
      forwardedFor: 'forged-reset, 198.51.100.9, 198.51.100.1',
      body: { password: 'not-the-passphrase' },
    });
    assert.equal(otherAddress.status, 401);
    await otherAddress.json();
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
