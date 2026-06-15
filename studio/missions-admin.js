/* =============================================================
   missions-admin.js — Studio · the Mission Spine view  (1A)
   =============================================================
   Reads the shared OF store (of.runtime.v1) that the Aeon1
   mission-capture flow writes to, and renders, per mission:
     • Organization · Mission · Person
     • Relationship map (org owns mission · user describes it)
     • Memory seeds (Evidence → Transformation → Essence)
     • Research status (Tier 0/1/2 attach points)
     • Next recommended action (pure read — mission-first)
   ============================================================= */
(function () {
  'use strict';
  var OF = window.OF;

  var listEl  = document.getElementById('mx-list');
  var statsEl = document.getElementById('mx-stats');

  function esc(s) {
    return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function render() {
    var store = OF.load();
    if (OF.validation) OF.validation.ensure(store);
    var graph = OF.getMissionGraph(store);

    var nVal = (store.validations || []).length;
    var nUnd = (store.validated_understandings || []).length;
    statsEl.innerHTML =
      '<span><b>' + store.missions.length + '</b> mission' + (store.missions.length === 1 ? '' : 's') + '</span>' +
      '<span><b>' + store.organizations.length + '</b> organization' + (store.organizations.length === 1 ? '' : 's') + '</span>' +
      '<span><b>' + store.users.length + '</b> ' + (store.users.length === 1 ? 'person' : 'people') + '</span>' +
      '<span><b>' + store.seeds.length + '</b> memory seed' + (store.seeds.length === 1 ? '' : 's') + '</span>' +
      '<span><b>' + nVal + '</b> validation' + (nVal === 1 ? '' : 's') + '</span>' +
      '<span><b>' + nUnd + '</b> understanding' + (nUnd === 1 ? '' : 's') + '</span>';

    if (!graph.length) {
      listEl.innerHTML =
        '<div class="mx-empty">No missions on the spine yet.<br>' +
        'Run a <a href="../frequency/index.html">mission capture</a>, or load a mock example above.</div>';
      return;
    }

    // newest first
    graph.sort(function (a, b) { return (b.mission.created_at || '').localeCompare(a.mission.created_at || ''); });
    listEl.innerHTML = graph.map(renderMission).join('');
  }

  function renderMission(node) {
    var m = node.mission, o = node.organization, u = node.user;
    var isMock = m.source === 'mock_example';

    var pills =
      pill(m.mission_type) +
      pill(m.mission_stage, stageClass(m.mission_stage)) +
      pill('hiring: ' + m.hiring_relevance, m.hiring_relevance === 'none' ? 'mute' : '');

    var orgCell =
      '<div class="mx-cell">' +
        '<div class="mx-label">Organization</div>' +
        kv('Name', '<em>' + esc(o ? o.organization_name : '—') + '</em>') +
        kv('Research', '<span class="mx-pill mute">' + esc(o ? o.research_status : '—') + '</span>') +
        kv('Frequency', '<span class="mx-pill mute">placeholder · not computed</span>') +
        (o && o.preliminary_essence ? kv('Essence seed', esc(o.preliminary_essence)) : '') +
      '</div>';

    var personCell =
      '<div class="mx-cell">' +
        '<div class="mx-label">Person · describer</div>' +
        kv('Name', '<em>' + esc(u ? (u.name || 'Unnamed') : '—') + '</em>') +
        kv('Role', '<span class="mx-pill">' + esc(u ? u.primary_role : '—') + '</span>') +
        kv('Relationship', '<span class="mx-pill">' + esc(u ? u.relationship_to_mission : '—') + '</span>') +
      '</div>';

    var missionCell =
      '<div class="mx-cell full">' +
        '<div class="mx-label">Mission detail</div>' +
        kv('Outcome', esc(m.desired_outcome || '—')) +
        (m.time_horizon ? kv('Horizon', esc(m.time_horizon)) : '') +
        (m.obstacles && m.obstacles.length ? kv('Obstacle', esc(m.obstacles[0])) : '') +
        (m.people_dependency ? kv('People', esc(m.people_dependency)) : '') +
      '</div>';

    var relCell =
      '<div class="mx-cell">' +
        '<div class="mx-label">Relationship map</div>' +
        '<div class="mx-rel">' +
          '<b>' + esc(o ? o.organization_name : 'Organization') + '</b><span class="arr">owns →</span><b>' + esc(m.mission_name || 'mission') + '</b><br>' +
          '<b>' + esc(u ? (u.name || 'The describer') : 'Person') + '</b><span class="arr">describes →</span><b>' + esc(m.mission_name || 'mission') + '</b>' +
        '</div>' +
      '</div>';

    var research = m.research || OF.newResearchPlaceholder();
    var researchCell =
      '<div class="mx-cell">' +
        '<div class="mx-label">Research · attach points</div>' +
        kv('Tier 0', '<span class="mx-pill mute">' + esc(research.tier0.status) + '</span> ' + esc(research.tier0.label)) +
        kv('Tier 1', '<span class="mx-pill mute">' + esc(research.tier1.status) + '</span> ' + esc(research.tier1.label)) +
        kv('Tier 2', '<span class="mx-pill mute">' + esc(research.tier2.status) + '</span> ' + esc(research.tier2.label)) +
      '</div>';

    var seeds = (node.seeds || []).map(function (s) {
      return '<div class="mx-seed">' +
        '<div class="sk"><span>' + esc(seedLabel(s)) + '</span><span class="stage">' + esc(s.seam_stage) + '</span></div>' +
        '<div class="st">' + esc(seedText(s)) + '</div>' +
        '</div>';
    }).join('') || '<div class="mx-kv"><div class="v" style="color:var(--mx-ink4)">No seeds.</div></div>';

    var seedsCell =
      '<div class="mx-cell full">' +
        '<div class="mx-label">Memory seeds · Evidence → Transformation → Essence</div>' +
        seeds +
      '</div>';

    var nextCell =
      '<div class="mx-cell full">' +
        '<div class="mx-label">Next recommended action</div>' +
        '<div class="mx-next">' + esc((OF.research && OF.research.recommendedNext) ? OF.research.recommendedNext(node) : OF.nextRecommendedAction(node)) +
          '<div class="why">Mission first: the spine never jumps to candidates. Frequency must be read before resonance.</div>' +
        '</div>' +
      '</div>';

    var researchBlock = buildResearchBlock(node);
    var validationBlock = buildValidationBlock(node);
    var frequencyBlock = buildFrequencyBlock(node);
    var roleBlock = buildRoleBlock(node);

    return '<div class="mx-mission' + (isMock ? ' is-mock' : '') + '">' +
      '<div class="mx-mtop">' +
        '<div>' +
          '<div class="mx-mname">' + esc(m.mission_name || m.desired_outcome || 'Untitled mission') + '</div>' +
          '<div class="mx-mid">' + esc(m.mission_id) + ' · ' + esc((m.created_at || '').slice(0, 10)) + '</div>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:10px">' +
          (isMock ? '<span class="mx-mock-tag">mock</span>' : '') +
          '<div class="mx-pills">' + pills + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="mx-grid">' +
        orgCell + personCell + missionCell + relCell + researchCell + seedsCell + nextCell +
      '</div>' +
      researchBlock +
      validationBlock +
      frequencyBlock +
      roleBlock +
    '</div>';
  }

  /* ---- Role layer block (1F) ------------------------------- */
  function buildRoleBlock(node) {
    var m = node.mission, o = node.organization;
    if (!o || !OF.role) return '';
    // generate hypotheses from current hiring interventions (idempotent)
    OF.role.syncHypotheses(m.mission_id);
    var data = OF.role.getForMission(m.mission_id);
    if (!data.gap) return '';
    var label = (OF.research && OF.research.confidenceLabel) ? OF.research.confidenceLabel : function () { return '—'; };
    var human = OF.frequency ? OF.frequency.human : function (l) { return l; };

    // open hypotheses (not yet promoted), grouped by dimension
    var open = data.hypotheses.filter(function (h) { return !h.promoted_role_id; });
    var defined = data.roles.filter(function (r) { return r.role_stage !== 'retired'; });

    var intro = '<div class="mx-label">Role · the bridge from gap to person</div>' +
      '<div class="mx-rel2">Mission → <b>gap</b> → <b>role</b> → role frequency → person <span style="color:var(--mx-ink4)">(person &amp; resonance: later builds)</span></div>';

    if (!open.length && !defined.length) {
      return '<div class="mx-role">' + intro +
        '<div class="mx-fsum" style="color:var(--mx-ink4)">No role hypotheses yet. Roles are generated only from gaps whose intervention is <em>hiring</em> — other gaps (training, leadership, process, structure, communication, research) do not create roles. Compute the frequency layer and validate a hiring-relevant gap first.</div>' +
      '</div>';
    }

    var hypHtml = open.length ? ('<div class="mx-r-sub">Role hypotheses · possible roles, not requisitions</div>' +
      open.map(function (h) {
        return '<div class="mx-rhyp">' +
          '<div class="rn">' + esc(h.role_name) + ' <span class="mx-pill mute">' + esc(h.dimension) + '</span></div>' +
          '<div class="rr">' + esc(h.rationale) + '</div>' +
          '<button class="mx-rolebtn" type="button" data-role="' + esc(h.hypothesis_id) + '">Define this role →</button>' +
        '</div>';
      }).join('')) : '';

    var roleHtml = defined.length ? ('<div class="mx-r-sub">Defined roles · purpose before title</div>' +
      defined.map(function (r) {
        var rf = data.role_frequency(r.role_id);
        var c = data.contribution(r.role_id);
        var freqRows = rf ? (rf.dimensions || []).map(function (d) {
          return '<div class="mx-rfc' + (d.primary ? ' primary' : '') + '"><div class="rfd">' + esc(d.dimension) + (d.primary ? ' · core' : '') + '</div>' +
            '<div class="rfl">' + esc(human(d.required_level)) + ' · ' + esc(label(d.confidence)) + '</div></div>';
        }).join('') : '';
        return '<div class="mx-rolecard">' +
          '<div class="mx-rolehead"><div class="mx-rolename">' + esc(r.role_name) + '</div>' +
            '<div class="mx-roletags"><span class="mx-pill">' + esc(r.priority) + '</span><span class="mx-pill mute">' + esc(r.role_stage) + '</span></div></div>' +
          '<div class="mx-rolekv"><span class="rk">Problem it solves · purpose</span>' + esc(r.role_purpose) + '</div>' +
          '<div class="mx-rolekv"><span class="rk">Success</span>' + esc(r.role_success_definition) + '</div>' +
          (c ? '<div class="mx-rolekv"><span class="rk">Contribution to the gap</span>' + esc(c.contribution_summary) + '</div>' : '') +
          (rf ? '<div class="mx-rolekv"><span class="rk">Role frequency · ' + esc(rf.frequency_summary) + '</span></div><div class="mx-rolefreq">' + freqRows + '</div>' : '') +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:14px">' +
            '<a class="mx-rolebtn" href="../studio/mandates.html" style="text-decoration:none;display:inline-block">Take this role to a Mandate →</a>' +
            '<button class="mx-rolebtn" type="button" data-roleretire="' + esc(r.role_id) + '">Retire role</button>' +
          '</div>' +
        '</div>';
      }).join('')) : '';

    return '<div class="mx-role">' + intro + roleHtml + hypHtml + '</div>';
  }

  /* ---- Frequency layer block (1D) -------------------------- */
  function buildFrequencyBlock(node) {
    var m = node.mission, o = node.organization;
    if (!o || !OF.frequency) return '';
    var layer = OF.frequency.getLayer(o.organization_id, m.mission_id);
    var label = (OF.research && OF.research.confidenceLabel) ? OF.research.confidenceLabel : function () { return '—'; };
    var human = OF.frequency.human;
    var hasUnd = OF.frequency.hasUnderstanding(o.organization_id);

    var computeBtn = '<button class="mx-freqbtn" type="button" data-freq="' + esc(o.organization_id) + '" data-mis="' + esc(m.mission_id) + '">' +
      (layer.required ? 'Recompute frequency layer' : 'Compute frequency layer') + '</button>';

    if (!layer.required) {
      return '<div class="mx-freq">' +
        '<div class="mx-label">Frequency</div>' +
        '<div class="mx-eq">Mission → <b>required frequency</b> → <b>current frequency</b> → <b>gap</b> → intervention hypotheses</div>' +
        '<div class="mx-fsum">Not computed. <b>Required</b> frequency derives from the mission; <b>current</b> derives only from <em>validated understanding</em>' +
        (hasUnd ? '.' : ' — and none exists yet, so current will read mostly <em>unknown</em> until you validate hypotheses.') + '</div>' +
        computeBtn +
        '<div class="mx-noscore">no score · no percentage · per-dimension and explainable</div>' +
      '</div>';
    }

    var req = index2(layer.required.required_dimensions, 'dimension');
    var cur = index2(layer.current.current_dimensions, 'dimension');

    var rows = (layer.gap.dimension_gaps || []).map(function (g) {
      return '<div class="mx-frow">' +
        '<div class="dn">' + esc(g.dimension) + '</div>' +
        '<div class="lv">' + esc(human(g.required_level)) + (g.required_validated ? ' <span class="mx-vtick">✓</span>' : '') + '</div>' +
        '<div class="lv' + (g.current_level === 'unknown' ? ' unknown' : '') + '">' + esc(human(g.current_level)) + (g.current_validated ? ' <span class="mx-vtick">✓</span>' : '') + '</div>' +
        '<div><span class="mx-gp ' + esc(g.gap_level) + '">' + esc(g.gap_level) + '</span> <span class="mx-gpc ' + esc(g.gap_confidence) + '">' + esc(g.gap_confidence) + ' conf</span></div>' +
        '<div class="mx-fev">' + esc(g.evidence) + ' ' + esc(g.confidence_reasoning) + '</div>' +
      '</div>';
    }).join('');

    var interventions = (layer.interventions || []).map(function (iv) {
      return '<div class="mx-int"><div class="it">' + esc(iv.intervention_type) + (iv.dimension ? ' · ' + esc(iv.dimension) : '') + ' · ' + esc(label(iv.confidence)) + '</div>' +
        '<div class="ir">' + esc(iv.rationale) + '</div></div>';
    }).join('');

    // 1E — Required validation, gap confidence, promotion log
    var requiredVal = buildRequiredValidation(layer.required);
    var promotion = buildPromotionLog(o);
    var confLine = '<div class="mx-conf-line">Confidence · current <b>' + esc(label(layer.current.confidence)) +
      '</b> · required <b>' + esc(label(layer.required.confidence)) + '</b> · gap <b>' + esc(label(layer.gap.confidence)) + '</b> · no scores, no ranking</div>';

    return '<div class="mx-freq">' +
      '<div class="mx-label">Frequency · explanation, not a scorecard</div>' +
      '<div class="mx-eq">Mission → <b>required</b> → <b>current</b> (validated only) → <b>gap</b> → intervention hypotheses</div>' +

      '<div class="mx-fsum"><b>Required:</b> ' + esc(layer.required.required_summary) + '</div>' +
      '<div class="mx-fsum"><b>Current:</b> ' + esc(layer.current.current_summary) + '</div>' +
      '<div class="mx-fsum"><b>Gap:</b> ' + esc(layer.gap.gap_summary) + '</div>' +
      confLine +

      '<div class="mx-r-sub">Per-dimension · required vs current vs gap</div>' +
      '<div class="mx-ftable">' +
        '<div class="mx-fhead"><div>Dimension</div><div>Required</div><div>Current (validated)</div><div>Gap</div></div>' +
        rows +
      '</div>' +

      requiredVal +

      '<div class="mx-r-sub">Intervention hypotheses · not recommendations</div>' +
      interventions +

      promotion +

      '<div class="mx-fsum" style="margin-top:6px"><b>Next research:</b> ' + esc(layer.gap.recommended_next_research) + '</div>' +
      computeBtn +
      '<div class="mx-noscore">no score · no percentage · current updates only when validated understanding changes</div>' +
    '</div>';
  }
  function index2(arr, key) { var o = {}; (arr || []).forEach(function (x) { o[x[key]] = x; }); return o; }

  /* ---- 1E: Required-side validation subsection ------------- */
  function buildRequiredValidation(required) {
    if (!required || !OF.requiredValidation) return '';
    var label = (OF.research && OF.research.confidenceLabel) ? OF.research.confidenceLabel : function () { return '—'; };
    var data = OF.requiredValidation.getForFreq(required.required_frequency_id);
    var queue = data.validations.filter(function (v) { return v.validation_status === 'untested'; })
      .sort(function (a, b) { return b.confidence_before - a.confidence_before; });
    var tested = data.validations.filter(function (v) { return v.validation_status !== 'untested'; });

    var queueHtml = queue.length ? ('<div class="mx-r-sub">Required validation queue · is this really required?</div>' +
      queue.map(function (v) {
        return '<div class="mx-vrow">' +
          '<div class="mx-vstatement">' + esc(v.statement) + '</div>' +
          '<div class="mx-vmeta2"><span class="mx-status untested">untested</span><span class="mx-vconf">prior <b>' + esc(label(v.confidence_before)) + '</b></span></div>' +
          '<div class="mx-vbtns">' +
            rvbtn(v.required_validation_id, 'accurate', 'Accurate') +
            rvbtn(v.required_validation_id, 'partially', 'Partially') +
            rvbtn(v.required_validation_id, 'inaccurate', 'Inaccurate') +
            rvbtn(v.required_validation_id, 'unsure', 'Unsure') +
          '</div></div>';
      }).join('')) : '';

    var testedHtml = tested.length ? ('<div class="mx-r-sub">Required validation history</div>' +
      tested.map(function (v) {
        return '<div class="mx-vrow ' + esc(v.validation_status) + '">' +
          '<div class="mx-vstatement">' + esc(v.statement) + '</div>' +
          '<div class="mx-vmeta2"><span class="mx-status ' + esc(v.validation_status) + '">' + esc(v.validation_status) + '</span>' +
            '<span class="mx-vconf">conf <b>' + esc(label(v.confidence_before)) + ' → ' + esc(label(v.confidence_after)) + '</b></span>' +
            '<span class="mx-vconf">source: ' + esc(v.source) + '</span></div></div>';
      }).join('')) : '';

    var undHtml = data.understandings.length ? ('<div class="mx-r-sub">Validated required understanding</div>' +
      data.understandings.map(function (u) {
        return '<div class="mx-und"><div class="ut">' + esc(u.validated_statement) + '</div>' +
          '<div class="um">' + esc(label(u.confidence)) + ' confidence · required side confirmed</div></div>';
      }).join('')) : '';

    if (!queueHtml && !testedHtml && !undHtml) return '';
    return queueHtml + testedHtml + undHtml;
  }
  function rvbtn(id, r, label) {
    return '<button class="mx-vbtn" type="button" data-rv="' + esc(id) + '" data-r="' + r + '">' + esc(label) + '</button>';
  }

  /* ---- 1E: Frequency promotion log ------------------------- */
  function buildPromotionLog(org) {
    var store = OF.load();
    var log = (store.frequency_promotion_log || []).filter(function (l) { return l.organization_id === org.organization_id; });
    var pf = org.preliminary_frequency;
    var living = (pf && pf.dimensions && pf.dimensions.length)
      ? '<div class="mx-fsum"><b>Living frequency (org):</b> ' +
        pf.dimensions.map(function (d) { return d.dimension.toLowerCase() + ' ' + (d.level === 'very_high' ? 'very high' : d.level); }).join(', ') +
        '. <span style="color:var(--mx-ink4)">Only validated dimensions are written here.</span></div>'
      : '<div class="mx-fsum" style="color:var(--mx-ink4)">No dimensions promoted to the living frequency yet — validate current hypotheses first.</div>';
    if (!log.length) return '<div class="mx-r-sub">Frequency promotion · validated understanding → living frequency</div>' + living;
    var rows = log.slice(-8).reverse().map(function (l) {
      return '<div class="mx-plog"><div class="pt">' + esc(l.dimension) + ' → <em>' + esc(l.level === 'very_high' ? 'very high' : l.level) + '</em></div>' +
        '<div class="pm">from ' + esc(l.from) + ' · ' + esc(l.source) + ' · ' + esc((l.date || '').slice(0, 10)) + '</div></div>';
    }).join('');
    return '<div class="mx-r-sub">Frequency promotion · validated understanding → living frequency</div>' + living + rows;
  }

  /* ---- Tier-0 research block (1B) -------------------------- */
  function buildResearchBlock(node) {
    var m = node.mission, o = node.organization;
    if (!o) return '';
    var rr = (OF.research && OF.research.getResearchForOrg) ? OF.research.getResearchForOrg(o.organization_id) : {};
    var ana = (OF.research && OF.research.getAnalysisForMission) ? OF.research.getAnalysisForMission(m.mission_id) : null;
    var label = OF.research ? OF.research.confidenceLabel : function () { return '—'; };

    var runRow =
      '<div class="mx-run">' +
        '<textarea data-pi="' + esc(o.organization_id) + '" placeholder="Optional: paste public text — careers page, about page, a founder post, news. Findings will be grounded in it. Leave empty to infer from the mission only."></textarea>' +
        '<button class="mx-runbtn" data-run="' + esc(o.organization_id) + '" data-mis="' + esc(m.mission_id) + '" type="button">' +
          (rr.research ? 'Re-run Tier-0' : 'Run Tier-0 research') + '</button>' +
        (rr.research ? '<button class="mx-run1btn" data-run1="' + esc(o.organization_id) + '" data-mis="' + esc(m.mission_id) + '" type="button">' +
          (o.research_status === 'tier1' ? 'Re-run Tier-1 (guided)' : 'Run Tier-1 (deeper)') + '</button>' : '') +
      '</div>';

    if (!rr.research) {
      return '<div class="mx-research">' +
        '<div class="mx-label">Tier-0 research · outside-in</div>' +
        '<div class="mx-r-narr">No research yet. Forms a preliminary <em>essence</em> and <em>frequency</em> hypothesis from public signal — held as hypothesis, never a score.</div>' +
        runRow +
      '</div>';
    }

    var research = rr.research, ess = rr.essence, freq = rr.frequency;

    var sources = (research.sources || []).map(function (s) {
      return '<span class="s' + (s.consulted ? ' on' : '') + '">' + esc(s.label || s.source_type) + (s.consulted ? ' ✓' : '') + '</span>';
    }).join('');

    var findings = (research.findings || []).map(function (f) {
      return '<div class="mx-find"><div class="ft">' + esc(f.finding) + '</div>' +
        '<div class="fm">' + esc(f.source_type) + ' · ' + esc(label(f.confidence)) + ' confidence' +
        (f.inferred ? ' · <span class="inf">inferred</span>' : '') + '</div></div>';
    }).join('');

    var dims = (freq && freq.dimension_estimates || []).map(function (d) {
      return '<div class="mx-dim"><div class="dn">' + esc(d.dimension) + '</div>' +
        '<div class="de">' + esc(d.estimate) + '</div>' +
        '<div class="dc">' + esc(label(d.confidence)) + ' · ' + esc(d.evidence || '') + '</div></div>';
    }).join('');

    var analysisHtml = ana ?
      '<div class="mx-r-sub">Mission analysis · hypothesis + status</div>' +
      kv('Must become', esc(ana.required_organization_hypothesis)) +
      kv('Appears today', esc(ana.current_organization_hypothesis)) +
      (ana.mission_risk_observations && ana.mission_risk_observations.length ?
        kv('Risks', '<ul class="of-risks" style="margin:0;padding-left:16px">' + ana.mission_risk_observations.map(function (x) {
          return '<li style="color:var(--mx-ink2);font-family:var(--mx-sans);font-weight:300;font-size:12.5px;line-height:1.6">' +
            esc(x) + '<span class="mx-anastatus">' + esc(valStatusLabel(o.organization_id, x)) + '</span></li>';
        }).join('') + '</ul>') : '') +
      kv('Next research', esc(ana.next_research_needed)) : '';

    return '<div class="mx-research">' +
      '<div class="mx-r-head">' +
        '<div class="mx-label" style="margin:0">Tier-0 research · outside-in · hypothesis</div>' +
        '<span class="mx-conf">research ' + esc(label(research.confidence)) + '</span>' +
        '<span class="mx-pill mute">status: ' + esc(research.research_status) + '</span>' +
      '</div>' +

      '<div class="mx-r-sub">Organization essence · hypothesis · ' + esc(label(ess.confidence)) + ' confidence</div>' +
      '<div class="mx-r-narr">' + esc(ess.core_narrative) + '</div>' +

      '<div class="mx-r-sub">Frequency hypothesis · 10 dimensions · ' + esc(label(freq.confidence)) + ' confidence</div>' +
      '<div class="mx-dims">' + dims + '</div>' +

      '<div class="mx-r-sub">Sources · intended vs consulted</div>' +
      '<div class="mx-src">' + sources + '</div>' +

      '<div class="mx-r-sub">Findings · evidence seeds only</div>' +
      findings +

      analysisHtml +

      '<div style="margin-top:16px">' + runRow + '</div>' +
    '</div>';
  }

  /* ---- Validation block (1C) ------------------------------ */
  function buildValidationBlock(node) {
    var m = node.mission, o = node.organization;
    if (!o || !OF.validation) return '';
    var data = OF.validation.getForOrg(o.organization_id);
    var label = (OF.research && OF.research.confidenceLabel) ? OF.research.confidenceLabel : function () { return '—'; };
    // Nothing to show until research has queued hypotheses.
    if (!data.validations.length && !data.understandings.length) return '';

    var queue = data.validations.filter(function (v) { return v.validation_status === 'untested'; })
      .sort(function (a, b) { return b.confidence_before - a.confidence_before; });
    var tested = data.validations.filter(function (v) { return v.validation_status !== 'untested'; });

    var queueHtml = queue.length ? ('<div class="mx-r-sub">Validation queue · untested hypotheses</div>' +
      queue.map(function (v) {
        return '<div class="mx-vrow">' +
          '<div class="mx-vstatement">' + esc(v.statement) + '</div>' +
          '<div class="mx-vmeta2">' +
            '<span class="mx-status untested">untested</span>' +
            '<span class="mx-vconf">prior <b>' + esc(label(v.confidence_before)) + '</b></span>' +
            '<span class="mx-vconf">' + esc(v.target_type) + '</span>' +
          '</div>' +
          '<div class="mx-vbtns">' +
            vbtn(v.validation_id, 'accurate', 'Accurate') +
            vbtn(v.validation_id, 'partially', 'Partially') +
            vbtn(v.validation_id, 'inaccurate', 'Inaccurate') +
            vbtn(v.validation_id, 'unsure', 'Unsure') +
          '</div>' +
        '</div>';
      }).join('')) : '';

    var testedHtml = tested.length ? ('<div class="mx-r-sub">Validation history</div>' +
      tested.map(function (v) {
        var ev = v.supporting_evidence.length + ' supporting · ' + v.contradicting_evidence.length + ' contradicting';
        return '<div class="mx-vrow ' + esc(v.validation_status) + '">' +
          '<div class="mx-vstatement">' + esc(v.statement) + '</div>' +
          '<div class="mx-vmeta2">' +
            '<span class="mx-status ' + esc(v.validation_status) + '">' + esc(v.validation_status) + '</span>' +
            '<span class="mx-vconf">conf <b>' + esc(label(v.confidence_before)) + ' → ' + esc(label(v.confidence_after)) + '</b></span>' +
            '<span class="mx-vconf">source: ' + esc(v.source) + '</span>' +
            '<span class="mx-vconf">' + esc(ev) + '</span>' +
            '<span class="mx-vconf">' + v.history.length + ' event' + (v.history.length === 1 ? '' : 's') + '</span>' +
          '</div>' +
        '</div>';
      }).join('')) : '';

    var undHtml = data.understandings.length ? ('<div class="mx-r-sub">Validated understanding</div>' +
      data.understandings.map(function (u) {
        return '<div class="mx-und"><div class="ut">' + esc(u.statement) + '</div>' +
          '<div class="um">' + esc(label(u.confidence)) + ' confidence · ' + u.supporting_validations.length + ' validation' + (u.supporting_validations.length === 1 ? '' : 's') + ' · promoted past threshold ' + OF.validation.UNDERSTANDING_THRESHOLD + '</div></div>';
      }).join('')) : '';

    var next = OF.validation.nextValidationNeeded(o.organization_id);

    return '<div class="mx-val">' +
      '<div class="mx-label">Validation</div>' +
      '<div class="mx-chain">Promotion path · <b>evidence → hypothesis → validation → validated understanding</b> → transformation → essence <span style="color:var(--mx-ink4)">(last two: later builds)</span></div>' +
      queueHtml +
      testedHtml +
      undHtml +
      '<div class="mx-vnext"><b>Next validation needed:</b> ' + esc(next) + '</div>' +
    '</div>';
  }

  function vbtn(valId, r, label) {
    return '<button class="mx-vbtn" type="button" data-val="' + esc(valId) + '" data-r="' + r + '">' + esc(label) + '</button>';
  }

  // Validation status of a mission-analysis statement, for inline display.
  function valStatusLabel(orgId, statement) {
    if (!OF.validation) return '· untested';
    var vs = OF.validation.getForOrg(orgId).validations;
    var n = (statement || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    var match = vs.filter(function (v) {
      return (v.statement || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() === n;
    })[0];
    return '· ' + (match ? match.validation_status : 'untested');
  }

  function kv(k, v) {
    return '<div class="mx-kv"><div class="k">' + esc(k) + '</div><div class="v">' + v + '</div></div>';
  }
  function pill(text, cls) {
    return '<span class="mx-pill ' + (cls || '') + '">' + esc(text) + '</span>';
  }
  function stageClass(stage) {
    if (stage === 'urgent' || stage === 'blocked') return 'warm';
    return '';
  }
  function seedLabel(s) {
    var map = {
      evidence: 'Evidence seed', mission_summary: 'Mission summary',
      open_question: 'Open question', transformation: 'Transformation candidate',
      essence: 'Essence seed'
    };
    return (map[s.kind] || s.kind) + ' · ' + s.subject_type;
  }
  function seedText(s) {
    var p = s.payload || {};
    return p.summary || p.question || p.description || p.core_paragraph || '—';
  }

  /* ---- Mock example (clearly tagged) ----------------------- */
  function seedExample() {
    var res = OF.commitCapture({
      organization: {
        organization_name: 'Helio Robotics',
        industry: 'Applied robotics', size: '70–90 people', location: 'Munich, DE'
      },
      mission: {
        mission_name: 'Stand up a Berlin applied-AI team',
        mission_description: 'Open a Berlin site and build a six-person applied-AI team to bring perception models in-house within two quarters.',
        desired_outcome: 'A functioning six-person applied-AI team in Berlin, shipping perception models in-house',
        time_horizon: 'two quarters',
        obstacles: ['No senior ML leadership in Europe to anchor the team, and the perception work is currently outsourced.'],
        people_dependency: 'Central — without the right senior hire first, the rest of the team cannot be built around them.',
        mission_type: 'new_geography',
        mission_stage: 'active',
        hiring_relevance: 'central',
        confidence: 0.7
      },
      user: { name: 'Dana Olsson', primary_role: 'founder' },
      raw: { note: 'mock example seeded from the admin' }
    });
    // tag the mission as mock so the view distinguishes it
    var store = OF.load();
    var mis = store.missions.filter(function (m) { return m.mission_id === res.mission.mission_id; })[0];
    if (mis) { mis.source = 'mock_example'; OF.save(store); }
    render();
  }

  document.getElementById('mx-seed-example').addEventListener('click', seedExample);
  document.getElementById('mx-reset').addEventListener('click', function () {
    if (confirm('Clear the entire Mission Spine on this device? Captured missions and seeds will be removed.')) {
      OF.reset();
      render();
    }
  });

  // Run / re-run Tier-0 research (delegated)
  listEl.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.mx-runbtn');
    if (!btn) return;
    var orgId = btn.getAttribute('data-run');
    var misId = btn.getAttribute('data-mis');
    var ta = listEl.querySelector('textarea[data-pi="' + orgId + '"]');
    var publicInfo = ta ? ta.value : '';
    btn.disabled = true;
    btn.textContent = 'Researching…';
    OF.research.runTier0(orgId, misId, { ai: true, publicInfo: publicInfo }).then(function () {
      render();
    }).catch(function () {
      btn.disabled = false;
      btn.textContent = 'Run Tier-0 research';
    });
  });

  // Run / re-run Tier-1 guided research (delegated)
  listEl.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.mx-run1btn');
    if (!btn) return;
    var orgId = btn.getAttribute('data-run1');
    var misId = btn.getAttribute('data-mis');
    var ta = listEl.querySelector('textarea[data-pi="' + orgId + '"]');
    var publicInfo = ta ? ta.value : '';
    btn.disabled = true;
    btn.textContent = 'Researching deeper…';
    OF.research.runTier1(orgId, misId, { publicInfo: publicInfo }).then(function () {
      render();
    }).catch(function (err) {
      btn.disabled = false;
      btn.textContent = 'Run Tier-1 (deeper)';
      alert('Tier-1 research could not complete: ' + (err && err.message ? err.message : 'unknown error'));
    });
  });

  // Validate a CURRENT hypothesis from the admin (delegated)
  listEl.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.mx-vbtn');
    if (!btn) return;
    var valId = btn.getAttribute('data-val');
    if (!valId) return; // a required-side button — handled below
    var r = btn.getAttribute('data-r');
    if (OF.validation && OF.validation.recordValidation) {
      var res = OF.validation.recordValidation(valId, r, 'mission_owner');
      if (OF.frequency && res && res.validation) {
        var orgId = res.validation.organization_id;
        var existing = OF.load().frequency_gaps || [];
        existing.filter(function (g) { return g.organization_id === orgId; })
          .forEach(function (g) { OF.frequency.recompute(orgId, g.mission_id); });
      }
      render();
    }
  });

  // Validate a REQUIRED hypothesis from the admin (delegated)
  listEl.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.mx-vbtn');
    if (!btn) return;
    var rvId = btn.getAttribute('data-rv');
    if (!rvId) return;
    var r = btn.getAttribute('data-r');
    if (OF.requiredValidation && OF.requiredValidation.recordRequired) {
      OF.requiredValidation.recordRequired(rvId, r, 'mission_owner'); // internally recomputes the layer
      render();
    }
  });

  // Compute / recompute the frequency layer (delegated)
  listEl.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.mx-freqbtn');
    if (!btn) return;
    var orgId = btn.getAttribute('data-freq');
    var misId = btn.getAttribute('data-mis');
    if (OF.frequency && OF.frequency.recompute) {
      OF.frequency.recompute(orgId, misId);
      render();
    }
  });

  // Define / retire a role (delegated)
  listEl.addEventListener('click', function (e) {
    var def = e.target.closest && e.target.closest('.mx-rolebtn[data-role]');
    if (def && OF.role) {
      OF.role.defineRole(def.getAttribute('data-role'));
      render();
      return;
    }
    var ret = e.target.closest && e.target.closest('.mx-rolebtn[data-roleretire]');
    if (ret && OF.role) {
      OF.role.retireRole(ret.getAttribute('data-roleretire'));
      render();
    }
  });

  render();
})();
