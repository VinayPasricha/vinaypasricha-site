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
    company_context: ['Industrial distributor'], business_challenges: ['Late reports'],
    course_objectives: ['Choose one pilot'], ai_opportunities: ['Exception alerts'],
    decisions: ['Start with operations'], concerns_constraints: ['Fragmented data'],
    commitments: ['Name an owner'], next_actions: ['Map the current workflow'],
  });
  const summary = transcriptSummaryMarkdown(analysis);
  ['Meeting overview', 'Company context and corrections', 'Main business challenges', 'Course objectives', 'Possible AI opportunities', 'Decisions made', 'Concerns and constraints', 'Commitments', 'Next actions'].forEach((heading) => assert.match(summary, new RegExp(heading)));
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
