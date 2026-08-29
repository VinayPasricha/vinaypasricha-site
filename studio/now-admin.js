/* =============================================================
   now-admin.js — the "Now" line editor
   ============================================================= */

const NDRAFT = 'studio.now';
let nstate = { items: [], page: { lede: '', sections: [] }, as_of: '', updated_at: null };
let ndirty = false;
let previewTimer;

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

document.addEventListener('studio:authed', boot);
if (window.studioAuth?.isAuthed?.()) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}

async function boot() { nstate = await loadNow(); wireUI(); render(); }

async function loadNow() {
  try {
    const d = JSON.parse(localStorage.getItem(NDRAFT) || 'null');
    if (d && Array.isArray(d.items)) {
      return {
        items: d.items,
        page: d.page || { lede: '', sections: [] },
        as_of: d.as_of || '',
        updated_at: d.updated_at
      };
    }
  } catch (e) {}
  try {
    const res = await fetch('../assets/data/now.json', { cache: 'no-cache' });
    if (res.ok) {
      const d = await res.json();
      return {
        items: Array.isArray(d.items) ? d.items : [],
        page: d.page || { lede: '', sections: [] },
        as_of: d.as_of || '',
        updated_at: d.updated_at
      };
    }
  } catch (e) {}
  return { items: [{ verb: 'Working', subject: 'the Signal field' }], page: { lede: '', sections: [] }, as_of: '', updated_at: null };
}

function saveDraft() {
  const payload = {
    _comment: 'Studio draft — overrides published now.json.',
    updated_at: today(),
    as_of: nstate.as_of,
    items: nstate.items,
    page: nstate.page,
  };
  localStorage.setItem(NDRAFT, JSON.stringify(payload));
  ndirty = true; updateStatus();
}

function today() { return new Date().toISOString().slice(0, 10); }

function updateStatus() {
  const el = $('#editor-status');
  if (el) el.innerHTML = ndirty
    ? '<span class="dirty">Unsaved on this device · publish to deploy</span>'
    : '<span class="saved">All changes saved on this device</span>';
  const count = $('#tb-count');
  if (count) {
    const itemN = nstate.items.length;
    const secN = (nstate.page.sections || []).length;
    count.textContent = `${itemN} rotator item${itemN === 1 ? '' : 's'} · ${secN} /now section${secN === 1 ? '' : 's'}`;
  }
}

function escapeHTML(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function escapeAttr(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function render() {
  const host = $('#now-list');
  if (!host) return;
  if (!nstate.items.length) {
    host.innerHTML = `<div class="bl-empty" style="padding:48px 24px; text-align:center; border:1px dashed var(--rule); background: var(--paper-3);"><p style="font-family: var(--serif); font-style: italic; font-size: 18px; color: var(--ink-3);">No items yet. Add one above.</p></div>`;
  } else {
    host.innerHTML = nstate.items.map((it, idx) => `
      <div class="nli" data-idx="${idx}">
        <div class="nli-handle" title="${idx + 1}">${idx + 1}.</div>
        <input class="verb" type="text" data-field="verb" data-idx="${idx}" value="${escapeAttr(it.verb)}" placeholder="Verb (e.g. Writing)">
        <input class="subject" type="text" data-field="subject" data-idx="${idx}" value="${escapeAttr(it.subject)}" placeholder="Subject (e.g. The Signal)">
        <div class="nli-actions">
          <button class="nli-action" data-act="up" data-idx="${idx}" type="button">↑</button>
          <button class="nli-action" data-act="down" data-idx="${idx}" type="button">↓</button>
          <button class="nli-action danger" data-act="del" data-idx="${idx}" type="button">Delete</button>
        </div>
      </div>
    `).join('');

    host.querySelectorAll('input[data-field]').forEach(el => {
      el.addEventListener('input', () => {
        const idx = +el.dataset.idx;
        nstate.items[idx][el.dataset.field] = el.value;
        saveDraft();
        renderPreview();
      });
    });
    host.querySelectorAll('button[data-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = +btn.dataset.idx;
        const act = btn.dataset.act;
        if (act === 'del') nstate.items.splice(idx, 1);
        if (act === 'up' && idx > 0) [nstate.items[idx - 1], nstate.items[idx]] = [nstate.items[idx], nstate.items[idx - 1]];
        if (act === 'down' && idx < nstate.items.length - 1) [nstate.items[idx], nstate.items[idx + 1]] = [nstate.items[idx + 1], nstate.items[idx]];
        saveDraft();
        render();
      });
    });
  }
  renderPreview();
  renderSections();
  // Wire the lede + as-of inputs (idempotent because they're stable elements)
  const lede = $('#now-lede');
  if (lede && lede.value !== (nstate.page.lede || '')) lede.value = nstate.page.lede || '';
  const asOf = $('#now-as-of');
  if (asOf && asOf.value !== (nstate.as_of || '')) asOf.value = nstate.as_of || '';
  updateStatus();
}

