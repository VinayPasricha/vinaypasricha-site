/* =============================================================
   i18n.js — site-wide translation engine
   =============================================================
   How it works
   -----------
   1. Detects the visitor's preferred language (?lang=X in URL,
      then localStorage 'preferredLang', then 'en').
   2. Walks the DOM for translatable text nodes (skips brand,
      code, monospace, and anything tagged data-no-translate).
   3. For each uncached string, asks Claude to translate.
   4. Caches by sha-1 of (lang + source) so a string is translated
      ONCE across the whole site.
   5. Applies translations as they arrive — page stays usable
      throughout; never blocks render.

   Adding new languages: just add to LANGUAGES below.
   Translatable content: anything inside the body that is NOT
     inside <script>, <style>, <code>, <pre>, <textarea>, <input>,
     element with class 'mono', or with data-no-translate.
   ============================================================= */

const I18N_LANGUAGES = {
  en: { native: 'English',    english: 'English'    },
  hi: { native: 'हिन्दी',       english: 'Hindi'      },
  bn: { native: 'বাংলা',       english: 'Bengali'    },
  ta: { native: 'தமிழ்',       english: 'Tamil'      },
  te: { native: 'తెలుగు',       english: 'Telugu'     },
  kn: { native: 'ಕನ್ನಡ',        english: 'Kannada'    },
  es: { native: 'Español',    english: 'Spanish'    },
  fr: { native: 'Français',   english: 'French'     },
  pt: { native: 'Português',  english: 'Portuguese' },
  ja: { native: '日本語',      english: 'Japanese'   },
  zh: { native: '中文',        english: 'Chinese'    },
  ko: { native: '한국어',       english: 'Korean'     },
  ru: { native: 'Русский',    english: 'Russian'    },
};

// Class names / element tags we never translate
const I18N_NO_TRANSLATE_TAGS = new Set([
  'SCRIPT', 'STYLE', 'CODE', 'PRE', 'TEXTAREA', 'INPUT', 'KBD', 'NOSCRIPT'
]);

// Inline phrasing tags. When an element contains text mixed with these
// (e.g. `"I want to <em>stay close</em> to the thinking."`) we translate
// the whole element as a single HTML unit instead of translating each
// text fragment in isolation — Claude can't translate sentence pieces
// coherently.
const I18N_PHRASING_TAGS = new Set([
  'EM', 'STRONG', 'I', 'B', 'SPAN', 'A', 'CODE', 'BR', 'SMALL', 'SUB', 'SUP',
  'MARK', 'ABBR', 'CITE', 'TIME', 'VAR', 'Q', 'U', 'S', 'DEL', 'INS'
]);
const I18N_NO_TRANSLATE_SELECTORS = [
  '[data-no-translate]',
  '.mono',                       // mono-styled labels are editorial UI in English
  '.brand .name',                // the wordmark "Vinay Pasricha" stays in Latin
  '.foot-brand',                 // same wordmark in the footer
  '.code',
  '.book-meta',                  // ISBNs, dates
  '.connect-channel .cc-handle',
  '.vc-tag',                     // hashtags
  '.sub-channel .sc-handle',
  '.lang-menu .native',          // each language stays in its own native script
  // NB: .now-line, .brand (whole), and the rotator items USED to be
  // excluded but are now translated — the seed packs cover "Now",
  // "Explorer of Emergence", and the verbs (Writing/Building/Running),
  // while the Claude system prompt preserves the bracketed proper
  // nouns inside the rotator (e.g. "The Signal", "GoodSpace AI").
];

const I18N_CACHE_KEY = 'i18n.cache.v2';
const I18N_LANG_KEY  = 'preferredLang';

let i18nCache = {};   // { [hash]: 'translated string' }
let i18nQueue = [];   // strings pending translation
let i18nTranslating = false;
let i18nCurrentLang = 'en';
// Reverse lookup populated as we walk the page: { [hash]: 'English source' }.
// Used by exportPack() to bake the live cache back into the JSON pack file
// with human-readable keys.
const i18nSources = {};

