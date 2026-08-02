import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { sanitizeNotebookEssay, decodeNotebookImage, notebookSlug } from '../src/notebook.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');

test('Notebook essay sanitization creates a safe, publishable record', () => {
  const essay = sanitizeNotebookEssay({
    title: '<script>Bad</script> A useful article',
    dek: '<b>A short introduction</b>',
    body: 'This is the complete article body. It contains enough words to publish safely.',
    tags: ['AI', '#Leadership', 'AI'],
    status: 'published',
    date: '2026-08-02',
    images: [{ url: '/api/notebook/images/123e4567-e89b-12d3-a456-426614174000.jpg', alt: 'A workshop' }, { url: 'https://evil.example/x.jpg' }],
  });
  assert.equal(essay.title, 'Bad A useful article');
  assert.equal(essay.dek, 'A short introduction');
  assert.equal(essay.slug, 'bad-a-useful-article');
  assert.equal(essay.status, 'published');
  assert.deepEqual(essay.tags, ['ai', 'leadership']);
  assert.equal(essay.images.length, 1);
  assert.equal(essay.monthLabel, 'August 2026');
});

test('Notebook validation rejects empty articles and invalid image bytes', () => {
  assert.throws(() => sanitizeNotebookEssay({ title: 'Title', body: 'Too short' }), /article text/i);
  assert.throws(() => decodeNotebookImage('data:image/png;base64,' + Buffer.from('not an image').toString('base64')), /valid PNG/i);
  assert.equal(notebookSlug('  Decisions & AI!  '), 'decisions-ai');
});

test('Notebook accepts verified PNG bytes', () => {
  const bytes = Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]), Buffer.alloc(12)]);
  const image = decodeNotebookImage('data:image/png;base64,' + bytes.toString('base64'));
  assert.equal(image.ext, 'png');
  assert.equal(image.contentType, 'image/png');
});

test('Studio uses direct publishing and public pages read the live API', () => {
  const html = fs.readFileSync(path.join(root, 'studio', 'notebook.html'), 'utf8');
  const admin = fs.readFileSync(path.join(root, 'studio', 'notebook-admin.js'), 'utf8');
  const blog = fs.readFileSync(path.join(root, 'paths', 'blog.html'), 'utf8');
  const essay = fs.readFileSync(path.join(root, 'paths', 'essay.html'), 'utf8');
  assert.match(html, /Paste your article/);
  assert.match(html, /Publish on website/);
  assert.doesNotMatch(html, /Publish &amp; download|replace.*repo/i);
  assert.match(admin, /\/api\/studio\/notebook\/essays/);
  assert.match(admin, /clipboardData/);
  assert.match(blog, /fetch\('\/api\/notebook'/);
  assert.match(essay, /fetch\('\/api\/notebook'/);
});

test('Studio lets a human paste text and publish without touching code', async () => {
  const html = fs.readFileSync(path.join(root, 'studio', 'notebook.html'), 'utf8');
  const script = fs.readFileSync(path.join(root, 'studio', 'notebook-admin.js'), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://staging.example/studio/notebook' });
  const calls = [];
  dom.window.HTMLElement.prototype.scrollIntoView = function () {};
  dom.window.scrollTo = function () {};
  dom.window.confirm = function () { return true; };
  dom.window.notebookMarkdown = (value) => '<p>' + String(value || '') + '</p>';
  dom.window.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url) === '/api/studio/notebook') return { ok: true, status: 200, json: async () => ({ ok: true, essays: [] }) };
    if (String(url) === '/api/studio/notebook/essays') {
      const sent = JSON.parse(init.body);
      return { ok: true, status: 200, json: async () => ({ ok: true, essay: sent, live_url: '/paths/essay?slug=' + sent.slug }) };
    }
    return { ok: false, status: 404, json: async () => ({ error: 'not_found' }) };
  };
  dom.window.eval(script);
  dom.window.document.dispatchEvent(new dom.window.CustomEvent('studio:authed'));
  await new Promise((resolve) => setTimeout(resolve, 0));

  const source = dom.window.document.getElementById('sourceText');
  source.value = 'This is a complete article pasted directly into the Notebook. It has enough text to continue.';
  dom.window.document.getElementById('continueButton').click();
  assert.equal(dom.window.document.getElementById('prepared').style.display, 'block');

  dom.window.document.getElementById('postTitle').value = 'A direct publishing test';
  dom.window.document.getElementById('postBody').value = source.value;
  dom.window.document.getElementById('publishButton').click();
  await new Promise((resolve) => setTimeout(resolve, 10));

  const publish = calls.find((call) => call.url === '/api/studio/notebook/essays');
  assert.ok(publish, 'publish endpoint was called');
  assert.equal(JSON.parse(publish.init.body).status, 'published');
  assert.match(dom.window.document.getElementById('publishStatus').textContent, /Published/);
});
