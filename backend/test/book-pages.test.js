import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SLUGS = [
  'ai-for-business-leaders',
  'siv-method',
  'execution-doctrine',
  'organizational-frequency',
  'the-signal',
  'civilization',
];
const ASINS = {
  'ai-for-business-leaders': 'B0GFXXPGP7',
  'siv-method': 'B0GX27LGJX',
  'execution-doctrine': 'B0GXVLX2G9',
  'organizational-frequency': 'B0H2NTL3XS',
  'the-signal': 'B0H3WJJH3S',
  'civilization': 'B0H4GWZND6',
};
const LANGS = ['x-default', 'en', 'hi', 'bn', 'ta', 'te', 'kn', 'es', 'fr', 'pt', 'ja', 'zh', 'ko', 'ru'];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function jsonLdBlocks(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1]));
}

test('each book page is one valid landing page', () => {
  for (const slug of SLUGS) {
    const html = read(`books/${slug}.html`);
    const title = html.match(/<title>([^<]*)<\/title>/)[1];
    const description = html.match(/<meta name="description" content="([^"]*)">/)[1];
    assert.equal((html.match(/<h1\b/g) || []).length, 1, slug);
    assert.ok(title.length <= 60, `${slug} title ${title.length}: ${title}`);
    assert.ok(description.length <= 160, `${slug} description ${description.length}`);
    assert.match(title, /Vinay Pasricha/);
    assert.match(description, /Vinay Pasricha/);
    assert.match(html, new RegExp(`rel="canonical" href="https://vinaypasricha.com/books/${slug}"`));
    assert.match(html, new RegExp(`property="og:title" content="${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
    assert.match(html, /name="twitter:card" content="summary_large_image"/);
    assert.match(html, new RegExp(`https://www.amazon.in/dp/${ASINS[slug]}`));
    assert.match(html, new RegExp(`https://www.amazon.com/dp/${ASINS[slug]}`));
    assert.match(html, /Buy on Amazon/);
    assert.match(html, /alt="Cover of /);
    assert.match(html, /href="\/books"/);
    assert.match(html, /href="\/paths\/course"/);
    for (const other of SLUGS) {
      if (other !== slug) assert.match(html, new RegExp(`href="/books/${other}"`));
    }
    for (const lang of LANGS) {
      assert.match(html, new RegExp(`hreflang="${lang}"`));
    }

    const blocks = jsonLdBlocks(html);
    const graph = blocks.flatMap((block) => block['@graph'] || [block]);
    const types = graph.map((node) => node['@type']);
    assert.ok(types.includes('Book'), slug);
    assert.ok(types.includes('Person'), slug);
    assert.ok(types.includes('FAQPage'), slug);
    const person = graph.find((node) => node['@type'] === 'Person');
    assert.ok(person.sameAs.includes('https://www.linkedin.com/in/vinay-pasricha-a264186/'));
    assert.ok(person.sameAs.includes('https://www.goodspace.ai'));
    const faq = graph.find((node) => node['@type'] === 'FAQPage');
    assert.ok(faq.mainEntity.length >= 3);
    for (const q of faq.mainEntity) {
      assert.equal(q['@type'], 'Question');
      assert.ok(html.includes(q.name));
      assert.ok(html.includes(q.acceptedAnswer.text));
    }
    assert.doesNotMatch(html, /bestseller|stars|rating|award/i);
  }
});

test('sitemap lists every book page with hreflang alternates', () => {
  const xml = read('sitemap.xml');
  for (const slug of SLUGS) {
    const loc = `https://vinaypasricha.com/books/${slug}`;
    assert.match(xml, new RegExp(`<loc>${loc}</loc>`));
    for (const lang of LANGS) {
      const href = lang === 'x-default' || lang === 'en' ? loc : `${loc}?lang=${lang}`;
      assert.match(xml, new RegExp(`hreflang="${lang}" href="${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
    }
  }
});

test('bookshelf cards point at the book pages, including Organizational Frequency', () => {
  const js = read('js/books.js');
  const data = JSON.parse(read('assets/data/books.json'));
  assert.match(js, /function bookPage\(book\)/);
  assert.match(js, /href="\$\{bookPage\(book\)\}"/);
  assert.doesNotMatch(js, /href="\$\{book\.excerpt_path\}"/);
  assert.doesNotMatch(js, /href="\$\{book\.path\}"/);
  for (const slug of SLUGS) {
    const book = data.books.find((item) => item.slug === slug);
    assert.equal(book.path, `/books/${slug}`);
  }
  assert.equal(
    data.books.find((item) => item.slug === 'organizational-frequency').path,
    '/books/organizational-frequency',
  );
});

test('the Express server renders the book pages and keeps /books', async () => {
  const { createApp } = await import('../src/app.js');
  const app = createApp();
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const shelf = await fetch(base + '/books');
    const shelfHtml = await shelf.text();
    assert.equal(shelf.status, 200);
    assert.match(shelfHtml, /id="books-matrix"/);
    assert.match(shelfHtml, /js\/books\.js/);

    const slash = await fetch(base + '/books/', { redirect: 'manual' });
    assert.equal(slash.status, 200);
    assert.match(await slash.text(), /id="books-matrix"/);

    for (const slug of SLUGS) {
      const res = await fetch(base + '/books/' + slug);
      const html = await res.text();
      assert.equal(res.status, 200, slug);
      assert.match(html, /<h1\b/);
      assert.match(html, new RegExp(`amazon\\.in/dp/${ASINS[slug]}`));
      const dirty = await fetch(base + '/books/' + slug + '.html', { redirect: 'manual' });
      assert.equal(dirty.status, 301, slug);
      assert.equal(dirty.headers.get('location'), '/books/' + slug);
    }

    const sitemap = await fetch(base + '/sitemap.xml');
    const xml = await sitemap.text();
    assert.equal(sitemap.status, 200);
    assert.match(sitemap.headers.get('content-type'), /xml/);
    for (const slug of SLUGS) {
      assert.match(xml, new RegExp(`vinaypasricha.com/books/${slug}`));
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
