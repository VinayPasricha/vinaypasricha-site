/* =============================================================
   progress-admin.js — the manually-logged stats dashboard
   ============================================================= */

const SDRAFT = 'studio.stats';
let sstate = { metrics: [], snapshots: [], updated_at: null };
let sdirty = false;

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

document.addEventListener('studio:authed', boot);
if (window.studioAuth?.isAuthed?.()) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}

async function boot() {
  sstate = await loadStats();
  wireUI();
  renderAll();
}

async function loadStats() {
  try {
    const d = JSON.parse(localStorage.getItem(SDRAFT) || 'null');
    if (d && Array.isArray(d.metrics)) {
      return { metrics: d.metrics, snapshots: d.snapshots || [], updated_at: d.updated_at };
    }
  } catch (e) {}
  try {
    const res = await fetch('../assets/data/stats.json', { cache: 'no-cache' });
    if (res.ok) {
      const d = await res.json();
      return { metrics: d.metrics || [], snapshots: d.snapshots || [], updated_at: d.updated_at };
    }
  } catch (e) {}
  return { metrics: [], snapshots: [], updated_at: null };
}

function saveDraft() {
  const payload = {
    _comment: 'Studio draft — overrides published stats.json.',
    updated_at: today(),
    metrics: sstate.metrics,
    snapshots: sstate.snapshots,
  };
  localStorage.setItem(SDRAFT, JSON.stringify(payload));
  sdirty = true; updateStatus();
}

function today() { return new Date().toISOString().slice(0, 10); }

function updateStatus() {
  const el = $('#editor-status');
  if (el) el.innerHTML = sdirty
    ? '<span class="dirty">Unsaved on this device · publish to deploy</span>'
    : '<span class="saved">All changes saved on this device</span>';
  const count = $('#tb-count');
  if (count) {
    const n = sstate.snapshots.length;
    count.textContent = `${n} snapshot${n === 1 ? '' : 's'}`;
  }
}

