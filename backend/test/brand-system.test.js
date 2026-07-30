import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const read = (file) => readFile(path.join(root, file), "utf8");

async function htmlPages(directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const pages = [];

  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(root, absolute);
    if (
      relative.startsWith("_explorations") ||
      relative.startsWith(path.join("library", "civilization", "source")) ||
      relative === path.join("library", "civilization", "cover-standalone.html") ||
      relative.split(path.sep).some((segment) =>
        [".git", "node_modules"].includes(segment)
      )
    ) {
      continue;
    }
    if (entry.isDirectory()) pages.push(...(await htmlPages(absolute)));
    if (entry.isFile() && entry.name.endsWith(".html")) pages.push(relative);
  }

  return pages;
}

test("every published HTML page uses the brand icons and social card", async () => {
  const pages = await htmlPages();
  const expected = [
    '/assets/images/brand/favicon-32.png',
    '/assets/images/brand/favicon-16.png',
    '/assets/images/brand/apple-touch-icon.png',
    'https://vinaypasricha.com/assets/images/brand/og-image.png',
    'property="og:image:width" content="1200"',
    'property="og:image:height" content="630"',
  ];

  for (const page of pages) {
    const html = await read(page);
    if (!/<head(?:\s[^>]*)?>/i.test(html)) continue;
    for (const value of expected) {
      assert.ok(html.includes(value), `${page} is missing ${value}`);
    }
    assert.doesNotMatch(
      html,
      /(?:og:image|twitter:image)[^>]+vinay-avatar\.png/i,
      `${page} still uses the portrait as a share card`
    );
  }
});

test("homepage conversations carry only the specified spectrum accents", async () => {
  // The redesigned homepage renders the same twelve conversations as cards and
  // styles them from its own stylesheet, so read that alongside site.css.
  const [html, base, redesign] = await Promise.all([
    read("index.html"),
    read("css/site.css"),
    read("css/home-redesign.css"),
  ]);
  const css = `${base}\n${redesign}`;
  const spectrum = [
    "#e11431",
    "#c9133a",
    "#b3123f",
    "#c61a74",
    "#d922a8",
    "#aa26be",
    "#7a2bd4",
    "#4f39da",
    "#2447e0",
    "#296aef",
    "#2e8eff",
    "#3d9bff",
  ];

  // Twelve conversations, one per spectrum step, however they are laid out.
  assert.equal((html.match(/class="conversation-card/g) || []).length, 12);
  spectrum.forEach((color) => assert.ok(css.includes(color), `missing ${color}`));
  // The accent belongs to the card and its leading number, never to the quote.
  assert.match(css, /\.conversation-card:hover/);
  assert.match(css, /\.conversation-card:hover \.card-top/);
  assert.doesNotMatch(css, /\.conversation-card:hover q/);
});

test("amber hairlines pulse once and respect reduced motion", async () => {
  const [html, css, source] = await Promise.all([
    read("index.html"),
    read("css/site.css"),
    read("js/site.js"),
  ]);

  // Four amber hairlines, now carried by the section itself rather than a
  // dedicated divider element.
  assert.equal((html.match(/pulse-divider/g) || []).length, 4);
  assert.match(css, /rgba\(255,\s*167,\s*38,\s*\.35\)/);
  assert.match(css, /rgba\(255,\s*167,\s*38,\s*\.9\)/);
  assert.match(css, /animation:\s*amber-divider-sweep 1\.2s/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(source, /new IntersectionObserver/);
  assert.match(source, /dividerObserver\.unobserve\(entry\.target\)/);
  assert.match(source, /prefers-reduced-motion:\s*reduce/);
});
