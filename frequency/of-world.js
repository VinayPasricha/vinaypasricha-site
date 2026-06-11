/* =============================================================
   Organizational Frequency — Autonomous World Discovery (Build 3A)
   =============================================================
   The shift from MANDATE-DRIVEN to WORLD-SIGNAL-DRIVEN.

       World emits signals
          ↓  detect (lexicon, deterministic)
       CompanyOpportunity
          ↓  form mission hypothesis
       MissionHypothesis
          ↓  send to Organizational Intelligence (reuses 2D Search + OF.intel)
       OrganizationalIntelligenceBrief
          ↓  generate organization outreach draft
       Organization Outreach Draft  (NOT sent — transport/autonomy gated)

   This layer DETECTS opportunity. It does NOT interpret the
   organization (OF.intel does) and does NOT find evidence on the
   web (OF.search does). It never duplicates either.

   HONESTY (matches the rest of OF):
     • No live web/LinkedIn/funding fetch. A scan with no provider
       configured BLOCKS honestly (provider_not_configured) but can
       still process manually-imported signals.
     • Manual signal import works today and is the launch path.
     • Default policy requires_review = true. No autonomous outreach.
     • Every step is audited.

   Augments window.OF with window.OF.world.
   Depends on: of-model.js (store), of-search.js, of-intel.js.
   ============================================================= */
