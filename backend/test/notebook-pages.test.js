import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { createApp } from '../src/app.js';
import { buildHostingPublic } from '../../scripts/build-hosting-public.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

test('static Notebook hub and article are served, /paths/blog redirects', async () => {
  const app = createApp();
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = (p, ua) => fetch(base + p, { redirect: 'manual', headers: { 'x-forwarded-host': 'vinaypasricha.com', ...(ua ? { 'user-agent': ua } : {}) } });
  try {
    for (const ua of [undefined, GOOGLEBOT]) {
      const article = await get('/notebook/ai-for-msme-india', ua);
      const html = await article.text();
      assert.equal(article.status, 200);
      assert.match(html, /<title>AI for MSMEs in India: Where to Start \(90-Day Plan\)<\/title>/);
      assert.match(html, /<link rel="canonical" href="https:\/\/vinaypasricha\.com\/notebook\/ai-for-msme-india">/);
      assert.match(html, /"@type": "Article"/);
      assert.match(html, /"datePublished": "2026-09-26"/);
      assert.match(html, /href="\/books\/ai-for-business-leaders"/);
      assert.match(html, /href="\/paths\/course"/);
      assert.match(html, /https:\/\/www\.youtube\.com\/@VinayPasrichauthor/);
      assert.doesNotMatch(html, /EDITOR NOTES|\[date\]/);

      const hub = await get('/notebook', ua);
      const hubHtml = await hub.text();
      assert.equal(hub.status, 200);
      assert.match(hubHtml, /href="\/notebook\/ai-for-msme-india"/);
    }
    for (const p of ['/paths/blog', '/paths/blog.html', '/pages/path9']) {
      const res = await get(p);
      assert.equal(res.status, 301, p);
      assert.equal(res.headers.get('location'), '/notebook', p);
    }
    const slash = await get('/notebook/');
    assert.equal(slash.status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  assert.match(sitemap, /<loc>https:\/\/vinaypasricha\.com\/notebook<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/vinaypasricha\.com\/notebook\/ai-for-msme-india<\/loc>/);
});

test('Firebase Hosting output includes the Notebook and redirects /paths/blog', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hosting-notebook-'));
  buildHostingPublic({ root, outDir, assetVersion: 'nbtest' });
  assert.ok(fs.existsSync(path.join(outDir, 'notebook.html')));
  const article = fs.readFileSync(path.join(outDir, 'notebook', 'ai-for-msme-india.html'), 'utf8');
  assert.match(article, /AI for MSMEs in India: Where to Start/);
  const firebase = JSON.parse(fs.readFileSync(path.join(root, 'firebase.json'), 'utf8'));
  for (const source of ['/paths/blog', '/paths/blog.html', '/pages/path9']) {
    const rule = firebase.hosting.redirects.find((r) => r.source === source);
    assert.equal(rule && rule.destination, '/notebook', source);
    assert.equal(rule.type, 301);
  }
});
