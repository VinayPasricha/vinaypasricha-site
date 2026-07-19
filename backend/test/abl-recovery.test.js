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
import { candidateWebsiteUrls, extractWebsiteText, isPrivateAddress, officialWebsiteUrl } from '../src/abl/website.js';

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

test('both course runtimes require five editable answer options', () => {
  const prompts = [
    buildSivSystem({ participant, research: null, session, crossContext: '' }),
    buildVedSystem({ participant, research: null, session, crossContext: '' }),
  ];
  for (const prompt of prompts) {
    assert.match(prompt, /exactly FIVE distinct/);
    assert.match(prompt, /strongest context-grounded recommendation first/);
    assert.match(prompt, /Something else — let me explain/);
    assert.match(prompt, /Never use placeholders such as X, Y, TBD/);
    assert.match(prompt, /Ask exactly one substantive question/);
  }
});

test('official website fallback blocks private networks and accepts a public domain', () => {
  assert.equal(isPrivateAddress('127.0.0.1'), true);
  assert.equal(isPrivateAddress('169.254.169.254'), true);
  assert.equal(isPrivateAddress('10.20.30.40'), true);
  assert.equal(isPrivateAddress('192.168.1.20'), true);
  assert.equal(isPrivateAddress('8.8.8.8'), false);
  assert.equal(officialWebsiteUrl('localhost'), null);
  assert.equal(officialWebsiteUrl('169.254.169.254'), null);
  assert.equal(officialWebsiteUrl('goodspace.ai').href, 'https://goodspace.ai/');
});

test('official website fallback extracts readable content and removes scripts', () => {
  const text = extractWebsiteText('<html><head><title>GoodSpace</title><meta name="description" content="AI recruitment"></head><body><script>ignore me</script><h1>Hire faster</h1><p>AI sourcing and interviews.</p></body></html>');
  assert.match(text, /GoodSpace/);
  assert.match(text, /AI recruitment/);
  assert.match(text, /AI sourcing and interviews/);
  assert.doesNotMatch(text, /ignore me/);
});

test('official website fallback prioritises same-domain about and employer pages', () => {
  const html = '<a href="/jobs/123">Job</a><a href="https://elsewhere.example/about">Other</a><a href="/about-us">About Us</a><a href="/hirer">Looking to hire?</a><a href="/privacy">Privacy</a>';
  assert.deepEqual(candidateWebsiteUrls(html, 'https://goodspace.ai/'), [
    'https://goodspace.ai/about-us',
    'https://goodspace.ai/hirer',
  ]);
});
