import { readFileSync } from 'node:fs';

const path = new URL('../backend/src/app.js', import.meta.url);
// The patterns below are written with newlines, so a source checked out with
// CRLF line endings would fail to match. Normalise first.
const source = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

function must(cond, msg) {
  if (!cond) throw new Error(`Studio hardening failed: ${msg}`);
}

// Source must already be fail-closed: passphrase is env-only; no default in source.
must(
  source.includes("String(process.env.STUDIO_PASSPHRASE || '').trim()"),
  'env-only passphrase is missing',
);
must(
  !/STUDIO_PASSPHRASE\s*=\s*process\.env\.STUDIO_PASSPHRASE\s*\|\|\s*'[^']+'/.test(source),
  'fallback passphrase remains',
);
must(
  source.includes("if (!STUDIO_PASSPHRASE) return '';"),
  'fail-closed Studio cookie hash is missing',
);
must(
  source.includes("studio_not_configured"),
  'login fail-closed check is missing',
);
must(
  source.includes("res.setHeader('Location', '/studio/login')"),
  'explicit redirect is missing',
);
must(
  !source.includes("return res.redirect(302, '/studio/login')"),
  'legacy Studio redirect remains',
);

console.log('Studio gate already fail-closed in source.');
