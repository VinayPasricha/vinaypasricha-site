import { readFileSync, writeFileSync } from 'node:fs';

const path = new URL('../backend/src/app.js', import.meta.url);
// The patterns below are written with newlines, so a source checked out with
// CRLF line endings would fail to match and abort the container build. Normalise
// first: the file is rewritten from this string, so the image gets LF either way.
let source = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

function replaceOnce(from, to, label) {
  if (!source.includes(from)) throw new Error(`Studio hardening failed: ${label} source pattern was not found`);
  source = source.replace(from, to);
}

replaceOnce(
  "const STUDIO_PASSPHRASE = process.env.STUDIO_PASSPHRASE || 'vik123';",
  "const STUDIO_PASSPHRASE = String(process.env.STUDIO_PASSPHRASE || '').trim();",
  'development fallback passphrase',
);

replaceOnce(
  "function studioHash() {\n  return crypto.createHash('sha256').update('studio:' + STUDIO_PASSPHRASE).digest('hex');\n}",
  "function studioHash() {\n  if (!STUDIO_PASSPHRASE) return '';\n  return crypto.createHash('sha256').update('studio:' + STUDIO_PASSPHRASE).digest('hex');\n}",
  'fail-closed Studio cookie hash',
);

replaceOnce(
  "    if (req.method === 'GET' || req.method === 'HEAD') return res.redirect(302, '/studio/login');",
  "    if (req.method === 'GET' || req.method === 'HEAD') {\n      res.statusCode = 302;\n      res.setHeader('Location', '/studio/login');\n      return res.end();\n    }",
  'legacy Studio redirect',
);

replaceOnce(
  "    // The passphrase, or the long ADMIN_TOKEN as a master key.\n    if (pw !== STUDIO_PASSPHRASE && !(config.adminToken && pw === config.adminToken)) {",
  "    // The passphrase, or the long ADMIN_TOKEN as a master key.\n    if (!STUDIO_PASSPHRASE && !config.adminToken) {\n      return res.status(503).json({ error: 'studio_not_configured' });\n    }\n    if ((!STUDIO_PASSPHRASE || pw !== STUDIO_PASSPHRASE) && !(config.adminToken && pw === config.adminToken)) {",
  'Studio login fail-closed check',
);

replaceOnce(
  "  app.get('/api/studio/status', (req, res) => res.json({ authed: studioAuthed(req), enabled: !!config.adminToken }));",
  "  app.get('/api/studio/status', (req, res) => res.json({ authed: studioAuthed(req), enabled: !!STUDIO_PASSPHRASE || !!config.adminToken }));",
  'Studio configuration status',
);

if (source.includes("|| 'vik123'")) throw new Error('Studio hardening failed: fallback passphrase remains');
if (!source.includes("res.setHeader('Location', '/studio/login')")) throw new Error('Studio hardening failed: explicit redirect is missing');

writeFileSync(path, source);
console.log('Studio gate hardened for container build.');
