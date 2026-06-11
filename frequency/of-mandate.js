/* =============================================================
   Organizational Frequency — Mission-to-Mandate Runtime  (Build 1J)
   =============================================================
   Builds on 1A–1I WITHOUT changing the architecture.

   The runtime can UNDERSTAND (mission → frequency → role → person
   → emergent futures). It cannot yet be USED to act. The bridge
   between understanding and execution is the MANDATE.

       Organizations do not buy frequency. They buy outcomes.

   So the runtime converts:

       Mission → Frequency Gap → Role  ==>  MANDATE

   that can be executed. Two paths:

     • FAST LANE (free)  — start quickly: mission + Tier-0 + a
       basic frequency read + role → mandate. Lighter confidence.
     • DEEP LANE (paid)  — understand before acting: deep
       organizational discovery (founder / hiring-manager /
       supervisor / skip-level interviews) → richer analysis →
       deep mandate. Higher confidence. The actual Deep Discovery
       Runtime is Build 1K — here we create only HOOKS.

   CONSTITUTIONAL RULE (enforced here):
       A mandate must answer "WHY does this role exist?" BEFORE
       "who should fill it?". The mandate is derived ONLY from the
       role purpose, the gap it closes and the mission — never
       from a person. No sourcing, matching, or candidates.

   MEMORY: stores Mandate / SuccessDefinition / MissionContribution
   / LaneSelection only. Does NOT modify Essence, Transformation,
   Resonance, Person Frequency or Organization Frequency.

   Augments window.OF with window.OF.mandate.
   ============================================================= */
