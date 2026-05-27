/* =============================================================
   KAIROS·1 — Shared TRANSITION mechanic
   =============================================================
   Cross-page transitions between chambers. The phenomenology
   (per the meta-layer): the current chamber recedes toward the
   spine, the spine briefly becomes visible, the destination
   chamber emerges. ~3 seconds. Inevitable, not interactive.

   Implementation:
   • A sessionStorage handshake (`kairos.transition`) coordinates
     departure and arrival across the page boundary.
   • On `depart()`: stash the handshake, fade the current chamber
     into a spine-flash, then navigate after the recede settles.
   • On chamber mount: call `receive()`. If a fresh handshake is
     present, start in an "arriving" state and animate emergence.

   This is deliberately *not* a SPA. Each chamber is its own
   HTML file. The transition rides over the page boundary.
   ============================================================= */

(function () {
  const KEY = 'kairos.transition.v1';
  const FRESH_MS = 6000;  // how long after depart a handshake is considered fresh

  function readHandshake() {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (!raw) return null;
      const h = JSON.parse(raw);
      if (!h || !h.ts) return null;
      if (Date.now() - h.ts > FRESH_MS) {
        sessionStorage.removeItem(KEY);
        return null;
      }
      return h;
    } catch (e) { return null; }
  }

  function writeHandshake(h) {
    try { sessionStorage.setItem(KEY, JSON.stringify(h)); } catch (e) {}
  }

  function clearHandshake() {
    try { sessionStorage.removeItem(KEY); } catch (e) {}
  }

  // Map chamber slug → depth (1..9). Used to determine whether
  // a transition is a descent or ascent through the doctrine.
  const SLUG_DEPTH = {
    'sequence': 1,
    'constraint': 2,
    'output-reality': 3,
    'failure-recovery': 4,
    'human-constraint': 5,
    'structural-constraint': 6,
    'capacity-expansion': 7,
    'multi-scale': 8,
    'character': 9,
  };

  function directionOf(from, to) {
    const a = SLUG_DEPTH[from] || 0;
    const b = SLUG_DEPTH[to] || 0;
    if (b > a) return 'descent';
    if (b < a) return 'ascent';
    return 'lateral';
  }

  // Called by the source chamber when the reader chooses to
  // transition. Animates the recede, then navigates.
  function depart({ from, to, href, recedeMs }) {
    const REC = recedeMs || 1400;
    const dir = directionOf(from, to);
    writeHandshake({ from, to, direction: dir, ts: Date.now() });
    document.documentElement.setAttribute('data-kairos-departing', '');
    document.documentElement.setAttribute('data-kairos-direction', dir);
    setTimeout(() => {
      window.location.href = href;
    }, REC);
  }

  // Called by the destination chamber on mount. If a fresh
  // arrival handshake is present, set the arriving attribute
  // + direction so global CSS can animate emergence.
  function receive({ slug }) {
    const h = readHandshake();
    if (!h) return null;
    if (slug && h.to !== slug) {
      return null;
    }
    document.documentElement.setAttribute('data-kairos-arriving', '');
    document.documentElement.setAttribute('data-kairos-direction', h.direction || 'lateral');
    setTimeout(() => {
      document.documentElement.removeAttribute('data-kairos-arriving');
      document.documentElement.removeAttribute('data-kairos-direction');
      clearHandshake();
    }, 2000);
    return h;
  }

  window.kairos = window.kairos || {};
  window.kairos.transition = { depart, receive, readHandshake, clearHandshake, directionOf, SLUG_DEPTH };
})();
