#!/usr/bin/env node
/* =============================================================
   scripts/extract-strings.mjs
   =============================================================
   Extracts every translatable string from the site's public pages,
   mirroring js/i18n.js exactly — BOTH plain text nodes AND "HTML
   units" (mixed phrasing parents translated as one piece, e.g.
   `We are entering a century … <em>systems humans built…</em>`).

   Output: _audit/i18n-strings.json
     {
       "count": N,
       "strings": [ ... ],            // pack keys (raw English source)
       "hashAmbiguous": { src: hash } // sources the pack loader would
                                      // mistake for hash keys — key
                                      // these by their FNV-1a hash
     }

   USAGE:  node scripts/extract-strings.mjs
   ============================================================= */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SITE_PAGES = [
  'index.html',
  'books.html',
  '404.html',
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
  'paths/civilization.html',
  'signal/index.html',
  'signal/colophon.html',
  'signal/field.html',
  'signal/sessions.html',
  'signal/archive.html',
  'signal/begin.html',
];

// ---- mirrors js/i18n.js exactly ----
const NO_TRANSLATE_TAGS = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'TEXTAREA', 'INPUT', 'KBD', 'NOSCRIPT']);
const PHRASING_TAGS = new Set(['EM','STRONG','I','B','SPAN','A','CODE','BR','SMALL','SUB','SUP','MARK','ABBR','CITE','TIME','VAR','Q','U','S','DEL','INS']);
const NO_TRANSLATE_SELECTORS = [
  '[data-no-translate]', '.mono', '.brand .name', '.foot-brand', '.code',
  '.book-meta', '.connect-channel .cc-handle', '.vc-tag',
  '.sub-channel .sc-handle', '.lang-menu .native',
];

function isExcluded(el) {
  let p = el;
  while (p && p.nodeType === 1) {
    if (NO_TRANSLATE_TAGS.has(p.tagName)) return true;
    try { if (p.hasAttribute && p.hasAttribute('data-no-translate')) return true; } catch (e) {}
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

function fnv1a(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(36);
}

function collectUnits(doc, NodeFilter) {
  const out = [];
  const handled = new WeakSet();

  const elWalker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT, {
    acceptNode(el) {
      if (isExcluded(el)) return NodeFilter.FILTER_REJECT;
      if (isMixedPhrasingParent(el) && isPhrasingOnly(el)) return NodeFilter.FILTER_ACCEPT;
      return NodeFilter.FILTER_SKIP;
    }
  });
  let el;
  while ((el = elWalker.nextNode())) {
    handled.add(el);
    const inner = el.querySelectorAll('*');
    for (let i = 0; i < inner.length; i++) handled.add(inner[i]);
    const src = el.innerHTML.trim();
    if (src && src.length < 1600) out.push(src);
  }

  const textWalker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const t = node.nodeValue;
      if (!t || !t.trim()) return NodeFilter.FILTER_REJECT;
      if (!/[A-Za-z]/.test(t)) return NodeFilter.FILTER_REJECT;
      if (isExcluded(node.parentElement)) return NodeFilter.FILTER_REJECT;
      let p = node.parentElement;
      while (p) {
        if (handled.has(p)) return NodeFilter.FILTER_REJECT;
        p = p.parentElement;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  let n;
  while ((n = textWalker.nextNode())) {
    const s = n.nodeValue.trim();
    if (s && s.length < 800) out.push(s);
  }
  return out;
}

const all = new Set();
for (const rel of SITE_PAGES) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) { console.warn('skip (missing):', rel); continue; }
  const html = readFileSync(abs, 'utf8');
  const dom = new JSDOM(html);
  const units = collectUnits(dom.window.document, dom.window.NodeFilter);
  units.forEach(u => all.add(u));
  console.log(rel + ': ' + units.length);
}

const strings = [...all];
// Sources the runtime pack loader would misread as hash keys:
// all-lowercase alphanumerics, <=12 chars, no whitespace.
const hashAmbiguous = {};
for (const s of strings) {
  if (/^[a-z0-9]{1,12}$/.test(s) && !/\s/.test(s)) hashAmbiguous[s] = fnv1a(s);
}

mkdirSync(join(ROOT, '_audit'), { recursive: true });
writeFileSync(join(ROOT, '_audit', 'i18n-strings.json'),
  JSON.stringify({ count: strings.length, hashAmbiguous, strings }, null, 2));
console.log('TOTAL unique strings: ' + strings.length);
console.log('hash-ambiguous keys: ' + Object.keys(hashAmbiguous).length);
console.log('wrote _audit/i18n-strings.json');
