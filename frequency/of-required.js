/* =============================================================
   Organizational Frequency — Required Frequency Validation (1E)
   =============================================================
   Builds on 1A–1D WITHOUT changing the architecture.

   1D made CURRENT frequency evidence-backed (from validated
   understanding). REQUIRED frequency was still heuristic. Before
   a gap can be trusted, BOTH sides must be validated.

   This module validates the REQUIRED side, exactly mirroring the
   1C promotion philosophy:

       Required hypothesis → Required Validation
                           → Validated Required Understanding

   Nothing becomes truth automatically. Only the top 3–5 most
   important required dimensions are put to the owner.

   Augments window.OF with window.OF.requiredValidation.
   ============================================================= */
(function () {
  'use strict';
  if (!window.OF) { console.warn('of-required.js requires of-model.js'); return; }
  var OF = window.OF;

  var STATUS = ['untested', 'supported', 'contradicted', 'mixed', 'retired'];
  var SOURCE_TYPES = ['mission_owner', 'public_evidence', 'stakeholder', 'future'];
  var THRESHOLD = 0.6;
  var ASK_CAP = 5;            // validate at most 5 required dimensions
  var human = (OF.frequency && OF.frequency.human) || function (l) { return l === 'very_high' ? 'very high' : l; };

  function nowISO() { return new Date().toISOString(); }
  function uid(p) { return OF.uid(p); }
  function clamp01(n) { return Math.max(0.02, Math.min(0.95, n)); }
  function round(n) { return Math.round(n * 100) / 100; }

  function ensure(store) {
    store.required_validations = store.required_validations || [];
    store.required_validation_queue = store.required_validation_queue || [];
    store.validated_required_understandings = store.validated_required_understandings || [];
    return store;
  }

  /* ---- SCHEMAS ---------------------------------------------- */
  function newRequiredValidation(f) {
    f = f || {};
    return {
      required_validation_id: f.required_validation_id || uid('rv'),
      required_frequency_id: f.required_frequency_id || null,
      mission_id: f.mission_id || null,
      dimension: f.dimension || null,
      statement: f.statement || '',
      question_type: f.question_type || 'support',
      validation_status: STATUS.indexOf(f.validation_status) !== -1 ? f.validation_status : 'untested',
      supporting_reasoning: f.supporting_reasoning || [],
      contradicting_reasoning: f.contradicting_reasoning || [],
      confidence_before: typeof f.confidence_before === 'number' ? round(f.confidence_before) : 0.4,
      confidence_after: typeof f.confidence_after === 'number' ? round(f.confidence_after) : (typeof f.confidence_before === 'number' ? round(f.confidence_before) : 0.4),
      source: SOURCE_TYPES.indexOf(f.source) !== -1 ? f.source : 'mission_owner',
      history: f.history || [],
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }
  function newRequiredUnderstanding(f) {
    f = f || {};
    return {
      understanding_id: f.understanding_id || uid('rund'),
      required_frequency_id: f.required_frequency_id || null,
      dimension: f.dimension || null,
      validated_statement: f.validated_statement || '',
      confidence: typeof f.confidence === 'number' ? round(f.confidence) : 0.6,
      supporting_validations: f.supporting_validations || [],
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }

  /* ---- ENQUEUE — top 3–5 required dimensions ---------------
     Stable: NEVER clears existing validations (their ids must
     survive recompute, which re-runs this). Only ADDS validations
     for important dimensions that don't yet have one. */
  function enqueueRequired(store, ctx) {
    ensure(store);
    var required = ctx.required, mis = ctx.mission;
    if (!required) return [];
    var rfid = required.required_frequency_id;

    // every dimension that already has a validation (any status)
    var existing = {};
    store.required_validations.forEach(function (v) {
      if (v.required_frequency_id === rfid) existing[v.dimension] = true;
    });

    // importance: very_high/high first, then by confidence
    var order = { very_high: 0, high: 1, moderate: 2, low: 3 };
    var dims = (required.required_dimensions || []).slice()
      .filter(function (d) { return !existing[d.dimension]; })
      .sort(function (a, b) {
        var oa = order[a.required_level], ob = order[b.required_level];
        if (oa !== ob) return oa - ob;
        return b.confidence - a.confidence;
      });
    var important = dims.filter(function (d) { return d.required_level === 'high' || d.required_level === 'very_high'; });
    if (!important.length) important = dims.slice(0, 3);
    // how many already exist, so the total asked stays around ASK_CAP
    var already = Object.keys(existing).length;
    important = important.slice(0, Math.max(0, ASK_CAP - already));

    var created = [];
    important.forEach(function (d) {
      var v = newRequiredValidation({
        required_frequency_id: rfid,
        mission_id: mis ? mis.mission_id : required.mission_id,
        dimension: d.dimension,
        statement: 'For this mission, ' + d.dimension + ' will need to be ' + human(d.required_level) + '.',
        confidence_before: d.confidence,
        confidence_after: d.confidence,
        validation_status: 'untested'
      });
      store.required_validations.push(v);
      store.required_validation_queue.push({
        queue_id: uid('rvq'),
        required_frequency_id: rfid,
        required_validation_id: v.required_validation_id,
        dimension: d.dimension,
        statement: v.statement,
        asked: false,
        enqueued_at: nowISO()
      });
      created.push(v);
    });
    return created;
  }

  /* ---- RECORD a response ------------------------------------ */
  function recordRequired(validationId, response, source, note) {
    var store = ensure(OF.load());
    var v = byId(store.required_validations, 'required_validation_id', validationId);
    if (!v) return null;
    source = SOURCE_TYPES.indexOf(source) !== -1 ? source : 'mission_owner';

    var map = {
      accurate:  { status: 'supported',    delta: +0.3, side: 'supporting' },
      partially: { status: 'mixed',        delta: +0.05, side: 'supporting' },
      inaccurate:{ status: 'contradicted', delta: -0.3, side: 'contradicting' },
      unsure:    { status: 'untested',     delta: 0,    side: null }
    };
    var m = map[response] || map.unsure;
    var reason = '(' + source + ') ' + responseLabel(response) + ' — "' + v.statement + '"' + (note ? ' · ' + note : '');
    if (m.side === 'supporting') v.supporting_reasoning.push(reason);
    else if (m.side === 'contradicting') v.contradicting_reasoning.push(reason);

    v.validation_status = m.status;
    v.confidence_after = round(clamp01(v.confidence_after + m.delta));
    v.source = source;
    v.history.push({ date: nowISO(), status: m.status, source: source, response: response });
    v.updated_at = nowISO();
    store.required_validation_queue.forEach(function (q) { if (q.required_validation_id === v.required_validation_id) q.asked = true; });

    var understanding = maybePromote(store, v);
    OF.save(store);

    // both sides may have moved — refresh the frequency layer so the
    // gap confidence reflects the new validated required side.
    if (OF.frequency && OF.frequency.recompute && v.mission_id) {
      var mis = byId(store.missions, 'mission_id', v.mission_id);
      if (mis) OF.frequency.recompute(mis.organization_id, mis.mission_id);
    }
    return { validation: v, understanding: understanding };
  }

  function maybePromote(store, v) {
    if (v.validation_status !== 'supported' || v.confidence_after < THRESHOLD) return null;
    var existing = store.validated_required_understandings.filter(function (u) {
      return u.required_frequency_id === v.required_frequency_id && u.dimension === v.dimension;
    })[0];
    if (existing) {
      existing.confidence = Math.max(existing.confidence, v.confidence_after);
      if (existing.supporting_validations.indexOf(v.required_validation_id) === -1) existing.supporting_validations.push(v.required_validation_id);
      existing.updated_at = nowISO();
      return existing;
    }
    var u = newRequiredUnderstanding({
      required_frequency_id: v.required_frequency_id,
      dimension: v.dimension,
      validated_statement: v.statement.replace(/will need to be/i, 'needs to be'),
      confidence: v.confidence_after,
      supporting_validations: [v.required_validation_id]
    });
    store.validated_required_understandings.push(u);
    return u;
  }

  /* ---- reads ------------------------------------------------ */
  function getForFreq(rfid, store) {
    store = ensure(store || OF.load());
    return {
      validations: store.required_validations.filter(function (v) { return v.required_frequency_id === rfid; }),
      queue: store.required_validation_queue.filter(function (q) { return q.required_frequency_id === rfid && !q.asked; }),
      understandings: store.validated_required_understandings.filter(function (u) { return u.required_frequency_id === rfid; })
    };
  }
  // The validated required understanding for a dimension, if any.
  function validatedForDim(rfid, dim, store) {
    store = ensure(store || OF.load());
    return store.validated_required_understandings.filter(function (u) {
      return u.required_frequency_id === rfid && u.dimension === dim;
    })[0] || null;
  }
  function nextRequired(rfid, limit, store) {
    store = ensure(store || OF.load());
    var untested = store.required_validations.filter(function (v) {
      return v.required_frequency_id === rfid && v.validation_status === 'untested';
    }).sort(function (a, b) { return b.confidence_before - a.confidence_before; });
    return typeof limit === 'number' ? untested.slice(0, limit) : untested;
  }

  function responseLabel(r) {
    return ({ accurate: 'agreed it will be required', partially: 'partly agreed', inaccurate: 'disagreed it is required', unsure: 'was unsure' })[r] || r;
  }
  function byId(arr, key, val) { return (arr || []).filter(function (x) { return x[key] === val; })[0] || null; }

  OF.requiredValidation = {
    STATUS: STATUS,
    SOURCE_TYPES: SOURCE_TYPES,
    THRESHOLD: THRESHOLD,
    ensure: ensure,
    newRequiredValidation: newRequiredValidation,
    newRequiredUnderstanding: newRequiredUnderstanding,
    enqueueRequired: enqueueRequired,
    recordRequired: recordRequired,
    getForFreq: getForFreq,
    validatedForDim: validatedForDim,
    nextRequired: nextRequired,
    responseLabel: responseLabel
  };
})();
