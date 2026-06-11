/* =============================================================
   KAIROS·1 — Shared DORMANCY runtime
   =============================================================
   Stamps <html> with data-dormancy and data-warmth attributes
   on every page load, so the master pulse and atmospheric tone
   reflect how long the runtime has been waiting and how much
   it has been inhabited.

   Per Refinement 09: the runtime endures absence. It does not
   decay. Dormancy is geological, not melancholic.
   ============================================================= */
(function () {
  function compute() {
    if (!window.kairos || !window.kairos.state) return;
    const s = window.kairos.state.load();
    const dormancy = window.kairos.state.dormancyTier(s);
    const visits = window.kairos.state.totalVisits(s);
    let warmth = 0;
    if (visits >= 60) warmth = 3;
    else if (visits >= 20) warmth = 2;
    else if (visits >= 5) warmth = 1;
    const root = document.documentElement;
    if (dormancy > 0) root.setAttribute('data-dormancy', String(dormancy));
    else root.removeAttribute('data-dormancy');
    if (warmth > 0) root.setAttribute('data-warmth', String(warmth));
    else root.removeAttribute('data-warmth');

    // Refinement 10 — return phenomenology.
    // If the reader is returning from dormancy, stamp the page
    // with data-return-tier and the prior-descent stratum so
    // CSS can soften emergence and tint seepage atmospherically.
    const ret = window.kairos.state.consumeReturnEvent(s);
    if (ret) {
      root.setAttribute('data-return', String(ret.tier));
    }
    // Residue of prior descent — the threshold and chamber both
    // carry the stratum the reader was last in. Stratum is
    // derived from the last chamber slug.
    const lastChamber = s.identity && s.identity.last_chamber;
    if (lastChamber) {
      root.setAttribute('data-last-chamber', lastChamber);
      // Map slug to stratum
      const stratum =
        lastChamber === 'sequence' ? 'surface' :
        (lastChamber === 'constraint' ? 'diagnosis' :
        (lastChamber === 'output-reality' || lastChamber === 'failure-recovery' ? 'diagnosis' :
        (lastChamber === 'human-constraint' || lastChamber === 'structural' ? 'cause' :
        'foundation')));
      root.setAttribute('data-last-stratum', stratum);
    }
  }
  // Compute as soon as state.js is available
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', compute, { once: true });
  } else {
    compute();
  }
})();
