import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const base = String(process.env.ABL_STAGING_BASE_URL || '').replace(/\/$/, '');
assert.ok(base.startsWith('https://'), 'ABL_STAGING_BASE_URL must be an https URL');

const chromeCandidates = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);
const executablePath = chromeCandidates.find(existsSync);
assert.ok(executablePath, `Chrome was not found in: ${chromeCandidates.join(', ')}`);

mkdirSync('artifacts', { recursive: true });
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

async function openPreview(viewport, name) {
  const context = await browser.newContext({
    viewport,
    isMobile: viewport.width <= 600,
    hasTouch: viewport.width <= 600,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto(`${base}/ai-business-leaders/focused-workspace-preview?browserAudit=${Date.now()}`, {
    waitUntil: 'networkidle',
    timeout: 45000,
  });
  await page.locator('.focus-command').waitFor({ state: 'visible', timeout: 15000 });

  const visibleText = await page.locator('body').innerText();
  assert.ok(visibleText.includes('Do this now'), `${name}: focused next action must be visible`);
  assert.ok(!visibleText.includes('Vinay Studio'), `${name}: private Studio label must not be visible`);
  assert.equal(await page.locator('#studioMode').isVisible(), false, `${name}: Studio control must be hidden`);

  const dimensions = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  assert.ok(dimensions.scrollWidth <= dimensions.innerWidth + 2, `${name}: page must not create horizontal viewport overflow`);

  await page.screenshot({ path: `artifacts/${name}.png`, fullPage: true });
  return { context, page };
}

for (const width of [360, 390]) {
  const name = `abl-staging-mobile-${width}`;
  const { context, page } = await openPreview({ width, height: 844 }, name);

  const menu = page.locator('#workspaceMenuToggle');
  await menu.waitFor({ state: 'visible' });
  assert.equal(await menu.getAttribute('aria-expanded'), 'false', `${name}: menu starts closed`);

  await menu.click();
  await page.waitForFunction(() => document.body.classList.contains('participant-menu-open'));
  assert.equal(await menu.getAttribute('aria-expanded'), 'true', `${name}: menu reports open state`);
  assert.equal(await page.locator('#side').isVisible(), true, `${name}: navigation drawer is visible`);
  assert.equal(await page.locator('#participantDrawerOverlay').isVisible(), true, `${name}: drawer overlay is visible`);

  const assignmentsNav = page.locator('#side .nav').filter({ hasText: 'Assignments' });
  await assignmentsNav.click();
  await page.locator('main h1').filter({ hasText: 'Assignments' }).waitFor({ state: 'visible' });
  assert.equal(await page.locator('body').evaluate((body) => body.classList.contains('participant-menu-open')), false, `${name}: choosing a page closes the drawer`);

  const back = page.locator('#workspaceHomeReturn');
  await back.waitFor({ state: 'visible' });
  await back.click();
  await page.locator('.focus-command').waitFor({ state: 'visible' });

  await menu.click();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('body').evaluate((body) => body.classList.contains('participant-menu-open')), false, `${name}: Escape closes the drawer`);

  await context.close();
}

{
  const { context, page } = await openPreview({ width: 1280, height: 900 }, 'abl-staging-desktop');
  assert.equal(await page.locator('#workspaceMenuToggle').isVisible(), false, 'desktop: mobile menu must be hidden');
  assert.equal(await page.locator('#side').isVisible(), true, 'desktop: navigation remains visible');
  assert.equal(await page.locator('.participant-only-mark').isVisible(), true, 'desktop: participant workspace control is visible');
  await context.close();
}

await browser.close();
console.log('Deployed staging browser audit passed at 360 px, 390 px and desktop: focused home, private Studio, drawer navigation and return path.');
