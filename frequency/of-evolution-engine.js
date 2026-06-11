/* =============================================================
   Organizational Frequency — Organizational Evolution Engine
   (Build 3E · the layer between Mission Gap Analysis and
   longitudinal Frequency Evolution)
   =============================================================
   3D answered: what is the gap? 3E answers: how does the
   organization evolve toward the mission — what sequence of
   changes is plausibly required, what progress has been made,
   and what remains unresolved?

       Validated Profile (3C)
          ↓
       Mission Frequency · Gap Analysis (3D)
          ↓  convert gaps → pathways
       EvolutionPath
          ↓  1–5 per major gap
       EvolutionMilestone[]
          ↓  observed, never imposed
       EvolutionEvent[]  →  Frequency Evolution (1L) hook
          ↓
       ProgressIndicator[]   (current → target, distance, trend)
          ↓
       EvolutionRecommendation[]

   PRINCIPLE: the system does NOT transform organizations. It
   observes, models, tracks, and learns. Organizations transform
   themselves. So paths are *plausible pathways*, not prescriptions;
   milestones are achieved by the org and merely recorded here;
   progress moves only when a real EvolutionEvent is logged.

   HONESTY: confidence is inherited from the validated profile and
   the mission frequency beneath it — sparse evidence stays low.
   Every EvolutionEvent appends a Frequency Evolution event (1L),
   preserving history; nothing is overwritten.

   NOT in 3E: project/task management, Jira, hiring, outreach,
   recruiting, candidate matching, or organizational scoring.

   Augments window.OF with window.OF.evolengine.
   Depends on: of-model.js + of-mission-gap.js (3D).
   Optional hook: of-evolution.js (1L).
   ============================================================= */
