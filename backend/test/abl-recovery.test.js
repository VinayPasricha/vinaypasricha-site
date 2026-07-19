import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTEXT_RECOVERY_POLICY,
  detectCompanyRecovery,
  domainFromText,
  roleFromText,
} from '../src/abl/recovery.js';
import { buildConversationSystem } from '../src/abl/prompts.js';
import { buildSivSystem, buildVedSystem } from '../src/abl/course-runtimes.js';

const participant = {
  name: 'Preview Participant',
  company_name: 'Incorrect Placeholder',
  role_title: 'Course Builder',
  max_messages: 200,
  message_count: 0,
};
const session = { selected_depth: 'fast', running_summary: null };

test('extracts an official domain and corrected leadership role', () => {
  const text = 'No, I am the founder of goodspace.ai — please read my website.';
  assert.equal(domainFromText(text), 'goodspace.ai');
  assert.equal(roleFromText(text), 'Founder');
  assert.deepEqual(detectCompanyRecovery(text), {
    triggered: true,
    shouldResearch: true,
    domain: 'goodspace.ai',
    roleTitle: 'Founder',
    reason: 'identity_correction',
  });
});

test('uses a recently supplied domain when the next turn asks to read the website', () => {
  const result = detectCompanyRecovery('Go and read the website first, please.', [
    { role: 'user', content: 'I am the founder of goodspace.ai.' },
  ]);
  assert.equal(result.triggered, true);
  assert.equal(result.shouldResearch, true);
  assert.equal(result.domain, 'goodspace.ai');
  assert.equal(result.roleTitle, 'Founder');
  assert.equal(result.reason, 'website_request');
});

test('does not mistake an ordinary software-domain mention for an identity correction', () => {
  const result = detectCompanyRecovery('We currently use salesforce.com as our CRM.');
  assert.equal(result.triggered, false);
  assert.equal(result.shouldResearch, false);
});

test('rejecting company context without a domain triggers a safe clarification', () => {
  const result = detectCompanyRecovery("That's not what our company does.");
  assert.equal(result.triggered, true);
  assert.equal(result.shouldResearch, false);
  assert.equal(result.reason, 'context_rejected');
});

test('a bare domain completes a correction requested on the prior turn', () => {
  const result = detectCompanyRecovery('goodspace.ai', [
    { role: 'user', content: "That's not what our company does." },
  ]);
  assert.equal(result.triggered, true);
  assert.equal(result.shouldResearch, true);
  assert.equal(result.domain, 'goodspace.ai');
  assert.equal(result.reason, 'domain_supplied');
});

test('all three agent prompts share the same anti-hallucination recovery policy', () => {
  const prompts = [
    buildConversationSystem({ participant, research: null, session }),
    buildSivSystem({ participant, research: null, session, crossContext: '' }),
    buildVedSystem({ participant, research: null, session, crossContext: '' }),
  ];
  for (const prompt of prompts) {
    assert.ok(prompt.includes(CONTEXT_RECOVERY_POLICY));
    assert.match(prompt, /Say you reviewed, searched, checked or visited a website ONLY/);
    assert.match(prompt, /Ask exactly ONE primary question per reply/);
  }
});
