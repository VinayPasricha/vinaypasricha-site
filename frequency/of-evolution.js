/* =============================================================
   Organizational Frequency — Frequency Evolution & Recompute (1L)
   =============================================================
   Builds on 1A–1K WITHOUT redesigning. The closing of the loop.

   1K can run Deep Discovery through stakeholder threads. But the
   findings still sit beside the model. This build makes discovery
   CHANGE the living organization frequency, then recomputes
   everything downstream.

   DOCTRINE:
     • Public research creates hypotheses. Stakeholder discovery
       validates / contradicts / refines / deepens.
     • ONLY stakeholder-validated discovery may update the living
       organization frequency. No unvalidated answer, no raw public
       research, ever writes here.
     • Discovery is not complete until it changes the living model.
     • Every change creates a FrequencyEvolutionEvent. Old values
       remain in history. Nothing is overwritten silently.
     • Contradiction is a SIGNAL, not an error. If stakeholders
       conflict, the contradiction is preserved and confidence is
       LOWERED — the dimension is not firmed up.

   This module reuses the existing engines (of-frequency,
   of-role, of-mandate, of-emergence) and adds only the
   orchestration that calls them in the right order.

   Augments window.OF with window.OF.evolution.
   ============================================================= */
(function () {
  'use strict';
  if (!window.OF) { console.warn('of-evolution.js requires of-model.js'); return; }
  var OF = window.OF;

  var LEVELS = (OF.frequency && OF.frequency.LEVELS) || ['low', 'moderate', 'high', 'very_high'];
  var DIMENSIONS = (OF.frequency && OF.frequency.DIMENSIONS) || [];
  var human = (OF.frequency && OF.frequency.human) || function (l) { return l === 'very_high' ? 'very high' : l; };
  var CHANGE_TYPES = ['confirmed', 'refined', 'contradicted', 'strengthened', 'weakened', 'unknown_to_known'];

  function nowISO() { return new Date().toISOString(); }
  function uid(p) { return OF.uid(p); }
  function lvlIdx(l) { return LEVELS.indexOf(l); }
  function lc(s) { return (s == null) ? s : String(s).toLowerCase(); }

  function ensure(store) {
    store.frequency_evolution_events = store.frequency_evolution_events || [];
    return store;
  }

  /* ==========================================================
     BUILD OBJECT 1 — FREQUENCY EVOLUTION EVENT
     ========================================================== */
  function newEvent(f) {
    f = f || {};
    return {
      event_id: f.event_id || uid('fev'),
      organization_id: f.organization_id || null,
      discovery_id: f.discovery_id || null,
      dimension: f.dimension || null,
      previous_level: f.previous_level || 'unknown',
      new_level: f.new_level || 'unknown',
      change_type: CHANGE_TYPES.indexOf(f.change_type) !== -1 ? f.change_type : 'refined',
      evidence: f.evidence || [],
      stakeholder_sources: f.stakeholder_sources || [],
      confidence: f.confidence || 'low',          // descriptive: low | medium | high
      reasoning: f.reasoning || '',
      created_at: f.created_at || nowISO()
    };
  }

  /* ==========================================================
     BUILD OBJECT 2 — LIVING ORGANIZATION FREQUENCY
     org.living_frequency = { dimensions: [ {dimension, level,
       confidence, source, last_updated, evidence[],
       stakeholder_sources[], history[]} ], updated_at }
     Maintained here so history/evidence survive recomputes (the
     engine's preliminary_frequency is the promotion target; this
     is the durable, auditable living model layered on top).
     ========================================================== */
  function ensureLiving(org) {
    if (!org.living_frequency || !org.living_frequency.dimensions) {
      // seed from whatever the engine has already promoted
      var seed = (org.preliminary_frequency && org.preliminary_frequency.dimensions) || [];
      org.living_frequency = {
        dimensions: seed.map(function (d) {
          return { dimension: d.dimension, level: d.level, confidence: d.confidence != null ? d.confidence : 0.4,
            source: d.source || 'validated_understanding', last_updated: d.updated_at || nowISO(),
            evidence: [], stakeholder_sources: [], history: [] };
        }),
        updated_at: nowISO()
      };
    }
    return org.living_frequency;
  }
  function livingDim(org, dim) {
    var lf = ensureLiving(org);
    return lf.dimensions.filter(function (d) { return d.dimension === dim; })[0] || null;
  }
  // Upsert a dimension into the living frequency, never overwriting
  // silently — the prior value is pushed to history.
  function upsertLiving(org, entry) {
    var lf = ensureLiving(org);
    var cur = lf.dimensions.filter(function (d) { return d.dimension === entry.dimension; })[0];
    if (cur) {
      if (cur.level !== entry.level || cur.source !== entry.source) {
        cur.history = (cur.history || []).concat([{ level: cur.level, confidence: cur.confidence, source: cur.source, at: cur.last_updated || nowISO() }]);
      }
      cur.level = entry.level; cur.confidence = entry.confidence; cur.source = entry.source;
      cur.evidence = entry.evidence; cur.stakeholder_sources = entry.stakeholder_sources;
      cur.contested = entry.contested || false;
      cur.last_updated = nowISO();
    } else {
      lf.dimensions.push(Object.assign({ history: [] }, entry, { last_updated: nowISO() }));
    }
    lf.updated_at = nowISO();
  }

  /* ==========================================================
     BUILD OBJECT 3 — DISCOVERY PROMOTION
     promoteDiscoveryToFrequency(discoveryId)
     ========================================================== */
  function promoteDiscoveryToFrequency(discoveryId, store) {
    store = ensure(store || OF.load());
    if (!OF.discovery) return { error: 'Discovery runtime not loaded.' };
    var disc = (store.discovery_missions || []).filter(function (d) { return d.discovery_id === discoveryId; })[0] ||
               (store.discovery_missions || [])[0];
    if (!disc) return { error: 'No discovery mission found.' };
    var orgId = disc.organization_id;
    var org = byId(store.organizations, 'organization_id', orgId);
    if (!org) return { error: 'Organization not found.' };

    var report = (store.discovery_reports || []).filter(function (r) { return r.organization_id === orgId; })[0];
    if (!report) return { error: 'Generate the discovery report before promoting — discovery must be complete.' };

    var coherence = (store.coherence_maps || []).filter(function (c) { return c.organization_id === orgId; });
    if (!coherence.length) return { error: 'No stakeholder coherence to promote — run discovery first.' };
    var openContradictions = (store.contradiction_maps || []).filter(function (c) { return c.organization_id === orgId && (c.status === 'open' || c.status === 'reviewing'); });

    // 1+2 — snapshot previous living levels, classify each dimension
    ensureLiving(org);
    var prev = {};
    DIMENSIONS.forEach(function (dn) { var d = livingDim(org, dn); prev[dn] = d ? d.level : 'unknown'; });

    var validated = [];   // {dimension, level, confidence, stakeholder_sources, evidence, coherence}
    var contradicted = []; // {dimension, ...}
    coherence.forEach(function (c) {
      var lvl = tier0Level(orgId, c.dimension, store);
      var sources = (c.stakeholder_views || []).map(function (v) { return v.type; });
      var ev = (c.stakeholder_views || []).map(function (v) { return v.type + ': ' + v.read; });
      if (c.coherence_level === 'divergent') {
        contradicted.push({ dimension: c.dimension, level: lvl, confidence: 'low', stakeholder_sources: sources, evidence: ev });
      } else if (c.coherence_level === 'aligned') {
        validated.push({ dimension: c.dimension, level: lvl, confidence: 'high', stakeholder_sources: sources, evidence: ev, conf_num: 0.85 });
      } else { // partial
        validated.push({ dimension: c.dimension, level: lvl, confidence: 'medium', stakeholder_sources: sources, evidence: ev, conf_num: 0.6 });
      }
    });

    // 3 — feed the EXISTING pipeline: validated dimensions become
    // ValidatedUnderstanding (the only legitimate source of current
    // frequency). Contradicted dimensions are NOT firmed up.
    store.validated_understandings = (store.validated_understandings || []).filter(function (u) { return !(u.organization_id === orgId && u.source === 'deep_discovery'); });
    validated.forEach(function (v) {
      store.validated_understandings.push({
        understanding_id: uid('und'),
        organization_id: orgId,
        statement: v.dimension + ' is ' + human(v.level),
        confidence: v.conf_num,
        supporting_validations: [],
        source: 'deep_discovery',
        created_at: nowISO(), updated_at: nowISO()
      });
    });

    // 4 — RECOMPUTE LOOP (existing engines, correct order)
    var missions = (store.missions || []).filter(function (m) { return m.organization_id === orgId; });
    var recompute = { current: false, gap: false, role_frequencies: 0 };
    missions.forEach(function (m) {
      if (OF.frequency && OF.frequency.recompute) { OF.frequency.recompute(orgId, m.mission_id, store); recompute.current = true; recompute.gap = true; store = OF.load(); ensure(store); org = byId(store.organizations, 'organization_id', orgId); }
      if (OF.role && OF.role.recomputeRoleFrequencies) { recompute.role_frequencies += OF.role.recomputeRoleFrequencies(m.mission_id, store); store = OF.load(); ensure(store); org = byId(store.organizations, 'organization_id', orgId); }
    });

    // 5 — build evolution events (prev vs post) + enrich living frequency
    var events = [];
    validated.concat(contradicted).forEach(function (v) {
      var isContra = contradicted.indexOf(v) !== -1;
      var post = livingDim(org, v.dimension);
      var newLevel = isContra ? 'contested' : (post ? post.level : v.level);
      var ct = changeType(prev[v.dimension], newLevel, isContra, v.confidence);
      var ev = newEvent({
        organization_id: orgId, discovery_id: disc.discovery_id, dimension: v.dimension,
        previous_level: prev[v.dimension] || 'unknown', new_level: newLevel,
        change_type: ct, evidence: v.evidence, stakeholder_sources: v.stakeholder_sources,
        confidence: v.confidence,
        reasoning: isContra
          ? 'Stakeholders diverge on ' + lc(v.dimension) + ' — contradiction preserved, confidence lowered. Not firmed into the living frequency.'
          : 'Stakeholder discovery ' + ct + ' ' + lc(v.dimension) + ' at ' + human(newLevel) + ' (' + v.confidence + ' confidence).'
      });
      store.frequency_evolution_events.push(ev);
      events.push(ev);

      // living frequency enrichment
      upsertLiving(org, {
        dimension: v.dimension,
        level: newLevel,
        confidence: isContra ? 0.3 : (v.confidence === 'high' ? 0.85 : 0.6),
        source: isContra ? 'deep_discovery_contradicted' : 'deep_discovery_validated',
        evidence: v.evidence,
        stakeholder_sources: v.stakeholder_sources,
        contested: isContra
      });
    });

    disc.frequency_updates = events.map(function (e) { return e.event_id; });
    disc.updated_at = nowISO();

    // 6 — mandate confidence update (deep lane only)
    var affectedMandates = updateMandateConfidence(orgId, validated, openContradictions, store);

    // 7 — mark emergent outcomes stale (never auto-regenerate)
    var staleOutcomes = markOutcomesStale(orgId, store);

    OF.save(store);
    return {
      organization_id: orgId,
      events: events,
      validated: validated.map(function (v) { return v.dimension; }),
      contradicted: contradicted.map(function (v) { return v.dimension; }),
      open_contradictions: openContradictions.length,
      recompute: recompute,
      affected_mandates: affectedMandates,
      stale_outcomes: staleOutcomes
    };
  }

  function changeType(prev, next, isContra, conf) {
    if (isContra) return 'contradicted';
    if (!prev || prev === 'unknown') return 'unknown_to_known';
    var pi = lvlIdx(prev), ni = lvlIdx(next);
    if (pi === -1 || ni === -1) return 'refined';
    if (ni > pi) return 'strengthened';
    if (ni < pi) return 'weakened';
    return conf === 'high' ? 'confirmed' : 'refined';
  }

  /* tier-0 estimate → level for a dimension (the public read the
     stakeholder confirmed). Falls back to the gap, then moderate. */
  function tier0Level(orgId, dim, store) {
    if (OF.research && OF.research.getResearchForOrg) {
      var r = OF.research.getResearchForOrg(orgId);
      if (r && r.frequency && r.frequency.dimension_estimates) {
        var est = r.frequency.dimension_estimates.filter(function (d) { return d.dimension === dim; })[0];
        if (est) return mapEstimate(est.estimate);
      }
    }
    var gap = (store.frequency_gaps || []).filter(function (g) {
      var mis = byId(store.missions, 'mission_id', g.mission_id); return mis && mis.organization_id === orgId;
    })[0];
    if (gap) {
      var dg = (gap.dimension_gaps || []).filter(function (d) { return d.dimension === dim; })[0];
      if (dg && dg.current_level !== 'unknown') return dg.current_level;
      if (dg) return dg.required_level;
    }
    return 'moderate';
  }
  function mapEstimate(t) {
    t = (t || '').toLowerCase();
    if (/very high|critical/.test(t)) return 'high';
    if (/\bhigh\b|strong|accelerat/.test(t)) return 'high';
    if (/low|strain|informal|weak|early|nascent/.test(t)) return 'low';
    if (/moderate|medium|becoming|emerging|developing/.test(t)) return 'moderate';
    return 'moderate';
  }

  /* ==========================================================
     MANDATE CONFIDENCE UPDATE — deep lane may move to validated
     only after discovery promotion. Fast lane stays tier0_only.
     ========================================================== */
  function updateMandateConfidence(orgId, validated, openContradictions, store) {
    var affected = [];
    (store.mandates || []).filter(function (m) { return m.organization_id === orgId; }).forEach(function (m) {
      if (m.lane_type !== 'deep') {
        m.mandate_confidence_basis = 'tier0_only';
        return; // fast lane unchanged unless manually upgraded
      }
      var basis, conf;
      if (openContradictions.length > 0) { basis = 'contradictions_unresolved'; conf = 'mixed'; }
      else if (validated.filter(function (v) { return v.confidence === 'high'; }).length >= 5) { basis = 'deep_discovery_validated'; conf = 'validated'; }
      else if (validated.length > 0) { basis = 'partially_validated'; conf = 'medium'; }
      else { basis = 'tier0_only'; conf = m.confidence; }
      m.mandate_confidence_basis = basis;
      m.confidence = conf;
      m.updated_at = nowISO();
      affected.push({ mandate_id: m.mandate_id, role_id: m.role_id, basis: basis, confidence: conf });
    });
    return affected;
  }

  /* ==========================================================
     OUTCOME STALENESS — mark, never auto-regenerate.
     ========================================================== */
  function markOutcomesStale(orgId, store) {
    var stale = [];
    (store.emergent_outcomes || []).filter(function (o) { return o.organization_id === orgId && o.generated; }).forEach(function (o) {
      o.stale = true;
      o.stale_reason = 'The underlying organization frequency changed after deep-discovery promotion. Regenerate to refresh these futures.';
      o.updated_at = nowISO();
      stale.push(o.outcome_id);
    });
    return stale;
  }

  /* ==========================================================
     READS for the admin
     ========================================================== */
  function getEvolution(orgId, store) {
    store = ensure(store || OF.load());
    var org = byId(store.organizations, 'organization_id', orgId);
    if (!org) return null;
    var disc = (store.discovery_missions || []).filter(function (d) { return d.organization_id === orgId; })[0];
    var report = (store.discovery_reports || []).filter(function (r) { return r.organization_id === orgId; })[0];
    var events = (store.frequency_evolution_events || []).filter(function (e) { return e.organization_id === orgId; });
    return {
      organization: org,
      discovery: disc || null,
      report: report || null,
      promoted: !!events.length,
      living_frequency: org.living_frequency || { dimensions: [] },
      events: events.slice().sort(function (a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); }),
      open_contradictions: (store.contradiction_maps || []).filter(function (c) { return c.organization_id === orgId && (c.status === 'open' || c.status === 'reviewing'); }),
      resolved_contradictions: (store.contradiction_maps || []).filter(function (c) { return c.organization_id === orgId && (c.status === 'reviewed' || c.status === 'resolved'); }),
      mandates: (store.mandates || []).filter(function (m) { return m.organization_id === orgId; }),
      stale_outcomes: (store.emergent_outcomes || []).filter(function (o) { return o.organization_id === orgId && o.stale; }),
      can_promote: !!report
    };
  }

  function byId(arr, key, val) { return (arr || []).filter(function (x) { return x[key] === val; })[0] || null; }

  OF.evolution = {
    CHANGE_TYPES: CHANGE_TYPES,
    ensure: ensure,
    newEvent: newEvent,
    ensureLiving: ensureLiving,
    promoteDiscoveryToFrequency: promoteDiscoveryToFrequency,
    updateMandateConfidence: updateMandateConfidence,
    markOutcomesStale: markOutcomesStale,
    getEvolution: getEvolution,
    tier0Level: tier0Level,
    human: human
  };
})();