/* ---------------- INIT ---------------- */
async function i18nInit() {
  i18nCurrentLang = i18nDetectLang();
  // Reflect on <html lang>
  try { document.documentElement.setAttribute('lang', i18nCurrentLang); } catch (e) {}

  // Wire language switcher links — convert href="#" or href="/hi/" to ?lang=X
  i18nWireSwitcher();

  if (i18nCurrentLang === 'en') return; // nothing to do

  // If the server already rendered this page in this language (SEO SSR), the
  // DOM is translated — skip the client pass to avoid wasted re-translation.
  try {
    if (document.documentElement.getAttribute('data-i18n-ssr') === i18nCurrentLang) return;
  } catch (e) {}

  // Load LOCAL cache (per-browser, populated by past Claude calls)
  i18nCache = i18nLoadCache(i18nCurrentLang);
  i18nLoadSources(i18nCurrentLang);

  // Load SHIPPED translation pack (assets/data/i18n/<lang>.json)
  // — hand-curated + AI-batched, committed to the repo. Merges with
  // local cache so any per-browser additions stay too. Pack wins on
  // collisions because it is the canonical, reviewed translation.
  await i18nLoadPack(i18nCurrentLang);

  // Translate the page
  await i18nTranslatePage();
}

/* Load the shipped translation pack for the current language.
   Drafts in localStorage (Studio editor) take precedence. */
async function i18nLoadPack(lang) {
  let pack = null;
  try {
    const draft = localStorage.getItem('studio.i18n.' + lang);
    if (draft) {
      const d = JSON.parse(draft);
      if (d && d.strings) pack = d.strings;
    }
  } catch (e) {}
  if (!pack) {
    try {
      // Resolve path — work from any depth on the site
      const KNOWN = ['paths', 'signal', 'studio', 'frequency', 'runtime', 'library'];
      const dirSegs = location.pathname.replace(/[^/]*$/, '').split('/').filter(Boolean);
      let prefix = '';
      for (let i = 0; i < dirSegs.length; i++) {
        if (KNOWN.includes(dirSegs[i])) { prefix = '../'.repeat(dirSegs.length - i); break; }
      }
      const url = prefix + 'assets/data/i18n/' + lang + '.json';
      const res = await fetch(url, { cache: 'no-cache' });
      if (res.ok) {
        const d = await res.json();
        if (d && d.strings) pack = d.strings;
      }
    } catch (e) {}
  }
  if (pack) {
    // Pack keys may be either:
    //   (a) the raw English source string (preferred — readable JSON
    //       you can edit in Studio or by hand), or
    //   (b) the FNV-1a hash (compact, legacy form).
    // Convert (a) to hash-keyed entries on load so the cache shape is
    // uniform and lookups stay fast.
    for (const [k, v] of Object.entries(pack)) {
      if (!v) continue;
      // Heuristic: hashes are short alphanumeric, English source is
      // basically anything else (longer, has spaces or punctuation).
      const looksLikeHash = /^[a-z0-9]{1,12}$/.test(k) && !/\s/.test(k);
      const cacheKey = looksLikeHash ? k : i18nTextHash(k.trim());
      i18nCache[cacheKey] = v;
    }
  }
}

function i18nDetectLang() {
  try {
    const url = new URL(window.location);
    const q = url.searchParams.get('lang');
    if (q && I18N_LANGUAGES[q]) {
      localStorage.setItem(I18N_LANG_KEY, q);
      return q;
    }
    const stored = localStorage.getItem(I18N_LANG_KEY);
    if (stored && I18N_LANGUAGES[stored]) return stored;
  } catch (e) {}
  return 'en';
}

function i18nSetLang(code) {
  if (!I18N_LANGUAGES[code]) return;
  try {
    localStorage.setItem(I18N_LANG_KEY, code);
    const url = new URL(window.location);
    if (code === 'en') url.searchParams.delete('lang');
    else url.searchParams.set('lang', code);
    window.location.href = url.toString();
  } catch (e) {}
}

function i18nWireSwitcher() {
  // Update topbar lang button label to current language code
  const labels = document.querySelectorAll('.lang-btn .label');
  labels.forEach(l => l.textContent = i18nCurrentLang.toUpperCase());

  // Wire language menu items
  const menu = document.querySelector('.lang-menu');
  if (!menu) return;
  const items = menu.querySelectorAll('a');
  items.forEach(a => {
    const code = a.querySelector('.code')?.textContent?.toLowerCase();
    if (!code || !I18N_LANGUAGES[code]) return;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      i18nSetLang(code);
    });
    // Reflect current
    if (code === i18nCurrentLang) a.classList.add('current');
    else a.classList.remove('current');
  });
}