function renderSections() {
  const host = $('#sections-list');
  if (!host) return;
  const secs = nstate.page.sections || [];
  if (!secs.length) {
    host.innerHTML = `<div style="padding: 24px; text-align: center; border: 1px dashed var(--rule); background: var(--paper-3); font-family: var(--serif); font-style: italic; color: var(--ink-3); font-size: 14px;">No sections yet — click <strong>Add a section</strong> below.</div>`;
    return;
  }
  host.innerHTML = secs.map((sec, idx) => `
    <div style="padding: 18px 20px; background: var(--paper-3); border: 1px solid var(--rule); border-radius: 2px; margin-bottom: 12px;">
      <div style="display: grid; grid-template-columns: 32px 1fr auto; gap: 12px; align-items: center; margin-bottom: 12px;">
        <div style="font-family: var(--mono); font-size: 12px; color: var(--ink-4); text-align: center;">${idx + 1}.</div>
        <input type="text" data-sec-field="label" data-sec-idx="${idx}" value="${escapeAttr(sec.label)}" placeholder="Label — e.g. Writing, Reading, Thinking about" style="font-family: var(--mono); font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; padding: 9px 12px; border: 1px solid var(--rule); background: var(--paper); border-radius: 2px; outline: none;">
        <div style="display: flex; gap: 6px;">
          <button class="nli-action" data-sec-act="up" data-sec-idx="${idx}" type="button">↑</button>
          <button class="nli-action" data-sec-act="down" data-sec-idx="${idx}" type="button">↓</button>
          <button class="nli-action danger" data-sec-act="del" data-sec-idx="${idx}" type="button">Delete</button>
        </div>
      </div>
      <textarea data-sec-field="body" data-sec-idx="${idx}" rows="5" placeholder="Markdown body for this section. Blank lines between paragraphs." style="width: 100%; font-family: var(--serif); font-size: 15px; line-height: 1.55; padding: 12px 14px; border: 1px solid var(--rule); background: var(--paper); border-radius: 2px; outline: none; resize: vertical; min-height: 100px;">${escapeHTML(sec.body || '')}</textarea>
    </div>
  `).join('');

  host.querySelectorAll('[data-sec-field]').forEach(el => {
    el.addEventListener('input', () => {
      const idx = +el.dataset.secIdx;
      nstate.page.sections[idx][el.dataset.secField] = el.value;
      saveDraft();
    });
  });
  host.querySelectorAll('button[data-sec-act]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = +btn.dataset.secIdx;
      const act = btn.dataset.secAct;
      const secs = nstate.page.sections;
      if (act === 'del') secs.splice(idx, 1);
      if (act === 'up' && idx > 0) [secs[idx - 1], secs[idx]] = [secs[idx], secs[idx - 1]];
      if (act === 'down' && idx < secs.length - 1) [secs[idx], secs[idx + 1]] = [secs[idx + 1], secs[idx]];
      saveDraft();
      renderSections();
      updateStatus();
    });
  });
}

function renderPreview() {
  const rot = $('#rot-preview');
  if (!rot) return;
  clearInterval(previewTimer);
  if (!nstate.items.length) { rot.innerHTML = '<span class="item active" style="color: rgba(246,241,228,0.4); font-style: italic;">(empty)</span>'; return; }
  rot.innerHTML = nstate.items.map((it, i) => `<span class="item ${i === 0 ? 'active' : ''}">${escapeHTML(it.verb)} <em>${escapeHTML(it.subject)}</em></span>`).join('');
  if (nstate.items.length < 2) return;
  let i = 0;
  const items = rot.querySelectorAll('.item');
  previewTimer = setInterval(() => {
    items[i].classList.remove('active');
    i = (i + 1) % items.length;
    items[i].classList.add('active');
  }, 3800);
}

function publishAndDownload() {
  const payload = {
    _comment: "The 'Now' line in the topbar AND the /now page. Both edited via Studio → Now.",
    updated_at: today(),
    as_of: nstate.as_of,
    items: nstate.items,
    page: nstate.page,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'now.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
  ndirty = false; updateStatus();
  $('#publish-overlay').style.display = 'flex';
}

function resetChanges() {
  if (!confirm('Discard all local changes?')) return;
  localStorage.removeItem(NDRAFT);
  location.reload();
}

let toastTimer;
function showToast(msg) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 1600);
}

function wireUI() {
  $('#btn-add').addEventListener('click', () => {
    nstate.items.push({ verb: '', subject: '' });
    saveDraft(); render();
    setTimeout(() => {
      const last = document.querySelector('.nli:last-child input.verb');
      if (last) last.focus();
    }, 50);
  });
  $('#btn-add-section').addEventListener('click', () => {
    nstate.page.sections = nstate.page.sections || [];
    nstate.page.sections.push({ label: '', body: '' });
    saveDraft();
    renderSections();
    updateStatus();
    setTimeout(() => {
      const last = document.querySelector('#sections-list > div:last-child input');
      if (last) last.focus();
    }, 50);
  });
  $('#now-lede').addEventListener('input', e => {
    nstate.page.lede = e.target.value;
    saveDraft();
  });
  $('#now-as-of').addEventListener('input', e => {
    nstate.as_of = e.target.value;
    saveDraft();
  });
  $('#btn-publish').addEventListener('click', publishAndDownload);
  $('#btn-reset').addEventListener('click', resetChanges);
  $('#publish-close').addEventListener('click', () => $('#publish-overlay').style.display = 'none');
}
