import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const studio = readFileSync(path.join(root, 'studio', 'ai-business-leaders.js'), 'utf8');
const routes = readFileSync(path.join(root, 'backend', 'src', 'abl', 'routes.js'), 'utf8');
const service = readFileSync(path.join(root, 'backend', 'src', 'abl', 'service.js'), 'utf8');
const store = readFileSync(path.join(root, 'backend', 'src', 'abl', 'store.js'), 'utf8');

test('clicking a participant opens a dedicated Studio dossier URL', () => {
  assert.match(studio, /\/studio\/ai-business-leaders\?participant=/);
  assert.match(studio, /Participant Admin Snapshot/);
  assert.match(studio, /← All participants/);
});

test('the admin snapshot synthesises every participant evidence stream', () => {
  ['research', 'course_memory', 'meetings', 'uploaded_assets', 'agent_conversations', 'generated_outputs']
    .forEach((source) => assert.match(service, new RegExp(source)));
  assert.match(service, /Recommended next admin action/);
  assert.match(service, /under 750 words/);
  assert.match(routes, /participants\/:id\/admin-snapshot/);
});

test('the participant dossier exposes complete agent conversation history to admins', () => {
  assert.match(store, /export async function listSessions/);
  assert.match(routes, /messages: \(await repo\.listMessages/);
  assert.match(studio, /Agent conversations/);
  assert.match(studio, /Reports &amp; generated outputs/);
  assert.match(studio, /Course Memory/);
});

test('the dedicated participant view renders its snapshot and evidence without the participant list', async () => {
  const html = readFileSync(path.join(root, 'studio', 'ai-business-leaders.html'), 'utf8');
  const dom = new JSDOM(html, {
    url: 'https://example.test/studio/ai-business-leaders?participant=p1',
    runScripts: 'outside-only',
  });
  dom.window.requestAnimationFrame = (fn) => fn();
  dom.window.HTMLElement.prototype.scrollIntoView = function () {};
  dom.window.fetch = async (url) => {
    const data = String(url).endsWith('/participants/p1') ? {
      participant: { id: 'p1', name: 'Asha', company_name: 'Example Co', status: 'active', slug: 'example-co' },
      research: { structured_context: { pressures: 'Slow reporting' }, research_dossier: 'Verified company context.' },
      memory: { fields: { challenges: 'Slow reporting', selected_project: 'Exception alerts' } },
      notes: [{ id: 'n1', title: 'One-on-one', content: 'Agreed to map the workflow.', review_status: 'approved', occurred_at: '2026-07-20T12:00:00Z' }],
      assets: [{ id: 'a1', title: 'Process note', file_name: 'process.pdf', byte_size: 1024, extraction_status: 'extracted', extracted_text: 'Process evidence', review_status: 'approved' }],
      conversations: [{ id: 's1', mode: 'ved', current_stage: 'constraint', messages: [
        { role: 'user', content: 'Reporting is delayed.' }, { role: 'assistant', content: 'What creates the delay?' },
      ] }],
      outputs: [{ id: 'o1', output_type: 'admin_participant_snapshot', content_markdown: '## Where we are now\n- Reporting is the current focus.', updated_at: '2026-07-22T12:00:00Z' }],
      snapshot_stale: false,
    } : [];
    return { ok: true, status: 200, json: async () => ({ ok: true, data }) };
  };
  dom.window.eval(studio);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(dom.window.document.getElementById('listView').style.display, 'none');
  assert.match(dom.window.document.getElementById('detail').textContent, /Participant Admin Snapshot/);
  assert.match(dom.window.document.getElementById('detail').textContent, /Reporting is the current focus/);
  assert.match(dom.window.document.getElementById('detail').textContent, /Agent conversations/);
  dom.window.close();
});
