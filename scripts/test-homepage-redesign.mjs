import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const read = (relative) => readFile(path.join(root, relative), "utf8");

async function htmlPages(directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const pages = [];
  for (const entry of entries) {
    if ([".git", "node_modules", "_explorations"].includes(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(root, absolute);
    if (
      relative.startsWith(path.join("library", "civilization", "source")) ||
      relative === path.join("library", "civilization", "cover-standalone.html")
    ) {
      continue;
    }
    if (entry.isDirectory()) pages.push(...(await htmlPages(absolute)));
    if (entry.isFile() && entry.name.endsWith(".html")) pages.push(absolute);
  }
  return pages;
}

test("homepage contains every redesigned section and the requested grouping", async () => {
  const html = await read("index.html");
  for (const id of ["logo3d", "bookshelf", "paths", "notebook"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  for (const group of ["Build", "Decide &amp; Act", "Work &amp; Career", "Think &amp; Read"]) {
    assert.ok(html.includes(group), `missing ${group}`);
  }
  assert.equal((html.match(/class="book"/g) || []).length, 6);
  assert.equal((html.match(/class="conversation-card c\d\d"/g) || []).length, 12);
  assert.match(html, /Private Cohort · Harvard OPM Alumni/i);
  assert.match(html, /The first essay lands soon\./);
});

test("homepage follows the dark amber design contract", async () => {
  const css = await read("css/home-redesign.css");
  for (const token of [
    "#101014",
    "#15151a",
    "#ece9e2",
    "#f2efe8",
    "#ffa726",
    "#ffc04d",
    "IBM Plex Mono",
    "Newsreader",
  ]) {
    assert.ok(css.includes(token), `missing ${token}`);
  }
  assert.match(css, /grid-template-columns:\s*400px minmax\(0,\s*1fr\)/);
  assert.match(css, /grid-template-columns:\s*repeat\(6,/);
  assert.match(css, /amber-divider-sweep 1\.2s/);
  assert.match(css, /@media \(max-width:\s*1080px\)/);
  assert.match(css, /@media \(max-width:\s*640px\)/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);
});

test("Signal × Spacetime scene retains all responsive behavior", async () => {
  const source = await read("js/signal-spacetime-logo.js");
  assert.match(source, /for \(let i = 0; i < 60; i \+= 1\)/);
  assert.match(source, /const ringRadii = \[0\.55, 0\.8, 1\.08, 1\.4, 1\.75, 2\.1\]/);
  assert.match(source, /for \(let i = 0; i < 16; i \+= 1\)/);
  assert.match(source, /\[i \/ 16, i \/ 16 \+ 0\.5\]/);
  assert.match(source, /group\.rotation\.x = 0\.3/);
  assert.match(source, /targetRotationY = nx \* 0\.1/);
  assert.match(source, /surgeProgress/);
  assert.match(source, /timeout:\s*200/);
  assert.match(source, /renderer\.setAnimationLoop/);
  assert.match(source, /document\.hidden/);
  assert.match(source, /new ResizeObserver/);
  assert.match(source, /await import\(/);
});

test("every public page carries the six-file brand metadata", async () => {
  const expected = [
    "/assets/images/brand/favicon-32.png",
    "/assets/images/brand/favicon-16.png",
    "/assets/images/brand/apple-touch-icon.png",
    "https://vinaypasricha.com/assets/images/brand/og-image.png",
    'property="og:image:width" content="1200"',
    'property="og:image:height" content="630"',
  ];
  for (const page of await htmlPages()) {
    const html = await readFile(page, "utf8");
    if (!/<head(?:\s[^>]*)?>/i.test(html)) continue;
    for (const value of expected) {
      assert.ok(html.includes(value), `${path.relative(root, page)} missing ${value}`);
    }
    assert.doesNotMatch(html, /(?:og:image|twitter:image)[^>]+vinay-avatar\.png/i);
  }
});

test("all six supplied raster assets are present", async () => {
  for (const name of [
    "og-image.png",
    "favicon-512.png",
    "favicon-192.png",
    "apple-touch-icon.png",
    "favicon-32.png",
    "favicon-16.png",
  ]) {
    const info = await stat(path.join(root, "assets/images/brand", name));
    assert.ok(info.size > 500, `${name} is unexpectedly small`);
  }
});
