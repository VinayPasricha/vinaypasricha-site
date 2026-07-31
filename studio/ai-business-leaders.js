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
  function fmtBytes(v) { var n = Number(v || 0); if (n < 1024) return n + ' B'; if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB'; return (n / (1024 * 1024)).toFixed(1) + ' MB'; }
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
  var params = new URLSearchParams(location.search);
  var participantPageId = params.get('participant');
  var participantPage = !!participantPageId;
  var snapshotAutoAttempted = false;

  // ---- sorting ----
  // The list arrives in the order the API returns it. Clicking a column header
  // sorts by it; clicking the same header again reverses. The choice is kept in
  // localStorage so it survives navigating into a participant and back. Sorting
  // only reorders the rows — it does not change how a row opens.
  var lastList = [];
  var SORT_STORAGE = 'abl_studio_sort_v1';
  var sortKey = 'name';
  var sortDir = 1;
  var searchQuery = '';

  try {
    var savedSort = JSON.parse(localStorage.getItem(SORT_STORAGE) || '{}');
    if (savedSort && savedSort.key) { sortKey = String(savedSort.key); sortDir = savedSort.dir === -1 ? -1 : 1; }
  } catch (e) {}

  function sortValue(p) {
    if (sortKey === 'message_count') return Number(p.message_count || 0);
    if (sortKey === 'created_at') return String(p.created_at || '');
    if (sortKey === 'status') return STATUS_LABEL[p.status] || p.status || '';
    return String(p[sortKey] || '');
  }

  function sortedList(list) {
    var out = (list || []).slice();
    if (!sortKey) return out;
    out.sort(function (a, b) {
      var av = sortValue(a), bv = sortValue(b);
      if (typeof av === 'number') return (av - bv) * sortDir;
      // created_at is an ISO string, so a plain comparison already orders it.
      if (sortKey === 'created_at') return (av < bv ? -1 : av > bv ? 1 : 0) * sortDir;
      return av.localeCompare(bv, undefined, { sensitivity: 'base' }) * sortDir;
    });
    return out;
  }

  function renderSortHeaders() {
    Array.prototype.forEach.call(document.querySelectorAll('.tbl th.sortable'), function (th) {
      var key = th.getAttribute('data-sort');
      var active = key === sortKey;
      th.classList.toggle('sorted', active);
      var label = th.textContent.replace(/[\s↑↓]+$/, '');
      th.innerHTML = esc(label) + (active ? '<span class="arrow">' + (sortDir === 1 ? '↑' : '↓') + '</span>' : '');
    });
  }

  function wireSorting() {
    Array.prototype.forEach.call(document.querySelectorAll('.tbl th.sortable'), function (th) {
      th.onclick = function () {
        var key = th.getAttribute('data-sort');
        if (sortKey === key) sortDir = -sortDir;
        // Date and message count are most useful highest-first.
        else { sortKey = key; sortDir = (key === 'created_at' || key === 'message_count') ? -1 : 1; }
        try { localStorage.setItem(SORT_STORAGE, JSON.stringify({ key: sortKey, dir: sortDir })); } catch (e) {}
        renderList(lastList);
      };
    });
  }

  // ---- auth ----
  async function boot() {
    var r = await api('/participants');
    if (r.status === 401 || r.status === 503) { showLogin(); return; }
    $('main').style.display = 'block';
    if (participantPage) {
      $('listView').style.display = 'none';
      await openDetail(participantPageId, false);
      if (params.get('autoResearch') === '1') {
        history.replaceState({}, '', '/studio/ai-business-leaders?participant=' + encodeURIComponent(participantPageId));
        autoResearch(participantPageId);
      }
      return;
    }
    renderList(r.data || []);
    wireSorting();
    wireSearch();
    wireCreate();
    wireBulkCreate();
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
  async function refresh() {
    if (participantPage) return;
    var r = await api('/participants'); if (r.ok) renderList(r.data || []);
  }

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
    if (r.ok) {
      toast('Deleted');
      if (participantPage) { location.href = '/studio/ai-business-leaders'; return; }
      if (detailId === id) { $('detail').innerHTML = ''; detailId = null; }
      await refresh();
    }
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
    lastList = list || [];
    var rows = sortedList(lastList);
    if (searchQuery) {
      rows = rows.filter(function (p) {
        return [p.name, p.company_name, p.role_title, p.email]
          .map(function (value) { return String(value || '').toLowerCase(); })
          .join(' ')
          .indexOf(searchQuery) !== -1;
      });
    }
    $('pcount').textContent = '· ' + rows.length;
    renderStats(rows);
    renderSortHeaders();
    if ($('participantSearchCount')) {
      $('participantSearchCount').textContent = searchQuery
        ? rows.length + ' of ' + lastList.length + ' participants'
        : (sortKey === 'name' && sortDir === 1 ? 'A–Z' : 'Sorted');
    }
    $('rows').innerHTML = rows.map(function (p, i) {
      var isNew = p.status === 'completed' && !p.reviewed;
      return '<tr data-id="' + p.id + '"' + (isNew ? ' class="new-row"' : '') + '>' +
        '<td class="sub">' + (i + 1) + '</td>' +
        '<td><div class="nm"><a class="participant-name" href="/studio/ai-business-leaders?participant=' + encodeURIComponent(p.id) + '">' + esc(p.name) + '</a>' + (isNew ? ' <span class="newpill">🟢 New</span>' : '') + '</div><div class="sub">' + esc(p.role_title || '') + '</div></td>' +
        '<td>' + esc(p.company_name) + '</td>' +
        '<td><span class="pill">' + esc(STATUS_LABEL[p.status] || p.status) + '</span></td>' +
        '<td class="sub">' + fmtDate(p.created_at) + '</td>' +
        '<td>' + (p.link_approved ? '<span class="pill on">approved</span>' : '<span class="muted">—</span>') + '</td>' +
        '<td class="sub">' + (p.message_count || 0) + '/' + (p.max_messages || 200) + '</td>' +
        '<td>' + (p.vinay_brief_status === 'generated' ? '<button class="viewbrief" data-vb="' + p.id + '">View ↓</button>' : '<span class="muted">—</span>') + '</td>' +
        '<td><button class="del" data-del="' + p.id + '" data-nm="' + esc(p.name) + '" title="Delete participant">✕</button></td></tr>';
    }).join('') || '<tr><td colspan="9" class="muted">' + (searchQuery ? 'No participants match your search.' : 'No participants yet.') + '</td></tr>';
    Array.prototype.forEach.call($('rows').querySelectorAll('tr[data-id]'), function (tr) {
      tr.onclick = function (event) {
        if (event.target.closest('button, a')) return;
        location.href = '/studio/ai-business-leaders?participant=' + encodeURIComponent(tr.getAttribute('data-id'));
      };
    });
    Array.prototype.forEach.call($('rows').querySelectorAll('.del'), function (b) {
      b.onclick = function (e) { e.stopPropagation(); removeParticipant(b.getAttribute('data-del'), b.getAttribute('data-nm')); };
    });
    Array.prototype.forEach.call($('rows').querySelectorAll('.viewbrief'), function (b) {
      b.onclick = function (e) { e.stopPropagation(); toggleBrief(b.getAttribute('data-vb'), b); };
    });
  }

  function wireSearch() {
    var input = $('participantSearch');
    var clear = $('participantSearchClear');
    if (!input || !clear) return;
    input.oninput = function () {
      searchQuery = input.value.trim().toLowerCase();
      renderList(lastList);
    };
    clear.onclick = function () {
      input.value = '';
      searchQuery = '';
      renderList(lastList);
      input.focus();
    };
  }

  function wireCreate() {
    // The create-participant form is not present on every surface (e.g. the
    // embedded preparation view), so wire it only when it exists.
    if (!$('createBtn')) return;
    $('createBtn').onclick = async function () {
      var body = { name: $('n-name').value.trim(), company_name: $('n-company').value.trim(),
        role_title: $('n-role').value.trim(), email: $('n-email').value.trim(),
        company_website: $('n-website').value.trim(), industry: $('n-industry').value.trim() };
      if (!body.name || !body.company_name) { toast('Name and company are required'); return; }
      var auto = $('n-auto').checked;
      var r = await api('/participants', { method: 'POST', body: JSON.stringify(body) });
      if (!r.ok) { toast(r.error || 'Failed'); return; }
      ['n-name', 'n-company', 'n-role', 'n-email', 'n-website', 'n-industry'].forEach(function (i) { $(i).value = ''; });
      toast('Created');
      location.href = '/studio/ai-business-leaders?participant=' + encodeURIComponent(r.data.id) + (auto ? '&autoResearch=1' : '');
    };
  }

  function wireBulkCreate() {
    var button = $('bulkCreateBtn');
    if (!button) return;
    button.onclick = async function () {
      var lines = $('bulkParticipants').value.split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean);
      var participants = lines.map(function (line) {
        var cells = line.split(/\t|,/).map(function (cell) { return cell.trim(); }).filter(Boolean);
        var emailIndex = cells.findIndex(function (cell) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cell); });
        if (emailIndex < 0) return { email: line };
        return {
          email: cells[emailIndex],
          name: emailIndex > 0 ? cells[0] : '',
          company_name: cells[emailIndex + 1] || '',
          role_title: cells[emailIndex + 2] || ''
        };
      });
      if (!participants.length) { toast('Add participant emails first'); return; }
      button.disabled = true; button.textContent = 'Preloading…'; $('bulkStatus').textContent = '';
      var r = await api('/participants/bulk', { method: 'POST', body: JSON.stringify({ participants: participants }) });
      button.disabled = false; button.textContent = 'Preload participants';
      if (!r.ok) { toast(r.error || 'Import failed'); return; }
      var d = r.data || {};
      $('bulkStatus').textContent = (d.created || 0) + ' added · ' + (d.updated || 0) + ' updated' + ((d.skipped || 0) ? ' · ' + d.skipped + ' skipped' : '');
      $('bulkParticipants').value = '';
      toast('Participant emails preloaded');
      await refresh();
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
    var snapshot = (r.data.outputs || []).find(function (output) { return output.output_type === 'admin_participant_snapshot'; });
    if (participantPage && (!snapshot || r.data.snapshot_stale) && !snapshotAutoAttempted) {
      snapshotAutoAttempted = true;
      generateAdminSnapshot(id, true);
    }
  }

  function modeLabel(mode) {
    return {
      participant: 'AI Journey', qa: 'Admin QA', ved: 'Weakest Execution Link',
      siv: 'First AI Project', continuing: 'Ongoing AI Journey',
    }[mode] || String(mode || 'Conversation').replace(/_/g, ' ');
  }

  function outputLabel(type) {
    return {
      course_preparation_brief: 'Course Preparation Brief',
      use_case_map: 'AI Opportunity & Use-Case Map',
      strategy_note: 'Personalised AI Strategy Note',
      share_summary: 'Participant-approved summary',
      vinay_meeting_brief: 'Vinay meeting brief',
      ved_report: 'Execution Constraint Report',
      siv_report: 'First AI Project Decision Report',
      leadership_blueprint: '90-Day AI Leadership Blueprint',
    }[type] || String(type || 'Output').replace(/_/g, ' ');
  }

  function renderMemory(memory) {
    var fields = (memory && memory.fields) || {};
    var items = Object.keys(fields).filter(function (key) {
      return fields[key] && (!Array.isArray(fields[key]) || fields[key].length);
    }).map(function (key) {
      var value = Array.isArray(fields[key]) ? fields[key].join('; ') : fields[key];
      return '<div class="memory-item"><strong>' + esc(key.replace(/_/g, ' ')) + '</strong><span>' + esc(value) + '</span></div>';
    }).join('');
    var note = memory && memory.participant_note
      ? '<div class="memory-item"><strong>Participant correction / note</strong><span>' + esc(memory.participant_note) + '</span></div>' : '';
    return items || note ? '<div class="memory-grid">' + items + note + '</div>' : '<span class="muted">No confirmed Course Memory has been captured yet.</span>';
  }

  function renderConversations(conversations) {
    if (!(conversations || []).length) return '<span class="muted">No agent conversations have started yet.</span>';
    return conversations.map(function (conversation) {
      var messages = (conversation.messages || []).map(function (message) {
        var role = message.role === 'assistant' ? 'assistant' : message.role === 'admin' ? 'admin' : 'user';
        return '<div class="message ' + role + '"><span class="message-role">' + esc(role) + '</span>' + esc(message.content) + '</div>';
      }).join('') || '<span class="muted">This conversation has been opened but contains no messages.</span>';
      return '<details class="conversation"><summary><strong>' + esc(modeLabel(conversation.mode)) + '</strong> · ' +
        (conversation.messages || []).length + ' messages · ' + esc(conversation.current_stage || conversation.status || 'not started') +
        '</summary><div style="margin-top:8px">' + messages + '</div></details>';
    }).join('');
  }

  function renderOutputs(outputs) {
    var visible = (outputs || []).filter(function (output) { return output.output_type !== 'admin_participant_snapshot'; });
    if (!visible.length) return '<span class="muted">No reports or course outputs have been generated yet.</span>';
    return visible.map(function (output) {
      var content = output.reviewed_content_markdown || output.content_markdown || '';
      return '<details class="conversation"><summary><strong>' + esc(outputLabel(output.output_type)) + '</strong> · ' +
        fmtDate(output.updated_at || output.created_at) + '</summary><div class="brief-inline">' + md(content) +
        '<div style="margin-top:10px"><a class="viewbrief" href="/ai-business-leaders/pdf/' + encodeURIComponent(output.id) +
        '" target="_blank" rel="noopener">Open printable / PDF ↗</a></div></div></details>';
    }).join('');
  }

  function renderAdminSnapshot(d) {
    var snapshot = (d.outputs || []).find(function (output) { return output.output_type === 'admin_participant_snapshot'; });
    var content = snapshot ? (snapshot.reviewed_content_markdown || snapshot.content_markdown || '') : '';
    var conversationMessages = (d.conversations || []).reduce(function (sum, conversation) {
      return sum + (conversation.messages || []).length;
    }, 0);
    var researchReady = !!(d.research && (d.research.research_dossier || Object.keys(d.research.structured_context || {}).length));
    var state = !snapshot ? 'Preparing first snapshot…' : d.snapshot_stale ? 'New information available · refreshing…' : 'Current as of ' + fmtDate(snapshot.updated_at || snapshot.created_at);
    return '<div class="card snapshot-card"><div class="snapshot-head"><div><div class="snapshot-kicker">Private admin view</div>' +
      '<h4 style="margin:0;font-family:var(--serif);font-size:24px;letter-spacing:0;text-transform:none;color:var(--ink)">Participant Admin Snapshot</h4>' +
      '<p class="muted" id="snapshotStatus" style="margin:5px 0 0">' + esc(state) + '</p></div>' +
      '<button class="btn accent" id="snapshotBtn">' + (snapshot ? 'Refresh snapshot' : 'Generate snapshot') + '</button></div>' +
      '<div class="evidence-strip"><span class="evidence-chip">' + (researchReady ? '✓' : '○') + ' Company research</span>' +
      '<span class="evidence-chip">' + conversationMessages + ' agent messages</span>' +
      '<span class="evidence-chip">' + (d.notes || []).length + ' meetings</span>' +
      '<span class="evidence-chip">' + (d.assets || []).length + ' uploaded assets</span>' +
      '<span class="evidence-chip">' + ((d.outputs || []).filter(function (output) { return output.output_type !== 'admin_participant_snapshot'; }).length) + ' course outputs</span></div>' +
      (content ? '<div class="snapshot-content">' + md(content) + '</div>' :
        '<div class="muted" style="padding:24px 0 6px">Reading the participant’s research, conversations, meetings and files to create the first one-page briefing…</div>') +
      '</div>';
  }

  function renderEvidenceDossier(d) {
    return '<details class="dossier-section"><summary><span>Course Memory</span><span>' +
      Object.keys((d.memory && d.memory.fields) || {}).length + ' confirmed fields</span></summary><div class="dossier-body">' +
      renderMemory(d.memory) + '</div></details>' +
      '<details class="dossier-section"><summary><span>Agent conversations</span><span>' +
      (d.conversations || []).length + ' conversation streams</span></summary><div class="dossier-body">' +
      renderConversations(d.conversations) + '</div></details>' +
      '<details class="dossier-section"><summary><span>Reports &amp; generated outputs</span><span>' +
      ((d.outputs || []).filter(function (output) { return output.output_type !== 'admin_participant_snapshot'; }).length) +
      ' outputs</span></summary><div class="dossier-body">' + renderOutputs(d.outputs) + '</div></details>';
  }

  async function generateAdminSnapshot(id, automatic) {
    var button = $('snapshotBtn');
    var status = $('snapshotStatus');
    if (button) { button.disabled = true; button.textContent = 'Refreshing…'; }
    if (status) status.textContent = 'Synthesising all participant evidence…';
    var r = await api('/participants/' + id + '/admin-snapshot', { method: 'POST' });
    if (r.ok) {
      if (!automatic) toast('Admin snapshot refreshed');
      await openDetail(id, false);
    } else {
      if (button) { button.disabled = false; button.textContent = 'Try again'; }
      if (status) status.textContent = r.error || 'The snapshot could not be refreshed.';
    }
  }

  function renderDetail(d) {
    var p = d.participant, sc = (d.research && d.research.structured_context) || {};
    var origin = location.origin;
    var link = origin + '/ai-business-leaders/s/' + p.slug;

    $('detail').innerHTML =
      (participantPage ? '<a class="dossier-back" href="/studio/ai-business-leaders">← All participants</a>' : '') +
      '<div class="detail"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px">' +
        '<h3 style="margin:0">' + esc(p.name) + ' · <span style="font-style:italic;color:var(--ink-2)">' + esc(p.company_name) + '</span></h3>' +
        '<div style="display:flex;align-items:center;gap:10px"><span class="pill">' + esc(STATUS_LABEL[p.status] || p.status) + '</span>' +
        '<button class="btn danger" id="deleteBtn">Delete</button></div></div>' +
        (p.feedback_rating ? '<div class="fbline">Participant rated this <strong>' + p.feedback_rating + '/5 ★</strong>' + (p.feedback_comment ? ' — “' + esc(p.feedback_comment) + '”' : '') + '</div>' : '') +
        renderAdminSnapshot(d) +
        renderEvidenceDossier(d) +

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

      // Generate the participant page before adding later meeting context.
      '<div class="card"><h4>2 · Participant page &amp; private link</h4>' +
        (p.link_approved
          ? '<p class="muted">The participant page is ready. The participant may speak with the first agent before or after your one-on-one meeting.</p><div class="linkbox" id="linkBox">' + esc(link) + '</div><button class="btn ghost" id="copyLink" style="margin-top:10px">Copy participant link</button>'
          : '<p class="muted">Generate the participant page and private link. This creates their permanent Studio record; first-agent interaction is optional.</p><button class="btn accent" id="approveBtn" style="margin-top:8px">Generate participant page &amp; link</button>') +
      '</div>' +

      (p.link_approved ?
      // Physical meetings and full transcripts
      '<div class="card"><h4>3 · Participant context — meetings &amp; transcripts</h4>' +
        '<p class="muted">Upload or paste the full one-on-one transcript. The original stays private. AI creates a draft summary for you to review before any course agent can use it.</p>' +
        '<div class="grid2"><div><label class="fld">Title</label><input class="ipt" id="noteTitle" placeholder="One-on-one meeting · 21 July"></div>' +
        '<div><label class="fld">Meeting date</label><input class="ipt" id="noteDate" type="date"></div></div>' +
        '<div class="transcript-box"><label class="fld">Meeting transcript</label><textarea class="ipt" id="noteContent" rows="9" placeholder="Paste the complete transcript here, or upload a file below…"></textarea>' +
        '<div class="transcript-actions">' +
          '<input type="file" id="noteFile" accept=".txt,.md,.docx,.pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf" style="font-size:12px">' +
          '<button class="btn" id="saveNote">Create draft summary</button><span id="noteStatus" class="muted"></span>' +
        '</div></div>' +
        '<div id="noteList" style="margin-top:16px">' + ((d.notes || []).map(function (note) {
          var isTranscript = note.source_kind === 'transcript';
          var isDraft = note.review_status === 'draft';
          var status = isDraft ? 'Draft — review required' : 'Approved for course AI';
          return '<div class="note-row"><div style="display:flex;justify-content:space-between;gap:12px"><div><strong>' + esc(note.title || 'Meeting summary') + '</strong>' +
            '<div class="note-meta">' + fmtDate(note.occurred_at) + ' · ' + (isTranscript ? 'AI-processed transcript' : 'Meeting summary') + ' · ' + status + ' · Participant: ' + (note.share_with_participant ? 'shared' : 'private') + '</div></div>' +
            '<div><button class="viewbrief" data-note-edit="' + esc(note.id) + '">Edit summary</button><button class="del" data-note-del="' + esc(note.id) + '" title="Delete meeting record">✕</button></div></div>' +
            '<div class="note-copy" data-note-copy="' + esc(note.id) + '">' + esc(note.content || '') + '</div>' +
            '<textarea class="ipt note-edit-box" data-note-editor="' + esc(note.id) + '" hidden>' + esc(note.content || '') + '</textarea>' +
            (isDraft
              ? '<div class="transcript-actions"><label style="font-size:12px;color:var(--ink-2)"><input type="checkbox" data-note-share="' + esc(note.id) + '" style="accent-color:var(--accent)"> Also share this summary with the participant</label><button class="btn accent" data-note-approve="' + esc(note.id) + '">Approve for course AI</button></div>'
              : '<div class="transcript-actions"><button class="btn ghost" data-note-participant="' + esc(note.id) + '" data-shared="' + (note.share_with_participant ? 'true' : 'false') + '">' + (note.share_with_participant ? 'Stop sharing with participant' : 'Share summary with participant') + '</button></div>') +
            (note.raw_transcript ? '<details class="transcript-original"><summary>View original private transcript</summary><pre>' + esc(note.raw_transcript) + '</pre></details>' : '') + '</div>';
        }).join('') || '<span class="muted">No meetings or transcripts added yet.</span>') + '</div>' +
      '</div>' +

      // Participant-submitted files
      '<div class="card"><h4>4 · Participant assets</h4>' +
        '<p class="muted">Keep PDFs, Word documents, presentations, spreadsheets and other materials submitted by this participant on their private page. Files remain admin-only. Where text can be extracted, you may approve it for the course AI.</p>' +
        '<div class="grid2"><div><label class="fld">Asset title</label><input class="ipt" id="assetTitle" placeholder="Strategy note, process document, presentation…"></div>' +
        '<div><label class="fld">File</label><input class="ipt" type="file" id="assetFile" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.csv,.jpg,.jpeg,.png"></div></div>' +
        '<label class="fld">Description / why it matters (optional)</label><textarea class="ipt" id="assetDescription" rows="2" placeholder="Add any guidance that will help you or the AI interpret this file correctly."></textarea>' +
        '<div class="transcript-actions"><button class="btn" id="uploadAsset">Upload participant asset</button><span id="assetStatus" class="muted"></span></div>' +
        '<div id="assetList" style="margin-top:16px">' + ((d.assets || []).map(function (asset) {
          var approved = asset.review_status === 'approved';
          var readable = asset.extraction_status === 'extracted' && !!asset.extracted_text;
          var status = approved ? 'Approved for course AI' : (readable ? 'Stored privately · awaiting AI approval' : 'Stored privately · admin reference only');
          return '<div class="asset-row"><div class="asset-main"><strong>' + esc(asset.title || asset.file_name) + '</strong>' +
            '<div class="note-meta">' + esc(asset.file_name) + ' · ' + fmtBytes(asset.byte_size) + ' · ' + status + '</div>' +
            (asset.description ? '<div class="asset-description">' + esc(asset.description) + '</div>' : '') + '</div>' +
            '<div class="asset-actions"><a class="viewbrief" href="/api/abl/participants/' + encodeURIComponent(p.id) + '/assets/' + encodeURIComponent(asset.id) + '/download">Download</a>' +
            (!approved && readable ? '<button class="btn accent" data-asset-approve="' + esc(asset.id) + '">Approve for course AI</button>' : '') +
            '<button class="del" data-asset-del="' + esc(asset.id) + '" title="Delete participant file">✕</button></div></div>';
        }).join('') || '<span class="muted">No participant assets uploaded yet.</span>') + '</div>' +
      '</div>' :
      '<div class="card context-pending"><h4>3 · Participant context &amp; assets</h4><p class="muted">Meeting summaries, transcripts and participant files will appear here as soon as the participant page and link are generated. A first-agent conversation is not required.</p></div>') +

      // Brief
      (function () {
        var brief = (d.outputs || []).filter(function (o) { return o.output_type === 'vinay_meeting_brief'; })[0];
        var bmd = brief ? (brief.reviewed_content_markdown || brief.content_markdown || '') : '';
        return '<div class="card"><h4>' + (p.link_approved ? '5' : '4') + ' · Vinay meeting brief (private)</h4>' +
          '<button class="btn" id="briefBtn">' + (brief ? 'Regenerate brief' : 'Generate Vinay brief') + '</button>' +
          (brief ? ' <a class="row-actions" href="/ai-business-leaders/pdf/' + brief.id + '" target="_blank" rel="noopener" style="margin-left:10px">Open printable / PDF ↗</a>' : '') +
          '<div id="briefOut" class="muted" style="margin-top:10px"></div>' +
          (bmd ? '<div class="brief-inline" style="margin-top:12px;border-top:1px solid var(--rule);padding-top:12px">' + md(bmd) + '</div>' : '') +
          '</div>';
      })() +
(function () {
        var b = d.builder || { sessions: {}, completed_sessions: [], completion_percent: 0 };
        // Self-contained: this card was brought over from the course branch, whose
        // detail view defined courseLink further up.
        var courseLink = '/ai-business-leaders/course/' + encodeURIComponent(d.participant.slug);
        var ss = b.sessions || {}, current = Math.max(1, Math.min(5, b.current_session || 1));
        var titles = ['','Candidate workflow','Leverage Case','Company Brain workflow','Pilot Reality Sheet','Board pitch & commitment'];
        var wins = [
          '', 'Named a candidate workflow', 'Built a provisional Leverage Case',
          'Mapped the future workflow', 'Defined pilot boundary and controls', 'Built a peer-tested leadership initiative'
        ];
        var completed = b.completed_sessions || [];
        var initiative = (d.outputs || []).filter(function (o) { return o.output_type === 'ai_leadership_initiative'; })[0];
        var labels = {
          candidate_workflow:'Candidate workflow', people_systems:'People and systems', where_work_breaks:'Where work breaks',
          business_consequence:'Business consequence', current_ai_use:'Current personal AI use', company_brain_hypothesis:'Company Brain hypothesis',
          problem_sentence:'Problem sentence', recurrence:'Recurrence and proof', value_bucket:'Value bucket', baseline:'Baseline',
          pilot_tests:'Four pilot tests', strategic_value:'Strategic value', available_data:'Available data', non_ai_alternative:'Non-AI alternative',
          owner_human_line:'Owner and human line', decision:'Decision', evidence_needed:'Evidence needed',
          current_steps:'Current workflow', exception_path:'Exception path', memory:'Memory', reasoning:'Reasoning', action:'Action', feedback:'Feedback',
          boundaries:'Automate / Assist / Escalate', build_buy_partner:'Build / Buy / Partner', critical_assumption:'Critical assumption',
          pilot_boundary:'Pilot boundary', ownership:'Owner and team', old_work_removed:'Old work removed', new_behaviour:'New behaviour',
          data_boundary:'Data boundary', risk_tier:'Risk tier', operational_boundary:'Operational boundary', control_recovery:'Control and recovery',
          evidence:'Outcome / adoption / safety evidence', economics:'Economics', weekly_question:'Weekly learning question', premortem:'Pre-mortem',
          pitch_problem:'Pitch · problem', pitch_brain:'Pitch · Company Brain', pitch_workflow:'Pitch · workflow', pitch_control:'Pitch · control',
          pitch_evidence:'Pitch · evidence and decision', commitment_72h:'72-hour commitment', day30_review_date:'Day-30 review date',
          day30_review_with:'Day-30 review with', scale_if:'Scale if', fix_if:'Fix if', stop_if:'Stop if'
        };
        function hasAnswer(v) {
          if (typeof v === 'string') return !!v.trim();
          if (Array.isArray(v)) return v.some(hasAnswer);
          if (v && typeof v === 'object') return Object.keys(v).some(function (k) { return hasAnswer(v[k]); });
          return v === true || typeof v === 'number';
        }
        function nested(v) {
          if (Array.isArray(v)) return esc(v.join(' · '));
          if (v && typeof v === 'object') {
            return Object.keys(v).filter(function (k) { return hasAnswer(v[k]); }).map(function (k) {
              var name = k.replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
              return '<div style="margin:4px 0"><strong style="font-size:11px">' + esc(name) + ':</strong> ' + nested(v[k]) + '</div>';
            }).join('');
          }
          return esc(v == null ? '' : v);
        }
        function sessionEvidence(n) {
          var data = ss[String(n)] || {};
          var keys = Object.keys(labels).filter(function (k) { return Object.prototype.hasOwnProperty.call(data, k); });
          var answered = keys.filter(function (k) { return hasAnswer(data[k]); });
          return '<details' + (n === current ? ' open' : '') + ' style="border-top:1px solid var(--rule);padding:10px 0">' +
            '<summary style="cursor:pointer;font-family:var(--serif);font-size:16px"><strong>Session ' + n + '</strong> · ' + esc(titles[n]) +
            ' <span class="sub">(' + answered.length + ' answers)</span></summary>' +
            (answered.length ? '<div style="margin-top:8px">' + answered.map(function (k) {
              return '<div style="padding:8px 0;border-bottom:1px solid var(--rule-soft)"><div class="sub">' + esc(labels[k]) +
                '</div><div style="font-size:13.5px;line-height:1.5;margin-top:3px">' + nested(data[k]) + '</div></div>';
            }).join('') + '</div>' : '<p class="muted">No answers saved for this session.</p>') + '</details>';
        }
        var allEvidence = [1,2,3,4,5].map(sessionEvidence).join('');
        return '<div class="card"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px"><h4 style="margin:0">4 · AI Leadership Initiative Builder</h4>' +
          '<span class="pill ' + ((b.completion_percent || 0) >= 80 ? 'on' : '') + '">' + (b.completion_percent || 0) + '% complete</span></div>' +
          '<div style="height:5px;background:var(--rule-soft);border-radius:4px;overflow:hidden;margin:12px 0 14px"><div style="height:100%;width:' + (b.completion_percent || 0) + '%;background:var(--accent)"></div></div>' +
          '<div class="grid2"><div><div class="sub">Current section</div><div style="font-family:var(--serif);font-size:17px;margin-top:3px">Session ' + current + ' · ' + esc(titles[current]) + '</div></div>' +
          '<div><div class="sub">Completed outputs</div><div style="font-size:13px;margin-top:3px">' + (completed.length ? completed.map(function (n) { return esc(wins[n]); }).join(' · ') : 'No session output completed yet') + '</div></div></div>' +
          '<div style="margin-top:14px"><div class="sub" style="margin-bottom:5px">Complete Builder evidence · all five sessions</div>' + allEvidence + '</div>' +
          '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px"><a class="row-actions" href="' + esc(courseLink) + '" target="_blank" rel="noopener">Open participant workspace ↗</a>' +
          (initiative ? '<a class="row-actions" href="/ai-business-leaders/pdf/' + initiative.id + '" target="_blank" rel="noopener">Open latest 90-day charter ↗</a>' : '') + '</div></div>';
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
    var snapshotButton = $('snapshotBtn');
    if (snapshotButton) snapshotButton.onclick = function () { generateAdminSnapshot(p.id, false); };
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

    var noteFile = $('noteFile');
    if (noteFile) noteFile.onchange = async function () {
      var file = noteFile.files && noteFile.files[0];
      if (!file) return;
      if (!/\.(txt|md|docx|pdf)$/i.test(file.name)) { $('noteStatus').textContent = 'Please use a .txt, .md, .docx or .pdf transcript.'; return; }
      if (file.size > 6 * 1024 * 1024) { $('noteStatus').textContent = 'Transcript files must be smaller than 6 MB.'; noteFile.value = ''; return; }
      if (/\.(txt|md)$/i.test(file.name)) $('noteContent').value = await file.text();
      else $('noteContent').value = '';
      if (!$('noteTitle').value) $('noteTitle').value = file.name.replace(/\.(txt|md|docx|pdf)$/i, '');
      $('noteStatus').textContent = /\.(txt|md)$/i.test(file.name) ? 'Transcript loaded. Review it, then process.' : 'File ready to process securely.';
    };
    function fileBase64(file) {
      if (!file) return Promise.resolve('');
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () { resolve(String(reader.result || '').split(',')[1] || ''); };
        reader.onerror = function () { reject(new Error('Could not read file')); };
        reader.readAsDataURL(file);
      });
    }
    var saveNote = $('saveNote');
    if (saveNote) saveNote.onclick = async function () {
      var content = $('noteContent').value.trim();
      var file = noteFile && noteFile.files && noteFile.files[0];
      if (!content && !file) { $('noteStatus').textContent = 'Paste or upload a transcript first.'; return; }
      var y = window.pageYOffset;
      saveNote.disabled = true; saveNote.textContent = 'Processing…'; $('noteStatus').textContent = 'Reading transcript and creating a private draft summary…';
      var r;
      try {
        r = await api('/participants/' + p.id + '/transcripts', { method: 'POST', body: JSON.stringify({
        title: $('noteTitle').value.trim() || 'One-on-one meeting', transcript_text: content,
        file_base64: content ? '' : await fileBase64(file), source_name: (file && file.name) || 'Pasted transcript',
        occurred_at: $('noteDate').value ? new Date($('noteDate').value + 'T12:00:00').toISOString() : new Date().toISOString()
        }) });
      } catch (error) { r = { ok: false, error: error.message }; }
      saveNote.disabled = false; saveNote.textContent = 'Create draft summary';
      if (r.ok) { toast('Draft summary ready for review'); await openDetail(p.id); restoreY(y); }
      else $('noteStatus').textContent = r.error || 'Could not process the transcript.';
    };
    Array.prototype.forEach.call(document.querySelectorAll('[data-note-edit]'), function (button) {
      button.onclick = async function () {
        var id = button.getAttribute('data-note-edit');
        var copy = document.querySelector('[data-note-copy="' + id + '"]');
        var editor = document.querySelector('[data-note-editor="' + id + '"]');
        if (editor.hidden) {
          editor.hidden = false; copy.hidden = true; button.textContent = 'Save edited summary'; editor.focus(); return;
        }
        var content = editor.value.trim();
        if (!content) { toast('The summary cannot be empty'); return; }
        button.disabled = true; button.textContent = 'Saving…';
        var r = await api('/participants/' + p.id + '/notes/' + id, { method: 'PATCH', body: JSON.stringify({ content: content }) });
        button.disabled = false;
        if (r.ok) { toast('Summary updated'); await openDetail(p.id); }
        else { button.textContent = 'Save edited summary'; toast(r.error || 'Could not update summary'); }
      };
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-note-approve]'), function (button) {
      button.onclick = async function () {
        var id = button.getAttribute('data-note-approve');
        var editor = document.querySelector('[data-note-editor="' + id + '"]');
        var content = editor.value.trim();
        if (!content) { toast('Review the summary before approving it'); return; }
        var share = document.querySelector('[data-note-share="' + id + '"]');
        button.disabled = true; button.textContent = 'Approving…';
        var r = await api('/participants/' + p.id + '/notes/' + id + '/approve', { method: 'POST', body: JSON.stringify({
          content: content, share_with_participant: !!(share && share.checked)
        }) });
        if (r.ok) { toast('Approved for all course agents'); await openDetail(p.id); }
        else { button.disabled = false; button.textContent = 'Approve for course AI'; toast(r.error || 'Could not approve summary'); }
      };
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-note-participant]'), function (button) {
      button.onclick = async function () {
        var id = button.getAttribute('data-note-participant');
        var editor = document.querySelector('[data-note-editor="' + id + '"]');
        var sharing = button.getAttribute('data-shared') !== 'true';
        button.disabled = true;
        var r = await api('/participants/' + p.id + '/notes/' + id, { method: 'PATCH', body: JSON.stringify({
          content: editor.value.trim(), share_with_participant: sharing
        }) });
        if (r.ok) { toast(sharing ? 'Summary shared with participant' : 'Participant sharing stopped'); await openDetail(p.id); }
        else { button.disabled = false; toast(r.error || 'Could not update participant visibility'); }
      };
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-note-del]'), function (button) {
      button.onclick = async function () {
        if (!window.confirm('Delete this meeting transcript and summary?')) return;
        var y = window.pageYOffset;
        var r = await api('/participants/' + p.id + '/notes/' + button.getAttribute('data-note-del'), { method: 'DELETE' });
        if (r.ok) { toast('Meeting record deleted'); await openDetail(p.id); restoreY(y); }
        else toast(r.error || 'Could not delete');
      };
    });

    var assetFile = $('assetFile');
    if (assetFile) assetFile.onchange = function () {
      var file = assetFile.files && assetFile.files[0];
      if (!file) return;
      if (file.size > 6 * 1024 * 1024) { $('assetStatus').textContent = 'Participant files must be smaller than 6 MB.'; assetFile.value = ''; return; }
      if (!$('assetTitle').value) $('assetTitle').value = file.name.replace(/\.[^.]+$/, '');
      $('assetStatus').textContent = 'Ready to upload privately.';
    };
    var uploadAsset = $('uploadAsset');
    if (uploadAsset) uploadAsset.onclick = async function () {
      var file = assetFile && assetFile.files && assetFile.files[0];
      if (!file) { $('assetStatus').textContent = 'Choose a participant file first.'; return; }
      var y = window.pageYOffset;
      uploadAsset.disabled = true; uploadAsset.textContent = 'Uploading…'; $('assetStatus').textContent = 'Saving this file to the participant page…';
      var r;
      try {
        r = await api('/participants/' + p.id + '/assets', { method: 'POST', body: JSON.stringify({
          title: $('assetTitle').value.trim() || file.name,
          description: $('assetDescription').value.trim(),
          file_name: file.name,
          file_base64: await fileBase64(file)
        }) });
      } catch (error) { r = { ok: false, error: error.message }; }
      uploadAsset.disabled = false; uploadAsset.textContent = 'Upload participant asset';
      if (r.ok) { toast('Participant asset uploaded'); await openDetail(p.id); restoreY(y); }
      else $('assetStatus').textContent = r.error || 'Could not upload the participant file.';
    };
    Array.prototype.forEach.call(document.querySelectorAll('[data-asset-approve]'), function (button) {
      button.onclick = async function () {
        button.disabled = true; button.textContent = 'Approving…';
        var r = await api('/participants/' + p.id + '/assets/' + button.getAttribute('data-asset-approve') + '/approve', { method: 'POST' });
        if (r.ok) { toast('Asset approved for all course agents'); await openDetail(p.id); }
        else { button.disabled = false; button.textContent = 'Approve for course AI'; toast(r.error || 'Could not approve asset'); }
      };
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-asset-del]'), function (button) {
      button.onclick = async function () {
        if (!window.confirm('Delete this participant file?')) return;
        var y = window.pageYOffset;
        var r = await api('/participants/' + p.id + '/assets/' + button.getAttribute('data-asset-del'), { method: 'DELETE' });
        if (r.ok) { toast('Participant file deleted'); await openDetail(p.id); restoreY(y); }
        else toast(r.error || 'Could not delete participant file');
      };
    });
  }

  boot();
})();
