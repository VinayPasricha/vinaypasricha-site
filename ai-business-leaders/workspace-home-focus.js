/* AI for Business Leaders — focused participant home.
   Replaces the catalogue-style homepage with one adaptive command card plus
   only New from Vinay and Your saved work. The full course remains in the menu. */
(function () {
  'use strict';

  function hasText(value) { return !!String(value == null ? '' : value).trim(); }

  function currentAssignments(person) {
    return (S.assignments || []).filter(function (a) {
      return a.status === 'published' && Number(a.session || 0) === Number(S.current || 1) &&
        (!a.cohort || a.cohort === person.cohort);
    });
  }

  function assignmentState(assignment) {
    return (assignment && S.submissions && S.submissions[assignment.id]) || { status: 'not_started', text: '' };
  }

  function currentPreparationMaterial() {
    return mats().find(function (m) {
      return Number(m.session || 0) === Number(S.current || 1) && m.phase === 'before';
    }) || null;
  }

  function latestFromVinay(person) {
    var announcements = (S.announcements || []).filter(function (a) {
      return a.status === 'published' && (!a.cohort || a.cohort === person.cohort);
    });
    var latestMaterial = mats()[0] || null;
    if (announcements.length) {
      return {
        eyebrow: 'Announcement', title: announcements[0].title,
        copy: announcements[0].message, kind: 'announcement'
      };
    }
    if (latestMaterial) {
      return {
        eyebrow: typeLabel(latestMaterial), title: latestMaterial.title,
        copy: latestMaterial.phase === 'before' ? 'Published to help you prepare for the next live session.' : 'A new course resource is available in your workspace.',
        kind: 'material', material: latestMaterial
      };
    }
    return { eyebrow: 'No new update', title: 'You are up to date', copy: 'New material and announcements from Vinay will appear here.', kind: 'empty' };
  }

  function nextAction(person, cohort) {
    var assignments = currentAssignments(person);
    var assignment = assignments[0] || null;
    var submission = assignmentState(assignment);
    var preparation = currentPreparationMaterial();
    var initiativeStarted = S.initiative && [S.initiative.problem, S.initiative.owner, S.initiative.day30, S.initiative.day90].some(hasText);

    if (!person.started) {
      return {
        stage: 'Before the course', title: 'Complete your AI Journey',
        copy: 'Confirm your company context, current constraint and what you want this course to change. This makes every later session more useful.',
        button: 'Start my AI Journey', kind: 'journey', note: 'Recommended · about 15 minutes'
      };
    }

    if (assignment && submission.status === 'draft' && hasText(submission.text)) {
      return {
        stage: 'After Session ' + S.current, title: 'Finish ' + assignment.title,
        copy: 'Your draft is saved. Complete the working output while the session is still fresh.',
        button: 'Resume my assignment', kind: 'assignments', note: 'Draft saved'
      };
    }

    if (preparation) {
      return {
        stage: 'Prepare for Session ' + S.current, title: 'Read ' + preparation.title,
        copy: 'This is the one item to open before the live session. Everything else can wait.',
        button: 'Open preparation', kind: 'material', material: preparation, note: 'Your next course action'
      };
    }

    if (assignment && submission.status !== 'submitted') {
      return {
        stage: 'After Session ' + S.current, title: 'Complete ' + assignment.title,
        copy: 'Turn the session into a usable piece of work for your own company.',
        button: 'Open my assignment', kind: 'assignments', note: 'Not submitted'
      };
    }

    if (Number(S.current || 1) >= 5 || initiativeStarted) {
      return {
        stage: 'Continue after the course', title: 'Update your 90-Day Initiative',
        copy: 'Record what has changed, update the evidence and decide what you will scale, fix or stop.',
        button: 'Open my initiative', kind: 'initiative', note: 'Your continuing leadership loop'
      };
    }

    return {
      stage: 'Current course step', title: 'Open Session ' + S.current + ' · ' + META[S.current][0],
      copy: META[S.current][1] + '. Open the session page for the live link, materials and next output.',
      button: cohort && cohort.meeting ? 'Open current session' : 'Open session workspace', kind: 'session', note: 'Session ' + S.current + ' of 5'
    };
  }

  function actionControl(action) {
    if (action.kind === 'material' && action.material) {
      if (S.live && action.material.url) {
        return '<a class="btn red focus-primary" href="' + esc(action.material.url) + '" target="_blank" rel="noopener">' + esc(action.button) + ' ↗</a>';
      }
      return '<button class="btn red focus-primary" type="button" onclick="toast(\'Opened in preview\')">' + esc(action.button) + ' →</button>';
    }
    if (action.kind === 'journey') return '<button class="btn red focus-primary" type="button" id="goJourney">' + esc(action.button) + ' →</button>';
    if (action.kind === 'session') return '<button class="btn red focus-primary" type="button" id="openSession">' + esc(action.button) + ' →</button>';
    return '<button class="btn red focus-primary" type="button" data-focus-page="' + esc(action.kind) + '">' + esc(action.button) + ' →</button>';
  }

  function savedWorkCards() {
    var notebookCount = [S.notebook.objective, S.notebook.constraint, S.notebook.brain, S.notebook.project].filter(hasText).length;
    var assignments = currentAssignments(p());
    var submitted = assignments.filter(function (a) { return assignmentState(a).status === 'submitted'; }).length;
    var initiativeCount = [S.initiative.problem, S.initiative.owner, S.initiative.day30, S.initiative.day90].filter(hasText).length;
    return '<div class="focus-saved-grid">' +
      '<button class="focus-saved" type="button" data-focus-page="notebook"><span>Course Notebook</span><strong>' + notebookCount + ' of 4 anchors saved</strong><small>Company context, constraint, Company Brain and first project</small></button>' +
      '<button class="focus-saved" type="button" data-focus-page="assignments"><span>Assignments</span><strong>' + submitted + ' submitted</strong><small>Drafts and completed session outputs</small></button>' +
      '<button class="focus-saved" type="button" data-focus-page="initiative"><span>90-Day Initiative</span><strong>' + initiativeCount + ' of 4 anchors saved</strong><small>Problem, owner, Day-30 evidence and Day-90 target</small></button>' +
    '</div>';
  }

  function fromVinayCard(update) {
    var control = '';
    if (update.kind === 'material' && update.material) {
      control = S.live ? openControl(update.material) : '<button class="btn" type="button" onclick="toast(\'Opened in preview\')">Open</button>';
    } else if (update.kind === 'announcement') {
      control = '<button class="btn" type="button" data-focus-page="session">Open current session</button>';
    }
    return '<div class="panel focus-update"><div><p class="eyebrow">' + esc(update.eyebrow) + '</p><h3>' + esc(update.title) + '</h3><p>' + esc(update.copy) + '</p></div>' + control + '</div>';
  }

  function focusedHome() {
    var person = p(), cohort = c(), action = nextAction(person, cohort), update = latestFromVinay(person);
    return '<div class="hero focus-hero"><div><p class="eyebrow">AI for Business Leaders · Personal workspace</p><h1>' + esc(person.name.split(' ')[0]) + '’s AI Leadership Workspace</h1><p class="lede">One clear next action. Your course work and leadership initiative remain available whenever you need them.</p></div><div class="id"><div class="label">Prepared for</div><strong>' + esc(person.name) + '</strong><span>' + esc(person.role) + ' · ' + esc(person.company) + '</span><span>' + esc(cohort ? cohort.name : '') + '</span></div></div>' +
      '<section class="panel focus-command"><div class="focus-command-rule"></div><div class="focus-command-copy"><p class="eyebrow">Do this now · ' + esc(action.stage) + '</p><h2>' + esc(action.title) + '</h2><p>' + esc(action.copy) + '</p><span class="focus-note">' + esc(action.note) + '</span></div><div class="focus-command-action">' + actionControl(action) + '</div></section>' +
      '<div class="focus-two"><section><div class="sec focus-head"><h2>New from Vinay</h2><p>Only the latest relevant update.</p></div>' + fromVinayCard(update) + '</section>' +
      '<section><div class="sec focus-head"><h2>Your saved work</h2><p>Return to anything you have already started.</p></div>' + savedWorkCards() + '</section></div>' +
      '<p class="focus-archive-note">All five sessions, recordings, resources and guided conversations remain available from the menu.</p>';
  }

  function addStyles() {
    if (document.getElementById('ablFocusStyles')) return;
    var style = document.createElement('style');
    style.id = 'ablFocusStyles';
    style.textContent =
      '.focus-command{margin-top:28px;display:grid;grid-template-columns:8px minmax(0,1fr) auto;gap:22px;align-items:center;padding:27px;background:linear-gradient(120deg,var(--paper2),var(--deep));border-color:rgba(180,71,45,.42);box-shadow:0 18px 55px rgba(54,43,31,.08)}' +
      '.focus-command-rule{align-self:stretch;min-height:132px;border-radius:99px;background:var(--red)}' +
      '.focus-command-copy h2{font-size:34px;margin:8px 0}.focus-command-copy>p:not(.eyebrow){max-width:720px;font-size:14px;line-height:1.6;color:var(--muted)}' +
      '.focus-note{display:inline-block;margin-top:8px;color:var(--faint);font:9px var(--mono);letter-spacing:.08em;text-transform:uppercase}' +
      '.focus-command-action{min-width:190px;text-align:right}.focus-primary{padding:14px 18px;text-decoration:none;white-space:nowrap}' +
      '.focus-two{display:grid;grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr);gap:20px;align-items:start}.focus-head{margin:34px 0 14px}.focus-head h2{font-size:25px}.focus-head p{text-align:right}' +
      '.focus-update{min-height:190px;display:flex;flex-direction:column;justify-content:space-between}.focus-update h3{font-size:24px}.focus-update .btn{align-self:flex-start;text-decoration:none}' +
      '.focus-saved-grid{display:grid;gap:10px}.focus-saved{width:100%;border:1px solid var(--rule);border-radius:8px;background:rgba(251,248,241,.68);padding:16px;text-align:left;cursor:pointer;color:var(--ink)}' +
      '.focus-saved:hover{border-color:var(--red);background:var(--paper2)}.focus-saved span{display:block;color:var(--red);font:9px var(--mono);letter-spacing:.1em;text-transform:uppercase}' +
      '.focus-saved strong{display:block;margin-top:7px;font:19px var(--serif)}.focus-saved small{display:block;margin-top:5px;color:var(--muted);font-size:11px;line-height:1.45}' +
      '.focus-archive-note{margin:28px 0 0;padding-top:16px;border-top:1px solid var(--rule);color:var(--muted);font-size:11px;text-align:center}' +
      '@media(max-width:900px){.focus-command{grid-template-columns:7px 1fr}.focus-command-action{grid-column:2;text-align:left;min-width:0}.focus-two{grid-template-columns:1fr}.focus-hero{grid-template-columns:1fr}.focus-command-rule{min-height:150px}}' +
      '@media(max-width:600px){.focus-command{padding:19px 15px;gap:14px}.focus-command-copy h2{font-size:27px}.focus-command-copy>p:not(.eyebrow){font-size:13px}.focus-primary{width:100%;justify-content:center;text-align:center;white-space:normal}.focus-command-action{width:100%}.focus-head{display:block}.focus-head p{text-align:left;margin-top:5px}.focus-update{min-height:0}.focus-archive-note{text-align:left}}';
    document.head.appendChild(style);
  }

  function wireFocusedControls() {
    document.querySelectorAll('[data-focus-page]').forEach(function (button) {
      button.onclick = function () {
        S.page = button.getAttribute('data-focus-page');
        save();
        render();
      };
    });
  }

  function install() {
    if (typeof home !== 'function' || typeof render !== 'function') return;
    addStyles();
    home = focusedHome;
    var originalWireParticipant = wireParticipant;
    wireParticipant = function () {
      originalWireParticipant();
      wireFocusedControls();
    };
    if (S && S.mode === 'participant' && S.page === 'home' && p()) render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
}());
