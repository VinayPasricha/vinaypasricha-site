/* =============================================================
   Organizational Frequency — Frequency Spine Consolidation
   (Build X1 · the canonical frequency basis + translation layer)
   =============================================================
   Architecture Review 1.0 found the system's worst structural
   crack: TWO frequency vocabularies that don't agree.

     • 3B / 3C measure 12 dimensions (leadership_style,
       decision_making, communication_culture, execution_style,
       pressure_environment, autonomy_level, collaboration_style,
       talent_philosophy, growth_orientation, stability_vs_chaos,
       innovation_orientation, employee_flourishing).
     • 3D / 3E / 3F use a DIFFERENT 10 (leadership, execution,
       innovation, autonomy, communication, collaboration,
       adaptability, learning, risk_tolerance, growth_orientation).

   So "Current Frequency → Mission Frequency → Gap" was partly
   comparing apples to oranges, and three dimensions the mission
   layer reasons about (adaptability, learning, risk_tolerance)
   were NEVER measured upstream.

   X1 fixes this WITHOUT rewriting the working layers. It defines:
     1. ONE canonical frequency basis (15 dimensions, 6 families),
        each with a definition, a named positive pole, and an
        evolution cadence (how fast it can plausibly shift).
     2. A crosswalk: both legacy vocabularies → canonical.
     3. normalizeLevel(): collapses the layers' many descriptive
        level strings ('high-intensity', 'directed', 'founder-led'
        …) onto one ordinal posture scale.
     4. Derivation rules: dimensions one layer never measures are
        DERIVED from related ones — and explicitly marked derived
        with reduced confidence (never silently invented). This is
        the hook X2 (Confidence & Provenance) will formalize.
     5. Dimension relationships (reinforces / tensions).
     6. canonicalGap(): a true apples-to-apples gap, computed in
        canonical space, only where the mission actually specifies
        a posture.

   The other rooms can TRANSLATE THROUGH this spine; it is the
   single source of truth for what a frequency dimension IS.

   Augments window.OF with window.OF.spine.
   Depends on: of-model.js. Reads (optionally) 3C + 3D data to
   demonstrate a live canonical-space gap. Writes nothing upstream.
   ============================================================= */
