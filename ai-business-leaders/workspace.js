/* AI for Business Leaders — three-conversation participant workspace. */
(function () {
  'use strict';

  var parts = location.pathname.split('/').filter(Boolean);
  var slug = decodeURIComponent(parts[parts.length - 1] || '');
  var root = document.getElementById('workspace');
  var signOut = document.getElementById('courseSignOut');
  if (signOut) signOut.onclick = function () {
    window.AblAuth.clear();
    location.replace('/ai-business-leaders/login');
  };

  async function authFetch(url, init) {
    var options = Object.assign({}, init || {});
    options.headers = window.AblAuth.headers(Object.assign({}, (init && init.headers) || {}));
    var response = await fetch(url, options);
    if (response.status === 401) { window.AblAuth.clear(); window.AblAuth.login(); }
    return response;
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function localJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); }
    catch (e) { return null; }
  }

  function localProgress() {
    var siv = localJson('siv_session_v1');
    var ved = localJson('kairos.runtime.v1');

    var sivComplete = !!(siv && (siv.phase === 'artefact' || siv.artefact));
    var sivStarted = !!(siv && ((siv.messages && siv.messages.length) || siv.startedAt));

    var vedHistory = (ved && Array.isArray(ved.history)) ? ved.history : [];
    var vedComplete = vedHistory.some(function (item) { return item && item.kind === 'constraint'; });
    var currentConstraint = ved && ved.current_constraint;
    var vedStarted = !!(currentConstraint && (
      currentConstraint.governing_id ||
      (Array.isArray(currentConstraint.observations) && currentConstraint.observations.length)
    ));

    return {
      siv: sivComplete ? 'complete' : (sivStarted ? 'started' : 'idle'),
      ved: vedComplete ? 'complete' : (vedStarted ? 'started' : 'idle')
    };
  }

  function statusLabel(status) {
    if (status === 'complete') return 'Completed';
    if (status === 'started') return 'In progress';
    return 'Not started';
  }

  function actionLabel(status) {
    if (status === 'complete') return 'Revisit conversation';
    if (status === 'started') return 'Continue conversation';
    return 'Begin conversation';
  }

  function card(cardData) {
    return '<a class="conversation ' + esc(cardData.className || '') + '" href="' + esc(cardData.href) + '">' +
      '<div class="card-top">' +
        '<span class="card-number">' + esc(cardData.number) + '</span>' +
        '<span class="status ' + esc(cardData.status) + '">' + esc(statusLabel(cardData.status)) + '</span>' +
      '</div>' +
      '<div class="card-method">' + esc(cardData.method) + '</div>' +
      '<h3>' + cardData.title + '</h3>' +
      '<p class="card-desc">' + esc(cardData.description) + '</p>' +
      '<div class="card-output">' +
        '<div class="output-label">You leave with</div>' +
        '<div class="output-name">' + esc(cardData.output) + '</div>' +
      '</div>' +
      '<div class="card-action"><span>' + esc(actionLabel(cardData.status)) + '</span><span class="card-arrow">→</span></div>' +
    '</a>';
  }

  function asText(value) {
    return Array.isArray(value) ? value.join(' · ') : String(value || '');
  }

  function milestoneStrip(memory) {
    var groups = (memory && memory.milestones) || {};
    var order = [['participant', 'AI Journey'], ['ved', 'VED'], ['siv', 'SIV']];
    return '<div class="milestone-groups">' + order.map(function (entry) {
      var rows = groups[entry[0]] || [];
      return '<div class="milestone-group"><div class="milestone-title">' + esc(entry[1]) + '</div>' +
        '<div class="milestone-dots">' + rows.map(function (row) {
          return '<span class="milestone-dot' + (row.complete ? ' complete' : '') + (row.current ? ' current' : '') + '" title="' + esc(row.label) + '"></span>';
        }).join('') + '</div></div>';
    }).join('') + '</div>';
  }

  function memoryPanel(memory) {
    memory = memory || {};
    var f = memory.fields || {};
    var items = [
      ['Company', memory.identity && memory.identity.company_name],
      ['Role', memory.identity && memory.identity.role_title],
      ['Priority', f.priorities || f.goals],
      ['Weakest link', f.ved_constraint],
      ['Company Brain', f.company_brain],
      ['First AI project', f.selected_project],
      ['90-day target', f.target]
    ].filter(function (item) { return asText(item[1]).trim(); });
    return '<section class="memory-panel" id="courseMemory">' +
      '<div class="memory-head"><div><p class="eyebrow">Shared Course Memory</p><h2>What I currently understand</h2></div>' +
      '<button type="button" class="memory-toggle" id="memoryToggle">Review or correct</button></div>' +
      '<div class="memory-grid">' + items.map(function (item) {
        return '<div class="memory-item"><span>' + esc(item[0]) + '</span><strong>' + esc(asText(item[1])) + '</strong></div>';
      }).join('') + (items.length ? '' : '<p class="memory-empty">Your confirmed context will build here as the conversations progress.</p>') + '</div>' +
      '<div class="memory-editor" id="memoryEditor" hidden><label for="memoryNote">Correct anything or add a priority</label>' +
      '<textarea id="memoryNote" placeholder="For example: Our immediate priority is reducing proposal turnaround from five days to one.">' + esc(memory.participant_note || '') + '</textarea>' +
      '<div class="memory-actions"><button type="button" id="saveMemory">Save to Course Memory</button><span id="memoryStatus"></span></div></div>' +
      '<p class="memory-foot">This understanding is shared across all three conversations and future check-ins. You can correct it at any time.</p>' +
      '</section>';
  }

  function nextStepPanel(state) {
    var step;
    if (state.prepStatus !== 'complete') {
      step = {
        count: 'Step 1 of 4',
        title: state.prepStatus === 'started' ? 'Continue your AI Journey' : 'Start with your AI Journey',
        copy: 'Confirm your company context and what you want this course to change. Every later conversation will use this understanding.',
        time: 'About 8 minutes',
        action: state.prepStatus === 'started' ? 'Continue' : 'Begin',
        href: '/ai-business-leaders/s/' + encodeURIComponent(slug)
      };
    } else if (state.vedStatus !== 'complete') {
      step = {
        count: 'Step 2 of 4',
        win: 'Your company context is saved and ready to guide the course.',
        title: state.vedStatus === 'started' ? 'Continue finding your weakest execution link' : 'Find your weakest execution link',
        copy: 'Trace one important outcome and identify the constraint that is governing performance now.',
        time: 'About 7 minutes',
        action: state.vedStatus === 'started' ? 'Continue' : 'Start VED',
        href: '/ai-business-leaders/workspace/' + encodeURIComponent(slug) + '/ved'
      };
    } else if (state.sivStatus !== 'complete') {
      step = {
        count: 'Step 3 of 4',
        win: 'You have located the execution constraint that matters most.',
        title: state.sivStatus === 'started' ? 'Continue choosing your first AI project' : 'Choose your first AI project',
        copy: 'Use your company context and weakest link to compare the strongest practical AI opportunities.',
        time: 'About 8 minutes',
        action: state.sivStatus === 'started' ? 'Continue' : 'Start SIV',
        href: '/ai-business-leaders/workspace/' + encodeURIComponent(slug) + '/siv'
      };
    } else if (!state.blueprint) {
      step = {
        count: 'Step 4 of 4',
        win: 'Your first AI project has been chosen.',
        title: 'Build your 90-Day AI Leadership Blueprint',
        copy: 'Bring the three conversations together into one short, practical direction you can use with your team.',
        time: 'About 1 minute',
        action: 'Build my blueprint',
        build: true
      };
    } else {
      step = {
        count: 'Your journey continues',
        win: 'Your 90-day direction is ready and saved.',
        title: state.continuingStarted ? 'Continue your leadership check-in' : 'Record your first progress update',
        copy: 'Return after a meeting, milestone or new obstacle. Add what changed and agree the next small move.',
        time: 'About 3 minutes',
        action: state.continuingStarted ? 'Continue check-in' : 'Add an update',
        href: '/ai-business-leaders/workspace/' + encodeURIComponent(slug) + '/continuing'
      };
    }

    return '<section class="next-step-panel" aria-labelledby="nextStepTitle">' +
      '<div class="next-step-marker" aria-hidden="true"><span></span></div>' +
      '<div class="next-step-content">' +
        '<div class="next-step-kicker"><span>Your next step</span><b>' + esc(step.count) + '</b></div>' +
        (step.win ? '<p class="next-step-win"><span>✓</span> Small win: ' + esc(step.win) + '</p>' : '') +
        '<h2 class="next-step-title" id="nextStepTitle">' + esc(step.title) + '</h2>' +
        '<p class="next-step-copy">' + esc(step.copy) + '</p>' +
      '</div>' +
      '<div class="next-step-cta">' +
        '<span class="next-step-time">' + esc(step.time) + '</span>' +
        (step.build
          ? '<button type="button" class="next-step-action" data-build-blueprint>' + esc(step.action) + ' <span>→</span></button>'
          : '<a class="next-step-action" href="' + esc(step.href) + '">' + esc(step.action) + ' <span>→</span></a>') +
        '<span class="next-step-status" data-blueprint-status></span>' +
      '</div>' +
    '</section>';
  }

  function render(data) {
    var p = data.participant || {};
    var session = data.session || {};
    var local = localProgress();
    var runtimes = data.runtimes || {};
    var vedStatus = runtimes.ved
      ? (runtimes.ved.complete ? 'complete' : (runtimes.ved.started ? 'started' : 'idle'))
      : local.ved;
    var sivStatus = runtimes.siv
      ? (runtimes.siv.complete ? 'complete' : (runtimes.siv.started ? 'started' : 'idle'))
      : local.siv;
    var prepComplete = !!(data.share && data.share.approved) || p.status === 'completed';
    var prepStarted = !!session.selected_depth || (Array.isArray(data.messages) && data.messages.length > 0);
    var prepStatus = prepComplete ? 'complete' : (prepStarted ? 'started' : 'idle');
    var statuses = [prepStatus, vedStatus, sivStatus];
    var activeCount = statuses.filter(function (s) { return s !== 'idle'; }).length;
    var milestoneGroups = (data.memory && data.memory.milestones) || {};
    var milestoneRows = ['participant', 'ved', 'siv'].reduce(function (all, key) { return all.concat(milestoneGroups[key] || []); }, []);
    var completedMilestones = milestoneRows.filter(function (row) { return row.complete; }).length;
    var progress = milestoneRows.length ? Math.round((completedMilestones / milestoneRows.length) * 100) : 0;
    var nextStep = nextStepPanel({
      prepStatus: prepStatus,
      vedStatus: vedStatus,
      sivStatus: sivStatus,
      blueprint: data.blueprint,
      continuingStarted: !!(runtimes.continuing && runtimes.continuing.started)
    });

    var cards = [
      {
        number: '01',
        className: 'journey',
        method: 'Context · course preparation',
        title: 'My <em>AI Journey</em>',
        description: 'Tell the system about your company, your role, where AI is already showing up, and what you want this course to change.',
        output: 'A personalised Course Preparation Brief',
        status: prepStatus,
        href: '/ai-business-leaders/s/' + encodeURIComponent(slug)
      },
      {
        number: '02',
        className: 'ved',
        method: 'VED · Vinay’s Execution Doctrine',
        title: 'Find My Weakest <em>Execution Link</em>',
        description: 'Trace an important outcome through its sequence, constraints, capacity, and handoffs. Find the link governing performance now.',
        output: 'An Execution Constraint Map',
        status: vedStatus,
        href: '/ai-business-leaders/workspace/' + encodeURIComponent(slug) + '/ved'
      },
      {
        number: '03',
        className: 'siv',
        method: 'SIV · Socratic, Iterative, Vinay',
        title: 'Choose My First <em>AI Project</em>',
        description: 'Bring your possible AI projects into the open. Test value, feasibility, risk, readiness, and timing before choosing where to begin.',
        output: 'A First-Project Decision Artefact',
        status: sivStatus,
        href: '/ai-business-leaders/workspace/' + encodeURIComponent(slug) + '/siv'
      }
    ];

    root.innerHTML =
      '<section class="hero">' +
        '<div>' +
          '<p class="eyebrow">AI for Business Leaders · Pre-course workspace</p>' +
          '<h1>Your company. Your constraint. <em>Your first project.</em></h1>' +
          '<p class="hero-copy">Three guided conversations turn course preparation into decision-ready ground—before the first live session begins.</p>' +
        '</div>' +
        '<aside class="participant">' +
          '<div class="participant-label">Prepared for</div>' +
          '<div class="participant-name">' + esc(p.name || 'Participant') + '</div>' +
          '<div class="participant-company">' + esc([p.role_title, p.company_name].filter(Boolean).join(' · ')) + '</div>' +
          '<span class="progress-label">Workspace progress</span>' +
          '<div class="progress-track"><span style="width:' + progress + '%"></span></div>' +
          '<div class="progress-copy">' + completedMilestones + ' of ' + milestoneRows.length + ' milestones complete</div>' +
        '</aside>' +
      '</section>' +

      nextStep +

      '<div class="sequence" aria-label="Recommended course preparation sequence">' +
        '<div class="sequence-step"><b>01</b><span>Understand the company</span></div>' +
        '<div class="sequence-line"></div>' +
        '<div class="sequence-step"><b>02</b><span>Locate the constraint</span></div>' +
        '<div class="sequence-line"></div>' +
        '<div class="sequence-step"><b>03</b><span>Choose the first project</span></div>' +
        '<div class="sequence-line"></div>' +
        '<div class="sequence-end">Build the 90-day direction</div>' +
      '</div>' +

      '<section>' +
        '<div class="section-head">' +
          '<h2>Your three conversations</h2>' +
          '<p class="section-note">The order is recommended, not compulsory. Return to SIV or VED whenever a new decision or constraint appears.</p>' +
        '</div>' +
        '<div class="conversation-grid">' + cards.map(card).join('') + '</div>' +
      '</section>' +

      milestoneStrip(data.memory) +
      memoryPanel(data.memory) +

      '<section class="blueprint-panel">' +
        '<div><p class="eyebrow">One practical output</p><h2>Your 90-Day AI Leadership Blueprint</h2>' +
        '<p>Combines your leadership objective, weakest execution link, Company Brain diagnosis, first AI project, owner, baseline, target, guardrails and 30/60/90-day direction.</p></div>' +
        (data.blueprint
          ? '<a class="blueprint-action" href="/ai-business-leaders/workspace/' + encodeURIComponent(slug) + '/continuing?report=1">Open or edit blueprint →</a>'
          : '<button type="button" class="blueprint-action" data-build-blueprint' + (vedStatus === 'complete' && sivStatus === 'complete' ? '' : ' disabled') + '>Build my blueprint →</button>') +
        '<span class="blueprint-status" id="blueprintStatus">' + (data.blueprint ? 'Ready and saved' : (vedStatus === 'complete' && sivStatus === 'complete' ? 'Ready to build' : 'Complete VED and SIV reports first')) + '</span>' +
      '</section>' +

      '<section class="ongoing-panel">' +
        '<div><p class="eyebrow">After meetings and milestones</p><h2>Keep the conversation going</h2>' +
        '<p>Return whenever something changes. Add new evidence, revisit the constraint or project, and agree the next small move without starting again.</p></div>' +
        '<a class="ongoing-action" href="/ai-business-leaders/workspace/' + encodeURIComponent(slug) + '/continuing">Continue my AI journey →</a>' +
      '</section>' +

      '<div class="continuity">' +
        '<div class="continuity-mark">↳</div>' +
        '<p><strong>Your three conversations</strong> are saved to this participant link. Leave and return whenever you need; each conversation resumes where you stopped.</p>' +
      '</div>';
    wire();
  }

  function wire() {
    var toggle = document.getElementById('memoryToggle');
    var editor = document.getElementById('memoryEditor');
    if (toggle && editor) toggle.onclick = function () {
      editor.hidden = !editor.hidden;
      toggle.textContent = editor.hidden ? 'Review or correct' : 'Close';
      if (!editor.hidden) document.getElementById('memoryNote').focus();
    };
    var save = document.getElementById('saveMemory');
    if (save) save.onclick = async function () {
      var status = document.getElementById('memoryStatus');
      save.disabled = true; status.textContent = 'Saving…';
      try {
        var response = await authFetch('/api/abl/session/' + encodeURIComponent(slug) + '/memory', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ participant_note: document.getElementById('memoryNote').value })
        });
        var body = await response.json();
        status.textContent = response.ok ? 'Saved across all conversations.' : (body.error || 'Could not save.');
      } catch (e) { status.textContent = 'Could not save. Please try again.'; }
      save.disabled = false;
    };
    var builds = Array.prototype.slice.call(document.querySelectorAll('[data-build-blueprint]'));
    builds.forEach(function (build) { build.onclick = async function () {
      var status = document.getElementById('blueprintStatus');
      var nextStatus = document.querySelector('[data-blueprint-status]');
      builds.forEach(function (button) { button.disabled = true; button.textContent = 'Building…'; });
      if (status) status.textContent = 'Combining your three conversations…';
      if (nextStatus) nextStatus.textContent = 'Combining your conversations…';
      try {
        var response = await authFetch('/api/abl/session/' + encodeURIComponent(slug) + '/blueprint', { method: 'POST', headers: { Accept: 'application/json' } });
        var body = await response.json();
        if (!response.ok || !body.data || !body.data.report) throw new Error(body.error || 'Could not build blueprint.');
        location.reload();
      } catch (e) {
        if (status) status.textContent = e.message || 'Could not build blueprint.';
        if (nextStatus) nextStatus.textContent = e.message || 'Could not build blueprint.';
        builds.forEach(function (button) { button.disabled = false; button.textContent = 'Build my blueprint →'; });
      }
    }; });
  }

  function fail(message) {
    root.innerHTML = '<div class="error-state"><h1>Workspace unavailable</h1><p>' + esc(message || 'This participant workspace could not be found.') + '</p></div>';
  }

  async function load() {
    if (!slug || slug === 'workspace') return fail('This link is missing its participant key.');
    try {
      var response = await authFetch('/api/abl/session/' + encodeURIComponent(slug), { headers: { Accept: 'application/json' } });
      var body = await response.json().catch(function () { return {}; });
      if (!response.ok || !body || !body.data) return fail(body.error || 'This participant workspace could not be found.');
      render(body.data);
    } catch (e) {
      fail('The workspace could not be reached. Please check your connection and try again.');
    }
  }

  load();
})();
