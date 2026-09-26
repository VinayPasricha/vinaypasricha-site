import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/app.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RUN_HOST = 'vinay-site-349140108061.asia-south1.run.app';

// The user agents that must receive the same HTML a browser receives.
// Googlebot is the one Firebase Hosting special-cases; the others are here
// so a future user-agent branch cannot serve them an error or an empty shell.
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

test('crawler user agents get the same HTML as a browser', async () => {
  const app = createApp();
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const [name, ua] of CRAWLERS) {
      for (const [page, marker] of PAGES) {
        const res = await fetch(base + page, {
          redirect: 'manual',
          headers: {
            'user-agent': ua,
            'x-forwarded-host': 'vinaypasricha.com',
          },
        });
        const body = await res.text();
        assert.equal(res.status, 200, `${name} ${page} status`);
        assert.equal(res.headers.get('location'), null, `${name} ${page} should not redirect`);
        assert.match(res.headers.get('content-type') || '', /text\/html/, `${name} ${page} content-type`);
        assert.match(body, /<title>/i, `${name} ${page} has a title`);
        assert.ok(body.includes(marker), `${name} ${page} missing "${marker}"`);
        assert.ok(body.length > 500, `${name} ${page} body too small`);
      }
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('Cloud Run /robots.txt answers 200 allow-all so Firebase can forward Googlebot', async () => {
  const app = createApp();
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const ua = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
  try {
    const probe = await fetch(base + '/robots.txt', {
      redirect: 'manual',
      headers: { 'user-agent': ua, 'x-forwarded-host': RUN_HOST },
    });
    const probeBody = await probe.text();
    assert.equal(probe.status, 200);
    assert.equal(probe.headers.get('location'), null);
    assert.match(probe.headers.get('content-type') || '', /text\/plain/);
    assert.match(probeBody, /^User-agent: \*$/m);
    assert.match(probeBody, /^Allow: \/$/m);
    assert.doesNotMatch(probeBody, /Disallow:/);
    assert.match(probeBody, /Sitemap: https:\/\/vinaypasricha.com\/sitemap.xml/);

    const page = await fetch(base + '/', {
      redirect: 'manual',
      headers: { 'user-agent': ua, 'x-forwarded-host': RUN_HOST },
    });
    assert.equal(page.status, 301);
    assert.equal(page.headers.get('location'), 'https://vinaypasricha.com/');

    const wwwRobots = await fetch(base + '/robots.txt', {
      redirect: 'manual',
      headers: { 'user-agent': ua, 'x-forwarded-host': 'www.vinaypasricha.com' },
    });
    assert.equal(wwwRobots.status, 301);
    assert.equal(wwwRobots.headers.get('location'), 'https://vinaypasricha.com/robots.txt');

    const published = await fetch(base + '/robots.txt', {
      redirect: 'manual',
      headers: { 'user-agent': ua, 'x-forwarded-host': 'vinaypasricha.com' },
    });
    const publishedBody = await published.text();
    assert.equal(published.status, 200);
    assert.match(publishedBody, /User-agent: Googlebot/);
    assert.match(publishedBody, /^Allow: \/$/m);
    assert.match(publishedBody, /^Disallow: \/studio\/$/m);
    assert.doesNotMatch(publishedBody, /^Disallow:\s*\/\s*$/m);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('published robots.txt keeps private paths closed and the public site open', () => {
  const body = fs.readFileSync(path.join(root, 'robots.txt'), 'utf8');
  assert.match(body, /User-agent: Googlebot/);
  assert.match(body, /^Allow: \/$/m);
  assert.match(body, /^Disallow: \/studio\/$/m);
  assert.match(body, /^Disallow: \/uploads\/$/m);
  assert.match(body, /^Disallow: \/_brief\/$/m);
  assert.match(body, /^Disallow: \/_explorations\/$/m);
  assert.match(body, /^Disallow: \/_prompts\/$/m);
  assert.doesNotMatch(body, /^Disallow:\s*\/\s*$/m);
  assert.doesNotMatch(body, /[^\x00-\x7F]/, 'robots.txt stays ASCII so a strict probe parser can read it');
});
