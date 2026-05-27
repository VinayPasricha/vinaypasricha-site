/* =============================================================
   i18n-admin.js — the translation editor
   =============================================================
   Workflow:
   1. Discover — fetches every known site page, parses the HTML,
      and extracts translatable strings (same rules as i18n.js).
   2. Translate via AI — sends untranslated strings to Claude in
      chunks of ~20. Same system prompt as i18n.js uses, for tonal
      consistency.
   3. Edit — every translation is inline-editable. Saves to
      localStorage as you type.
   4. Publish & download — exports the language pack as JSON
      (English source → translation), drop it into the repo at
      assets/data/i18n/<lang>.json.
   ============================================================= */

/* Pages on the site that contain translatable copy.
   Add new pages here as the site grows. */
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

/* Languages we offer translations for.
   English is the source — not in this list. */
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

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

let activeLang = 'hi';
let packs = {};                // { hi: { strings, lang_native, updated_at }, ... }
let discoveredStrings = [];    // master list of EN source strings (across all langs)
let dirty = false;
let filter = { search: '', mode: 'all' };
let showLimit = 100;
let toastTimer;

document.addEventListener('studio:authed', boot);
if (window.studioAuth?.isAuthed?.()) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}

async function boot() {
  for (const L of LANGS) packs[L.code] = await loadPack(L.code);
  // Discovered strings = union of keys across all loaded packs
  rebuildDiscovered();
  wireUI();
  render();
}

async function loadPack(lang) {
  try {
    const draft = JSON.parse(localStorage.getItem('studio.i18n.' + lang) || 'null');
    if (draft && draft.strings) return draft;
  } catch (e) {}
  try {
    const res = await fetch('../assets/data/i18n/' + lang + '.json', { cache: 'no-cache' });
    if (res.ok) return await res.json();
  } catch (e) {}
  return { lang, strings: {}, updated_at: null };
}

function saveDraft(lang) {
  const p = packs[lang];
  const payload = {
    _comment: 'Studio draft — overrides published ' + lang + '.json.',
    lang,
    lang_native: p.lang_native,
    updated_at: today(),
    strings: p.strings,
  };
  localStorage.setItem('studio.i18n.' + lang, JSON.stringify(payload));
  dirty = true;
  updateStatus();
}

function today() { return new Date().toISOString().slice(0, 10); }

function rebuildDiscovered() {
  const set = new Set();
  for (const code of Object.keys(packs)) {
    for (const k of Object.keys(packs[code].strings || {})) set.add(k);
  }
  discoveredStrings = [...set].sort((a, b) => a.length - b.length);
}

function updateStatus() {
  const el = $('#editor-status');
  if (el) el.innerHTML = dirty
    ? '<span class="dirty">Unsaved on this device · publish to deploy</span>'
    : '<span class="saved">All changes saved on this device</span>';

  const count = $('#tb-count');
  if (count) {
    const total = discoveredStrings.length;
    const translated = discoveredStrings.filter(s => (packs[activeLang].strings[s] || '').trim()).length;
    count.textContent = `${translated} / ${total} translated · ${activeLang}`;
  }
}

function escapeHTML(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ============================================================
   DISCOVERY — crawl every page and extract translatable strings
   ============================================================ */
async function discoverStrings() {
  showProgress('Discovering strings on the site…');
  const found = new Set(Object.keys(packs[activeLang].strings || {}));
  let pageIdx = 0;
  for (const url of SITE_PAGES) {
    pageIdx++;
    setProgress(pageIdx / SITE_PAGES.length, `Page ${pageIdx}/${SITE_PAGES.length} — ${url}`);
    try {
      const res = await fetch('../' + url, { cache: 'no-cache' });
      if (!res.ok) continue;
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, 'text/html');
      const strings = collectStrings(doc.body);
      for (const s of strings) found.add(s);
    } catch (e) {
      console.warn('discover: failed for', url, e);
    }
  }
  // Initialize empty strings in every pack so the row appears for all langs
  for (const code of Object.keys(packs)) {
    const p = packs[code];
    p.strings = p.strings || {};
    for (const s of found) {
      if (!(s in p.strings)) p.strings[s] = '';
    }
    saveDraft(code);
  }
  rebuildDiscovered();
  hideProgress();
  showToast(`Discovered ${found.size} strings`);
  render();
}

function isExcluded(el) {
  let p = el;
  while (p) {
    if (NO_TRANSLATE_TAGS.has(p.tagName)) return true;
    if (p.hasAttribute && p.hasAttribute('data-no-translate')) return true;
    for (const sel of NO_TRANSLATE_SELECTORS) {
      try { if (p.matches && p.matches(sel)) return true; } catch (e) {}
    }
    p = p.parentElement;
  }
  return false;
}

function collectStrings(root) {
  const out = new Set();
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
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
    if (s.length > 0 && s.length < 800) out.add(s); // skip excessively long strings
  }
  return [...out];
}

/* ============================================================
   TRANSLATION via Claude — same system prompt as i18n.js
   ============================================================ */
