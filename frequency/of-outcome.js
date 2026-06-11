/* =============================================================
   Organizational Frequency — Emergent Outcome Framework  (Build 1H)
   =============================================================
   Builds on 1A–1G WITHOUT changing the architecture.

   The runtime now understands a Mission, an Organization
   Frequency, a Role Frequency and a Person Frequency. But the
   purpose of the doctrine was never matching. It is understanding
   ONE thing:

       What future becomes more likely when a person enters a
       role inside an organization pursuing a mission?

   Resonance is not similarity, compatibility, or a fit score.
   Resonance is PRODUCTIVE EMERGENCE. This build defines that
   future — as STRUCTURE, not prediction.

   HARD CONSTRAINTS (this build):
     • These objects are CONTAINERS, not predictions.
     • No forecasting logic. No generation. Nothing is produced
       automatically. We frame an empty, traceable future and
       stop. The Emergent Outcome ENGINE is Build 1I.
     • Outcomes must never appear certain — every container
       carries Assumptions, and confidence is UNASSESSED (null).
     • No outcome exists without traceability — every container
       carries Evidence links back to the Mission, Frequency,
       Validation, Role and Person it stands on.
     • Memory stays gated: this writes ONLY outcome containers.
       It does not touch Essence, Transformation, Resonance, or
       Frequency.

   Augments window.OF with window.OF.outcome.
   ============================================================= */
