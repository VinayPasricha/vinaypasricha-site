/* =============================================================
   Organizational Frequency — Mission Discovery & Organizational
   Gap Engine  (Build 3D)
   =============================================================
   3B answers what public evidence suggests.
   3C answers what stakeholders validate.
   3D answers what the organization is trying to BECOME — and
   what stands in the way.

       Validated Organizational Profile (3C)
          ↓  becomes Current Frequency
       MissionProfile          (what they're trying to do)
          ↓
       MissionFrequency        (the frequency the mission REQUIRES)
          ↓  current vs required
       FrequencyGap[]
          ↓
       Constraint[]            (what blocks closing the gap)
          ↓
       MissionRecommendation[] (priority moves — organizational,
                                not hiring)

   Reads the 3C Validated Organizational Profile, its validation
   events, and the Frequency Evolution history as Current Frequency.
   Never fabricates certainty — weak evidence reads as low confidence.

   NOT in 3D: hiring, candidate matching, outreach, stakeholder
   discovery, emails, Apollo, recruiting workflows.

   Augments window.OF with window.OF.missiongap.
   Depends on: of-model.js (store) + of-org-validation.js (3C).
   ============================================================= */
(function () {
  'use strict';
  if (!window.OF) { console.warn('of-mission-gap.js requires of-model.js'); return; }
  var OF = window.OF;

  /* ===== controlled vocabularies ===== */
  var MISSION_STATUS = ['draft', 'active', 'completed', 'archived'];
  var MISSION_DIMS = ['leadership', 'execution', 'innovation', 'autonomy', 'communication',
    'collaboration', 'adaptability', 'learning', 'risk_tolerance', 'growth_orientation'];
  var DIM_LABELS = {
    leadership: 'Leadership', execution: 'Execution', innovation: 'Innovation', autonomy: 'Autonomy',
    communication: 'Communication', collaboration: 'Collaboration', adaptability: 'Adaptability',
    learning: 'Learning', risk_tolerance: 'Risk Tolerance', growth_orientation: 'Growth Orientation'
  };
  var SEVERITY = ['minor', 'moderate', 'major', 'critical'];
  var CONSTRAINT_TYPES = ['leadership', 'talent', 'execution', 'communication', 'culture',
    'autonomy', 'decision_making', 'resource', 'process', 'unknown'];
  var PRIORITY = ['low', 'medium', 'high', 'critical'];
  var SOURCE_KINDS = ['manual_entry', 'leadership_interview', 'mission_statement', 'strategic_plan', 'public_objectives', 'company_narrative', 'validation_responses'];

  // ordinal scale used for gap math
  var ORD = { unknown: -1, low: 1, medium: 2, high: 3, contested: 2 };
  function ordOf(level) { return ORD[level] != null ? ORD[level] : 2; }
  function levelFromOrd(o) { return o >= 3 ? 'high' : (o >= 2 ? 'medium' : 'low'); }

  /* mission dimension → which 3C dimension(s) inform its CURRENT state,
     and how a 3C descriptive level maps onto low/medium/high. */
  var SRC = {
    leadership: { src: 'leadership_style', hi: ['visible & directive'], lo: [] },
    execution: { src: 'execution_style', hi: ['speed-led'], mid: ['process-led'] },
    innovation: { src: 'innovation_orientation', hi: ['innovation-forward'] },
    autonomy: { src: 'autonomy_level', hi: ['high-autonomy'], lo: ['directed'] },
    communication: { src: 'communication_culture', hi: ['open & direct'] },
    collaboration: { src: 'collaboration_style', hi: ['collaborative'] },
    adaptability: { src: 'stability_vs_chaos', hi: ['fluid & changing'], lo: ['established'] },
    learning: { src: 'talent_philosophy', hi: ['capacity-building', 'high hiring volume'] },
    growth_orientation: { src: 'growth_orientation', hi: ['expansion-mode'] },
    risk_tolerance: { derived: true }
  };

  /* mission-text lexicon → which required dimensions get raised to 'high' */
  var MISSION_LEX = [
    { kw: ['ai', 'machine learning', 'ml', 'new product', 'product line', 'launch', 'innovat', 'r&d', 'invent', 'pioneer', 'build a new'], boost: { innovation: 'high', risk_tolerance: 'high', learning: 'high', adaptability: 'high' } },
    { kw: ['12 month', '6 month', 'this year', 'fast', 'quickly', 'rapid', 'speed', 'urgen', 'aggressive', 'accelerate', 'within a year'], boost: { execution: 'high', autonomy: 'high' } },
    { kw: ['scale', 'scaling', 'expansion', 'expand', 'grow', 'growth', 'new market', 'geograph'], boost: { growth_orientation: 'high', execution: 'high' } },
    { kw: ['transform', 'reinvent', 'pivot', 'turnaround', 'restructur'], boost: { adaptability: 'high', leadership: 'high', learning: 'high' } },
    { kw: ['cross-functional', 'platform', 'integrate', 'partnership', 'collaborat', 'ecosystem'], boost: { collaboration: 'high', communication: 'high' } },
    { kw: ['culture', 'people', 'talent', 'team', 'engagement', 'retention'], boost: { learning: 'high', communication: 'high', leadership: 'high' } },
    { kw: ['enterprise', 'compliance', 'quality', 'reliab', 'security', 'governance'], boost: { execution: 'high', collaboration: 'medium' } }
  ];

  /* per-dimension reasoning fragments for required level */
  function requiredReason(dim, mission) {
    var t = lc(mission.title + ' ' + mission.description);
    var map = {
      innovation: 'New value-creation is central to this mission, so a strong innovation posture is required.',
      risk_tolerance: 'Building something new means tolerating bets that may fail — risk appetite must be deliberate.',
      learning: 'Entering new territory demands fast, structured learning rather than relying on existing expertise.',
      adaptability: 'Plans will change as the mission meets reality; the org must absorb change without stalling.',
      execution: 'The time horizon is tight, so disciplined, fast execution is required.',
      autonomy: 'Teams on the critical path need decision latitude to move at the required pace.',
      growth_orientation: 'The mission is about expansion, so a growth orientation must be genuinely held, not just stated.',
      leadership: 'A mission of this ambition needs unambiguous direction and sponsorship from the top.',
      collaboration: 'Success depends on functions moving together, so cross-functional collaboration must be strong.',
      communication: 'Coordinating the mission across the org requires open, high-bandwidth communication.'
    };
    return map[dim] || 'This dimension supports the mission at a baseline level.';
  }

  /* ===== helpers ===== */
  function nowISO() { return new Date().toISOString(); }
  function uid(p) { return OF.uid(p); }
  function byId(arr, key, val) { return (arr || []).filter(function (x) { return x[key] === val; })[0] || null; }
  function lc(s) { return (s == null ? '' : String(s)).toLowerCase(); }
  function titleish(s) { return String(s || '').replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }

  function ensure(store) {
    store.mission_profiles = store.mission_profiles || [];
    store.mission_frequencies = store.mission_frequencies || [];
    store.frequency_gaps = store.frequency_gaps || [];
    store.mission_constraints = store.mission_constraints || [];
    store.mission_recommendations = store.mission_recommendations || [];
    store.mg_audit_log = store.mg_audit_log || [];
    return store;
  }
  function audit(store, t, ref, action, detail) {
    store.mg_audit_log.push({ log_id: uid('mgaud'), object_type: t, object_ref: ref, action: action, detail: detail || '', created_at: nowISO() });
  }

  /* ==========================================================
     CURRENT FREQUENCY — read the 3C validated profile + events
     ========================================================== */
  function anchors(store) {
    // every 3C campaign with a validated profile can anchor a mission
    store = ensure(store || OF.load());
    return (store.val_profiles || []).map(function (p) {
      var cmp = byId(store.val_campaigns || [], 'campaign_id', p.campaign_id);
      return { campaign_id: p.campaign_id, company_name: p.company_name, stage: p.stage, status: cmp ? cmp.status : 'unknown' };
    });
  }
  function currentFrequency(campaignId, store) {
    store = ensure(store || OF.load());
    var prof = (store.val_profiles || []).filter(function (p) { return p.campaign_id === campaignId; })[0];
    if (!prof) return null;
    var pd = prof.dimensions || {};
    var out = {};
    MISSION_DIMS.forEach(function (dim) {
      var spec = SRC[dim];
      if (spec.derived) {
        // risk_tolerance derived from innovation + execution speed + pressure
        var inn = pd.innovation_orientation, exe = pd.execution_style, pre = pd.pressure_environment;
        var hi = (inn && inn.level === 'innovation-forward') || (exe && exe.level === 'speed-led');
        var lvl = hi ? 'high' : 'medium';
        var conf = (inn && inn.confidence) || (exe && exe.confidence) || 'low';
        out[dim] = { level: lvl, confidence: conf === 'none' ? 'low' : conf, contested: false,
          source_dim: 'innovation_orientation + execution_style', source_level: (inn ? inn.level : '—'),
          evidence: 'Derived from innovation and execution posture.' };
        return;
      }
      var s = pd[spec.src];
      if (!s) { out[dim] = { level: 'unknown', confidence: 'none', contested: false, source_dim: spec.src, source_level: '—', evidence: 'No validated reading yet.' }; return; }
      var lvl2, contested = (s.level === 'contested');
      if (contested) lvl2 = 'contested';
      else if (lc(s.level).indexOf('unclear') !== -1 || s.confidence === 'none') lvl2 = 'unknown';
      else if ((spec.hi || []).indexOf(s.level) !== -1) lvl2 = 'high';
      else if ((spec.lo || []).indexOf(s.level) !== -1) lvl2 = 'low';
      else if ((spec.mid || []).indexOf(s.level) !== -1) lvl2 = 'medium';
      else lvl2 = 'medium';
      out[dim] = {
        level: lvl2, confidence: s.confidence || 'low', contested: contested,
        source_dim: spec.src, source_level: s.level,
        evidence: contested ? 'Stakeholders contested this dimension — held as a signal, not resolved.' : 'From the validated profile (' + spec.src.replace(/_/g, ' ') + ': ' + s.level + ').',
        stakeholder_sources: s.stakeholder_sources || []
      };
    });
    return { campaign_id: campaignId, company_name: prof.company_name, stage: prof.stage, dimensions: out };
  }

  /* ==========================================================
     SCHEMAS
     ========================================================== */
  function newMission(f) {
    f = f || {};
    return {
      mission_id: f.mission_id || uid('mgmis'),
      campaign_id: f.campaign_id || null,
      company_name: f.company_name || '',
      title: f.title || '',
      description: f.description || '',
      time_horizon: f.time_horizon || '',
      strategic_objectives: f.strategic_objectives || [],
      source_kind: SOURCE_KINDS.indexOf(f.source_kind) !== -1 ? f.source_kind : 'manual_entry',
      status: MISSION_STATUS.indexOf(f.status) !== -1 ? f.status : 'active',
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }
  function newMissionFreq(f) {
    f = f || {};
    return {
      mission_frequency_id: f.mission_frequency_id || uid('mgfreq'),
      mission_id: f.mission_id || null,
      dimensions: f.dimensions || {},   // { dim: {level, reasoning} }
      confidence: f.confidence || 'low',
      reasoning: f.reasoning || '',
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }
  function newGap(f) {
    f = f || {};
    return {
      gap_id: f.gap_id || uid('mggap'),
      mission_id: f.mission_id || null,
      dimension: f.dimension || '',
      current_state: f.current_state || '',
      required_state: f.required_state || '',
      gap_size: f.gap_size || '',
      reasoning: f.reasoning || '',
      severity: SEVERITY.indexOf(f.severity) !== -1 ? f.severity : 'minor',
      created_at: f.created_at || nowISO()
    };
  }
  function newConstraint(f) {
    f = f || {};
    return {
      constraint_id: f.constraint_id || uid('mgcon'),
      mission_id: f.mission_id || null,
      constraint_type: CONSTRAINT_TYPES.indexOf(f.constraint_type) !== -1 ? f.constraint_type : 'unknown',
      description: f.description || '',
      dimension: f.dimension || '',
      severity: SEVERITY.indexOf(f.severity) !== -1 ? f.severity : 'moderate',
      evidence: f.evidence || '',
      created_at: f.created_at || nowISO()
    };
  }
  function newRec(f) {
    f = f || {};
    return {
      recommendation_id: f.recommendation_id || uid('mgrec'),
      mission_id: f.mission_id || null,
      title: f.title || '',
      description: f.description || '',
      dimension: f.dimension || '',
      priority: PRIORITY.indexOf(f.priority) !== -1 ? f.priority : 'medium',
      reasoning: f.reasoning || '',
      created_at: f.created_at || nowISO()
    };
  }

  /* ==========================================================
     MISSION DISCOVERY
     ========================================================== */
  function createMission(campaignId, fields, store) {
    store = ensure(store || OF.load());
    var cur = currentFrequency(campaignId, store);
    if (!cur) return { error: 'No validated organizational profile found. Run a 3C validation campaign first.' };
    fields = fields || {};
    if (!fields.title) return { error: 'Give the mission a title.' };
    var m = newMission(Object.assign({}, fields, { campaign_id: campaignId, company_name: cur.company_name,
      strategic_objectives: Array.isArray(fields.strategic_objectives) ? fields.strategic_objectives : toList(fields.strategic_objectives) }));
    store.mission_profiles.push(m);
    audit(store, 'mission', m.company_name, 'created', m.title);
    OF.save(store);
    return { mission: m };
  }
  function toList(s) { if (Array.isArray(s)) return s.filter(Boolean); return String(s || '').split(/[,;\n]+/).map(function (x) { return x.trim(); }).filter(Boolean); }

  /* ==========================================================
     MISSION FREQUENCY — what the mission requires
     ========================================================== */
  function generateMissionFrequency(missionId, store) {
    store = ensure(store || OF.load());
    var m = byId(store.mission_profiles, 'mission_id', missionId);
    if (!m) return { error: 'Mission not found.' };
    var text = lc(m.title + ' ' + m.description + ' ' + (m.strategic_objectives || []).join(' ') + ' ' + m.time_horizon);
    var req = {};
    MISSION_DIMS.forEach(function (d) { req[d] = 'medium'; });
    req.leadership = 'high';   // any deliberate mission needs clear sponsorship
    var matched = [];
    MISSION_LEX.forEach(function (entry) {
      for (var i = 0; i < entry.kw.length; i++) {
        if (text.indexOf(entry.kw[i]) !== -1) {
          matched.push(entry.kw[i]);
          Object.keys(entry.boost).forEach(function (d) {
            if (ordOf(entry.boost[d]) > ordOf(req[d])) req[d] = entry.boost[d];
          });
          break;
        }
      }
    });
    var dims = {};
    MISSION_DIMS.forEach(function (d) { dims[d] = { level: req[d], reasoning: requiredReason(d, m) }; });
    var conf = matched.length >= 4 ? 'high' : (matched.length >= 2 ? 'medium' : 'low');
    var reasoning = matched.length
      ? 'Required profile derived from mission language (' + matched.slice(0, 6).join(', ') + '). Unmatched dimensions default to a medium baseline.'
      : 'Mission language was sparse; required profile defaults to a medium baseline with clear leadership. Confidence is low — add objectives or a fuller description.';
    store.mission_frequencies = store.mission_frequencies.filter(function (x) { return x.mission_id !== missionId; });
    var mf = newMissionFreq({ mission_id: missionId, dimensions: dims, confidence: conf, reasoning: reasoning });
    store.mission_frequencies.push(mf);
    audit(store, 'mission_frequency', m.company_name, 'generated', conf);
    OF.save(store);
    return { mission_frequency: mf };
  }

  /* ==========================================================
     GAP ANALYSIS + CONSTRAINTS + RECOMMENDATIONS
     ========================================================== */
  function analyze(missionId, store) {
    store = ensure(store || OF.load());
    var m = byId(store.mission_profiles, 'mission_id', missionId);
    if (!m) return { error: 'Mission not found.' };
    var mf = store.mission_frequencies.filter(function (x) { return x.mission_id === missionId; })[0];
    if (!mf) return { error: 'Generate the mission frequency first.' };
    var cur = currentFrequency(m.campaign_id, store);
    if (!cur) return { error: 'Current frequency unavailable.' };

    // clear prior derived objects for this mission
    store.frequency_gaps = store.frequency_gaps.filter(function (g) { return g.mission_id !== missionId; });
    store.mission_constraints = store.mission_constraints.filter(function (c) { return c.mission_id !== missionId; });
    store.mission_recommendations = store.mission_recommendations.filter(function (r) { return r.mission_id !== missionId; });

    var gaps = [], constraints = [], recs = [];

    MISSION_DIMS.forEach(function (dim) {
      var c = cur.dimensions[dim], r = mf.dimensions[dim];
      var curLvl = c.level, reqLvl = r.level;
      var reqOrd = ordOf(reqLvl);
      var sev = null, gapLabel = '', reasoning = '';

      if (curLvl === 'unknown') {
        // unknown where the mission needs it = a real, if unquantified, gap
        if (reqOrd >= 3) { sev = 'major'; gapLabel = 'unknown vs high'; reasoning = 'The mission needs a strong ' + DIM_LABELS[dim].toLowerCase() + ' posture, but the validated profile has no reading here yet — an information gap on the critical path.'; }
        else if (reqOrd >= 2) { sev = 'moderate'; gapLabel = 'unknown vs medium'; reasoning = 'The mission needs a baseline ' + DIM_LABELS[dim].toLowerCase() + ', but this dimension is still unvalidated.'; }
      } else if (curLvl === 'contested') {
        if (reqOrd >= 3) { sev = 'major'; gapLabel = 'contested vs high'; reasoning = 'The mission depends on a strong ' + DIM_LABELS[dim].toLowerCase() + ', but stakeholders contested it — the organization is not aligned on its own reality here.'; }
        else { sev = 'moderate'; gapLabel = 'contested vs ' + reqLvl; reasoning = 'Stakeholders disagree on ' + DIM_LABELS[dim].toLowerCase() + '; the ambiguity itself is a drag on the mission.'; }
      } else {
        var diff = reqOrd - ordOf(curLvl);
        if (diff <= 0) { sev = null; /* aligned or a strength */ }
        else if (diff === 1) { sev = 'moderate'; gapLabel = '+1 level (' + curLvl + ' → ' + reqLvl + ')'; }
        else if (diff === 2) { sev = 'major'; gapLabel = '+2 levels (' + curLvl + ' → ' + reqLvl + ')'; }
        else { sev = 'critical'; gapLabel = '+' + diff + ' levels'; }
        if (sev) reasoning = 'The mission requires ' + reqLvl + ' ' + DIM_LABELS[dim].toLowerCase() + ' but the validated profile reads ' + curLvl + '. ' + r.reasoning;
      }

      if (sev) {
        gaps.push(newGap({ mission_id: missionId, dimension: dim, current_state: curLvl, required_state: reqLvl, gap_size: gapLabel, reasoning: reasoning, severity: sev }));
      }
    });

    // ----- constraints: what blocks closing the gaps -----
    var pd = (store.val_profiles.filter(function (p) { return p.campaign_id === m.campaign_id; })[0] || {}).dimensions || {};
    // contested dims → alignment constraints
    Object.keys(cur.dimensions).forEach(function (dim) {
      if (cur.dimensions[dim].contested) {
        var ctype = dim === 'autonomy' ? 'autonomy' : (dim === 'execution' ? 'execution' : (dim === 'leadership' ? 'leadership' : 'decision_making'));
        constraints.push(newConstraint({ mission_id: missionId, constraint_type: ctype, dimension: dim, severity: 'major',
          description: 'The organization is not aligned on its own ' + DIM_LABELS[dim].toLowerCase() + ' — stakeholders gave contradictory readings.',
          evidence: cur.dimensions[dim].evidence }));
      }
    });
    // strained employee experience + high pressure → culture constraint
    var flour = pd.employee_flourishing, pres = pd.pressure_environment;
    if ((flour && flour.level === 'strained') || (pres && pres.level === 'high-intensity')) {
      constraints.push(newConstraint({ mission_id: missionId, constraint_type: 'culture', dimension: 'execution', severity: 'moderate',
        description: 'A high-intensity, strained environment risks attrition and burnout on the critical path of a demanding mission.',
        evidence: (flour && flour.level === 'strained' ? 'Employee flourishing reads strained. ' : '') + (pres && pres.level === 'high-intensity' ? 'Pressure environment reads high-intensity.' : '') }));
    }
    // directed autonomy while mission needs high autonomy → autonomy/decision constraint
    if (cur.dimensions.autonomy.level === 'low' && ordOf(mf.dimensions.autonomy.level) >= 3) {
      constraints.push(newConstraint({ mission_id: missionId, constraint_type: 'decision_making', dimension: 'autonomy', severity: 'major',
        description: 'Decisions are centralized, but the mission needs teams to act without waiting for sign-off.',
        evidence: 'Validated autonomy reads directed/centralized.' }));
    }
    // major unknowns → information constraint
    gaps.filter(function (g) { return g.current_state === 'unknown'; }).forEach(function (g) {
      constraints.push(newConstraint({ mission_id: missionId, constraint_type: 'unknown', dimension: g.dimension, severity: 'moderate',
        description: 'No validated reading of ' + DIM_LABELS[g.dimension].toLowerCase() + ' — you are planning the mission partly blind here.',
        evidence: 'Dimension unvalidated in the 3C profile.' }));
    });

    // ----- recommendations: priority moves (organizational, not hiring) -----
    var sevToPri = { critical: 'critical', major: 'high', moderate: 'medium', minor: 'low' };
    gaps.slice().sort(function (a, b) { return SEVERITY.indexOf(b.severity) - SEVERITY.indexOf(a.severity); }).forEach(function (g) {
      recs.push(newRec({ mission_id: missionId, dimension: g.dimension, priority: sevToPri[g.severity] || 'medium',
        title: recTitle(g.dimension, g, m), description: recBody(g.dimension, g, m), reasoning: g.reasoning }));
    });
    // a recommendation per major/critical constraint not already covered by a gap rec
    constraints.filter(function (c) { return c.severity === 'major'; }).forEach(function (c) {
      if (recs.some(function (r) { return r.dimension === c.dimension; })) return;
      recs.push(newRec({ mission_id: missionId, dimension: c.dimension, priority: 'high',
        title: 'Remove the ' + titleish(c.constraint_type) + ' constraint on ' + DIM_LABELS[c.dimension], description: c.description, reasoning: c.evidence }));
    });

    gaps.forEach(function (g) { store.frequency_gaps.push(g); });
    constraints.forEach(function (c) { store.mission_constraints.push(c); });
    recs.forEach(function (r) { store.mission_recommendations.push(r); });
    audit(store, 'analysis', m.company_name, 'generated', gaps.length + ' gaps, ' + constraints.length + ' constraints, ' + recs.length + ' recommendations');
    OF.save(store);
    return { gaps: gaps, constraints: constraints, recommendations: recs };
  }

  function recTitle(dim, g, m) {
    var t = {
      execution: 'Set the speed-vs-quality rule for the mission',
      autonomy: 'Push decision rights to the mission teams',
      innovation: 'Fund and protect dedicated innovation capacity',
      learning: 'Stand up structured learning loops for the new domain',
      adaptability: 'Build in re-planning cadence',
      collaboration: 'Wire the cross-functional seams before they break',
      communication: 'Open a high-bandwidth channel for the mission',
      leadership: 'Name a single accountable mission sponsor',
      growth_orientation: 'Make the growth bet explicit and resourced',
      risk_tolerance: 'Define the acceptable-failure envelope'
    };
    return t[dim] || ('Close the ' + DIM_LABELS[dim] + ' gap');
  }
  function recBody(dim, g, m) {
    var b = {
      execution: 'Decide, per surface, where the mission optimizes for speed and where it protects craft — and make that explicit so teams stop relitigating it.',
      autonomy: 'Define what the mission team can decide and act on without sign-off; the current ' + g.current_state + ' reading will otherwise throttle the pace this mission needs.',
      innovation: 'Carve out protected capacity for the new bet so it is not crowded out by the core; the mission requires ' + g.required_state + ' innovation.',
      learning: 'Create deliberate learning loops (postmortems, customer discovery, expert review) so the org builds the new capability rather than assuming it.',
      adaptability: 'Set a re-planning rhythm so plans flex as the mission meets reality, given the current ' + g.current_state + ' adaptability.',
      collaboration: 'Identify the function-to-function handoffs the mission depends on and assign explicit owners before they become the bottleneck.',
      communication: 'Establish a recurring, candid forum for the mission so signal travels faster than the org chart.',
      leadership: 'Assign one accountable sponsor with the authority to unblock; ambition of this scale fails without clear ownership.',
      growth_orientation: 'Translate the growth ambition into resourced commitments rather than aspiration.',
      risk_tolerance: 'Agree up front what failure is acceptable and what is not, so teams take the right bets at the required pace.'
    };
    return b[dim] || ('Move ' + DIM_LABELS[dim] + ' from ' + g.current_state + ' toward ' + g.required_state + '.');
  }

  /* ==========================================================
     READS
     ========================================================== */
  function missionConfidence(missionId, store) {
    store = ensure(store || OF.load());
    var m = byId(store.mission_profiles, 'mission_id', missionId);
    var mf = store.mission_frequencies.filter(function (x) { return x.mission_id === missionId; })[0];
    var cur = m ? currentFrequency(m.campaign_id, store) : null;
    if (!m || !mf || !cur) return { level: 'low', reasoning: 'Incomplete inputs.' };
    var known = MISSION_DIMS.filter(function (d) { return cur.dimensions[d].level !== 'unknown'; }).length;
    var coverage = known / MISSION_DIMS.length;
    var missionConf = mf.confidence;
    var lvl = (coverage >= 0.75 && missionConf !== 'low') ? 'medium' : 'low';
    if (coverage >= 0.9 && missionConf === 'high') lvl = 'high';
    return { level: lvl, reasoning: known + '/' + MISSION_DIMS.length + ' current dimensions validated · mission-frequency confidence ' + missionConf + ' · gap analysis is only as strong as the validated profile beneath it.' };
  }
  function getMission(missionId, store) {
    store = ensure(store || OF.load());
    var m = byId(store.mission_profiles, 'mission_id', missionId);
    if (!m) return null;
    return {
      mission: m,
      current: currentFrequency(m.campaign_id, store),
      mission_frequency: store.mission_frequencies.filter(function (x) { return x.mission_id === missionId; })[0] || null,
      gaps: store.frequency_gaps.filter(function (g) { return g.mission_id === missionId; }),
      constraints: store.mission_constraints.filter(function (c) { return c.mission_id === missionId; }),
      recommendations: store.mission_recommendations.filter(function (r) { return r.mission_id === missionId; }),
      confidence: missionConfidence(missionId, store)
    };
  }
  function snapshot(store) {
    store = ensure(store || OF.load());
    return {
      anchors: anchors(store),
      missions: store.mission_profiles.slice().reverse(),
      counts: {
        anchors: (store.val_profiles || []).length,
        missions: store.mission_profiles.length,
        gaps: store.frequency_gaps.length,
        constraints: store.mission_constraints.length,
        recommendations: store.mission_recommendations.length
      }
    };
  }
  function resetMissionGap(store) {
    store = ensure(store || OF.load());
    store.mission_profiles = []; store.mission_frequencies = []; store.frequency_gaps = [];
    store.mission_constraints = []; store.mission_recommendations = []; store.mg_audit_log = [];
    OF.save(store);
  }

  OF.missiongap = {
    MISSION_STATUS: MISSION_STATUS, MISSION_DIMS: MISSION_DIMS, DIM_LABELS: DIM_LABELS,
    SEVERITY: SEVERITY, CONSTRAINT_TYPES: CONSTRAINT_TYPES, PRIORITY: PRIORITY, SOURCE_KINDS: SOURCE_KINDS,
    ensure: ensure,
    anchors: anchors, currentFrequency: currentFrequency,
    createMission: createMission, generateMissionFrequency: generateMissionFrequency,
    analyze: analyze, missionConfidence: missionConfidence,
    getMission: getMission, snapshot: snapshot, resetMissionGap: resetMissionGap
  };
})();