async function translateUntranslated() {
  const lang = activeLang;
  const langInfo = LANGS.find(l => l.code === lang);
  if (!langInfo) return;
  const untrans = discoveredStrings.filter(s => !(packs[lang].strings[s] || '').trim());
  if (!untrans.length) { showToast('Nothing left to translate'); return; }
  if (!window.claude || !window.claude.complete) { alert('claude.complete unavailable in this environment'); return; }

  const total = untrans.length;
  showProgress(`Translating ${total} strings to ${langInfo.english}…`);

  const CHUNK = 20;
  let done = 0;
  for (let i = 0; i < untrans.length; i += CHUNK) {
    const chunk = untrans.slice(i, i + CHUNK);
    try {
      const translations = await claudeBatch(chunk, langInfo);
      chunk.forEach((src, idx) => {
        const tr = translations[idx];
        if (tr) packs[lang].strings[src] = tr;
      });
      saveDraft(lang);
    } catch (err) {
      console.warn('translate: chunk failed', err);
    }
    done += chunk.length;
    setProgress(done / total, `Translated ${done}/${total}…`);
  }
  hideProgress();
  showToast('Translation complete');
  render();
}

async function claudeBatch(strings, langInfo) {
  const dict = {};
  strings.forEach((s, i) => { dict[String(i)] = s; });

  const systemPrompt = `You translate website text from English to ${langInfo.english} (${langInfo.native}).

CRITICAL RULES:
- Preserve the calm, literary, slightly formal tone of the original.
- Keep proper nouns untranslated: Vinay Pasricha, GoodSpace AI, SIV, SIV Method, AI for Business Leaders, The Execution Doctrine, The Signal, Organizational Frequency, AION1, Amazon, YouTube, Instagram, LinkedIn.
- Do NOT translate ISBNs, dates, URLs, email addresses, hashtags, or hex codes.
- Preserve punctuation EXACTLY as in the source (em-dashes, en-dashes, ellipses, quotation marks).
- Output MUST be valid JSON only — no preamble, no markdown fences. Same keys as input. Each value is the translated string.
- If a string contains both English and proper nouns, translate only the English portions.
- Maintain text length roughly similar where the script allows it.`;

  const userPrompt = `Translate this JSON dictionary to ${langInfo.english}. Return ONLY the JSON object — no other text.

${JSON.stringify(dict, null, 2)}`;

  const response = await window.claude.complete({
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  let txt = String(response).trim();
  if (txt.startsWith('```')) txt = txt.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '');
  const lb = txt.indexOf('{');
  const rb = txt.lastIndexOf('}');
  if (lb !== -1 && rb !== -1) txt = txt.slice(lb, rb + 1);
  let parsed;
  try { parsed = JSON.parse(txt); } catch (e) { console.warn('translate: parse failed', txt); return []; }
  return strings.map((_, i) => parsed[String(i)] || null);
}

/* ============================================================
   PROGRESS bar
   ============================================================ */
function showProgress(text) {
  $('#progress-host').style.display = '';
  $('#progress-text').textContent = text;
  $('#progress-fill').style.width = '0%';
}
function setProgress(frac, text) {
  $('#progress-fill').style.width = Math.round(frac * 100) + '%';
  if (text) $('#progress-text').textContent = text;
}
function hideProgress() {
  $('#progress-host').style.display = 'none';
}

/* ============================================================
   RENDER
   ============================================================ */
function render() {
  renderLangTabs();
  renderStrings();
  updateStatus();
}

function renderLangTabs() {
  const host = $('#lang-tabs');
  if (!host) return;
  host.innerHTML = LANGS.map(L => {
    const p = packs[L.code] || { strings: {} };
    const total = discoveredStrings.length || Object.keys(p.strings).length;
    const translated = discoveredStrings.filter(s => (p.strings[s] || '').trim()).length;
    const pct = total ? Math.round((translated / total) * 100) : 0;
    return `
      <button class="lang-tab ${L.code === activeLang ? 'active' : ''}" data-code="${L.code}" type="button">
        <span>${L.code.toUpperCase()}</span>
        <span class="native">${escapeHTML(L.native)}</span>
        <span class="count">${pct}%</span>
      </button>
    `;
  }).join('');
  host.querySelectorAll('.lang-tab').forEach(t => {
    t.addEventListener('click', () => {
      activeLang = t.dataset.code;
      showLimit = 100;
      render();
    });
  });
}

function filteredStrings() {
  const q = filter.search.trim().toLowerCase();
  return discoveredStrings.filter(s => {
    const tr = (packs[activeLang].strings[s] || '').trim();
    if (filter.mode === 'translated' && !tr) return false;
    if (filter.mode === 'untranslated' && tr) return false;
    if (q && !s.toLowerCase().includes(q) && !tr.toLowerCase().includes(q)) return false;
    return true;
  });
}

function renderStrings() {
  const host = $('#strings-list');
  const more = $('#btn-show-more');
  if (!host) return;
  const list = filteredStrings();
  const visible = list.slice(0, showLimit);
  if (!discoveredStrings.length) {
    host.innerHTML = `<div style="padding: 64px 24px; text-align: center; border: 1px dashed var(--rule); background: var(--paper-3); font-family: var(--serif); font-style: italic; color: var(--ink-3);">
      No strings yet. Click <strong>Discover strings ↻</strong> to crawl the site.
    </div>`;
    more.style.display = 'none';
    return;
  }
  if (!visible.length) {
    host.innerHTML = `<div style="padding: 48px 24px; text-align: center; font-family: var(--serif); font-style: italic; color: var(--ink-3);">No strings match the current filter.</div>`;
    more.style.display = 'none';
    return;
  }

  host.innerHTML = visible.map((src, idx) => {
    const tr = packs[activeLang].strings[src] || '';
    return `
      <div class="str-row ${tr.trim() ? 'translated' : 'untranslated'}" data-src="${escapeHTML(src)}">
        <div>
          <div class="str-meta">EN · source</div>
          <div class="str-source">${escapeHTML(src)}</div>
        </div>
        <div class="str-translation-wrap">
          <div class="str-meta">${activeLang.toUpperCase()} · ${tr.trim() ? 'translated' : 'untranslated'}</div>
          <textarea class="str-translation" lang="${activeLang}" rows="${Math.max(1, Math.ceil(src.length / 60))}" placeholder="(empty — falls back to live translation)">${escapeHTML(tr)}</textarea>
        </div>
        <div class="str-actions">
          <button class="str-action" data-act="ai" type="button" title="Translate this one via AI">↻ AI</button>
          <button class="str-action danger" data-act="clear" type="button" title="Clear translation">✕</button>
        </div>
      </div>
    `;
  }).join('');

  // Wire textareas
  host.querySelectorAll('.str-translation').forEach(ta => {
    ta.addEventListener('input', () => {
      const row = ta.closest('.str-row');
      const src = row.dataset.src;
      packs[activeLang].strings[src] = ta.value;
      saveDraft(activeLang);
      // Update border class
      row.classList.toggle('translated', !!ta.value.trim());
      row.classList.toggle('untranslated', !ta.value.trim());
    });
  });
  // Wire row actions
  host.querySelectorAll('button[data-act]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const row = btn.closest('.str-row');
      const src = row.dataset.src;
      const act = btn.dataset.act;
      if (act === 'clear') {
        packs[activeLang].strings[src] = '';
        saveDraft(activeLang);
        render();
      } else if (act === 'ai') {
        const langInfo = LANGS.find(l => l.code === activeLang);
        if (!langInfo) return;
        btn.textContent = '…';
        btn.disabled = true;
        try {
          const translations = await claudeBatch([src], langInfo);
          if (translations[0]) {
            packs[activeLang].strings[src] = translations[0];
            saveDraft(activeLang);
            render();
            showToast('Translated');
          }
        } catch (e) { console.warn(e); }
        btn.disabled = false;
      }
    });
  });

  // Show-more
  if (list.length > showLimit) {
    more.style.display = '';
    more.textContent = `Show more (${list.length - showLimit} hidden)`;
  } else {
    more.style.display = 'none';
  }
}

