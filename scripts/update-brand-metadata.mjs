import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const excludedDirectories = new Set([
  ".git",
  "node_modules",
  "_explorations",
]);

async function collectHtml(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(root, absolute);
    if (
      relative.startsWith(path.join("library", "civilization", "source")) ||
      relative === path.join("library", "civilization", "cover-standalone.html")
    ) {
      continue;
    }
    if (entry.isDirectory()) files.push(...(await collectHtml(absolute)));
    if (entry.isFile() && entry.name.endsWith(".html")) files.push(absolute);
  }
  return files;
}

const iconMarkup = [
  '  <link rel="icon" type="image/png" sizes="32x32" href="/assets/images/brand/favicon-32.png">',
  '  <link rel="icon" type="image/png" sizes="16x16" href="/assets/images/brand/favicon-16.png">',
  '  <link rel="apple-touch-icon" sizes="180x180" href="/assets/images/brand/apple-touch-icon.png">',
  '  <link rel="manifest" href="/site.webmanifest">',
].join("\n");

const socialMarkup = [
  '  <meta property="og:image" content="https://vinaypasricha.com/assets/images/brand/og-image.png">',
  '  <meta property="og:image:width" content="1200">',
  '  <meta property="og:image:height" content="630">',
  '  <meta name="twitter:image" content="https://vinaypasricha.com/assets/images/brand/og-image.png">',
].join("\n");

const removable = [
  /[ \t]*<link\b[^>]*\brel=["'](?:shortcut )?icon["'][^>]*>\s*/gi,
  /[ \t]*<link\b[^>]*\brel=["']apple-touch-icon["'][^>]*>\s*/gi,
  /[ \t]*<link\b[^>]*\brel=["']manifest["'][^>]*>\s*/gi,
  /[ \t]*<meta\b[^>]*\bproperty=["']og:image(?::width|:height)?["'][^>]*>\s*/gi,
  /[ \t]*<meta\b[^>]*\bname=["']twitter:image["'][^>]*>\s*/gi,
];

let updated = 0;
for (const file of await collectHtml(root)) {
  let html = await readFile(file, "utf8");
  if (!/<head(?:\s[^>]*)?>/i.test(html)) continue;
  for (const pattern of removable) html = html.replace(pattern, "\n");
  html = html.replace(/<\/head>/i, `${iconMarkup}\n${socialMarkup}\n</head>`);
  await writeFile(file, html);
  updated += 1;
}

console.log(`Updated brand metadata in ${updated} HTML files.`);
