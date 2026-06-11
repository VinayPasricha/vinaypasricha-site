/* =============================================================
   Organizational Frequency — Role Frequency Engine  (Build 1F)
   =============================================================
   Builds on 1A–1E WITHOUT changing the architecture.

   Organizations do not hire people. They create ROLES. Roles
   exist to close mission-frequency gaps:

       Mission → Frequency Gap → Role → Role Frequency → Person → Resonance

   The role is the bridge. This build stops at Role Frequency —
   no person, no resonance, no matching, no sourcing.

   Two hard rules:
     • The role engine activates ONLY for gaps whose intervention
       hypothesis is type 'hiring'. Training / leadership / process
       / structure / communication / research gaps do NOT spawn
       roles.
     • A role must answer "what problem does this role solve?"
       (role_purpose) BEFORE it has a title. Until the purpose is
       stated it stays a RoleHypothesis, never a Role.

   Augments window.OF with window.OF.role.
   ============================================================= */
(function () {
  'use strict';
  if (!window.OF) { console.warn('of-role.js requires of-model.js'); return; }
  var OF = window.OF;

  var ROLE_STAGES = ['proposed', 'defined', 'validated', 'active', 'filled', 'retired'];
  var PRIORITIES = ['low', 'medium', 'high', 'critical'];
  var DIMENSIONS = (OF.frequency && OF.frequency.DIMENSIONS) || (OF.research && OF.research.DIMENSIONS) || [];
  var human = (OF.frequency && OF.frequency.human) || function (l) { return l === 'very_high' ? 'very high' : l; };

  function nowISO() { return new Date().toISOString(); }
  function uid(p) { return OF.uid(p); }
  function round(n) { return Math.round(n * 100) / 100; }

  function ensure(store) {
    store.role_hypotheses = store.role_hypotheses || [];
    store.roles = store.roles || [];
    store.role_frequencies = store.role_frequencies || [];
    store.role_contributions = store.role_contributions || [];
    return store;
  }

  /* ---- SCHEMAS ---------------------------------------------- */
  function newRole(f) {
    f = f || {};
    return {
      role_id: f.role_id || uid('role'),
      organization_id: f.organization_id || null,
      mission_id: f.mission_id || null,
      gap_id: f.gap_id || null,
      dimension: f.dimension || null,           // the gap dimension it addresses
      role_name: f.role_name || '',
      role_purpose: f.role_purpose || '',        // the PROBLEM it solves — stated first
      role_success_definition: f.role_success_definition || '',
      role_stage: ROLE_STAGES.indexOf(f.role_stage) !== -1 ? f.role_stage : 'defined',
      priority: PRIORITIES.indexOf(f.priority) !== -1 ? f.priority : 'medium',
      confidence: typeof f.confidence === 'number' ? round(f.confidence) : 0.4,
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }
  function newRoleFrequency(f) {
    f = f || {};
    return {
      role_frequency_id: f.role_frequency_id || uid('rolef'),
      role_id: f.role_id || null,
      frequency_summary: f.frequency_summary || '',
      dimensions: f.dimensions || [],            // [{dimension, required_level, confidence, reasoning, primary}]
      confidence: typeof f.confidence === 'number' ? round(f.confidence) : 0.4,
      reasoning: f.reasoning || '',
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }
  function newRoleContribution(f) {
    f = f || {};
    return {
      contribution_id: f.contribution_id || uid('rc'),
      role_id: f.role_id || null,
      gap_id: f.gap_id || null,
      contribution_summary: f.contribution_summary || '',
      dimensions_affected: f.dimensions_affected || [],
      confidence: typeof f.confidence === 'number' ? round(f.confidence) : 0.4,
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }
  function newRoleHypothesis(f) {
    f = f || {};
    return {
      hypothesis_id: f.hypothesis_id || uid('rh'),
      gap_id: f.gap_id || null,
      organization_id: f.organization_id || null,
      mission_id: f.mission_id || null,
      dimension: f.dimension || null,
      role_name: f.role_name || '',
      rationale: f.rationale || '',
      confidence: typeof f.confidence === 'number' ? round(f.confidence) : 0.3,
      promoted_role_id: f.promoted_role_id || null,
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }

  /* ---- GAP → ROLE HYPOTHESES -------------------------------
     Only gaps with a HIRING intervention generate role
     hypotheses. Idempotent: skips (gap, role_name) already made.
  */
  function syncHypotheses(missionId, store) {
    store = ensure(store || OF.load());
    var mis = byId(store.missions, 'mission_id', missionId);
    if (!mis) return [];
    var gap = (store.frequency_gaps || []).filter(function (g) { return g.mission_id === missionId; })[0];
    if (!gap) return [];
    // hiring interventions only
    var hiring = (store.intervention_hypotheses || []).filter(function (iv) {
      return iv.gap_id === gap.gap_id && iv.intervention_type === 'hiring' && iv.dimension;
    });
    var existing = {};
    store.role_hypotheses.forEach(function (h) {
      if (h.gap_id === gap.gap_id) existing[h.dimension + '|' + h.role_name] = true;
    });

    var created = [];
    hiring.forEach(function (iv) {
      var g = (gap.dimension_gaps || []).filter(function (d) { return d.dimension === iv.dimension; })[0];
      var names = roleCandidates(iv.dimension);
      names.forEach(function (nm) {
        if (existing[iv.dimension + '|' + nm]) return;
        var h = newRoleHypothesis({
          gap_id: gap.gap_id,
          organization_id: mis.organization_id,
          mission_id: missionId,
          dimension: iv.dimension,
          role_name: nm,
          rationale: 'A hiring-type gap on ' + iv.dimension.toLowerCase() +
            (g ? ' (required ' + human(g.required_level) + ' vs current ' + human(g.current_level) + ')' : '') +
            ' might be addressed by a ' + nm + '. Hypothesis — a possible role, not yet a requisition.',
          confidence: iv.confidence
        });
        store.role_hypotheses.push(h);
        created.push(h);
      });
    });
    if (created.length) OF.save(store);
    return created;
  }

  /* ---- PROMOTE a hypothesis to a Role ----------------------
     Requires a stateable purpose. The purpose is derived from the
     gap (which is well-defined), so a role can be defined — but
     the PURPOSE is written first, then the role frequency.
  */
  function defineRole(hypothesisId, opts, store) {
    store = ensure(store || OF.load());
    opts = opts || {};
    var h = byId(store.role_hypotheses, 'hypothesis_id', hypothesisId);
    if (!h) return null;
    var gap = byId(store.frequency_gaps, 'gap_id', h.gap_id);
    var required = (store.required_frequencies || []).filter(function (r) { return r.mission_id === h.mission_id; })[0];
    var dimGap = gap ? (gap.dimension_gaps || []).filter(function (d) { return d.dimension === h.dimension; })[0] : null;

    // 1 — the PROBLEM, stated before the title
    var purpose = opts.role_purpose ||
      ('Close the ' + h.dimension.toLowerCase() + ' gap. The mission needs ' + h.dimension.toLowerCase() +
       (dimGap ? ' at ' + human(dimGap.required_level) + ', but the organization currently reads ' + human(dimGap.current_level) : '') +
       '. This role exists to raise it.');
    if (!purpose || !purpose.trim()) return null; // no clear problem → stays a hypothesis

    var success = opts.role_success_definition ||
      (h.dimension + ' moves from ' + (dimGap ? human(dimGap.current_level) : 'its current level') +
       ' toward ' + (dimGap ? human(dimGap.required_level) : 'what the mission requires') +
       ' within the mission horizon, visible in how the work actually runs.');

    var priority = opts.priority || (dimGap && dimGap.gap_level === 'major' ? 'high' : 'medium');

    var role = newRole({
      organization_id: h.organization_id,
      mission_id: h.mission_id,
      gap_id: h.gap_id,
      dimension: h.dimension,
      role_name: h.role_name,
      role_purpose: purpose,
      role_success_definition: success,
      role_stage: 'defined',
      priority: priority,
      confidence: h.confidence
    });
    store.roles.push(role);
    h.promoted_role_id = role.role_id;
    h.updated_at = nowISO();

    // 2 — role frequency (what a person in this role must be)
    var rf = deriveRoleFrequency(role, dimGap, required);
    store.role_frequencies.push(rf);

    // 3 — role contribution (how it closes the gap)
    var contrib = newRoleContribution({
      role_id: role.role_id,
      gap_id: role.gap_id,
      contribution_summary: role.role_name + ' addresses the ' + role.dimension.toLowerCase() +
        ' gap by ' + contributionVerb(role.dimension) + ', building the capability the mission requires between where the organization is and where it needs to be.',
      dimensions_affected: [role.dimension],
      confidence: dimGap ? dimGap.confidence : role.confidence
    });
    store.role_contributions.push(contrib);

    OF.save(store);
    return { role: role, role_frequency: rf, contribution: contrib };
  }

  function retireRole(roleId, store) {
    store = ensure(store || OF.load());
    var role = byId(store.roles, 'role_id', roleId);
    if (!role) return null;
    role.role_stage = 'retired';
    role.updated_at = nowISO();
    var h = store.role_hypotheses.filter(function (x) { return x.promoted_role_id === roleId; })[0];
    if (h) h.promoted_role_id = null;
    OF.save(store);
    return role;
  }

  /* ---- ROLE FREQUENCY derivation --------------------------- */
  function deriveRoleFrequency(role, dimGap, required) {
    var reqByDim = required ? index(required.required_dimensions, 'dimension') : {};
    var dims = DIMENSIONS.map(function (name) {
      var primary = (name === role.dimension);
      var r = reqByDim[name];
      var lvl = primary ? (dimGap ? dimGap.required_level : 'high') : (r ? r.required_level : 'moderate');
      return {
        dimension: name,
        required_level: lvl,
        confidence: round(primary ? Math.min(0.7, (dimGap ? dimGap.confidence : 0.5) + 0.1) : (r ? r.confidence * 0.7 : 0.25)),
        reasoning: primary
          ? 'Core to this role — it exists to raise ' + name.toLowerCase() + '.'
          : 'Context — inherited from what the mission requires of the organization.',
        primary: primary
      };
    });
    return newRoleFrequency({
      role_id: role.role_id,
      dimensions: dims,
      confidence: round((dimGap ? dimGap.confidence : 0.4)),
      frequency_summary: 'A ' + role.role_name + ' for this mission centres on ' + role.dimension.toLowerCase() +
        ' (' + human(dims.filter(function (d) { return d.primary; })[0].required_level) + '), carrying the wider frequency the mission demands.',
      reasoning: 'Derived from the gap this role closes and the mission\u2019s required frequency. The primary dimension is the role\u2019s reason to exist; the rest is context, not a checklist.'
    });
  }

  function roleCandidates(dimension) {
    var map = {
      'People Development Orientation': ['Engineering Manager', 'Head of Talent', 'Team Lead'],
      'Innovation Requirement': ['Head of Product', 'Research Lead', 'Principal Engineer'],
      'Leadership Style': ['VP of Operations', 'General Manager', 'Head of Department'],
      'Process Maturity': ['Head of Operations', 'Program Manager', 'Chief of Staff'],
      'Pace': ['Delivery Lead', 'Chief of Staff'],
      'Communication Style': ['Head of Communications', 'Program Manager'],
      'Pressure Tolerance': ['Operations Lead'],
      'Autonomy Level': ['Senior Lead'],
      'Execution Discipline': ['Delivery Lead', 'Head of Operations'],
      'Trust / Goodness Layer': ['People Lead']
    };
    return map[dimension] || ['Functional Lead'];
  }
  function contributionVerb(dimension) {
    var map = {
      'People Development Orientation': 'building the team and the development structure around it',
      'Innovation Requirement': 'bringing specialised capability in-house and setting technical direction',
      'Leadership Style': 'building a layer of leadership between the founder and the work',
      'Process Maturity': 'putting repeatable process under the operation',
      'Pace': 'owning delivery cadence',
      'Communication Style': 'establishing how the organization communicates across functions',
      'Execution Discipline': 'holding execution discipline through delivery'
    };
    return map[dimension] || 'owning the capability directly';
  }

  /* ---- reads ------------------------------------------------ */
  function getForMission(missionId, store) {
    store = ensure(store || OF.load());
    var gap = (store.frequency_gaps || []).filter(function (g) { return g.mission_id === missionId; })[0];
    var roles = store.roles.filter(function (r) { return r.mission_id === missionId; });
    return {
      gap: gap || null,
      hypotheses: store.role_hypotheses.filter(function (h) { return h.mission_id === missionId; }),
      roles: roles,
      role_frequency: function (roleId) { return store.role_frequencies.filter(function (x) { return x.role_id === roleId; })[0] || null; },
      contribution: function (roleId) { return store.role_contributions.filter(function (x) { return x.role_id === roleId; })[0] || null; }
    };
  }

  function byId(arr, key, val) { return (arr || []).filter(function (x) { return x[key] === val; })[0] || null; }
  function index(arr, key) { var o = {}; (arr || []).forEach(function (x) { o[x[key]] = x; }); return o; }

  /* 1L — recompute role frequency IN PLACE for a mission's roles,
     from the current gap + required frequency, keeping role_frequency_id.
     Used by the Frequency Evolution recompute loop after discovery. */
  function recomputeRoleFrequencies(missionId, store) {
    store = ensure(store || OF.load());
    var roles = store.roles.filter(function (r) { return r.mission_id === missionId && r.role_stage !== 'retired'; });
    var gap = (store.frequency_gaps || []).filter(function (g) { return g.mission_id === missionId; })[0];
    var required = (store.required_frequencies || []).filter(function (r) { return r.mission_id === missionId; })[0];
    roles.forEach(function (role) {
      var dimGap = gap ? (gap.dimension_gaps || []).filter(function (d) { return d.dimension === role.dimension; })[0] : null;
      var fresh = deriveRoleFrequency(role, dimGap, required);
      var existing = store.role_frequencies.filter(function (x) { return x.role_id === role.role_id; })[0];
      if (existing) {
        fresh.role_frequency_id = existing.role_frequency_id;
        fresh.created_at = existing.created_at;
        store.role_frequencies = store.role_frequencies.map(function (x) { return x.role_id === role.role_id ? fresh : x; });
      } else {
        store.role_frequencies.push(fresh);
      }
    });
    OF.save(store);
    return roles.length;
  }

  OF.role = {
    ROLE_STAGES: ROLE_STAGES,
    PRIORITIES: PRIORITIES,
    ensure: ensure,
    newRole: newRole,
    newRoleFrequency: newRoleFrequency,
    newRoleContribution: newRoleContribution,
    newRoleHypothesis: newRoleHypothesis,
    syncHypotheses: syncHypotheses,
    defineRole: defineRole,
    retireRole: retireRole,
    recomputeRoleFrequencies: recomputeRoleFrequencies,
    getForMission: getForMission,
    roleCandidates: roleCandidates
  };
})();
