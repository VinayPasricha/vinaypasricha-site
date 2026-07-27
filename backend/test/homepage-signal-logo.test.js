import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("homepage mounts the real Signal × Spacetime scene", async () => {
  const [html, css] = await Promise.all([
    read("index.html"),
    read("css/site.css"),
  ]);

  assert.match(html, /id="logo3d" class="hero-logo logo3d"/);
  assert.match(
    html,
    /alt="Signal × Spacetime — the mark of Vinay Pasricha"/
  );
  assert.match(html, /type="module" src="js\/signal-spacetime-logo\.js"/);
  assert.match(css, /#15151a/);
  assert.match(css, /\.logo3d canvas/);
  assert.doesNotMatch(css, /logo-tilt-and-turn/);
});

test("scene contains every specified moving layer", async () => {
  const source = await read("js/signal-spacetime-logo.js");

  assert.match(source, /for \(let i = 0; i < 60; i \+= 1\)/);
  assert.match(source, /const ringRadii = \[0\.55, 0\.8, 1\.08, 1\.4, 1\.75, 2\.1\]/);
  assert.match(source, /for \(let i = 0; i < 16; i \+= 1\)/);
  assert.match(source, /\[i \/ 16, i \/ 16 \+ 0\.5\]/);
  assert.match(source, /group\.rotation\.x = 0\.3/);
  assert.match(source, /wheel\.rotation\.y = -t \* 0\.05/);
  assert.match(source, /grid\.rotation\.y = t \* 0\.04/);
  assert.match(source, /\(t \* 0\.14 \+ spark\.phase\) % 1/);
  assert.match(source, /requestIdleCallback/);
  assert.match(source, /IntersectionObserver/);
  assert.match(source, /navigator\.hardwareConcurrency <= 2/);
  assert.match(source, /await import\(/);
  assert.match(source, /renderer\.setAnimationLoop/);
  assert.match(source, /document\.hidden/);
  assert.match(source, /new ResizeObserver/);
  assert.doesNotMatch(source, /^import \* as THREE/m);
});

test("scene preserves the six-color signal and amber current", async () => {
  const source = await read("js/signal-spacetime-logo.js");

  for (const color of [
    "#e11431",
    "#b3123f",
    "#d922a8",
    "#7a2bd4",
    "#2447e0",
    "#2e8eff",
    "#ffffff",
    "#7a4c0e",
    "#ffc04d",
  ]) {
    assert.ok(source.includes(color), `missing ${color}`);
  }

  assert.doesNotMatch(
    source,
    /#(?:00ff00|00ff66|39ff14|22c55e|16a34a|10b981)\b/i
  );
});
