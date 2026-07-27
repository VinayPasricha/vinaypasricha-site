import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const course = read('ai-business-leaders/course.js');
const shell = read('ai-business-leaders/course.html');
const routes = read('backend/src/abl/routes.js');
const studio = read('studio/ai-business-leaders.js');
const store = read('backend/src/abl/store.js');
const firestore = read('backend/src/firestore.js');

const sessionBlocks = [...course.matchAll(/^\s{4}(\d): \[\n([\s\S]*?)^\s{4}\](?:,|\n)/gm)];
assert.equal(sessionBlocks.length, 5, 'all five participant sessions are defined');

const fieldKeys = sessionBlocks.flatMap(([, , body]) =>
  [...body.matchAll(/\b(?:f|select|checks|matrix|group|evidence)\('([^']+)'/g)].map((m) => m[1])
);
assert.equal(fieldKeys.length, 49, 'the manual’s 49 top-level Builder fields are present');
assert.equal(new Set(fieldKeys).size, 49, 'Builder field keys are unique');

[
  'Beyond Personal Productivity',
  'Find the Leverage',
  'Redesign the Work',
  'Redesign for Reality',
  'Defend and Commit',
  'Continue without completing this',
  'Data-safety rule',
  'Company Brain',
  'Create my 90-day charter',
].forEach((text) => assert.ok(course.includes(text), `participant workspace includes “${text}”`));

[
  'Build / Buy / Partner and economics',
  'Capability retained',
  'Owner and team',
  'Days 1–15 · Diagnose',
  'Days 16–30 · Design',
  'Days 31–75 · Build and Run',
  'Days 76–90 · Decide',
  'Scale if:',
  'Fix if:',
  'Stop if:',
  '<!-- pagebreak -->',
].forEach((text) => assert.ok(routes.includes(text), `charter includes “${text}”`));

assert.ok(routes.includes("content_json: {") && routes.includes("sessions: (builder && builder.sessions) || {}"),
  'generated output retains its structured Builder evidence');
assert.ok(routes.includes("doc.addPage()"), 'server PDF starts the charter on a new page');
assert.ok(routes.includes("class=\"page-break\"") && routes.includes("page-break-before:always"),
  'printable output enforces the second-page break');

[
  'Complete Builder evidence · all five sessions',
  'Four pilot tests',
  'Build / Buy / Partner',
  'Economics',
  'Owner and team',
  'Day-30 review date',
].forEach((text) => assert.ok(studio.includes(text), `Studio includes “${text}”`));

assert.ok(store.includes('getBuilder') && store.includes('upsertBuilder'), 'Builder persistence is wired');
assert.ok(firestore.includes('ablBuilders'), 'Builder collection is environment-isolated');
assert.ok(shell.includes('meta name="robots" content="noindex, nofollow"'), 'participant workspace is excluded from search indexing');

console.log(`AI for Business Leaders course checks passed: ${fieldKeys.length} fields, 5 sessions, complete charter and Studio evidence.`);
