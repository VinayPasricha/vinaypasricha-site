/* Studio · AI for Business Leaders — participant management.
   Reuses the studio gate; talks to /api/abl/* (Gemini + Firestore). */
(function () {
  'use strict';

  var STATUS_LABEL = { draft: 'Draft', research_added: 'Research added', link_ready: 'Link ready', active: 'Active', completed: 'Completed' };

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function toast(m) { var t = $('toast'); t.textContent = m; t.classList.add('show'); setTimeout(function () { t.classList.remove('show'); }, 1800); }
  // Restore the window scroll after re-renders settle, so buttons never jump the page.
  function restoreY(y) { requestAnimationFrame(function () { window.scrollTo(0, y); requestAnimationFrame(function () { window.scrollTo(0, y); }); }); }
  function fmtDate(v) { if (!v) return '—'; var d = new Date(v); return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  function md(src) {
    var lines = String(src || '').replace(/\r/g, '').split('\n'), out = '', inList = false;
    function inl(t) { return esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>'); }
    function close() { if (inList) { out += '</ul>'; inList = false; } }
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i].replace(/\s+$/, ''), m2;
      if ((m2 = l.match(/^###\s+(.*)/))) { close(); out += '<h3>' + inl(m2[1]) + '</h3>'; }
      else if ((m2 = l.match(/^##\s+(.*)/))) { close(); out += '<h2>' + inl(m2[1]) + '</h2>'; }
      else if ((m2 = l.match(/^#\s+(.*)/))) { close(); out += '<h1>' + inl(m2[1]) + '</h1>'; }
      else if ((m2 = l.match(/^\s*[-*]\s+(.*)/))) { if (!inList) { out += '<ul>'; inList = true; } out += '<li>' + inl(m2[1]) + '</li>'; }
      else if (!l.trim()) { close(); }
      else { close(); out += '<p>' + inl(l) + '</p>'; }
    }
    close(); return out;
  }

  async function api(path, init) {
    var res = await fetch('/api/abl' + path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, init || {}));
    var body = {}; try { body = await res.json(); } catch (e) {}
    return { ok: res.ok && body.ok !== false, data: body.data, error: body.error, status: res.status };
  }

  var detailId = null;

  // ---- auth ----
  async function boot() {
    var r = await api('/participants');
    if (r.status === 401 || r.status === 503) { showLogin(); return; }
    $('main').style.display = 'block';
    renderList(r.data || []);
    wireCreate();
  }
  function showLogin() {
    $('login').style.display = 'block';
    $('loginBtn').onclick = async function () {
      var res = await fetch('/api/studio/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: $('pw').value }) });
      if (res.ok) { $('login').style.display = 'none'; boot(); }
      else { $('loginErr').style.display = 'block'; }
    };
    $('pw').onkeydown = function (e) { if (e.key === 'Enter') $('loginBtn').click(); };
  }

  // ---- list ----
  async function refresh() { var r = await api('/participants'); if (r.ok) renderList(r.data || []); }

  // Show the meeting brief inline, right below the participant's row.
  async function toggleBrief(id, btn) {
    var open = document.querySelector('.brief-row[data-for="' + id + '"]');
    if (open) { open.remove(); btn.textContent = 'View ↓'; return; }
    btn.textContent = 'Loading…';
    var r = await api('/participants/' + id);
    btn.textContent = 'Hide ↑';
    var brief = r.ok ? (r.data.outputs || []).filter(function (o) { return o.output_type === 'vinay_meeting_brief'; })[0] : null;
    var mdText = brief ? (brief.reviewed_content_markdown || brief.content_markdown || '') : '';
    var row = document.querySelector('tr[data-id="' + id + '"]'); if (!row) return;
    var tr = document.createElement('tr'); tr.className = 'brief-row'; tr.setAttribute('data-for', id);
    tr.innerHTML = '<td colspan="9"><div class="brief-inline">' +
      (mdText ? md(mdText) : '<span class="muted">No brief found — generate it from the participant\'s detail.</span>') +
      (brief ? '<div style="margin-top:12px"><a class="row-actions" href="/ai-business-leaders/pdf/' + brief.id + '" target="_blank" rel="noopener">Open printable / PDF ↗</a></div>' : '') +
      '</div></td>';
    row.parentNode.insertBefore(tr, row.nextSibling);
  }

  async function removeParticipant(id, name) {
    if (!window.confirm('Delete "' + (name || 'this participant') + '" and all their chats, research, and outputs?\n\nThis cannot be undone.')) return;
    var r = await api('/participants/' + id, { method: 'DELETE' });
    if (r.ok) { toast('Deleted'); if (detailId === id) { $('detail').innerHTML = ''; detailId = null; } await refresh(); }
    else toast(r.error || 'Delete failed');
  }
  function renderStats(list) {
    var total = list.length;
    var approved = list.filter(function (p) { return p.link_approved; }).length;
    var completed = list.filter(function (p) { return p.status === 'completed'; }).length;
    var withMsgs = list.filter(function (p) { return (p.message_count || 0) > 0; });
    var avgMsgs = withMsgs.length ? Math.round(withMsgs.reduce(function (a, p) { return a + (p.message_count || 0); }, 0) / withMsgs.length) : 0;
    var depths = { '15': 0, '30': 0, '45': 0 };
    list.forEach(function (p) { if (p.selected_depth && depths[p.selected_depth] != null) depths[p.selected_depth]++; });
    var topDepth = Object.keys(depths).sort(function (a, b) { return depths[b] - depths[a]; })[0];
    var journey = depths[topDepth] ? topDepth + '-min' : '—';
    var rated = list.filter(function (p) { return p.feedback_rating > 0; });
    var avgRating = rated.length ? (rated.reduce(function (a, p) { return a + p.feedback_rating; }, 0) / rated.length).toFixed(1) : null;
    var pending = list.filter(function (p) { return p.status === 'completed' && !p.reviewed; }).length;
    function stat(v, l) { return '<div class="stat"><div class="stat-v">' + v + '</div><div class="stat-l">' + l + '</div></div>'; }
    $('stats').innerHTML =
      stat(total, 'Participants') +
      stat(approved, 'Links approved') +
      stat(completed, 'Completed') +
      (pending ? '<div class="stat hot"><div class="stat-v">' + pending + '</div><div class="stat-l">🟢 Needs review</div></div>' : '') +
      stat(avgMsgs, 'Avg messages') +
      stat(journey, 'Top journey') +
      stat(avgRating ? avgRating + '★' : '—', 'Avg rating');
  }
  function renderList(list) {
    $('pcount').textContent = '· ' + list.length;
    renderStats(list);
    $('rows').innerHTML = list.map(function (p, i) {
      var isNew = p.status === 'completed' && !p.reviewed;
      return '<tr data-id="' + p.id + '"' + (isNew ? ' class="new-row"' : '') + '>' +
        '<td class="sub">' + (i + 1) + '</td>' +
        '<td><div class="nm">' + esc(p.name) + (isNew ? ' <span class="newpill">🟢 New</span>' : '') + '</div><div class="sub">' + esc(p.role_title || '') + '</div></td>' +
        '<td>' + esc(p.company_name) + '</td>' +
        '<td><span class="pill">' + esc(STATUS_LABEL[p.status] || p.status) + '</span></td>' +
        '<td class="sub">' + fmtDate(p.created_at) + '</td>' +
        '<td>' + (p.link_approved ? '<span class="pill on">approved</span>' : '<span class="muted">—</span>') + '</td>' +
        '<td class="sub">' + (p.message_count || 0) + '/' + (p.max_messages || 200) + '</td>' +
        '<td>' + (p.vinay_brief_status === 'generated' ? '<button class="viewbrief" data-vb="' + p.id + '">View ↓</button>' : '<span class="muted">—</span>') + '</td>' +
        '<td><button class="del" data-del="' + p.id + '" data-nm="' + esc(p.name) + '" title="Delete participant">✕</button></td></tr>';
    }).join('') || '<tr><td colspan="9" class="muted">No participants yet.</td></tr>';
    Array.prototype.forEach.call($('rows').querySelectorAll('tr[data-id]'), function (tr) {
      tr.onclick = function () { openDetail(tr.getAttribute('data-id'), true); };
    });
    Array.prototype.forEach.call($('rows').querySelectorAll('.del'), function (b) {
      b.onclick = function (e) { e.stopPropagation(); removeParticipant(b.getAttribute('data-del'), b.getAttribute('data-nm')); };
    });
    Array.prototype.forEach.call($('rows').querySelectorAll('.viewbrief'), function (b) {
      b.onclick = function (e) { e.stopPropagation(); toggleBrief(b.getAttribute('data-vb'), b); };
    });
  }

  function wireCreate() {
    $('createBtn').onclick = async function () {
      var body = { name: $('n-name').value.trim(), company_name: $('n-company').value.trim(),
        role_title: $('n-role').value.trim(), email: $('n-email').value.trim(),
        company_website: $('n-website').value.trim(), industry: $('n-industry').value.trim() };
      if (!body.name || !body.company_name) { toast('Name and company are required'); return; }
      var auto = $('n-auto').checked;
      var r = await api('/participants', { method: 'POST', body: JSON.stringify(body) });
      if (!r.ok) { toast(r.error || 'Failed'); return; }
      ['n-name', 'n-company', 'n-role', 'n-email', 'n-website', 'n-industry'].forEach(function (i) { $(i).value = ''; });
      toast('Created'); await refresh(); await openDetail(r.data.id, true);
      if (auto) autoResearch(r.data.id);
    };
  }

  // Live web-grounded research → fills the research fields (no manual typing).
  async function autoResearch(id) {
    var y = window.pageYOffset;
    var st = $('autoStatus'); var btn = $('autoBtn');
    if (st) st.textContent = 'Researching the company on the web… this takes ~15–40s.';
    if (btn) { btn.disabled = true; btn.textContent = 'Researching…'; }
    var r = await api('/participants/' + id + '/research/auto', { method: 'POST' });
    if (r.ok) { toast('Research added'); await refresh(); await openDetail(id); restoreY(y); }
    else { toast(r.error || 'Research failed'); if (st) st.textContent = 'Research failed: ' + (r.error || ''); if (btn) { btn.disabled = false; btn.textContent = '✦ Auto-research'; } }
  }

  // ---- detail ----
  async function openDetail(id, doScroll) {
    detailId = id;
    var r = await api('/participants/' + id);
    if (!r.ok) { toast(r.error || 'Failed to load'); return; }
    renderDetail(r.data);
    // Only scroll when the user opens a row; refreshes leave scroll to the caller.
    if (doScroll) $('detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Opening a completed participant counts as reviewing it — clear the "new" flag.
    var pp = r.data.participant;
    if (pp && pp.status === 'completed' && !pp.reviewed) {
      api('/participants/' + id, { method: 'PATCH', body: JSON.stringify({ reviewed: true }) }).then(function () { refresh(); });
    }
  }

  function renderDetail(d) {
    var p = d.participant, sc = (d.research && d.research.structured_context) || {};
    var origin = location.origin;
    var link = origin + '/ai-business-leaders/s/' + p.slug;

    $('detail').innerHTML =
      '<div class="detail"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px">' +
        '<h3 style="margin:0">' + esc(p.name) + ' · <span style="font-style:italic;color:var(--ink-2)">' + esc(p.company_name) + '</span></h3>' +
        '<div style="display:flex;align-items:center;gap:10px"><span class="pill">' + esc(STATUS_LABEL[p.status] || p.status) + '</span>' +
        '<button class="btn danger" id="deleteBtn">Delete</button></div></div>' +
        (p.feedback_rating ? '<div class="fbline">Participant rated this <strong>' + p.feedback_rating + '/5 ★</strong>' + (p.feedback_comment ? ' — “' + esc(p.feedback_comment) + '”' : '') + '</div>' : '') +

      // Conversation transcript
      '<div class="card"><h4 style="margin:0 0 10px">Conversation <span class="muted" style="font-weight:400">· ' + ((d.messages && d.messages.length) || 0) + ' messages</span></h4>' +
        ((d.messages && d.messages.length)
          ? '<div class="convo">' + d.messages.map(function (m) {
              var isP = m.role === 'user';
              return '<div class="cmsg ' + (isP ? 'cp' : 'ca') + '">' +
                '<div class="cwho">' + (isP ? esc((p.name || 'Participant').split(' ')[0]) : 'Agent') + '</div>' +
                '<div class="cbody">' + esc(m.content).replace(/\n/g, '<br>') + '</div></div>';
            }).join('') + '</div>'
          : '<p class="muted">No conversation yet.</p>') +
      '</div>' +

      // Research
      '<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px">' +
        '<h4 style="margin:0">1 · Research (preliminary — the agent treats it as correctable)</h4>' +
        '<button class="btn ghost" id="autoBtn">✦ Auto-research</button></div>' +
        '<p class="muted" id="autoStatus" style="margin:8px 0 0;font-size:12px"></p>' +
        '<div class="grid3">' +
          fld('r-role', 'Role / title', p.role_title) + fld('r-web', 'Website', p.company_website) + fld('r-ind', 'Industry', p.industry) +
          fld('r-geo', 'Geography', p.geography) + fld('r-bm', 'Business model', p.business_model) + '<div></div>' +
        '</div>' +
        '<div class="grid2" style="margin-top:6px">' +
          fld('r-cust', 'Customers / segments', sc.customers, 2) + fld('r-prod', 'Products / services', sc.products, 2) +
          fld('r-comp', 'Competitors', sc.competitors, 2) + fld('r-press', 'Business pressures', sc.pressures, 2) +
          fld('r-air', 'Likely AI relevance', sc.ai_relevance, 2) + fld('r-aie', 'Known AI exposure', sc.ai_exposure, 2, 'None on record yet — add any current AI usage you learn of, or run Auto-research.') +
        '</div>' +
        '<label class="fld">Research dossier (paste anything)</label><textarea class="ipt" id="r-dossier" rows="5">' + esc((d.research && d.research.research_dossier) || '') + '</textarea>' +
        '<label class="fld">Sources / notes</label><textarea class="ipt auto" id="r-sources" rows="2">' + esc((d.research && d.research.sources_notes) || '') + '</textarea>' +
        '<button class="btn" id="saveResearch" style="margin-top:12px">Save research</button></div>' +

      // Approve + link
      '<div class="card"><h4>2 · Approve &amp; share the link</h4>' +
        (p.link_approved
          ? '<div class="linkbox" id="linkBox">' + esc(link) + '</div><button class="btn ghost" id="copyLink" style="margin-top:10px">Copy participant link</button>'
          : '<p class="muted">Approve to activate this participant\'s private link, then send it to them.</p><button class="btn accent" id="approveBtn" style="margin-top:8px">Approve link</button>') +
      '</div>' +

      // Brief
      (function () {
        var brief = (d.outputs || []).filter(function (o) { return o.output_type === 'vinay_meeting_brief'; })[0];
        var bmd = brief ? (brief.reviewed_content_markdown || brief.content_markdown || '') : '';
        return '<div class="card"><h4>3 · Vinay meeting brief (private)</h4>' +
          '<button class="btn" id="briefBtn">' + (brief ? 'Regenerate brief' : 'Generate Vinay brief') + '</button>' +
          (brief ? ' <a class="row-actions" href="/ai-business-leaders/pdf/' + brief.id + '" target="_blank" rel="noopener" style="margin-left:10px">Open printable / PDF ↗</a>' : '') +
          '<div id="briefOut" class="muted" style="margin-top:10px"></div>' +
          (bmd ? '<div class="brief-inline" style="margin-top:12px;border-top:1px solid var(--rule);padding-top:12px">' + md(bmd) + '</div>' : '') +
          '</div>';
      })() +
      '</div>';

    wireDetail(d);
  }

  // Auto-sizing text field so the whole value is readable (research text is long).
  function fld(id, label, val, rows, placeholder) {
    var ph = placeholder ? ' placeholder="' + esc(placeholder) + '"' : '';
    return '<div><label class="fld">' + esc(label) + '</label><textarea class="ipt auto" id="' + id + '" rows="' + (rows || 1) + '"' + ph + '>' + esc(val || '') + '</textarea></div>';
  }

  function autosize(el) { el.style.height = 'auto'; el.style.height = (el.scrollHeight + 2) + 'px'; }

  function wireDetail(d) {
    var p = d.participant;
    // Grow every research field to fit its full content so nothing is clipped.
    Array.prototype.forEach.call(document.querySelectorAll('.ipt.auto'), function (t) {
      autosize(t);
      t.addEventListener('input', function () { autosize(t); });
    });
    var ab = $('autoBtn'); if (ab) ab.onclick = function () { autoResearch(p.id); };
    var db = $('deleteBtn'); if (db) db.onclick = function () { removeParticipant(p.id, p.name); };
    $('saveResearch').onclick = async function () {
      var y = window.pageYOffset;
      await api('/participants/' + p.id, { method: 'PATCH', body: JSON.stringify({
        role_title: $('r-role').value, company_website: $('r-web').value, industry: $('r-ind').value,
        geography: $('r-geo').value, business_model: $('r-bm').value }) });
      var r = await api('/participants/' + p.id + '/research', { method: 'POST', body: JSON.stringify({
        structured_context: { customers: $('r-cust').value, products: $('r-prod').value, competitors: $('r-comp').value,
          pressures: $('r-press').value, ai_relevance: $('r-air').value, ai_exposure: $('r-aie').value },
        research_dossier: $('r-dossier').value, sources_notes: $('r-sources').value }) });
      if (r.ok) { toast('Research saved'); await refresh(); await openDetail(p.id); restoreY(y); } else toast(r.error || 'Failed');
    };

    var ap = $('approveBtn');
    if (ap) ap.onclick = async function () { var y = window.pageYOffset; var r = await api('/participants/' + p.id + '/approve', { method: 'POST' }); if (r.ok) { toast('Link approved'); await refresh(); await openDetail(p.id); restoreY(y); } else toast(r.error || 'Failed'); };
    var cp = $('copyLink');
    if (cp) cp.onclick = function () { navigator.clipboard.writeText($('linkBox').textContent).then(function () { toast('Link copied'); }); };

    $('briefBtn').onclick = async function () {
      var y = window.pageYOffset;
      $('briefOut').textContent = 'Generating…'; $('briefBtn').disabled = true;
      var r = await api('/participants/' + p.id + '/brief', { method: 'POST' });
      $('briefBtn').disabled = false;
      if (r.ok) { $('briefOut').textContent = 'Brief generated.'; await refresh(); await openDetail(p.id); restoreY(y); } else $('briefOut').textContent = r.error || 'Failed';
    };
  }

  boot();
})();
