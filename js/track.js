/* Vinay Pasricha — track.js
   First-party, privacy-respecting website analytics with event-level and
   person-level depth.

   Injected into every page server-side (see backend app.js). Sends anonymous
   events to /api/track:
     - pageview     on load and on SPA route changes
     - duration     when the visitor leaves a page (time spent, seconds)
     - click        link / button / [data-track] clicks (incl. outbound)
     - form_submit  any form submission (field COUNT only, never values)
     - scroll       depth milestones (25/50/75/100%)
     - identify     when a visitor becomes a known person (name/email)
     - event        custom, via window.vpTrack('name', { props })

   Identity: once identified (via a lead form, portal login, ABL session, or an
   AI chat), the person is remembered on this device and their past anonymous
   activity is stitched to them server-side (by device visitor-id). No cookies.

   Opt-out: honors Do-Not-Track and a per-visitor flag. window.vpTrack.optOut()
   stops all tracking on this device; window.vpTrack.optIn() resumes. Set
   window.__NO_TRACK__ = true before this loads to opt a page out entirely. */
(function () {
  'use strict';

  // Never self-track the admin studio.
  if (location.pathname === '/studio' || location.pathname.indexOf('/studio/') === 0) return;

  var VID_KEY = 'vp_vid';         // visitor id (localStorage, persistent, anonymous)
  var SID_KEY = 'vp_sid';         // session id (sessionStorage)
  var SEEN_KEY = 'vp_seen';       // last-activity ms, for the 30-min session window
  var PERSON_KEY = 'vp_person';   // { email, id, name } once identified
  var OPTOUT_KEY = 'vp_optout';   // '1' when the visitor opted out
  var SESSION_MS = 30 * 60 * 1000;

  function dnt() {
    var d = navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack;
    return d === '1' || d === 'yes';
  }
  function ls(store, key, val) {
    try {
      if (val === undefined) return store.getItem(key);
      store.setItem(key, val);
      return val;
    } catch (e) { return null; }
  }
  function optedOut() { return ls(localStorage, OPTOUT_KEY) === '1'; }

  // Global page opt-out or DNT/flag -> tracking is OFF (but the API is still
  // exposed as no-ops so callers never error).
  var OFF = !!window.__NO_TRACK__ || dnt() || optedOut();

  function rid() {
    try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    return 'x' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
  function visitorId() {
    var v = ls(localStorage, VID_KEY);
    if (!v) v = ls(localStorage, VID_KEY, rid());
    return v || 'anon';
  }
  function sessionId() {
    var now = Date.now();
    var last = parseInt(ls(localStorage, SEEN_KEY) || '0', 10);
    var sid = ls(sessionStorage, SID_KEY);
    if (!sid || (last && now - last > SESSION_MS)) sid = ls(sessionStorage, SID_KEY, rid());
    ls(localStorage, SEEN_KEY, String(now));
    return sid || 'anon';
  }
  function lang() {
    var l = (document.documentElement && document.documentElement.lang) || '';
    var m = location.search.match(/[?&]lang=([a-z-]+)/i);
    if (m) l = m[1];
    return (l || navigator.language || '').toLowerCase().slice(0, 12);
  }
  function txt(el) { return (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120); }
  function loadPerson() { try { return JSON.parse(ls(localStorage, PERSON_KEY) || 'null'); } catch (e) { return null; } }
  function savePerson(p) { ls(localStorage, PERSON_KEY, JSON.stringify(p)); }

  var vid = visitorId();
  var person = loadPerson(); // { email, id, name } or null
  var enter = Date.now();
  var lastPath = null;
  var scrollHit = {};

  function base() {
    return {
      vid: vid,
      sid: sessionId(),
      email: (person && person.email) || '',
      pid: (person && person.id) || '',
      pname: (person && person.name) || '',
    };
  }

  function send(body, beacon) {
    try {
      var payload = JSON.stringify(body);
      if (beacon && navigator.sendBeacon) {
        navigator.sendBeacon('/api/track', new Blob([payload], { type: 'application/json' }));
        return;
      }
      fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(function () {});
    } catch (e) {}
  }

  // Core: send one event of `type` with optional extra fields.
  function track(type, extra, beacon) {
    if (OFF) return;
    var body = { type: type, path: location.pathname, lang: lang() };
    var b = base();
    for (var k in b) body[k] = b[k];
    if (extra) for (var j in extra) body[j] = extra[j];
    send(body, beacon);
  }

  function pageview() {
    lastPath = location.pathname;
    enter = Date.now();
    scrollHit = {};
    track('pageview', {
      ref: document.referrer || '',
      title: (document.title || '').slice(0, 200),
      screen: (window.screen ? screen.width + 'x' + screen.height : ''),
    });
  }

  function flushDuration() {
    if (OFF || !lastPath) return;
    var seconds = Math.round((Date.now() - enter) / 1000);
    if (seconds < 1 || seconds > 86400) return;
    track('duration', { path: lastPath, seconds: seconds }, true);
  }

  // ---- Public API ----------------------------------------------------------
  // Custom event: window.vpTrack('cta_click', { plan: 'pro' })
  window.vpTrack = function (name, props) {
    track('event', { name: String(name || '').slice(0, 80), props: props || {} });
  };
  // Mark this visitor as a known person. Accepts an email string or an object
  // { email, name, id, company, phone, role, source }. Persists on the device
  // and links all past + future activity to them server-side.
  window.vpTrack.identify = function (emailOrObj, traits) {
    var p = (typeof emailOrObj === 'object' && emailOrObj) ? emailOrObj : { email: emailOrObj };
    if (traits) { for (var k in traits) p[k] = traits[k]; }
    var email = String(p.email || '').trim().toLowerCase();
    var id = String(p.id || '').trim();
    if (!email && !id) return;
    person = { email: email, id: id, name: String(p.name || (person && person.name) || '').slice(0, 120) };
    savePerson(person);
    track('identify', {
      traits: {
        name: person.name,
        company: String(p.company || '').slice(0, 160),
        phone: String(p.phone || '').slice(0, 40),
        role: String(p.role || '').slice(0, 120),
        source: String(p.source || '').slice(0, 60),
      },
    }, true);
  };
  window.vpTrack.optOut = function () { ls(localStorage, OPTOUT_KEY, '1'); OFF = true; };
  window.vpTrack.optIn = function () { try { localStorage.removeItem(OPTOUT_KEY); } catch (e) {} OFF = !!window.__NO_TRACK__ || dnt(); if (!OFF && !lastPath) pageview(); };
  window.vpTrack.person = function () { return person; };

  if (OFF) return; // API exposed above; nothing else runs.

  // ---- Auto-capture: clicks (links, buttons, [data-track]) -----------------
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('a,button,[data-track],[role=button]') : null;
    if (!el) return;
    // Explicit tag wins: data-track="name" + any data-* as props.
    if (el.hasAttribute('data-track')) {
      var props = {};
      for (var i = 0; i < el.attributes.length; i++) {
        var a = el.attributes[i];
        if (a.name.indexOf('data-') === 0 && a.name !== 'data-track') props[a.name.slice(5)] = String(a.value).slice(0, 120);
      }
      track('event', { name: (el.getAttribute('data-track') || 'click').slice(0, 80), props: props });
      return;
    }
    if (el.tagName === 'A') {
      var href = el.getAttribute('href') || '';
      if (!href || href.charAt(0) === '#' || /^(javascript|mailto|tel):/i.test(href)) {
        if (/^(mailto|tel):/i.test(href)) track('click', { name: 'contact_link', props: { href: href.slice(0, 200) } });
        return;
      }
      var outbound = !!(el.hostname && el.hostname !== location.hostname && /^https?:$/.test(el.protocol));
      track('click', { name: outbound ? 'outbound_link' : 'link', props: { href: href.slice(0, 300), text: txt(el), outbound: outbound } }, outbound);
      return;
    }
    track('click', { name: 'button', props: { text: txt(el), id: el.id || '' } });
  }, true);

  // ---- Auto-capture: form submissions (COUNT of fields only, no values) ----
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (!f || f.tagName !== 'FORM') return;
    var fields = 0;
    try { fields = f.querySelectorAll('input,textarea,select').length; } catch (x) {}
    track('form_submit', {
      name: (f.getAttribute('name') || f.id || 'form').slice(0, 80),
      props: { action: (f.getAttribute('action') || '').slice(0, 200), fields: fields },
    });
  }, true);

  // ---- Auto-capture: scroll-depth milestones -------------------------------
  var scrollTimer = null;
  function onScroll() {
    if (scrollTimer) return;
    scrollTimer = setTimeout(function () {
      scrollTimer = null;
      var h = document.documentElement;
      var max = (h.scrollHeight || 0) - (h.clientHeight || 0);
      if (max <= 40) return;
      var pct = Math.min(100, Math.round(((h.scrollTop || document.body.scrollTop || 0) / max) * 100));
      [25, 50, 75, 100].forEach(function (m) {
        if (pct >= m && !scrollHit[m]) { scrollHit[m] = 1; track('scroll', { name: 'depth_' + m, props: { depth: m } }); }
      });
    }, 400);
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  // ---- SPA route changes ---------------------------------------------------
  function onRouteChange() {
    if (location.pathname === lastPath) return;
    flushDuration();
    pageview();
  }
  ['pushState', 'replaceState'].forEach(function (fn) {
    var orig = history[fn];
    if (typeof orig === 'function') {
      history[fn] = function () { var r = orig.apply(this, arguments); setTimeout(onRouteChange, 0); return r; };
    }
  });
  window.addEventListener('popstate', onRouteChange);

  // ---- Leave signals -------------------------------------------------------
  window.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flushDuration(); });
  window.addEventListener('pagehide', flushDuration);

  // First view.
  pageview();
})();