(function () {
  'use strict';
  if (!window.OF) { console.warn('of-evolution-engine.js requires of-model.js'); return; }
  var OF = window.OF;

  /* ===== controlled vocabularies ===== */
  var PATH_STATUS = ['draft', 'active', 'paused', 'completed', 'abandoned'];
  var MILESTONE_PRIORITY = ['low', 'medium', 'high', 'critical'];
  var MILESTONE_STATUS = ['planned', 'active', 'achieved', 'abandoned'];
  var EVENT_TYPES = ['leadership_change', 'process_change', 'team_change', 'decision_change',
    'communication_change', 'culture_change', 'talent_change', 'validation_update', 'mission_update', 'unknown'];
  var TREND = ['improving', 'stable', 'declining', 'unknown'];
  var REC_PRIORITY = ['low', 'medium', 'high', 'critical'];

  // mission dimensions, mirrored from 3D
  var DIMS = (OF.missiongap && OF.missiongap.MISSION_DIMS) ||
    ['leadership', 'execution', 'innovation', 'autonomy', 'communication', 'collaboration', 'adaptability', 'learning', 'risk_tolerance', 'growth_orientation'];
  var DIM_LABELS = (OF.missiongap && OF.missiongap.DIM_LABELS) || {};

  var ORD = { unknown: -1, low: 1, medium: 2, high: 3, contested: 2 };
  function ordOf(l) { return ORD[l] != null ? ORD[l] : 2; }
  function levelFromOrd(o) { return o >= 3 ? 'high' : (o >= 2 ? 'medium' : (o >= 1 ? 'low' : 'unknown')); }

  // which 3E event type naturally advances which dimension (for the 1L hook + suggestions)
  var DIM_EVENT = {
    leadership: 'leadership_change', execution: 'process_change', innovation: 'team_change',
    autonomy: 'decision_change', communication: 'communication_change', collaboration: 'team_change',
    adaptability: 'process_change', learning: 'talent_change', risk_tolerance: 'decision_change',
    growth_orientation: 'process_change'
  };

  /* per-dimension PLAUSIBLE pathway — ordered steps. The final step is always a
     validation step (closing the loop back to 3C). Milestone count is sliced to
     the gap severity: minor 2 · moderate 3 · major 4 · critical 5, always keeping
     the validate step last. These are pathways, not prescriptions. */
  var PATHWAY = {
    innovation: [
      { t: 'Protect dedicated innovation time and budget', d: 'Carve out protected capacity so new work is not crowded out by the core business.' },
      { t: 'Stand up dedicated innovation / platform teams', d: 'Give the new direction its own team with a clear remit, not a side-of-desk effort.' },
      { t: 'Decentralize experimentation', d: 'Lower the cost of trying — let teams run small experiments without central sign-off.' },
      { t: 'Establish a kill / scale decision cadence', d: 'Make it routine to fund what works and stop what does not, on a regular rhythm.' },
      { t: 'Validate the innovation culture', d: 'Confirm with stakeholders that the shift is real and felt, not just announced.', validate: true }
    ],
    autonomy: [
      { t: 'Define decision rights explicitly', d: 'Make clear who decides what, so authority is not ambiguous on the critical path.' },
      { t: 'Empower managers within clear guardrails', d: 'Give managers room to act, bounded by explicit limits rather than case-by-case approval.' },
      { t: 'Reduce approval layers', d: 'Remove sign-off steps that slow decisions without adding real protection.' },
      { t: 'Clarify accountability so autonomy is safe', d: 'Pair authority with ownership so delegated decisions are held well.' },
      { t: 'Validate autonomy with managers and teams', d: 'Confirm decision latitude is genuinely felt at the level the mission needs.', validate: true }
    ],
    execution: [
      { t: 'Set a clear operating cadence and priorities', d: 'Establish the rhythm and the few priorities that the mission depends on.' },
      { t: 'Remove cross-team blockers and handoff drag', d: 'Find and clear the dependencies that slow delivery between functions.' },
      { t: 'Create fast feedback loops on delivery', d: 'Shorten the loop between doing and learning so the team self-corrects quickly.' },
      { t: 'Build a re-planning rhythm', d: 'Make adjusting the plan a routine event rather than a disruption.' },
      { t: 'Validate execution tempo with delivery leads', d: 'Confirm the pace and discipline match what the timeline requires.', validate: true }
    ],
    leadership: [
      { t: 'Make the mission and sponsorship unambiguous', d: 'Name the mission, the sponsor, and why now — so direction is not in doubt.' },
      { t: 'Align the leadership team on one narrative', d: 'Get the senior team telling the same story, not subtly different ones.' },
      { t: 'Model the behaviours the mission requires', d: 'Have leaders visibly do the things they are asking the org to do.' },
      { t: 'Validate leadership alignment with the org', d: 'Confirm the org reads leadership as aligned and committed.', validate: true }
    ],
    communication: [
      { t: 'Open high-bandwidth channels across levels', d: 'Create reliable ways for information to move up, down, and across.' },
      { t: 'Make hard feedback routine and safe', d: 'Normalize candid feedback so problems surface early instead of late.' },
      { t: 'Close the loop on decisions and changes', d: 'Tell people what was decided and why, so communication is two-way.' },
      { t: 'Validate communication openness', d: 'Confirm with stakeholders that communication is genuinely open.', validate: true }
    ],
    collaboration: [
      { t: 'Define shared goals across functions', d: 'Give functions a common objective so they pull in the same direction.' },
      { t: 'Create cross-functional working structures', d: 'Stand up the teams and forums where the work actually crosses boundaries.' },
      { t: 'Resolve priority conflicts in a clear forum', d: 'Make a single place where competing priorities get reconciled.' },
      { t: 'Validate collaboration with function leads', d: 'Confirm functions are working as one on the mission.', validate: true }
    ],
    adaptability: [
      { t: 'Build in regular re-planning checkpoints', d: 'Schedule the moments where the org expects to change course.' },
      { t: 'Decouple work so change is cheaper', d: 'Reduce tight coupling so adjusting one thing does not break everything.' },
      { t: 'Reward adjusting course over staying the plan', d: 'Signal that responding to reality is valued, not punished.' },
      { t: 'Validate adaptability through a real change', d: 'Confirm the org can absorb a genuine shift without stalling.', validate: true }
    ],
    learning: [
      { t: 'Make structured learning part of the work', d: 'Build learning into the cadence rather than leaving it to spare time.' },
      { t: 'Capture and share what is learned', d: 'Turn individual lessons into shared organizational knowledge.' },
      { t: 'Bring in capability where gaps are real', d: 'Add expertise deliberately where the mission needs what the org lacks.' },
      { t: 'Validate learning velocity with teams', d: 'Confirm the org is learning fast enough for the mission.', validate: true }
    ],
    risk_tolerance: [
      { t: 'Agree explicitly what failure is acceptable', d: 'Define the bets the org is willing to lose, so teams take the right risks.' },
      { t: 'Create safe-to-fail experiment boundaries', d: 'Set the limits within which failure is contained and expected.' },
      { t: 'Separate reversible from irreversible bets', d: 'Move fast on what can be undone; be careful only where it counts.' },
      { t: 'Validate the risk posture with leadership', d: 'Confirm leadership genuinely backs the risk appetite the mission needs.', validate: true }
    ],
    growth_orientation: [
      { t: 'Translate ambition into resourced commitments', d: 'Turn the growth goal into funded, owned commitments rather than aspiration.' },
      { t: 'Align incentives to the growth goal', d: 'Make sure what people are rewarded for matches where the org wants to go.' },
      { t: 'Build capacity ahead of the growth curve', d: 'Invest before the demand arrives so growth is not capped by readiness.' },
      { t: 'Validate growth readiness with the org', d: 'Confirm the org is genuinely set up to grow at the required pace.', validate: true }
    ]
  };
  function severityCount(sev) { return { minor: 2, moderate: 3, major: 4, critical: 5 }[sev] || 3; }
  function severityToPriority(sev) { return { minor: 'low', moderate: 'medium', major: 'high', critical: 'critical' }[sev] || 'medium'; }

  /* ===== helpers ===== */
  function nowISO() { return new Date().toISOString(); }
  function uid(p) { return OF.uid(p); }
  function byId(arr, key, val) { return (arr || []).filter(function (x) { return x[key] === val; })[0] || null; }
  function lc(s) { return (s == null ? '' : String(s)).toLowerCase(); }
  function titleish(s) { return String(s || '').replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }

  function ensure(store) {
    store.evo_paths = store.evo_paths || [];
    store.evo_milestones = store.evo_milestones || [];
    store.evo_events = store.evo_events || [];
    store.evo_indicators = store.evo_indicators || [];
    store.evo_recommendations = store.evo_recommendations || [];
    store.evo_audit_log = store.evo_audit_log || [];
    return store;
  }
  function audit(store, t, ref, action, detail) {
    store.evo_audit_log.push({ log_id: uid('eaud'), object_type: t, object_ref: ref, action: action, detail: detail || '', created_at: nowISO() });
  }

  /* ==========================================================
     SCHEMAS
     ========================================================== */
  function newPath(f) {
    f = f || {};
    return {
      path_id: f.path_id || uid('epath'),
      company_name: f.company_name || '',
      mission_id: f.mission_id || null,
      title: f.title || '',
      description: f.description || '',
      status: PATH_STATUS.indexOf(f.status) !== -1 ? f.status : 'draft',
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }
  function newMilestone(f) {
    f = f || {};
    return {
      milestone_id: f.milestone_id || uid('emile'),
      path_id: f.path_id || null,
      title: f.title || '',
      description: f.description || '',
      dimension: f.dimension || '',
      target_state: f.target_state || '',
      sequence_order: f.sequence_order || 0,
      priority: MILESTONE_PRIORITY.indexOf(f.priority) !== -1 ? f.priority : 'medium',
      status: MILESTONE_STATUS.indexOf(f.status) !== -1 ? f.status : 'planned',
      is_validation: !!f.is_validation,
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }
  function newEvent(f) {
    f = f || {};
    return {
      event_id: f.event_id || uid('eevt'),
      path_id: f.path_id || null,
      milestone_id: f.milestone_id || null,
      event_type: EVENT_TYPES.indexOf(f.event_type) !== -1 ? f.event_type : 'unknown',
      description: f.description || '',
      evidence: f.evidence || '',
      dimension: f.dimension || '',
      direction: f.direction || 'forward',   // forward | setback | neutral
      frequency_evolution_event_id: f.frequency_evolution_event_id || null,
      created_at: f.created_at || nowISO()
    };
  }
  function newIndicator(f) {
    f = f || {};
    return {
      indicator_id: f.indicator_id || uid('eind'),
      path_id: f.path_id || null,
      dimension: f.dimension || '',
      starting_state: f.starting_state || 'unknown',
      current_state: f.current_state || (f.starting_state || 'unknown'),
      target_state: f.target_state || 'unknown',
      confidence: f.confidence || 'low',
      trend: TREND.indexOf(f.trend) !== -1 ? f.trend : 'unknown',
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }
  function newRec(f) {
    f = f || {};
    return {
      recommendation_id: f.recommendation_id || uid('erec'),
      path_id: f.path_id || null,
      dimension: f.dimension || '',
      recommendation: f.recommendation || '',
      reasoning: f.reasoning || '',
      priority: REC_PRIORITY.indexOf(f.priority) !== -1 ? f.priority : 'medium',
      created_at: f.created_at || nowISO()
    };
  }

  /* ==========================================================
     3D INTEGRATION — read missions that have a gap analysis
     ========================================================== */
  function anchors(store) {
    store = ensure(store || OF.load());
    if (!OF.missiongap) return [];
    return (store.mission_profiles || []).map(function (m) {
      var f = OF.missiongap.getMission(m.mission_id, store);
      var hasPath = store.evo_paths.some(function (p) { return p.mission_id === m.mission_id; });
      return {
        mission_id: m.mission_id, company_name: m.company_name, title: m.title,
        time_horizon: m.time_horizon,
        gaps: f ? f.gaps.length : 0, ready: !!(f && f.mission_frequency && f.gaps.length),
        has_path: hasPath
      };
    });
  }

  /* ==========================================================
     CREATE PATH — converts the 3D gap analysis into a pathway
     ========================================================== */
  function createPath(missionId, store) {
    store = ensure(store || OF.load());
    if (!OF.missiongap) return { error: 'Mission & Gap engine (3D) not loaded.' };
    var f = OF.missiongap.getMission(missionId, store);
    if (!f) return { error: 'Mission not found.' };
    if (!f.mission_frequency || !f.gaps.length) return { error: 'No gap analysis to evolve from. Run the gap analysis in Mission & Gaps (3D) first.' };
    if (store.evo_paths.some(function (p) { return p.mission_id === missionId; })) {
      return { error: 'An evolution path already exists for this mission.', path: store.evo_paths.filter(function (p) { return p.mission_id === missionId; })[0] };
    }
    var path = newPath({
      company_name: f.mission.company_name, mission_id: missionId,
      title: 'Evolution toward: ' + f.mission.title,
      description: 'A plausible pathway from the validated current frequency toward the frequency this mission requires. ' +
        'These are pathways the organization may follow — observed and tracked here, not imposed.',
      status: 'active'
    });
    store.evo_paths.push(path);

    // milestones from each gap (skip aligned dimensions)
    var seq = 1;
    f.gaps.slice().sort(function (a, b) { return OF.missiongap.SEVERITY.indexOf(b.severity) - OF.missiongap.SEVERITY.indexOf(a.severity); }).forEach(function (g) {
      var lib = PATHWAY[g.dimension];
      if (!lib) return;
      var n = severityCount(g.severity);
      // take first (n-1) build steps + the final validate step
      var build = lib.filter(function (s) { return !s.validate; });
      var validate = lib.filter(function (s) { return s.validate; })[0];
      var chosen = build.slice(0, Math.max(1, n - 1));
      if (validate) chosen = chosen.concat([validate]);
      var basePr = severityToPriority(g.severity);
      chosen.forEach(function (step, i) {
        store.evo_milestones.push(newMilestone({
          path_id: path.path_id, title: step.t, description: step.d, dimension: g.dimension,
          target_state: g.required_state, sequence_order: seq++,
          priority: i === 0 ? basePr : (basePr === 'critical' ? 'high' : basePr === 'high' ? 'medium' : 'low'),
          status: 'planned', is_validation: !!step.validate
        }));
      });
      // progress indicator per gapped dimension
      store.evo_indicators.push(newIndicator({
        path_id: path.path_id, dimension: g.dimension,
        starting_state: g.current_state, current_state: g.current_state, target_state: g.required_state,
        confidence: (f.current.dimensions[g.dimension] && f.current.dimensions[g.dimension].confidence) || 'low',
        trend: 'unknown'
      }));
    });

    // seed recommendations from 3D's recommendations, reframed as evolution moves
    (f.recommendations || []).forEach(function (r) {
      store.evo_recommendations.push(newRec({
        path_id: path.path_id, dimension: r.dimension,
        recommendation: r.title, reasoning: r.reasoning || r.description, priority: r.priority
      }));
    });
    // plus a sequencing recommendation: start with the most severe / earliest-leverage gap
    var top = f.gaps.slice().sort(function (a, b) { return OF.missiongap.SEVERITY.indexOf(b.severity) - OF.missiongap.SEVERITY.indexOf(a.severity); })[0];
    if (top) {
      store.evo_recommendations.push(newRec({
        path_id: path.path_id, dimension: top.dimension,
        recommendation: 'Sequence ' + (DIM_LABELS[top.dimension] || top.dimension) + ' first',
        reasoning: 'It is the most severe gap (' + top.severity + ') and tends to unlock the others — autonomy and execution gaps in particular compound if left late.',
        priority: 'critical'
      }));
    }

    audit(store, 'path', path.company_name, 'created', store.evo_milestones.filter(function (m) { return m.path_id === path.path_id; }).length + ' milestones');
    OF.save(store);
    return { path: path };
  }

  function setPathStatus(pathId, status, store) {
    store = ensure(store || OF.load());
    var p = byId(store.evo_paths, 'path_id', pathId);
    if (!p) return { error: 'Path not found.' };
    if (PATH_STATUS.indexOf(status) === -1) return { error: 'Invalid status.' };
    p.status = status; p.updated_at = nowISO();
    audit(store, 'path', p.company_name, status, '');
    OF.save(store);
    return { path: p };
  }

  /* ==========================================================
     RECORD EVOLUTION EVENT — the org changed; observe it.
     Advances a milestone, recomputes progress, and appends a
     Frequency Evolution (1L) event. History preserved.
     ========================================================== */
  function recordEvent(pathId, fields, store) {
    store = ensure(store || OF.load());
    var p = byId(store.evo_paths, 'path_id', pathId);
    if (!p) return { error: 'Path not found.' };
    fields = fields || {};
    if (!fields.description) return { error: 'Describe what changed in the organization.' };
    var milestone = fields.milestone_id ? byId(store.evo_milestones, 'milestone_id', fields.milestone_id) : null;
    var dim = (milestone && milestone.dimension) || fields.dimension || '';
    var direction = fields.direction || 'forward';
    var etype = EVENT_TYPES.indexOf(fields.event_type) !== -1 ? fields.event_type : (DIM_EVENT[dim] || 'unknown');

    var evt = newEvent({
      path_id: pathId, milestone_id: milestone ? milestone.milestone_id : null,
      event_type: etype, description: fields.description, evidence: fields.evidence || '',
      dimension: dim, direction: direction
    });

    // advance / set back the milestone
    if (milestone) {
      if (direction === 'setback') { if (milestone.status === 'achieved') milestone.status = 'active'; }
      else if (direction === 'forward') { milestone.status = (fields.mark_achieved ? 'achieved' : 'active'); }
      milestone.updated_at = nowISO();
    }

    // ---- Frequency Evolution (1L) hook — append-only, never overwrites ----
    var ind = dim ? store.evo_indicators.filter(function (x) { return x.path_id === pathId && x.dimension === dim; })[0] : null;
    if (dim && OF.evolution && OF.evolution.newEvent) {
      try {
        var prevLevel = ind ? ind.current_state : 'unknown';
        var ct = direction === 'setback' ? 'weakened' : (etype === 'validation_update' ? 'confirmed' : 'strengthened');
        var fev = OF.evolution.newEvent({
          organization_id: null, dimension: dim,
          previous_level: prevLevel, new_level: prevLevel, // recomputed below; level provisional
          change_type: ct,
          evidence: [String(fields.description || '').slice(0, 200)],
          reasoning: '[3E evolution] ' + (milestone ? milestone.title + ' — ' : '') + fields.description
        });
        store.frequency_evolution_events = store.frequency_evolution_events || [];
        store.frequency_evolution_events.push(fev);
        evt.frequency_evolution_event_id = fev.event_id || null;
      } catch (e) { /* 1L optional */ }
    }
    store.evo_events.push(evt);

    // recompute progress for this path (and patch the 1L event's new_level)
    recomputeProgress(pathId, store);
    if (evt.frequency_evolution_event_id && dim) {
      var ind2 = store.evo_indicators.filter(function (x) { return x.path_id === pathId && x.dimension === dim; })[0];
      var fev2 = (store.frequency_evolution_events || []).filter(function (e) { return e.event_id === evt.frequency_evolution_event_id; })[0];
      if (ind2 && fev2) fev2.new_level = ind2.current_state;
    }
    // complete the path if every milestone is resolved
    var ms = store.evo_milestones.filter(function (m) { return m.path_id === pathId; });
    if (ms.length && ms.every(function (m) { return m.status === 'achieved' || m.status === 'abandoned'; })) p.status = 'completed';
    p.updated_at = nowISO();

    audit(store, 'event', p.company_name, 'recorded', etype + (dim ? ' · ' + dim : ''));
    OF.save(store);
    return { event: evt, milestone: milestone, path: p };
  }

  /* recompute current_state / trend / confidence for every indicator on a path */
  function recomputeProgress(pathId, store) {
    var inds = store.evo_indicators.filter(function (x) { return x.path_id === pathId; });
    inds.forEach(function (ind) {
      var ms = store.evo_milestones.filter(function (m) { return m.path_id === pathId && m.dimension === ind.dimension; });
      var total = ms.length || 1;
      var achieved = ms.filter(function (m) { return m.status === 'achieved'; }).length;
      var frac = achieved / total;
      var sOrd = ordOf(ind.starting_state), tOrd = ordOf(ind.target_state);
      if (sOrd < 1) sOrd = 1; // treat unknown start as low for progress math
      var curOrd = Math.round(sOrd + frac * (tOrd - sOrd));
      ind.current_state = (ind.starting_state === 'unknown' && achieved === 0) ? 'unknown' : levelFromOrd(curOrd);

      // trend from the most recent event on this dimension
      var evs = store.evo_events.filter(function (e) { return e.path_id === pathId && e.dimension === ind.dimension; });
      var last = evs[evs.length - 1];
      if (!evs.length) ind.trend = 'unknown';
      else if (last && last.direction === 'setback') ind.trend = 'declining';
      else if (achieved > 0 || (last && last.direction === 'forward')) ind.trend = 'improving';
      else ind.trend = 'stable';

      // confidence rises only when a validation_update event supports the dimension
      var validated = evs.some(function (e) { return e.event_type === 'validation_update' && e.direction !== 'setback'; });
      var base = ind.confidence || 'low';
      ind.confidence = validated ? (base === 'low' ? 'medium' : base) : base;
      ind.updated_at = nowISO();
    });
  }

  /* ==========================================================
     MANUAL MILESTONE CONTROL
     ========================================================== */
  function setMilestoneStatus(milestoneId, status, store) {
    store = ensure(store || OF.load());
    var m = byId(store.evo_milestones, 'milestone_id', milestoneId);
    if (!m) return { error: 'Milestone not found.' };
    if (MILESTONE_STATUS.indexOf(status) === -1) return { error: 'Invalid status.' };
    m.status = status; m.updated_at = nowISO();
    recomputeProgress(m.path_id, store);
    audit(store, 'milestone', m.title, status, '');
    OF.save(store);
    return { milestone: m };
  }

  /* ==========================================================
     READS
     ========================================================== */
  function getPath(pathId, store) {
    store = ensure(store || OF.load());
    var p = byId(store.evo_paths, 'path_id', pathId);
    if (!p) return null;
    var mission = OF.missiongap ? OF.missiongap.getMission(p.mission_id, store) : null;
    var milestones = store.evo_milestones.filter(function (m) { return m.path_id === pathId; }).sort(function (a, b) { return a.sequence_order - b.sequence_order; });
    var indicators = store.evo_indicators.filter(function (i) { return i.path_id === pathId; });
    var totalAchieved = milestones.filter(function (m) { return m.status === 'achieved'; }).length;
    return {
      path: p, mission: mission,
      milestones: milestones,
      events: store.evo_events.filter(function (e) { return e.path_id === pathId; }).slice().reverse(),
      indicators: indicators,
      recommendations: store.evo_recommendations.filter(function (r) { return r.path_id === pathId; }),
      progress: { achieved: totalAchieved, total: milestones.length, pct: milestones.length ? Math.round(100 * totalAchieved / milestones.length) : 0 }
    };
  }
  function snapshot(store) {
    store = ensure(store || OF.load());
    return {
      anchors: anchors(store),
      paths: store.evo_paths.slice().reverse(),
      counts: {
        anchors: (store.mission_profiles || []).length,
        paths: store.evo_paths.length,
        milestones: store.evo_milestones.length,
        achieved: store.evo_milestones.filter(function (m) { return m.status === 'achieved'; }).length,
        events: store.evo_events.length,
        indicators: store.evo_indicators.length
      }
    };
  }
  function resetEvolution(store) {
    store = ensure(store || OF.load());
    store.evo_paths = []; store.evo_milestones = []; store.evo_events = [];
    store.evo_indicators = []; store.evo_recommendations = []; store.evo_audit_log = [];
    OF.save(store);
  }

  OF.evolengine = {
    PATH_STATUS: PATH_STATUS, MILESTONE_PRIORITY: MILESTONE_PRIORITY, MILESTONE_STATUS: MILESTONE_STATUS,
    EVENT_TYPES: EVENT_TYPES, TREND: TREND, REC_PRIORITY: REC_PRIORITY,
    DIMS: DIMS, DIM_LABELS: DIM_LABELS, DIM_EVENT: DIM_EVENT,
    ensure: ensure,
    anchors: anchors,
    createPath: createPath, setPathStatus: setPathStatus,
    recordEvent: recordEvent, setMilestoneStatus: setMilestoneStatus,
    getPath: getPath, snapshot: snapshot, resetEvolution: resetEvolution
  };
})();
