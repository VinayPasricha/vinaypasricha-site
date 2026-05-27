/* =============================================================
   subscribers-admin.js — the Subscribers room
   =============================================================
   Reads every email-capture localStorage key on the device:
   - 'notebookSubscribers'         — array of {email, capturedAt, source}
                                     (legacy: array of strings)
   - 'notifyEmails'                — object { <slug>: [{email,...}] }
                                     (legacy: object of string arrays)
   - 'aion1.intake.log'            — array of completed AION1 sends
                                     {name, email, role, category, subject, body, sentByBackend, sentAt}

   Surfaces them as lists you can browse, search, and export.
   Once a backend is wired the source switches; the UI doesn't.
   ============================================================= */

const NOTEBOOK_KEY = 'notebookSubscribers';
const NOTIFY_KEY = 'notifyEmails';
const AION_LOG_KEY = 'aion1.intake.log';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

let lists = [];               // [{id, name, source, entries: [{email, capturedAt, source}]}]
let activeListId = null;
let toastTimer;

document.addEventListener('studio:authed', boot);
if (window.studioAuth?.isAuthed?.()) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}

function boot() {
  reload();
  wireUI();
  render();
}

function reload() {
  lists = [];

  // 1. Notebook subscribers
  const notebook = safeJSON(localStorage.getItem(NOTEBOOK_KEY), []);
  lists.push({
    id: 'notebook',
    name: 'Notebook subscribers',
    storageKey: NOTEBOOK_KEY,
    description: 'Emails captured by the "Subscribe" form on paths/blog.html',
    kind: 'email-list',
    entries: normaliseList(notebook, 'notebook'),
  });

  // 2. Book-notify lists (one per slug)
  const notify = safeJSON(localStorage.getItem(NOTIFY_KEY), {});
  for (const [slug, entries] of Object.entries(notify)) {
    lists.push({
      id: 'notify-' + slug,
      name: 'Notify me when published — ' + slug,
      storageKey: NOTIFY_KEY,
      storageSubKey: slug,
      description: 'Captured by "Notify me" buttons on the books page',
      kind: 'email-list',
      entries: normaliseList(entries, 'notify · ' + slug),
    });
  }

  // 3. AION1 intake completions
  const aion = safeJSON(localStorage.getItem(AION_LOG_KEY), []);
  lists.push({
    id: 'aion1',
    name: 'AION1 intake — completed sends',
    storageKey: AION_LOG_KEY,
    description: 'Visitor conversations that completed via AION1 on paths/connect.html',
    kind: 'aion1-log',
    entries: aion,
  });

  if (!activeListId && lists[0]) activeListId = lists[0].id;
}

function safeJSON(s, fallback) {
  try { return s ? JSON.parse(s) : fallback; } catch (e) { return fallback; }
}

function normaliseList(arr, sourceFallback) {
  if (!Array.isArray(arr)) return [];
  return arr.map(e => {
    if (typeof e === 'string') return { email: e, capturedAt: null, source: sourceFallback + ' (legacy)' };
    return {
      email: e.email || '',
      capturedAt: e.capturedAt || null,
      source: e.source || sourceFallback,
    };
  }).filter(e => e.email);
}

