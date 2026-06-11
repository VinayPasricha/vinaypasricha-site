/* Frequency Spine Consolidation (Build X1)
   Renders OF.spine — the canonical basis, the vocab crosswalk, derivation
   rules, dimension relationships, and a live canonical-space gap demo. */
(function () {
  'use strict';
  if (!window.OF || !window.OF.spine) { console.warn('frequency-spine-admin.js requires of-frequency-spine.js'); return; }
  var S = window.OF.spine;

  var statsEl = document.getElementById('fs-stats');
  var tabsEl = document.getElementById('fs-tabs');
  var viewEl = document.getElementById('fs-view');

  var tab = 'basis';

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function titleCase(s) { return String(s || '').replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }

  function render() {
    renderStats();
    renderTabs();
    if (tab === 'basis') viewEl.innerHTML = basisView();
    else if (tab === 'crosswalk') viewEl.innerHTML = crosswalkView();
    else if (tab === 'derivation') viewEl.innerHTML = derivationView();
    else if (tab === 'relationships') viewEl.innerHTML = relationshipsView();
    else if (tab === 'gap') viewEl.innerHTML = gapView();
    wireTabs();
  }

  function renderStats() {
    var s = S.stats();
    statsEl.innerHTML =
      stat(s.canonical, 'Canonical dims') +
      stat(s.families, 'Families') +
      stat(s.v12, '3B/3C vocab') +
      stat(s.v10, '3D/3E/3F vocab') +
      stat(s.derived_only, 'Derived-only') +
      stat(s.relationships, 'Relationships');
  }
  function stat(n, l) { return '<div class="fs-stat"><div class="n">' + n + '</div><div class="l">' + l + '</div></div>'; }

  function renderTabs() {
    var tabs = [['basis', 'Canonical Basis'], ['crosswalk', 'Crosswalk'], ['derivation', 'Derivation Rules'], ['relationships', 'Relationships'], ['gap', 'Canonical Gap Demo']];
    tabsEl.innerHTML = tabs.map(function (t) { return '<button class="fs-tab ' + (tab === t[0] ? 'on' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</button>'; }).join('');
  }
  function wireTabs() { Array.prototype.forEach.call(document.querySelectorAll('[data-tab]'), function (b) { b.addEventListener('click', function () { tab = b.getAttribute('data-tab'); render(); }); }); }

  /* ---- CANONICAL BASIS ---- */
  function basisView() {
    var h = '<p class="fs-lead">Fifteen canonical dimensions across six families. Each has a definition, a named <em>positive pole</em> (the direction of “more”), an evolution <em>cadence</em> (how fast it can plausibly move), and whether it is directly <em>measurable</em> from evidence or only ever <em>derived</em>.</p>';
    var byFam = {};
    S.CANON.forEach(function (c) { (byFam[c.family] = byFam[c.family] || []).push(c); });
    Object.keys(S.FAMILIES).forEach(function (famId) {
      var fam = S.FAMILIES[famId];
      var dims = byFam[famId] || [];
      h += '<div class="fs-fam"><div class="fs-famh"><span class="fn">' + esc(fam.label) + '</span><span class="fnote">' + esc(fam.note) + '</span></div><div class="fs-dims">';
      h += dims.map(function (c) {
        var derived = S.DERIVED_ONLY.indexOf(c.id) !== -1;
        return '<div class="fs-dim ' + (derived ? 'derived' : '') + '"><div class="dh"><span class="dl">' + esc(c.label) + '</span><span class="did">' + esc(c.id) + '</span></div>' +
          '<div class="ddef">' + esc(c.def) + '</div>' +
          '<div class="fs-pole">↑ ' + esc(c.pole) + '</div>' +
          '<div class="dmeta"><span class="fs-tag ' + c.cadence + '">' + c.cadence + ' cadence</span>' +
          (c.measurable ? '<span class="fs-tag measurable">measurable</span>' : '<span class="fs-tag derived">derived only</span>') +
          '</div></div>';
      }).join('');
      h += '</div></div>';
    });
    return h;
  }

  /* ---- CROSSWALK ---- */
  function crosswalkView() {
    var h = '<p class="fs-lead">Every dimension of both legacy vocabularies, mapped to the canonical basis. <em>3B/3C</em> measures twelve; <em>3D/3E/3F</em> reasons about ten. Where a side has no measure for a canonical dimension, the gap is shown explicitly — and the three dimensions <em>no one</em> measures directly are flagged <em>derived</em>.</p>';
    h += '<div class="fs-cross"><div class="fs-crow hdr"><div class="fs-cc cc">3B / 3C · 12-dim</div><div class="fs-link"></div><div class="fs-cc cc canon" style="color:var(--fs-ink4);font-family:var(--fs-mono);font-size:8px;letter-spacing:0.12em">Canonical</div><div class="fs-link"></div><div class="fs-cc cc">3D / 3E / 3F · 10-dim</div></div>';
    S.CANON.forEach(function (c) {
      var v12 = S.fromCanon(c.id, 'v12');
      var v10 = S.fromCanon(c.id, 'v10');
      var derived = S.DERIVED_ONLY.indexOf(c.id) !== -1;
      h += '<div class="fs-crow">' +
        '<div class="fs-cc v12 ' + (v12 ? '' : 'none') + '">' + (v12 ? esc(v12) : '— not measured —') + '</div>' +
        '<div class="fs-link ' + (v12 ? '' : 'gap') + '">' + (v12 ? '→' : '⊘') + '</div>' +
        '<div class="fs-cc canon">' + esc(c.label) + (derived ? ' <span class="fs-cc derived" style="padding:0;font-size:8px">derived</span>' : '') + '</div>' +
        '<div class="fs-link ' + (v10 ? '' : 'gap') + '">' + (v10 ? '←' : '⊘') + '</div>' +
        '<div class="fs-cc v10 ' + (v10 ? '' : 'none') + '">' + (v10 ? esc(v10) : '— not measured —') + '</div>' +
        '</div>';
    });
    h += '</div>';
    h += '<p class="fs-lead" style="margin-top:14px">Read it as: <em>both outer columns are dialects; the centre is the language.</em> The ⊘ marks are where a layer is structurally blind — most importantly, <em>adaptability, learning,</em> and <em>risk tolerance</em> (reasoned about by Mission/Evolution/Learning) were never measured by Public Intelligence or Validation. The Derivation tab shows how the spine bridges them.</p>';
    return h;
  }

  /* ---- DERIVATION ---- */
  function derivationView() {
    var h = '<p class="fs-lead">When a layer needs a canonical dimension it never measured, the spine <em>derives</em> it from related measured dimensions — a transparent bridge, never a silent invention. Every derived value is flagged <em>derived</em> and carries confidence one notch below its weakest input, so it can never masquerade as a direct measurement.</p>';
    Object.keys(S.DERIVATION).forEach(function (id) {
      var rule = S.DERIVATION[id];
      var def = S.dimDef(id);
      var formula = rule.from.map(function (f) { return S.label(f); }).join(' + ') + (rule.invert ? '  (inverting ' + rule.invert.map(S.label).join(', ') + ')' : '');
      h += '<div class="fs-der"><div class="dt">' + esc(def.label) + ' <span style="color:var(--fs-ink4);font-family:var(--fs-mono);font-size:9px">derived</span></div>' +
        '<div class="df">' + esc(def.label) + '  ≈  f( ' + esc(formula) + ' )</div>' +
        '<div class="dn">' + esc(rule.note) + '</div></div>';
    });
    return h;
  }

  /* ---- RELATIONSHIPS ---- */
  function relationshipsView() {
    var h = '<p class="fs-lead">Canonical dimensions do not move independently. These are the observed couplings — where one dimension tends to <em>reinforce</em> another, and where two sit in <em>tension</em>. Stated as associations, never as laws.</p>';
    h += '<div>';
    S.RELATIONSHIPS.forEach(function (r) {
      h += '<div class="fs-rel"><div class="fs-relpair"><span>' + esc(S.label(r.a)) + '</span><span class="fs-relar ' + r.kind + '">' + (r.kind === 'reinforces' ? '⇄' : '⤬') + '</span><span>' + esc(S.label(r.b)) + '</span></div>' +
        '<span class="fs-relkind ' + r.kind + '">' + r.kind + '</span>' +
        '<div class="fs-relnote">' + esc(r.note) + '</div></div>';
    });
    return h + '</div>';
  }

  /* ---- CANONICAL GAP DEMO ---- */
  function gapView() {
    var live = S.liveExample();
    var data, banner;
    if (live) {
      data = live.gap;
      banner = '<div class="fs-banner">Live data: <em>' + esc(live.company) + '</em> — validated profile (12-dim) vs mission <em>“' + esc(live.mission_title) + '”</em> (10-dim), both translated into canonical space and compared apples-to-apples.</div>';
    } else {
      // worked illustrative example — shows BOTH vocabularies translating into one space
      var current12 = {
        leadership_style: { level: 'visible & directive', confidence: 'high' },
        decision_making: { level: 'founder-led', confidence: 'medium' },
        autonomy_level: { level: 'directed', confidence: 'medium' },
        communication_culture: { level: 'open & direct', confidence: 'medium' },
        collaboration_style: { level: 'collaborative', confidence: 'medium' },
        execution_style: { level: 'process-led', confidence: 'medium' },
        pressure_environment: { level: 'high-intensity', confidence: 'medium' },
        innovation_orientation: { level: 'contested', confidence: 'medium' },
        growth_orientation: { level: 'expansion-mode', confidence: 'high' },
        stability_vs_chaos: { level: 'established', confidence: 'medium' },
        talent_philosophy: { level: 'capacity-building', confidence: 'medium' },
        employee_flourishing: { level: 'strained', confidence: 'low' }
      };
      var mission10 = {
        innovation: { level: 'high', confidence: 'high' },
        autonomy: { level: 'high', confidence: 'high' },
        execution: { level: 'high', confidence: 'high' },
        adaptability: { level: 'high', confidence: 'medium' },
        risk_tolerance: { level: 'high', confidence: 'medium' },
        learning: { level: 'medium', confidence: 'medium' },
        leadership: { level: 'high', confidence: 'high' }
      };
      data = S.canonicalGap(current12, 'v12', mission10, 'v10');
      banner = '<div class="fs-banner">Worked example (no live 3C+3D data found): a validated profile in the <em>12-dim</em> vocabulary vs an AI-product-line mission in the <em>10-dim</em> vocabulary. Both are translated into canonical space, so the gap is computed once, consistently. Note <em>adaptability</em> and <em>risk tolerance</em> — required by the mission, never measured upstream — appear as <em>derived</em> current values. <a href="org-validation.html" style="color:var(--fs-acc)">Run a real 3C→3D pipeline</a> and this becomes live.</div>';
    }
    var h = banner;
    h += '<div class="fs-sech">Current vs Mission · in canonical space</div>';
    h += '<div class="fs-gap"><div class="fs-gh">Canonical dimension</div><div class="fs-gh">Current</div><div class="fs-gh">Mission needs</div><div class="fs-gh">Gap</div>';
    data.rows.forEach(function (r) {
      h += '<div class="fs-gc"><span class="fs-gdim">' + esc(r.label) + '</span></div>' +
        '<div class="fs-gc"><span class="fs-lv ' + r.current + '">' + esc(r.current) + '</span><span class="fs-src ' + r.current_source + '">' + (r.current_source === 'derived' ? 'derived' : r.current_source === 'measured' ? 'measured' : r.current_source) + '</span></div>' +
        '<div class="fs-gc"><span class="fs-lv ' + r.required + '">' + esc(r.required) + '</span></div>' +
        '<div class="fs-gc"><span class="fs-sev ' + r.severity + '">' + r.severity + '</span>' + (r.severity !== 'aligned' ? ' <span class="fs-src">' + esc(r.gap_label) + '</span>' : '') + '</div>';
    });
    h += '</div>';
    h += '<p class="fs-lead" style="margin-top:14px"><em>This is the fix.</em> Before X1, the 12-dim current state and the 10-dim mission state were compared across mismatched vocabularies; dimensions like adaptability had no current value at all. Now both translate into one basis, the unmeasured ones are honestly <em>derived</em> (and visibly lower-confidence), and the gap is a single, coherent comparison.</p>';
    return h;
  }

  render();
})();
