/* =============================================================
   AI bridge + universal capture — loaded on every page.
   =============================================================
   1. Defines window.claude.complete({system, messages}) -> Promise<string>,
      forwarding to the backend (/api/ai/complete) which runs Gemini.
   2. AUTO-SAVES every AI exchange to Firestore (/api/capture), so every chat
      on every runtime is stored with no per-page wiring.
   3. AUTO-CAPTURES email/contact form submissions to Firestore (/api/leads).

   All capture is anonymous + best-effort: it never blocks or breaks the UI.
   ============================================================= */
(function () {
  'use strict';

  // ---- API base (same-origin in prod; local backend in dev) ----
  function apiBase() {
    if (typeof window.OF_API_BASE === 'string') return window.OF_API_BASE;
    var devPorts = { '8000': 1, '5500': 1, '3000': 1 };
    if (location.protocol === 'file:' || devPorts[location.port]) {
      return 'http://localhost:8080';
    }
    return '';
  }

  // ---- Per-tab session id (groups everything done in this sitting) ----
  function sid() {
    try {
      var s = sessionStorage.getItem('site.sid');
      if (!s) {
        s = 's_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
        sessionStorage.setItem('site.sid', s);
      }
      return s;
    } catch (e) {
      return 's_' + Date.now().toString(36);
    }
  }

  // Which runtime this page is, from its path (for tidy grouping).
  function runtimeName() {
    var p = location.pathname;
    if (p.indexOf('/frequency/') >= 0) return 'mission';
    if (p.indexOf('/signal/') >= 0) return 'signal';
    if (p.indexOf('decisions') >= 0) return 'siv';
    if (p.indexOf('connect') >= 0) return 'aion';
    if (p.indexOf('/runtime/') >= 0) return 'library';
    if (p.indexOf('civilization') >= 0) return 'civilization';
    if (p.indexOf('/studio/') >= 0) return 'studio';
    return 'site';
  }

  function post(path, body) {
    try {
      return fetch(apiBase() + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true,
      }).catch(function () {});
    } catch (e) { return Promise.resolve(); }
  }

  // ---- 2. Auto-capture an AI exchange ----
  function lastUserText(messages) {
    if (!Array.isArray(messages)) return '';
    for (var i = messages.length - 1; i >= 0; i--) {
      if (messages[i] && (messages[i].role === 'user' || !messages[i].role)) {
        return String(messages[i].content || '');
      }
    }
    return messages.length ? String(messages[messages.length - 1].content || '') : '';
  }

  function captureExchange(opts, completion) {
    // Skip the i18n live-translation calls — they aren't user chats.
    var sys = (opts && opts.system) || '';
    if (/you translate website text/i.test(sys)) return;
    var lead = window.OF_LEAD || {};
    post('/api/capture', {
      sessionId: sid(),
      runtime: runtimeName(),
      page: location.pathname,
      userText: lastUserText(opts && opts.messages),
      completion: completion,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
    });
    savePortalOutput(completion);
  }

  // ---- Save this runtime's latest output to the signed-in participant's
  // account (Participant Room). Best-effort, same-origin so the session cookie
  // rides along. Gated on a non-secret "signed-in" hint so anonymous visitors
  // never hit the endpoint. SIV is skipped — it saves its own richer artefact.
  var PORTAL_NAMES = {
    kairos: 'KAIROS·1 — Execution Runtime',
    civ: 'The Civilization Lab',
    memory: 'The Memory Lab',
    freq: 'Organizational Frequency',
  };
  function portalRuntimeId() {
    var p = location.pathname;
    if (p.indexOf('decisions') >= 0) return 'siv';        // SIV self-saves its artefact
    if (p.indexOf('/runtime/') >= 0) return 'kairos';
    if (p.indexOf('civilization') >= 0) return 'civ';
    if (p.indexOf('memory-lab') >= 0) return 'memory';
    if (p.indexOf('/frequency/') >= 0) return 'freq';
    return null;
  }
  function signedInHint() {
    try { return localStorage.getItem('portal.hint') === '1'; } catch (e) { return false; }
  }
  function savePortalOutput(completion) {
    if (!signedInHint()) return;
    var id = portalRuntimeId();
    if (!id || id === 'siv') return;
    var summary = String(completion || '').replace(/\s+/g, ' ').trim().slice(0, 240);
    if (!summary) return;
    try {
      fetch(apiBase() + '/api/portal/outputs', {
        method: 'POST', credentials: 'include', keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runtime: id, key: 'session', title: PORTAL_NAMES[id] || id, data: { summary: summary } }),
      }).catch(function () {});
    } catch (e) {}
  }

  // ---- 1. The AI bridge ----
  if (!(window.claude && typeof window.claude.complete === 'function')) {
    window.claude = window.claude || {};
    window.claude.complete = function (opts) {
      opts = opts || {};
      return fetch(apiBase() + '/api/ai/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system: opts.system, messages: opts.messages || [] }),
      })
        .then(function (r) {
          if (!r.ok) throw new Error('AI request failed (' + r.status + ')');
          return r.json();
        })
        .then(function (data) {
          var completion = (data && typeof data.completion === 'string') ? data.completion : '';
          try { captureExchange(opts, completion); } catch (e) {}
          return completion;
        });
    };
  }

  // ---- 3. Auto-capture email/contact forms anywhere on the site ----
  function looksLikeEmail(v) {
    return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
  }
  function captureEmailFrom(root) {
    try {
      var inputs = (root || document).querySelectorAll('input[type=email], input[name*=email i], input[id*=email i]');
      for (var i = 0; i < inputs.length; i++) {
        var v = inputs[i].value;
        if (looksLikeEmail(v)) {
          post('/api/leads', { email: v.trim(), source: runtimeName() + ':' + location.pathname, sessionId: sid() });
          if (window.vpTrack && window.vpTrack.identify) window.vpTrack.identify({ email: v.trim(), source: runtimeName() });
          return true;
        }
      }
    } catch (e) {}
    return false;
  }
  // Catch real <form> submits...
  document.addEventListener('submit', function (e) { captureEmailFrom(e.target); }, true);
  // ...and JS-driven buttons (Enter / click on subscribe-type controls).
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('button, [role=button], .subscribe, .notify, .of-send, [type=submit]')) {
      setTimeout(function () { captureEmailFrom(document); }, 0);
    }
  }, true);

  // Expose a manual helper for explicit wiring.
  window.captureLead = function (email, extra) {
    if (!looksLikeEmail(email)) return;
    post('/api/leads', Object.assign({ email: String(email).trim(), source: runtimeName(), sessionId: sid() }, extra || {}));
    if (window.vpTrack && window.vpTrack.identify) window.vpTrack.identify(Object.assign({ email: String(email).trim(), source: runtimeName() }, extra || {}));
  };
})();
