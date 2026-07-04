#!/usr/bin/env node
/* =============================================================
   scripts/translate-pack.mjs
   =============================================================
   Auto-translates every language pack against the current site.

   - Crawls all HTML files in the repo (same list as Studio uses)
   - Extracts translatable strings (same rules as js/i18n.js)
   - For each language in LANGS, fills missing entries in
     assets/data/i18n/<code>.json by calling Google Cloud (Gemini via Vertex AI),
     through the site's own AI endpoint (/api/ai/complete) — the same Gemini that
     powers the live site. No API key needed: the endpoint is public and Vertex
     authenticates via the Cloud Run service account.
   - Writes updated packs back to disk

   ENVIRONMENT
     AI_ENDPOINT   optional. Full URL of the /api/ai/complete endpoint.
                   Defaults to the live Cloud Run site. Point it at
                   http://localhost:8080/api/ai/complete to use a local backend
                   (which needs `gcloud auth application-default login`).

   FLAGS
     --dry-run           don't call the API, just report what's missing
     --langs hi,bn       restrict to specific languages
     --pages index.html  restrict to specific pages

   USAGE
     npm install
     node scripts/translate-pack.mjs
     node scripts/translate-pack.mjs --langs hi,bn
     AI_ENDPOINT=http://localhost:8080/api/ai/complete node scripts/translate-pack.mjs
   ============================================================= */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Google Cloud Gemini, reached through the site's own public AI endpoint.
const AI_ENDPOINT =
  process.env.AI_ENDPOINT ||
  'https://vinay-site-349140108061.asia-south1.run.app/api/ai/complete';

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

// ----- string collection: MUST mirror js/i18n.js i18nCollectUnits exactly -----
// The runtime looks up each translation by the unit's source string, so the
// crawler has to produce the SAME units the browser does — including HTML units
// (mixed phrasing parents translated as one innerHTML piece), not just text
// nodes. Otherwise the pack keys never match and the page falls back to live AI.
const NO_TRANSLATE_TAGS = new Set([
  'SCRIPT', 'STYLE', 'CODE', 'PRE', 'TEXTAREA', 'INPUT', 'KBD', 'NOSCRIPT',
]);
const PHRASING_TAGS = new Set([
  'EM', 'STRONG', 'I', 'B', 'SPAN', 'A', 'CODE', 'BR', 'SMALL', 'SUB', 'SUP',
  'MARK', 'ABBR', 'CITE', 'TIME', 'VAR', 'Q', 'U', 'S', 'DEL', 'INS',
]);
const NO_TRANSLATE_SELECTORS = [
  '[data-no-translate]', '.mono', '.brand .name', '.foot-brand', '.code',
  '.book-meta', '.connect-channel .cc-handle', '.vc-tag',
  '.sub-channel .sc-handle', '.lang-menu .native',
];

function isExcluded(parent) {
  let p = parent;
  while (p) {
    if (NO_TRANSLATE_TAGS.has(p.tagName)) return true;
    try { if (p.matches && p.matches('[data-no-translate]')) return true; } catch (e) {}
    for (const sel of NO_TRANSLATE_SELECTORS) {
      try { if (p.matches && p.matches(sel)) return true; } catch (e) {}
    }
    p = p.parentElement;
  }
  return false;
}

function isPhrasingOnly(el) {
  const kids = el.children;
  for (let i = 0; i < kids.length; i++) {
    const c = kids[i];
    if (!PHRASING_TAGS.has(c.tagName)) return false;
    if (isExcluded(c)) return false;
    if (!isPhrasingOnly(c)) return false;
  }
  return true;
}

function isMixedPhrasingParent(el) {
  let hasText = false, hasInline = false;
  for (const n of el.childNodes) {
    if (n.nodeType === 3) {
      if (n.nodeValue && n.nodeValue.trim() && /[A-Za-z]/.test(n.nodeValue)) hasText = true;
    } else if (n.nodeType === 1) {
      if (PHRASING_TAGS.has(n.tagName)) hasInline = true;
    }
  }
  return hasText && hasInline;
}