/* ---------------- CACHE ---------------- */
function i18nCacheKey(lang) { return `${I18N_CACHE_KEY}.${lang}`; }
function i18nSourcesKey(lang) { return `i18n.sources.v2.${lang}`; }
function i18nLoadCache(lang) {
  try {
    return JSON.parse(localStorage.getItem(i18nCacheKey(lang)) || '{}');
  } catch (e) { return {}; }
}
function i18nLoadSources(lang) {
  try {
    const saved = JSON.parse(localStorage.getItem(i18nSourcesKey(lang)) || '{}');
    Object.assign(i18nSources, saved);
  } catch (e) {}
}
function i18nSaveCache(lang) {
  try {
    localStorage.setItem(i18nCacheKey(lang), JSON.stringify(i18nCache));
    localStorage.setItem(i18nSourcesKey(lang), JSON.stringify(i18nSources));
  } catch (e) {}
}

/* ---------------- DOM WALK ---------------- */
function i18nIsExcluded(parent) {
  let p = parent;
  while (p) {
    if (I18N_NO_TRANSLATE_TAGS.has(p.tagName)) return true;
    if (p.matches?.('[data-no-translate]')) return true;
    for (const sel of I18N_NO_TRANSLATE_SELECTORS) {
      if (p.matches?.(sel)) return true;
    }
    p = p.parentElement;
  }
  return false;
}

// Is `el` made entirely of phrasing-only descendants (no block children,
// no excluded children)?  Used to decide whether an element can be sent
// to Claude as a single HTML translation unit.
function i18nIsPhrasingOnly(el) {
  const kids = el.children;
  for (let i = 0; i < kids.length; i++) {
    const c = kids[i];
    if (!I18N_PHRASING_TAGS.has(c.tagName)) return false;
    if (i18nIsExcluded(c)) return false;
    if (!i18nIsPhrasingOnly(c)) return false;
  }
  return true;
}

// Does `el` contain BOTH real text nodes AND inline phrasing element
// children?  Mixed phrasing parents are exactly the case where text-node-
// at-a-time translation fragments a sentence and produces half-English
// output.
function i18nIsMixedPhrasingParent(el) {
  let hasText = false, hasInline = false;
  for (const n of el.childNodes) {
    if (n.nodeType === 3) {
      if (n.nodeValue && n.nodeValue.trim() && /[A-Za-z]/.test(n.nodeValue)) hasText = true;
    } else if (n.nodeType === 1) {
      if (I18N_PHRASING_TAGS.has(n.tagName)) hasInline = true;
    }
  }
  return hasText && hasInline;
}