function escapeHTML(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

function sortedSnapshots() {
  return [...sstate.snapshots].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
}

function latestValue(key) {
  const snaps = sortedSnapshots();
  for (let i = snaps.length - 1; i >= 0; i--) {
    const v = snaps[i].values?.[key];
    if (v != null && v !== '') return { value: Number(v), date: snaps[i].date };
  }
  return null;
}

function previousValue(key) {
  const snaps = sortedSnapshots();
  let found = 0;
  for (let i = snaps.length - 1; i >= 0; i--) {
    const v = snaps[i].values?.[key];
    if (v != null && v !== '') {
      found++;
      if (found === 2) return { value: Number(v), date: snaps[i].date };
    }
  }
  return null;
}

function seriesFor(key) {
  return sortedSnapshots()
    .map(s => ({ date: s.date, value: s.values?.[key] }))
    .filter(p => p.value != null && p.value !== '')
    .map(p => ({ date: p.date, value: Number(p.value) }));
}

function fmtNumber(n) {
  if (n == null || isNaN(n)) return '—';
  if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(Math.round(n));
}

function deltaHTML(curr, prev) {
  if (curr == null || prev == null) return '';
  const diff = curr - prev;
  if (diff === 0) return '<span class="delta">no change</span>';
  const pct = prev !== 0 ? Math.round((diff / prev) * 100) : null;
  const sign = diff > 0 ? '+' : '−';
  const cls = diff > 0 ? 'up' : 'down';
  const abs = fmtNumber(Math.abs(diff));
  const pctStr = pct != null ? ` (${diff > 0 ? '+' : '−'}${Math.abs(pct)}%)` : '';
  return `<span class="delta ${cls}">${sign}${abs}${pctStr} vs previous</span>`;
}

function renderSparkline(points) {
  if (!points || points.length < 2) {
    return '<div class="empty">No trend yet · add ≥2 snapshots</div>';
  }
  // Normalize to viewBox 100×40
  const vals = points.map(p => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const N = points.length;
  const xStep = N === 1 ? 100 : 100 / (N - 1);
  const coords = points.map((p, i) => {
    const x = i * xStep;
    const y = 40 - ((p.value - min) / range) * 36 - 2;
    return [x, y];
  });
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(' ');
  const area = `${path} L100,40 L0,40 Z`;
  return `<svg viewBox="0 0 100 40" preserveAspectRatio="none">
    <path class="area" d="${area}"/>
    <path class="line" d="${path}"/>
  </svg>`;
}

function renderAll() {
  renderSummary();
  renderGroups();
  renderSnapshotsList();
  updateStatus();
}

function renderSummary() {
  // Pick 4 headline metrics to feature prominently
  const headline = ['visitors_monthly', 'youtube_subs', 'newsletter_subs', 'cohort_enrolled'];
  const host = $('#prog-summary');
  if (!host) return;
  host.innerHTML = headline.map(key => {
    const m = sstate.metrics.find(x => x.key === key);
    if (!m) return '';
    const latest = latestValue(key);
    const prev = previousValue(key);
    return `
      <div class="prog-summary-card">
        <div class="label">${escapeHTML(m.label)}</div>
        <div class="value">${latest ? fmtNumber(latest.value) : '<span style="color:var(--ink-4);font-style:italic;font-size:18px">—</span>'}</div>
        ${latest && prev ? deltaHTML(latest.value, prev.value) : '<div class="delta">—</div>'}
      </div>
    `;
  }).join('');
}

function renderGroups() {
  const host = $('#prog-groups');
  if (!host) return;
  // Group metrics by category
  const groups = {};
  for (const m of sstate.metrics) {
    const cat = m.category || 'Other';
    (groups[cat] = groups[cat] || []).push(m);
  }
  const order = ['Audience', 'Engagement', 'Social', 'Books', 'Output', 'Course', 'Other'];
  const cats = Object.keys(groups).sort((a, b) => order.indexOf(a) - order.indexOf(b));

  host.innerHTML = cats.map(cat => `
    <div class="prog-group">
      <div class="prog-group-head">${escapeHTML(cat)} <em>· ${groups[cat].length} metric${groups[cat].length === 1 ? '' : 's'}</em></div>
      <div class="prog-group-grid">
        ${groups[cat].map(m => {
          const latest = latestValue(m.key);
          const prev = previousValue(m.key);
          const series = seriesFor(m.key);
          return `
            <div class="metric-card">
              <div class="mc-info">
                <div class="mc-label">${escapeHTML(m.label)}</div>
                <div class="mc-source">${escapeHTML(m.source || '')}</div>
                <div class="mc-value">${latest ? fmtNumber(latest.value) + `<span class="unit">${escapeHTML(m.unit || '')}</span>` : '<span class="empty">— no data yet</span>'}</div>
                ${latest && prev ? `<div class="mc-delta ${latest.value > prev.value ? 'up' : latest.value < prev.value ? 'down' : ''}">${deltaHTML(latest.value, prev.value).replace(/<\/?span[^>]*>/g, '')}</div>` : ''}
              </div>
              <div class="mc-spark">${renderSparkline(series)}</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `).join('');
}

function renderSnapshotsList() {
  const wrap = $('#snapshots-list');
  const host = $('#snapshots-list-body');
  if (!wrap || !host) return;
  const snaps = sortedSnapshots().reverse(); // newest first
  if (!snaps.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = '';

  host.innerHTML = snaps.map((s, idx) => {
    const filled = Object.entries(s.values || {}).filter(([_, v]) => v != null && v !== '').length;
    return `
      <div class="snap-row">
        <div class="snap-date">${escapeHTML(s.date)}</div>
        <div class="snap-summary">${filled} metric${filled === 1 ? '' : 's'} logged</div>
        <button type="button" data-action="delete-snap" data-idx="${snaps.length - 1 - idx}">Delete</button>
      </div>
    `;
  }).join('');

  host.querySelectorAll('button[data-action="delete-snap"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const sorted = sortedSnapshots();
      const snapToRemove = sorted[+btn.dataset.idx];
      if (!snapToRemove) return;
      if (!confirm(`Delete snapshot from ${snapToRemove.date}?`)) return;
      sstate.snapshots = sstate.snapshots.filter(x => x !== snapToRemove);
      saveDraft();
      renderAll();
    });
  });
}

function openSnapshotForm() {
  const host = $('#snapshot-form-host');
  const todayDate = today();
  // Pre-fill with latest values so the user can update what changed and ignore the rest
  const prefilled = {};
  for (const m of sstate.metrics) {
    const latest = latestValue(m.key);
    prefilled[m.key] = latest ? latest.value : '';
  }

  // Group metrics by category for cleaner form
  const groups = {};
  for (const m of sstate.metrics) {
    const cat = m.category || 'Other';
    (groups[cat] = groups[cat] || []).push(m);
  }

  host.innerHTML = `
    <div class="snapshot-form">
      <h3>Log a <em>snapshot</em></h3>
      <p class="note">Fields are pre-filled with the most recent value. Update only what changed. Empty fields are allowed — they just don't contribute to the trend.</p>

      <label style="font-family: var(--mono); font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-3); display: block; margin-bottom: 6px;">Date</label>
      <input type="date" id="snap-date" value="${todayDate}" style="font-family: var(--mono); font-size: 13px; padding: 9px 12px; border: 1px solid var(--rule); background: var(--paper); border-radius: 2px; outline: none; margin-bottom: 24px;">

      ${Object.keys(groups).map(cat => `
        <div style="margin-bottom: 24px;">
          <div style="font-family: var(--mono); font-size: 9px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--ink-3); margin-bottom: 12px;">— ${escapeHTML(cat)}</div>
          <div class="form-grid">
            ${groups[cat].map(m => `
              <label>
                ${escapeHTML(m.label)} <span style="color: var(--ink-4); letter-spacing: 0; text-transform: none; font-family: var(--serif); font-style: italic; font-size: 11px;">${m.unit ? '· ' + escapeHTML(m.unit) : ''}</span>
                <input type="number" step="any" data-key="${escapeHTML(m.key)}" value="${prefilled[m.key]}" placeholder="—">
              </label>
            `).join('')}
          </div>
        </div>
      `).join('')}

      <div class="form-actions">
        <button class="tb-btn ghost" type="button" id="snap-cancel">Cancel</button>
        <button class="tb-btn primary" type="button" id="snap-save">Save snapshot</button>
      </div>
    </div>
  `;

  $('#snap-cancel').addEventListener('click', () => { host.innerHTML = ''; });
  $('#snap-save').addEventListener('click', () => {
    const date = $('#snap-date').value || todayDate;
    const values = {};
    $$('input[data-key]').forEach(inp => {
      if (inp.value !== '' && inp.value != null) values[inp.dataset.key] = Number(inp.value);
    });
    // If a snapshot already exists for this date, replace it; otherwise add new
    const existingIdx = sstate.snapshots.findIndex(s => s.date === date);
    const snap = { date, values };
    if (existingIdx >= 0) sstate.snapshots[existingIdx] = snap;
    else sstate.snapshots.push(snap);
    saveDraft();
    host.innerHTML = '';
    renderAll();
    showToast('Snapshot saved');
  });
}

function publishAndDownload() {
  const payload = {
    _comment: 'Progress — manually-logged platform stats. Generated by Studio.',
    updated_at: today(),
    metrics: sstate.metrics,
    snapshots: sstate.snapshots,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'stats.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
  sdirty = false; updateStatus();
  $('#publish-overlay').style.display = 'flex';
}

function resetChanges() {
  if (!confirm('Discard all local changes?')) return;
  localStorage.removeItem(SDRAFT);
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
  $('#btn-new-snapshot').addEventListener('click', openSnapshotForm);
  $('#btn-publish').addEventListener('click', publishAndDownload);
  $('#btn-reset').addEventListener('click', resetChanges);
  $('#publish-close').addEventListener('click', () => $('#publish-overlay').style.display = 'none');
}
