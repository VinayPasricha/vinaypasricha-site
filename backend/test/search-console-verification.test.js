import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHostingPublic } from '../../scripts/build-hosting-public.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const NAME = 'google2a52843db1b2236c.html';
const BODY = 'google-site-verification: google2a52843db1b2236c.html';
const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

test('verification file sits at the repo root with the exact token', () => {
  const body = readFileSync(path.join(repoRoot, NAME), 'utf8');
  assert.equal(body.trim(), BODY);
});

test('Hosting publishes the file verbatim and rewrites the .html URL to it ahead of Cloud Run', () => {
  const outDir = mkdtempSync(path.join(os.tmpdir(), 'hosting-gsc-'));
  try {
    buildHostingPublic({ root: repoRoot, outDir, assetVersion: 'gsctest' });
    // No public/<name>.html: cleanUrls would 301 it to the extensionless path.
    assert.equal(existsSync(path.join(outDir, NAME)), false);
    const published = readFileSync(path.join(outDir, NAME.replace(/\.html$/, '.htm')), 'utf8');
    assert.equal(published, readFileSync(path.join(repoRoot, NAME), 'utf8'));
    assert.doesNotMatch(published, /track\.js/);
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
  const firebase = JSON.parse(readFileSync(path.join(repoRoot, 'firebase.json'), 'utf8'));
  const rewrites = firebase.hosting.rewrites;
  const at = rewrites.findIndex((rule) => rule.source === '/' + NAME);
  assert.ok(at >= 0);
  assert.equal(rewrites[at].destination, '/' + NAME.replace(/\.html$/, '.htm'));
  assert.ok(at < rewrites.findIndex((rule) => rule.source === '**'));
  assert.equal((firebase.hosting.redirects || []).some((rule) => rule.source.includes('google')), false);
});

test('Cloud Run serves the verification file with 200 text/html, no redirect', async () => {
  const { createApp } = await import('../src/app.js');
  const app = createApp();
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const ua of ['curl/8', GOOGLEBOT]) {
      const res = await fetch(base + '/' + NAME, {
        redirect: 'manual',
        headers: { 'user-agent': ua, 'x-forwarded-host': 'vinaypasricha.com' },
      });
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type') || '', /^text\/html/);
      const body = await res.text();
      assert.equal(body.trim(), BODY);
      assert.doesNotMatch(body, /track\.js/);
    }
    // Other .html URLs still fold to clean paths.
    const other = await fetch(base + '/books.html', { redirect: 'manual' });
    assert.equal(other.status, 301);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