(function () {
  'use strict';
  if (!window.OF) { console.warn('of-mandate.js requires of-model.js'); return; }
  var OF = window.OF;

  var LANE_TYPES = ['fast', 'deep'];
  var MANDATE_STATUS = ['draft', 'active', 'paused', 'completed', 'cancelled'];
  // Deep-lane interview hooks — placeholders only. The Deep Discovery
  // Runtime that actually runs these is Build 1K.
  var DEEP_INTERVIEWS = ['founder', 'hiring_manager', 'supervisor', 'skip_level'];
  var CONFIDENCE_VALUES = (OF.outcome && OF.outcome.CONFIDENCE_VALUES) || ['low', 'medium', 'high', 'mixed', 'unknown'];

  var human = (OF.frequency && OF.frequency.human) || function (l) { return l === 'very_high' ? 'very high' : l; };
  function nowISO() { return new Date().toISOString(); }
  function uid(p) { return OF.uid(p); }
  function lc(s) { return (s == null) ? s : String(s).charAt(0).toLowerCase() + String(s).slice(1); }
  function lcAll(s) { return (s == null) ? s : String(s).toLowerCase(); }

  function ensure(store) {
    store.mandates = store.mandates || [];
    store.mandate_success_definitions = store.mandate_success_definitions || [];
    store.mission_contributions = store.mission_contributions || [];
    store.lane_selections = store.lane_selections || [];
    return store;
  }

  /* ==========================================================
     BUILD OBJECT 1 — MANDATE
     The executable intent. success_definition / mission_contribution
     are stored by reference id (the established pattern).
     ========================================================== */
  function newMandate(f) {
    f = f || {};
    return {
      mandate_id: f.mandate_id || uid('man'),
      organization_id: f.organization_id || null,
      mission_id: f.mission_id || null,
      role_id: f.role_id || null,
      lane_type: LANE_TYPES.indexOf(f.lane_type) !== -1 ? f.lane_type : 'fast',
      mandate_status: MANDATE_STATUS.indexOf(f.mandate_status) !== -1 ? f.mandate_status : 'draft',
      mandate_summary: f.mandate_summary || '',
      success_definition_id: f.success_definition_id || null,   // → MandateSuccessDefinition
      mission_contribution_id: f.mission_contribution_id || null, // → MissionContribution
      confidence: CONFIDENCE_VALUES.indexOf(f.confidence) !== -1 ? f.confidence : 'unknown', // descriptive
      // 1L: what the confidence rests on — tier0_only | deep_discovery_validated |
      // partially_validated | contradictions_unresolved
      mandate_confidence_basis: f.mandate_confidence_basis || 'tier0_only',
      // DEEP-LANE HOOK — placeholder only (Build 1K runs it)
      deep_discovery: f.deep_discovery || null,
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }

  /* ==========================================================
     BUILD OBJECT 2 — MANDATE SUCCESS DEFINITION
     What does success look like? (not: who should we hire?)
     ========================================================== */
  function newSuccessDefinition(f) {
    f = f || {};
    return {
      success_definition_id: f.success_definition_id || uid('sdef'),
      mandate_id: f.mandate_id || null,
      role_success: f.role_success || '',
      mission_success: f.mission_success || '',
      organization_success: f.organization_success || '',
      time_horizon: f.time_horizon || '',
      confidence: CONFIDENCE_VALUES.indexOf(f.confidence) !== -1 ? f.confidence : 'unknown',
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }

  /* ==========================================================
     BUILD OBJECT 3 — MISSION CONTRIBUTION
     Why does this mandate exist? (mandate-scoped — distinct from
     the 1F RoleContribution)
     ========================================================== */
  function newMissionContribution(f) {
    f = f || {};
    return {
      contribution_id: f.contribution_id || uid('mcon'),
      mandate_id: f.mandate_id || null,
      role_id: f.role_id || null,
      contribution_summary: f.contribution_summary || '',
      frequency_gaps_addressed: f.frequency_gaps_addressed || [],
      expected_capabilities_created: f.expected_capabilities_created || [],
      confidence: CONFIDENCE_VALUES.indexOf(f.confidence) !== -1 ? f.confidence : 'unknown',
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }

  /* ==========================================================
     BUILD OBJECT 4 — LANE SELECTION
     Record why the organization chose a path.
     ========================================================== */
  function newLaneSelection(f) {
    f = f || {};
    return {
      selection_id: f.selection_id || uid('lane'),
      organization_id: f.organization_id || null,
      selected_lane: LANE_TYPES.indexOf(f.selected_lane) !== -1 ? f.selected_lane : 'fast',
      reason: f.reason || '',
      created_at: f.created_at || nowISO()
    };
  }

  /* ==========================================================
     THE TWO LANES — honest descriptions for Aeon1.
     Explain benefits honestly. Do not pressure. Do not upsell.
     ========================================================== */
  var LANES = {
    fast: {
      key: 'fast', title: 'Fast Lane', price: 'free',
      tagline: 'Start quickly.',
      blurb: 'We work from the mission, public (Tier-0) research and a basic frequency read to generate a mandate you can act on now. Minimal friction, no interviews, no paid analysis. Confidence is lighter because the understanding is lighter — but you can begin immediately.',
      good_for: ['We need a Head of Sales.', 'We need 10 engineers.', 'We need a Product Manager.'],
      flow: ['Mission', 'Tier-0 Research', 'Frequency', 'Role', 'Mandate', 'Done']
    },
    deep: {
      key: 'deep', title: 'Deep Lane', price: 'paid',
      tagline: 'Understand before acting.',
      blurb: 'We run deep organizational discovery — founder, hiring-manager, supervisor and skip-level interviews — for a richer frequency analysis and stronger emergent outcomes. It takes longer and costs more, and in return the mandate rests on validated understanding rather than public signal.',
      good_for: ['We are scaling.', 'We are entering a new market.', 'We need to understand who we need.', 'We want better organizational alignment.'],
      flow: ['Mission', 'Tier-0 Research', 'Frequency', 'Role', 'Deep Discovery Proposal', 'Deep Mandate', 'Done']
    }
  };

  /* ==========================================================
     GENERATE A MANDATE from a defined role + chosen lane.
     Constitutional: built from role purpose + gap + mission. No
     person is read. Idempotent per role (regenerating replaces).
     ========================================================== */
  function generateMandate(roleId, lane, reason, store) {
    store = ensure(store || OF.load());
    lane = LANE_TYPES.indexOf(lane) !== -1 ? lane : 'fast';
    var role = byId(store.roles, 'role_id', roleId);
    if (!role || role.role_stage === 'retired') return null;
    var mission = byId(store.missions, 'mission_id', role.mission_id);
    var org = byId(store.organizations, 'organization_id', role.organization_id);
    var gap = byId(store.frequency_gaps, 'gap_id', role.gap_id) ||
      (store.frequency_gaps || []).filter(function (g) { return g.mission_id === role.mission_id; })[0] || null;
    var roleContribution = (store.role_contributions || []).filter(function (c) { return c.role_id === roleId; })[0] || null;
    var dimGap = gap ? (gap.dimension_gaps || []).filter(function (d) { return d.dimension === role.dimension; })[0] : null;

    // record the lane choice
    recordLaneSelection(org ? org.organization_id : role.organization_id, lane, reason, store);

    // remove any prior mandate for this role (and its children)
    removeMandateForRole(roleId, store);

    var conf = assessConfidence(role, gap, dimGap, lane);

    // --- MANDATE (why this role exists, FIRST) ---
    var mandate = newMandate({
      organization_id: role.organization_id,
      mission_id: role.mission_id,
      role_id: role.role_id,
      lane_type: lane,
      mandate_status: 'draft',
      confidence: conf,
      mandate_summary: 'Why this role exists — ' + ensurePeriod(role.role_purpose || ('to close the ' + lcAll(role.dimension || 'frequency') + ' gap.')) +
        ' This mandate turns that purpose into executable intent' +
        (lane === 'deep' ? ', pending deep organizational discovery.' : ' from the mission and a Tier-0 frequency read.'),
      deep_discovery: lane === 'deep' ? newDeepDiscoveryHook() : null
    });

    // --- MISSION CONTRIBUTION (why the mandate exists) ---
    var gapsAddressed = [];
    if (dimGap) gapsAddressed.push(role.dimension + ' — ' + dimGap.gap_level + ' gap (required ' + human(dimGap.required_level) + ' vs current ' + human(dimGap.current_level) + ')');
    else if (role.dimension) gapsAddressed.push(role.dimension + ' gap');
    var capabilities = (roleContribution && roleContribution.dimensions_affected || [role.dimension]).filter(Boolean)
      .map(function (dn) { return 'Internal ' + lcAll(dn) + ' capability held by the organization rather than outsourced or absent'; });

    var contribution = newMissionContribution({
      mandate_id: mandate.mandate_id,
      role_id: role.role_id,
      contribution_summary: (roleContribution && roleContribution.contribution_summary) ||
        (role.role_name + ' exists to raise ' + lcAll(role.dimension || 'the organization\u2019s frequency') + ' where the mission needs more than the organization currently has.'),
      frequency_gaps_addressed: gapsAddressed,
      expected_capabilities_created: capabilities,
      confidence: conf
    });
    store.mission_contributions.push(contribution);

    // --- SUCCESS DEFINITION (what success looks like) ---
    var horizon = (mission && mission.time_horizon) ? mission.time_horizon : 'the mission horizon';
    var sdef = newSuccessDefinition({
      mandate_id: mandate.mandate_id,
      role_success: role.role_success_definition ||
        (role.dimension + ' moves toward what the mission requires, visible in how the work actually runs.'),
      mission_success: 'The mission' + (mission && (mission.mission_name || mission.desired_outcome) ? ' \u2014 ' + (mission.desired_outcome || mission.mission_name) + ' \u2014' : '') +
        ' becomes more executable as the ' + lcAll(role.dimension || 'frequency') + ' gap closes.',
      organization_success: (org ? org.organization_name : 'The organization') + ' may come to hold ' + lcAll(role.dimension || 'this capability') +
        ' internally' + (dimGap ? ' (today a ' + dimGap.gap_level + ' gap)' : '') + ', rather than the founder or an outside party absorbing the work.',
      time_horizon: horizon,
      confidence: conf
    });
    store.mandate_success_definitions.push(sdef);

    // link the references onto the mandate
    mandate.success_definition_id = sdef.success_definition_id;
    mandate.mission_contribution_id = contribution.contribution_id;
    store.mandates.push(mandate);

    OF.save(store);
    return getForMandate(mandate.mandate_id, store);
  }

  function newDeepDiscoveryHook() {
    return {
      proposed: true,
      status: 'not_started',                 // Build 1K runs this
      note: 'Deep Discovery Runtime — Build 1K. These interviews are proposed, not yet run.',
      interviews: DEEP_INTERVIEWS.map(function (t) { return { type: t, status: 'proposed', ran_at: null }; })
    };
  }

  /* ---- confidence — descriptive, honest about the lane -------
     Fast lane rests on Tier-0 + a basic frequency read, so it is
     capped (never 'high'). Deep lane is 'pending' until 1K runs
     the discovery — also capped here, since the discovery has not
     happened yet. Role/gap clarity moves it within those caps. */
  function assessConfidence(role, gap, dimGap, lane) {
    var roleClear = role && (role.role_stage === 'validated' || role.role_stage === 'active' || (role.confidence || 0) >= 0.5);
    var gapKnown = dimGap && dimGap.gap_level && dimGap.gap_level !== 'unknown';
    var bothValidated = dimGap && dimGap.required_validated && dimGap.current_validated;

    if (lane === 'fast') {
      if (roleClear && gapKnown) return 'medium';
      if (!gapKnown) return 'low';
      return 'low';
    }
    // deep lane — discovery not yet run (1K)
    if (bothValidated && roleClear) return 'medium';
    return 'mixed'; // promising but pending deep discovery
  }

  /* ---- lane selection --------------------------------------- */
  function recordLaneSelection(orgId, lane, reason, store) {
    store = ensure(store || OF.load());
    var sel = newLaneSelection({ organization_id: orgId, selected_lane: lane, reason: reason || laneDefaultReason(lane) });
    store.lane_selections.push(sel);
    return sel;
  }
  function laneDefaultReason(lane) {
    return lane === 'deep'
      ? 'Chose to understand before acting — the situation warrants deep organizational discovery.'
      : 'Chose to start quickly — minimal friction, begin execution now.';
  }

  /* ---- status management ------------------------------------ */
  function setStatus(mandateId, status, store) {
    store = ensure(store || OF.load());
    var m = byId(store.mandates, 'mandate_id', mandateId);
    if (!m || MANDATE_STATUS.indexOf(status) === -1) return null;
    m.mandate_status = status;
    m.updated_at = nowISO();
    OF.save(store);
    return m;
  }

  function removeMandateForRole(roleId, store) {
    store = ensure(store || OF.load());
    var existing = store.mandates.filter(function (m) { return m.role_id === roleId; });
    existing.forEach(function (m) {
      store.mandate_success_definitions = store.mandate_success_definitions.filter(function (s) { return s.mandate_id !== m.mandate_id; });
      store.mission_contributions = store.mission_contributions.filter(function (c) { return c.mandate_id !== m.mandate_id; });
    });
    store.mandates = store.mandates.filter(function (m) { return m.role_id !== roleId; });
  }
  function deleteMandate(mandateId, store) {
    store = ensure(store || OF.load());
    var m = byId(store.mandates, 'mandate_id', mandateId);
    if (!m) return;
    store.mandate_success_definitions = store.mandate_success_definitions.filter(function (s) { return s.mandate_id !== mandateId; });
    store.mission_contributions = store.mission_contributions.filter(function (c) { return c.mandate_id !== mandateId; });
    store.mandates = store.mandates.filter(function (x) { return x.mandate_id !== mandateId; });
    OF.save(store);
  }

  /* ---- reads ------------------------------------------------ */
  function getForMandate(mandateId, store) {
    store = ensure(store || OF.load());
    var m = byId(store.mandates, 'mandate_id', mandateId);
    if (!m) return null;
    return {
      mandate: m,
      mission: byId(store.missions, 'mission_id', m.mission_id),
      organization: byId(store.organizations, 'organization_id', m.organization_id),
      role: byId(store.roles, 'role_id', m.role_id),
      gap: byId(store.frequency_gaps, 'gap_id', (byId(store.roles, 'role_id', m.role_id) || {}).gap_id),
      success_definition: byId(store.mandate_success_definitions, 'success_definition_id', m.success_definition_id),
      mission_contribution: byId(store.mission_contributions, 'contribution_id', m.mission_contribution_id)
    };
  }
  function getMandates(store) {
    store = ensure(store || OF.load());
    return store.mandates.slice()
      .sort(function (a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); })
      .map(function (m) { return getForMandate(m.mandate_id, store); });
  }
  // Defined (non-retired) roles, joined with mission + org, flagged
  // whether they already have a mandate — what the admin can mandate.
  function mandatableRoles(store) {
    store = ensure(store || OF.load());
    var withMandate = {};
    store.mandates.forEach(function (m) { withMandate[m.role_id] = m.mandate_id; });
    return (store.roles || []).filter(function (r) { return r.role_stage !== 'retired'; })
      .map(function (r) {
        var mis = byId(store.missions, 'mission_id', r.mission_id);
        var org = byId(store.organizations, 'organization_id', r.organization_id);
        return {
          role_id: r.role_id,
          role_name: r.role_name,
          label: r.role_name + ' · ' + (mis ? (mis.mission_name || 'mission') : 'mission') + ' · ' + (org ? org.organization_name : 'org'),
          has_mandate: !!withMandate[r.role_id],
          mandate_id: withMandate[r.role_id] || null
        };
      });
  }

  /* ---- helpers ---------------------------------------------- */
  function ensurePeriod(s) { s = (s || '').trim(); if (!s) return s; return /[.!?]$/.test(s) ? s : s + '.'; }
  function byId(arr, key, val) { return (arr || []).filter(function (x) { return x[key] === val; })[0] || null; }

  OF.mandate = {
    LANE_TYPES: LANE_TYPES,
    MANDATE_STATUS: MANDATE_STATUS,
    DEEP_INTERVIEWS: DEEP_INTERVIEWS,
    LANES: LANES,
    ensure: ensure,
    newMandate: newMandate,
    newSuccessDefinition: newSuccessDefinition,
    newMissionContribution: newMissionContribution,
    newLaneSelection: newLaneSelection,
    generateMandate: generateMandate,
    recordLaneSelection: recordLaneSelection,
    setStatus: setStatus,
    deleteMandate: deleteMandate,
    getForMandate: getForMandate,
    getMandates: getMandates,
    mandatableRoles: mandatableRoles,
    human: human
  };
})();
