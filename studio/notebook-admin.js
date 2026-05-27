/* =============================================================
   notebook-admin.js — the essay editor
   =============================================================
   Mirrors videos-admin.js. Loads from assets/data/notebook.json,
   keeps a localStorage draft as you edit, and "Publish & download"
   exports a fresh notebook.json you replace in the repo.

   Essay shape:
   {
     slug:        "first-shape-hard-decision",  // unique, URL-safe
     title:       "The first shape of a hard decision",  // may contain <em>
     dek:         "Why the first articulation of a problem determines …",
     date:        "2026-06-07",      // ISO YYYY-MM-DD
     monthLabel:  "June 2026",       // human display
     tags:        ["siv", "decisions"],
     readingMin:  8,
     status:      "published" | "draft",
     body:        "markdown body of the essay"
   }
   ============================================================= */

const DRAFT_KEY = 'studio.notebook';

let editorState = {
  essays: [],
  updated_at: null,
};
let dirty = false;
let expandedSlug = null;

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

document.addEventListener('studio:authed', boot);
if (window.studioAuth && window.studioAuth.isAuthed && window.studioAuth.isAuthed()) {
  // Already authed; wait for DOMContentLoaded then boot
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}

async function boot() {
  editorState = await loadEssays();
  wireUI();
  render();
}

async function loadEssays() {
  // Drafts in localStorage take precedence (so you can preview your edits)
  try {
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) {
      const d = JSON.parse(draft);
      if (Array.isArray(d.essays)) return { essays: d.essays, updated_at: d.updated_at };
    }
  } catch (e) {}
  // Published file
  try {
    const res = await fetch('../assets/data/notebook.json', { cache: 'no-cache' });
    if (res.ok) {
      const d = await res.json();
      return { essays: Array.isArray(d.essays) ? d.essays : [], updated_at: d.updated_at };
    }
  } catch (e) {}
  return { essays: [], updated_at: null };
}

function saveDraft() {
  const payload = {
    _comment: 'Studio draft — overrides published notebook.json until you publish.',
    updated_at: today(),
    essays: editorState.essays,
  };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
  dirty = true;
  updateStatus();
}

function updateStatus() {
  const el = $('#editor-status');
  if (!el) return;
  if (dirty) {
    el.innerHTML = '<span class="dirty">Unsaved on this device · publish to deploy</span>';
  } else {
    el.innerHTML = '<span class="saved">All changes saved on this device</span>';
  }
  const count = $('#tb-count');
  if (count) {
    const n = editorState.essays.length;
    const pubN = editorState.essays.filter(e => e.status === 'published').length;
    count.textContent = `${n} essay${n === 1 ? '' : 's'} · ${pubN} published`;
  }
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthLabelFor(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 64);
}

function uniqueSlug(base) {
  let slug = base || 'untitled';
  if (!editorState.essays.find(e => e.slug === slug)) return slug;
  let i = 2;
  while (editorState.essays.find(e => e.slug === `${slug}-${i}`)) i += 1;
  return `${slug}-${i}`;
}

function escapeHTML(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ============================================================
   MARKDOWN — tiny subset renderer (also used by public reader)
   - headings: # ## ###
   - bold: **x**, italic: *x* or _x_
   - links: [text](url)
   - blockquote: > line
   - hr: ---
   - lists: not yet (keep it dead simple for v1)
   - inline <em>, <strong>, <br> are preserved
   ============================================================ */
function renderMarkdown(md) {
  if (!md) return '<p class="empty">— Start writing the essay body. Plain English. Short paragraphs. Markdown supported.</p>';
  let html = String(md).trim();

  // Escape HTML — but preserve a small safelist of inline tags
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  html = html.replace(/&lt;(\/?(?:em|strong|i|b|br))&gt;/g, '<$1>');
  html = html.replace(/&lt;(\/?(?:em|strong|i|b|br))\s*\/?&gt;/g, '<$1>');

  // Block elements (line-anchored)
  html = html.replace(/^### +(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## +(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# +(.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/^&gt; +(.+)$/gm, '<blockquote>$1</blockquote>');
  html = html.replace(/^---+\s*$/gm, '<hr>');

  // Inline — bold before italic so we don't eat ** as two single *
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  html = html.replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');

  // Paragraph wrapping — split on blank lines
  const blocks = html.split(/\n\s*\n/);
  html = blocks.map(b => {
    const t = b.trim();
    if (!t) return '';
    if (/^<(h\d|blockquote|hr|ul|ol|pre)/.test(t)) return t;
    return '<p>' + t.replace(/\n/g, '<br>') + '</p>';
  }).join('\n');

  return html;
}

// Expose so the public-facing essay reader can use the exact same renderer
window.notebookMarkdown = renderMarkdown;

function approxReadingMin(body) {
  const words = String(body || '').trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 220));
}

