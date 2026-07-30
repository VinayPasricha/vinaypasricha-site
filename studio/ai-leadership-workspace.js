/* Vinay Studio — AI Leadership Workspace management. */
(function () {
  'use strict';

  var state = { participants: [], cohorts: [], materials: [], assignments: [], announcements: [], submissions: [] };
  var $ = function (id) { return document.getElementById(id); };

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmtDate(value) {
    if (!value) return '—';
    var d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  }
  function toast(message) {
    var t = $('toast'); t.textContent = message; t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 2200);
  }
  async function api(path, init) {
    var response = await fetch('/api/abl/workspace/admin' + path, Object.assign({ headers: { 'Content-Type': 'application/json', Accept: 'application/json' } }, init || {}));
    var body = await response.json().catch(function () { return {}; });
    if (response.status === 401) { location.replace('/studio/login'); throw new Error('Studio login required'); }
    if (!response.ok || body.ok === false) throw new Error(body.error || 'Request failed');
    return body.data;
  }
  function fileSelected(id) {
    var el = $(id);
    return !!(el && el.files && el.files[0]);
  }
  // Read a chosen PDF as a data URL and upload it; returns { file_key, file_name }.
  async function uploadPdf(id) {
    var file = $(id).files[0];
    if (file.size > 8 * 1024 * 1024) throw new Error('That PDF is larger than 8 MB.');
    if (file.type ? file.type !== 'application/pdf' : !/\.pdf$/i.test(file.name)) throw new Error('Only PDF files can be uploaded.');
    var dataUrl = await new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result)); };
      r.onerror = function () { reject(new Error('The file could not be read.')); };
      r.readAsDataURL(file);
    });
    return api('/materials/upload', { method: 'POST', body: JSON.stringify({ data: dataUrl, file_name: file.name }) });
  }
  function cohortName(id) {
    var c = state.cohorts.find(function (x) { return x.id === id; });
    return c ? c.name : 'Unassigned';
  }
  function participantName(id) {
    var p = state.participants.find(function (x) { return x.id === id; });
    return p ? p.name : 'Participant';
  }
  function assignmentName(id) {
    var a = state.assignments.find(function (x) { return x.id === id; });
    return a ? a.title : 'Assignment';
  }
  function options(selected, includeAll) {
    var html = includeAll ? '<option value="">Unassigned</option>' : '<option value="">Choose cohort</option>';
    return html + state.cohorts.map(function (c) { return '<option value="' + esc(c.id) + '"' + (c.id === selected ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('');
  }

  // ---- form guards ----
  // Show a field only when its controlling <select> has a qualifying value, and
  // run once on load so the default state is right. Hides the wrapping .field
  // so its label goes too. Keeps contradictory choices (e.g. Everyone + a
  // cohort) off the screen entirely.
  function bindConditional(controlId, targetId, showWhen) {
    var ctrl = $(controlId), target = $(targetId);
    if (!ctrl || !target) return;
    var field = target.closest('.field') || target;
    function apply() { field.style.display = showWhen(ctrl.value) ? '' : 'none'; }
    ctrl.addEventListener('change', apply);
    apply();
  }
  var isCohorts = function (v) { return v === 'cohorts'; };
  var isScheduled = function (v) { return v === 'scheduled'; };

  function showPage(name) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-page-view]'), function (page) { page.hidden = page.getAttribute('data-page-view') !== name; });
    Array.prototype.forEach.call(document.querySelectorAll('.studio-nav [data-page]'), function (b) { b.classList.toggle('active', b.getAttribute('data-page') === name); });
    document.body.classList.remove('menu-open');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function wireNavigation() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-page]'), function (node) {
      node.addEventListener('click', function () { showPage(node.getAttribute('data-page')); });
    });
    $('mobileMenu').onclick = function () { document.body.classList.toggle('menu-open'); };
    $('openOldStudio').onclick = function () { location.href = '/studio/ai-business-leaders'; };
    $('refreshAll').onclick = function () { load(); };
  }

  function renderSessionEditors() {
    $('sessionEditors').innerHTML = [1,2,3,4,5].map(function (n) {
      return '<div class="session-editor"><strong>Session ' + n + '</strong><div class="field"><label>Date & time</label><input id="cohortSessionDate' + n + '" type="datetime-local"></div><div class="field" style="margin-top:8px"><label>Meeting link</label><input id="cohortSessionLink' + n + '" placeholder="https://meet.google.com/..."></div></div>';
    }).join('');
  }

  function renderStats() {
    var active = state.participants.filter(function (p) { return (p.invite_status || '') === 'active'; }).length;
    var submitted = state.submissions.filter(function (s) { return s.status === 'submitted'; }).length;
    $('stats').innerHTML = [
      [state.participants.length, 'Participants'], [state.cohorts.length, 'Current cohorts'],
      [state.materials.filter(function (m) { return m.status === 'published'; }).length, 'Published materials'], [submitted, 'Submitted assignments']
    ].map(function (s) { return '<div class="stat"><strong>' + s[0] + '</strong><span>' + s[1] + '</span></div>'; }).join('');
    $('navParticipants').textContent = state.participants.length;
    $('navCohorts').textContent = state.cohorts.length;
    $('navMaterials').textContent = state.materials.length;
    $('navAssignments').textContent = state.assignments.length;
    $('navAnnouncements').textContent = state.announcements.length;
  }

  function cohortCard(c, compact) {
    var count = state.participants.filter(function (p) { return p.cohort_id === c.id; }).length;
    var current = Math.max(1, Math.min(5, parseInt(c.current_session, 10) || 1));
    var next = c.sessions && c.sessions[String(current)];
    return '<article class="entity-card" data-cohort="' + esc(c.id) + '"><span class="meta">' + count + ' participants · Session ' + current + '</span><h3>' + esc(c.name) + '</h3>' +
      '<p>' + esc(c.description || 'No description') + '</p><p>' + (next && next.date ? 'Next: ' + esc(fmtDate(next.date)) : 'Session date not added') + '</p>' +
      (compact ? '' : '<div class="field" style="margin-top:12px"><label>Current session</label><select data-cohort-current>' + [1,2,3,4,5].map(function (n) { return '<option' + (n === current ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></div>' +
      '<div class="actions"><button class="btn small" data-save-cohort>Save</button><button class="btn small ghost" data-delete-cohort>Delete</button></div>') + '</article>';
  }
  function renderCohorts() {
    $('homeCohorts').innerHTML = state.cohorts.length ? state.cohorts.slice(0, 3).map(function (c) { return cohortCard(c, true); }).join('') : '<p class="empty">No cohorts yet.</p>';
    $('cohortCards').innerHTML = state.cohorts.length ? state.cohorts.map(function (c) { return cohortCard(c, false); }).join('') : '<p class="empty">Create the first cohort above.</p>';
    Array.prototype.forEach.call($('cohortCards').querySelectorAll('[data-cohort]'), function (card) {
      card.querySelector('[data-save-cohort]').onclick = async function () {
        try {
          await api('/cohorts/' + card.getAttribute('data-cohort'), { method: 'PATCH', body: JSON.stringify({ current_session: Number(card.querySelector('[data-cohort-current]').value) }) });
          toast('Cohort updated'); await load();
        } catch (e) { toast(e.message); }
      };
      card.querySelector('[data-delete-cohort]').onclick = async function () {
        if (!confirm('Delete this cohort? Participants will remain in the master directory.')) return;
        try { await api('/cohorts/' + card.getAttribute('data-cohort'), { method: 'DELETE' }); toast('Cohort deleted'); await load(); } catch (e) { toast(e.message); }
      };
    });
  }

  function renderParticipants() {
    var query = ($('participantSearch').value || '').toLowerCase().trim();
    var rows = state.participants.filter(function (p) {
      return !query || [p.name, p.email, p.phone, p.company_name, cohortName(p.cohort_id)].join(' ').toLowerCase().includes(query);
    });
    $('participantRows').innerHTML = rows.length ? rows.map(function (p, i) {
      var invite = p.invite_status || (p.link_approved ? 'invited' : 'not_invited');
      return '<tr data-participant="' + esc(p.id) + '"><td class="sub" style="color:var(--ink-3);white-space:nowrap">' + (i + 1) + '</td><td><div class="name">' + esc(p.name) + '</div><div class="sub">' + esc(p.role_title || '') + '</div></td>' +
        '<td><div>' + esc(p.email || '—') + '</div><div class="sub">' + esc(p.phone || '—') + '</div></td><td>' + esc(p.company_name || '—') + '</td>' +
        '<td><select data-participant-cohort>' + options(p.cohort_id, true) + '</select></td><td><span class="pill ' + esc(invite) + '">' + esc(invite.replace(/_/g, ' ')) + '</span></td>' +
        '<td><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn small" data-invite>' + (invite === 'not_invited' ? 'Send invite' : 'Resend invite') + '</button>' +
        '<a class="btn small ghost" href="/ai-business-leaders/workspace/' + encodeURIComponent(p.slug) + '?admin=1" target="_blank" rel="noopener">Open workspace</a></div></td></tr>';
    }).join('') : '<tr><td colspan="7" class="empty">No matching participants.</td></tr>';
    Array.prototype.forEach.call($('participantRows').querySelectorAll('[data-participant]'), function (row) {
      var id = row.getAttribute('data-participant');
      row.querySelector('[data-participant-cohort]').onchange = async function (e) {
        try { await api('/participants/' + id, { method: 'PATCH', body: JSON.stringify({ cohort_id: e.target.value || null }) }); toast('Cohort changed'); await load(); } catch (err) { toast(err.message); }
      };
      row.querySelector('[data-invite]').onclick = async function () {
        try {
          var result = await api('/participants/' + id + '/invite', { method: 'POST', body: '{}' });
          if (navigator.clipboard) await navigator.clipboard.writeText(result.activation_url);
          toast('Invite activated and link copied'); await load();
        } catch (e) { toast(e.message); }
      };
    });
  }

  function materialCard(m) {
    return '<article class="entity-card" data-material="' + esc(m.id) + '"><span class="meta">' + esc(m.type || 'resource') + ' · ' + (m.session_number ? 'Session ' + m.session_number : 'Library') + '</span><h3>' + esc(m.title) + '</h3>' +
      '<p>' + esc(m.description || m.source_url || '') + '</p><p><span class="pill ' + esc(m.status) + '">' + esc(m.status) + '</span> · ' + esc(m.audience || 'all') + (m.audience === 'cohorts' ? ' · ' + esc(cohortName((m.cohort_ids || [])[0])) : '') + '</p>' +
      '<div class="actions">' + (m.source_url ? '<a class="btn small ghost" href="' + esc(m.source_url) + '" target="_blank" rel="noopener">Preview</a>' : '') + '<button class="btn small ghost" data-delete-material>Delete</button></div></article>';
  }
  function renderMaterials() {
    $('materialCards').innerHTML = state.materials.length ? state.materials.map(materialCard).join('') : '<p class="empty">No materials yet.</p>';
    Array.prototype.forEach.call($('materialCards').querySelectorAll('[data-material]'), function (card) {
      card.querySelector('[data-delete-material]').onclick = async function () {
        if (!confirm('Delete this material?')) return;
        try { await api('/materials/' + card.getAttribute('data-material'), { method: 'DELETE' }); toast('Material deleted'); await load(); } catch (e) { toast(e.message); }
      };
    });
    var recent = state.materials.filter(function (m) { return m.status === 'published'; }).slice(0, 3)
      .concat(state.announcements.filter(function (a) { return a.status === 'published'; }).slice(0, 2));
    $('recentPublished').innerHTML = recent.length ? recent.map(function (m) {
      return '<article class="entity-card"><span class="meta">' + esc(m.type || 'Announcement') + '</span><h3>' + esc(m.title) + '</h3><p>' + esc(m.description || m.message || '') + '</p></article>';
    }).join('') : '<p class="empty">Nothing has been published yet.</p>';
  }

  function renderAssignments() {
    $('assignmentCards').innerHTML = state.assignments.length ? state.assignments.map(function (a) {
      return '<article class="entity-card" data-assignment="' + esc(a.id) + '"><span class="meta">Session ' + a.session_number + ' · ' + esc(cohortName((a.cohort_ids || [])[0])) + '</span><h3>' + esc(a.title) + '</h3><p>' + esc(a.instructions || '') + '</p><p><span class="pill ' + esc(a.status) + '">' + esc(a.status) + '</span>' + (a.due_at ? ' · Due ' + esc(fmtDate(a.due_at)) : '') + '</p><div class="actions"><button class="btn small ghost" data-delete-assignment>Delete</button></div></article>';
    }).join('') : '<p class="empty">No assignments yet.</p>';
    Array.prototype.forEach.call($('assignmentCards').querySelectorAll('[data-assignment]'), function (card) {
      card.querySelector('[data-delete-assignment]').onclick = async function () {
        if (!confirm('Delete this assignment?')) return;
        try { await api('/assignments/' + card.getAttribute('data-assignment'), { method: 'DELETE' }); toast('Assignment deleted'); await load(); } catch (e) { toast(e.message); }
      };
    });
    $('submissionRows').innerHTML = state.submissions.length ? state.submissions.map(function (s) {
      return '<tr><td>' + esc(participantName(s.participant_id)) + '</td><td>' + esc(assignmentName(s.assignment_id)) + '</td><td><span class="pill ' + esc(s.status) + '">' + esc(s.status) + '</span></td><td>' + esc(fmtDate(s.submitted_at)) + '</td><td><div style="max-width:420px;white-space:pre-wrap">' + esc(s.response_text || '—') + '</div>' + (s.file_url ? '<div class="sub"><a href="' + esc(s.file_url) + '" target="_blank">Open file ↗</a></div>' : '') + '</td></tr>';
    }).join('') : '<tr><td colspan="5" class="empty">No drafts or submissions yet.</td></tr>';
  }

  function renderAnnouncements() {
    $('announcementCards').innerHTML = state.announcements.length ? state.announcements.map(function (a) {
      return '<article class="entity-card"><span class="meta">' + esc(a.audience || 'all') + (a.audience === 'cohorts' ? ' · ' + esc(cohortName((a.cohort_ids || [])[0])) : '') + '</span><h3>' + esc(a.title) + '</h3><p>' + esc(a.message) + '</p><p><span class="pill ' + esc(a.status) + '">' + esc(a.status) + '</span> · ' + esc(fmtDate(a.publish_at || a.updated_at)) + '</p></article>';
    }).join('') : '<p class="empty">No announcements yet.</p>';
  }

  function refreshCohortSelects() {
    ['bulkCohort', 'materialCohort', 'assignmentCohort', 'announcementCohort'].forEach(function (id) { $(id).innerHTML = options('', true); });
  }
  function renderAll() {
    refreshCohortSelects(); renderStats(); renderCohorts(); renderParticipants(); renderMaterials(); renderAssignments(); renderAnnouncements();
  }

  function parseParticipants(text) {
    return String(text || '').split(/\n+/).map(function (line) {
      var cols = line.split(/\t|,/).map(function (x) { return x.trim(); });
      return { name: cols[0] || '', email: cols[1] || '', phone: cols[2] || '', company_name: cols[3] || '', role_title: cols[4] || '' };
    }).filter(function (p) { return p.name || p.email; });
  }

  function wireForms() {
    $('participantSearch').oninput = renderParticipants;
    $('addParticipants').onclick = async function () {
      var button = this, status = $('participantFormStatus'), participants = parseParticipants($('bulkParticipants').value);
      if (!participants.length) { status.textContent = 'Paste at least one participant.'; return; }
      button.disabled = true; status.textContent = 'Adding…';
      try {
        var result = await api('/participants/bulk', { method: 'POST', body: JSON.stringify({ cohort_id: $('bulkCohort').value || null, participants: participants }) });
        status.textContent = result.created.length + ' added' + (result.skipped.length ? ' · ' + result.skipped.length + ' skipped' : '');
        $('bulkParticipants').value = ''; await load();
      } catch (e) { status.textContent = e.message; }
      button.disabled = false;
    };

    $('createCohort').onclick = async function () {
      if (!$('cohortName').value.trim()) { $('cohortFormStatus').textContent = 'Give the cohort a name first.'; return; }
      var sessions = {};
      [1,2,3,4,5].forEach(function (n) {
        var date = $('cohortSessionDate' + n).value, link = $('cohortSessionLink' + n).value.trim();
        if (date || link) sessions[String(n)] = { date: date || null, meeting_url: link || null };
      });
      var button = this, status = $('cohortFormStatus'); button.disabled = true; status.textContent = 'Saving…';
      try {
        await api('/cohorts', { method: 'POST', body: JSON.stringify({ name: $('cohortName').value, description: $('cohortDescription').value, current_session: Number($('cohortCurrent').value), sessions: sessions }) });
        status.textContent = 'Cohort created.'; $('cohortName').value = ''; $('cohortDescription').value = ''; renderSessionEditors(); await load();
      } catch (e) { status.textContent = e.message; }
      button.disabled = false;
    };

    $('publishMaterial').onclick = async function () {
      var audience = $('materialAudience').value, cohort = $('materialCohort').value, mstatus = $('materialFormStatus');
      if (!$('materialTitle').value.trim()) { mstatus.textContent = 'Add a title first.'; return; }
      if (audience === 'cohorts' && !cohort) { mstatus.textContent = 'Choose a cohort, or set the audience to Everyone.'; return; }
      if ($('materialStatus').value === 'scheduled' && !$('materialPublishAt').value) { mstatus.textContent = 'Pick a publish date and time to schedule it.'; return; }
      if (!$('materialUrl').value.trim() && !fileSelected('materialFile')) { mstatus.textContent = 'Add a link or upload a PDF.'; return; }
      var button = this; button.disabled = true; mstatus.textContent = 'Saving…';
      try {
        var uploaded = null;
        if (fileSelected('materialFile')) { mstatus.textContent = 'Uploading PDF…'; uploaded = await uploadPdf('materialFile'); }
        var body = { title: $('materialTitle').value, type: $('materialType').value, session_number: Number($('materialSession').value), phase: $('materialPhase').value,
          source_url: $('materialUrl').value, description: $('materialDescription').value, status: $('materialStatus').value,
          publish_at: $('materialPublishAt').value || null, audience: audience, cohort_ids: audience === 'cohorts' && cohort ? [cohort] : [],
          file_key: uploaded ? uploaded.file_key : '', file_name: uploaded ? uploaded.file_name : '' };
        await api('/materials', { method: 'POST', body: JSON.stringify(body) });
        mstatus.textContent = 'Material saved.';
        ['materialTitle','materialUrl','materialDescription','materialPublishAt'].forEach(function (id) { $(id).value = ''; });
        if ($('materialFile')) $('materialFile').value = '';
        if ($('materialFileStatus')) $('materialFileStatus').textContent = '';
        await load();
      }
      catch (e) { mstatus.textContent = e.message; }
      button.disabled = false;
    };

    $('createAssignment').onclick = async function () {
      var cohort = $('assignmentCohort').value;
      if (!$('assignmentTitle').value.trim()) { $('assignmentFormStatus').textContent = 'Add a title first.'; return; }
      if ($('assignmentStatus').value === 'scheduled' && !$('assignmentDueAt').value) { $('assignmentFormStatus').textContent = 'Set a due date to schedule it.'; return; }
      var body = { title: $('assignmentTitle').value, instructions: $('assignmentInstructions').value, session_number: Number($('assignmentSession').value), due_at: $('assignmentDueAt').value || null,
        audience: cohort ? 'cohorts' : 'all', cohort_ids: cohort ? [cohort] : [], status: $('assignmentStatus').value };
      var button = this, status = $('assignmentFormStatus'); button.disabled = true; status.textContent = 'Saving…';
      try { await api('/assignments', { method: 'POST', body: JSON.stringify(body) }); status.textContent = 'Assignment saved.'; $('assignmentTitle').value = ''; $('assignmentInstructions').value = ''; await load(); }
      catch (e) { status.textContent = e.message; }
      button.disabled = false;
    };

    $('publishAnnouncement').onclick = async function () {
      var audience = $('announcementAudience').value, cohort = $('announcementCohort').value, astatus = $('announcementFormStatus');
      if (!$('announcementTitle').value.trim()) { astatus.textContent = 'Add a title first.'; return; }
      if (!$('announcementMessage').value.trim()) { astatus.textContent = 'Write a message first.'; return; }
      if (audience === 'cohorts' && !cohort) { astatus.textContent = 'Choose a cohort, or set the audience to Everyone.'; return; }
      if ($('announcementStatus').value === 'scheduled' && !$('announcementPublishAt').value) { astatus.textContent = 'Pick a publish date and time to schedule it.'; return; }
      var body = { title: $('announcementTitle').value, message: $('announcementMessage').value, link_url: $('announcementLink').value, status: $('announcementStatus').value,
        publish_at: $('announcementPublishAt').value || null, audience: audience, cohort_ids: audience === 'cohorts' && cohort ? [cohort] : [] };
      var button = this, status = $('announcementFormStatus'); button.disabled = true; status.textContent = 'Publishing…';
      try {
        var saved = await api('/announcements', { method: 'POST', body: JSON.stringify(body) });
        // Report the delivery, not just the save: an operator needs to know how
        // many participants it actually reached.
        var mail = saved && saved.email;
        if (!mail) status.textContent = 'Announcement saved as a draft — nothing emailed yet.';
        else if (mail.skipped === 'email_not_configured') status.textContent = 'Published. Email is not configured on this server, so nothing was sent.';
        else if (!mail.attempted) status.textContent = 'Published. No participant in this audience has an email address on file.';
        else if (mail.failed) status.textContent = 'Published and emailed ' + mail.sent + ' of ' + mail.attempted + ' participants — ' + mail.failed + ' could not be delivered.';
        else status.textContent = 'Published and emailed ' + mail.sent + ' participant' + (mail.sent === 1 ? '' : 's') + '.';
        await load();
      }
      catch (e) { status.textContent = e.message; }
      button.disabled = false;
    };

    $('copyWhatsApp').onclick = async function () {
      var text = '*' + ($('announcementTitle').value || 'AI for Business Leaders') + '*\n\n' + ($('announcementMessage').value || '') + ($('announcementLink').value ? '\n\n' + $('announcementLink').value : '');
      if (navigator.clipboard) await navigator.clipboard.writeText(text);
      toast('WhatsApp message copied');
    };

    // Conditional fields: a cohort picker only when the audience is a cohort,
    // and a publish date only when scheduling. Runs once now so the defaults
    // (Everyone / Publish now) start with those fields hidden.
    bindConditional('materialAudience', 'materialCohort', isCohorts);
    bindConditional('announcementAudience', 'announcementCohort', isCohorts);
    bindConditional('materialStatus', 'materialPublishAt', isScheduled);
    bindConditional('announcementStatus', 'announcementPublishAt', isScheduled);
  }

  async function load() {
    try {
      var dashboard = await api('/dashboard');
      state.participants = dashboard.participants || [];
      state.cohorts = dashboard.cohorts || [];
      state.materials = dashboard.materials || [];
      state.assignments = dashboard.assignments || [];
      state.announcements = dashboard.announcements || [];
      state.submissions = dashboard.submissions || [];
      renderAll();
    } catch (e) { toast(e.message); }
  }

  renderSessionEditors();
  wireNavigation();
  wireForms();
  load();
})();
