import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHostingPublic } from '../../scripts/build-hosting-public.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const firebase = JSON.parse(readFileSync(path.join(repoRoot, 'firebase.json'), 'utf8'));

const CRAWLERS = [
  ['Googlebot', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
  ['Googlebot-smartphone', 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.69 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
  ['Bingbot', 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'],
  ['facebookexternalhit', 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'],
  ['Twitterbot', 'Twitterbot/1.0'],
  ['LinkedInBot', 'LinkedInBot/1.0'],
  ['WhatsApp', 'WhatsApp/2.23.20.0'],
  ['GPTBot', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)'],
  ['ClaudeBot', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)'],
  ['PerplexityBot', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)'],
];

const PAGES = [
  ['/', 'GoodSpace AI Founder'],
  ['/books', 'Books by Vinay Pasricha'],
  ['/watch', 'Videos by Vinay Pasricha'],
  ['/books/civilization', 'Eight Directions of Intelligence'],
  ['/paths/civilization', 'Eight Directions of Intelligence'],
];

function inside(root, rel) {
  const abs = path.resolve(root, rel);
  if (abs !== root && !abs.startsWith(root + path.sep)) return null;
  return abs;
}

// Same order Hosting uses: redirects, then a static file, then cleanUrls
// (books.html served at /books). Paths with no file would fall through to the
// Cloud Run rewrite; these tests only cover files the build publishes.
function startStatic(outDir, redirects) {
  const bySource = new Map(redirects.map((rule) => [rule.source, rule]));
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const pathname = decodeURIComponent(url.pathname);
    const rule = bySource.get(pathname);
    if (rule) {
      res.writeHead(rule.type, { Location: rule.destination });
      return res.end();
    }
    if (pathname.length > 1 && pathname.endsWith('/')) {
      res.writeHead(301, { Location: pathname.slice(0, -1) + url.search });
      return res.end();
    }
    if (pathname.endsWith('.html')) {
      const clean = pathname.endsWith('/index.html')
        ? pathname.slice(0, -'index.html'.length) || '/'
        : pathname.slice(0, -'.html'.length);
      res.writeHead(301, { Location: clean + url.search });
      return res.end();
    }
    const rel = pathname === '/' ? 'index.html' : pathname.slice(1);
    for (const candidate of [rel, rel + '.html']) {
      const abs = inside(outDir, candidate);
      if (!abs || !existsSync(abs) || !statSync(abs).isFile()) continue;
      const body = readFileSync(abs);
      const type = candidate.endsWith('.html') ? 'text/html; charset=utf-8'
        : candidate.endsWith('.txt') ? 'text/plain; charset=utf-8'
        : 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': body.length });
      return res.end(body);
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('not found');
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

test('hosting config serves static pages ahead of the Cloud Run rewrite', () => {
  const hosting = firebase.hosting;
  assert.equal(hosting.public, 'public');
  assert.equal(hosting.cleanUrls, true);
  assert.equal(hosting.trailingSlash, false);
  assert.equal(hosting.i18n, undefined);
  const rewrite = hosting.rewrites.find((rule) => rule.source === '**');
  assert.equal(rewrite.run.serviceId, 'vinay-site');
  assert.equal(rewrite.run.region, 'asia-south1');
  const watch = hosting.redirects.find((rule) => rule.source === '/paths/watch');
  assert.equal(watch.destination, '/watch');
  assert.equal(watch.type, 301);
  const legacy = hosting.redirects.find((rule) => rule.source === '/pages/path6.html');
  assert.equal(legacy.destination, '/paths/find-work');
});

test('crawler user agents get the static Hosting HTML for the key pages', async () => {
  const outDir = mkdtempSync(path.join(os.tmpdir(), 'hosting-public-'));
  const server = await (async () => {
    buildHostingPublic({ root: repoRoot, outDir, assetVersion: 'hostingtest' });
    return startStatic(outDir, firebase.hosting.redirects);
  })();
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal(existsSync(path.join(outDir, 'studio')), false);
    assert.equal(existsSync(path.join(outDir, 'backend')), false);
    assert.equal(existsSync(path.join(outDir, 'ai-business-leaders')), false);
    assert.equal(existsSync(path.join(outDir, '_brief')), false);

    const robots = readFileSync(path.join(outDir, 'robots.txt'), 'utf8');
    assert.match(robots, /^Allow: \/$/m);
    assert.match(robots, /^Disallow: \/studio\/$/m);
    assert.doesNotMatch(robots, /^Disallow:\s*\/\s*$/m);

    for (const [name, ua] of CRAWLERS) {
      for (const [page, marker] of PAGES) {
        const res = await fetch(base + page, {
          redirect: 'manual',
          headers: { 'user-agent': ua },
        });
        const body = await res.text();
        assert.equal(res.status, 200, `${name} ${page}`);
        assert.match(res.headers.get('content-type') || '', /text\/html/);
        assert.match(body, /<title>/i);
        assert.ok(body.includes(marker), `${name} ${page} missing ${marker}`);
        assert.match(body, /\/js\/track\.js\?v=hostingtest/);
        assert.ok(body.length > 500);
      }
      const robotsRes = await fetch(base + '/robots.txt', {
        redirect: 'manual',
        headers: { 'user-agent': ua },
      });
      assert.equal(robotsRes.status, 200, `${name} /robots.txt`);
      assert.match(await robotsRes.text(), /User-agent: Googlebot/);
    }

    const legacy = await fetch(base + '/pages/path6.html', { redirect: 'manual' });
    assert.equal(legacy.status, 301);
    assert.equal(legacy.headers.get('location'), '/paths/find-work');

    const shelf = await fetch(base + '/books/', { redirect: 'manual' });
    assert.equal(shelf.status, 301);
    assert.equal(shelf.headers.get('location'), '/books');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    rmSync(outDir, { recursive: true, force: true });
  }
});
