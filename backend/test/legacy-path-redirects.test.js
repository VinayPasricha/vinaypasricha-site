import test from 'node:test';
import assert from 'node:assert/strict';

// Original numbered conversation pages, still labeled "Path NN" on the live
// pages. /pages/pathN.html and /pages/pathN never existed as files; they 301
// to the current path that carries that number.
const LEGACY = {
  1: '/paths/ai-for-business',
  2: '/paths/decisions',
  3: '/paths/execute',
  4: '/paths/evolve',
  5: '/paths/hire',
  6: '/paths/find-work',
  7: '/paths/career',
  8: '/paths/connect',
  9: '/paths/blog',
  10: '/paths/course',
  11: '/paths/story',
  12: '/paths/fiction',
};

test('legacy /pages/pathN.html URLs 301 to the numbered path pages', async () => {
  const { createApp } = await import('../src/app.js');
  const app = createApp();
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const [n, dest] of Object.entries(LEGACY)) {
      for (const suffix of ['.html', '']) {
        const res = await fetch(`${base}/pages/path${n}${suffix}`, { redirect: 'manual' });
        assert.equal(res.status, 301, `/pages/path${n}${suffix}`);
        assert.equal(res.headers.get('location'), dest);
      }
    }

    const withQuery = await fetch(base + '/pages/path6.html?lang=hi', { redirect: 'manual' });
    assert.equal(withQuery.status, 301);
    assert.equal(withQuery.headers.get('location'), '/paths/find-work?lang=hi');

    const padded = await fetch(base + '/pages/path06', { redirect: 'manual' });
    assert.equal(padded.status, 301);
    assert.equal(padded.headers.get('location'), '/paths/find-work');

    const target = await fetch(base + '/paths/find-work', { redirect: 'manual' });
    assert.equal(target.status, 200);
    assert.match(await target.text(), /Path 06/);

    const unknownHtml = await fetch(base + '/pages/path99.html', { redirect: 'manual' });
    assert.equal(unknownHtml.status, 301);
    assert.equal(unknownHtml.headers.get('location'), '/pages/path99');
    const unknown = await fetch(base + '/pages/path99', { redirect: 'manual' });
    assert.equal(unknown.status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
