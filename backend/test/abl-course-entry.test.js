import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');

test('homepage course banner uses approved copy and passwordless entry', () => {
  const html = read('index.html');
  assert.match(html, /AI for Business Leaders/);
  assert.match(html, /Build Your Company Brain\. Lead AI with Clarity\./);
  assert.match(html, /A practical five-week journey to identify your weakest execution link/);
  assert.match(html, /Five weeks · Five practical wins · One 90-Day Blueprint/);
  assert.match(html, /Enter Your Course Workspace/);
  assert.match(html, /href="\/ai-business-leaders\/login" data-course-entry/);
  assert.match(html, /opm-course-book-button/);
  assert.match(html, /ai-for-business-leaders-book-button\.png/);
  assert.doesNotMatch(html, /opm-course-wordmark|The Company Brain/);
  assert.doesNotMatch(html, /ai-business-leaders-opm-classroom/);
  assert.doesNotMatch(html, /Second Edition/);
});

test('all participant experiences load the shared access client', () => {
  ['workspace.html', 'session.html', 'course-runtime.html'].forEach((file) => {
    assert.match(read('ai-business-leaders/' + file), /auth-client\.js/);
  });
});

test('login asks for the pre-registered email and one-time code', () => {
  const html = read('ai-business-leaders/login.html');
  const js = read('ai-business-leaders/login.js');
  assert.match(html, /id="loginWelcome">Welcome to your/);
  assert.doesNotMatch(html, /id="loginWelcome">Welcome back/);
  assert.match(js, /abl_has_signed_in_v1/);
  assert.match(js, /Welcome back to your <em>AI leadership journey\.<\/em>/);
  assert.match(js, /rememberParticipant\(\)/);
  assert.match(html, /Enter the email you gave us/);
  assert.match(html, /six-digit sign-in code/i);
  assert.match(html, /autocomplete="one-time-code"/);
  assert.match(html, /another computer or phone/i);
  assert.match(html, /same course email/i);
  assert.match(html, /saved work will still be here/i);
  assert.match(js, /Approved email confirmed\. Opening your course workspace/);
  assert.match(js, /verifyAndEnter\(result\.data\.preview_code/);
});

test('unknown course emails receive Vinay access instructions', () => {
  const routes = read('backend/src/abl/routes.js');
  assert.match(routes, /This email is not registered for the course\. Please contact Vinay at Vinay@goodspace\.ai to get access\./);
  assert.match(routes, /email === 'vinay@wlci\.in'/);
});
