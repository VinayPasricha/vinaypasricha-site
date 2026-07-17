/* AI for Business Leaders — three-conversation participant workspace. */
(function () {
  'use strict';

  var parts = location.pathname.split('/').filter(Boolean);
  var slug = decodeURIComponent(parts[parts.length - 1] || '');
  var root = document.getElementById('workspace');

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
    var progress = Math.round((activeCount / 3) * 100);

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
          '<div class="progress-copy">' + activeCount + ' of 3 conversations started</div>' +
        '</aside>' +
      '</section>' +

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

      '<div class="continuity">' +
        '<div class="continuity-mark">↳</div>' +
        '<p><strong>Your three conversations</strong> are saved to this participant link. Leave and return whenever you need; each conversation resumes where you stopped.</p>' +
      '</div>';
  }

  function fail(message) {
    root.innerHTML = '<div class="error-state"><h1>Workspace unavailable</h1><p>' + esc(message || 'This participant workspace could not be found.') + '</p></div>';
  }

  async function load() {
    if (!slug || slug === 'workspace') return fail('This link is missing its participant key.');
    try {
      var response = await fetch('/api/abl/session/' + encodeURIComponent(slug), { headers: { Accept: 'application/json' } });
      var body = await response.json().catch(function () { return {}; });
      if (!response.ok || !body || !body.data) return fail(body.error || 'This participant workspace could not be found.');
      render(body.data);
    } catch (e) {
      fail('The workspace could not be reached. Please check your connection and try again.');
    }
  }

  load();
})();