(function () {
  'use strict';
  if (!window.OF) { console.warn('of-outcome.js requires of-model.js'); return; }
  var OF = window.OF;

  var TIME_HORIZONS = ['30_days', '90_days', '180_days', '365_days'];

  // The standing caveats every outcome carries so it can never
  // appear certain. These are doctrinal assumptions, NOT generated
  // predictions — they are the conditions under which any future
  // would even be discussable.
  var DEFAULT_ASSUMPTIONS = [
    'This assumes the role receives sufficient authority to act.',
    'This assumes mission priorities remain stable over the horizon.',
    'This assumes onboarding succeeds and the person integrates.'
  ];

  function nowISO() { return new Date().toISOString(); }
  function uid(p) { return OF.uid(p); }

  function ensure(store) {
    store.emergent_outcomes = store.emergent_outcomes || [];
    store.mission_outcomes = store.mission_outcomes || [];
    store.person_outcomes = store.person_outcomes || [];
    store.organization_outcomes = store.organization_outcomes || [];
    store.capability_outcomes = store.capability_outcomes || [];
    store.risk_outcomes = store.risk_outcomes || [];
    store.evolution_outcomes = store.evolution_outcomes || [];
    return store;
  }

  /* ==========================================================
     BUILD OBJECT 1 — EMERGENT OUTCOME
     The container that binds Mission + Organization + Role +
     Person at a time horizon. Confidence is UNASSESSED (null):
     this is a frame, not a forecast.
     ========================================================== */
  function newEmergentOutcome(f) {
    f = f || {};
    return {
      outcome_id: f.outcome_id || uid('out'),
      mission_id: f.mission_id || null,
      organization_id: f.organization_id || null,
      role_id: f.role_id || null,
      person_id: f.person_id || null,
      time_horizon: TIME_HORIZONS.indexOf(f.time_horizon) !== -1 ? f.time_horizon : '90_days',
      outcome_summary: f.outcome_summary || '',
      confidence: (typeof f.confidence === 'number') ? f.confidence : null, // null = unassessed
      assumptions: f.assumptions || [],
      evidence: f.evidence || [],   // traceability links — never empty by construction
      reasoning: f.reasoning || '',
      generated: f.generated || false,        // 1I: has the engine filled the containers?
      generated_at: f.generated_at || null,
      stale: f.stale || false,                // 1L: underlying frequency changed since generation
      stale_reason: f.stale_reason || '',
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }

  /* ==========================================================
     BUILD OBJECT 2 — MISSION OUTCOME
     How might mission execution change? (container)
     ========================================================== */
  function newMissionOutcome(f) {
    f = f || {};
    return {
      mission_outcome_id: f.mission_outcome_id || uid('mout'),
      outcome_id: f.outcome_id || null,
      summary: f.summary || '',
      positive_trajectories: f.positive_trajectories || [],
      negative_trajectories: f.negative_trajectories || [],
      confidence: (f.confidence != null) ? f.confidence : null,
      assumptions: f.assumptions || [],
      evidence: f.evidence || [],
      reasoning: f.reasoning || '',
      generated: f.generated || false,
      generated_at: f.generated_at || null,
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }

  /* ==========================================================
     BUILD OBJECT 3 — PERSON OUTCOME
     What future becomes more likely for the person? (container)
     ========================================================== */
  function newPersonOutcome(f) {
    f = f || {};
    return {
      person_outcome_id: f.person_outcome_id || uid('pout'),
      outcome_id: f.outcome_id || null,
      summary: f.summary || '',
      growth_vectors: f.growth_vectors || [],
      stagnation_vectors: f.stagnation_vectors || [],
      stress_vectors: f.stress_vectors || [],
      confidence: (f.confidence != null) ? f.confidence : null,
      assumptions: f.assumptions || [],
      evidence: f.evidence || [],
      reasoning: f.reasoning || '',
      generated: f.generated || false,
      generated_at: f.generated_at || null,
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }

  /* ==========================================================
     BUILD OBJECT 4 — ORGANIZATION OUTCOME
     What future becomes more likely for the organization?
     ========================================================== */
  function newOrganizationOutcome(f) {
    f = f || {};
    return {
      organization_outcome_id: f.organization_outcome_id || uid('oout'),
      outcome_id: f.outcome_id || null,
      summary: f.summary || '',
      capability_gains: f.capability_gains || [],
      capability_losses: f.capability_losses || [],
      cultural_effects: f.cultural_effects || [],
      confidence: (f.confidence != null) ? f.confidence : null,
      assumptions: f.assumptions || [],
      evidence: f.evidence || [],
      reasoning: f.reasoning || '',
      generated: f.generated || false,
      generated_at: f.generated_at || null,
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }

  /* ==========================================================
     BUILD OBJECT 5 — CAPABILITY OUTCOME
     What organizational capabilities emerge? (container)
     ========================================================== */
  function newCapabilityOutcome(f) {
    f = f || {};
    return {
      capability_outcome_id: f.capability_outcome_id || uid('cout'),
      outcome_id: f.outcome_id || null,
      capabilities_strengthened: f.capabilities_strengthened || [],
      capabilities_weakened: f.capabilities_weakened || [],
      confidence: (f.confidence != null) ? f.confidence : null,
      assumptions: f.assumptions || [],
      evidence: f.evidence || [],
      reasoning: f.reasoning || '',
      generated: f.generated || false,
      generated_at: f.generated_at || null,
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }

  /* ==========================================================
     BUILD OBJECT 6 — RISK OUTCOME
     What new risks become more likely? (container)
     ========================================================== */
  function newRiskOutcome(f) {
    f = f || {};
    return {
      risk_outcome_id: f.risk_outcome_id || uid('rout'),
      outcome_id: f.outcome_id || null,
      identified_risks: f.identified_risks || [],
      risk_mitigations: f.risk_mitigations || [],
      confidence: (f.confidence != null) ? f.confidence : null,
      assumptions: f.assumptions || [],
      evidence: f.evidence || [],
      reasoning: f.reasoning || '',
      generated: f.generated || false,
      generated_at: f.generated_at || null,
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }

  /* ==========================================================
     BUILD OBJECT 7 — EVOLUTION OUTCOME
     How may all three evolve together over time? The most
     important outcome object. (container)
     ========================================================== */
  function newEvolutionOutcome(f) {
    f = f || {};
    return {
      evolution_outcome_id: f.evolution_outcome_id || uid('eout'),
      outcome_id: f.outcome_id || null,
      organization_evolution: f.organization_evolution || '',
      person_evolution: f.person_evolution || '',
      role_evolution: f.role_evolution || '',
      confidence: (f.confidence != null) ? f.confidence : null,
      assumptions: f.assumptions || [],
      evidence: f.evidence || [],
      reasoning: f.reasoning || '',
      generated: f.generated || false,
      generated_at: f.generated_at || null,
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }

  /* ==========================================================
     TRACEABILITY — Evidence links (no outcome without it)
     ==========================================================
     This is the ONLY thing 1H "computes": it points the outcome
     container back at the records it would stand on. These are
     pointers, not predictions. Each entry is a link, not a claim.
  */
  function buildTraceability(ctx, store) {
    var links = [];
    function link(kind, id, label) { links.push({ kind: kind, ref_id: id || null, label: label || '' }); }

    var mis = ctx.mission, org = ctx.organization, role = ctx.role, per = ctx.person;

    if (mis) link('mission', mis.mission_id, mis.mission_name || mis.desired_outcome || 'Mission');
    if (org) link('organization', org.organization_id, org.organization_name || 'Organization');

    // organization frequency (validated dimensions count)
    if (org) {
      var pf = org.preliminary_frequency;
      var nFreq = pf && pf.dimensions ? pf.dimensions.length : 0;
      link('organization_frequency', org.organization_id, nFreq + ' validated dimension' + (nFreq === 1 ? '' : 's') + ' on the living org frequency');
    }
    // organization-side gap + required validations (grounding)
    var gap = (store.frequency_gaps || []).filter(function (g) { return mis && g.mission_id === mis.mission_id; })[0];
    if (gap) link('frequency_gap', gap.gap_id, gap.gap_summary);

    if (role) {
      link('role', role.role_id, role.role_name + ' — ' + role.role_purpose.slice(0, 80));
      var rf = (store.role_frequencies || []).filter(function (x) { return x.role_id === role.role_id; })[0];
      if (rf) link('role_frequency', rf.role_frequency_id, rf.frequency_summary);
    }

    if (per) {
      link('person', per.person_id, per.name || 'Person');
      var perf = (store.person_frequencies || []).filter(function (x) { return x.person_id === per.person_id; })[0];
      if (perf) {
        var known = (perf.dimensions || []).filter(function (d) { return d.level !== 'unknown'; }).length;
        link('person_frequency', perf.person_frequency_id, known + ' validated dimension' + (known === 1 ? '' : 's') + ' on the person frequency');
      }
      var pUnd = (store.validated_person_understandings || []).filter(function (u) { return u.person_id === per.person_id; }).length;
      if (pUnd) link('person_validation', per.person_id, pUnd + ' validated person understanding' + (pUnd === 1 ? '' : 's'));
    }

    // org validated understanding (validation lineage)
    if (org) {
      var oUnd = (store.validated_understandings || []).filter(function (u) { return u.organization_id === org.organization_id; }).length;
      if (oUnd) link('organization_validation', org.organization_id, oUnd + ' validated organization understanding' + (oUnd === 1 ? '' : 's'));
    }

    return links;
  }

  /* ==========================================================
     FRAME an outcome — create the empty, traceable container set.
     This does NOT generate any future. It binds the four objects
     at a horizon, attaches traceability + standing assumptions,
     and creates the six EMPTY sub-outcome containers. The engine
     (1I) is what will later fill the vectors.
     ========================================================== */
  function frameOutcome(roleId, personId, timeHorizon, store) {
    store = ensure(store || OF.load());
    var role = byId(store.roles, 'role_id', roleId);
    var per = byId(store.persons, 'person_id', personId);
    if (!role || !per) return null;
    var mis = byId(store.missions, 'mission_id', role.mission_id);
    var org = byId(store.organizations, 'organization_id', role.organization_id);

    var ctx = { mission: mis, organization: org, role: role, person: per };

    var outcome = newEmergentOutcome({
      mission_id: role.mission_id,
      organization_id: role.organization_id,
      role_id: role.role_id,
      person_id: per.person_id,
      time_horizon: timeHorizon,
      outcome_summary: 'A frame for the futures that become more likely if ' +
        (per.name || 'this person') + ' enters the ' + role.role_name + ' role at ' +
        (org ? org.organization_name : 'the organization') + ', in service of the mission — held at ' +
        humanHorizon(timeHorizon) + '. A container, not a forecast. Awaiting the Emergent Outcome Engine.',
      assumptions: DEFAULT_ASSUMPTIONS.slice(),
      evidence: buildTraceability(ctx, store)
    });
    store.emergent_outcomes.push(outcome);

    // The six EMPTY sub-outcome containers. No vectors are filled.
    store.mission_outcomes.push(newMissionOutcome({ outcome_id: outcome.outcome_id }));
    store.person_outcomes.push(newPersonOutcome({ outcome_id: outcome.outcome_id }));
    store.organization_outcomes.push(newOrganizationOutcome({ outcome_id: outcome.outcome_id }));
    store.capability_outcomes.push(newCapabilityOutcome({ outcome_id: outcome.outcome_id }));
    store.risk_outcomes.push(newRiskOutcome({ outcome_id: outcome.outcome_id }));
    store.evolution_outcomes.push(newEvolutionOutcome({ outcome_id: outcome.outcome_id }));

    OF.save(store);
    return getForOutcome(outcome.outcome_id, store);
  }

  /* ---- assumption tracking (human-added caveats) ------------ */
  function addAssumption(outcomeId, text, store) {
    store = ensure(store || OF.load());
    var o = byId(store.emergent_outcomes, 'outcome_id', outcomeId);
    if (!o || !text || !text.trim()) return null;
    o.assumptions.push(text.trim());
    o.updated_at = nowISO();
    OF.save(store);
    return o;
  }
  function removeAssumption(outcomeId, index, store) {
    store = ensure(store || OF.load());
    var o = byId(store.emergent_outcomes, 'outcome_id', outcomeId);
    if (!o) return null;
    o.assumptions.splice(index, 1);
    o.updated_at = nowISO();
    OF.save(store);
    return o;
  }

  function deleteOutcome(outcomeId, store) {
    store = ensure(store || OF.load());
    store.emergent_outcomes = store.emergent_outcomes.filter(function (o) { return o.outcome_id !== outcomeId; });
    store.mission_outcomes = store.mission_outcomes.filter(function (x) { return x.outcome_id !== outcomeId; });
    store.person_outcomes = store.person_outcomes.filter(function (x) { return x.outcome_id !== outcomeId; });
    store.organization_outcomes = store.organization_outcomes.filter(function (x) { return x.outcome_id !== outcomeId; });
    store.capability_outcomes = store.capability_outcomes.filter(function (x) { return x.outcome_id !== outcomeId; });
    store.risk_outcomes = store.risk_outcomes.filter(function (x) { return x.outcome_id !== outcomeId; });
    store.evolution_outcomes = store.evolution_outcomes.filter(function (x) { return x.outcome_id !== outcomeId; });
    OF.save(store);
  }

  /* ---- reads ------------------------------------------------ */
  function getForOutcome(outcomeId, store) {
    store = ensure(store || OF.load());
    var o = byId(store.emergent_outcomes, 'outcome_id', outcomeId);
    if (!o) return null;
    return {
      outcome: o,
      mission: byId(store.missions, 'mission_id', o.mission_id),
      organization: byId(store.organizations, 'organization_id', o.organization_id),
      role: byId(store.roles, 'role_id', o.role_id),
      person: byId(store.persons, 'person_id', o.person_id),
      mission_outcome: bySub(store.mission_outcomes, outcomeId),
      person_outcome: bySub(store.person_outcomes, outcomeId),
      organization_outcome: bySub(store.organization_outcomes, outcomeId),
      capability_outcome: bySub(store.capability_outcomes, outcomeId),
      risk_outcome: bySub(store.risk_outcomes, outcomeId),
      evolution_outcome: bySub(store.evolution_outcomes, outcomeId)
    };
  }
  function getOutcomes(store) {
    store = ensure(store || OF.load());
    return store.emergent_outcomes.slice()
      .sort(function (a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); })
      .map(function (o) { return getForOutcome(o.outcome_id, store); });
  }

  /* ---- frameable inputs for the admin compose control -------
     Defined (non-retired) roles joined with mission + org, and the
     people that have been discovered. The outcome can only be
     framed where BOTH a defined role and a person exist — the
     convergence of the whole runtime. */
  function frameable(store) {
    store = ensure(store || OF.load());
    var roles = (store.roles || []).filter(function (r) { return r.role_stage !== 'retired'; })
      .map(function (r) {
        var mis = byId(store.missions, 'mission_id', r.mission_id);
        var org = byId(store.organizations, 'organization_id', r.organization_id);
        return {
          role_id: r.role_id,
          label: r.role_name + ' · ' + (mis ? (mis.mission_name || 'mission') : 'mission') + ' · ' + (org ? org.organization_name : 'org')
        };
      });
    var people = (store.persons || []).map(function (p) {
      return { person_id: p.person_id, label: (p.name || 'Unnamed') + (p.current_title ? ' · ' + p.current_title : '') };
    });
    return { roles: roles, people: people, horizons: TIME_HORIZONS };
  }

  /* ---- helpers ---------------------------------------------- */
  function humanHorizon(h) {
    return ({ '30_days': '30 days', '90_days': '90 days', '180_days': '180 days', '365_days': '365 days' })[h] || h;
  }
  function bySub(arr, outcomeId) { return (arr || []).filter(function (x) { return x.outcome_id === outcomeId; })[0] || null; }
  function byId(arr, key, val) { return (arr || []).filter(function (x) { return x[key] === val; })[0] || null; }

  OF.outcome = {
    TIME_HORIZONS: TIME_HORIZONS,
    DEFAULT_ASSUMPTIONS: DEFAULT_ASSUMPTIONS,
    ensure: ensure,
    newEmergentOutcome: newEmergentOutcome,
    newMissionOutcome: newMissionOutcome,
    newPersonOutcome: newPersonOutcome,
    newOrganizationOutcome: newOrganizationOutcome,
    newCapabilityOutcome: newCapabilityOutcome,
    newRiskOutcome: newRiskOutcome,
    newEvolutionOutcome: newEvolutionOutcome,
    buildTraceability: buildTraceability,
    frameOutcome: frameOutcome,
    addAssumption: addAssumption,
    removeAssumption: removeAssumption,
    deleteOutcome: deleteOutcome,
    getForOutcome: getForOutcome,
    getOutcomes: getOutcomes,
    frameable: frameable,
    humanHorizon: humanHorizon
  };
})();
