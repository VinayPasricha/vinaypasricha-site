/* Vinay Pasricha — track.js
   First-party, privacy-respecting website analytics.

   Injected into every page server-side (see backend app.js). Sends anonymous
   events to /api/track:
     - pageview  on load and on SPA route changes
     - duration  when the visitor leaves the page (time spent, seconds)

   No cookies, no PII, no third parties. A visitor is a random id kept in
   localStorage; a session is a random id kept in sessionStorage (30-min idle
   window). Nothing here identifies a person. Set window.__NO_TRACK__ = true
   before this loads to opt a page out entirely. */
(function () {
  'use strict';

  // Opt-outs: an explicit page flag, or the admin studio (never self-track).
  if (window.__NO_TRACK__) return;
  if (location.pathname === '/studio' || location.pathname.indexOf('/studio/') === 0) return;

  var VID_KEY = 'vp_vid';         // visitor id (localStorage, persistent)
  var SID_KEY = 'vp_sid';         // session id (sessionStorage)
  var SEEN_KEY = 'vp_seen';       // last-activity ms, for the 30-min session window
  var SESSION_MS = 30 * 60 * 1000;

  function rid() {
    try {
      if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    } catch (e) { /* fall through */ }
    return 'x' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function ls(store, key, val) {
    try {
      if (val === undefined) return store.getItem(key);
      store.setItem(key, val);
      return val;
    } catch (e) { return null; } // private mode / storage disabled
  }

  function visitorId() {
    var v = ls(localStorage, VID_KEY);
    if (!v) v = ls(localStorage, VID_KEY, rid());
    return v || 'anon';
  }

  // A session id that rolls over after 30 minutes of inactivity.
  function sessionId() {
    var now = Date.now();
    var last = parseInt(ls(localStorage, SEEN_KEY) || '0', 10);
    var sid = ls(sessionStorage, SID_KEY);
    if (!sid || (last && now - last > SESSION_MS)) {
      sid = ls(sessionStorage, SID_KEY, rid());
    }
    ls(localStorage, SEEN_KEY, String(now));
    return sid || 'anon';
  }

  function lang() {
    var l = (document.documentElement && document.documentElement.lang) || '';
    // ?lang=xx wins (the site renders translated pages at those URLs)
    var m = location.search.match(/[?&]lang=([a-z-]+)/i);
    if (m) l = m[1];
    return (l || navigator.language || '').toLowerCase().slice(0, 12);
  }

  function send(body, useBeacon) {
    try {
      var payload = JSON.stringify(body);
      if (useBeacon && navigator.sendBeacon) {
        navigator.sendBeacon('/api/track', new Blob([payload], { type: 'application/json' }));
        return;
      }
      fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(function () {});
    } catch (e) { /* never let tracking throw */ }
  }

  var vid = visitorId();
  var enter = Date.now();
  var lastPath = null;

  function pageview() {
    lastPath = location.pathname;
    enter = Date.now();
    send({
      type: 'pageview',
      path: location.pathname,
      ref: document.referrer || '',
      title: (document.title || '').slice(0, 200),
      vid: vid,
      sid: sessionId(),
      lang: lang(),
      screen: (window.screen ? screen.width + 'x' + screen.height : ''),
    }, false);
  }

  // Time spent on the page just left. sendBeacon so it survives unload.
  function flushDuration() {
    if (!lastPath) return;
    var seconds = Math.round((Date.now() - enter) / 1000);
    if (seconds < 1 || seconds > 86400) return;
    send({ type: 'duration', path: lastPath, seconds: seconds, vid: vid, sid: sessionId() }, true);
  }

  // Public hook so any runtime can log a custom event: window.vpTrack('cta_click')
  window.vpTrack = function (name, path) {
    send({ type: 'event', name: String(name || '').slice(0, 80), path: path || location.pathname, vid: vid, sid: sessionId() }, false);
  };

  // ---- SPA route changes: the runtimes swap views without a full reload ----
  function onRouteChange() {
    if (location.pathname === lastPath) return; // ignore hash/query-only changes
    flushDuration();
    pageview();
  }
  ['pushState', 'replaceState'].forEach(function (fn) {
    var orig = history[fn];
    if (typeof orig === 'function') {
      history[fn] = function () {
        var r = orig.apply(this, arguments);
        setTimeout(onRouteChange, 0);
        return r;
      };
    }
  });
  window.addEventListener('popstate', onRouteChange);

  // ---- Leave signals ----
  window.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flushDuration();
  });
  window.addEventListener('pagehide', flushDuration);

  // First view.
  pageview();
})();