function fmtTime(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  return d.toLocaleString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function escapeHTML(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ============================================================
   RENDER
   ============================================================ */
function render() {
  renderTopline();
  renderLists();
  renderDetail();
}

function renderTopline() {
  const totalEmails = lists.reduce((sum, l) => sum + l.entries.length, 0);
  const nonEmpty = lists.filter(l => l.entries.length > 0).length;
  $('#tb-count').textContent = `${totalEmails} capture${totalEmails === 1 ? '' : 's'} across ${nonEmpty} list${nonEmpty === 1 ? '' : 's'}`;
  $('#editor-status').innerHTML = `<span class="saved">Read-only · device-local view</span>`;
}

function renderLists() {
  const host = $('#lists-grid');
  if (!host) return;
  host.innerHTML = lists.map(L => `
    <div class="list-card ${L.id === activeListId ? 'active' : ''}" data-id="${escapeHTML(L.id)}">
      <div class="lc-label">${escapeHTML(L.kind === 'aion1-log' ? 'AION1' : 'Email list')}</div>
      <div class="lc-name"><em>${escapeHTML(L.name)}</em></div>
      <div class="lc-count">${L.entries.length}</div>
      <div class="lc-meta">${L.entries.length === 0 ? 'no captures yet' : 'click to view'}</div>
    </div>
  `).join('');
  host.querySelectorAll('.list-card').forEach(c => {
    c.addEventListener('click', () => {
      activeListId = c.dataset.id;
      render();
    });
  });
}

function renderDetail() {
  const host = $('#list-detail');
  if (!host) return;
  const list = lists.find(l => l.id === activeListId);
  if (!list) { host.innerHTML = ''; return; }

  if (list.entries.length === 0) {
    host.innerHTML = `<div class="empty-state">No captures in <em>${escapeHTML(list.name)}</em> on this device yet.</div>`;
    return;
  }

  if (list.kind === 'aion1-log') {
    host.innerHTML = `
      <div style="font-family: var(--mono); font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--ink-3); margin: 28px 0 16px;">— ${escapeHTML(list.name)} · ${list.entries.length} message${list.entries.length === 1 ? '' : 's'}</div>
      ${list.entries.map((e, idx) => `
        <div class="aion-entry">
          <div class="aion-meta">
            <span class="name">${escapeHTML(e.name || 'Anonymous')}</span>
            <span class="email">${escapeHTML(e.email || '—')}</span>
            ${e.role ? `<span>${escapeHTML(e.role)}</span>` : ''}
            ${e.category ? `<span class="cat">${escapeHTML(e.category)}</span>` : ''}
            <span class="when">${fmtTime(e.sentAt)}</span>
            ${e.sentByBackend ? '<span style="color:#2e7d5b">✓ backend</span>' : '<span style="color:var(--ink-4)">mailto</span>'}
          </div>
          <div class="aion-subject"><em>${escapeHTML(e.subject || '—')}</em></div>
          <div class="aion-body">${escapeHTML(e.body || '')}</div>
          <div class="aion-actions">
            ${e.email ? `<a href="mailto:${encodeURIComponent(e.email)}?subject=Re: ${encodeURIComponent(e.subject || '')}">Reply</a>` : ''}
            <button type="button" data-act="delete-aion" data-idx="${idx}">Delete</button>
          </div>
        </div>
      `).join('')}
    `;
    host.querySelectorAll('button[data-act="delete-aion"]').forEach(b => {
      b.addEventListener('click', () => {
        const idx = +b.dataset.idx;
        const full = safeJSON(localStorage.getItem(AION_LOG_KEY), []);
        full.splice(idx, 1);
        localStorage.setItem(AION_LOG_KEY, JSON.stringify(full));
        reload();
        render();
      });
    });
    return;
  }

  // Generic email list
  host.innerHTML = `
    <div style="font-family: var(--mono); font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--ink-3); margin: 28px 0 16px;">— ${escapeHTML(list.name)} · ${list.entries.length} email${list.entries.length === 1 ? '' : 's'}</div>
    <div class="entry-list">
      ${[...list.entries].sort((a,b) => (b.capturedAt||0) - (a.capturedAt||0)).map((e, idx) => `
        <div class="entry">
          <span class="e-email">${escapeHTML(e.email)}</span>
          <span class="e-time">${fmtTime(e.capturedAt)}</span>
          <span class="e-source">${escapeHTML(e.source || '—')}</span>
        </div>
      `).join('')}
    </div>
  `;
}

/* ============================================================
   CSV EXPORT
   ============================================================ */
function exportCSV() {
  const list = lists.find(l => l.id === activeListId);
  if (!list || !list.entries.length) {
    showToast('Nothing to export');
    return;
  }
  let csv;
  if (list.kind === 'aion1-log') {
    csv = 'sentAt,name,email,role,category,subject,body,sentByBackend\n';
    for (const e of list.entries) {
      csv += [
        new Date(e.sentAt || 0).toISOString(),
        csvEscape(e.name),
        csvEscape(e.email),
        csvEscape(e.role),
        csvEscape(e.category),
        csvEscape(e.subject),
        csvEscape(e.body),
        e.sentByBackend ? 'true' : 'false',
      ].join(',') + '\n';
    }
  } else {
    csv = 'email,capturedAt,source\n';
    for (const e of list.entries) {
      csv += [
        csvEscape(e.email),
        e.capturedAt ? new Date(e.capturedAt).toISOString() : '',
        csvEscape(e.source),
      ].join(',') + '\n';
    }
  }
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = list.id + '.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
  showToast('Exported as CSV');
}

function csvEscape(s) {
  if (s == null) return '';
  const t = String(s);
  if (/[,"\n\r]/.test(t)) return '"' + t.replace(/"/g, '""') + '"';
  return t;
}

/* ============================================================
   CLEAR
   ============================================================ */
function clearList() {
  const list = lists.find(l => l.id === activeListId);
  if (!list || !list.entries.length) { showToast('Nothing to clear'); return; }
  if (!confirm(`Clear all ${list.entries.length} entries from "${list.name}"? This cannot be undone.`)) return;

  if (list.storageSubKey) {
    const full = safeJSON(localStorage.getItem(list.storageKey), {});
    delete full[list.storageSubKey];
    localStorage.setItem(list.storageKey, JSON.stringify(full));
  } else {
    localStorage.removeItem(list.storageKey);
  }
  reload();
  render();
  showToast('Cleared');
}

function showToast(msg) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1600);
}

function wireUI() {
  $('#btn-export').addEventListener('click', exportCSV);
  $('#btn-clear').addEventListener('click', clearList);
}