/* ============================================================
   RENDER
   ============================================================ */
function render() {
  const list = $('#essay-list');
  if (!list) return;

  if (!editorState.essays.length) {
    list.innerHTML = `
      <div class="el-empty">
        <p>No essays yet. Begin one above — a working title is enough to create a draft.</p>
      </div>
    `;
    updateStatus();
    return;
  }

  // Sort: drafts first (most recently edited), then published by date desc
  const sorted = [...editorState.essays].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'draft' ? -1 : 1;
    return (b.date || '').localeCompare(a.date || '');
  });

  list.innerHTML = sorted.map(e => renderItem(e)).join('');

  // Wire item actions
  $$('.eli').forEach(el => {
    const slug = el.dataset.slug;
    const e = editorState.essays.find(x => x.slug === slug);
    if (!e) return;

    el.querySelector('.eli-action-edit')?.addEventListener('click', () => toggleExpand(slug));
    el.querySelector('.eli-action-delete')?.addEventListener('click', () => {
      if (confirm(`Delete "${stripHTML(e.title)}"? This cannot be undone before publishing.`)) {
        editorState.essays = editorState.essays.filter(x => x.slug !== slug);
        saveDraft();
        render();
      }
    });
    el.querySelector('.eli-action-toggle')?.addEventListener('click', () => {
      e.status = e.status === 'published' ? 'draft' : 'published';
      saveDraft();
      render();
    });

    if (slug === expandedSlug) wireEditPanel(el, e);
  });

  updateStatus();
}

function renderItem(e) {
  const isExpanded = e.slug === expandedSlug;
  const reading = approxReadingMin(e.body);
  const tagsHTML = (e.tags || []).map(t => `<span class="tag">${escapeHTML(t)}</span>`).join(' ');

  return `
    <div class="eli ${e.status === 'draft' ? 'draft' : ''} ${isExpanded ? 'expanded' : ''}" data-slug="${escapeHTML(e.slug)}">
      <div class="eli-handle" title="Drag to reorder (later)">⋮⋮</div>
      <div class="eli-date">
        ${escapeHTML(e.monthLabel || monthLabelFor(e.date) || '—')}
        <span class="yr">${escapeHTML(e.date || '')}</span>
      </div>
      <div class="eli-body">
        <div class="eli-title">${e.title || '<em>Untitled</em>'}</div>
        <div class="eli-meta">
          <span class="status-${e.status || 'draft'}">${(e.status || 'draft').toUpperCase()}</span>
          <span class="dot">·</span>
          <span class="reading">${reading} min read</span>
          ${tagsHTML ? `<span class="dot">·</span>${tagsHTML}` : ''}
          <span class="dot">·</span>
          <span class="slug">/${escapeHTML(e.slug)}</span>
        </div>
      </div>
      <div class="eli-actions">
        <button class="eli-action eli-action-toggle" type="button">${e.status === 'published' ? 'Unpublish' : 'Publish'}</button>
        <button class="eli-action eli-action-edit" type="button">${isExpanded ? 'Close' : 'Edit'}</button>
        <button class="eli-action eli-action-delete danger" type="button">Delete</button>
      </div>
      ${isExpanded ? renderEditPanel(e) : ''}
    </div>
  `;
}

function renderEditPanel(e) {
  return `
    <div class="eli-edit">
      <label class="full">
        Title <span class="help">May include &lt;em&gt;…&lt;/em&gt; for italics.</span>
        <input class="title-input" type="text" data-field="title" value="${escapeAttr(e.title)}">
      </label>

      <label class="full">
        Subtitle / dek <span class="help">A single italic line shown beneath the title.</span>
        <input type="text" data-field="dek" value="${escapeAttr(e.dek)}">
      </label>

      <label>
        Slug (URL)
        <input type="text" data-field="slug" value="${escapeAttr(e.slug)}">
      </label>

      <label>
        Status
        <select data-field="status">
          <option value="draft" ${e.status === 'draft' ? 'selected' : ''}>Draft</option>
          <option value="published" ${e.status === 'published' ? 'selected' : ''}>Published</option>
        </select>
      </label>

      <label>
        Date (ISO YYYY-MM-DD)
        <input type="date" data-field="date" value="${escapeAttr(e.date)}">
      </label>

      <label>
        Tags (comma-separated)
        <input type="text" data-field="tags" value="${escapeAttr((e.tags || []).join(', '))}">
      </label>

      <div class="eli-edit-split">
        <label class="full">
          Body <span class="help">Markdown. Blank lines between paragraphs. **bold**, *italic*, [link](url), # heading, &gt; blockquote, --- divider.</span>
        </label>
        <div>
          <textarea class="body" data-field="body" rows="20" placeholder="Begin the essay. One thought per paragraph. Short sentences. Plain English.">${escapeHTML(e.body || '')}</textarea>
        </div>
        <div class="eli-edit-preview" data-role="preview">${renderMarkdown(e.body)}</div>
      </div>

      <div class="eli-edit-actions">
        <button class="tb-btn ghost" type="button" data-action="cancel">Close</button>
        <button class="tb-btn primary" type="button" data-action="save">Save changes</button>
      </div>
    </div>
  `;
}

