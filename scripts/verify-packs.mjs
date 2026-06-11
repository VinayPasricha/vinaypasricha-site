#!/usr/bin/env node
/* Verifies every i18n pack against _audit/i18n-strings.json:
   - JSON validity
   - coverage (how many expected keys are present)
   - HTML tag preservation (tag count parity source vs translation)
   USAGE: node scripts/verify-packs.mjs */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = JSON.parse(readFileSync(join(ROOT, '_audit/i18n-strings.json'), 'utf8'));
const SKIP = new Set(['i','ii','iii','iv','v','vi','vii']);
const expected = src.strings.filter(s => !SKIP.has(s)).map(s => s === '2010s' ? '7eef1c' : s);

const dir = join(ROOT, 'assets/data/i18n');
for (const f of readdirSync(dir).filter(f => f.endsWith('.json'))) {
  let pack;
  try { pack = JSON.parse(readFileSync(join(dir, f), 'utf8')); }
  catch (e) { console.log(`${f}: INVALID JSON — ${e.message.slice(0, 100)}`); continue; }
  const strings = pack.strings || {};
  let present = 0, missing = [], tagMismatch = 0, untranslated = 0;
  for (const key of expected) {
    const v = strings[key];
    if (!v || !String(v).trim()) { missing.push(key); continue; }
    present++;
    const srcKey = key === '7eef1c' ? '2010s' : key;
    const a = (srcKey.match(/<[a-z][^>]*>/gi) || []).length;
    const b = (String(v).match(/<[a-z][^>]*>/gi) || []).length;
    if (a !== b) tagMismatch++;
    if (v === srcKey && srcKey.length > 30) untranslated++;
  }
  console.log(`${f}: entries=${Object.keys(strings).length} coverage=${present}/${expected.length} tagMismatch=${tagMismatch} identical=${untranslated}`);
  if (missing.length && missing.length <= 12) missing.forEach(m => console.log(`   missing: ${m.slice(0, 90).replace(/\n/g, '\\n')}`));
  else if (missing.length) console.log(`   missing: ${missing.length} keys; first 5:`), missing.slice(0,5).forEach(m => console.log(`   - ${m.slice(0, 90).replace(/\n/g, '\\n')}`));
}
