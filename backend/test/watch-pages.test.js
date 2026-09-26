import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const library = JSON.parse(fs.readFileSync(path.join(root, 'assets', 'data', 'videos-library.json'), 'utf8'));

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function jsonLd(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1]));
}

test('every video has a static page with verbatim copy and valid VideoObject JSON-LD', () => {
  assert.equal(library.videos.length, 36);
  for (const video of library.videos) {
    const html = read(`watch/${video.slug}.html`);
    const display = video.suggested_title || video.title;
    assert.equal((html.match(/<h1\b/g) || []).length, 1, video.slug);
    assert.match(html, new RegExp(`<title>${video.seo_title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</title>`));
    assert.match(html, new RegExp(`rel="canonical" href="https://vinaypasricha.com/watch/${video.slug}"`));
    assert.ok(html.includes(esc(display)), video.slug);
    assert.ok(html.includes(esc(video.summary.slice(0, 120))), `${video.slug} summary`);
    assert.ok(html.includes(esc(video.primary_keyword)), `${video.slug} keyword`);
    for (const point of video.key_points) assert.ok(html.includes(esc(point)), `${video.slug} point`);
    if (video.notable_quote) assert.ok(html.includes(esc(video.notable_quote)), `${video.slug} quote`);
    if (video.summary_hi) {
      assert.match(html, /lang="hi"/);
      assert.ok(html.includes(esc(video.summary_hi.slice(0, 40))), `${video.slug} hindi`);
    }
    assert.doesNotMatch(html, /<iframe/i, video.slug);
    assert.match(html, new RegExp(`youtube-nocookie\\.com/embed/${video.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    assert.match(html, /class="wl-lite"/);
    assert.doesNotMatch(html, /editor_notes|\/paths\/india/);
    if (video.type === 'short') assert.match(html, /wl-frame is-short/);
    else assert.match(html, /wl-frame is-video/);

    const graph = jsonLd(html).flatMap((block) => block['@graph'] || [block]);
    const object = graph.find((node) => node['@type'] === 'VideoObject');
    const crumbs = graph.find((node) => node['@type'] === 'BreadcrumbList');
    assert.ok(object, video.slug);
    assert.equal(object.name, video.title);
    assert.equal(object.description, video.summary);
    assert.equal(object.thumbnailUrl, video.thumbnail);
    assert.equal(object.uploadDate, video.upload_date);
    assert.equal(object.duration, video.duration_iso);
    assert.equal(object.contentUrl, video.url);
    assert.equal(object.inLanguage, video.language);
    assert.match(object.embedUrl, /^https:\/\/www\.youtube-nocookie\.com\/embed\//);
    assert.equal(crumbs.itemListElement.length, 3);
    if (video.related_book) assert.match(html, new RegExp(`/books/${video.related_book}`));
  }
});

test('the watch hub groups all 36 videos and ships no iframe', () => {
  const html = read('watch.html');
  assert.match(html, /<h1 class="brutal">Watch — Videos by Vinay Pasricha<\/h1>/);
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.doesNotMatch(html, /<iframe/i);
  const headings = [...html.matchAll(/<h2>([^<]+)<\/h2>/g)].map((match) => match[1]);
  assert.deepEqual(headings, [
    'AI for Business',
    'Decisions &amp; the SIV Method',
    'Execution',
    'Hiring &amp; Organizational Frequency',
    'Career &amp; Finding Work',
    'Civilization &amp; the Future',
    'Learning &amp; Thinking',
    'India &amp; Systems',
  ]);
  assert.match(html, /Justice Delayed/);
  for (const video of library.videos) {
    assert.match(html, new RegExp(`href="/watch/${video.slug}"`));
  }
  const graph = jsonLd(html).flatMap((block) => block['@graph'] || [block]);
  assert.ok(graph.some((node) => node['@type'] === 'CollectionPage'));
  const list = graph.find((node) => node['@type'] === 'ItemList');
  assert.equal(list.numberOfItems, 36);
  assert.equal(list.itemListElement.length, 36);
});

test('sitemap lists the hub and every video, and drops the old path URL', () => {
  const xml = read('sitemap.xml');
  assert.doesNotMatch(xml, /vinaypasricha\.com\/paths\/watch/);
  assert.match(xml, /<loc>https:\/\/vinaypasricha\.com\/watch<\/loc>/);
  for (const video of library.videos) {
    assert.match(xml, new RegExp(`<loc>https://vinaypasricha\\.com/watch/${video.slug}</loc>`));
  }
});

test('book and path pages embed the listed videos, with Related only on The Signal', () => {
  const signal = read('books/the-signal.html');
  assert.match(signal, /class="wl-flag">Related</);
  assert.match(signal, /1IUcqi97ueA/);
  assert.equal((signal.match(/<a class="wl-lite"/g) || []).length, 1);
  const leaders = read('books/ai-for-business-leaders.html');
  assert.equal((leaders.match(/<a class="wl-lite"/g) || []).length, 2);
  assert.match(leaders, /href="\/watch\/ai-ready-company-four-capabilities"/);
  assert.match(leaders, /href="\/watch"/);
  const findWork = read('paths/find-work.html');
  assert.match(findWork, /The best roles find people who aren’t looking\./);
  assert.match(findWork, /8OXPQ1KqK9M/);
  assert.doesNotMatch(read('books/execution-doctrine.html'), /class="wl-flag">Related</);
});

test('/paths/watch redirects to /watch and the hub is served with or without a slash', async () => {
  const { createApp } = await import('../src/app.js');
  const app = createApp();
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const legacy = await fetch(base + '/paths/watch', { redirect: 'manual' });
    assert.equal(legacy.status, 301);
    assert.equal(legacy.headers.get('location'), '/watch');
    const legacyHtml = await fetch(base + '/paths/watch.html?lang=hi', { redirect: 'manual' });
    assert.equal(legacyHtml.status, 301);
    assert.equal(legacyHtml.headers.get('location'), '/watch?lang=hi');
    const hub = await fetch(base + '/watch');
    assert.equal(hub.status, 200);
    assert.match(await hub.text(), /Watch — Videos by Vinay Pasricha/);
    const slash = await fetch(base + '/watch/', { redirect: 'manual' });
    assert.equal(slash.status, 200);
    assert.match(await slash.text(), /Watch — Videos by Vinay Pasricha/);
    const video = await fetch(base + '/watch/find-where-you-belong');
    const videoHtml = await video.text();
    assert.equal(video.status, 200);
    assert.match(videoHtml, /Find Where You Belong/);
    assert.match(videoHtml, /is-short/);
    assert.doesNotMatch(videoHtml, /<iframe/i);
    const dirty = await fetch(base + '/watch/find-where-you-belong.html', { redirect: 'manual' });
    assert.equal(dirty.status, 301);
    assert.equal(dirty.headers.get('location'), '/watch/find-where-you-belong');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
