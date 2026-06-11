/* =============================================================
   Organizational Frequency — Frequency Layer  (Build 1D)
   =============================================================
   Builds on 1A (Spine) + 1B (Research) + 1C (Validation) WITHOUT
   changing the architecture.

   The central equation of Organizational Frequency:

       Mission
         ↓  derives
       Required Frequency        (from the MISSION only)
         ↓
       Current Frequency         (from VALIDATED UNDERSTANDING only)
         ↓
       Frequency Gap             (required vs current, per dimension)
         ↓
       Intervention Hypotheses   (hypotheses, never actions)

   Constitutional rules enforced here:
     • Required Frequency is derived from the mission — NOT the
       organization, NOT research, NOT current frequency.
     • Current Frequency is derived ONLY from validated
       understanding — never from research hypotheses or raw
       evidence. No validation → dimension is 'unknown'.
     • NO single score. No percentages. No "72% fit." Gaps are
       per-dimension and explainable.
     • Essence / Transformations / Person models are NOT touched.
       Only frequency-related evidence is stored.

   Augments window.OF with window.OF.frequency.
   ============================================================= */
(function () {
  'use strict';
  if (!window.OF) { console.warn('of-frequency.js requires of-model.js'); return; }
  var OF = window.OF;

  var DIMENSIONS = (OF.research && OF.research.DIMENSIONS) || [
    'Pace', 'Execution Discipline', 'Communication Style', 'Pressure Tolerance',
    'Leadership Style', 'Autonomy Level', 'Innovation Requirement',
    'Process Maturity', 'Trust / Goodness Layer', 'People Development Orientation'
  ];

  // Qualitative ordinal scale — NOT a number the user ever sees as a score.
  var LEVELS = ['low', 'moderate', 'high', 'very_high'];
  var GAP_LEVELS = ['none', 'minor', 'moderate', 'major', 'unknown'];
  var INTERVENTION_TYPES = ['hiring', 'leadership', 'training', 'process', 'communication', 'role_design', 'structure', 'research', 'unknown'];

  function nowISO() { return new Date().toISOString(); }
  function uid(p) { return OF.uid(p); }
  function round(n) { return Math.round(n * 100) / 100; }
  function levelIndex(l) { var i = LEVELS.indexOf(l); return i === -1 ? null : i; }

  function ensure(store) {
    store.required_frequencies = store.required_frequencies || [];
    store.current_frequencies = store.current_frequencies || [];
    store.frequency_gaps = store.frequency_gaps || [];
    store.intervention_hypotheses = store.intervention_hypotheses || [];
    store.frequency_promotion_log = store.frequency_promotion_log || [];
    store.seeds = store.seeds || [];
    return store;
  }

  /* ========================================================== */
  /* SCHEMAS                                                     */
  /* ========================================================== */
  function newRequiredFrequency(f) {
    f = f || {};
    return {
      required_frequency_id: f.required_frequency_id || uid('rf'),
      mission_id: f.mission_id || null,
      required_summary: f.required_summary || '',
      required_dimensions: f.required_dimensions || [], // [{dimension, required_level, confidence, reasoning}]
      confidence: typeof f.confidence === 'number' ? round(f.confidence) : 0,
      reasoning: f.reasoning || '',
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }
  function newCurrentFrequency(f) {
    f = f || {};
    return {
      current_frequency_id: f.current_frequency_id || uid('cf'),
      organization_id: f.organization_id || null,
      current_summary: f.current_summary || '',
      current_dimensions: f.current_dimensions || [], // [{dimension, current_level, confidence, supporting_understanding_ids[]}]
      confidence: typeof f.confidence === 'number' ? round(f.confidence) : 0,
      supporting_validations: f.supporting_validations || [],
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }
  function newFrequencyGap(f) {
    f = f || {};
    return {
      gap_id: f.gap_id || uid('gap'),
      organization_id: f.organization_id || null,
      mission_id: f.mission_id || null,
      gap_summary: f.gap_summary || '',
      dimension_gaps: f.dimension_gaps || [], // [{dimension, current_level, required_level, gap_level, confidence, evidence}]
      confidence: typeof f.confidence === 'number' ? round(f.confidence) : 0,
      recommended_next_research: f.recommended_next_research || '',
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }
  function newIntervention(f) {
    f = f || {};
    return {
      intervention_id: f.intervention_id || uid('int'),
      gap_id: f.gap_id || null,
      dimension: f.dimension || null,
      intervention_type: INTERVENTION_TYPES.indexOf(f.intervention_type) !== -1 ? f.intervention_type : 'unknown',
      rationale: f.rationale || '',
      confidence: typeof f.confidence === 'number' ? round(f.confidence) : 0,
      created_at: f.created_at || nowISO()
    };
  }

  /* ========================================================== */
  /* RECOMPUTE — the one entry point                            */
  /* ==========================================================
     Rebuilds the whole frequency layer for an org+mission from
     current store state. Required is mission-derived; Current is
     understanding-derived; Gap is the comparison; Interventions
     are hypotheses off the gap. Supersedes any prior layer.
  */
  function recompute(orgId, missionId, store) {
    store = ensure(store || OF.load());
    var org = byId(store.organizations, 'organization_id', orgId);
    var mis = byId(store.missions, 'mission_id', missionId) ||
              store.missions.filter(function (m) { return m.organization_id === orgId; })[0];
    if (!org || !mis) return null;

    var understandings = (store.validated_understandings || []).filter(function (u) { return u.organization_id === orgId; });

    // Keep the required_frequency_id STABLE across recomputes so the
    // 1E required validations stay linked to it.
    var prevReq = store.required_frequencies.filter(function (x) { return x.mission_id === mis.mission_id; })[0];
    var required = buildRequired(mis, prevReq ? prevReq.required_frequency_id : null);
    var current = buildCurrent(org, understandings);
    var gap = buildGap(org, mis, required, current);
    var interventions = buildInterventions(gap, mis);

    // supersede prior layer for this org/mission
    var oldGapIds = {};
    store.frequency_gaps.forEach(function (x) {
      if (x.mission_id === mis.mission_id || x.organization_id === orgId) oldGapIds[x.gap_id] = true;
    });
    store.required_frequencies = store.required_frequencies.filter(function (x) { return x.mission_id !== mis.mission_id; });
    store.current_frequencies = store.current_frequencies.filter(function (x) { return x.organization_id !== orgId; });
    store.frequency_gaps = store.frequency_gaps.filter(function (x) { return x.mission_id !== mis.mission_id && x.organization_id !== orgId; });
    store.intervention_hypotheses = store.intervention_hypotheses.filter(function (x) { return !oldGapIds[x.gap_id]; });

    store.required_frequencies.push(required);
    store.current_frequencies.push(current);
    store.frequency_gaps.push(gap);
    interventions.forEach(function (iv) { store.intervention_hypotheses.push(iv); });

    // 1E — put the top required dimensions into the Required
    // Validation Queue (idempotent; clears untested, keeps answered).
    if (window.OF.requiredValidation && window.OF.requiredValidation.enqueueRequired) {
      window.OF.requiredValidation.enqueueRequired(store, { required: required, mission: mis });
    }

    // 1E — FREQUENCY PROMOTION: the first earned write. Only
    // VALIDATED current dimensions update the org's living frequency.
    promoteFrequency(store, org, current);

    // frequency-related evidence ONLY (memory stays gated)
    var seed = OF.seam.makeSeed('evidence', 'organization', orgId, {
      summary: 'Frequency layer computed: ' + gap.gap_summary,
      source: 'system_inference', confidence: gap.confidence, linked_attribute: 'frequency_gap'
    });
    seed.origin = 'frequency';
    store.seeds.push(seed);

    OF.save(store);
    return { required: required, current: current, gap: gap, interventions: interventions, store: store };
  }

  /* ---- REQUIRED: from the MISSION only ---------------------- */
  function buildRequired(mis, fixedId) {
    var type = mis.mission_type || 'unknown';
    var stage = mis.mission_stage || 'emerging';
    var hiring = mis.hiring_relevance || 'possible';
    var expansionish = /expansion|new_geography|new_office/.test(type);
    var buildish = /technology|new_product/.test(type);
    var gtm = /sales/.test(type);
    var opsish = /operations|customer_support/.test(type);
    var fund = /fundraising/.test(type);
    var change = /culture|transformation/.test(type);
    var urgent = stage === 'urgent' || stage === 'blocked';

    function dim(name, level, conf, reason) { return { dimension: name, required_level: level, confidence: round(conf), reasoning: reason }; }
    var basis = 'Required by the mission (type: ' + type + ', stage: ' + stage + '), not by what the organization is today.';

    var dims = [
      dim('Pace', (expansionish || buildish || gtm || urgent) ? 'high' : 'moderate', 0.45,
        (expansionish ? 'Expansion compresses timelines' : buildish ? 'Shipping new capability needs cadence' : urgent ? 'The stage is time-pressured' : 'No strong pace demand') + '. ' + basis),
      dim('Execution Discipline', (expansionish || buildish || opsish) ? 'high' : 'moderate', 0.45,
        (opsish ? 'Operational missions live or die on discipline' : expansionish ? 'Scaling without discipline distorts output' : 'Moderate discipline demand') + '. ' + basis),
      dim('Communication Style', expansionish ? 'high' : 'moderate', 0.4,
        (expansionish ? 'Cross-site / cross-function coordination raises the communication bar' : 'Moderate communication demand') + '. ' + basis),
      dim('Pressure Tolerance', (urgent || fund) ? 'high' : 'moderate', 0.4,
        (fund ? 'Fundraising is high-pressure' : urgent ? 'Urgent stage' : 'Ordinary pressure') + '. ' + basis),
      dim('Leadership Style', expansionish ? 'high' : (change ? 'high' : 'moderate'), 0.5,
        (expansionish ? 'Geographic / scale growth requires leadership depth beyond the founder' : change ? 'Change demands distributed leadership' : 'Moderate leadership-depth demand') + '. ' + basis),
      dim('Autonomy Level', (buildish || expansionish) ? 'high' : 'moderate', 0.4,
        (buildish ? 'Specialist teams need real ownership' : expansionish ? 'Distance forces autonomy' : 'Moderate autonomy demand') + '. ' + basis),
      dim('Innovation Requirement', buildish ? 'very_high' : (change ? 'high' : 'moderate'), 0.5,
        (buildish ? 'The mission is to build new capability' : change ? 'Transformation needs invention' : 'Moderate innovation demand') + '. ' + basis),
      dim('Process Maturity', (expansionish || opsish) ? 'high' : 'moderate', 0.45,
        (opsish ? 'Operations missions require mature process' : expansionish ? 'Scale exposes immature process' : 'Moderate process demand') + '. ' + basis),
      dim('Trust / Goodness Layer', (hiring === 'central' || hiring === 'likely') ? 'high' : 'moderate', 0.35,
        (hiring === 'central' ? 'Building a team rests on a strong trust layer' : 'Baseline trust demand') + '. ' + basis),
      dim('People Development Orientation', hiring === 'central' ? 'very_high' : (hiring === 'likely' ? 'high' : 'moderate'), 0.5,
        (hiring === 'central' ? 'Talent is central to the mission' : hiring === 'likely' ? 'Talent is a likely lever' : 'Moderate people-development demand') + '. ' + basis)
    ];
    var conf = round(avg(dims.map(function (d) { return d.confidence; })));
    var topHi = dims.filter(function (d) { return d.required_level === 'high' || d.required_level === 'very_high'; })
      .map(function (d) { return d.dimension.toLowerCase(); }).slice(0, 4);
    return newRequiredFrequency({
      required_frequency_id: fixedId || undefined,
      mission_id: mis.mission_id,
      required_dimensions: dims,
      confidence: conf,
      required_summary: 'To execute "' + (mis.mission_name || mis.desired_outcome || 'this mission') + '", the organization most needs strength in ' + (topHi.join(', ') || 'several dimensions') + '.',
      reasoning: 'Derived from the mission alone — the kind of organization the mission would require to succeed, independent of what this organization currently is.'
    });
  }

  /* ---- CURRENT: from VALIDATED UNDERSTANDING only ----------- */
  function buildCurrent(org, understandings) {
    var byDim = {};
    understandings.forEach(function (u) {
      var dimName = matchDimension(u.statement);
      if (dimName) {
        if (!byDim[dimName]) byDim[dimName] = [];
        byDim[dimName].push(u);
      }
    });

    var dims = DIMENSIONS.map(function (name) {
      var us = byDim[name] || [];
      if (!us.length) {
        return { dimension: name, current_level: 'unknown', confidence: 0.1, supporting_understanding_ids: [] };
      }
      // strongest-confidence understanding wins the read
      us.sort(function (a, b) { return b.confidence - a.confidence; });
      var lvl = estimateToLevel(name, us[0].statement);
      return {
        dimension: name,
        current_level: lvl,
        confidence: round(Math.min(0.9, us[0].confidence)),
        supporting_understanding_ids: us.map(function (u) { return u.understanding_id; })
      };
    });

    var known = dims.filter(function (d) { return d.current_level !== 'unknown'; });
    var conf = known.length ? round(avg(known.map(function (d) { return d.confidence; })) * Math.min(1, known.length / 4)) : 0.05;
    var summary = known.length
      ? 'From validated understanding only, ' + (org.organization_name || 'the organization') + ' currently reads as: ' +
        known.slice(0, 4).map(function (d) { return d.dimension.toLowerCase() + ' ' + human(d.current_level); }).join('; ') +
        '. ' + (DIMENSIONS.length - known.length) + ' of ' + DIMENSIONS.length + ' dimensions remain unknown (not yet validated).'
      : 'No validated understanding yet maps to a frequency dimension — current frequency is almost entirely unknown. Validate more hypotheses to populate it.';

    return newCurrentFrequency({
      organization_id: org.organization_id,
      current_dimensions: dims,
      confidence: conf,
      current_summary: summary,
      supporting_validations: flatten(known.map(function (d) { return d.supporting_understanding_ids; }))
    });
  }

  /* ---- GAP: required vs current, per dimension -------------- */
  function buildGap(org, mis, required, current) {
    var reqByDim = index(required.required_dimensions, 'dimension');
    var curByDim = index(current.current_dimensions, 'dimension');
    var rfid = required.required_frequency_id;
    var unknownCount = 0, majorCount = 0;

    var dimension_gaps = DIMENSIONS.map(function (name) {
      var r = reqByDim[name], c = curByDim[name];
      var rl = r ? r.required_level : 'moderate';
      var cl = c ? c.current_level : 'unknown';
      var reqUnd = window.OF.requiredValidation ? window.OF.requiredValidation.validatedForDim(rfid, name) : null;
      var reqValidated = !!reqUnd;
      var curValidated = (cl !== 'unknown');
      var requiredConf = reqValidated ? reqUnd.confidence : (r ? r.confidence : 0.4);
      var gl, conf, ev, gapConf, confReason;

      if (cl === 'unknown') {
        gl = 'unknown'; unknownCount++;
        conf = 0.15;
        ev = 'Required ' + human(rl) + (reqValidated ? ' (validated)' : ' (assumed)') + ', but current is not yet validated — gap unknown until ' + name.toLowerCase() + ' is validated.';
        gapConf = 'low';
        confReason = 'Current side not validated — gap is unknown regardless of the required side.';
      } else {
        var diff = levelIndex(rl) - levelIndex(cl);
        gl = diff <= 0 ? 'none' : diff === 1 ? 'minor' : diff === 2 ? 'moderate' : 'major';
        if (gl === 'major') majorCount++;
        conf = round(Math.min(0.85, (requiredConf + (c ? c.confidence : 0.3)) / 2 + (reqValidated && curValidated ? 0.15 : 0)));
        ev = 'Required ' + human(rl) + (reqValidated ? ' (validated)' : ' (assumed)') + ' · current ' + human(cl) + ' (validated). ' +
          (diff <= 0 ? 'No gap — current meets or exceeds the need.' : 'A ' + gl + ' gap on ' + name.toLowerCase() + '.');
        if (reqValidated && curValidated) { gapConf = 'high'; confReason = 'Both sides validated — high confidence in this gap.'; }
        else if (curValidated && !reqValidated) { gapConf = 'medium'; confReason = 'Current validated; required still assumed from the mission — medium confidence.'; }
        else { gapConf = 'low'; confReason = 'Required not yet validated — low confidence.'; }
      }
      return {
        dimension: name, current_level: cl, required_level: rl, gap_level: gl,
        confidence: conf, gap_confidence: gapConf, confidence_reasoning: confReason,
        required_validated: reqValidated, current_validated: curValidated, evidence: ev
      };
    });

    var named = dimension_gaps.filter(function (g) { return g.gap_level !== 'unknown' && g.gap_level !== 'none'; })
      .sort(function (a, b) { return GAP_LEVELS.indexOf(b.gap_level) - GAP_LEVELS.indexOf(a.gap_level); });
    var summary = named.length
      ? 'Likely gaps where the mission needs more than the organization currently appears to be: ' +
        named.slice(0, 3).map(function (g) { return g.dimension.toLowerCase() + ' (' + g.gap_level + ')'; }).join(', ') +
        '. ' + unknownCount + ' dimension' + (unknownCount === 1 ? '' : 's') + ' still unknown.'
      : (unknownCount === DIMENSIONS.length
        ? 'No gap can be computed yet — current frequency is unvalidated. Validate hypotheses first.'
        : 'No notable gaps on the validated dimensions; ' + unknownCount + ' remain unknown.');

    return newFrequencyGap({
      organization_id: org.organization_id,
      mission_id: mis.mission_id,
      dimension_gaps: dimension_gaps,
      confidence: round(named.length ? avg(named.map(function (g) { return g.confidence; })) : 0.2),
      gap_summary: summary,
      recommended_next_research: unknownCount
        ? 'Validate the unknown dimensions next: ' + dimension_gaps.filter(function (g) { return g.gap_level === 'unknown'; }).slice(0, 4).map(function (g) { return g.dimension.toLowerCase(); }).join(', ') + '.'
        : 'Corroborate the largest gaps with a second source before acting.'
    });
  }

  /* ---- INTERVENTION HYPOTHESES (hypotheses, not actions) ---- */
  function buildInterventions(gap, mis) {
    var hiring = mis.hiring_relevance || 'possible';
    var out = [];
    gap.dimension_gaps.forEach(function (g) {
      if (g.gap_level !== 'moderate' && g.gap_level !== 'major') return;
      var type = interventionTypeFor(g.dimension, hiring);
      out.push(newIntervention({
        gap_id: gap.gap_id,
        dimension: g.dimension,
        intervention_type: type,
        rationale: 'A ' + g.gap_level + ' gap on ' + g.dimension.toLowerCase() + ' (required ' + human(g.required_level) + ' vs current ' + human(g.current_level) + ') might be closed through ' + type.replace('_', ' ') + '. Hypothesis only — not a recommendation.',
        confidence: round(Math.min(0.45, g.confidence))
      }));
    });
    if (!out.length) {
      out.push(newIntervention({
        gap_id: gap.gap_id, dimension: null, intervention_type: 'research',
        rationale: 'No moderate/major gap is established on validated dimensions yet. The first intervention is more validation, not action.',
        confidence: 0.3
      }));
    }
    return out;
  }
  function interventionTypeFor(dim, hiring) {
    var map = {
      'Leadership Style': 'leadership',
      'People Development Orientation': (hiring === 'central' || hiring === 'likely') ? 'hiring' : 'training',
      'Process Maturity': 'process',
      'Execution Discipline': 'process',
      'Communication Style': 'communication',
      'Autonomy Level': 'role_design',
      'Pace': 'structure',
      'Pressure Tolerance': 'leadership',
      'Innovation Requirement': (hiring === 'central' || hiring === 'likely') ? 'hiring' : 'training',
      'Trust / Goodness Layer': 'leadership'
    };
    return map[dim] || 'unknown';
  }

  /* ---- understanding → dimension/level interpretation ------- */
  function matchDimension(statement) {
    var s = (statement || '').toLowerCase();
    for (var i = 0; i < DIMENSIONS.length; i++) {
      if (s.indexOf(DIMENSIONS[i].toLowerCase()) === 0) return DIMENSIONS[i];
    }
    return null;
  }
  // Map a validated understanding's text to the org's CURRENT strength
  // on that dimension (capability present), per-dimension semantics.
  function estimateToLevel(dim, statement) {
    var s = (statement || '').toLowerCase();
    if (/unknown|not observable|not yet/.test(s)) return 'unknown';
    if (dim === 'Leadership Style') {
      if (/founder|leader-centric|centric|concentrated/.test(s)) return 'low';
      if (/distributed|deep|strong/.test(s)) return 'high';
      return 'moderate';
    }
    if (dim === 'Process Maturity') {
      if (/stretched|strain|early|informal|immature|low/.test(s)) return 'low';
      if (/mature|strong|robust/.test(s)) return 'high';
      return 'moderate';
    }
    if (/under strain|stretched|early-stage|informal|weak|low/.test(s)) return 'low';
    if (/very high|critical|central|highly|strong|fast|accelerat/.test(s)) return 'high';
    if (/becoming|emerging|priority|growing|developing/.test(s)) return 'moderate';
    if (/high\b/.test(s)) return 'high';
    if (/moderate/.test(s)) return 'moderate';
    return 'moderate';
  }

  /* ---- FREQUENCY PROMOTION (1E) ----------------------------
     The first earned write. ONLY validated current dimensions
     (current_level != 'unknown', sourced from validated
     understanding) update the organization's living frequency
     model (org.preliminary_frequency). Research, hypotheses and
     raw evidence may NOT write here. Each promotion is logged.
  */
  function promoteFrequency(store, org, current) {
    var prev = org.preliminary_frequency && org.preliminary_frequency.dimensions
      ? index(org.preliminary_frequency.dimensions, 'dimension') : {};
    var dims = [];
    (current.current_dimensions || []).forEach(function (d) {
      if (d.current_level === 'unknown') {
        // keep any previously-promoted value; never overwrite with unknown
        if (prev[d.dimension]) dims.push(prev[d.dimension]);
        return;
      }
      var entry = {
        dimension: d.dimension,
        level: d.current_level,
        confidence: d.confidence,
        source: 'validated_understanding',
        updated_at: nowISO()
      };
      dims.push(entry);
      var before = prev[d.dimension];
      if (!before || before.level !== entry.level) {
        store.frequency_promotion_log.push({
          log_id: uid('plog'),
          organization_id: org.organization_id,
          dimension: d.dimension,
          level: entry.level,
          confidence: entry.confidence,
          from: before ? before.level : '(none)',
          source: 'validated_understanding',
          date: nowISO()
        });
      }
    });
    org.preliminary_frequency = {
      dimensions: dims,
      source: 'validated_understanding',
      note: 'Only validated dimensions are written here. Research and hypotheses never write to the living frequency.',
      updated_at: nowISO()
    };
    org.frequency_confidence = dims.length ? round(avg(dims.map(function (x) { return x.confidence; }))) : 0;
    org.updated_at = nowISO();
  }

  /* ---- reads for the admin / flow --------------------------- */
  function getLayer(orgId, missionId, store) {
    store = ensure(store || OF.load());
    return {
      required: store.required_frequencies.filter(function (x) { return x.mission_id === missionId; })[0] || null,
      current: store.current_frequencies.filter(function (x) { return x.organization_id === orgId; })[0] || null,
      gap: store.frequency_gaps.filter(function (x) { return x.mission_id === missionId; })[0] || null,
      interventions: function () {
        var g = store.frequency_gaps.filter(function (x) { return x.mission_id === missionId; })[0];
        return g ? store.intervention_hypotheses.filter(function (iv) { return iv.gap_id === g.gap_id; }) : [];
      }()
    };
  }
  function hasUnderstanding(orgId, store) {
    store = store || OF.load();
    return (store.validated_understandings || []).some(function (u) { return u.organization_id === orgId; });
  }

  /* ---- utils ------------------------------------------------ */
  function human(l) { return l === 'very_high' ? 'very high' : l; }
  function avg(a) { return a.reduce(function (x, y) { return x + y; }, 0) / (a.length || 1); }
  function flatten(a) { return a.reduce(function (x, y) { return x.concat(y); }, []); }
  function index(arr, key) { var o = {}; (arr || []).forEach(function (x) { o[x[key]] = x; }); return o; }
  function byId(arr, key, val) { return (arr || []).filter(function (x) { return x[key] === val; })[0] || null; }

  OF.frequency = {
    DIMENSIONS: DIMENSIONS,
    LEVELS: LEVELS,
    GAP_LEVELS: GAP_LEVELS,
    INTERVENTION_TYPES: INTERVENTION_TYPES,
    ensure: ensure,
    newRequiredFrequency: newRequiredFrequency,
    newCurrentFrequency: newCurrentFrequency,
    newFrequencyGap: newFrequencyGap,
    newIntervention: newIntervention,
    recompute: recompute,
    promoteFrequency: promoteFrequency,
    getLayer: getLayer,
    hasUnderstanding: hasUnderstanding,
    human: human
  };
})();
