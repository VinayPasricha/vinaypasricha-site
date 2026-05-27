/* =============================================================
   books-admin.js — the books editor
   Same pattern as notebook-admin.js and videos-admin.js.
   ============================================================= */

const DRAFT_KEY = 'studio.books';

let state = { books: [], updated_at: null };
let dirty = false;
let expandedSlug = null;

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

document.addEventListener('studio:authed', boot);
if (window.studioAuth?.isAuthed?.()) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}

async function boot() { state = await loadBooks(); wireUI(); render(); }

async function loadBooks() {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    if (d && Array.isArray(d.books)) return { books: d.books, updated_at: d.updated_at };
  } catch (e) {}
  try {
    const res = await fetch('../assets/data/books.json', { cache: 'no-cache' });
    if (res.ok) {
      const d = await res.json();
      return { books: Array.isArray(d.books) ? d.books : [], updated_at: d.updated_at };
    }
  } catch (e) {}
  return { books: [], updated_at: null };
}

function saveDraft() {
  const payload = { _comment: 'Studio draft — overrides published books.json until you publish.', updated_at: today(), books: state.books };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
  dirty = true;
  updateStatus();
}

function today() { return new Date().toISOString().slice(0, 10); }

function updateStatus() {
  const el = $('#editor-status');
  if (el) el.innerHTML = dirty
    ? '<span class="dirty">Unsaved on this device · publish to deploy</span>'
    : '<span class="saved">All changes saved on this device</span>';
  const count = $('#tb-count');
  if (count) {
    const n = state.books.length;
    const pub = state.books.filter(b => b.status === 'published').length;
    count.textContent = `${n} book${n === 1 ? '' : 's'} · ${pub} published`;
  }
}

