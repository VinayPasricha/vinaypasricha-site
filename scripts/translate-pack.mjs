#!/usr/bin/env node
/* =============================================================
   scripts/translate-pack.mjs
   =============================================================
   Auto-translates every language pack against the current site.

   - Crawls all HTML files in the repo (same list as Studio uses)
   - Extracts translatable strings (same rules as js/i18n.js)
   - For each language in LANGS, fills missing entries in
     assets/data/i18n/<code>.json by calling the Anthropic API
   - Writes updated packs back to disk

   ENVIRONMENT
     ANTHROPIC_API_KEY   required (set as a GitHub secret in CI)

   FLAGS
     --dry-run           don't call the API, just report what's missing
     --langs hi,bn       restrict to specific languages
     --pages index.html  restrict to specific pages

   USAGE
     npm install
     ANTHROPIC_API_KEY=sk-... node scripts/translate-pack.mjs
     ANTHROPIC_API_KEY=sk-... node scripts/translate-pack.mjs --langs hi,bn
   ============================================================= */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ----- args -----
const argv = process.argv.slice(2);
const DRY_RUN = argv.includes('--dry-run');
const langArg = argFor('--langs');
const pageArg = argFor('--pages');

function argFor(flag) {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1].split(',') : null;
}

// ----- config: mirrors studio/i18n-admin.js -----
const SITE_PAGES = [
  'index.html',
  'books.html',
  'paths/ai-for-business.html',
  'paths/blog.html',
  'paths/career.html',
  'paths/connect.html',
  'paths/course.html',
  'paths/decisions.html',
  'paths/essay.html',
  'paths/evolve.html',
  'paths/execute.html',
  'paths/faq.html',
  'paths/fiction.html',
  'paths/find-work.html',
  'paths/hire.html',
  'paths/now.html',
  'paths/story.html',
  'paths/watch.html',
  'signal/index.html',
  'signal/colophon.html',
  'signal/field.html',
  'signal/session.html',
];

const LANGS = [
  { code: 'hi', english: 'Hindi',      native: 'हिन्दी' },
  { code: 'bn', english: 'Bengali',    native: 'বাংলা' },
  { code: 'ta', english: 'Tamil',      native: 'தமிழ்' },
  { code: 'te', english: 'Telugu',     native: 'తెలుగు' },
  { code: 'kn', english: 'Kannada',    native: 'ಕನ್ನಡ' },
  { code: 'es', english: 'Spanish',    native: 'Español' },
  { code: 'fr', english: 'French',     native: 'Français' },
  { code: 'pt', english: 'Portuguese', native: 'Português' },
  { code: 'ja', english: 'Japanese',   native: '日本語' },
  { code: 'zh', english: 'Chinese',    native: '中文' },
  { code: 'ko', english: 'Korean',     native: '한국어' },
  { code: 'ru', english: 'Russian',    native: 'Русский' },
];

const NO_TRANSLATE_TAGS = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'TEXTAREA', 'INPUT', 'KBD', 'NOSCRIPT']);
const NO_TRANSLATE_SELECTORS = [
  '[data-no-translate]', '.mono', '.brand .name', '.foot-brand',
  '.code', '.book-meta', '.vc-tag',
];

function isExcluded(el) {
  let p = el;
  while (p && p.nodeType === 1) {
    if (NO_TRANSLATE_TAGS.has(p.tagName)) return true;
    if (p.hasAttribute && p.hasAttribute('data-no-translate')) return true;
    for (const sel of NO_TRANSLATE_SELECTORS) {
      try { if (p.matches && p.matches(sel)) return true; } catch (e) {}
    }
    p = p.parentElement;
  }
  return false;
}

