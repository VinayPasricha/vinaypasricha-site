import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractTranscript,
  normaliseTranscriptAnalysis,
  relevantTranscriptPassages,
  supportedTranscriptFile,
  transcriptSummaryMarkdown,
} from '../src/abl/transcripts.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('meeting transcripts accept the four promised file formats', () => {
  ['meeting.txt', 'meeting.md', 'meeting.docx', 'meeting.pdf'].forEach((name) => assert.equal(supportedTranscriptFile(name), true));
  assert.equal(supportedTranscriptFile('meeting.exe'), false);
});

test('pasted transcripts are cleaned and bounded before analysis', async () => {
  const result = await extractTranscript({ transcript_text: 'Vinay: What is the priority?\r\nLeader: Faster customer reporting without extra manual work.' });
  assert.match(result.text, /Faster customer reporting/);
  assert.equal(result.truncated, false);
});

test('structured analysis produces the complete Course Memory summary', () => {
  const analysis = normaliseTranscriptAnalysis({
    overview: 'The leader wants faster exception reporting.',
    actions: [{ owner: 'Priya', action: 'Map the current workflow', due: 'next Friday' }],
    decisions: ['Start with operations'], open_questions: ['Which region reports first?'],
    company_context: ['Industrial distributor'], business_challenges: ['Late reports'],
    course_objectives: ['Choose one pilot'], ai_opportunities: ['Exception alerts'],
    concerns_constraints: ['Fragmented data'],
  });
  const summary = transcriptSummaryMarkdown(analysis);
  ['Meeting overview', 'Who does what next', 'Decisions', 'Open questions', 'Company context', 'Business challenges', 'Course objectives', 'AI opportunities', 'Concerns and constraints'].forEach((heading) => assert.match(summary, new RegExp(heading)));
  // An action is only useful if it carries its owner and any stated date.
  assert.match(summary, /\*\*Priya\*\* — Map the current workflow · _next Friday_/);
});

test('an action survives however the model phrased it, and is never listed twice', () => {
  const analysis = normaliseTranscriptAnalysis({
    // The pre-owner shape: summaries stored before actions carried an owner.
    commitments: ['Send the book to the participant'],
    next_actions: ['send the book to the participant', 'Book the training session'],
  });
  assert.equal(analysis.actions.length, 2);
  assert.equal(analysis.actions[0].action, 'Send the book to the participant');
  assert.equal(analysis.actions[0].owner, '');
});

test('a meeting that settled nothing says so instead of padding', () => {
  const summary = transcriptSummaryMarkdown({ overview: 'An introductory call.' });
  assert.match(summary, /Nothing was agreed as an action in this meeting/);
  assert.match(summary, /Nothing was settled in this meeting/);
  // Empty context sections are omitted rather than filled with placeholders.
  assert.doesNotMatch(summary, /## Company context/);
});

test('only relevant passages from shared transcripts are retrieved', () => {
  const passages = relevantTranscriptPassages([
    { title: 'One-on-one', visibility: 'course_memory', raw_transcript: 'The monthly customer report takes four days because data is collected manually from six regions.\n\nThe hiring plan is otherwise stable.' },
    { title: 'Unapproved draft', visibility: 'course_memory', review_status: 'draft', raw_transcript: 'Customer reporting takes nine days and this unapproved draft must not be used.' },
    { title: 'Private note', visibility: 'private', raw_transcript: 'Customer reporting is confidential here and must never be returned.' },
  ], 'How can we improve customer reporting?');
  assert.equal(passages.length, 1);
  assert.match(passages[0].passage, /four days/);
});

test('admin UI offers transcript processing inside the existing participant record', () => {
  const ui = readFileSync(path.join(root, 'studio', 'ai-business-leaders.js'), 'utf8');
  const routes = readFileSync(path.join(root, 'backend', 'src', 'abl', 'routes.js'), 'utf8');
  assert.match(ui, /Participant context — meetings &amp; transcripts/);
  assert.match(ui, /Create draft summary/);
  assert.match(ui, /Approve for course AI/);
  assert.match(ui, /Also share this summary with the participant/);
  assert.match(ui, /Edit summary/);
  assert.match(ui, /\.txt,\.md,\.docx,\.pdf/);
  assert.ok(ui.indexOf('2 · Participant page &amp; private link') < ui.indexOf('3 · Participant context — meetings &amp; transcripts'));
  assert.match(ui, /A first-agent conversation is not required/);
  assert.match(routes, /participants\/:id\/transcripts/);
  assert.match(routes, /analyseTranscript/);
  assert.match(routes, /notes\/:noteId\/approve/);
  assert.match(routes, /review_status: 'draft'/);
  assert.match(routes, /review_status: 'approved'/);
  assert.match(routes, /app\.patch\('\/api\/abl\/participants\/:id\/notes\/:noteId'/);
});

test('participant memory hides meeting summaries unless the admin explicitly shares them', () => {
  const memory = readFileSync(path.join(root, 'backend', 'src', 'abl', 'memory.js'), 'utf8');
  assert.match(memory, /if \(agentContext\) return approved && note\.visibility === 'course_memory'/);
  assert.match(memory, /return approved && note\.share_with_participant === true/);
});
