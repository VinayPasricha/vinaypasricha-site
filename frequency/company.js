/* =============================================================
   company.js — public Organizational Frequency profile
   =============================================================
   TWO MODES, one renderer:

   • LIVE  — when companies have been researched in the Studio,
     this page reads them straight out of the runtime store
     (localStorage `of.runtime.v1`): the public-intel estimate
     (12 dimensions), contradictions, and the matched organization's
     progression through the runtime. Select with ?company=<slug>.
     Accuracy reflects the REAL confidence the engine has reached.

   • DEMO — when the store holds no researched companies, a built-in
     example (Helio Robotics) runs as an interactive walkthrough: an
     operator can step it through the five runtime stages and watch
     the same profile sharpen from outside-in guess to living truth.

   Faithful to the OF runtime throughout: 12 dimensions, probabilistic,
   "public signals suggest…", never a verdict, never a numeric rating
   of a person.
   ============================================================= */
(function () {
  'use strict';

  /* ---------- runtime stages ---------- */
  var STAGES = [
    { key: 'public',    label: 'Outside-in',       sub: 'Public signal only' },
    { key: 'mission',   label: 'Mission captured', sub: 'Org context added' },
    { key: 'research',  label: 'Tier-0 research',  sub: 'Signal corroborated' },
    { key: 'discovery', label: 'Deep discovery',   sub: 'Stakeholder threads' },
    { key: 'living',    label: 'Validated',        sub: 'Living frequency' }
  ];
  var ACCURACY = [18, 33, 54, 75, 92];
  var STAGE_DESC = [
    'Assembled from public material only — careers pages, posts, news, reviews. An educated outside guess.',
    'The organization described its mission. Context now frames the signal, but the read is still mostly outside-in.',
    'Tier-0 research corroborated the public signal against observed-reality sources. Several readings firm up.',
    'Deep discovery opened stakeholder threads — founder, hiring manager, supervisor. The model starts to learn from inside.',
    'Stakeholder-validated. This is now a living frequency, grounded in truth and updated as the organization evolves.'
  ];
  var STAGE_CAP = [
    'You are seeing <b>stage 0</b> — a profile built entirely from public signal. Step it forward to watch the same organization come into focus as it enters the runtime.',
    '<b>Mission captured.</b> The organization said what it is actually trying to do. Ambiguous public readings begin to settle.',
    '<b>Tier-0 research complete.</b> Public claims were checked against observed reality. Confidence rises where sources agree.',
    '<b>Deep discovery underway.</b> Stakeholder interviews feed the model from inside; contested dimensions begin to resolve.',
    '<b>Validated — a living frequency.</b> Every reading below now rests on stakeholder truth, not an outside guess. This is the accuracy the runtime is built to reach.'
  ];

  /* the 12 public-intel dimensions, in canonical order */
  var DIM_KEYS = [
    'leadership_style', 'decision_making', 'communication_culture', 'execution_style',
    'pressure_environment', 'autonomy_level', 'collaboration_style', 'talent_philosophy',
    'growth_orientation', 'stability_vs_chaos', 'innovation_orientation', 'employee_flourishing'
  ];
  var DIM_LABELS = {
    leadership_style: 'Leadership Style', decision_making: 'Decision-Making',
    communication_culture: 'Communication Culture', execution_style: 'Execution Style',
    pressure_environment: 'Pressure Environment', autonomy_level: 'Autonomy Level',
    collaboration_style: 'Collaboration Style', talent_philosophy: 'Talent Philosophy',
    growth_orientation: 'Growth Orientation', stability_vs_chaos: 'Stability vs. Chaos',
    innovation_orientation: 'Innovation Orientation', employee_flourishing: 'Employee Flourishing'
  };

  /* =============================================================
     DEMO company (Helio Robotics) — synthetic staged walkthrough
     ============================================================= */
  var DEMO = {
    name: 'Helio Robotics',
    domain: 'heliorobotics.com',
    facts: ['Robotics &amp; automation', 'Series C · ~480 people', 'Profiled from 7 public sources'],
    essenceEarly: 'A fast-scaling robotics company that reads, from public signal, as <em>speed-led and expansion-minded</em> — with intensity that may sit underneath the language of ownership.',
    essenceLate: 'A fast-scaling robotics company whose validated frequency is <em>speed-led and expansion-minded</em>, with real autonomy held inside clear guardrails and intensity that concentrates in launch cycles.',
    dims: [
      { name: 'Leadership Style', levelEarly: 'Visible &amp; directive', levelLate: 'Founder-set, increasingly delegated',
        conf: [0.35, 0.40, 0.55, 0.72, 0.90],
        readEarly: 'a loud founder voice in public material; leadership sets direction openly.',
        readMid: 'Corroborated across interviews and press — vision-driven, hands-on at the top.',
        readLate: 'Validated: founders still set direction, but execution authority is moving to pod leads.' },
      { name: 'Decision-Making', levelEarly: 'Appears founder-led', levelLate: 'Decentralizing to pod leads',
        conf: [0.30, 0.34, 0.48, 0.70, 0.88],
        readEarly: 'decisions concentrated with founders or senior leadership.',
        readMid: 'Research suggests big calls stay central while delivery calls move outward.',
        readLate: 'Validated: deliberately pushing decisions toward the work, with guardrails on spend and safety.' },
      { name: 'Communication Culture', levelEarly: 'Open &amp; direct', levelLate: 'Open &amp; direct',
        conf: [0.32, 0.38, 0.52, 0.68, 0.85],
        readEarly: 'a transparent, candid style; the tone in posts is plain-spoken.',
        readMid: 'Observed sources broadly agree — direct feedback, few layers.',
        readLate: 'Validated: candour is real and valued; the risk is bluntness under time pressure.' },
      { name: 'Execution Style', levelEarly: 'Speed-led', levelLate: 'Speed-led',
        conf: [0.42, 0.48, 0.62, 0.78, 0.92],
        readEarly: 'a strong "ship fast / bias for action" signature across public material.',
        readMid: 'Corroborated: velocity is prized; process is light by design.',
        readLate: 'Validated: speed is the dominant value, balanced lately by hardware-quality gates.' },
      { name: 'Pressure Environment', levelEarly: 'High-intensity at peak cycles', levelLate: 'Intense in launch windows',
        conf: [0.40, 0.45, 0.66, 0.80, 0.90],
        readEarly: 'long hours and crunch around launches, in reviews and job posts.',
        readMid: 'Observed sources corroborate intensity that spikes during peak cycles.',
        readLate: 'Validated: sustained pace, with real intensity concentrated in launch windows.' },
      { name: 'Autonomy Level', levelEarly: 'Claimed high autonomy', levelLate: 'High — within clear guardrails',
        conf: [0.30, 0.33, 0.40, 0.55, 0.82], contestUntil: 4,
        readEarly: 'language that emphasises ownership, complicated by observed pressure signals.',
        readMid: 'Tension persists: stated autonomy sits beside signs of intense top-down cycles.',
        readLate: 'Validated: autonomy is genuine but bounded — wide latitude inside clear guardrails.' },
      { name: 'Collaboration Style', levelEarly: 'Cross-functional', levelLate: 'Cross-functional, pod-based',
        conf: [0.30, 0.35, 0.50, 0.66, 0.84],
        readEarly: 'teamwork and cross-functional projects, foregrounded in public material.',
        readMid: 'Corroborated: hardware/software pods work tightly together.',
        readLate: 'Validated: pod-based collaboration is the core operating unit.' },
      { name: 'Talent Philosophy', levelEarly: 'Performance + capacity-building', levelLate: 'High-bar, develop-from-within',
        conf: [0.34, 0.40, 0.54, 0.72, 0.88],
        readEarly: 'high-performer language mixed with talk of learning and development.',
        readMid: 'Research leans toward a high bar at hire, with internal growth paths.',
        readLate: 'Validated: hires for a high bar, then invests heavily in growing people in-role.' },
      { name: 'Growth Orientation', levelEarly: 'Expansion-mode', levelLate: 'Expansion-mode',
        conf: [0.46, 0.52, 0.68, 0.82, 0.94],
        readEarly: 'a strong expansion posture — new markets, sustained hiring, scaling language.',
        readMid: 'Corroborated across news and job posts: actively scaling.',
        readLate: 'Validated: expansion is the central organizing pressure right now.' },
      { name: 'Stability vs. Chaos', levelEarly: 'Fluid &amp; fast-changing', levelLate: 'Fluid, stabilising in core',
        conf: [0.40, 0.44, 0.60, 0.74, 0.88],
        readEarly: 'a fast-changing, startup-flavoured environment with shifting priorities.',
        readMid: 'Observed signal confirms fluidity, especially at the edges.',
        readLate: 'Validated: still fluid, but core platform teams are deliberately stabilising.' },
      { name: 'Innovation Orientation', levelEarly: 'Innovation-forward', levelLate: 'Innovation-forward',
        conf: [0.38, 0.44, 0.58, 0.74, 0.90],
        readEarly: 'a prominent emphasis on R&amp;D and "pioneering" in public material.',
        readMid: 'Corroborated: meaningful investment in new product directions.',
        readLate: 'Validated: experimentation is protected even under delivery pressure.' },
      { name: 'Employee Flourishing', levelEarly: 'Mixed / unclear', levelLate: 'Supported but stretched',
        conf: [0.22, 0.26, 0.42, 0.62, 0.85], contestUntil: 3,
        readEarly: 'a genuinely mixed picture — supportive language beside strain indicators.',
        readMid: 'Sources conflict: strong benefits alongside peak-cycle burnout signals.',
        readLate: 'Validated: people feel supported and invested-in, but stretched in launch windows.' }
    ]
  };

  /* =============================================================
     STORE — read real companies out of of.runtime.v1
     ============================================================= */
  function loadStore() {
    try {
      // Standalone company pages bake their data into window.__OF_COMPANY_DATA__;
      // the normal Studio-driven page falls back to the localStorage runtime store.
      var raw = (typeof window.__OF_COMPANY_DATA__ === 'string' && window.__OF_COMPANY_DATA__) || localStorage.getItem('of.runtime.v1');
      if (!raw) return null;
      var s = JSON.parse(raw);
      return {
        estimates: s.pub_estimates || [],
        pages: s.pub_pages || [],
        research: s.pub_research || [],
        contradictions: s.pub_contradictions || [],
        organizations: s.organizations || [],
        missions: s.missions || []
      };
    } catch (e) { return null; }
  }

  function bucketNum(c) {
    return c === 'high' ? 0.85 : c === 'medium' ? 0.62 : c === 'low' ? 0.38 : c === 'none' ? 0.12 : 0.3;
  }
  function lc(s) { return (s || '').charAt(0).toLowerCase() + (s || '').slice(1); }
  function norm(s) { return (s || '').trim().toLowerCase(); }

  /* Determine how far a matched organization has travelled through the runtime. */
  function orgStage(org, store) {
    if (!org) return 0;
    var hasMission = (store.missions || []).some(function (m) { return m.organization_id === org.organization_id; });
    var lf = org.living_frequency && org.living_frequency.dimensions ? org.living_frequency.dimensions : [];
    var validated = lf.some(function (d) { return /validated/.test(d.source || '') && !/contradicted/.test(d.source || ''); });
    var hasDiscovery = lf.length > 0;
    var hasResearch = org.preliminary_frequency && org.preliminary_frequency.dimensions && org.preliminary_frequency.dimensions.length;
    if (validated) return 4;
    if (hasDiscovery) return 3;
    if (hasResearch) return 2;
    if (hasMission) return 1;
    return 0;
  }

  /* Build a normalized live profile from a public-intel estimate. */
  function liveProfile(est, store) {
    var page = store.pages.filter(function (p) { return p.research_id === est.research_id; })[0] || null;
    var research = store.research.filter(function (r) { return r.research_id === est.research_id; })[0] || null;
    var org = store.organizations.filter(function (o) { return norm(o.organization_name) === norm(est.company_name); })[0] || null;
    var contras = store.contradictions.filter(function (c) { return c.research_id === est.research_id; });
    var stg = orgStage(org, store);

    // which dims are in tension (from contradictions) — stays contested until validated
    var contested = {};
    contras.forEach(function (c) {
      String(c.dimension || '').split('/').forEach(function (part) {
        var k = norm(part).replace(/\s+/g, '_').replace(/[^a-z_]/g, '');
        if (DIM_LABELS[k]) contested[k] = true;
      });
    });

    var srcCount = research && research.source_inventory ? research.source_inventory.length : 0;
    var dims = DIM_KEYS.map(function (k) {
      var d = (est.dimensions && est.dimensions[k]) || { level: 'unclear from public signals', summary: 'Public material does not yet speak clearly to ' + DIM_LABELS[k].toLowerCase() + '; this remains unvalidated.', confidence: 'none', needs_validation: true };
      var conf = bucketNum(d.confidence);
      var isContested = !!contested[k] && stg < 4;
      var validated = stg >= 4 && !isContested && d.confidence !== 'none';
      if (validated) conf = Math.max(conf, 0.85);
      else if (stg >= 2 && d.confidence === 'medium') conf = Math.max(conf, 0.66);
      return {
        name: DIM_LABELS[k], level: d.level, read: d.summary,
        conf: conf, contested: isContested, validated: validated, needsVal: !!d.needs_validation
      };
    });

    var meanConf = dims.reduce(function (a, d) { return a + d.conf; }, 0) / dims.length;
    var accuracy = Math.max(ACCURACY[stg] - 6, Math.round(meanConf * 100));

    return {
      live: true, name: est.company_name,
      domain: research && research.discovered_domain ? research.discovered_domain : '',
      facts: [
        'Profiled from ' + srcCount + ' public source' + (srcCount === 1 ? '' : 's'),
        page ? 'Public page · ' + page.status.replace(/_/g, ' ') : 'No public page yet',
        est.limited_material ? 'Limited public material' : 'Multiple sources'
      ],
      essence: (est.confidence_reasoning || '').replace(/\s+/g, ' ').trim(),
      stage: stg, accuracy: accuracy,
      dims: dims, contradictions: contras,
      metrics: est.people_metrics || null,
      needs: (est.needs_validation || []).map(function (k) { return DIM_LABELS[k] || k; }),
      unvalidated: est.unvalidated_claims || []
    };
  }

  function liveList(store) {
    if (!store || !store.estimates.length) return [];
    return store.estimates.map(function (e) {
      var page = store.pages.filter(function (p) { return p.research_id === e.research_id; })[0];
      return { estimate: e, slug: page ? page.slug : null, name: e.company_name };
    });
  }

  /* =============================================================
     STATE
     ============================================================= */
  var store = loadStore();
  var live = liveList(store);
  var params = new URLSearchParams(location.search);
  var forceDemo = params.has('demo');
  var wantSlug = params.get('company');

  var MODE, profile, selected;
  if (!forceDemo && live.length) {
    selected = (wantSlug && live.filter(function (l) { return l.slug === wantSlug; })[0]) || live[0];
    profile = liveProfile(selected.estimate, store);
    MODE = 'live';
  } else {
    MODE = 'demo';
  }

  // demo stage (persisted)
  var KEY = 'of.company.stage';
  var stage = readStage();
  function readStage() { try { var v = parseInt(localStorage.getItem(KEY), 10); return (v >= 0 && v <= 4) ? v : 0; } catch (e) { return 0; } }
  function writeStage(s) { try { localStorage.setItem(KEY, String(s)); } catch (e) {} }

  /* ---------- helpers ---------- */
  function el(id) { return document.getElementById(id); }
  function curStage() { return MODE === 'live' ? profile.stage : stage; }
  function curAccuracy() { return MODE === 'live' ? profile.accuracy : ACCURACY[stage]; }

  // normalized dims for the current view
  function resolveDims() {
    if (MODE === 'live') return profile.dims;
    return DEMO.dims.map(function (d) {
      var contested = d.contestUntil != null && stage < d.contestUntil;
      var c = d.conf[stage];
      var read = stage >= 4 ? d.readLate : (stage >= 2 ? d.readMid : d.readEarly);
      if (stage < 2) read = 'Public signals suggest ' + lc(read);
      return {
        name: d.name, level: stage >= 4 ? d.levelLate : d.levelEarly, read: read,
        conf: c, contested: contested, validated: stage >= 4 && !contested, needsVal: c < 0.6 || contested
      };
    });
  }

  function confClass(c, contested) { return contested ? 'contested' : (c < 0.4 ? 'low' : ''); }
  function confTag(c, contested) {
    if (contested) return 'contested';
    if (c >= 0.8) return 'validated';
    if (c >= 0.6) return 'corroborated';
    if (c >= 0.4) return 'emerging';
    return 'public read';
  }

  /* People & culture signals panel (from public reviews / listings). */
  function renderSignals(m) {
    var sec = el('sig-sec'); if (!sec) return;
    if (MODE !== 'live') { sec.style.display = 'none'; return; }
    m = m || {};
    var pct = function (v) { v = String(v == null ? '' : v).trim().replace(/%$/, ''); return v ? v + '%' : ''; };
    var lead = function (s) {
      s = String(s || '').split(/[—:,(]|\s-\s/)[0].trim();      // text before a dash-phrase/punctuation
      var w = s.split(/\s+/), out = w[0] || '';
      if (out.length <= 4 && w[1]) out += ' ' + w[1];           // keep 2 words only if first is tiny
      return out.charAt(0).toUpperCase() + out.slice(1);
    };
    var NF = '<span class="sig-nf">Not found</span>';            // shown instead of hiding a missing metric

    var chips = [];
    function chip(label, value, sub) {
      var has = value != null && value !== '';
      chips.push('<div class="sig"><div class="sig-v">' + (has ? value : NF) + '</div><div class="sig-k">' + label + '</div>' +
        (has && sub ? '<div class="sig-sub">' + esc(sub) + '</div>' : '') + '</div>');
    }

    var rating = m.glassdoor_rating || m.ambitionbox_rating;
    chip('Employee rating', rating ? '★ ' + esc(rating) : '', m.glassdoor_reviews ? esc(m.glassdoor_reviews) + ' reviews' : '');
    chip('Recommend to a friend', pct(m.recommend_pct) ? '<em>' + pct(m.recommend_pct) + '</em>' : '', '');
    chip('CEO approval', pct(m.ceo_approval_pct) ? '<em>' + pct(m.ceo_approval_pct) + '</em>' : '', '');
    // Headcount: a number or band only, never a sentence.
    var hc = String(m.headcount || '').trim();
    var hcRange = hc.match(/\d[\d,]*\s*(?:[-–]|to)\s*\d[\d,]*/i);
    var hcOne = hc.match(/\d[\d,]*\+?/);
    var hcVal = hcRange ? hcRange[0].replace(/\s*to\s*/i, '–').replace(/\s+/g, '') : (hcOne ? hcOne[0] : (hc && hc.length <= 14 ? hc : ''));
    chip('Headcount', hcVal ? esc(hcVal) : '', '');
    // Headcount growth: a percent or one short word, never a sentence.
    var g = String(m.headcount_growth || '').trim();
    var gp = g.match(/[+\-]?\d[\d.]*%\s*(?:\/?\s*(?:yr|year|yoy))?/i);
    var gWord = g.replace(/\(.*$/, '').trim().split(/\s+/)[0];
    var gVal = gp ? gp[0] : (gWord ? gWord.charAt(0).toUpperCase() + gWord.slice(1) : '');
    chip('Headcount growth', gVal ? esc(gVal) : '', '');
    // Open roles: show the COUNT only — never a list of role titles.
    var rolesNum = (String(m.open_roles == null ? '' : m.open_roles).match(/\d[\d,]*/) || [])[0];
    chip('Open roles', rolesNum ? esc(rolesNum) : '', '');
    // Attrition: directional word ("Elevated"/"Low"/"Unclear"), or Not found if absent.
    var attr = String(m.attrition_signal || '').trim();
    chip('Attrition signal', attr ? '<em>' + esc(lead(attr)) + '</em>' : '', (attr && !/unclear|no (public )?data|unknown|n\/a/i.test(attr)) ? esc(attr) : '');

    sec.style.display = '';
    el('sig-meta').textContent = 'from public reviews & listings · directional';
    el('sig-grid').innerHTML = chips.join('');
    el('sig-grid').style.display = '';

    // Pros / cons — always show both columns; say so plainly when none were found.
    var pros = (m.top_pros || []).filter(Boolean).slice(0, 4);
    var cons = (m.top_cons || []).filter(Boolean).slice(0, 4);
    var none = '<li class="sig-none">None found in public reviews</li>';
    el('sig-voices').style.display = '';
    el('sig-voices').innerHTML =
      '<div class="sig-col"><h4>What employees praise</h4><ul>' +
        (pros.length ? pros.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') : none) + '</ul></div>' +
      '<div class="sig-col cons"><h4>Common gripes</h4><ul>' +
        (cons.length ? cons.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') : none) + '</ul></div>';
  }

  /* =============================================================
     RENDER
     ============================================================= */
  function render() {
    var s = curStage(), pct = curAccuracy(), dims = resolveDims();
    var name = MODE === 'live' ? profile.name : DEMO.name;
    var domain = MODE === 'live' ? profile.domain : DEMO.domain;

    // title + h1
    document.title = name + ' — Organizational Frequency (Public Profile)';
    el('co-name').innerHTML = 'The Organizational Frequency of <em>' + name.replace(/ /g, '&nbsp;') + '</em>';

    // hero meta (+ company switcher in live mode)
    var facts = MODE === 'live' ? profile.facts : DEMO.facts;
    var metaHTML = facts.map(function (f) { return '<span>' + f + '</span>'; }).join('');
    if (domain) metaHTML += '<span><a class="lk" href="https://' + domain + '" target="_blank" rel="noopener nofollow">' + domain + ' ↗</a></span>';
    el('co-meta').innerHTML = metaHTML;

    // essence
    if (MODE === 'live') {
      el('co-essence').innerHTML = profile.essence ? esc(profile.essence) : 'An evidence-based read assembled from publicly available signals.';
    } else {
      el('co-essence').innerHTML = s >= 3 ? DEMO.essenceLate : DEMO.essenceEarly;
    }

    // disclaimer
    el('co-disclaim').innerHTML = s >= 4
      ? 'This profile has been <em>validated with the organization\u2019s own people.</em> It remains a frequency \u2014 a living, probabilistic read that keeps updating \u2014 never a fixed label.'
      : 'This profile is assembled from <em>publicly available signals only</em> and has not been validated by the company. It is probabilistic by construction \u2014 a starting hypothesis, not a verdict.';

    // mode / source line in eyebrow
    el('mode-tag').innerHTML = MODE === 'live'
      ? 'Live · from this device’s runtime' + (live.length > 1 ? ' · ' + companySwitcher() : '')
      : 'Demonstration profile · <a class="lk" href="../studio/">research a real company in the Studio</a>';

    // accuracy dial
    var C = 2 * Math.PI * 47;
    el('ring-arc').setAttribute('stroke-dasharray', C.toFixed(1));
    el('ring-arc').setAttribute('stroke-dashoffset', (C * (1 - pct / 100)).toFixed(1));
    el('ring-arc').setAttribute('stroke', s >= 3 ? 'var(--freq)' : 'var(--freq-2)');
    el('ring-pct').textContent = pct + '%';
    el('dial-stage').textContent = STAGES[s].label;
    el('dial-desc').innerHTML = STAGE_DESC[s];
    var known = dims.filter(function (d) { return d.conf >= 0.4; }).length;
    el('dial-known').textContent = known + ' of 12 dimensions above emerging confidence';

    // stage rail
    el('stage-rail').innerHTML = STAGES.map(function (st, i) {
      var cls = i === s ? 'active' : (i < s ? 'done' : (MODE === 'live' ? 'locked' : ''));
      return '<button class="stage-cell ' + cls + '" data-stage="' + i + '" type="button"' + (MODE === 'live' ? ' disabled' : '') + '>' +
        '<div class="sc-num">STAGE ' + i + '</div>' +
        '<div class="sc-label">' + st.label + '</div>' +
        '<div class="sc-sub">' + st.sub + '</div></button>';
    }).join('');

    if (MODE === 'live') {
      el('stage-cap').innerHTML = '<b>' + name + '</b> is at <b>stage ' + s + ' · ' + STAGES[s].label + '</b> in the runtime. This reading reflects the real confidence the engine has reached so far — it sharpens automatically as ' + name + ' moves deeper into the runtime.';
      el('advance').style.display = 'none';
    } else {
      el('stage-cap').innerHTML = STAGE_CAP[s];
      el('advance').style.display = '';
      el('advance').disabled = s >= 4;
      el('advance').textContent = s >= 4 ? 'Fully validated' : 'Advance one stage →';
    }

    // people & culture signals (live only)
    renderSignals(MODE === 'live' ? profile.metrics : null);

    // dimensions
    el('dims-meta').textContent = 'Stage ' + s + ' · ' + STAGES[s].label;
    el('dims').innerHTML = dims.map(function (d) {
      var cc = confClass(d.conf, d.contested), tag = confTag(d.conf, d.contested);
      return '<div class="dim">' +
        '<div class="dim-name">' + d.name + '</div>' +
        '<div><div class="dim-level"><em>' + d.level + '</em></div>' +
          '<div class="dim-read">' + esc(d.read) + '</div></div>' +
        '<div class="dim-conf">' +
          '<span class="conf-tag ' + cc + '">' + tag + '</span>' +
          '<div class="conf-bar"><div class="conf-fill ' + cc + '" style="width:' + Math.round(d.conf * 100) + '%"></div></div>' +
        '</div></div>';
    }).join('');

    // fit
    el('thrive').innerHTML = thrive(dims, s).map(li).join('');
    el('struggle').innerHTML = struggle(dims).map(li).join('');

    // needs validation
    var needs;
    if (MODE === 'live') {
      needs = dims.filter(function (d) { return d.needsVal || d.contested; });
    } else {
      needs = dims.filter(function (d) { return d.conf < 0.6 || d.contested; });
    }
    el('needs-meta').textContent = needs.length + ' open · resolves as you validate';
    el('needs').innerHTML = needs.length ? needs.map(function (d) {
      return '<div class="vrow">' +
        '<span class="v-sev ' + (d.contested ? 'moderate' : 'minor') + '">' + (d.contested ? 'contested' : 'unvalidated') + '</span>' +
        '<span class="v-text"><b>' + d.name + '</b> — ' +
          (d.contested ? 'public sources point in different directions; needs stakeholder validation.'
                       : 'drawn from limited public material; not yet corroborated from inside.') +
        '</span></div>';
    }).join('') : '<div class="vrow"><span class="v-text">Every dimension is now stakeholder-validated. Nothing here rests on an outside guess.</span></div>';

    // contradiction
    renderContra(s);
  }

  function renderContra(s) {
    if (MODE === 'live') {
      var cs = profile.contradictions;
      if (!cs.length) { el('contra').style.display = 'none'; return; }
      el('contra').style.display = '';
      var c = cs[0];
      el('contra').innerHTML =
        '<div class="ct-head">Possible tension · ' + esc(c.severity) + ' · to validate</div>' +
        '<div class="ct-pair">' +
          '<div class="ct-side"><div class="cs-k">Company claim</div><div class="cs-v">' + esc(c.claim) + '</div></div>' +
          '<div class="ct-side"><div class="cs-k">Counter-signal</div><div class="cs-v">' + esc(c.counter_signal) + '</div></div>' +
        '</div>' +
        '<div class="ct-read">' + esc(c.interpretation) + '</div>';
      return;
    }
    el('contra').style.display = '';
    if (s >= 4) {
      el('contra').innerHTML =
        '<div class="ct-head">Tension · largely resolved (minor)</div>' +
        '<div class="ct-read">Validation reconciled the autonomy / pressure tension: ownership is genuine but bounded by clear guardrails, and the intensity concentrates in launch windows rather than running constantly. Both readings were true at once.</div>';
    } else {
      el('contra').innerHTML =
        '<div class="ct-head">Possible tension · moderate · to validate</div>' +
        '<div class="ct-pair">' +
          '<div class="ct-side"><div class="cs-k">Company claim</div><div class="cs-v">"Take ownership — you run your own roadmap."</div></div>' +
          '<div class="ct-side"><div class="cs-k">Counter-signal (observed)</div><div class="cs-v">"Long hours around every launch; priorities shift fast."</div></div>' +
        '</div>' +
        '<div class="ct-read">The company presents ownership and autonomy, while observed signals point to intensity and pressure. Both can be true at once — but the gap is worth validating, not judging.</div>';
    }
  }

  function companySwitcher() {
    return '<select id="co-switch" style="background:var(--gr-3);color:var(--freq);border:1px solid var(--freq-3);border-radius:2px;font-family:var(--mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;padding:3px 6px;cursor:pointer">' +
      live.map(function (l) {
        var sel = (selected && l.name === selected.name) ? ' selected' : '';
        return '<option value="' + (l.slug || l.name) + '"' + sel + '>' + esc(l.name) + '</option>';
      }).join('') + '</select>';
  }

  function li(t) { return '<li>' + t + '</li>'; }
  function esc(s) { return String(s == null ? '' : s).replace(/&(?!#?\w+;)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function hasLevel(dims, name, rx) { var d = dims.filter(function (x) { return x.name === name; })[0]; return d && rx.test(String(d.level).toLowerCase()); }

  function thrive(dims, s) {
    var out = [];
    if (hasLevel(dims, 'Execution Style', /speed|fast/)) out.push('People energised by pace, shipping, and fast decisions.');
    if (hasLevel(dims, 'Autonomy Level', /high|autonom|ownership/)) out.push('People who want ownership and room to make their own calls.');
    if (hasLevel(dims, 'Growth Orientation', /expansion|growth|scal/)) out.push('People who enjoy building amid expansion and ambiguity.');
    if (hasLevel(dims, 'Innovation Orientation', /innovat|forward|pioneer/)) out.push('People drawn to experimentation and new product directions.');
    if (!out.length) out.push('Difficult to say from current signals — this needs validation.');
    if (MODE === 'demo' && s < 4) out.push('<em style="color:var(--ink-4)">…these readings firm up as the profile is validated.</em>');
    return out;
  }
  function struggle(dims) {
    var out = [];
    if (hasLevel(dims, 'Pressure Environment', /intens|high|pressure|crunch/)) out.push('People who need a predictable, low-pressure rhythm — intensity spikes around launches.');
    if (hasLevel(dims, 'Stability vs. Chaos', /fluid|chang|chaos/)) out.push('People who prefer stable structure and fixed priorities over constant change.');
    if (hasLevel(dims, 'Autonomy Level', /high|autonom|ownership/)) out.push('People who want detailed direction rather than open-ended ownership.');
    if (!out.length) out.push('Difficult to say from current signals — this needs validation.');
    return out;
  }

  /* =============================================================
     EVENTS
     ============================================================= */
  function setStage(n) { stage = Math.max(0, Math.min(4, n)); writeStage(stage); render(); }
  document.addEventListener('click', function (e) {
    if (MODE !== 'demo') return;
    var cell = e.target.closest('.stage-cell');
    if (cell) { setStage(parseInt(cell.getAttribute('data-stage'), 10)); return; }
    if (e.target.closest('#advance') && stage < 4) setStage(stage + 1);
  });
  document.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'co-switch') {
      var v = e.target.value;
      var match = live.filter(function (l) { return (l.slug || l.name) === v; })[0];
      if (match) { selected = match; profile = liveProfile(match.estimate, store); render(); }
    }
  });

  render();
})();
