// Build the Firebase Hosting `public/` directory.
//
// Firebase Hosting rewrites every path to Cloud Run. On a CDN cache miss,
// a Googlebot user agent never reaches that container: Fastly restarts once
// and answers "Internal Error". A cache HIT of the same URL is 200. HTML is
// Cache-Control: no-cache, so it is always a miss.
//
// Files in `public/` are served by Hosting itself, before the rewrite, so
// Googlebot does not take the Cloud Run miss path. Cloud Run still handles
// /api, /studio, /go, and any path that is not copied here.
//
// cloudbuild.yaml runs this, then `firebase deploy --only hosting`, after the
// Cloud Run deploy. The same two commands work locally.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..');

// Marketing pages and their assets. Studio and the course app stay on Cloud
// Run so the login gate still runs. Private trees are not copied.
export const COPY_ROOTS = [
  'index.html',
  '404.html',
  'books.html',
  'watch.html',
  'notebook.html',
  'civilization-lab.html',
  'memory-lab.html',
  'privacy.html',
  'apple-touch-icon.png',
  'favicon.png',
  'site.webmanifest',
  'llms.txt',
  'robots.txt',
  'sitemap.xml',
  'assets',
  'books',
  'css',
  'js',
  'library',
  'paths',
  'runtime',
  'signal',
  'watch',
  'notebook',
  'frequency',
];

const TRACKER_TAG = '<script defer src="/js/track.js"></script>';

export function injectTracker(html) {
  if (typeof html !== 'string' || html.includes('/js/track.js')) return html;
  if (html.includes('</head>')) return html.replace('</head>', '  ' + TRACKER_TAG + '\n</head>');
  if (html.includes('</body>')) return html.replace('</body>', TRACKER_TAG + '</body>');
  return html;
}

export function stampAssetVersions(html, version) {
  if (typeof html !== 'string') return html;
  const v = encodeURIComponent(version);
  return html.replace(
    /((?:href|src)=")([^"]+\.(?:css|js|mjs))(")/g,
    (match, pre, url, post) => {
      if (/^(?:https?:)?\/\//i.test(url) || url.includes('?')) return match;
      return pre + url + '?v=' + v + post;
    },
  );
}

function walkFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const abs = path.join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) walkFiles(abs, out);
    else if (st.isFile()) out.push(abs);
  }
  return out;
}

export function buildHostingPublic({ root = REPO_ROOT, outDir = path.join(REPO_ROOT, 'public'), assetVersion = 'hosting' } = {}) {
  mkdirSync(outDir, { recursive: true });
  for (const name of COPY_ROOTS) {
    const from = path.join(root, name);
    if (!existsSync(from)) throw new Error('missing hosting source ' + name);
    cpSync(from, path.join(outDir, name), {
      recursive: true,
      filter: (src) => {
        const base = path.basename(src);
        return base !== 'node_modules' && base !== '.git' && base !== '.env';
      },
    });
  }
  for (const file of walkFiles(outDir)) {
    if (!file.endsWith('.html')) continue;
    const html = readFileSync(file, 'utf8');
    writeFileSync(file, stampAssetVersions(injectTracker(html), assetVersion));
  }
  return outDir;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const version = process.env.HOSTING_ASSET_VERSION || new Date().toISOString().slice(0, 10);
  const out = buildHostingPublic({ assetVersion: version });
  console.log('wrote', out);
}