function slugify(s) {
  return String(s || '').toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 64);
}
function uniqueSlug(base) {
  let slug = base || 'untitled';
  if (!state.books.find(b => b.slug === slug)) return slug;
  let i = 2;
  while (state.books.find(b => b.slug === `${slug}-${i}`)) i++;
  return `${slug}-${i}`;
}
function nextVolume() {
  const used = new Set(state.books.map(b => b.volume));
  const romans = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
  return romans.find(r => !used.has(r)) || String(state.books.length + 1);
}
function escapeHTML(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function escapeAttr(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function stripHTML(s) { return String(s || '').replace(/<[^>]+>/g, ''); }

// Per-language Amazon URLs: serialize an object to lines like "hi: https://..."
function renderLangMap(map) {
  if (!map || typeof map !== 'object') return '';
  return Object.entries(map)
    .filter(([k, v]) => k && v)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
}
function parseLangMap(text) {
  const out = {};
  if (!text) return out;
  text.split(/\r?\n/).forEach(line => {
    const m = line.match(/^\s*([a-z]{2})\s*[:=]\s*(.+?)\s*$/i);
    if (m) out[m[1].toLowerCase()] = m[2];
  });
  return out;
}

function render() {
  const host = $('#book-list');
  if (!host) return;
  if (!state.books.length) {
    host.innerHTML = `<div class="bl-empty"><p>No books yet. Add one above — a working title is enough to begin.</p></div>`;
    updateStatus();
    return;
  }
  host.innerHTML = state.books.map(renderItem).join('');
  $$('.bli').forEach(el => {
    const slug = el.dataset.slug;
    const b = state.books.find(x => x.slug === slug);
    if (!b) return;
    el.querySelector('.bli-action-edit')?.addEventListener('click', () => { expandedSlug = expandedSlug === slug ? null : slug; render(); });
    el.querySelector('.bli-action-delete')?.addEventListener('click', () => {
      if (confirm(`Delete "${stripHTML(b.title)}"? This cannot be undone before publishing.`)) {
        state.books = state.books.filter(x => x.slug !== slug);
        saveDraft(); render();
      }
    });
    el.querySelector('.bli-action-up')?.addEventListener('click', () => moveBook(slug, -1));
    el.querySelector('.bli-action-down')?.addEventListener('click', () => moveBook(slug, +1));
    el.querySelector('.bli-action-toggle')?.addEventListener('click', () => {
      b.status = b.status === 'published' ? 'upcoming' : 'published';
      saveDraft(); render();
    });
    if (slug === expandedSlug) wireEditPanel(el, b);
  });
  updateStatus();
}

function moveBook(slug, delta) {
  const i = state.books.findIndex(b => b.slug === slug);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= state.books.length) return;
  [state.books[i], state.books[j]] = [state.books[j], state.books[i]];
  saveDraft(); render();
}

function renderItem(b) {
  const isExpanded = b.slug === expandedSlug;
  const coverHTML = b.cover
    ? `<img src="../${b.cover}" alt="cover" onerror="this.style.display='none';this.nextElementSibling&&(this.nextElementSibling.style.display='flex')"><div class="placeholder" style="display:none">No cover</div>`
    : `<div class="placeholder">No cover</div>`;
  return `
    <div class="bli ${b.status === 'upcoming' ? 'upcoming' : ''} ${isExpanded ? 'expanded' : ''}" data-slug="${escapeHTML(b.slug)}">
      <div class="bli-num">${escapeHTML(b.volume || '—')}</div>
      <div class="bli-cover">${coverHTML}</div>
      <div class="bli-body">
        <div class="bli-title">${b.title || '<em>Untitled</em>'}</div>
        <div class="bli-meta">
          <span class="status-${b.status}">${(b.status || 'published').toUpperCase()}</span>
          <span class="dot">·</span>
          <span>${escapeHTML(b.year || '')}</span>
          ${b.pages ? `<span class="dot">·</span><span>${b.pages} pp</span>` : ''}
          ${b.isbn ? `<span class="dot">·</span><span>${escapeHTML(b.isbn)}</span>` : ''}
        </div>
      </div>
      <div class="bli-actions">
        <button class="bli-action bli-action-up" type="button" title="Move up">↑</button>
        <button class="bli-action bli-action-down" type="button" title="Move down">↓</button>
        <button class="bli-action bli-action-toggle" type="button">${b.status === 'published' ? 'Mark Upcoming' : 'Publish'}</button>
        <button class="bli-action bli-action-edit" type="button">${isExpanded ? 'Close' : 'Edit'}</button>
        <button class="bli-action bli-action-delete danger" type="button">Delete</button>
      </div>
      ${isExpanded ? renderEditPanel(b) : ''}
    </div>
  `;
}

function renderEditPanel(b) {
  return `
    <div class="bli-edit">
      <label class="full">
        Title <span class="help">May include &lt;em&gt;…&lt;/em&gt; for italics.</span>
        <input type="text" data-field="title" value="${escapeAttr(b.title)}">
      </label>
      <label class="full">
        Subtitle
        <input type="text" data-field="subtitle" value="${escapeAttr(b.subtitle)}">
      </label>
      <label>Slug<input type="text" data-field="slug" value="${escapeAttr(b.slug)}"></label>
      <label>Volume<input type="text" data-field="volume" value="${escapeAttr(b.volume)}" placeholder="I, II, III..."></label>
      <label>Status
        <select data-field="status">
          <option value="published" ${b.status === 'published' ? 'selected' : ''}>Published</option>
          <option value="upcoming" ${b.status === 'upcoming' ? 'selected' : ''}>Upcoming</option>
        </select>
      </label>
      <label>Year<input type="text" data-field="year" value="${escapeAttr(b.year)}" placeholder="2025 or Late 2026"></label>
      <label>Pages<input type="number" data-field="pages" value="${b.pages || ''}"></label>
      <label>ISBN<input type="text" data-field="isbn" value="${escapeAttr(b.isbn)}"></label>
      <label class="full">Cover path <span class="help">Relative to site root, e.g. assets/images/foo.jpg</span>
        <input type="text" data-field="cover" value="${escapeAttr(b.cover)}">
      </label>
      <label class="full">Pitch (one paragraph)
        <textarea data-field="pitch">${escapeHTML(b.pitch || '')}</textarea>
      </label>
      <label class="full">Topics covered <span class="help">One per line</span>
        <textarea data-field="topics" rows="5">${escapeHTML((b.topics || []).join('\n'))}</textarea>
      </label>
      <label class="full">Amazon URL (English default)<input type="url" data-field="amazon" value="${escapeAttr(b.amazon)}"></label>
      <label class="full">Amazon URLs per language <span class="help">One per line, format: <code>code: URL</code> — e.g. <code>hi: https://www.amazon.in/dp/...</code>. Codes: hi, bn, ta, te, kn, es, fr, pt, ja, zh, ko, ru. English (en) uses the default above. Leave blank to fall back to the default.</span>
        <textarea data-field="amazon_by_lang" rows="6" placeholder="hi: https://www.amazon.in/dp/HINDI_ASIN
bn: https://www.amazon.in/dp/BENGALI_ASIN
...">${escapeHTML(renderLangMap(b.amazon_by_lang))}</textarea>
      </label>
      <label class="full">Excerpt path <span class="help">Path page for this book, e.g. paths/decisions.html</span>
        <input type="text" data-field="excerpt_path" value="${escapeAttr(b.excerpt_path)}">
      </label>
      <label class="full">Series label <span class="help">Optional, e.g. "A Doctrine for the Future of Work · 01"</span>
        <input type="text" data-field="series" value="${escapeAttr(b.series)}">
      </label>
      <div class="bli-edit-actions">
        <button class="tb-btn ghost" type="button" data-action="cancel">Close</button>
        <button class="tb-btn primary" type="button" data-action="save">Save changes</button>
      </div>
    </div>
  `;
}

function wireEditPanel(el, b) {
  const updates = { ...b };
  el.querySelectorAll('[data-field]').forEach(input => {
    input.addEventListener('input', () => {
      const f = input.dataset.field;
      let v = input.value;
      if (f === 'topics') v = v.split('\n').map(t => t.trim()).filter(Boolean);
      if (f === 'pages') v = v ? Number(v) : null;
      if (f === 'amazon_by_lang') v = parseLangMap(v);
      updates[f] = v;
    });
  });
  el.querySelector('[data-action="cancel"]').addEventListener('click', () => { expandedSlug = null; render(); });
  el.querySelector('[data-action="save"]').addEventListener('click', () => {
    const newSlug = slugify(updates.slug || updates.title);
    if (newSlug !== b.slug && state.books.find(x => x.slug === newSlug)) {
      alert(`The slug "${newSlug}" is already in use.`);
      return;
    }
    Object.assign(b, updates);
    b.slug = newSlug;
    saveDraft();
    expandedSlug = null;
    render();
    showToast('Saved');
  });
}

function createBook(title) {
  const book = {
    slug: uniqueSlug(slugify(title)),
    volume: nextVolume(),
    title: title,
    subtitle: '',
    cover: '',
    year: '',
    pages: null,
    isbn: null,
    status: 'upcoming',
    pitch: '',
    topics: [],
    amazon: null,
    excerpt_path: null,
  };
  state.books.push(book);
  saveDraft();
  expandedSlug = book.slug;
  render();
  showToast('Book added');
}

function publishAndDownload() {
  const payload = { _comment: 'The books — published canon. Generated by Studio.', updated_at: today(), books: state.books };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'books.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
  dirty = false; updateStatus();
  $('#publish-overlay').style.display = 'flex';
}

function resetChanges() {
  if (!confirm('Discard all local changes and reload from books.json?')) return;
  localStorage.removeItem(DRAFT_KEY);
  location.reload();
}

function importJSON(file) {
  const r = new FileReader();
  r.onload = (e) => {
    try {
      const d = JSON.parse(e.target.result);
      if (!Array.isArray(d.books)) throw new Error('No books array');
      state.books = d.books;
      saveDraft(); render();
      showToast('Imported');
    } catch (err) { alert('Could not parse that file.'); }
  };
  r.readAsText(file);
}

let toastTimer;
function showToast(msg) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1600);
}

function wireUI() {
  $('#qa-btn').addEventListener('click', () => {
    const inp = $('#qa-title');
    const t = inp.value.trim();
    if (t.length < 2) {
      const err = $('#qa-error');
      err.textContent = 'Give the book a working title.';
      err.style.display = '';
      return;
    }
    $('#qa-error').style.display = 'none';
    createBook(t);
    inp.value = '';
  });
  $('#qa-title').addEventListener('keydown', e => { if (e.key === 'Enter') $('#qa-btn').click(); });
  $('#btn-publish').addEventListener('click', publishAndDownload);
  $('#btn-reset').addEventListener('click', resetChanges);
  $('#btn-import').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', e => { const f = e.target.files[0]; if (f) importJSON(f); e.target.value = ''; });
  $('#publish-close').addEventListener('click', () => $('#publish-overlay').style.display = 'none');
}