/* ============================================================
   PUBLISH / RESET / TOAST
   ============================================================ */
function publishAndDownload() {
  const lang = activeLang;
  const p = packs[lang];
  const payload = {
    _comment: 'Translation pack for ' + lang + '.json — generated by Studio.',
    lang,
    lang_native: p.lang_native || (LANGS.find(l => l.code === lang)?.native),
    updated_at: today(),
    strings: p.strings,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = lang + '.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
  dirty = false; updateStatus();
  $('#publish-overlay').style.display = 'flex';
}

function resetChanges() {
  if (!confirm('Discard all local changes to ' + activeLang + ' translations?')) return;
  localStorage.removeItem('studio.i18n.' + activeLang);
  location.reload();
}

function showToast(msg) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1600);
}

/* ============================================================
   WIRE UI
   ============================================================ */
function wireUI() {
  $('#btn-discover').addEventListener('click', discoverStrings);
  $('#btn-translate').addEventListener('click', translateUntranslated);
  $('#btn-publish').addEventListener('click', publishAndDownload);
  $('#btn-reset').addEventListener('click', resetChanges);
  $('#publish-close').addEventListener('click', () => $('#publish-overlay').style.display = 'none');

  $('#filter-search').addEventListener('input', e => {
    filter.search = e.target.value;
    showLimit = 100;
    renderStrings();
    updateStatus();
  });
  $$('.filter-pill').forEach(p => {
    p.addEventListener('click', () => {
      $$('.filter-pill').forEach(x => x.classList.remove('active'));
      p.classList.add('active');
      filter.mode = p.dataset.filter;
      showLimit = 100;
      renderStrings();
    });
  });
  $('#btn-show-more').addEventListener('click', () => {
    showLimit += 200;
    renderStrings();
  });
}
