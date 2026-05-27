/* =============================================================
   prompts-admin.js — the system-prompts editor
   Lets you edit every AI conversation's system prompt. An empty
   system field falls back to the consumer's inline default.
   ============================================================= */

const PDRAFT = 'studio.prompts';
let pstate = { prompts: {}, updated_at: null };
let pdirty = false;
let expandedKey = null;

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

document.addEventListener('studio:authed', boot);
if (window.studioAuth?.isAuthed?.()) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}

async function boot() {
  pstate = await loadPrompts();
  wireUI();
  render();
}

async function loadPrompts() {
  try {
    const d = JSON.parse(localStorage.getItem(PDRAFT) || 'null');
    if (d && d.prompts) return { prompts: d.prompts, updated_at: d.updated_at };
  } catch (e) {}
  try {
    const res = await fetch('../assets/data/prompts.json', { cache: 'no-cache' });
    if (res.ok) {
      const d = await res.json();
      return { prompts: d.prompts || {}, updated_at: d.updated_at };
    }
  } catch (e) {}
  return { prompts: {}, updated_at: null };
}

function saveDraft() {
  const payload = {
    _comment: 'Studio draft — overrides published prompts.json.',
    updated_at: today(),
    prompts: pstate.prompts,
  };
  localStorage.setItem(PDRAFT, JSON.stringify(payload));
  pdirty = true;
  updateStatus();
}

function today() { return new Date().toISOString().slice(0, 10); }

function updateStatus() {
  const el = $('#editor-status');
  if (el) el.innerHTML = pdirty
    ? '<span class="dirty">Unsaved on this device · publish to deploy</span>'
    : '<span class="saved">All changes saved on this device</span>';
  const count = $('#tb-count');
  if (count) {
    const total = Object.keys(pstate.prompts).length;
    const overridden = Object.values(pstate.prompts).filter(p => (p.system || '').trim()).length;
    count.textContent = `${total} prompt${total === 1 ? '' : 's'} · ${overridden} overriding default`;
  }
}

