/* =============================================================
   Participant Room — server-driven.
   =============================================================
   Auth is a signed httpOnly cookie set by /api/otp/verify. The
   dashboard reads the account's real data from /api/portal/state,
   so runtimes + outputs follow the participant across devices.
   ============================================================= */
(function () {
  'use strict';

  // Dev serves the portal same-origin from the backend (:8080). If it's opened
  // from a separate static server (:8000/5500/3000) point the API at :8080.
  function apiBase() {
    var devPorts = { '8000': 1, '5500': 1, '3000': 1 };
    if (location.protocol === 'file:' || devPorts[location.port]) return 'http://localhost:8080';
    return '';
  }
  function api(path, opts) {
    return fetch(apiBase() + path, Object.assign({ credentials: 'include' }, opts || {}))
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .catch(function () { return { ok: false, error: 'network' }; });
  }
  function postJson(path, body) {
    return api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  }

  // The catalog of runtimes (names/links). "used" comes from the account's outputs.
  var RUNTIMES = [
    { id: 'siv',    name: 'The SIV Method',              tagline: 'A decision, examined through Socratic pressure.', href: '/paths/decisions.html' },
    { id: 'kairos', name: 'KAIROS·1 — Execution Runtime', tagline: 'The Execution Doctrine, made operational.',      href: '/runtime/' },
    { id: 'civ',    name: 'The Civilization Lab',         tagline: 'Reasoning about the long arc.',                   href: '/paths/civilization.html' },
    { id: 'memory', name: 'The Memory Lab',              tagline: 'What a mind chooses to keep.',                    href: '/memory-lab.html' },
    { id: 'freq',   name: 'Organizational Frequency',    tagline: 'Tuning the system that builds.',                  href: '/frequency/' }
  ];
  var RT_BY_ID = {};
  RUNTIMES.forEach(function (rt) { RT_BY_ID[rt.id] = rt; });

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function firstName(n) { return (n || '').trim().split(/\s+/)[0] || 'there'; }
  function truncate(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1).trim() + '…' : s; }

  /* ============================================================
     LOGIN (email OTP)
     ============================================================ */
  function initLogin() {
    var idForm = document.getElementById('id-form');
    if (!idForm) return;

    // If a valid session cookie already exists, skip straight to the room.
    api('/api/portal/me').then(function (r) { if (r && r.ok) location.replace('/portal/dashboard.html'); });

    var otpForm = document.getElementById('otp-form');
    var nameEl = document.getElementById('f-name');
    var contactEl = document.getElementById('f-contact');
    var sendBtn = document.getElementById('send-code');
    var verifyBtn = document.getElementById('verify-code');
    var boxes = Array.prototype.slice.call(document.querySelectorAll('.otp-box'));
    var demoEl = document.getElementById('otp-demo');

    var sentTo = null, timerId = null, RESEND_SECS = 30;

    function validEmail() { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEl.value.trim()); }
    function validateId() { sendBtn.disabled = !(nameEl.value.trim() && validEmail()); }
    nameEl.addEventListener('input', validateId);
    contactEl.addEventListener('input', validateId);

    async function issueCode() {
      sentTo = contactEl.value.trim().toLowerCase();
      document.getElementById('otp-dest').textContent = sentTo;
      demoEl.textContent = 'Sending your code…';
      var r = await postJson('/api/otp/send', { name: nameEl.value.trim(), email: sentTo });
      if (!r.ok) {
        demoEl.textContent =
          r.error === 'cooldown' ? 'Please wait a moment before requesting another code.' :
          r.error === 'too_many_requests' ? 'Too many codes requested — try again in a bit.' :
          r.error === 'otp_not_configured' ? 'Sign-in isn’t available right now.' :
          'Could not send the code — check the email and try again.';
        return;
      }
      demoEl.textContent = 'A 6-digit code is on its way to your email.';
      startResendTimer();
    }

    function startResendTimer() {
      var resend = document.getElementById('otp-resend');
      var timer = document.getElementById('otp-timer');
      var left = RESEND_SECS;
      resend.disabled = true;
      timer.textContent = ' · resend in ' + left + 's';
      if (timerId) clearInterval(timerId);
      timerId = setInterval(function () {
        left--;
        if (left <= 0) { clearInterval(timerId); timerId = null; resend.disabled = false; timer.textContent = ''; }
        else { timer.textContent = ' · resend in ' + left + 's'; }
      }, 1000);
    }

    function otpValue() { return boxes.map(function (b) { return b.value; }).join(''); }
    function validateOtp() { verifyBtn.disabled = otpValue().length !== 6; }
    function clearBoxes() { boxes.forEach(function (b) { b.value = ''; }); validateOtp(); }
    boxes.forEach(function (box, i) {
      box.addEventListener('input', function () {
        box.value = box.value.replace(/[^\d]/g, '').slice(0, 1);
        if (box.value && i < boxes.length - 1) boxes[i + 1].focus();
        validateOtp();
      });
      box.addEventListener('keydown', function (e) { if (e.key === 'Backspace' && !box.value && i > 0) boxes[i - 1].focus(); });
      box.addEventListener('paste', function (e) {
        e.preventDefault();
        var d = ((e.clipboardData || window.clipboardData).getData('text') || '').replace(/[^\d]/g, '').slice(0, 6);
        for (var j = 0; j < d.length && j < boxes.length; j++) boxes[j].value = d[j];
        boxes[Math.min(d.length, boxes.length - 1)].focus();
        validateOtp();
      });
    });

    function showError(msg) { var el = document.getElementById('otp-error'); el.textContent = msg; el.hidden = false; }
    function clearError() { document.getElementById('otp-error').hidden = true; }

    idForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (sendBtn.disabled) return;
      issueCode();
      idForm.hidden = true; otpForm.hidden = false;
      clearError(); clearBoxes(); boxes[0].focus();
    });
    document.getElementById('otp-change').addEventListener('click', function () {
      otpForm.hidden = true; idForm.hidden = false;
      if (timerId) { clearInterval(timerId); timerId = null; }
    });
    document.getElementById('otp-resend').addEventListener('click', function () {
      if (!sentTo) return; issueCode(); clearError(); clearBoxes(); boxes[0].focus();
    });

    otpForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!sentTo) return;
      clearError(); verifyBtn.disabled = true;
      var r = await postJson('/api/otp/verify', { email: sentTo, code: otpValue() });
      if (!r.ok) {
        showError(
          r.error === 'expired' ? 'That code has expired — tap resend for a new one.' :
          r.error === 'locked' ? 'Too many attempts — tap resend for a new code.' :
          typeof r.attemptsLeft === 'number'
            ? 'That code isn’t right. ' + r.attemptsLeft + ' attempt' + (r.attemptsLeft === 1 ? '' : 's') + ' left.'
            : 'That code isn’t right.'
        );
        validateOtp();
        return;
      }
      if (timerId) clearInterval(timerId);
      try { localStorage.setItem('portal.hint', '1'); } catch (e) {} // lets runtimes know to save
      location.href = '/portal/dashboard.html'; // cookie is set by the server
    });

    validateId();
  }

  /* ============================================================
     DASHBOARD (server state)
     ============================================================ */
  function initDashboard() {
    var root = document.getElementById('dash-root');
    if (!root) return;

    // identity + logout
    var logout = document.getElementById('logout');
    if (logout) logout.addEventListener('click', function () {
      try { localStorage.removeItem('portal.hint'); } catch (e) {}
      postJson('/api/portal/logout').then(function () { location.href = '/portal/login.html'; });
    });

    api('/api/portal/state').then(function (state) {
      if (!state || !state.ok) { location.replace('/portal/login.html'); return; }
      renderDashboard(state);
    });
  }

  function renderDashboard(state) {
    var root = document.getElementById('dash-root');
    var name = (state.account && state.account.name) || '';
    var who = document.getElementById('who');
    if (who) who.textContent = name || (state.account && state.account.email) || '';

    // Analytics: a signed-in participant is a known person — link their history.
    var acctEmail = state.account && state.account.email;
    if (acctEmail && window.vpTrack && window.vpTrack.identify) {
      window.vpTrack.identify({ email: acctEmail, name: name, source: 'portal-login' });
    }

    // outputs → latest per runtime
    var byRt = {};
    (state.outputs || []).forEach(function (o) {
      if (!byRt[o.runtime] || o.updatedAt > byRt[o.runtime].updatedAt) byRt[o.runtime] = o;
    });

    // the catalog this participant sees (admin can assign a custom subset)
    var assigned = state.assignedRuntimes; // null = all
    var catalog = RUNTIMES.filter(function (rt) { return !assigned || assigned.indexOf(rt.id) !== -1; });

    var results = catalog.map(function (rt) {
      var o = byRt[rt.id];
      return { rt: rt, res: o ? { used: true, output: outFromDoc(o, rt) } : { used: false } };
    });
    var usedCount = results.filter(function (r) { return r.res.used; }).length;
    var docsCount = (state.outputs || []).length;
    var featuredR = results.filter(function (r) { return r.res.used; })[0] || null;

    /* view builders */
    function heroBlock(sub) {
      return '<div class="dash-hero">'
        + '<p class="eyebrow">The Participant Room</p>'
        + '<h1>Welcome back, <em>' + esc(firstName(name || 'there')) + '</em>.</h1>'
        + '<p class="sub">' + sub + '</p></div>'
        + (state.note ? '<div class="assign-note"><span class="k">A note for you</span>' + esc(state.note) + '</div>' : '');
    }
    function statsBlock() {
      return '<div class="stats-strip">'
        + '<div class="stat"><div class="num">' + usedCount + ' <small>/ ' + catalog.length + '</small></div><div class="lbl">Runtimes explored</div></div>'
        + '<div class="stat"><div class="num">' + docsCount + '</div><div class="lbl">Outputs saved</div></div>'
        + '<div class="stat"><div class="num" style="font-size:22px;color:#a89f85">Coming soon</div><div class="lbl">The course</div></div>'
        + '</div>';
    }
    function runtimesBlock() {
      var cards = results.map(function (r, i) { return runtimeCard(r.rt, r.res, i); }).join('');
      return '<div class="section-head"><h2>Your runtimes</h2><span class="count">' + usedCount + ' of ' + catalog.length + ' used</span></div>'
        + '<div class="rt-grid">' + cards + '</div>';
    }
    function outputsBlock() {
      var outs = (state.outputs || []);
      if (!outs.length) {
        return '<div class="section-head"><h2>Your outputs</h2></div>'
          + '<div class="featured empty"><p class="f-runtime">No outputs yet</p><p class="f-title">Nothing saved.</p>'
          + '<div class="f-grid"><div class="f-row"><p class="v" style="color:#6d675a">Work through a runtime and its output will be saved here — on any device you sign in from.</p></div></div>'
          + '<div class="f-actions"><a class="rt-link" href="/paths/decisions.html">Begin with SIV →</a></div></div>';
      }
      return '<div class="section-head"><h2>Your outputs</h2><span class="count">' + outs.length + ' saved</span></div>'
        + outs.map(function (o) { return outputPanel(o, RT_BY_ID[o.runtime] || { id: o.runtime, name: o.runtime, href: '#' }); }).join('');
    }
    function courseBlock() {
      return '<div class="section-head"><h2>The course</h2><span class="count">Coming soon</span></div>'
        + '<div class="course-band soon"><div>'
        + '<p class="eyebrow">Coming soon</p><h3>AI for Business Leaders</h3>'
        + '<p>The course will live here — a guided path that ties your runtime outputs together. We’re putting the finishing touches on it.</p>'
        + '</div><span class="soon-badge">Coming soon</span></div>';
    }

    var VIEWS = {
      overview: function () { return heroBlock('Everything you’ve examined, gathered in one place — on any device you sign in from.') + statsBlock() + featuredBlock(featuredR); },
      runtimes: function () { return runtimesBlock(); },
      outputs: function () { return outputsBlock(); },
      course: function () { return courseBlock(); }
    };

    var navItems = Array.prototype.slice.call(document.querySelectorAll('.side-item'));
    function show(view) {
      if (!VIEWS[view]) view = 'overview';
      root.innerHTML = VIEWS[view]();
      navItems.forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-view') === view); });
      wireOutputs(results, state);
      try { localStorage.setItem('portal.view', view); } catch (e) {}
      window.scrollTo(0, 0);
    }
    navItems.forEach(function (b) { b.addEventListener('click', function () { show(b.getAttribute('data-view')); }); });

    var initial = 'overview';
    try { initial = localStorage.getItem('portal.view') || 'overview'; } catch (e) {}
    show(initial);
  }

  // Firestore output doc → the shape the cards expect.
  function outFromDoc(o, rt) {
    return { title: o.title || (o.data && o.data.title) || (rt ? rt.name : ''), full: o.data || null };
  }

  function isArtefact(o) {
    return !!(o && o.full && (o.full.recommended_direction || o.full.framing || o.full.what_matters_most
      || (o.full.what_we_examined && o.full.what_we_examined.length)));
  }
  function outputRows(o) {
    if (o.full && (o.full.recommended_direction || o.full.framing || o.full.what_matters_most)) {
      var a = o.full;
      return [
        ['What matters most', a.what_matters_most],
        ['Recommended direction', a.recommended_direction],
        ['Immediate next step (48h)', a.immediate_next_step],
        ['One unresolved question', a.unresolved_question]
      ].filter(function (p) { return p[1]; })
        .map(function (p) { return '<div class="f-row"><div class="k">' + esc(p[0]) + '</div><p class="v">' + esc(p[1]) + '</p></div>'; }).join('');
    }
    return '<div class="f-row"><p class="v">' + esc((o.full && o.full.summary) || 'Saved output.') + '</p></div>';
  }

  function featuredBlock(r) {
    if (!r) {
      return ''
        + '<div class="featured empty">'
        + '  <p class="f-runtime">Your latest thinking</p>'
        + '  <p class="f-title">Nothing examined yet.</p>'
        + '  <div class="f-grid"><div class="f-row"><p class="v" style="color:#6d675a">Start with a runtime — your outputs will gather here as you work through them.</p></div></div>'
        + '  <div class="f-actions"><a class="rt-link" href="/paths/decisions.html">Begin with SIV →</a></div>'
        + '</div>';
    }
    var o = r.res.output;
    var viewBtn = isArtefact(o) ? '<button class="rt-link" data-view-out="' + esc(r.rt.id) + '">View full output</button>' : '';
    return ''
      + '<div class="featured">'
      + '  <p class="f-runtime">Your latest thinking · ' + esc(r.rt.name) + '</p>'
      + '  <p class="f-title">' + esc(o.title) + '</p>'
      + '  <div class="f-grid">' + outputRows(o) + '</div>'
      + '  <div class="f-actions"><a class="rt-link" href="' + r.rt.href + '">Reopen →</a>' + viewBtn + '</div>'
      + '</div>';
  }

  function outputPanel(doc, rt) {
    var o = outFromDoc(doc, rt);
    var viewBtn = isArtefact(o) ? '<button class="rt-link" data-view-out="' + esc(rt.id) + '">View full output</button>' : '';
    return ''
      + '<div class="featured" style="margin-top:18px">'
      + '  <p class="f-runtime">' + esc(rt.name) + '</p>'
      + '  <p class="f-title">' + esc(o.title) + '</p>'
      + '  <div class="f-grid">' + outputRows(o) + '</div>'
      + '  <div class="f-actions"><a class="rt-link" href="' + rt.href + '">Reopen →</a>' + viewBtn + '</div>'
      + '</div>';
  }

  function runtimeCard(rt, res, i) {
    var num = String(i + 1).padStart(2, '0');
    var pill = res.used ? '<span class="pill used">Used</span>' : '<span class="pill idle">Not started</span>';
    var line = (res.used && res.output)
      ? '<p class="rt-latest">Latest · <em>' + esc(truncate(res.output.title, 42)) + '</em></p>'
      : '<p class="rt-idle-line">Not started yet</p>';
    var viewBtn = (res.used && res.output && isArtefact(res.output))
      ? '<button class="rt-link" data-view-out="' + esc(rt.id) + '">View output</button>' : '';
    var openLbl = res.used ? 'Reopen' : 'Begin';
    return ''
      + '<article class="rt-card">'
      + '  <div class="rt-top"><p class="eyebrow" style="margin:0">Runtime ' + num + '</p>' + pill + '</div>'
      + '  <h3 class="rt-name">' + esc(rt.name) + '</h3>'
      + '  <p class="rt-tagline">' + esc(rt.tagline) + '</p>'
      + line
      + '  <div class="rt-actions"><a class="rt-link" href="' + rt.href + '">' + openLbl + ' →</a>' + viewBtn + '</div>'
      + '</article>';
  }

  /* ---- full-output modal ---- */
  function wireOutputs(results, state) {
    var byRt = {};
    (state.outputs || []).forEach(function (o) { if (!byRt[o.runtime] || o.updatedAt > byRt[o.runtime].updatedAt) byRt[o.runtime] = o; });
    document.querySelectorAll('[data-view-out]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-view-out');
        var o = byRt[id];
        if (!o || !o.data) return;
        openModal((RT_BY_ID[id] || { name: id }).name, o.data);
      });
    });
  }

  function openModal(runtimeName, data) {
    var rows = [
      ['Framing', data.framing],
      ['What matters most', data.what_matters_most],
      ['Recommended direction', data.recommended_direction],
      ['Immediate next step (48h)', data.immediate_next_step],
      ['One unresolved question', data.unresolved_question]
    ].filter(function (r) { return r[1]; });
    var examined = (data.what_we_examined || []).map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('');
    var html = ''
      + '<div class="om-head"><p class="eyebrow">' + esc(runtimeName) + '</p><button class="om-close" aria-label="Close">✕</button></div>'
      + '<div class="om-body">'
      + '  <div class="om-row"><div class="k">Title</div><div class="v" style="font-style:italic">' + esc(data.title || 'A Decision, Examined') + '</div></div>'
      + (examined ? '<div class="om-row"><div class="k">What we examined</div><div class="v"><ul style="margin:0;padding-left:18px">' + examined + '</ul></div></div>' : '')
      + rows.map(function (r) { return '<div class="om-row"><div class="k">' + esc(r[0]) + '</div><div class="v">' + esc(r[1]) + '</div></div>'; }).join('')
      + '</div>';
    var dlg = document.getElementById('output-modal');
    dlg.innerHTML = html;
    dlg.querySelector('.om-close').addEventListener('click', function () { dlg.close(); });
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  }

  document.addEventListener('DOMContentLoaded', function () {
    // The portal needs a same-origin API + session cookie. If it was opened from
    // a dev static server (:8000/:5500/:3000), bounce to the backend that serves
    // both the pages and the API on :8080. (In prod it's already same-origin.)
    var devPorts = { '8000': 1, '5500': 1, '3000': 1 };
    if (devPorts[location.port]) {
      location.replace('http://localhost:8080' + location.pathname + location.search);
      return;
    }
    initLogin();
    initDashboard();
  });
})();