function collectStrings(doc) {
  const out = new Set();
  const NodeFilter = doc.defaultView.NodeFilter;
  const handled = new WeakSet();

  // Pass 1: HTML units (mixed phrasing parents) — translate innerHTML as one.
  const elWalker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT, {
    acceptNode(el) {
      if (isExcluded(el)) return NodeFilter.FILTER_REJECT;
      if (isMixedPhrasingParent(el) && isPhrasingOnly(el)) return NodeFilter.FILTER_ACCEPT;
      return NodeFilter.FILTER_SKIP;
    },
  });
  let el;
  while ((el = elWalker.nextNode())) {
    handled.add(el);
    const inner = el.querySelectorAll('*');
    for (let i = 0; i < inner.length; i++) handled.add(inner[i]);
    const s = el.innerHTML.trim();
    if (s && /[A-Za-z]/.test(s) && s.length < 2000) out.add(s);
  }

  // Pass 2: plain text nodes not inside a handled HTML unit.
  const textWalker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const t = node.nodeValue;
      if (!t || !t.trim()) return NodeFilter.FILTER_REJECT;
      if (!/[A-Za-z]/.test(t)) return NodeFilter.FILTER_REJECT;
      if (isExcluded(node.parentElement)) return NodeFilter.FILTER_REJECT;
      let p = node.parentElement;
      while (p) { if (handled.has(p)) return NodeFilter.FILTER_REJECT; p = p.parentElement; }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let n;
  while ((n = textWalker.nextNode())) {
    const s = n.nodeValue.trim();
    if (s.length > 0 && s.length < 2000) out.add(s);
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
      const doc = dom.window.document;
      const strings = collectStrings(doc);
      strings.forEach(s => allStrings.add(s));
      // Also translate the head/meta strings (title, description, OG/Twitter) —
      // these power translated SERP snippets + social cards via i18nServer.js.
      const head = [];
      const t = doc.querySelector('title');
      if (t && t.textContent.trim()) head.push(t.textContent.trim());
      for (const sel of ['meta[name="description"]','meta[property="og:title"]','meta[property="og:description"]','meta[name="twitter:title"]','meta[name="twitter:description"]']) {
        const m = doc.querySelector(sel);
        const v = m && (m.getAttribute('content') || '').trim();
        if (v && /[A-Za-z]/.test(v)) head.push(v);
      }
      head.forEach(s => allStrings.add(s));
      console.log(`  ${rel}: ${strings.length} body + ${head.length} head strings`);
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

  // 2. Translate each language pack (Google Cloud Gemini via AI_ENDPOINT)
  // Cloud Run scales, so we fan the chunk requests out concurrently (across all
  // languages at once) and cap parallelism with a small pool. Each language owns
  // its own pack object in memory; JS is single-threaded so mutating them from
  // interleaved async tasks is safe. Files are flushed per language as they fill.
  const CHUNK = 20;
  const CONCURRENCY = parseInt(process.env.TRANSLATE_CONCURRENCY || '12', 10);
  console.log(`AI endpoint: ${AI_ENDPOINT}`);
  console.log(`Concurrency: ${CONCURRENCY} · chunk size: ${CHUNK}`);

  // Load (or create) every pack, and build the full task list up front.
  const packs = new Map();      // code -> { pack, packPath, remaining }
  const tasks = [];             // { lang, chunk }
  for (const lang of langs) {
    const packPath = join(ROOT, `assets/data/i18n/${lang.code}.json`);
    mkdirSync(dirname(packPath), { recursive: true });
    let pack = null;
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
    packs.set(lang.code, { pack, packPath, remaining: 0 });
    for (let i = 0; i < untranslated.length; i += CHUNK) {
      tasks.push({ lang, chunk: untranslated.slice(i, i + CHUNK) });
    }
    packs.get(lang.code).remaining = Math.ceil(untranslated.length / CHUNK);
    console.log(`${lang.code}: ${untranslated.length} new strings (${Object.keys(pack.strings).length} cached)`);
  }

  const flush = (code) => {
    const { pack, packPath } = packs.get(code);
    pack.updated_at = today();
    writeFileSync(packPath, JSON.stringify(pack, null, 2) + '\n');
  };

  // Languages with nothing to translate: still prune + rewrite once.
  for (const [code, info] of packs) {
    if (info.remaining === 0) { pruneOrphans(info.pack, allStrings); flush(code); }
  }

  console.log(`\nTranslating ${tasks.length} chunks across ${langs.length} languages…`);
  let done = 0;
  const total = tasks.length;
  let cursor = 0;
  async function worker() {
    while (cursor < tasks.length) {
      const { lang, chunk } = tasks[cursor++];
      const info = packs.get(lang.code);
      try {
        const translations = await translateChunk(chunk, lang);
        chunk.forEach((src, idx) => { if (translations[idx]) info.pack.strings[src] = translations[idx]; });
      } catch (err) {
        console.error(`\n  ${lang.code} chunk failed:`, err.message);
      }
      done++;
      info.remaining--;
      if (info.remaining <= 0) { pruneOrphans(info.pack, allStrings); flush(lang.code); }
      else if (done % 5 === 0) { flush(lang.code); } // periodic safety flush
      process.stdout.write(`  ${done}/${total} chunks\r`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, tasks.length || 1) }, worker));

  // Final flush for every language (covers any not flushed by remaining<=0 path).
  for (const code of packs.keys()) flush(code);
  console.log(`\ndone. ${total} chunks processed.`);
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

async function translateChunk(strings, lang) {
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

  const headers = { 'Content-Type': 'application/json' };
  // Bypass the endpoint's per-IP rate limit during bulk pack generation.
  if (process.env.ADMIN_TOKEN) headers['x-admin-token'] = process.env.ADMIN_TOKEN;

  const res = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!res.ok) {
    throw new Error(`AI endpoint ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  let txt = String((data && data.completion) || '').trim();
  if (txt.startsWith('```')) txt = txt.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '');
  const lb = txt.indexOf('{');
  const rb = txt.lastIndexOf('}');
  if (lb !== -1 && rb !== -1) txt = txt.slice(lb, rb + 1);
  let parsed;
  try { parsed = JSON.parse(txt); } catch (e) { console.warn('  parse failed for chunk; skipping'); return []; }
  return strings.map((_, i) => parsed[String(i)] || null);
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