function escapeHTML(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function escapeAttr(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function render() {
  const host = $('#prompt-list');
  if (!host) return;
  const keys = Object.keys(pstate.prompts);
  if (!keys.length) {
    host.innerHTML = '<div style="padding: 64px 24px; text-align: center; border: 1px dashed var(--rule); background: var(--paper-3); font-family: var(--serif); font-style: italic; color: var(--ink-3);">No prompts file loaded. Try Revert all changes to reload from the repo.</div>';
    updateStatus();
    return;
  }

  host.innerHTML = keys.map(key => renderItem(key, pstate.prompts[key])).join('');

  keys.forEach(key => {
    const el = host.querySelector(`[data-key="${key}"]`);
    if (!el) return;
    el.querySelector('.pli-action-edit')?.addEventListener('click', () => {
      expandedKey = expandedKey === key ? null : key;
      render();
    });
    if (key === expandedKey) wireEditPanel(el, key);
  });

  updateStatus();
}

function renderItem(key, p) {
  const isExpanded = key === expandedKey;
  const usingOverride = (p.system || '').trim().length > 0;
  const hasKb = (p.knowledge_base || '').trim().length > 0;
  const uses = (p.uses || []).join(' · ');

  return `
    <div class="pli ${isExpanded ? 'expanded' : ''}" data-key="${escapeHTML(key)}">
      <div class="pli-head">
        <div>
          <div class="pli-key">
            ${escapeHTML(key)}${p.version ? ' · ' + escapeHTML(p.version) : ''}
            <span class="using ${usingOverride ? '' : 'inline'}">
              ${usingOverride ? 'Overriding default' : 'Using inline default'}
            </span>
            ${hasKb ? '<span class="using" style="background:#3a2a18;color:#d4a574;">+ Knowledge base</span>' : ''}
          </div>
          <div class="pli-name">${escapeHTML(p.name || key)}</div>
          <div class="pli-desc">${escapeHTML(p.description || '')}</div>
          ${uses ? `<div class="pli-uses">In use on: ${escapeHTML(uses)}</div>` : ''}
        </div>
        <div class="pli-actions">
          <button class="pli-action ${isExpanded ? 'primary' : ''} pli-action-edit" type="button">${isExpanded ? 'Close' : 'Edit prompt'}</button>
        </div>
      </div>
      ${isExpanded ? renderEditPanel(key, p) : ''}
    </div>
  `;
}

function renderEditPanel(key, p) {
  return `
    <div class="pli-body">
      <div class="meta-row">
        <label>Display name
          <input type="text" data-field="name" value="${escapeAttr(p.name)}">
        </label>
        <label>Version
          <input type="text" data-field="version" value="${escapeAttr(p.version)}" placeholder="v1.0">
        </label>
      </div>

      <label>Description
        <input type="text" data-field="description" value="${escapeAttr(p.description)}" style="width:100%;font-family:var(--sans);font-size:14px;padding:10px 12px;border:1px solid var(--rule);background:var(--paper);border-radius:2px;outline:none;margin-bottom:16px;">
      </label>

      <label>System prompt</label>
      <p class="help">
        The full system prompt sent to Claude. Plain text. <em>An empty field falls back to the inline default in the JS file.</em>
        To start from the inline default, open the relevant page in another tab, open devtools, and inspect the constant
        (e.g. <code>SIV_SYSTEM_PROMPT_DEFAULT</code> on /paths/decisions.html), then paste here.
      </p>
      <textarea data-field="system" rows="20">${escapeHTML(p.system || '')}</textarea>
      <div class="word-count" data-role="word-count"></div>

      <label style="margin-top: 28px;">Knowledge base</label>
      <p class="help">
        The conceptual frame the AI reads <em>alongside</em> the system prompt. Put the
        principles, runtime architecture, detection targets, and failure modes here — anything
        the prompt should reason against but doesn't need to enumerate as rules. The consumer
        appends this to the system prompt at call time, under the heading <code># KNOWLEDGE BASE</code>.
        Leave empty if the system prompt is self-contained.
      </p>
      <textarea data-field="knowledge_base" rows="16" placeholder="Optional. Anything the model should read alongside the rules — principles, detection targets, failure modes, canonical sequences.">${escapeHTML(p.knowledge_base || '')}</textarea>
      <div class="word-count" data-role="kb-count"></div>

      <div class="pli-actions-bottom">
        <div class="actions-left">
          <button class="tb-btn ghost" type="button" data-action="clear">Clear (use inline default)</button>
        </div>
        <div class="actions-right">
          <button class="tb-btn ghost" type="button" data-action="cancel">Close</button>
          <button class="tb-btn primary" type="button" data-action="save">Save changes</button>
        </div>
      </div>
    </div>
  `;
}

function wireEditPanel(el, key) {
  const p = pstate.prompts[key];
  const updates = { ...p };

  const ta = el.querySelector('textarea[data-field="system"]');
  const wc = el.querySelector('[data-role="word-count"]');
  function updateWordCount() {
    const text = ta.value.trim();
    const words = text ? text.split(/\s+/).length : 0;
    const chars = text.length;
    wc.textContent = words === 0 ? 'Empty · will use inline default' : `${words} words · ${chars} chars`;
  }
  if (ta) {
    updateWordCount();
    ta.addEventListener('input', () => {
      updates.system = ta.value;
      updateWordCount();
    });
  }

  // Knowledge-base textarea — same shape as the system prompt, separate field.
  const kbTa = el.querySelector('textarea[data-field="knowledge_base"]');
  const kbWc = el.querySelector('[data-role="kb-count"]');
  function updateKbCount() {
    if (!kbWc) return;
    const text = (kbTa.value || '').trim();
    const words = text ? text.split(/\s+/).length : 0;
    const chars = text.length;
    kbWc.textContent = words === 0 ? 'Empty · no knowledge base attached' : `${words} words · ${chars} chars`;
  }
  if (kbTa) {
    updateKbCount();
    kbTa.addEventListener('input', () => {
      updates.knowledge_base = kbTa.value;
      updateKbCount();
    });
  }

  el.querySelectorAll('input[data-field]').forEach(inp => {
    inp.addEventListener('input', () => { updates[inp.dataset.field] = inp.value; });
  });

  el.querySelector('[data-action="clear"]').addEventListener('click', () => {
    if (ta) ta.value = '';
    updates.system = '';
    updateWordCount();
    if (kbTa) kbTa.value = '';
    updates.knowledge_base = '';
    updateKbCount();
  });
  el.querySelector('[data-action="cancel"]').addEventListener('click', () => {
    expandedKey = null;
    render();
  });
  el.querySelector('[data-action="save"]').addEventListener('click', () => {
    Object.assign(p, updates);
    saveDraft();
    expandedKey = null;
    render();
    showToast('Saved');
  });
}

function publishAndDownload() {
  const payload = {
    _comment: 'System prompts for AI conversations on the site. An empty system field falls back to the inline default in the consumer JS.',
    updated_at: today(),
    prompts: pstate.prompts,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'prompts.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
  pdirty = false; updateStatus();
  $('#publish-overlay').style.display = 'flex';
}

function resetChanges() {
  if (!confirm('Discard all local prompt edits?')) return;
  localStorage.removeItem(PDRAFT);
  location.reload();
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
  $('#btn-publish').addEventListener('click', publishAndDownload);
  $('#btn-reset').addEventListener('click', resetChanges);
  $('#publish-close').addEventListener('click', () => $('#publish-overlay').style.display = 'none');
}
