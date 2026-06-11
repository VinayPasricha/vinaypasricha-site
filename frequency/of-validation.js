/* =============================================================
   Organizational Frequency — Validation engine  (Build 1C)
   =============================================================
   Builds on 1A (Mission Spine) + 1B (Tier-0 Research) WITHOUT
   changing the architecture.

   The rule this build enforces:

       Research does NOT update memory.
       Validation updates memory.

   Promotion path (no shortcuts allowed):

       Evidence → Hypothesis → Validation → Validated Understanding
                → Transformation → Essence   (last two: later builds)

   Tier-0 hypotheses do NOT become truth. They enter a Validation
   Queue. Only when a hypothesis is tested (by the mission owner,
   a stakeholder, public evidence) does it move toward a
   Validated Understanding — and only past a documented threshold.

   This build implements up to ValidatedUnderstanding. It does NOT
   generate Transformations or Essence updates.

   Augments window.OF with window.OF.validation.
   ============================================================= */
(function () {
  'use strict';
  if (!window.OF) { console.warn('of-validation.js requires of-model.js'); return; }
  var OF = window.OF;

  var TARGET_TYPES = ['mission', 'organization', 'frequency', 'essence', 'mission_analysis'];
  var STATUS = ['untested', 'supported', 'contradicted', 'mixed', 'retired'];
  var SOURCE_TYPES = ['mission_owner', 'stakeholder', 'public_evidence', 'system_inference', 'future'];
  // Future source placeholders — NOT implemented in 1C:
  var FUTURE_SOURCES = ['employee', 'candidate', 'manager', 'former_employee'];

  var QUESTION_TYPES = ['support', 'contradiction', 'clarification'];

  // ---- THRESHOLD (documented) --------------------------------
  // A hypothesis becomes a ValidatedUnderstanding when at least
  // one validation is 'supported' AND its confidence_after reaches
  // this value. 'mixed' and 'contradicted' never produce
  // understanding. Deliberately simple for 1C.
  var UNDERSTANDING_THRESHOLD = 0.6;
  // Cap how many hypotheses we queue per research run, strongest
  // first, so the owner is asked a humane number of questions.
  var QUEUE_CAP = 6;

  function nowISO() { return new Date().toISOString(); }
  function uid(p) { return OF.uid(p); }
  function clamp01(n) { return Math.max(0.02, Math.min(0.95, n)); }
  function round(n) { return Math.round(n * 100) / 100; }

  function ensure(store) {
    store.validations = store.validations || [];
    store.validation_queue = store.validation_queue || [];
    store.validated_understandings = store.validated_understandings || [];
    store.seeds = store.seeds || [];
    return store;
  }

  /* ========================================================== */
  /* BUILD OBJECT 1 — Validation                                */
  /* ========================================================== */
  function newValidation(f) {
    f = f || {};
    return {
      validation_id: f.validation_id || uid('val'),
      organization_id: f.organization_id || null,   // grouping (extra to spec, for queries)
      target_type: TARGET_TYPES.indexOf(f.target_type) !== -1 ? f.target_type : 'organization',
      target_id: f.target_id || null,               // the hypothesis record this tests
      statement: f.statement || '',
      question_type: QUESTION_TYPES.indexOf(f.question_type) !== -1 ? f.question_type : 'support',
      validation_status: STATUS.indexOf(f.validation_status) !== -1 ? f.validation_status : 'untested',
      supporting_evidence: f.supporting_evidence || [],   // evidence_seed_id[]
      contradicting_evidence: f.contradicting_evidence || [],
      confidence_before: typeof f.confidence_before === 'number' ? round(f.confidence_before) : 0.3,
      confidence_after: typeof f.confidence_after === 'number' ? round(f.confidence_after) : (typeof f.confidence_before === 'number' ? round(f.confidence_before) : 0.3),
      source: SOURCE_TYPES.indexOf(f.source) !== -1 ? f.source : 'system_inference',
      history: f.history || [],                      // [{ date, status, source, note }]
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }

  /* ========================================================== */
  /* BUILD OBJECT 3 — ValidatedUnderstanding                    */
  /* ========================================================== */
  function newUnderstanding(f) {
    f = f || {};
    return {
      understanding_id: f.understanding_id || uid('und'),
      organization_id: f.organization_id || null,
      statement: f.statement || '',
      confidence: typeof f.confidence === 'number' ? round(f.confidence) : 0.6,
      supporting_validations: f.supporting_validations || [],  // validation_id[]
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }

  /* ========================================================== */
  /* BUILD OBJECT 2 — Validation Queue                          */
  /* ==========================================================
     Every Tier-0 hypothesis becomes an untested Validation +
     a queue entry. Called from of-research.finish() at runtime.
     Re-running research regenerates ONLY the untested set;
     answered validations (supported/contradicted/mixed) and any
     understandings they produced are preserved as history.
  */
  function enqueueFromResearch(store, ctx) {
    ensure(store);
    var org = ctx.organization;
    if (!org) return [];
    var orgId = org.organization_id;

    // Clear prior UNTESTED validations + their queue entries for this org.
    var keep = {};
    store.validations = store.validations.filter(function (v) {
      if (v.organization_id === orgId && v.validation_status === 'untested') return false;
      keep[v.validation_id] = true;
      return true;
    });
    store.validation_queue = store.validation_queue.filter(function (q) {
      return q.organization_id !== orgId || keep[q.validation_id];
    });

    var answeredStatements = {};
    store.validations.forEach(function (v) {
      if (v.organization_id === orgId) answeredStatements[norm(v.statement)] = true;
    });

    var candidates = buildCandidates(ctx);
    // strongest first, cap, and skip anything already answered
    candidates = candidates
      .filter(function (c) { return !answeredStatements[norm(c.statement)]; })
      .sort(function (a, b) { return b.confidence_before - a.confidence_before; })
      .slice(0, QUEUE_CAP);

    var created = [];
    candidates.forEach(function (c) {
      var v = newValidation({
        organization_id: orgId,
        target_type: c.target_type,
        target_id: c.target_id,
        statement: c.statement,
        question_type: c.question_type || 'support',
        confidence_before: c.confidence_before,
        confidence_after: c.confidence_before,
        source: 'system_inference',
        validation_status: 'untested'
      });
      store.validations.push(v);
      store.validation_queue.push({
        queue_id: uid('vq'),
        organization_id: orgId,
        validation_id: v.validation_id,
        target_type: v.target_type,
        statement: v.statement,
        question_type: v.question_type,
        asked: false,
        enqueued_at: nowISO()
      });
      created.push(v);
    });
    return created;
  }

  // Turn the 1B hypotheses into validation candidates.
  function buildCandidates(ctx) {
    var out = [];
    var freq = ctx.frequency, ess = ctx.essence, ana = ctx.analysis;

    if (freq && freq.dimension_estimates) {
      freq.dimension_estimates.forEach(function (d) {
        if (isVague(d.estimate)) return;     // skip Unknown / not observable
        out.push({
          target_type: 'frequency',
          target_id: freq.frequency_id,
          statement: d.dimension + ' appears to be: ' + lc(d.estimate) + '.',
          confidence_before: d.confidence,
          question_type: 'support'
        });
      });
    }
    if (ess && ess.attributes) {
      ess.attributes.forEach(function (a) {
        var clean = a.replace(/\s*\((?:hypothesis|to verify)\)\s*/i, '').trim();
        if (!clean) return;
        out.push({
          target_type: 'essence',
          target_id: ess.essence_id,
          statement: 'The organization appears to be ' + lc(clean) + '.',
          confidence_before: ess.confidence,
          question_type: 'support'
        });
      });
    }
    if (ana && ana.mission_risk_observations) {
      ana.mission_risk_observations.forEach(function (r) {
        if (/insufficient public signal/i.test(r)) return;
        out.push({
          target_type: 'mission_analysis',
          target_id: ana.analysis_id,
          statement: r,
          confidence_before: ana.confidence,
          question_type: 'support'
        });
      });
    }
    // de-dupe by normalized statement
    var seen = {};
    return out.filter(function (c) {
      var k = norm(c.statement);
      if (seen[k]) return false; seen[k] = true; return true;
    });
  }

  /* ========================================================== */
  /* RECORD A VALIDATION RESPONSE                                */
  /* ==========================================================
     response: 'accurate' | 'partially' | 'inaccurate' | 'unsure'
     source:   one of SOURCE_TYPES (default 'mission_owner')
     Creates an evidence seed, updates the Validation, and — past
     the threshold — a ValidatedUnderstanding. Returns the updated
     validation (+ understanding if created).
  */
  function recordValidation(validationId, response, source, note) {
    var store = ensure(OF.load());
    var v = byId(store.validations, 'validation_id', validationId);
    if (!v) return null;
    source = SOURCE_TYPES.indexOf(source) !== -1 ? source : 'mission_owner';

    var map = {
      accurate:  { status: 'supported',   delta: +0.3, evi: 'supporting' },
      partially: { status: 'mixed',       delta: +0.05, evi: 'supporting' },
      inaccurate:{ status: 'contradicted', delta: -0.3, evi: 'contradicting' },
      unsure:    { status: 'untested',    delta: 0,    evi: null }
    };
    var m = map[response] || map.unsure;

    // evidence seed (validation results ARE evidence)
    if (m.evi) {
      var seed = OF.seam.makeSeed('evidence', subjectTypeFor(v.target_type), v.organization_id, {
        summary: 'Validation (' + source + '): "' + v.statement + '" — ' + responseLabel(response) + '.',
        source: source,
        confidence: 0.6,
        linked_attribute: 'validation_' + v.target_type,
        validation_id: v.validation_id
      });
      seed.origin = 'validation';
      store.seeds.push(seed);
      if (m.evi === 'supporting') v.supporting_evidence.push(seed.seed_id);
      else v.contradicting_evidence.push(seed.seed_id);
    }

    v.validation_status = m.status;
    v.confidence_after = round(clamp01(v.confidence_after + m.delta));
    v.source = source;
    v.history.push({ date: nowISO(), status: m.status, source: source, response: response, note: note || '' });
    v.updated_at = nowISO();

    // mark queue entry asked
    store.validation_queue.forEach(function (q) {
      if (q.validation_id === v.validation_id) q.asked = true;
    });

    var understanding = maybePromote(store, v);

    OF.save(store);
    return { validation: v, understanding: understanding, store: store };
  }

  // Threshold check → ValidatedUnderstanding (deduped per org+statement).
  function maybePromote(store, v) {
    if (v.validation_status !== 'supported') return null;
    if (v.confidence_after < UNDERSTANDING_THRESHOLD) return null;
    var existing = store.validated_understandings.filter(function (u) {
      return u.organization_id === v.organization_id && norm(u.statement) === norm(v.statement);
    })[0];
    if (existing) {
      existing.confidence = Math.max(existing.confidence, v.confidence_after);
      if (existing.supporting_validations.indexOf(v.validation_id) === -1) existing.supporting_validations.push(v.validation_id);
      existing.updated_at = nowISO();
      return existing;
    }
    var u = newUnderstanding({
      organization_id: v.organization_id,
      statement: restate(v.statement),
      confidence: v.confidence_after,
      supporting_validations: [v.validation_id]
    });
    store.validated_understandings.push(u);
    return u;
  }

  /* ---- reads for the admin / flow --------------------------- */
  function getForOrg(orgId, store) {
    store = ensure(store || OF.load());
    return {
      validations: store.validations.filter(function (v) { return v.organization_id === orgId; }),
      queue: store.validation_queue.filter(function (q) { return q.organization_id === orgId && !q.asked; }),
      understandings: store.validated_understandings.filter(function (u) { return u.organization_id === orgId; })
    };
  }
  // Untested validations for an org, strongest first — what Aeon1 asks next.
  function nextToValidate(orgId, limit, store) {
    store = ensure(store || OF.load());
    var untested = store.validations.filter(function (v) {
      return v.organization_id === orgId && v.validation_status === 'untested';
    }).sort(function (a, b) { return b.confidence_before - a.confidence_before; });
    return typeof limit === 'number' ? untested.slice(0, limit) : untested;
  }
  function nextValidationNeeded(orgId, store) {
    var n = nextToValidate(orgId, 1, store)[0];
    return n ? n.statement : 'All current hypotheses have been put to the owner at least once.';
  }

  /* ---- helpers ---------------------------------------------- */
  function subjectTypeFor(targetType) {
    // frequency/essence/mission_analysis all describe the org
    if (targetType === 'mission') return 'mission';
    return 'organization';
  }
  function responseLabel(r) {
    return ({ accurate: 'felt accurate', partially: 'felt partially accurate',
      inaccurate: 'was called inaccurate', unsure: 'owner was unsure' })[r] || r;
  }
  function restate(s) {
    // "X appears to be: Y." → "X is Y." once validated
    return s.replace(/\bappears to be:?\s*/i, 'is ').replace(/\bmay become\b/i, 'is becoming');
  }
  function isVague(est) { return !est || /unknown|not observable|not yet/i.test(est); }
  function byId(arr, key, val) { return (arr || []).filter(function (x) { return x[key] === val; })[0] || null; }
  function lc(s) { return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }
  function norm(s) { return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }

  OF.validation = {
    TARGET_TYPES: TARGET_TYPES,
    STATUS: STATUS,
    SOURCE_TYPES: SOURCE_TYPES,
    FUTURE_SOURCES: FUTURE_SOURCES,
    QUESTION_TYPES: QUESTION_TYPES,
    UNDERSTANDING_THRESHOLD: UNDERSTANDING_THRESHOLD,
    QUEUE_CAP: QUEUE_CAP,
    ensure: ensure,
    newValidation: newValidation,
    newUnderstanding: newUnderstanding,
    enqueueFromResearch: enqueueFromResearch,
    recordValidation: recordValidation,
    getForOrg: getForOrg,
    nextToValidate: nextToValidate,
    nextValidationNeeded: nextValidationNeeded,
    responseLabel: responseLabel
  };
})();