function escapeAttr(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function stripHTML(s) { return String(s || '').replace(/<[^>]+>/g, ''); }

function toggleExpand(slug) {
  expandedSlug = expandedSlug === slug ? null : slug;
  render();
}

function wireEditPanel(el, e) {
  const updates = { ...e };

  el.querySelectorAll('[data-field]').forEach(input => {
    input.addEventListener('input', () => {
      const field = input.dataset.field;
      let val = input.value;
      if (field === 'tags') val = val.split(',').map(t => t.trim()).filter(Boolean);
      updates[field] = val;
      // Live preview body
      if (field === 'body') {
        const prev = el.querySelector('[data-role="preview"]');
        if (prev) prev.innerHTML = renderMarkdown(val);
      }
    });
  });

  el.querySelector('[data-action="cancel"]').addEventListener('click', () => {
    expandedSlug = null;
    render();
  });
  el.querySelector('[data-action="save"]').addEventListener('click', () => {
    // Validate slug
    const newSlug = slugify(updates.slug || updates.title);
    if (newSlug !== e.slug && editorState.essays.find(x => x.slug === newSlug)) {
      alert(`The slug "${newSlug}" is already in use by another essay. Choose a different slug.`);
      return;
    }
    Object.assign(e, updates);
    e.slug = newSlug;
    if (e.date) e.monthLabel = monthLabelFor(e.date);
    e.readingMin = approxReadingMin(e.body);
    saveDraft();
    expandedSlug = null;
    render();
    showToast('Saved');
  });
}

/* ============================================================
   CREATE / IMPORT / RESET / PUBLISH
   ============================================================ */
function createDraft(title) {
  const date = today();
  const newEssay = {
    slug: uniqueSlug(slugify(title)),
    title: title,
    dek: '',
    date: date,
    monthLabel: monthLabelFor(date),
    tags: [],
    readingMin: 1,
    status: 'draft',
    body: '',
  };
  editorState.essays.unshift(newEssay);
  saveDraft();
  expandedSlug = newEssay.slug;
  render();
  showToast('Draft created');
}

function publishAndDownload() {
  const payload = {
    _comment: 'The Monthly Notebook — published essays. Generated by Studio.',
    updated_at: today(),
    essays: editorState.essays,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'notebook.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
  dirty = false;
  updateStatus();
  $('#publish-overlay').style.display = 'flex';
}

function resetChanges() {
  if (!confirm('Discard all local changes and reload the published essays from the repo?')) return;
  localStorage.removeItem(DRAFT_KEY);
  location.reload();
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data.essays)) throw new Error('No "essays" array');
      editorState.essays = data.essays;
      saveDraft();
      render();
      showToast('Imported');
    } catch (err) {
      alert("Couldn't read that file. Make sure it's a notebook.json with an \"essays\" array.");
    }
  };
  reader.readAsText(file);
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

/* ============================================================
   WIRE UI
   ============================================================ */
function wireUI() {
  $('#qa-btn').addEventListener('click', () => {
    const inp = $('#qa-title');
    const title = inp.value.trim();
    if (title.length < 3) {
      const err = $('#qa-error');
      err.textContent = 'Give the draft a working title (3+ characters).';
      err.style.display = '';
      return;
    }
    $('#qa-error').style.display = 'none';
    createDraft(title);
    inp.value = '';
  });
  $('#qa-title').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#qa-btn').click();
  });
  $('#btn-publish').addEventListener('click', publishAndDownload);
  $('#btn-reset').addEventListener('click', resetChanges);
  $('#btn-import').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (f) importJSON(f);
    e.target.value = '';
  });
  $('#publish-close').addEventListener('click', () => {
    $('#publish-overlay').style.display = 'none';
  });
}