// Collect translation units: either an HTML unit (mixed phrasing parent —
// translate innerHTML as one piece) or a plain text node.  HTML units win
// over their descendant text nodes.
function i18nCollectUnits(root) {
  const units = [];
  const handled = new WeakSet();

  // Pass 1: find HTML units (in document order).
  const elWalker = document.createTreeWalker(root || document.body, NodeFilter.SHOW_ELEMENT, {
    acceptNode(el) {
      if (i18nIsExcluded(el)) return NodeFilter.FILTER_REJECT;
      if (i18nIsMixedPhrasingParent(el) && i18nIsPhrasingOnly(el)) {
        return NodeFilter.FILTER_ACCEPT;
      }
      return NodeFilter.FILTER_SKIP;
    }
  });
  let el;
  while ((el = elWalker.nextNode())) {
    // Mark this subtree handled so the text walker (and any nested HTML
    // unit) ignores it.  FILTER_REJECT on the walker also prevents recursion.
    handled.add(el);
    const inner = el.querySelectorAll('*');
    for (let i = 0; i < inner.length; i++) handled.add(inner[i]);
    units.push({ kind: 'html', element: el, source: el.innerHTML.trim() });
  }

  // Pass 2: plain text nodes that are NOT inside a handled HTML unit.
  const textWalker = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const text = node.nodeValue;
      if (!text || !text.trim()) return NodeFilter.FILTER_REJECT;
      if (!/[A-Za-z]/.test(text)) return NodeFilter.FILTER_REJECT;
      if (i18nIsExcluded(node.parentElement)) return NodeFilter.FILTER_REJECT;
      // Skip if any ancestor was claimed by an HTML unit
      let p = node.parentElement;
      while (p) {
        if (handled.has(p)) return NodeFilter.FILTER_REJECT;
        p = p.parentElement;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  let n;
  while ((n = textWalker.nextNode())) units.push({ kind: 'text', node: n, source: n.nodeValue });

  return units;
}

function i18nTextHash(s) {
  // FNV-1a 32-bit, base36 — small + fast, no crypto needed for cache keys
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/* ---------------- TRANSLATE ---------------- */
async function i18nTranslatePage(root) {
  const units = i18nCollectUnits(root);
  if (!units.length) return;

  // Apply any cache hits immediately. Missing strings are grouped by
  // source so we only ask Claude once per unique phrase.
  const missing = new Map(); // sourceText -> [units...]
  for (const u of units) {
    const trimmed = u.source.trim();
    if (!trimmed) continue;
    const key = i18nTextHash(trimmed);
    i18nSources[key] = trimmed;   // remember English for exportPack
    if (i18nCache[key]) {
      i18nApplyTranslation(u, i18nCache[key]);
    } else {
      if (!missing.has(trimmed)) missing.set(trimmed, []);
      missing.get(trimmed).push(u);
    }
  }

  if (missing.size === 0) return;

  // Add an unobtrusive "translating" indicator (suppressed by
  // default — visitors should not be aware translation is happening).
  // To re-enable for debugging: localStorage.setItem('i18n.debug', '1').
  let showIndicator = false;
  try { showIndicator = localStorage.getItem('i18n.debug') === '1'; } catch (e) {}
  if (showIndicator) i18nShowIndicator(missing.size);

  // Batch translate. Plain-text strings batch fine at ~18/chunk, but HTML
  // units are much heavier (each can be a full sentence with attributes),
  // and Claude's 1024-token output cap truncates the JSON if we pack too
  // many in. Pick chunk size by whether the batch contains HTML.
  //
  // Resilience: any entry the batch fails to fill (truncated JSON, bad
  // tag preservation, refusal) is retried INDIVIDUALLY before moving on.
  // A 1-string request cannot overflow the token cap, so the long
  // book/journey paragraphs that used to silently stay in English now
  // recover on the per-string retry.
  const entries = [...missing.entries()];
  for (let i = 0; i < entries.length;) {
    const head = entries[i];
    const looksHTML = /<[a-z][^>]*>/i.test(head[0]);
    const CHUNK = looksHTML ? 4 : 18;
    const chunk = entries.slice(i, i + CHUNK);
    i += CHUNK;

    let translations = [];
    try {
      translations = await i18nClaudeBatch(chunk.map(([t]) => t));
    } catch (err) {
      console.warn('i18n: translation chunk failed', err);
    }

    // Apply whatever came back
    chunk.forEach(([source, unitList], idx) => {
      const tr = translations[idx];
      if (!tr) return;
      const key = i18nTextHash(source);
      i18nCache[key] = tr;
      for (const u of unitList) i18nApplyTranslation(u, tr);
    });

    // Per-string retry for any entry the batch couldn't fill.
    for (let j = 0; j < chunk.length; j++) {
      if (translations[j]) continue;
      const [source, unitList] = chunk[j];
      try {
        const solo = await i18nClaudeBatch([source]);
        const tr = solo[0];
        if (tr) {
          const key = i18nTextHash(source);
          i18nCache[key] = tr;
          for (const u of unitList) i18nApplyTranslation(u, tr);
        }
      } catch (err) {
        console.warn('i18n: solo retry failed for', source.slice(0, 60), err);
      }
    }

    i18nSaveCache(i18nCurrentLang);
  }

  if (showIndicator) i18nHideIndicator();
}

function i18nPreserveSpacing(original, translated) {
  // Carry over leading/trailing whitespace from the original text node
  const leading = (original.match(/^\s*/) || [''])[0];
  const trailing = (original.match(/\s*$/) || [''])[0];
  return leading + translated.trim() + trailing;
}

// Apply a translation to a unit, choosing the right write strategy.
function i18nApplyTranslation(unit, translated) {
  if (!translated) return;
  if (unit.kind === 'text') {
    unit.node.nodeValue = i18nPreserveSpacing(unit.node.nodeValue, translated);
  } else if (unit.kind === 'html' && unit.element) {
    // Sanity check — if Claude dropped or invented tags, fall back to
    // leaving the unit alone rather than wrecking the layout.
    const origTags = (unit.source.match(/<[^>]+>/g) || []).length;
    const newTags  = (translated.match(/<[^>]+>/g) || []).length;
    if (newTags === 0 && origTags > 0) return;
    unit.element.innerHTML = translated.trim();
  }
}

async function i18nClaudeBatch(strings) {
  // No AI bridge available (static hosting without the backend worker):
  // skip live translation quietly. Shipped packs still apply; anything
  // not in the pack simply stays in English instead of throwing.
  if (typeof window.claude === 'undefined' || typeof window.claude?.complete !== 'function') {
    return [];
  }
  const lang = I18N_LANGUAGES[i18nCurrentLang];
  const dict = {};
  strings.forEach((s, i) => { dict[String(i)] = s; });

  const systemPrompt = `You translate website text from English to ${lang.english} (${lang.native}).

CRITICAL RULES:
- Preserve the calm, literary, slightly formal tone of the original.
- Keep proper nouns untranslated: Vinay Pasricha, GoodSpace AI, SIV, SIV Method, AI for Business Leaders, The Execution Doctrine, The Signal, Organizational Frequency, Amazon, YouTube, Instagram, LinkedIn.
- Do NOT translate ISBNs, dates, URLs, email addresses, hashtags, or hex codes.
- Preserve punctuation EXACTLY as in the source (em-dashes, en-dashes, ellipses, quotation marks).
- If a string contains HTML tags (e.g. <em>, <strong>, <a ...>, <span ...>, <br>), KEEP every tag exactly as in the source — same tag name, same attributes, same order, same opening/closing structure. Translate only the visible text BETWEEN the tags. Place the tags around the equivalent words in the translation so the emphasis stays on the right phrase. Never invent, drop, or rename tags.
- Output MUST be valid JSON only — no preamble, no markdown fences. Same keys as input. Each value is the translated string.
- If a string contains both English and proper nouns, translate only the English portions.
- Maintain text length roughly similar where the script allows it.`;

  const userPrompt = `Translate this JSON dictionary to ${lang.english}. Return ONLY the JSON object — no other text.

${JSON.stringify(dict, null, 2)}`;

  const response = await window.claude.complete({
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  // Parse — be lenient if Claude wraps in fences
  let txt = response.trim();
  if (txt.startsWith('```')) {
    txt = txt.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '');
  }
  const lb = txt.indexOf('{');
  const rb = txt.lastIndexOf('}');
  if (lb !== -1 && rb !== -1) txt = txt.slice(lb, rb + 1);

  let parsed;
  try {
    parsed = JSON.parse(txt);
  } catch (e) {
    console.warn('i18n: JSON parse failed', txt);
    return [];
  }
  // Return in same order
  return strings.map((_, i) => parsed[String(i)] || null);
}

/* ---------------- INDICATOR ---------------- */
function i18nShowIndicator(count) {
  let el = document.getElementById('i18n-indicator');
  if (!el) {
    el = document.createElement('div');
    el.id = 'i18n-indicator';
    el.setAttribute('data-no-translate', 'true');
    el.innerHTML = `
      <span class="i18n-spinner"></span>
      <span class="i18n-label">Translating…</span>
    `;
    document.body.appendChild(el);
  }
  el.classList.add('show');
}
function i18nHideIndicator() {
  const el = document.getElementById('i18n-indicator');
  if (el) el.classList.remove('show');
}

/* ---------------- PUBLIC API ---------------- */
window.i18n = {
  init: i18nInit,
  setLang: i18nSetLang,
  currentLang: () => i18nCurrentLang,
  // Call this after dynamic content is rendered (e.g. video cards):
  refresh: (root) => {
    if (i18nCurrentLang === 'en') return;
    return i18nTranslatePage(root);
  },
  languages: I18N_LANGUAGES,
  // Diagnostic / harvest helper. Returns the live cache as a
  // { english_source: translated_string } map so we can bake it back
  // into assets/data/i18n/<lang>.json. Sources are captured during
  // translation; entries with no captured source fall back to the
  // hash key (still loadable by the pack reader).
  exportPack: () => {
    const out = {};
    if (i18nCurrentLang === 'en') return out;
    for (const [key, tr] of Object.entries(i18nCache)) {
      const src = i18nSources[key];
      out[src || key] = tr;
    }
    return out;
  },
};

// Auto-init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', i18nInit);
} else {
  i18nInit();
}