(function () {
  'use strict';
  if (!window.OF) { console.warn('of-frequency-spine.js requires of-model.js'); return; }
  var OF = window.OF;

  /* ===== ordinal posture scale — the one shared axis ===== */
  var SCALE = ['unknown', 'very_low', 'low', 'medium', 'high', 'very_high'];
  var SPECIAL = ['contested'];   // genuine stakeholder disagreement — not a point on the scale
  function ord(level) { var i = SCALE.indexOf(level); return i; }            // unknown=0 … very_high=5
  function levelFromOrd(o) { return SCALE[Math.max(1, Math.min(5, Math.round(o)))]; }

  /* ===== canonical families ===== */
  var FAMILIES = {
    direction: { label: 'Direction', note: 'How the organization is steered.' },
    voice: { label: 'Autonomy & Voice', note: 'Where authority and information sit.' },
    delivery: { label: 'Delivery', note: 'How work actually gets done, and at what cost.' },
    change: { label: 'Change', note: 'How the organization meets the new.' },
    trajectory: { label: 'Trajectory', note: 'Where the organization is heading and how steadily.' },
    people: { label: 'People', note: 'How the organization treats and develops its people.' }
  };

  /* ===== THE CANONICAL FREQUENCY BASIS — 15 dimensions =====
     pole  = the named "high" end (direction of "more")
     cadence = how fast this dimension can plausibly move
               (informs X1 evolution rules + 3E pacing)
     measurable = can public/stakeholder evidence observe it directly? */
  var CANON = [
    { id: 'leadership', family: 'direction', label: 'Leadership', pole: 'visible, directive sponsorship',
      def: 'How clearly direction is set and owned at the top.', cadence: 'slow', measurable: true },
    { id: 'decision_making', family: 'direction', label: 'Decision-Making', pole: 'distributed / decentralized',
      def: 'Where decisions are made — pushed to the work, or held at the centre.', cadence: 'medium', measurable: true },

    { id: 'autonomy', family: 'voice', label: 'Autonomy', pole: 'high individual / team latitude',
      def: 'How much people can decide and act without sign-off.', cadence: 'medium', measurable: true },
    { id: 'communication', family: 'voice', label: 'Communication', pole: 'open, high-bandwidth',
      def: 'How openly and freely information and feedback move.', cadence: 'fast', measurable: true },
    { id: 'collaboration', family: 'voice', label: 'Collaboration', pole: 'strongly cross-functional',
      def: 'How well work crosses team and function boundaries.', cadence: 'medium', measurable: true },

    { id: 'execution', family: 'delivery', label: 'Execution', pole: 'high delivery discipline & tempo',
      def: 'The rhythm and reliability with which the org ships.', cadence: 'fast', measurable: true },
    { id: 'pressure', family: 'delivery', label: 'Pressure', pole: 'high intensity',
      def: 'The intensity of the operating environment — and its sustainability.', cadence: 'fast', measurable: true },
    { id: 'adaptability', family: 'delivery', label: 'Adaptability', pole: 'changes course readily',
      def: 'How well the org absorbs change and re-plans.', cadence: 'medium', measurable: false },

    { id: 'innovation', family: 'change', label: 'Innovation', pole: 'strongly innovation-forward',
      def: 'Orientation toward new ideas and experimentation.', cadence: 'medium', measurable: true },
    { id: 'risk_tolerance', family: 'change', label: 'Risk Tolerance', pole: 'high appetite for bets',
      def: 'Willingness to take and absorb intelligent failure.', cadence: 'medium', measurable: false },
    { id: 'learning', family: 'change', label: 'Learning', pole: 'fast, structured learning',
      def: 'How deliberately the org builds and shares capability.', cadence: 'medium', measurable: false },

    { id: 'growth_orientation', family: 'trajectory', label: 'Growth Orientation', pole: 'active expansion posture',
      def: 'How strongly the org is oriented to growth and expansion.', cadence: 'medium', measurable: true },
    { id: 'stability', family: 'trajectory', label: 'Stability', pole: 'established & predictable',
      def: 'Whether the environment is settled or fluid and shifting.', cadence: 'slow', measurable: true },

    { id: 'talent_philosophy', family: 'people', label: 'Talent Philosophy', pole: 'deliberate capacity-building',
      def: 'What the org optimizes for in how it values and develops talent.', cadence: 'slow', measurable: true },
    { id: 'employee_flourishing', family: 'people', label: 'Employee Flourishing', pole: 'supported, sustainable experience',
      def: 'The lived day-to-day experience of working there.', cadence: 'slow', measurable: true }
  ];
  var CANON_IDS = CANON.map(function (c) { return c.id; });
  var CANON_BY = {}; CANON.forEach(function (c) { CANON_BY[c.id] = c; });
  function dimDef(id) { return CANON_BY[id] || null; }
  function label(id) { return (CANON_BY[id] && CANON_BY[id].label) || (OF.missiongap && OF.missiongap.DIM_LABELS[id]) || id; }

  /* ===== VOCAB CROSSWALK ===== */
  // 3B / 3C — 12 dimensions → canonical (all direct 1:1)
  var VOCAB_12 = {
    leadership_style: 'leadership',
    decision_making: 'decision_making',
    communication_culture: 'communication',
    execution_style: 'execution',
    pressure_environment: 'pressure',
    autonomy_level: 'autonomy',
    collaboration_style: 'collaboration',
    talent_philosophy: 'talent_philosophy',
    growth_orientation: 'growth_orientation',
    stability_vs_chaos: 'stability',
    innovation_orientation: 'innovation',
    employee_flourishing: 'employee_flourishing'
  };
  // 3D / 3E / 3F — 10 dimensions → canonical (7 direct; 3 with no direct upstream measure)
  var VOCAB_10 = {
    leadership: 'leadership',
    execution: 'execution',
    innovation: 'innovation',
    autonomy: 'autonomy',
    communication: 'communication',
    collaboration: 'collaboration',
    adaptability: 'adaptability',
    learning: 'learning',
    risk_tolerance: 'risk_tolerance',
    growth_orientation: 'growth_orientation'
  };

  /* canonical dims each vocabulary can MEASURE directly */
  function measuredBy(vocab) { return Object.keys(vocab).map(function (k) { return vocab[k]; }); }
  var MEASURED_12 = measuredBy(VOCAB_12);   // 12 canon dims
  var MEASURED_10 = measuredBy(VOCAB_10);   // 10 canon dims
  // dims NO vocabulary measures directly → must be DERIVED when needed
  var DERIVED_ONLY = CANON_IDS.filter(function (id) { return MEASURED_12.indexOf(id) === -1; });
  // = adaptability, learning, risk_tolerance  (the review's finding, made explicit)

  /* ===== DERIVATION RULES =====
     For a canonical dim a given profile never measured, derive it from
     related measured dims. Output is explicitly flagged derived with a
     confidence penalty (one notch down, floored at 'low'). These are
     plausible bridges, never silent inventions. */
  var DERIVATION = {
    adaptability: { from: ['stability', 'execution'], invert: ['stability'],
      note: 'Derived: organizations read as fast-changing/fluid (low stability) with strong execution tend to show higher adaptability. A bridge, not a measurement.' },
    risk_tolerance: { from: ['innovation', 'autonomy'],
      note: 'Derived: innovation-forward, high-autonomy environments tend to tolerate more risk. A bridge, not a measurement.' },
    learning: { from: ['talent_philosophy', 'innovation'],
      note: 'Derived: deliberate capacity-building plus innovation orientation tends to indicate stronger learning. A bridge, not a measurement.' }
  };

  /* ===== LEVEL NORMALIZATION =====
     Collapse every descriptive level string the layers emit onto the
     shared ordinal posture scale, per dimension where the wording is
     directional (e.g. 'directed' is LOW autonomy but the same word
     means nothing for innovation). */
  var GENERIC = {
    very_high: ['very high', 'very_high'],
    high: ['high', 'high-intensity', 'speed-led', 'high-autonomy', 'innovation-forward', 'expansion-mode', 'open & direct', 'visible & directive', 'collaborative', 'fluid & changing', 'supported', 'distributed', 'decentralized'],
    medium: ['medium', 'measured', 'process-led', 'capacity-building', 'established', 'mixed'],
    low: ['low', 'directed', 'founder-led', 'central', 'centralized', 'strained', 'process'],
    very_low: ['very low', 'very_low', 'none'],
    unknown: ['unknown', 'unclear', 'unclear from public signals', '', 'n/a', '—'],
    contested: ['contested']
  };
  // per-dimension overrides where a generic word flips meaning
  var DIM_LEVELS = {
    decision_making: { high: ['distributed', 'decentralized'], low: ['founder-led', 'central', 'centralized', 'top-down'] },
    autonomy: { high: ['high-autonomy', 'high', 'empowered'], low: ['directed', 'low', 'centralized'] },
    stability: { high: ['established', 'mature', 'stable', 'predictable'], low: ['fluid & changing', 'chaos', 'startup', 'low'] },
    pressure: { high: ['high-intensity', 'high', 'intense'], low: ['measured', 'sustainable', 'low', 'calm'] },
    employee_flourishing: { high: ['supported', 'high'], low: ['strained', 'low'] }
  };
  function normalizeLevel(canonId, raw) {
    var r = String(raw == null ? '' : raw).toLowerCase().trim();
    if (!r) return 'unknown';
    if (r === 'contested') return 'contested';
    var dimMap = DIM_LEVELS[canonId];
    if (dimMap) {
      for (var k in dimMap) { if (dimMap[k].indexOf(r) !== -1) return k; }
    }
    for (var g in GENERIC) { if (GENERIC[g].indexOf(r) !== -1) return g; }
    // numeric-ish fallbacks
    if (/high/.test(r)) return 'high';
    if (/med/.test(r)) return 'medium';
    if (/low|weak|poor/.test(r)) return 'low';
    return 'unknown';
  }

  /* ===== TRANSLATION ===== */
  function vocabMap(vocab) { return vocab === 'v12' ? VOCAB_12 : vocab === 'v10' ? VOCAB_10 : null; }
  function toCanon(dim, vocab) { var m = vocabMap(vocab); return m ? (m[dim] || null) : (CANON_BY[dim] ? dim : null); }
  function fromCanon(canonId, vocab) {
    var m = vocabMap(vocab); if (!m) return canonId;
    var hit = null; Object.keys(m).forEach(function (k) { if (m[k] === canonId) hit = k; });
    return hit;
  }

  /* Translate a {dim: {level, confidence}} profile (in a given vocab) into a
     canonical profile {canonId: {level(ordinal posture), confidence, source, raw}}.
     Dims the vocab can't measure are DERIVED (flagged) when deriveMissing=true. */
  function toCanonicalProfile(profileDims, vocab, opts) {
    opts = opts || {};
    var out = {};
    var m = vocabMap(vocab) || {};
    // direct mappings
    Object.keys(profileDims || {}).forEach(function (dim) {
      var canonId = m[dim] || (CANON_BY[dim] ? dim : null);
      if (!canonId) return;
      var pd = profileDims[dim] || {};
      out[canonId] = {
        level: normalizeLevel(canonId, pd.level),
        confidence: pd.confidence || 'low',
        source: 'measured',
        via: dim,
        raw: pd.level
      };
    });
    // derive missing canonical dims if asked
    if (opts.deriveMissing) {
      CANON_IDS.forEach(function (canonId) {
        if (out[canonId]) return;
        var rule = DERIVATION[canonId];
        if (!rule) return;
        var parts = rule.from.map(function (src) {
          var v = out[src];
          if (!v || v.level === 'unknown' || v.level === 'contested') return null;
          var o = ord(v.level);
          if ((rule.invert || []).indexOf(src) !== -1) o = 6 - o; // invert on the 1..5 scale
          return o;
        }).filter(function (x) { return x != null; });
        if (!parts.length) {
          out[canonId] = { level: 'unknown', confidence: 'very_low', source: 'underivable', via: rule.from.join('+'), raw: null };
          return;
        }
        var avg = parts.reduce(function (a, b) { return a + b; }, 0) / parts.length;
        out[canonId] = {
          level: levelFromOrd(avg),
          confidence: penalize(minConf(rule.from, out)),
          source: 'derived',
          via: rule.from.join(' + ') + (rule.invert ? ' (inverting ' + rule.invert.join(',') + ')' : ''),
          raw: null
        };
      });
    }
    return out;
  }
  function minConf(srcDims, out) {
    var order = ['very_low', 'low', 'medium', 'high', 'very_high'];
    var lo = 'high';
    srcDims.forEach(function (s) { var c = (out[s] && out[s].confidence) || 'low'; if (order.indexOf(c) < order.indexOf(lo)) lo = c; });
    return lo;
  }
  function penalize(conf) {
    var order = ['very_low', 'low', 'medium', 'high', 'very_high'];
    var i = order.indexOf(conf); if (i < 0) i = 1;
    return order[Math.max(0, i - 1)];   // one notch down — derived is never as strong as measured
  }

  /* ===== RELATIONSHIPS ===== */
  var RELATIONSHIPS = [
    { a: 'autonomy', b: 'innovation', kind: 'reinforces', note: 'Latitude to act frequently accompanies more experimentation.' },
    { a: 'decision_making', b: 'autonomy', kind: 'reinforces', note: 'Distributed decisions and individual autonomy tend to move together.' },
    { a: 'innovation', b: 'risk_tolerance', kind: 'reinforces', note: 'Innovation-forward cultures tend to tolerate more failure.' },
    { a: 'learning', b: 'adaptability', kind: 'reinforces', note: 'Faster learning tends to accompany readier course-correction.' },
    { a: 'communication', b: 'collaboration', kind: 'reinforces', note: 'Open information flow tends to accompany cross-functional work.' },
    { a: 'execution', b: 'growth_orientation', kind: 'reinforces', note: 'Delivery discipline tends to accompany sustained expansion.' },
    { a: 'pressure', b: 'employee_flourishing', kind: 'tensions', note: 'High intensity often sits in tension with sustainable experience.' },
    { a: 'stability', b: 'adaptability', kind: 'tensions', note: 'Settled environments can resist ready change.' },
    { a: 'leadership', b: 'autonomy', kind: 'tensions', note: 'Strongly directive leadership can sit in tension with high autonomy — though not always.' }
  ];

  /* ===== EVOLUTION RULES (cadence) ===== */
  function cadence(canonId) { return (CANON_BY[canonId] && CANON_BY[canonId].cadence) || 'medium'; }
  var CADENCE_NOTE = {
    fast: 'Can shift within weeks — observable quickly.',
    medium: 'Shifts over quarters — needs sustained change to move.',
    slow: 'Shifts over years — deep, structural; treat sudden swings with suspicion.'
  };

  /* ===== APPLES-TO-APPLES GAP =====
     Both current (12-vocab) and mission (10-vocab) are translated into
     canonical space; a gap is computed ONLY where the mission specifies
     a posture. This is the fix for the cross-vocabulary comparison. */
  function canonicalGap(currentDims, currentVocab, missionDims, missionVocab) {
    var cur = toCanonicalProfile(currentDims, currentVocab, { deriveMissing: true });
    var mis = toCanonicalProfile(missionDims, missionVocab, { deriveMissing: false });
    var rows = [];
    CANON_IDS.forEach(function (id) {
      var req = mis[id];
      if (!req || req.level === 'unknown') return;   // mission specifies nothing here
      var c = cur[id] || { level: 'unknown', confidence: 'very_low', source: 'absent' };
      var sev, gapLabel, diff = null;
      if (c.level === 'unknown') { sev = 'major'; gapLabel = 'unknown → ' + req.level; }
      else if (c.level === 'contested') { sev = ord(req.level) >= 4 ? 'major' : 'moderate'; gapLabel = 'contested → ' + req.level; }
      else {
        diff = ord(req.level) - ord(c.level);
        if (diff <= 0) { sev = 'aligned'; gapLabel = 'aligned'; }
        else if (diff === 1) { sev = 'moderate'; gapLabel = c.level + ' → ' + req.level; }
        else if (diff === 2) { sev = 'major'; gapLabel = c.level + ' → ' + req.level + ' (+2)'; }
        else { sev = 'critical'; gapLabel = c.level + ' → ' + req.level + ' (+' + diff + ')'; }
      }
      rows.push({
        dimension: id, label: label(id),
        current: c.level, current_source: c.source, current_confidence: c.confidence,
        required: req.level, severity: sev, gap_label: gapLabel, diff: diff
      });
    });
    var order = { aligned: 0, moderate: 1, major: 2, critical: 3 };
    rows.sort(function (a, b) { return order[b.severity] - order[a.severity]; });
    return { current_canonical: cur, mission_canonical: mis, rows: rows };
  }

  /* ===== LIVE DATA BRIDGE — pull a real 3C profile + 3D mission if present ===== */
  function liveExample(store) {
    store = OF.load();
    var prof = (store.val_profiles || []).slice(-1)[0] || null;
    var mission = null, mf = null;
    if (OF.missiongap && (store.mission_profiles || []).length) {
      var m = (store.mission_profiles || []).slice(-1)[0];
      var full = OF.missiongap.getMission(m.mission_id, store);
      if (full && full.mission_frequency) { mission = full.mission; mf = full.mission_frequency; }
    }
    if (!prof || !mf) return null;
    // 3C validated profile dims are the 12-vocab; 3D mission_frequency dims are the 10-vocab
    var curDims = {}; Object.keys(prof.dimensions || {}).forEach(function (d) { curDims[d] = { level: prof.dimensions[d].level, confidence: prof.dimensions[d].confidence }; });
    var misDims = {}; Object.keys(mf.dimensions || {}).forEach(function (d) { misDims[d] = { level: mf.dimensions[d].level, confidence: mf.confidence }; });
    return {
      company: prof.company_name, mission_title: mission.title,
      gap: canonicalGap(curDims, 'v12', misDims, 'v10')
    };
  }

  /* ===== STATS ===== */
  function stats() {
    return {
      canonical: CANON.length,
      families: Object.keys(FAMILIES).length,
      v12: Object.keys(VOCAB_12).length,
      v10: Object.keys(VOCAB_10).length,
      derived_only: DERIVED_ONLY.length,
      relationships: RELATIONSHIPS.length
    };
  }

  OF.spine = {
    SCALE: SCALE, SPECIAL: SPECIAL, FAMILIES: FAMILIES, CANON: CANON, CANON_IDS: CANON_IDS,
    VOCAB_12: VOCAB_12, VOCAB_10: VOCAB_10, MEASURED_12: MEASURED_12, MEASURED_10: MEASURED_10,
    DERIVED_ONLY: DERIVED_ONLY, DERIVATION: DERIVATION, RELATIONSHIPS: RELATIONSHIPS,
    CADENCE_NOTE: CADENCE_NOTE,
    ord: ord, levelFromOrd: levelFromOrd, dimDef: dimDef, label: label, cadence: cadence,
    normalizeLevel: normalizeLevel, toCanon: toCanon, fromCanon: fromCanon,
    toCanonicalProfile: toCanonicalProfile, canonicalGap: canonicalGap,
    liveExample: liveExample, stats: stats
  };
})();
