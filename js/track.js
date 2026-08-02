/* Vinay Pasricha — track.js
   First-party, privacy-respecting analytics: traffic + event-level +
   person-level + acquisition + audience + behavior depth.

   Injected into every page server-side. Sends anonymous events to /api/track:
     - pageview     load + SPA route changes (carries UTM, landing, first-touch,
                    timezone, new-vs-returning)
     - duration     on leave — total seconds + engaged (active) seconds
     - click        link / button / [data-track] (incl. outbound + rage-clicks)
     - form_submit  field COUNT only, never values
     - scroll       depth milestones (25/50/75/100%)
     - identify     when a visitor becomes a known person
     - event        custom, via window.vpTrack('name', { props })

   Privacy: no cookies, no raw IP, no form values. Honors Do-Not-Track and a
   per-visitor opt-out (window.vpTrack.optOut()/optIn()). Set
   window.__NO_TRACK__ = true to opt a page out entirely. */
(function () {
  'use strict';

  if (location.pathname === '/studio' || location.pathname.indexOf('/studio/') === 0) return;

  var VID_KEY = 'vp_vid', SID_KEY = 'vp_sid', SEEN_KEY = 'vp_seen';
  var PERSON_KEY = 'vp_person', OPTOUT_KEY = 'vp_optout';
  var FT_KEY = 'vp_ft', LAND_KEY = 'vp_landing';
  var SESSION_MS = 30 * 60 * 1000;

  function dnt() { var d = navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack; return d === '1' || d === 'yes'; }
  function ls(store, key, val) { try { if (val === undefined) return store.getItem(key); store.setItem(key, val); return val; } catch (e) { return null; } }
  function optedOut() { return ls(localStorage, OPTOUT_KEY) === '1'; }
  var OFF = !!window.__NO_TRACK__ || dnt() || optedOut();

  function rid() { try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {} return 'x' + Math.random().toString(36).slice(2) + Date.now().toString(36); }

  var freshVisitor = false;
  function visitorId() {
    var v = ls(localStorage, VID_KEY);
    if (!v) { v = ls(localStorage, VID_KEY, rid()); freshVisitor = true; }
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
  function tz() { try { return (Intl.DateTimeFormat().resolvedOptions().timeZone || '').slice(0, 48); } catch (e) { return ''; } }
  function txt(el) { return (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120); }
  function loadPerson() { try { return JSON.parse(ls(localStorage, PERSON_KEY) || 'null'); } catch (e) { return null; } }
  function savePerson(p) { ls(localStorage, PERSON_KEY, JSON.stringify(p)); }

  // ---- Acquisition: UTM + landing + first-touch ----------------------------
  function utm() {
    var q = {}, s = location.search;
    ['source', 'medium', 'campaign', 'term', 'content'].forEach(function (k) {
      var m = s.match(new RegExp('[?&]utm_' + k + '=([^&#]+)', 'i'));
      if (m) { try { q[k] = decodeURIComponent(m[1]).slice(0, 120); } catch (e) { q[k] = m[1].slice(0, 120); } }
    });
    return q;
  }
  function firstTouch(u) {
    var ft = null;
    try { ft = JSON.parse(ls(localStorage, FT_KEY) || 'null'); } catch (e) {}
    if (!ft) {
      ft = { s: u.source || '', m: u.medium || '', c: u.campaign || '', ref: (document.referrer || '').slice(0, 200), path: location.pathname };
      ls(localStorage, FT_KEY, JSON.stringify(ft));
    }
    return ft;
  }
  function sessionLanding() {
    var l = ls(sessionStorage, LAND_KEY);
    if (!l) l = ls(sessionStorage, LAND_KEY, location.pathname);
    return l || location.pathname;
  }

  var vid = visitorId();
  var person = loadPerson();
  var U = utm();
  var FT = firstTouch(U);
  var LANDING = sessionLanding();
  var TZ = tz();
  var enter = Date.now();
  var lastPath = null;
  var scrollHit = {};

  function base() {
    return { vid: vid, sid: sessionId(), email: (person && person.email) || '', pid: (person && person.id) || '', pname: (person && person.name) || '' };
  }
  // Events queue up and flush as one request every few seconds (or immediately
  // via sendBeacon for leave-critical events) instead of one POST per event.
  var queue = [];
  var FLUSH_MS = 5000, MAX_QUEUE = 20;
  var flushTimer = null;
  function flush(beacon) {
    if (!queue.length) return;
    var events = queue.splice(0, queue.length);
    try {
      var payload = JSON.stringify({ events: events });
      if (beacon && navigator.sendBeacon) { navigator.sendBeacon('/api/track', new Blob([payload], { type: 'application/json' })); return; }
      fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(function () {});
    } catch (e) {}
  }
  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(function () { flushTimer = null; flush(); }, FLUSH_MS);
  }
  function track(type, extra, beacon) {
    if (OFF) return;
    var body = { type: type, path: location.pathname, lang: lang(), t: Date.now() };
    var b = base();
    for (var k in b) body[k] = b[k];
    if (extra) for (var j in extra) body[j] = extra[j];
    queue.push(body);
    if (beacon || queue.length >= MAX_QUEUE) flush(beacon);
    else scheduleFlush();
  }
  window.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(true); });
  window.addEventListener('pagehide', function () { flush(true); });

  function pageview() {
    lastPath = location.pathname;
    enter = Date.now();
    activeMs = 0; lastActivity = Date.now();
    scrollHit = {};
    track('pageview', {
      ref: document.referrer || '',
      title: (document.title || '').slice(0, 200),
      screen: (window.screen ? screen.width + 'x' + screen.height : ''),
      tz: TZ,
      newVisitor: freshVisitor,
      landing: LANDING,
      utm: U,
      ft: { s: FT.s || '', m: FT.m || '', c: FT.c || '' },
    });
    freshVisitor = false; // only the very first pageview counts as "new"
  }

  // ---- Behavior: active/engaged time ---------------------------------------
  var activeMs = 0, lastActivity = Date.now();
  ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'].forEach(function (ev) {
    window.addEventListener(ev, function () { lastActivity = Date.now(); }, { passive: true });
  });
  setInterval(function () {
    if (OFF) return;
    if (document.visibilityState === 'visible' && (Date.now() - lastActivity) < 6000) activeMs += 1000;
  }, 1000);

  function flushDuration() {
    if (OFF || !lastPath) return;
    var seconds = Math.round((Date.now() - enter) / 1000);
    if (seconds < 1 || seconds > 86400) return;
    track('duration', { path: lastPath, seconds: seconds, engaged: Math.min(seconds, Math.round(activeMs / 1000)) }, true);
  }

  // ---- Public API ----------------------------------------------------------
  window.vpTrack = function (name, props) { track('event', { name: String(name || '').slice(0, 80), props: props || {} }); };
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
        name: person.name, company: String(p.company || '').slice(0, 160), phone: String(p.phone || '').slice(0, 40),
        role: String(p.role || '').slice(0, 120), source: String(p.source || '').slice(0, 60),
        ft: { s: FT.s || '', m: FT.m || '', c: FT.c || '', ref: FT.ref || '' },
      },
    }, true);
  };
  window.vpTrack.optOut = function () { ls(localStorage, OPTOUT_KEY, '1'); OFF = true; };
  window.vpTrack.optIn = function () { try { localStorage.removeItem(OPTOUT_KEY); } catch (e) {} OFF = !!window.__NO_TRACK__ || dnt(); if (!OFF && !lastPath) pageview(); };
  window.vpTrack.person = function () { return person; };

  if (OFF) return;

  // ---- Auto-capture: clicks (+ rage-click detection) -----------------------
  var clickLog = []; // { t, x, y }
  function rage(e) {
    var now = Date.now();
    clickLog.push({ t: now, x: e.clientX || 0, y: e.clientY || 0 });
    clickLog = clickLog.filter(function (c) { return now - c.t < 1000; });
    if (clickLog.length >= 3) {
      var near = clickLog.filter(function (c) { return Math.abs(c.x - e.clientX) < 40 && Math.abs(c.y - e.clientY) < 40; });
      if (near.length >= 3) { clickLog = []; track('event', { name: 'rage_click', props: { count: near.length } }); }
    }
  }
  document.addEventListener('click', function (e) {
    rage(e);
    var el = e.target && e.target.closest ? e.target.closest('a,button,[data-track],[role=button]') : null;
    if (!el) return;
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

  // ---- Auto-capture: form submissions (COUNT of fields only) ---------------
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (!f || f.tagName !== 'FORM') return;
    var fields = 0;
    try { fields = f.querySelectorAll('input,textarea,select').length; } catch (x) {}
    track('form_submit', { name: (f.getAttribute('name') || f.id || 'form').slice(0, 80), props: { action: (f.getAttribute('action') || '').slice(0, 200), fields: fields } });
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
      [25, 50, 75, 100].forEach(function (m) { if (pct >= m && !scrollHit[m]) { scrollHit[m] = 1; track('scroll', { name: 'depth_' + m, props: { depth: m } }); } });
    }, 400);
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  // ---- SPA route changes ---------------------------------------------------
  function onRouteChange() { if (location.pathname === lastPath) return; flushDuration(); pageview(); }
  ['pushState', 'replaceState'].forEach(function (fn) {
    var orig = history[fn];
    if (typeof orig === 'function') history[fn] = function () { var r = orig.apply(this, arguments); setTimeout(onRouteChange, 0); return r; };
  });
  window.addEventListener('popstate', onRouteChange);

  // ---- Leave signals -------------------------------------------------------
  window.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flushDuration(); });
  window.addEventListener('pagehide', flushDuration);

  pageview();
})();
