/* AI for Business Leaders — personalised lifelong participant workspace. */
(function () {
  'use strict';

  var parts = location.pathname.split('/').filter(Boolean);
  var slug = decodeURIComponent(parts[parts.length - 1] || '');
  var root = document.getElementById('workspace');
  if (!root || !slug || slug === 'workspace') return;

  var sessionTitles = {
    1: ['See the Difference', 'Beyond personal productivity'],
    2: ['Find the Leverage', 'Choose the problem worth solving'],
    3: ['Redesign the Work', 'Build the Company Brain workflow'],
    4: ['Redesign for Reality', 'Move from workflow map to governed pilot'],
    5: ['Defend and Commit', 'Complete the 90-day charter']
  };
  var data = null;

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function asText(value) {
    if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(' · ');
    if (value && typeof value === 'object') return Object.keys(value).map(function (key) {
      return key.replace(/_/g, ' ') + ': ' + asText(value[key]);
    }).filter(function (v) { return !/: $/.test(v); }).join(' · ');
    return String(value == null ? '' : value).trim();
  }
  function fmtDate(value) {
    if (!value) return '';
    var d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  }
  function firstName(name) { return String(name || '').trim().split(/\s+/)[0] || 'My'; }
  function possessive(name) { return /s$/i.test(name) ? name + '’' : name + '’s'; }

  async function api(url, init) {
    var options = Object.assign({}, init || {});
    options.headers = Object.assign({ Accept: 'application/json', 'Content-Type': 'application/json' }, options.headers || {});
    if (window.AblAuth && window.AblAuth.headers) options.headers = window.AblAuth.headers(options.headers);
    var response = await fetch(url, options);
    var body = await response.json().catch(function () { return {}; });
    if (!response.ok || body.ok === false) throw new Error(body.error || 'Could not load this workspace.');
    return body.data;
  }

  function itemCard(item) {
    var open = item.source_url ? ' href="' + esc(item.source_url) + '" target="_blank" rel="noopener"' : '';
    var tag = item.type || 'resource';
    return '<a class="lw-material-card"' + open + '>' +
      '<span class="type">' + esc(tag) + (item.session_number ? ' · Session ' + item.session_number : '') + '</span>' +
      '<strong>' + esc(item.title) + '</strong>' +
      (item.description ? '<p>' + esc(item.description) + '</p>' : '') +
      '</a>';
  }

  function navButton(view, icon, label, count) {
    return '<button type="button" data-lw-nav="' + esc(view) + '"><span class="lw-icon">' + icon + '</span><span>' + esc(label) + '</span>' +
      (count != null ? '<span class="lw-count">' + esc(count) + '</span>' : '') + '</button>';
  }

  function sidebarMarkup() {
    var p = data.participant || {};
    var current = Math.max(1, Math.min(5, parseInt((data.cohort && data.cohort.current_session) || (data.builder && data.builder.current_session) || 1, 10)));
    var resumeLabel = p.journey_started ? 'Resume my AI Journey' : 'Start my AI Journey';
    var unread = (data.announcements || []).length;
    return '<aside class="leadership-sidebar" id="leadershipSidebar">' +
      '<div class="lw-brand"><span class="lw-brand-mark">AI for Business Leaders</span>' +
      '<strong class="lw-brand-name">' + esc(possessive(firstName(p.name))) + ' AI Leadership Workspace</strong>' +
      '<span class="lw-brand-meta">' + esc((data.cohort && data.cohort.name) || 'Private participant workspace') + '</span></div>' +
      '<a class="lw-resume" href="/ai-business-leaders/s/' + encodeURIComponent(slug) + '"><small>Continue</small><strong>' + esc(resumeLabel) + '<span>→</span></strong></a>' +
      '<div class="lw-group"><div class="lw-group-label">Home</div><nav class="lw-nav">' +
        navButton('home', '⌂', 'Workspace home') +
        navButton('session-' + current, '●', 'Current session') +
        navButton('announcements', '✦', 'Updates from Vinay', unread || null) +
      '</nav></div>' +
      '<div class="lw-group"><div class="lw-group-label">Course</div><nav class="lw-nav">' +
        [1,2,3,4,5].map(function (n) { return navButton('session-' + n, '0' + n, sessionTitles[n][0]); }).join('') +
      '</nav></div>' +
      '<div class="lw-group"><div class="lw-group-label">My work</div><nav class="lw-nav">' +
        navButton('notebook', '◇', 'My Course Notebook') +
        navButton('assignments', '✓', 'Assignments', (data.assignments || []).filter(function (a) { return !a.submission || a.submission.status !== 'submitted'; }).length || null) +
        navButton('initiative', '↗', 'My 90-Day Initiative') +
      '</nav></div>' +
      '<div class="lw-group"><div class="lw-group-label">Library</div><nav class="lw-nav">' +
        navButton('library', '▤', 'Cases, recordings & slides', (data.materials || []).length || null) +
      '</nav></div>' +
      '<div class="lw-group"><div class="lw-group-label">After the course</div><nav class="lw-nav">' +
        '<a href="/ai-business-leaders/workspace/' + encodeURIComponent(slug) + '/continuing"><span class="lw-icon">↻</span><span>Continuing check-ins</span></a>' +
        '<a href="/ai-business-leaders/workspace/' + encodeURIComponent(slug) + '/siv"><span class="lw-icon">＋</span><span>Start a new AI initiative</span></a>' +
      '</nav></div>' +
      '<div class="lw-bottom"><nav class="lw-nav"><a href="mailto:vinay@goodspace.ai"><span class="lw-icon">?</span><span>Questions? Write to Vinay</span></a></nav></div>' +
      '</aside>';
  }

  function currentSessionMarkup() {
    var current = Math.max(1, Math.min(5, parseInt((data.cohort && data.cohort.current_session) || (data.builder && data.builder.current_session) || 1, 10)));
    var session = data.cohort && data.cohort.sessions && data.cohort.sessions[String(current)];
    var recent = (data.materials || []).slice().sort(function (a, b) { return String(b.updated_at || '').localeCompare(String(a.updated_at || '')); }).slice(0, 3);
    var announcements = (data.announcements || []).slice(0, 2);
    var updates = announcements.length ? announcements.map(function (a) {
      return '<div class="lw-update-item"><strong>' + esc(a.title) + '</strong><span>' + esc(fmtDate(a.publish_at || a.updated_at)) + '</span></div>';
    }).join('') : recent.map(function (m) {
      return '<div class="lw-update-item"><strong>' + esc(m.title) + '</strong><span>' + esc(m.type || 'Resource') + '</span></div>';
    }).join('');
    return '<section class="lw-home-strip">' +
      '<div class="lw-current-session"><span class="lw-label">Current session · ' + current + '</span>' +
      '<h3>' + esc(sessionTitles[current][0]) + '</h3><p>' + esc(sessionTitles[current][1]) + '</p>' +
      (session && session.date ? '<p><strong>' + esc(fmtDate(session.date)) + '</strong></p>' : '') +
      '<div class="lw-inline-actions"><button class="lw-action" data-lw-nav="session-' + current + '">Open session →</button>' +
      (session && session.meeting_url ? '<a class="lw-action ghost" href="' + esc(session.meeting_url) + '" target="_blank" rel="noopener">Join session ↗</a>' : '') + '</div></div>' +
      '<div class="lw-updates"><span class="lw-label">Recently added</span><h3>What is new</h3><div class="lw-update-list">' +
      (updates || '<p class="lw-empty">New materials and announcements will appear here.</p>') + '</div></div></section>';
  }

  function sessionView(n) {
    var materials = (data.materials || []).filter(function (m) { return Number(m.session_number) === n; });
    var assignment = (data.assignments || []).find(function (a) { return Number(a.session_number) === n; });
    var cohortSession = data.cohort && data.cohort.sessions && data.cohort.sessions[String(n)];
    function phase(name, title, intro) {
      var rows = materials.filter(function (m) { return (m.phase || 'before') === name; });
      if (name === 'after' && assignment) rows = rows.concat([{ title: assignment.title, description: 'Open the assignment and save your work.', type: 'assignment', source_url: '#assignments' }]);
      return '<section class="lw-phase"><h2>' + title + '</h2><p class="lw-phase-intro">' + intro + '</p>' +
        (rows.length ? rows.map(itemCard).join('') : '<p class="lw-empty">Nothing has been published here yet.</p>') + '</section>';
    }
    return '<section class="lw-page" data-lw-view="session-' + n + '" hidden>' +
      '<div class="lw-page-head"><div><p class="eyebrow">Session ' + n + '</p><h1>' + esc(sessionTitles[n][0]) + '</h1></div>' +
      '<p>' + esc(sessionTitles[n][1]) + (cohortSession && cohortSession.date ? '<br><strong>' + esc(fmtDate(cohortSession.date)) + '</strong>' : '') + '</p></div>' +
      (cohortSession && cohortSession.meeting_url ? '<div class="lw-inline-actions"><a class="lw-action" href="' + esc(cohortSession.meeting_url) + '" target="_blank" rel="noopener">Join live session ↗</a></div>' : '') +
      '<div class="lw-material-columns">' +
        phase('before', 'Before the session', 'Case, preparation question and recommended reading.') +
        phase('during', 'During the session', 'Presentation, exercise, notes and links shared live.') +
        phase('after', 'After the session', 'Recording, summary, assignment and additional resources.') +
      '</div></section>';
  }

  function notebookView() {
    var sessions = (data.builder && data.builder.sessions) || {};
    return '<section class="lw-page" data-lw-view="notebook" hidden><div class="lw-page-head"><div><p class="eyebrow">My work</p><h1>My Course <em>Notebook</em></h1></div><p>One cumulative record of what you have established across the five sessions.</p></div>' +
      '<div class="lw-notebook-grid">' + [1,2,3,4,5].map(function (n) {
        var s = sessions[String(n)] || {};
        var keys = Object.keys(s).filter(function (k) { return k !== 'updated_at' && asText(s[k]); });
        return '<article class="lw-notebook-card"><span class="source">Session ' + n + '</span><h3>' + esc(sessionTitles[n][0]) + '</h3>' +
          (keys.length ? '<dl>' + keys.map(function (k) { return '<dt>' + esc(k.replace(/_/g, ' ')) + '</dt><dd>' + esc(asText(s[k])) + '</dd>'; }).join('') + '</dl>' : '<p class="lw-empty">Your small win from this session will appear here.</p>') + '</article>';
      }).join('') + '</div></section>';
  }

  function assignmentView() {
    var assignments = data.assignments || [];
    return '<section class="lw-page" data-lw-view="assignments" hidden><div class="lw-page-head"><div><p class="eyebrow">My work</p><h1>Assignments</h1></div><p>Save a draft, return later, and submit when ready. There is no grading system.</p></div>' +
      '<div class="lw-assignment-list">' + (assignments.length ? assignments.map(function (a) {
        var s = a.submission || {};
        return '<article class="lw-assignment" data-assignment="' + esc(a.id) + '"><div class="lw-assignment-head"><div><span class="lw-label">Session ' + a.session_number + '</span><h3>' + esc(a.title) + '</h3></div><span class="lw-status ' + esc(s.status || '') + '">' + esc(s.status || 'Not started') + '</span></div>' +
          (a.due_at ? '<p class="lw-phase-intro">Due ' + esc(fmtDate(a.due_at)) + '</p>' : '') +
          '<p class="lw-assignment-instructions">' + esc(a.instructions || '') + '</p>' +
          '<textarea data-field="response_text" placeholder="Write your response here…">' + esc(s.response_text || '') + '</textarea>' +
          '<input data-field="file_url" type="url" placeholder="Optional file or Drive link" value="' + esc(s.file_url || '') + '">' +
          '<div class="lw-assignment-actions"><button class="lw-action ghost" data-save="draft">Save draft</button><button class="lw-action" data-save="submitted">Submit</button><span class="lw-save-status"></span></div></article>';
      }).join('') : '<p class="lw-empty">No assignments have been published yet.</p>') + '</div></section>';
  }

  function initiativeView() {
    var builder = data.builder || { completion_percent: 0, sessions: {} };
    var s2 = builder.sessions && builder.sessions['2'] || {};
    var s4 = builder.sessions && builder.sessions['4'] || {};
    var s5 = builder.sessions && builder.sessions['5'] || {};
    return '<section class="lw-page" data-lw-view="initiative" hidden><div class="lw-page-head"><div><p class="eyebrow">After the course</p><h1>My 90-Day <em>Initiative</em></h1></div><p>Your working AI leadership charter. Keep improving it as evidence arrives.</p></div>' +
      '<div class="lw-initiative"><span class="lw-label">' + (builder.completion_percent || 0) + '% established</span><div class="lw-initiative-progress"><span style="width:' + (builder.completion_percent || 0) + '%"></span></div>' +
      '<div class="lw-notebook-grid">' +
        '<article class="lw-notebook-card"><span class="source">Business problem</span><h3>' + esc(asText(s2.problem_sentence) || 'Not established yet') + '</h3><p>' + esc(asText(s2.baseline) || 'Add the baseline and consequence in Session 2.') + '</p></article>' +
        '<article class="lw-notebook-card"><span class="source">Pilot boundary</span><h3>' + esc(asText(s4.pilot_boundary) || 'Not established yet') + '</h3><p>' + esc(asText(s4.ownership) || 'Add the owner, users and operating boundary in Session 4.') + '</p></article>' +
      '</div><div class="lw-decision-row">' +
        '<div class="lw-decision"><strong>Scale</strong><p>' + esc(asText(s5.scale_if) || 'Define the evidence that earns expansion.') + '</p></div>' +
        '<div class="lw-decision"><strong>Fix</strong><p>' + esc(asText(s5.fix_if) || 'Define what can be corrected without abandoning the pilot.') + '</p></div>' +
        '<div class="lw-decision"><strong>Stop</strong><p>' + esc(asText(s5.stop_if) || 'Define the evidence that makes stopping the right decision.') + '</p></div>' +
      '</div><div class="lw-inline-actions">' +
        '<a class="lw-action" href="/ai-business-leaders/course/' + encodeURIComponent(slug) + '">Continue building →</a>' +
        (data.initiative ? '<a class="lw-action ghost" href="/ai-business-leaders/pdf/' + esc(data.initiative.id) + '" target="_blank" rel="noopener">Open latest charter ↗</a>' : '') +
      '</div></div></section>';
  }

  function libraryView() {
    var items = data.materials || [];
    var types = ['all'].concat(Array.from(new Set(items.map(function (m) { return m.type || 'resource'; }))));
    return '<section class="lw-page" data-lw-view="library" hidden><div class="lw-page-head"><div><p class="eyebrow">Permanent library</p><h1>Cases, recordings <em>&amp; materials</em></h1></div><p>Everything Vinay publishes to your cohort remains available here.</p></div>' +
      '<div class="lw-library-tools">' + types.map(function (t, i) { return '<button class="lw-filter' + (i === 0 ? ' active' : '') + '" data-filter="' + esc(t) + '">' + esc(t) + '</button>'; }).join('') + '</div>' +
      '<div class="lw-library-grid">' + (items.length ? items.map(function (m) { return '<div data-material-type="' + esc(m.type || 'resource') + '">' + itemCard(m) + '</div>'; }).join('') : '<p class="lw-empty">Published course materials will collect here automatically.</p>') + '</div></section>';
  }

  function announcementsView() {
    var rows = data.announcements || [];
    return '<section class="lw-page" data-lw-view="announcements" hidden><div class="lw-page-head"><div><p class="eyebrow">From Vinay</p><h1>Updates &amp; announcements</h1></div><p>Schedule changes, new materials and notes for your cohort.</p></div>' +
      '<div class="lw-assignment-list">' + (rows.length ? rows.map(function (a) { return '<article class="lw-assignment"><div class="lw-assignment-head"><h3>' + esc(a.title) + '</h3><span class="lw-status">' + esc(fmtDate(a.publish_at || a.updated_at)) + '</span></div><p class="lw-assignment-instructions">' + esc(a.message) + '</p>' + (a.link_url ? '<div class="lw-inline-actions"><a class="lw-action ghost" href="' + esc(a.link_url) + '">Open link →</a></div>' : '') + '</article>'; }).join('') : '<p class="lw-empty">No announcements yet.</p>') + '</div></section>';
  }

  function installShell() {
    if (document.querySelector('.leadership-shell')) return;
    document.body.classList.add('leadership-workspace-active');
    var shell = document.createElement('div');
    shell.className = 'leadership-shell';
    root.parentNode.insertBefore(shell, root);
    shell.innerHTML = sidebarMarkup();
    shell.appendChild(root);
    root.classList.add('leadership-main');

    var home = document.createElement('div');
    home.setAttribute('data-lw-view', 'home');
    while (root.firstChild) home.appendChild(root.firstChild);
    root.appendChild(home);
    var hero = home.querySelector('.hero');
    if (hero) hero.insertAdjacentHTML('afterend', currentSessionMarkup());

    var nextTitle = home.querySelector('.next-step-title');
    var nextAction = home.querySelector('.next-step-action');
    if (data.participant && data.participant.journey_started) {
      if (nextTitle && /Start with your AI Journey/i.test(nextTitle.textContent)) nextTitle.textContent = 'Resume your AI Journey';
      if (nextAction && /Begin/i.test(nextAction.textContent)) nextAction.innerHTML = 'Resume <span>→</span>';
    }

    [1,2,3,4,5].forEach(function (n) { root.insertAdjacentHTML('beforeend', sessionView(n)); });
    root.insertAdjacentHTML('beforeend', notebookView());
    root.insertAdjacentHTML('beforeend', assignmentView());
    root.insertAdjacentHTML('beforeend', initiativeView());
    root.insertAdjacentHTML('beforeend', libraryView());
    root.insertAdjacentHTML('beforeend', announcementsView());

    var toggle = document.createElement('button');
    toggle.type = 'button'; toggle.className = 'lw-mobile-toggle'; toggle.setAttribute('aria-label', 'Open workspace menu'); toggle.textContent = '☰';
    document.body.appendChild(toggle);
    toggle.onclick = function () { document.body.classList.toggle('lw-menu-open'); };

    wireNavigation();
    wireAssignments();
    wireLibrary();
    showView(location.hash ? location.hash.slice(1) : 'home');
  }

  function showView(view) {
    var target = root.querySelector('[data-lw-view="' + CSS.escape(view) + '"]');
    if (!target) { view = 'home'; target = root.querySelector('[data-lw-view="home"]'); }
    Array.prototype.forEach.call(root.querySelectorAll('[data-lw-view]'), function (node) { node.hidden = node !== target; });
    Array.prototype.forEach.call(document.querySelectorAll('[data-lw-nav]'), function (node) { node.classList.toggle('active', node.getAttribute('data-lw-nav') === view); });
    if (history.replaceState) history.replaceState(null, '', location.pathname + (view === 'home' ? '' : '#' + view));
    document.body.classList.remove('lw-menu-open');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function wireNavigation() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-lw-nav]'), function (node) {
      node.addEventListener('click', function (e) { e.preventDefault(); showView(node.getAttribute('data-lw-nav')); });
    });
  }
  function wireAssignments() {
    Array.prototype.forEach.call(root.querySelectorAll('[data-assignment]'), function (card) {
      Array.prototype.forEach.call(card.querySelectorAll('[data-save]'), function (button) {
        button.onclick = async function () {
          var status = card.querySelector('.lw-save-status');
          var badge = card.querySelector('.lw-status');
          button.disabled = true; status.textContent = 'Saving…';
          try {
            var saved = await api('/api/abl/workspace/' + encodeURIComponent(slug) + '/submissions/' + encodeURIComponent(card.getAttribute('data-assignment')), {
              method: 'PATCH', body: JSON.stringify({
                status: button.getAttribute('data-save'),
                response_text: card.querySelector('[data-field="response_text"]').value,
                file_url: card.querySelector('[data-field="file_url"]').value
              })
            });
            badge.textContent = saved.status; badge.className = 'lw-status ' + saved.status;
            status.textContent = saved.status === 'submitted' ? 'Submitted.' : 'Draft saved.';
          } catch (e) { status.textContent = e.message || 'Could not save.'; }
          button.disabled = false;
        };
      });
    });
  }
  function wireLibrary() {
    Array.prototype.forEach.call(root.querySelectorAll('.lw-filter'), function (button) {
      button.onclick = function () {
        var filter = button.getAttribute('data-filter');
        Array.prototype.forEach.call(root.querySelectorAll('.lw-filter'), function (b) { b.classList.toggle('active', b === button); });
        Array.prototype.forEach.call(root.querySelectorAll('[data-material-type]'), function (item) {
          item.hidden = filter !== 'all' && item.getAttribute('data-material-type') !== filter;
        });
      };
    });
  }

  async function loadWorkspace() {
    try {
      data = await api('/api/abl/workspace/' + encodeURIComponent(slug));
      var wait = function () {
        if (root.querySelector('.hero') || root.querySelector('.error-state')) installShell();
        else requestAnimationFrame(wait);
      };
      wait();
    } catch (e) {
      console.error(e);
      // The established participant page remains usable even when the new
      // workspace layer is temporarily unavailable.
    }
  }

  loadWorkspace();
})();
