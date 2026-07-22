import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  decodeParticipantAsset,
  extractParticipantAssetText,
  extractableParticipantAsset,
  participantAssetMime,
  supportedParticipantAsset,
} from '../src/abl/assets.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('participant assets accept common business documents and images', () => {
  ['brief.pdf', 'notes.docx', 'legacy.doc', 'deck.pptx', 'data.xlsx', 'table.csv', 'photo.png'].forEach((name) => {
    assert.equal(supportedParticipantAsset(name), true);
  });
  assert.equal(supportedParticipantAsset('program.exe'), false);
  assert.equal(extractableParticipantAsset('brief.pdf'), true);
  assert.equal(extractableParticipantAsset('notes.docx'), true);
  assert.equal(extractableParticipantAsset('deck.pptx'), false);
  assert.equal(participantAssetMime('brief.pdf'), 'application/pdf');
});

test('text assets are decoded and prepared for private AI context', async () => {
  const buffer = decodeParticipantAsset(Buffer.from('A participant-submitted operating note with enough meaningful context for the course AI.').toString('base64'));
  const extracted = await extractParticipantAssetText('operating-note.txt', buffer);
  assert.equal(extracted.extractable, true);
  assert.match(extracted.text, /operating note/);
});

test('studio creates the participant page before meetings and assets', () => {
  const ui = readFileSync(path.join(root, 'studio', 'ai-business-leaders.js'), 'utf8');
  const routes = readFileSync(path.join(root, 'backend', 'src', 'abl', 'routes.js'), 'utf8');
  assert.ok(ui.indexOf('2 · Participant page &amp; private link') < ui.indexOf('3 · Participant context — meetings &amp; transcripts'));
  assert.ok(ui.indexOf('3 · Participant context — meetings &amp; transcripts') < ui.indexOf('4 · Participant assets'));
  assert.match(ui, /first-agent interaction is optional/);
  assert.match(ui, /Upload participant asset/);
  assert.match(ui, /Approve for course AI/);
  assert.match(routes, /participants\/:id\/assets/);
  assert.match(routes, /Generate the participant page and link before adding files/);
});

test('approved participant assets are included only in agent context', () => {
  const memory = readFileSync(path.join(root, 'backend', 'src', 'abl', 'memory.js'), 'utf8');
  assert.match(memory, /asset\.review_status === 'approved'/);
  assert.match(memory, /asset\.visibility === 'course_memory'/);
  assert.match(memory, /participant_assets: approvedAssets/);
});
