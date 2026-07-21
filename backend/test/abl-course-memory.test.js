import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { buildConversationSystem } from '../src/abl/prompts.js';
import { buildContinuingSystem, buildSivSystem, COURSE_RUNTIME_MODES } from '../src/abl/course-runtimes.js';
import { advanceStage, sanitiseMemoryFields, validStage } from '../src/abl/memory.js';

const participant = { id: 'p1', name: 'Leader', company_name: 'Example Co', role_title: 'CEO', max_messages: 200, message_count: 0 };
const research = { structured_context: { products: 'Industrial systems', customers: 'Enterprise buyers' } };

test('all conversation prompts write explicit milestones and shared memory', () => {
  const journey = buildConversationSystem({ participant, research, session: { selected_depth: '30' }, courseMemory: 'Confirmed priority: cycle time' });
  const siv = buildSivSystem({ participant, research, session: { selected_depth: 'fast' }, crossContext: 'VED constraint: delayed handoffs' });
  const ongoing = buildContinuingSystem({ participant, research, session: {}, crossContext: 'First project: exception reporting' });
  assert.match(journey, /"stage": "current milestone id"/);
  assert.match(journey, /Confirmed priority: cycle time/);
  assert.match(siv, /selection_mode":"multi"/);
  assert.match(siv, /Company Brain weakness/);
  assert.match(siv, /baseline, 90-day target/);
  assert.match(ongoing, /never make them repeat established context/i);
  assert.match(ongoing, /ONE next move/);
});

test('Company Brain is included even in the fast and standard SIV depths', () => {
  for (const depth of ['fast', 'standard']) {
    const prompt = buildSivSystem({ participant, research, session: { selected_depth: depth }, crossContext: '' });
    assert.match(prompt, /Company Brain — Does this strengthen Memory, Reasoning, Action or Feedback/);
  }
  assert.equal(COURSE_RUNTIME_MODES.siv.depths[0].lensCount, 8);
  assert.equal(COURSE_RUNTIME_MODES.siv.depths[1].lensCount, 13);
});

test('memory accepts only bounded course fields and known stages', () => {
  assert.deepEqual(sanitiseMemoryFields({ selected_project: 'Exception radar', unknown: 'discard', candidate_projects: ['A', '', 'B'] }), {
    selected_project: 'Exception radar', candidate_projects: ['A', 'B'],
  });
  assert.equal(validStage('siv', 'company_brain'), 'company_brain');
  assert.equal(validStage('siv', 'made_up'), null);
  assert.equal(advanceStage('ved', 'constraint', 'sequence'), 'constraint');
  assert.equal(advanceStage('ved', 'constraint', 'correction'), 'correction');
});

test('participant UI contains multi-select, Course Memory, blueprint and continuing journey controls', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(here, '..', '..');
  const runtime = readFileSync(path.join(root, 'ai-business-leaders', 'course-runtime.js'), 'utf8');
  const workspace = readFileSync(path.join(root, 'ai-business-leaders', 'workspace.js'), 'utf8');
  assert.match(runtime, /data-multi-continue/);
  assert.match(runtime, /selection_mode === 'multi'/);
  assert.match(workspace, /Shared Course Memory/);
  assert.match(workspace, /90-Day AI Leadership Blueprint/);
  assert.match(workspace, /Continue my AI journey/);
});

test('SIV candidate choices support real multi-selection before one submitted turn', async () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(here, '..', '..');
  const source = readFileSync(path.join(root, 'ai-business-leaders', 'course-runtime.js'), 'utf8');
  const dom = new JSDOM('<a id="workspaceLink"></a><main id="courseRuntime"></main>', {
    url: 'https://example.test/ai-business-leaders/workspace/demo/siv', runScripts: 'outside-only',
  });
  const submitted = [];
  let started = false;
  dom.window.requestAnimationFrame = (fn) => fn();
  dom.window.HTMLElement.prototype.scrollIntoView = function () {};
  dom.window.fetch = async (_url, init = {}) => {
    const method = init.method || 'GET';
    if (method === 'GET') return response({
      mode: 'siv', config: { title: 'SIV', intro: 'Intro', button: 'Begin', reportTitle: 'Report', depths: [{ id: 'standard', title: 'Standard', minutes: '20 min', lensCount: 13, blurb: 'Best', recommended: true }] },
      participant: { name: 'Leader', company_name: 'Example Co', role_title: 'CEO' },
      started: false, messages: [], message_count: 0, max_messages: 200,
    });
    if (!started) {
      started = true;
      return response({ started: true, depth: 'standard', reply: 'Which areas?', options: ['Sales', 'Operations', 'Hiring', 'Reporting', 'Something else — let me explain.'], selection_mode: 'multi' });
    }
    submitted.push(JSON.parse(init.body).message);
    return response({ reply: 'What outcome matters?', options: ['Revenue', 'Speed', 'Quality', 'A combination', 'Something else — let me explain.'], selection_mode: 'single', message_count: 1, max_messages: 200 });
  };
  function response(data) { return { ok: true, json: async () => ({ ok: true, data }) }; }
  dom.window.eval(source);
  await tick();
  dom.window.document.getElementById('startRuntime').click();
  await tick();
  const choices = dom.window.document.querySelectorAll('[data-answer-option]');
  assert.equal(choices.length, 5);
  choices[0].click();
  choices[1].click();
  assert.match(dom.window.document.querySelector('[data-multi-continue]').textContent, /2 selected/);
  dom.window.document.querySelector('[data-multi-continue]').click();
  await tick();
  assert.equal(submitted.length, 1);
  assert.match(submitted[0], /Sales/);
  assert.match(submitted[0], /Operations/);
  dom.window.close();
});

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