function collectStrings(doc) {
  const out = new Set();
  const NodeFilter = doc.defaultView.NodeFilter;
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const t = n.nodeValue;
      if (!t || !t.trim()) return NodeFilter.FILTER_REJECT;
      if (!/[A-Za-z]/.test(t)) return NodeFilter.FILTER_REJECT;
      if (isExcluded(n.parentElement)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  let n;
  while (n = walker.nextNode()) {
    const s = n.nodeValue.trim();
    if (s.length > 0 && s.length < 800) out.add(s);
  }
  return [...out];
}

// ----- main -----
async function main() {
  console.log('— translate-pack —');

  const pages = pageArg ? SITE_PAGES.filter(p => pageArg.includes(p)) : SITE_PAGES;
  const langs = langArg ? LANGS.filter(l => langArg.includes(l.code)) : LANGS;

  console.log(`Pages: ${pages.length} · Languages: ${langs.map(l => l.code).join(', ')}`);

  // 1. Crawl
  const allStrings = new Set();
  for (const rel of pages) {
    const abs = join(ROOT, rel);
    if (!existsSync(abs)) { console.warn(`  skip (missing): ${rel}`); continue; }
    try {
      const html = readFileSync(abs, 'utf8');
      const dom = new JSDOM(html);
      const strings = collectStrings(dom.window.document);
      strings.forEach(s => allStrings.add(s));
      console.log(`  ${rel}: ${strings.length} strings`);
    } catch (e) {
      console.warn(`  ${rel}: parse failed —`, e.message);
    }
  }
  console.log(`Total unique strings: ${allStrings.size}`);

  if (DRY_RUN) {
    for (const lang of langs) {
      const packPath = join(ROOT, `assets/data/i18n/${lang.code}.json`);
      let pack = { strings: {} };
      if (existsSync(packPath)) {
        try { pack = JSON.parse(readFileSync(packPath, 'utf8')); } catch (e) {}
      }
      const missing = [...allStrings].filter(s => !(pack.strings[s] || '').trim()).length;
      const total = allStrings.size;
      console.log(`  ${lang.code}: ${total - missing}/${total} translated · ${missing} missing`);
    }
    console.log('(dry run — no API calls made, no files written)');
    return;
  }

  // 2. Translate each language pack
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('\nERROR: ANTHROPIC_API_KEY environment variable not set.');
    console.error('Get a key at https://console.anthropic.com/settings/keys');
    process.exit(1);
  }
  const client = new Anthropic({ apiKey });

  for (const lang of langs) {
    const packPath = join(ROOT, `assets/data/i18n/${lang.code}.json`);
    mkdirSync(dirname(packPath), { recursive: true });

    let pack;
    if (existsSync(packPath)) {
      try { pack = JSON.parse(readFileSync(packPath, 'utf8')); }
      catch (e) { console.warn(`  ${lang.code}: pack parse failed, starting fresh`); pack = null; }
    }
    if (!pack) {
      pack = {
        _comment: `${lang.english} translation pack for vinaypasricha.com. Auto-generated by scripts/translate-pack.mjs.`,
        lang: lang.code,
        lang_native: lang.native,
        updated_at: today(),
        strings: {},
      };
    }
    pack.strings = pack.strings || {};

    const untranslated = [...allStrings].filter(s => !(pack.strings[s] || '').trim());
    if (!untranslated.length) {
      console.log(`${lang.code}: nothing to translate (${Object.keys(pack.strings).length} cached)`);
      pruneOrphans(pack, allStrings);
      pack.updated_at = today();
      writeFileSync(packPath, JSON.stringify(pack, null, 2) + '\n');
      continue;
    }

    console.log(`${lang.code}: translating ${untranslated.length} new strings…`);
    const CHUNK = 20;
    for (let i = 0; i < untranslated.length; i += CHUNK) {
      const chunk = untranslated.slice(i, i + CHUNK);
      try {
        const translations = await translateChunk(client, chunk, lang);
        chunk.forEach((src, idx) => {
          if (translations[idx]) pack.strings[src] = translations[idx];
        });
        // Write incrementally so partial progress is preserved on failure
        pack.updated_at = today();
        writeFileSync(packPath, JSON.stringify(pack, null, 2) + '\n');
        process.stdout.write(`  ${Math.min(i + CHUNK, untranslated.length)}/${untranslated.length}\r`);
      } catch (err) {
        console.error(`\n  chunk ${i}-${i + chunk.length} failed:`, err.message);
      }
    }
    pruneOrphans(pack, allStrings);
    writeFileSync(packPath, JSON.stringify(pack, null, 2) + '\n');
    console.log(`\n  ${lang.code}: wrote ${packPath}`);
  }

  console.log('done.');
}

function pruneOrphans(pack, currentStrings) {
  // Remove translations for strings that no longer appear anywhere on the site.
  // This keeps the pack tidy and prevents stale rot.
  const current = new Set(currentStrings);
  let removed = 0;
  for (const k of Object.keys(pack.strings)) {
    if (!current.has(k)) { delete pack.strings[k]; removed++; }
  }
  if (removed) console.log(`  pruned ${removed} orphan string${removed === 1 ? '' : 's'}`);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function translateChunk(client, strings, lang) {
  const dict = {};
  strings.forEach((s, i) => { dict[String(i)] = s; });

  const systemPrompt = `You translate website text from English to ${lang.english} (${lang.native}).

CRITICAL RULES:
- Preserve the calm, literary, slightly formal tone of the original.
- Keep proper nouns untranslated: Vinay Pasricha, GoodSpace AI, SIV, SIV Method, AI for Business Leaders, The Execution Doctrine, The Signal, Organizational Frequency, AION1, Amazon, YouTube, Instagram, LinkedIn.
- Do NOT translate ISBNs, dates, URLs, email addresses, hashtags, or hex codes.
- Preserve punctuation EXACTLY as in the source (em-dashes, en-dashes, ellipses, quotation marks).
- Output MUST be valid JSON only — no preamble, no markdown fences. Same keys as input. Each value is the translated string.
- If a string contains both English and proper nouns, translate only the English portions.
- Maintain text length roughly similar where the script allows it.`;

  const userPrompt = `Translate this JSON dictionary to ${lang.english}. Return ONLY the JSON object — no other text.\n\n${JSON.stringify(dict, null, 2)}`;

  const message = await client.messages.create({
    model: 'claude-3-5-haiku-latest',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  let txt = (message.content?.[0]?.text || '').trim();
  if (txt.startsWith('```')) txt = txt.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '');
  const lb = txt.indexOf('{');
  const rb = txt.lastIndexOf('}');
  if (lb !== -1 && rb !== -1) txt = txt.slice(lb, rb + 1);
  let parsed;
  try { parsed = JSON.parse(txt); } catch (e) { console.warn('  parse failed for chunk; skipping'); return []; }
  return strings.map((_, i) => parsed[String(i)] || null);
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
