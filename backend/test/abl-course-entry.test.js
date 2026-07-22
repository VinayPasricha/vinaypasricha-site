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
  assert.match(html, /An Exclusive Course for Harvard OPM Alumni/);
  assert.match(html, /Enter Your Course Workspace/);
  assert.match(html, /href="\/ai-business-leaders\/login" data-course-entry/);
});

test('all participant experiences load the shared access client', () => {
  ['workspace.html', 'session.html', 'course-runtime.html'].forEach((file) => {
    assert.match(read('ai-business-leaders/' + file), /auth-client\.js/);
  });
});

test('login asks for the pre-registered email and one-time code', () => {
  const html = read('ai-business-leaders/login.html');
  assert.match(html, /Enter the email you gave us/);
  assert.match(html, /six-digit sign-in code/i);
  assert.match(html, /autocomplete="one-time-code"/);
});
