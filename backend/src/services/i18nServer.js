// Server-side translation for SEO: when a page is requested with ?lang=XX,
// we render the HTML already translated (using the shipped packs) so crawlers
// — and users — receive real translated content at the hreflang URLs, instead
// of English that only gets translated later by client JS.
//
// The unit-collection logic MUST mirror js/i18n.js i18nCollectUnits exactly,
// and the pack keys are the raw English source strings (as written by
// scripts/translate-pack.mjs). Everything is best-effort: any failure falls
// back to the original English HTML (see app.js), so this can never break a page.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';

export const SUPPORTED = ['hi', 'bn', 'ta', 'te', 'kn', 'es', 'fr', 'pt', 'ja', 'zh', 'ko', 'ru'];

const NO_TRANSLATE_TAGS = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'TEXTAREA', 'INPUT', 'KBD', 'NOSCRIPT']);
const PHRASING_TAGS = new Set([
  'EM', 'STRONG', 'I', 'B', 'SPAN', 'A', 'CODE', 'BR', 'SMALL', 'SUB', 'SUP',
  'MARK', 'ABBR', 'CITE', 'TIME', 'VAR', 'Q', 'U', 'S', 'DEL', 'INS',
]);
const NO_TRANSLATE_SELECTORS = [
  '[data-no-translate]', '.mono', '.brand .name', '.foot-brand', '.code',
  '.book-meta', '.connect-channel .cc-handle', '.vc-tag',
  '.sub-channel .sc-handle', '.lang-menu .native',
];

// ---- pack cache ----
const packs = new Map(); // lang -> { strings } | null
function loadPack(siteRoot, lang) {
  if (packs.has(lang)) return packs.get(lang);
  let pack = null;
  try {
    const raw = readFileSync(join(siteRoot, 'assets', 'data', 'i18n', `${lang}.json`), 'utf8');
    const d = JSON.parse(raw);
    if (d && d.strings) pack = d.strings;
  } catch (e) { pack = null; }
  packs.set(lang, pack);
  return pack;
}

function isExcluded(parent) {
  let p = parent;
  while (p) {
    if (NO_TRANSLATE_TAGS.has(p.tagName)) return true;
    try { if (p.matches && p.matches('[data-no-translate]')) return true; } catch (e) {}
    for (const sel of NO_TRANSLATE_SELECTORS) { try { if (p.matches && p.matches(sel)) return true; } catch (e) {} }
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
    if (n.nodeType === 3) { if (n.nodeValue && n.nodeValue.trim() && /[A-Za-z]/.test(n.nodeValue)) hasText = true; }
    else if (n.nodeType === 1) { if (PHRASING_TAGS.has(n.tagName)) hasInline = true; }
  }
  return hasText && hasInline;
}
function preserveSpacing(original, translated) {
  const leading = (original.match(/^\s*/) || [''])[0];
  const trailing = (original.match(/\s*$/) || [''])[0];
  return leading + translated.trim() + trailing;
}

// Translate a full HTML document string into `lang`. Returns translated HTML,
// or null if the pack is missing / nothing could be done.
export function translateHtml(html, lang, siteRoot) {
  if (!SUPPORTED.includes(lang)) return null;
  const pack = loadPack(siteRoot, lang);
  if (!pack) return null;

  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const NodeFilter = dom.window.NodeFilter;
  const handled = new WeakSet();
  let applied = 0;

  // Pass 1: HTML units (mixed phrasing parents).
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
    const src = el.innerHTML.trim();
    const tr = pack[src];
    if (tr) {
      const origTags = (src.match(/<[^>]+>/g) || []).length;
      const newTags = (tr.match(/<[^>]+>/g) || []).length;
      if (!(newTags === 0 && origTags > 0)) { el.innerHTML = tr; applied++; }
    }
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
  const textNodes = [];
  while ((n = textWalker.nextNode())) textNodes.push(n);
  for (const node of textNodes) {
    const tr = pack[node.nodeValue.trim()];
    if (tr) { node.nodeValue = preserveSpacing(node.nodeValue, tr); applied++; }
  }

  // Head: <title>, meta description, and og/twitter mirrors.
  const setAttrFromPack = (sel, attr) => {
    doc.querySelectorAll(sel).forEach((m) => {
      const cur = (m.getAttribute(attr) || '').trim();
      if (cur && pack[cur]) { m.setAttribute(attr, pack[cur]); applied++; }
    });
  };
  const titleEl = doc.querySelector('title');
  if (titleEl && pack[titleEl.textContent.trim()]) { titleEl.textContent = pack[titleEl.textContent.trim()]; applied++; }
  setAttrFromPack('meta[name="description"]', 'content');
  setAttrFromPack('meta[property="og:title"]', 'content');
  setAttrFromPack('meta[property="og:description"]', 'content');
  setAttrFromPack('meta[name="twitter:title"]', 'content');
  setAttrFromPack('meta[name="twitter:description"]', 'content');

  // Self-referential canonical + og:url for THIS language, so search engines
  // index the translated page instead of treating it as a duplicate of English.
  const addLang = (url) => {
    if (!url) return url;
    return url + (url.includes('?') ? '&' : '?') + 'lang=' + lang;
  };
  const can = doc.querySelector('link[rel="canonical"]');
  if (can && can.getAttribute('href')) can.setAttribute('href', addLang(can.getAttribute('href')));
  const ogu = doc.querySelector('meta[property="og:url"]');
  if (ogu && ogu.getAttribute('content')) ogu.setAttribute('content', addLang(ogu.getAttribute('content')));

  // Language signal + a marker telling client i18n.js this page is already
  // translated server-side, so it skips re-translating (avoids wasted AI calls).
  try {
    doc.documentElement.setAttribute('lang', lang);
    doc.documentElement.setAttribute('data-i18n-ssr', lang);
  } catch (e) {}

  // canonical/lang are structural improvements even if no strings matched, but
  // only bother returning a rewritten doc when we actually translated content.
  if (!applied) return null; // nothing translated → let caller serve original
  return '<!doctype html>\n' + doc.documentElement.outerHTML;
}