(function () {
  'use strict';
  if (!window.OF) { console.warn('of-world.js requires of-model.js'); return; }
  var OF = window.OF;

  /* ===== controlled vocabularies ===== */
  var SIGNAL_TYPES = [
    'hiring_growth', 'funding_event', 'leadership_change', 'new_market_expansion',
    'new_product_launch', 'large_job_volume', 'repeated_job_reposting', 'new_office',
    'high_attrition_signal', 'glassdoor_deterioration', 'rapid_scaling', 'layoff_recovery',
    'restructuring', 'technology_shift', 'business_expansion', 'unknown'
  ];
  var SOURCE_TYPES = [
    'company_website', 'careers_page', 'job_board', 'linkedin_company', 'linkedin_jobs',
    'news', 'press_release', 'funding_database', 'glassdoor', 'ambitionbox',
    'public_search_result', 'manual_import'
  ];
  var OPPORTUNITY_TYPES = [
    'hiring_pressure', 'growth_mission', 'leadership_mission', 'expansion_mission',
    'restructuring_mission', 'talent_quality_problem', 'resonance_risk', 'unknown'
  ];
  var OPPORTUNITY_STATUS = [
    'detected', 'research_needed', 'researched', 'qualified',
    'outreach_ready', 'outreach_started', 'dismissed', 'blocked'
  ];
  var RUN_TYPES = ['daily_scan', 'manual_scan', 'company_scan', 'industry_scan', 'role_scan'];
  var RUN_STATUS = ['running', 'completed', 'failed', 'blocked'];

  // observed-reality sources rank higher than self-claim sources
  var OBSERVED_SOURCES = ['glassdoor', 'ambitionbox', 'news', 'press_release', 'funding_database', 'job_board', 'public_search_result'];
  var CLAIM_SOURCES = ['company_website', 'careers_page', 'linkedin_company', 'linkedin_jobs'];

  // world source_type → OF.search source_type (so artifacts feed Intelligence unchanged)
  var TO_SEARCH = {
    company_website: 'company_website', careers_page: 'careers_page', job_board: 'job_description',
    linkedin_company: 'linkedin_post', linkedin_jobs: 'job_description', news: 'news',
    press_release: 'press', funding_database: 'news', glassdoor: 'glassdoor',
    ambitionbox: 'ambitionbox', public_search_result: 'article', manual_import: 'other'
  };

  /* ===== signal lexicon — signposted language, each with the cue it matched ===== */
  var LEXICON = [
    { type: 'repeated_job_reposting', cues: ['reposted', 'repeatedly', 'reopened', 'still hiring', 're-advertis', 'relisted'] },
    { type: 'large_job_volume', cues: ['open roles', 'open positions', 'roles across', 'positions across', 'mass hiring', 'bulk hiring', 'dozens of roles', 'hundreds of roles'] },
    { type: 'glassdoor_deterioration', cues: ['reviews mention', 'employee reviews', 'glassdoor', 'ambitionbox', 'process chaos', 'leadership pressure', 'burnout', 'poor management', 'toxic'] },
    { type: 'high_attrition_signal', cues: ['attrition', 'turnover', 'churn', 'people leaving', 'mass exit', 'resignations'] },
    { type: 'funding_event', cues: ['raised', 'series a', 'series b', 'series c', 'seed round', 'funding round', 'led by', 'valuation', 'closed a round'] },
    { type: 'leadership_change', cues: ['appointed', 'new ceo', 'new cto', 'new cfo', 'joins as', 'steps down', 'new head of', 'promoted to', 'hired as chief'] },
    { type: 'new_market_expansion', cues: ['expanding to', 'entering the', 'new market', 'new geography', 'going global', 'international expansion'] },
    { type: 'new_office', cues: ['new office', 'opened an office', 'office in', 'new branch', 'new facility', 'new warehouse'] },
    { type: 'new_product_launch', cues: ['launched', 'new product', 'unveiled', 'rolled out', 'introduces', 'announces the launch'] },
    { type: 'rapid_scaling', cues: ['scaling rapidly', 'doubling', 'tripling', 'rapid growth', 'fast-growing', 'hypergrowth', '3x', '2x headcount'] },
    { type: 'layoff_recovery', cues: ['rehiring', 'after layoffs', 'recovery hiring', 'rebuilding the team'] },
    { type: 'restructuring', cues: ['restructuring', 'reorg', 'reorganization', 'reshuffle', 'consolidat'] },
    { type: 'technology_shift', cues: ['migrating to', 'adopting ai', 'ai transformation', 'new tech stack', 'digital transformation', 'modernizing'] },
    { type: 'business_expansion', cues: ['expanding operations', 'business expansion', 'growth phase', 'scaling operations', 'expanding the team', 'growing the team'] },
    { type: 'hiring_growth', cues: ['hiring', 'we are growing', 'join our team', 'building out the team', 'expanding headcount'] }
  ];

  // opportunity_type derivation — priority order: most specific/severe first
  var OPP_PRIORITY = [
    { opp: 'restructuring_mission', signals: ['restructuring', 'layoff_recovery'] },
    { opp: 'talent_quality_problem', signals: ['high_attrition_signal', 'glassdoor_deterioration', 'repeated_job_reposting'] },
    { opp: 'leadership_mission', signals: ['leadership_change'] },
    { opp: 'expansion_mission', signals: ['new_market_expansion', 'new_office', 'new_product_launch'] },
    { opp: 'growth_mission', signals: ['funding_event', 'rapid_scaling', 'technology_shift', 'business_expansion'] },
    { opp: 'hiring_pressure', signals: ['large_job_volume', 'hiring_growth'] }
  ];

  var ANGLES = {
    hiring_pressure: 'Acknowledge the volume of open roles; offer to shorten time-to-resonant-hire, not merely fill seats.',
    growth_mission: 'Connect to the scaling moment — talent depth as the real constraint on the next stage of growth.',
    leadership_mission: 'Speak to the leadership transition and the people decisions that naturally follow it.',
    expansion_mission: 'Anchor on the new market or office — local talent and culture-carry for the expansion.',
    restructuring_mission: 'Tactful: the right rebuild and stability, never opportunism around disruption.',
    talent_quality_problem: 'Reframe from volume to fit — reposting plus reviews suggest a resonance problem, not a sourcing one.',
    resonance_risk: 'Surface the gap between what the careers copy claims and what the roles and reviews reveal.',
    unknown: 'Open with the observed pattern and ask what they are trying to do, rather than assert.'
  };

  var VALIDATION = {
    hiring_pressure: ['How many of these roles are genuinely new vs. backfill?', 'What is your current time-to-hire, and where does it stall?'],
    talent_quality_problem: ['When roles are reposted, is it sourcing, screening, or offers falling through?', 'What does 90-day retention look like for these roles?', 'Do the reviews reflect a current state or a fixed past one?'],
    growth_mission: ['What capability is the binding constraint on the next stage of growth?', 'Which hires sit on the critical path to the scaling goal?'],
    leadership_mission: ['What change in direction does the new leadership intend?', 'Which roles depend on the leadership transition settling first?'],
    expansion_mission: ['Is the new location staffed by relocation, local hiring, or both?', 'How much does culture-carry into the new market matter?'],
    restructuring_mission: ['Which functions are being rebuilt vs. wound down?', 'What does a successful rebuilt team look like to you?'],
    resonance_risk: ['Where do you see the biggest gap between intent and how the org actually operates?'],
    unknown: ['What is the organization actually trying to do right now?']
  };

  /* ===== helpers ===== */
  function nowISO() { return new Date().toISOString(); }
  function uid(p) { return OF.uid(p); }
  function byId(arr, key, val) { return (arr || []).filter(function (x) { return x[key] === val; })[0] || null; }
  function lc(s) { return (s || '').toLowerCase(); }

  function ensure(store) {
    store.world_signals = store.world_signals || [];
    store.company_opportunities = store.company_opportunities || [];
    store.world_mission_hypotheses = store.world_mission_hypotheses || [];
    store.world_discovery_runs = store.world_discovery_runs || [];
    store.world_policies = store.world_policies || [];
    store.world_outreach_drafts = store.world_outreach_drafts || [];
    store.world_audit_log = store.world_audit_log || [];
    seedPolicy(store);
    return store;
  }
  function seedPolicy(store) {
    if (store.world_policies.length) return;
    store.world_policies.push(newPolicy({
      scan_scope: 'manual_only',
      allowed_sources: SOURCE_TYPES.slice(),
      blocked_sources: [],
      confidence_threshold: 'low',
      max_opportunities_per_run: 25,
      requires_review: true            // launch default — no autonomous outreach
    }));
  }
  function activePolicy(store) { return store.world_policies[0] || null; }
  function audit(store, object_type, object_ref, action, detail) {
    store.world_audit_log.push({ log_id: uid('waud'), object_type: object_type, object_ref: object_ref, action: action, detail: detail || '', created_at: nowISO() });
  }

  /* ===== SCHEMAS ===== */
  function newSignal(f) {
    f = f || {};
    return {
      signal_id: f.signal_id || uid('wsig'),
      source_type: SOURCE_TYPES.indexOf(f.source_type) !== -1 ? f.source_type : 'manual_import',
      source_url: f.source_url || '',
      source_title: f.source_title || '',
      raw_text: f.raw_text || '',
      signal_type: SIGNAL_TYPES.indexOf(f.signal_type) !== -1 ? f.signal_type : 'unknown',
      company_name: f.company_name || '',
      confidence: f.confidence || 'low',          // low|medium|high
      evidence: f.evidence || '',                 // the exact quoted material
      created_at: f.created_at || nowISO(),
      _processed: false
    };
  }
  function newOpportunity(f) {
    f = f || {};
    return {
      opportunity_id: f.opportunity_id || uid('wopp'),
      company_name: f.company_name || '',
      domain: f.domain || '',
      linkedin_url: f.linkedin_url || '',
      industry: f.industry || '',
      location: f.location || '',
      opportunity_type: OPPORTUNITY_TYPES.indexOf(f.opportunity_type) !== -1 ? f.opportunity_type : 'unknown',
      signals: f.signals || [],                   // signal_id[]
      confidence: f.confidence || { level: 'low', reasoning: '' },
      urgency: f.urgency || 'low',                // low|medium|high
      recommended_angle: f.recommended_angle || '',
      status: OPPORTUNITY_STATUS.indexOf(f.status) !== -1 ? f.status : 'detected',
      // links created as the opportunity progresses
      organization_id: f.organization_id || null,
      brief_id: f.brief_id || null,
      search_mission_id: f.search_mission_id || null,
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }
  function newHypothesis(f) {
    f = f || {};
    return {
      mission_hypothesis_id: f.mission_hypothesis_id || uid('wmh'),
      opportunity_id: f.opportunity_id || null,
      company_name: f.company_name || '',
      hypothesis: f.hypothesis || '',
      reasoning: f.reasoning || '',
      evidence: f.evidence || [],                 // signal_id[]
      confidence: f.confidence || { level: 'low', reasoning: '' },
      validation_questions: f.validation_questions || [],
      created_at: f.created_at || nowISO()
    };
  }
  function newRun(f) {
    f = f || {};
    return {
      run_id: f.run_id || uid('wrun'),
      run_type: RUN_TYPES.indexOf(f.run_type) !== -1 ? f.run_type : 'manual_scan',
      status: RUN_STATUS.indexOf(f.status) !== -1 ? f.status : 'running',
      started_at: f.started_at || nowISO(),
      completed_at: f.completed_at || null,
      signals_found: f.signals_found || 0,
      opportunities_created: f.opportunities_created || 0,
      errors: f.errors || [],
      audit_log: f.audit_log || []
    };
  }
  function newPolicy(f) {
    f = f || {};
    return {
      policy_id: f.policy_id || uid('wpol'),
      scan_scope: f.scan_scope || 'manual_only',
      allowed_sources: f.allowed_sources || SOURCE_TYPES.slice(),
      blocked_sources: f.blocked_sources || [],
      confidence_threshold: f.confidence_threshold || 'low',
      max_opportunities_per_run: typeof f.max_opportunities_per_run === 'number' ? f.max_opportunities_per_run : 25,
      requires_review: f.requires_review !== false,   // default true
      created_at: f.created_at || nowISO()
    };
  }
  function newDraft(f) {
    f = f || {};
    return {
      draft_id: f.draft_id || uid('wdraft'),
      opportunity_id: f.opportunity_id || null,
      company_name: f.company_name || '',
      subject: f.subject || '',
      body: f.body || '',
      based_on: f.based_on || {},      // {opportunity_type, mission_hypothesis_id, brief_id, signal_ids}
      status: f.status || 'draft',     // draft only — never sent here
      send_blocked_reason: 'transport_and_autonomy_not_authorized — review required, no autonomous send.',
      created_at: f.created_at || nowISO()
    };
  }

  /* ===== DETECTION — deterministic lexicon over real text ===== */
  function detectSignalType(text) {
    var t = lc(text), hits = [];
    LEXICON.forEach(function (entry) {
      for (var i = 0; i < entry.cues.length; i++) {
        if (t.indexOf(entry.cues[i]) !== -1) { hits.push({ type: entry.type, cue: entry.cues[i] }); break; }
      }
    });
    return hits;   // [{type, cue}] in priority order of LEXICON
  }
  function firstSentenceWith(text, cue) {
    var sentences = (text || '').split(/(?<=[.!?])\s+/);
    for (var i = 0; i < sentences.length; i++) { if (lc(sentences[i]).indexOf(cue) !== -1) return sentences[i].trim(); }
    return (text || '').slice(0, 160).trim();
  }
  function sourceRank(sourceType) { return OBSERVED_SOURCES.indexOf(sourceType) !== -1 ? 'observed' : (CLAIM_SOURCES.indexOf(sourceType) !== -1 ? 'claim' : 'other'); }
  function signalConfidence(sourceType, hitCount) {
    var rank = sourceRank(sourceType);
    if (rank === 'observed') return hitCount >= 1 ? 'high' : 'medium';
    if (rank === 'claim') return hitCount >= 2 ? 'medium' : 'low';
    return hitCount >= 2 ? 'medium' : 'low';
  }

  /* Import one piece of real material → 1+ WorldSignals (one per distinct signal type found). */
  function importSignal(fields, store) {
    store = ensure(store || OF.load());
    fields = fields || {};
    if (!fields.raw_text && !fields.source_url) return { error: 'Paste the source text (or at least a URL + title).' };
    var policy = activePolicy(store);
    var srcType = SOURCE_TYPES.indexOf(fields.source_type) !== -1 ? fields.source_type : 'manual_import';
    if (policy && policy.blocked_sources.indexOf(srcType) !== -1) return { error: 'Source type ' + srcType + ' is blocked by policy.' };

    var hits = detectSignalType(fields.raw_text || fields.source_title || '');
    var created = [];
    // de-dupe by type so one paragraph doesn't make five copies of the same type
    var seen = {};
    hits.forEach(function (h) {
      if (seen[h.type]) return; seen[h.type] = true;
      var sig = newSignal({
        source_type: srcType, source_url: fields.source_url || '', source_title: fields.source_title || '',
        raw_text: fields.raw_text || '', signal_type: h.type, company_name: fields.company_name || '',
        confidence: signalConfidence(srcType, hits.filter(function (x) { return x.type === h.type; }).length),
        evidence: firstSentenceWith(fields.raw_text || '', h.cue)
      });
      store.world_signals.push(sig); created.push(sig);
    });
    if (!created.length) {
      // no signposted language detected — record an honest 'unknown' signal rather than fabricate one
      var u = newSignal({ source_type: srcType, source_url: fields.source_url || '', source_title: fields.source_title || '', raw_text: fields.raw_text || '', signal_type: 'unknown', company_name: fields.company_name || '', confidence: 'low', evidence: (fields.raw_text || '').slice(0, 160).trim() });
      store.world_signals.push(u); created.push(u);
    }
    audit(store, 'signal', fields.company_name || '(unknown)', 'import', created.length + ' signal(s): ' + created.map(function (s) { return s.signal_type; }).join(', '));
    OF.save(store);
    return { signals: created };
  }

  /* ===== OPPORTUNITY FORMATION ===== */
  function deriveOpportunityType(sigs) {
    var types = sigs.map(function (s) { return s.signal_type; });
    for (var i = 0; i < OPP_PRIORITY.length; i++) {
      var p = OPP_PRIORITY[i];
      for (var j = 0; j < p.signals.length; j++) { if (types.indexOf(p.signals[j]) !== -1) return p.opp; }
    }
    return 'unknown';
  }
  function deriveUrgency(sigs) {
    var types = sigs.map(function (s) { return s.signal_type; });
    var hot = ['repeated_job_reposting', 'high_attrition_signal', 'glassdoor_deterioration', 'large_job_volume', 'layoff_recovery'];
    var warm = ['funding_event', 'leadership_change', 'rapid_scaling', 'new_market_expansion'];
    if (types.some(function (t) { return hot.indexOf(t) !== -1; })) return 'high';
    if (types.some(function (t) { return warm.indexOf(t) !== -1; })) return 'medium';
    return 'low';
  }
  function opportunityConfidence(sigs) {
    var distinctTypes = {}, distinctSources = {}, observed = false;
    sigs.forEach(function (s) { distinctTypes[s.signal_type] = 1; distinctSources[s.source_type] = 1; if (sourceRank(s.source_type) === 'observed') observed = true; });
    var nt = Object.keys(distinctTypes).length, ns = Object.keys(distinctSources).length;
    var level = 'low';
    if (sigs.length >= 3 && ns >= 2 && observed) level = 'high';
    else if (sigs.length >= 2 && (observed || ns >= 2)) level = 'medium';
    var reasoning = sigs.length + ' signal(s) across ' + ns + ' source(s), ' + nt + ' distinct signal type(s)' + (observed ? ', incl. an observed-reality source' : ', self-claim only') + '.';
    return { level: level, reasoning: reasoning };
  }
  function enrich(opp, sigs) {
    sigs.forEach(function (s) {
      if (!opp.domain && s.source_type === 'company_website' && s.source_url) opp.domain = s.source_url;
      if (!opp.linkedin_url && (s.source_type === 'linkedin_company' || s.source_type === 'linkedin_jobs') && s.source_url) opp.linkedin_url = s.source_url;
    });
  }

  /* Cluster all signals for a company into one CompanyOpportunity (create or update). */
  function formOpportunity(companyName, store) {
    store = ensure(store || OF.load());
    var name = companyName || 'Unknown';
    var sigs = store.world_signals.filter(function (s) { return lc(s.company_name) === lc(name); });
    if (!sigs.length) return { error: 'No signals for "' + name + '".' };
    var opp = store.company_opportunities.filter(function (o) { return lc(o.company_name) === lc(name); })[0];
    var created = false;
    if (!opp) { opp = newOpportunity({ company_name: name }); store.company_opportunities.push(opp); created = true; }
    var type = deriveOpportunityType(sigs);
    opp.signals = sigs.map(function (s) { return s.signal_id; });
    opp.opportunity_type = type;
    opp.confidence = opportunityConfidence(sigs);
    opp.urgency = deriveUrgency(sigs);
    opp.recommended_angle = ANGLES[type] || ANGLES.unknown;
    enrich(opp, sigs);
    if (created || opp.status === 'detected') opp.status = 'research_needed';
    opp.updated_at = nowISO();
    audit(store, 'opportunity', name, created ? 'detected' : 'updated', type + ' · ' + opp.confidence.level);
    OF.save(store);
    return { opportunity: opp, created: created };
  }

  /* ===== MISSION HYPOTHESIS ===== */
  function hypothesisStatement(type, sigs) {
    var has = function (t) { return sigs.some(function (s) { return s.signal_type === t; }); };
    switch (type) {
      case 'hiring_pressure': return 'They appear to be under hiring pressure — opening more roles than they can currently fill.';
      case 'talent_quality_problem': return has('glassdoor_deterioration') ? 'They appear to be struggling with hiring quality or retention — roles are reposting and reviews point to process and leadership strain.' : 'They appear to be struggling to convert openings into lasting hires.';
      case 'growth_mission': return has('funding_event') ? 'They appear to be scaling after new capital — talent depth is likely the binding constraint.' : 'They appear to be in a rapid scaling phase that talent must keep pace with.';
      case 'leadership_mission': return 'They appear to be navigating a leadership transition that will reshape their people decisions.';
      case 'expansion_mission': return 'They appear to be expanding into a new market or location and need talent to carry it.';
      case 'restructuring_mission': return 'They appear to be restructuring — rebuilding parts of the organization rather than simply growing.';
      default: return 'A pattern is visible, but the underlying mission is not yet clear from the signals.';
    }
  }
  function generateMissionHypothesis(oppId, store) {
    store = ensure(store || OF.load());
    var opp = byId(store.company_opportunities, 'opportunity_id', oppId);
    if (!opp) return { error: 'Opportunity not found.' };
    var sigs = opp.signals.map(function (id) { return byId(store.world_signals, 'signal_id', id); }).filter(Boolean);
    if (!sigs.length) return { error: 'Opportunity has no signals to reason from.' };
    var type = opp.opportunity_type;
    var typeLabels = {}; sigs.forEach(function (s) { typeLabels[s.signal_type] = 1; });
    var reasoning = 'Derived from ' + Object.keys(typeLabels).join(', ') + ' across ' + sigs.length + ' signal(s). ' + opp.confidence.reasoning;
    var h = newHypothesis({
      opportunity_id: oppId, company_name: opp.company_name,
      hypothesis: hypothesisStatement(type, sigs),
      reasoning: reasoning,
      evidence: sigs.map(function (s) { return s.signal_id; }),
      confidence: { level: opp.confidence.level, reasoning: opp.confidence.reasoning },
      validation_questions: (VALIDATION[type] || VALIDATION.unknown).slice()
    });
    // replace any prior hypothesis for this opportunity
    store.world_mission_hypotheses = store.world_mission_hypotheses.filter(function (x) { return x.opportunity_id !== oppId; });
    store.world_mission_hypotheses.push(h);
    if (opp.status === 'research_needed' || opp.status === 'detected') opp.status = 'qualified';
    opp.updated_at = nowISO();
    audit(store, 'mission_hypothesis', opp.company_name, 'generated', type + ' · ' + h.confidence.level);
    OF.save(store);
    return { hypothesis: h };
  }

  /* ===== INTELLIGENCE INTEGRATION — reuse 2D Search + OF.intel, never duplicate ===== */
  function sendToIntelligence(oppId, store) {
    store = ensure(store || OF.load());
    var opp = byId(store.company_opportunities, 'opportunity_id', oppId);
    if (!opp) return { error: 'Opportunity not found.' };
    if (!OF.search || !OF.intel) return { error: 'Search / Organizational Intelligence layer unavailable.' };
    var sigs = opp.signals.map(function (id) { return byId(store.world_signals, 'signal_id', id); }).filter(Boolean);
    var usable = sigs.filter(function (s) { return s.raw_text; });
    if (!usable.length) return { error: 'No signal carries source text to interpret. Import material with text first.' };

    // 1. open an organization_discovery search mission for this company
    var m = OF.search.createOrgSearch({ company_name: opp.company_name, industry: opp.industry, website: opp.domain }, OF.load());
    // 2. hand each signal's real material to Search as a retrieved artifact
    usable.forEach(function (s) {
      OF.search.manualImport(m.search_mission_id, {
        source_type: TO_SEARCH[s.source_type] || 'other',
        title: s.source_title || s.signal_type, url: s.source_url, raw_text: s.raw_text
      }, OF.load());
    });
    // 3. Search feeds OF.intel, which interprets and produces the brief
    var res = OF.search.sendToOrgIntelligence(m.search_mission_id, OF.load());
    if (res && res.error) return { error: res.error };

    store = ensure(OF.load());
    opp = byId(store.company_opportunities, 'opportunity_id', oppId);
    opp.organization_id = res.organization_id || opp.organization_id;
    opp.search_mission_id = m.search_mission_id;
    opp.brief_id = res.brief ? res.brief.brief_id : opp.brief_id;
    opp.status = 'researched';
    if (opp.industry === '' && res.brief && res.brief.industry) opp.industry = res.brief.industry;
    opp.updated_at = nowISO();
    audit(store, 'opportunity', opp.company_name, 'sent_to_intelligence', 'org ' + (res.organization_id || '—') + ', brief ' + (opp.brief_id || '—'));
    OF.save(store);
    return { organization_id: res.organization_id, brief: res.brief, search_mission_id: m.search_mission_id };
  }

  /* ===== ORGANIZATION OUTREACH DRAFT — drafted, never sent ===== */
  function generateOutreachDraft(oppId, store) {
    store = ensure(store || OF.load());
    var opp = byId(store.company_opportunities, 'opportunity_id', oppId);
    if (!opp) return { error: 'Opportunity not found.' };
    var hyp = store.world_mission_hypotheses.filter(function (h) { return h.opportunity_id === oppId; })[0];
    var sigs = opp.signals.map(function (id) { return byId(store.world_signals, 'signal_id', id); }).filter(Boolean);
    var observed = sigs.filter(function (s) { return sourceRank(s.source_type) === 'observed'; });
    var lead = (observed[0] || sigs[0] || {}).evidence || '';

    var company = opp.company_name || 'your organization';
    var pattern = hyp ? hyp.hypothesis : hypothesisStatement(opp.opportunity_type, sigs);
    var subject = 'A pattern we noticed at ' + company;
    var body =
      'Hello,\n\n' +
      'We noticed a pattern at ' + company + ' from public signals' + (lead ? ' — for instance: "' + lead + '"' : '') + '.\n\n' +
      pattern + '\n\n' +
      'We may be wrong, and we would rather ask than assume. ' + (opp.recommended_angle || ANGLES.unknown) + '\n\n' +
      (hyp && hyp.validation_questions.length ? 'A couple of things we would genuinely want to understand:\n' + hyp.validation_questions.slice(0, 2).map(function (q) { return '  • ' + q; }).join('\n') + '\n\n' : '') +
      'If any of this resonates, we would value a short conversation.\n\n— Goodspace';

    var draft = newDraft({
      opportunity_id: oppId, company_name: company, subject: subject, body: body,
      based_on: { opportunity_type: opp.opportunity_type, mission_hypothesis_id: hyp ? hyp.mission_hypothesis_id : null, brief_id: opp.brief_id, signal_ids: opp.signals.slice() }
    });
    store.world_outreach_drafts = store.world_outreach_drafts.filter(function (d) { return d.opportunity_id !== oppId; });
    store.world_outreach_drafts.push(draft);
    if (opp.status !== 'outreach_started') opp.status = 'outreach_ready';
    opp.updated_at = nowISO();
    audit(store, 'outreach_draft', company, 'generated', 'draft only — send blocked (review required)');
    OF.save(store);
    return { draft: draft };
  }

  function dismissOpportunity(oppId, store) {
    store = ensure(store || OF.load());
    var opp = byId(store.company_opportunities, 'opportunity_id', oppId);
    if (!opp) return { error: 'Opportunity not found.' };
    opp.status = 'dismissed'; opp.updated_at = nowISO();
    audit(store, 'opportunity', opp.company_name, 'dismissed', '');
    OF.save(store);
    return { opportunity: opp };
  }

  /* ===== DISCOVERY RUN — honest about no live fetch; processes manual signals ===== */
  function runScan(runType, store) {
    store = ensure(store || OF.load());
    var policy = activePolicy(store);
    var run = newRun({ run_type: runType || 'manual_scan', status: 'running' });
    store.world_discovery_runs.push(run);

    var liveConfigured = OF.search && OF.search.isConfigured('web_search', store);
    if (!liveConfigured) {
      run.audit_log.push({ at: nowISO(), step: 'live_fetch', status: 'blocked', detail: 'web_search provider not configured — no autonomous web fetch. Processing manually-imported signals only.' });
    } else {
      run.audit_log.push({ at: nowISO(), step: 'live_fetch', status: 'skipped', detail: 'Provider configured but this environment performs no network egress — manual signals only.' });
    }

    // process every company that has unprocessed signals → opportunity
    var pending = store.world_signals.filter(function (s) { return !s._processed; });
    var byCompany = {};
    pending.forEach(function (s) { var k = lc(s.company_name) || 'unknown'; (byCompany[k] = byCompany[k] || []).push(s); });
    var created = 0, max = policy ? policy.max_opportunities_per_run : 25;
    Object.keys(byCompany).forEach(function (k) {
      if (created >= max) return;
      var name = byCompany[k][0].company_name || 'Unknown';
      var before = store.company_opportunities.length;
      var res = formOpportunity(name, store);
      store = ensure(OF.load());
      if (res && res.created) created++;
      run.audit_log.push({ at: nowISO(), step: 'form_opportunity', status: 'completed', detail: name + ' → ' + (res.opportunity ? res.opportunity.opportunity_type : 'n/a') });
      // mark this company's pending signals processed
      store.world_signals.forEach(function (s) { if (lc(s.company_name) === lc(name)) s._processed = true; });
    });

    run = byId(store.world_discovery_runs, 'run_id', run.run_id) || run;
    run.signals_found = pending.length;
    run.opportunities_created = created;
    if (!liveConfigured && !pending.length) { run.status = 'blocked'; run.errors.push('provider_not_configured: no live provider wired and no manual signals pending to process.'); }
    else { run.status = 'completed'; }
    run.completed_at = nowISO();
    audit(store, 'discovery_run', run.run_type, run.status, pending.length + ' signals processed, ' + created + ' opportunities');
    OF.save(store);
    return { run: run };
  }

  /* ===== POLICY ===== */
  function updatePolicy(patch, store) {
    store = ensure(store || OF.load());
    var p = activePolicy(store); if (!p) return { error: 'No policy.' };
    ['scan_scope', 'confidence_threshold', 'max_opportunities_per_run', 'requires_review', 'allowed_sources', 'blocked_sources'].forEach(function (k) {
      if (patch && patch[k] !== undefined) p[k] = patch[k];
    });
    audit(store, 'policy', p.policy_id, 'updated', JSON.stringify(patch || {}));
    OF.save(store);
    return { policy: p };
  }

  /* ===== READS ===== */
  function snapshot(store) {
    store = ensure(store || OF.load());
    return {
      policy: activePolicy(store),
      runs: store.world_discovery_runs.slice().reverse(),
      signals: store.world_signals.slice().reverse(),
      opportunities: store.company_opportunities.slice().reverse(),
      hypotheses: store.world_mission_hypotheses.slice(),
      drafts: store.world_outreach_drafts.slice().reverse(),
      audit: store.world_audit_log.slice().reverse(),
      counts: {
        signals: store.world_signals.length,
        opportunities: store.company_opportunities.length,
        runs: store.world_discovery_runs.length,
        drafts: store.world_outreach_drafts.length,
        blocked_runs: store.world_discovery_runs.filter(function (r) { return r.status === 'blocked'; }).length
      }
    };
  }
  function getOpportunity(oppId, store) {
    store = ensure(store || OF.load());
    var opp = byId(store.company_opportunities, 'opportunity_id', oppId);
    if (!opp) return null;
    return {
      opportunity: opp,
      signals: opp.signals.map(function (id) { return byId(store.world_signals, 'signal_id', id); }).filter(Boolean),
      hypothesis: store.world_mission_hypotheses.filter(function (h) { return h.opportunity_id === oppId; })[0] || null,
      draft: store.world_outreach_drafts.filter(function (d) { return d.opportunity_id === oppId; })[0] || null,
      brief: opp.brief_id && OF.intel ? (OF.intel.getIntel ? null : null) : null
    };
  }
  function resetWorld(store) {
    store = ensure(store || OF.load());
    store.world_signals = []; store.company_opportunities = []; store.world_mission_hypotheses = [];
    store.world_discovery_runs = []; store.world_outreach_drafts = []; store.world_audit_log = [];
    store.world_policies = []; seedPolicy(store);
    OF.save(store);
  }

  OF.world = {
    SIGNAL_TYPES: SIGNAL_TYPES, SOURCE_TYPES: SOURCE_TYPES, OPPORTUNITY_TYPES: OPPORTUNITY_TYPES,
    OPPORTUNITY_STATUS: OPPORTUNITY_STATUS, RUN_TYPES: RUN_TYPES, RUN_STATUS: RUN_STATUS,
    OBSERVED_SOURCES: OBSERVED_SOURCES, CLAIM_SOURCES: CLAIM_SOURCES, ANGLES: ANGLES,
    ensure: ensure, activePolicy: activePolicy,
    detectSignalType: detectSignalType,
    importSignal: importSignal,
    formOpportunity: formOpportunity,
    generateMissionHypothesis: generateMissionHypothesis,
    sendToIntelligence: sendToIntelligence,
    generateOutreachDraft: generateOutreachDraft,
    dismissOpportunity: dismissOpportunity,
    runScan: runScan,
    updatePolicy: updatePolicy,
    snapshot: snapshot, getOpportunity: getOpportunity, resetWorld: resetWorld
  };
})();
