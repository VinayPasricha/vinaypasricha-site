import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const html = readFileSync(path.join(root, 'studio', 'ai-business-leaders.html'), 'utf8');
const studio = readFileSync(path.join(root, 'studio', 'ai-business-leaders.js'), 'utf8');

async function listPage() {
  const participants = [
    { id: '3', name: 'Vinay Pasricha', company_name: 'GoodSpace AI', email: 'vinay@example.com', role_title: 'Founder', status: 'active' },
    { id: '1', name: 'Arvind Rao', company_name: 'MRC India', email: 'arvind@example.com', role_title: 'Managing Director', status: 'link_ready' },
    { id: '2', name: 'Gaurav Shah', company_name: 'Richa Global', email: 'gaurav@example.com', role_title: 'Director', status: 'completed' },
  ];
  const dom = new JSDOM(html, {
    url: 'https://example.test/studio/ai-business-leaders',
    runScripts: 'outside-only',
  });
  dom.window.requestAnimationFrame = (fn) => fn();
  dom.window.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ ok: true, data: participants }),
  });
  dom.window.eval(studio);
  await new Promise((resolve) => setTimeout(resolve, 10));
  return dom;
}

test('participants are displayed alphabetically by name', async () => {
  const dom = await listPage();
  const names = [...dom.window.document.querySelectorAll('.participant-name')].map((node) => node.textContent);
  assert.deepEqual(names, ['Arvind Rao', 'Gaurav Shah', 'Vinay Pasricha']);
  assert.equal(dom.window.document.getElementById('participantSearchCount').textContent, 'A–Z');
  dom.window.close();
});

test('participant search matches names, companies, roles and emails', async () => {
  const dom = await listPage();
  const search = dom.window.document.getElementById('participantSearch');

  search.value = 'goodspace';
  search.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  assert.deepEqual([...dom.window.document.querySelectorAll('.participant-name')].map((node) => node.textContent), ['Vinay Pasricha']);
  assert.equal(dom.window.document.getElementById('participantSearchCount').textContent, '1 of 3 participants');

  search.value = 'managing director';
  search.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  assert.deepEqual([...dom.window.document.querySelectorAll('.participant-name')].map((node) => node.textContent), ['Arvind Rao']);

  search.value = 'gaurav@example.com';
  search.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  assert.deepEqual([...dom.window.document.querySelectorAll('.participant-name')].map((node) => node.textContent), ['Gaurav Shah']);
  dom.window.close();
});

test('clearing participant search restores the alphabetical list', async () => {
  const dom = await listPage();
  const search = dom.window.document.getElementById('participantSearch');
  search.value = 'missing person';
  search.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  assert.match(dom.window.document.getElementById('rows').textContent, /No participants match/);

  dom.window.document.getElementById('participantSearchClear').click();
  assert.deepEqual(
    [...dom.window.document.querySelectorAll('.participant-name')].map((node) => node.textContent),
    ['Arvind Rao', 'Gaurav Shah', 'Vinay Pasricha'],
  );
  dom.window.close();
});
