/* =============================================================
   Organizational Frequency — Tier-0 Research engine  (Build 1B)
   =============================================================
   Builds on the Mission Spine (of-model.js) WITHOUT changing it.

   When a mission exists, the runtime forms an OUTSIDE-IN view of
   the organization — only from public information — and produces:

     • Tier0Research                    (the research run + sources)
     • OrganizationEssenceHypothesis    (what kind of org appears
                                          to be emerging)
     • OrganizationFrequencyHypothesis  (10 dimension estimates)
     • MissionAnalysis                  (required vs current, risks)

   Everything is HYPOTHESIS. Nothing here is a final frequency, a
   gap score, or a match. Research findings deposit EVIDENCE SEEDS
   ONLY — never transformations, never essence/frequency updates.

   Execution: no scraping, no external APIs, no paid research. The
   synthesis is deterministic from the captured mission (honest,
   low-confidence), optionally enriched by window.claude.complete
   and by any public text an operator pastes in. Implementation
   choice C+A from the brief: placeholder + manual inputs.

   Augments window.OF with window.OF.research.
   ============================================================= */
(function () {
  'use strict';
  if (!window.OF) { console.warn('of-research.js requires of-model.js'); return; }
  var OF = window.OF;

  var SOURCE_TYPES = [
    'website', 'linkedin', 'company_blog', 'founder_profile',
    'job_descriptions', 'careers_page', 'news', 'social_media', 'other'
  ];
  var RESEARCH_STATUS = ['not_started', 'in_progress', 'completed', 'failed'];

  // The ten frequency dimensions (shared vocabulary).
  var DIMENSIONS = [
    'Pace', 'Execution Discipline', 'Communication Style', 'Pressure Tolerance',
    'Leadership Style', 'Autonomy Level', 'Innovation Requirement',
    'Process Maturity', 'Trust / Goodness Layer', 'People Development Orientation'
  ];

  function nowISO() { return new Date().toISOString(); }
  function uid(p) { return OF.uid(p); }

  /* ---- ensure the 1B arrays exist on the shared store -------- */
  function ensure(store) {
    store.tier0_research = store.tier0_research || [];
    store.tier1_research = store.tier1_research || [];
    store.org_essence_hypotheses = store.org_essence_hypotheses || [];
    store.org_frequency_hypotheses = store.org_frequency_hypotheses || [];
    store.mission_analyses = store.mission_analyses || [];
    store.seeds = store.seeds || [];
    return store;
  }

  /* ========================================================== */
  /* BUILD OBJECT 1 — Tier0Research                              */
  /* ========================================================== */
  function newTier0Research(f) {
    f = f || {};
    return {
      research_id: f.research_id || uid('t0'),
      organization_id: f.organization_id || null,
      mission_id: f.mission_id || null,         // the mission that triggered it
      research_status: f.research_status || 'not_started',
      started_at: f.started_at || null,
      completed_at: f.completed_at || null,
      sources: f.sources || [],                 // [{ source_type, label, consulted, note }]
      findings: f.findings || [],               // [{ finding, source_type, confidence, evidence_seed_id, inferred }]
      confidence: typeof f.confidence === 'number' ? f.confidence : 0,
      summary: f.summary || '',
      research_notes: f.research_notes || '',
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }

  /* ========================================================== */
  /* BUILD OBJECT 2 — OrganizationEssenceHypothesis             */
  /* ========================================================== */
  function newEssenceHypothesis(f) {
    f = f || {};
    return {
      essence_id: f.essence_id || uid('oeh'),
      organization_id: f.organization_id || null,
      core_narrative: f.core_narrative || '',
      attributes: f.attributes || [],           // string[]
      confidence: typeof f.confidence === 'number' ? f.confidence : 0,
      supporting_evidence: f.supporting_evidence || [], // evidence_seed_id[]
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }

  /* ========================================================== */
  /* BUILD OBJECT 3 — OrganizationFrequencyHypothesis           */
  /* ========================================================== */
  function newFrequencyHypothesis(f) {
    f = f || {};
    return {
      frequency_id: f.frequency_id || uid('ofh'),
      organization_id: f.organization_id || null,
      frequency_summary: f.frequency_summary || '',
      dimension_estimates: f.dimension_estimates || [], // [{ dimension, estimate, confidence, evidence }]
      confidence: typeof f.confidence === 'number' ? f.confidence : 0,
      supporting_evidence: f.supporting_evidence || [],
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }

  /* ========================================================== */
  /* BUILD OBJECT 4 — MissionAnalysis                           */
  /* ========================================================== */
  function newMissionAnalysis(f) {
    f = f || {};
    return {
      analysis_id: f.analysis_id || uid('man'),
      mission_id: f.mission_id || null,
      organization_id: f.organization_id || null,
      required_organization_hypothesis: f.required_organization_hypothesis || '',
      current_organization_hypothesis: f.current_organization_hypothesis || '',
      mission_risk_observations: f.mission_risk_observations || [], // string[]
      confidence: typeof f.confidence === 'number' ? f.confidence : 0,
      next_research_needed: f.next_research_needed || '',
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }

  /* ========================================================== */
  /* RUN — the one entry point.                                  */
  /*   runTier0(orgId, missionId, { publicInfo, ai })            */
  /*   returns a Promise of { research, essence, frequency,      */
  /*   analysis, seeds }.                                        */
  /* ========================================================== */
  function runTier0(orgId, missionId, opts) {
    opts = opts || {};
    var store = ensure(OF.load());
    var org = byId(store.organizations, 'organization_id', orgId);
    var mis = byId(store.missions, 'mission_id', missionId) ||
              store.missions.filter(function (m) { return m.organization_id === orgId; })[0];
    if (!org) return Promise.reject(new Error('organization not found'));

    var useAI = opts.ai && window.claude && typeof window.claude.complete === 'function';
    var publicInfo = (opts.publicInfo || '').trim();

    if (!useAI) {
      return Promise.resolve(finish(store, org, mis, synthesize(org, mis, publicInfo, null)));
    }
    return aiSynthesize(org, mis, publicInfo).then(function (ai) {
      return finish(store, org, mis, synthesize(org, mis, publicInfo, ai));
    }).catch(function () {
      return finish(store, org, mis, synthesize(org, mis, publicInfo, null));
    });
  }

  /* ---- write everything to the store -------------------------- */
  function finish(store, org, mis, syn) {
    var startISO = nowISO();

    // Evidence seeds — ONLY. One per finding.
    var seeds = syn.findings.map(function (fd) {
      var seed = OF.seam.makeSeed('evidence', 'organization', org.organization_id, {
        summary: fd.finding,
        source: fd.source_type,
        confidence: fd.confidence,
        inferred: !!fd.inferred,
        linked_attribute: 'tier0_research'
      });
      seed.origin = 'tier0_research';
      fd.evidence_seed_id = seed.seed_id;
      store.seeds.push(seed);
      return seed;
    });
    var seedIds = seeds.map(function (s) { return s.seed_id; });

    var research = newTier0Research({
      organization_id: org.organization_id,
      mission_id: mis ? mis.mission_id : null,
      research_status: 'completed',
      started_at: startISO,
      completed_at: nowISO(),
      sources: syn.sources,
      findings: syn.findings,
      confidence: syn.confidence,
      summary: syn.research_summary,
      research_notes: syn.research_notes
    });

    var essence = newEssenceHypothesis({
      organization_id: org.organization_id,
      core_narrative: syn.essence_narrative,
      attributes: syn.essence_attributes,
      confidence: syn.essence_confidence,
      supporting_evidence: seedIds
    });

    var frequency = newFrequencyHypothesis({
      organization_id: org.organization_id,
      frequency_summary: syn.frequency_summary,
      dimension_estimates: syn.dimension_estimates,
      confidence: syn.frequency_confidence,
      supporting_evidence: seedIds
    });

    var analysis = mis ? newMissionAnalysis({
      mission_id: mis.mission_id,
      organization_id: org.organization_id,
      required_organization_hypothesis: syn.required_hypothesis,
      current_organization_hypothesis: syn.current_hypothesis,
      mission_risk_observations: syn.risks,
      confidence: syn.analysis_confidence,
      next_research_needed: syn.next_research_needed
    }) : null;

    // Replace any prior tier-0 run for this org (re-running supersedes).
    store.tier0_research = store.tier0_research.filter(function (r) { return r.organization_id !== org.organization_id; });
    store.org_essence_hypotheses = store.org_essence_hypotheses.filter(function (r) { return r.organization_id !== org.organization_id; });
    store.org_frequency_hypotheses = store.org_frequency_hypotheses.filter(function (r) { return r.organization_id !== org.organization_id; });
    if (mis) store.mission_analyses = store.mission_analyses.filter(function (r) { return r.mission_id !== mis.mission_id; });

    store.tier0_research.push(research);
    store.org_essence_hypotheses.push(essence);
    store.org_frequency_hypotheses.push(frequency);
    if (analysis) store.mission_analyses.push(analysis);

    // Update research status markers (no scoring, just state).
    org.research_status = 'tier0';
    org.updated_at = nowISO();
    if (mis && mis.research) {
      mis.research.status = 'tier0';
      mis.research.tier0.status = 'completed';
      mis.research.tier0.ran_at = research.completed_at;
      mis.updated_at = nowISO();
    }

    // 1C — every fresh hypothesis enters the Validation Queue.
    // Research produces hypotheses; it does NOT update memory.
    if (window.OF.validation && window.OF.validation.enqueueFromResearch) {
      window.OF.validation.enqueueFromResearch(store, {
        organization: org, mission: mis, essence: essence, frequency: frequency, analysis: analysis
      });
    }

    OF.save(store);
    return { research: research, essence: essence, frequency: frequency, analysis: analysis, seeds: seeds, store: store };
  }

  /* ========================================================== */
  /* SYNTHESIS — deterministic, honest, low-confidence.         */
  /* If `ai` is provided it enriches narrative + estimates, but */
  /* the deterministic layer always fills any gap.              */
  /* ========================================================== */
  function synthesize(org, mis, publicInfo, ai) {
    var m = mis || {};
    var type = m.mission_type || 'unknown';
    var stage = m.mission_stage || 'emerging';
    var hiring = m.hiring_relevance || 'possible';
    var obstacle = (m.obstacles && m.obstacles[0]) || '';
    var outcome = m.desired_outcome || m.mission_description || 'its stated outcome';
    var orgName = org.organization_name || 'The organization';

    var capability = capabilityForType(type);

    // --- findings + sources -----------------------------------
    var sources = defaultSources(publicInfo);
    var findings = buildFindings(org, m, publicInfo, ai);

    // --- essence hypothesis -----------------------------------
    var essenceNarr = (ai && ai.essence_narrative) || (
      orgName + ' appears to be ' + describeOrg(org) + ' working toward ' + lc(outcome) + '. ' +
      'To get there it likely must become an organization that can ' + capability + '' +
      (obstacle ? ', while resolving what currently blocks it: ' + lc(stripDot(obstacle)) : '') + '. ' +
      'This is a hypothesis drawn from the mission description' +
      (publicInfo ? ' and the public text provided' : ', not yet corroborated by public sources') + '.'
    );
    var essenceAttrs = (ai && ai.essence_attributes && ai.essence_attributes.length)
      ? ai.essence_attributes.slice(0, 6)
      : essenceAttributes(type, stage, hiring);

    // --- frequency hypothesis (10 dimensions) -----------------
    var dims = estimateDimensions(m, org, publicInfo);
    if (ai && Array.isArray(ai.dimension_estimates)) dims = mergeAIDimensions(dims, ai.dimension_estimates);
    var freqSummary = (ai && ai.frequency_summary) || (
      'A first, low-confidence read of how ' + orgName + ' may operate — strongest signal on ' +
      strongestDims(dims) + '; little is observable yet on the rest.'
    );

    // --- mission analysis -------------------------------------
    var requiredHyp = (ai && ai.required_hypothesis) ||
      ('To achieve "' + (m.mission_name || lc(outcome)) + '", ' + orgName + ' likely needs to become an organization that can ' + capability + '.');
    var currentHyp = (ai && ai.current_hypothesis) ||
      ('Today it appears ' + lc(describeOrg(org)) + (leaderCentric(m) ? ', and — on current signal — founder/leader-centric' : '') + '.');
    var risks = (ai && ai.risks && ai.risks.length) ? ai.risks.slice(0, 5) : missionRisks(m, org);
    var nextResearch = (ai && ai.next_research_needed) ||
      'Public careers page, job descriptions and founder profile — to corroborate leadership style, autonomy and people-development orientation.';

    // --- confidences (deliberately modest) --------------------
    var avg = function (arr) { return arr.reduce(function (a, b) { return a + b; }, 0) / (arr.length || 1); };
    var freqConf = round(avg(dims.map(function (d) { return d.confidence; })));
    var essConf = publicInfo ? 0.4 : 0.3;
    var anaConf = publicInfo ? 0.4 : 0.3;
    var resConf = round((freqConf + essConf) / 2);

    return {
      sources: sources,
      findings: findings,
      confidence: resConf,
      research_summary: 'Outside-in, public-signal-only. ' + findings.length + ' finding' + (findings.length === 1 ? '' : 's') + ', held as hypothesis.',
      research_notes: publicInfo ? 'Operator provided public text; findings partly grounded in it.' : 'No public text provided; findings inferred from the mission and clearly marked.',
      essence_narrative: essenceNarr,
      essence_attributes: essenceAttrs,
      essence_confidence: essConf,
      frequency_summary: freqSummary,
      dimension_estimates: dims,
      frequency_confidence: freqConf,
      required_hypothesis: requiredHyp,
      current_hypothesis: currentHyp,
      risks: risks,
      analysis_confidence: anaConf,
      next_research_needed: nextResearch
    };
  }

  /* ---- helpers: deterministic readings ---------------------- */
  function capabilityForType(type) {
    var map = {
      new_geography: 'operate across geographies and build leadership and process beyond the founder',
      new_office: 'stand up and run a second site without diluting how it works',
      expansion: 'scale throughput without losing operational discipline',
      new_product: 'turn a new product from intent into shipped reality on a predictable cadence',
      technology: 'bring specialised capability in-house and develop senior technical ownership',
      sales: 'build a repeatable go-to-market motion rather than founder-led selling',
      operations: 'tighten process so output holds as volume grows',
      customer_support: 'hold service quality while demand rises',
      fundraising: 'present a coherent, fundable operating story and the team to deliver it',
      hiring: 'build a team with the right frequency, not just the right résumés',
      culture: 'shift how it works day to day without breaking what works',
      transformation: 'change its operating shape while still delivering',
      unknown: 'execute against its stated outcome with more structure than it has today'
    };
    return map[type] || map.unknown;
  }
  function describeOrg(org) {
    var bits = [];
    if (org.size) bits.push('a ' + stripDot(org.size).toLowerCase());
    if (org.industry) bits.push(stripDot(org.industry).toLowerCase() + ' company');
    else bits.push('an organization');
    if (org.location) bits.push('based in ' + stripDot(org.location));
    return bits.join(' ');
  }
  function essenceAttributes(type, stage, hiring) {
    var a = ['mission-driven (hypothesis)'];
    if (/expansion|new_geography|new_office/.test(type)) a.push('scaling');
    if (/technology|new_product/.test(type)) a.push('capability-building');
    if (stage === 'urgent' || stage === 'blocked') a.push('under time pressure');
    if (hiring === 'central' || hiring === 'likely') a.push('talent-dependent');
    a.push('founder/leader-centric (to verify)');
    return a.slice(0, 6);
  }
  function leaderCentric(m) {
    var blob = ((m.obstacles && m.obstacles.join(' ')) || '').toLowerCase();
    return /founder|leadership|no senior|owner|ceo/.test(blob) || m.hiring_relevance === 'central';
  }
  function missionRisks(m, org) {
    var r = [];
    var type = m.mission_type;
    if (/expansion|new_geography|new_office/.test(type)) r.push('Scaling leadership capability beyond the founder.');
    if (m.hiring_relevance === 'central') r.push('The mission is gated on one senior hire — concentration risk if the frequency is wrong.');
    if (/technology|new_product/.test(type)) r.push('Bringing specialised capability in-house faster than the surrounding process matures.');
    if (m.obstacles && m.obstacles[0]) r.push('Stated obstacle: ' + stripDot(m.obstacles[0]) + '.');
    if (m.mission_stage === 'urgent') r.push('Time pressure may push hiring toward résumé-fit over frequency-fit.');
    if (!r.length) r.push('Insufficient public signal to name a specific risk yet.');
    return r.slice(0, 5);
  }

  // The 10-dimension estimator — modest confidences, honest evidence.
  function estimateDimensions(m, org, publicInfo) {
    var type = m.mission_type || 'unknown';
    var stage = m.mission_stage || 'emerging';
    var hiring = m.hiring_relevance || 'possible';
    var small = /\b([1-9]|[1-4]\d)\b/.test(org.size || '') || /small|early|startup|seed/i.test(org.size || '');
    var basis = 'Inferred from the mission (type: ' + type + ', stage: ' + stage + ')' + (publicInfo ? '; partly from provided public text.' : '; not yet corroborated.');
    function d(dim, est, conf, ev) { return { dimension: dim, estimate: est, confidence: round(conf), evidence: ev || basis }; }

    var fast = /expansion|new_geography|new_product|new_office/.test(type) || stage === 'urgent' || stage === 'active';
    return [
      d('Pace', fast ? 'Fast / accelerating' : 'Moderate', fast ? 0.4 : 0.28),
      d('Execution Discipline', /outsourc|slow|process|bottleneck/.test(((m.obstacles||[]).join(' ')).toLowerCase()) ? 'Under strain' : 'Not yet observable', 0.3),
      d('Communication Style', 'Not observable from public signal yet', 0.15),
      d('Pressure Tolerance', (stage === 'urgent' || stage === 'blocked') ? 'Currently elevated' : 'Unknown', (stage === 'urgent' || stage === 'blocked') ? 0.35 : 0.2),
      d('Leadership Style', leaderCentric(m) ? 'Appears founder/leader-centric' : 'Unknown', leaderCentric(m) ? 0.35 : 0.2),
      d('Autonomy Level', (hiring === 'central' || hiring === 'likely') && /technology|new_product/.test(type) ? 'High expected (senior ownership)' : 'Unknown', 0.3),
      d('Innovation Requirement', /technology|new_product/.test(type) ? 'High' : 'Moderate', /technology|new_product/.test(type) ? 0.4 : 0.25),
      d('Process Maturity', /expansion|new_geography|new_office/.test(type) ? 'Likely stretched by scaling' : (small ? 'Likely early-stage / informal' : 'Unknown'), 0.32),
      d('Trust / Goodness Layer', 'Not observable from public information yet', 0.1),
      d('People Development Orientation', (hiring === 'central' || hiring === 'likely') ? 'Becoming a priority (building a team)' : 'Unknown', (hiring === 'central' || hiring === 'likely') ? 0.35 : 0.2)
    ];
  }
  function strongestDims(dims) {
    return dims.slice().sort(function (a, b) { return b.confidence - a.confidence; }).slice(0, 2)
      .map(function (d) { return d.dimension.toLowerCase(); }).join(' and ');
  }
  function mergeAIDimensions(base, aiDims) {
    var byName = {};
    aiDims.forEach(function (a) { if (a && a.dimension) byName[a.dimension.toLowerCase()] = a; });
    return base.map(function (b) {
      var a = byName[b.dimension.toLowerCase()];
      if (!a) return b;
      return {
        dimension: b.dimension,
        estimate: a.estimate || b.estimate,
        confidence: typeof a.confidence === 'number' ? round(a.confidence) : b.confidence,
        evidence: a.evidence || b.evidence
      };
    });
  }

  function defaultSources(publicInfo) {
    // What WOULD be consulted. Marked not-consulted unless the
    // operator pasted public text (then 'other' is consulted).
    var list = ['website', 'careers_page', 'job_descriptions', 'founder_profile', 'linkedin', 'news'];
    var sources = list.map(function (t) {
      return { source_type: t, label: labelFor(t), consulted: false, note: 'intended source — not auto-fetched in Tier-0' };
    });
    if (publicInfo) {
      sources.unshift({ source_type: 'other', label: 'Operator-provided public text', consulted: true, note: 'pasted into the research run' });
    }
    return sources;
  }
  function labelFor(t) {
    return ({ website: 'Company website', careers_page: 'Careers page', job_descriptions: 'Job descriptions',
      founder_profile: 'Founder profile', linkedin: 'LinkedIn', news: 'News', company_blog: 'Company blog',
      social_media: 'Social media', other: 'Other' })[t] || t;
  }

  function buildFindings(org, m, publicInfo, ai) {
    // AI-provided findings take precedence (validated), else from
    // pasted text, else honest inference tagged inferred:true.
    if (ai && Array.isArray(ai.findings) && ai.findings.length) {
      return ai.findings.slice(0, 6).map(function (f) {
        return {
          finding: String(f.finding || f.summary || '').slice(0, 240),
          source_type: SOURCE_TYPES.indexOf(f.source_type) !== -1 ? f.source_type : 'other',
          confidence: typeof f.confidence === 'number' ? round(f.confidence) : 0.4,
          inferred: !publicInfo
        };
      }).filter(function (f) { return f.finding; });
    }
    if (publicInfo) {
      // crude: split into sentences, keep the meatiest few
      var sents = publicInfo.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).filter(function (s) { return s.length > 24; });
      return sents.slice(0, 5).map(function (s) {
        return { finding: s.trim().slice(0, 240), source_type: guessSource(s), confidence: 0.45, inferred: false };
      });
    }
    // pure inference — clearly marked
    var inf = [];
    var outcome = m.desired_outcome || m.mission_description || '';
    if (outcome) inf.push({ finding: 'Mission implies: ' + lc(stripDot(outcome)) + '.', source_type: 'other', confidence: 0.3, inferred: true });
    if (m.mission_type && m.mission_type !== 'unknown') inf.push({ finding: 'Mission type reads as "' + m.mission_type + '", which usually demands ' + capabilityForType(m.mission_type) + '.', source_type: 'other', confidence: 0.3, inferred: true });
    if (m.obstacles && m.obstacles[0]) inf.push({ finding: 'Self-reported obstacle: ' + stripDot(m.obstacles[0]) + '.', source_type: 'other', confidence: 0.35, inferred: true });
    if (m.hiring_relevance === 'central') inf.push({ finding: 'Talent is described as central to the mission — the organization is, or is about to be, in a building phase.', source_type: 'other', confidence: 0.35, inferred: true });
    if (!inf.length) inf.push({ finding: 'Too little signal to form a public finding; only the mission statement is known.', source_type: 'other', confidence: 0.2, inferred: true });
    return inf.slice(0, 5);
  }
  function guessSource(s) {
    s = s.toLowerCase();
    if (/we('| a)re hiring|join (us|our)|role|position|apply/.test(s)) return 'careers_page';
    if (/founder|ceo|co-?founder/.test(s)) return 'founder_profile';
    if (/raised|series|funding|announced|launch/.test(s)) return 'news';
    if (/our (mission|values|team|product)|we build|we help/.test(s)) return 'website';
    return 'other';
  }

  /* ---- AI synthesis (optional enrichment) ------------------- */
  function aiSynthesize(org, mis, publicInfo) {
    return new Promise(function (resolve, reject) {
      var sys = [
        'You are a careful research analyst forming an OUTSIDE-IN, public-signal-only hypothesis about an organization.',
        'You cannot browse. Reason only from the mission text, the org fields, and any pasted public text.',
        'Everything is HYPOTHESIS — be humble, prefer "appears/likely/unknown", never claim certainty.',
        'Return ONLY a JSON object, no prose, no fences:',
        '{',
        '  "findings": [{"finding": string, "source_type": one of ' + JSON.stringify(SOURCE_TYPES) + ', "confidence": 0..1}],',
        '  "essence_narrative": string, "essence_attributes": string[],',
        '  "frequency_summary": string,',
        '  "dimension_estimates": [{"dimension": one of ' + JSON.stringify(DIMENSIONS) + ', "estimate": string, "confidence": 0..1, "evidence": string}],',
        '  "required_hypothesis": string, "current_hypothesis": string,',
        '  "risks": string[], "next_research_needed": string',
        '}',
        'If pasted public text is absent, mark findings as inferred in their wording and keep confidence low (<= 0.4).'
      ].join('\n');
      var user = 'ORG: ' + (org.organization_name || '') +
        '\nindustry: ' + (org.industry || '—') + '; size: ' + (org.size || '—') + '; location: ' + (org.location || '—') +
        '\n\nMISSION: ' + (mis ? (mis.mission_name + ' — ' + (mis.desired_outcome || mis.mission_description)) : '—') +
        '\ntype: ' + (mis && mis.mission_type) + '; stage: ' + (mis && mis.mission_stage) + '; hiring_relevance: ' + (mis && mis.hiring_relevance) +
        '\nobstacle: ' + ((mis && mis.obstacles && mis.obstacles[0]) || '—') +
        '\n\nPUBLIC TEXT (may be empty):\n' + (publicInfo || '(none provided)');

      var done = false;
      var guard = setTimeout(function () { if (!done) { done = true; reject(new Error('timeout')); } }, 16000);
      window.claude.complete({ system: sys, messages: [{ role: 'user', content: user }] })
        .then(function (reply) {
          if (done) return; done = true; clearTimeout(guard);
          try {
            var m = String(reply).match(/\{[\s\S]*\}/);
            resolve(m ? JSON.parse(m[0]) : null);
          } catch (e) { resolve(null); }
        })
        .catch(function (e) { if (done) return; done = true; clearTimeout(guard); reject(e); });
    });
  }

  /* ---- reads for the admin / flow --------------------------- */
  function getResearchForOrg(orgId, store) {
    store = ensure(store || OF.load());
    return {
      research: byId(store.tier0_research, 'organization_id', orgId),
      essence: byId(store.org_essence_hypotheses, 'organization_id', orgId),
      frequency: byId(store.org_frequency_hypotheses, 'organization_id', orgId)
    };
  }
  function getAnalysisForMission(missionId, store) {
    store = ensure(store || OF.load());
    return byId(store.mission_analyses, 'mission_id', missionId);
  }

  function recommendedNext(node) {
    // node = { mission, organization } (from OF.getMissionGraph)
    var o = node.organization;
    if (!o) return 'Attach an organization to this mission.';
    if (o.research_status === 'not_started' || o.research_status === 'unknown') {
      return 'Run Tier-0 research to form a preliminary essence + frequency hypothesis.';
    }
    if (o.research_status === 'tier0') {
      return 'Hypotheses formed. Next (a later build): corroborate with guided research, or validate with the people inside — before any resonance is computed.';
    }
    return 'Awaiting later builds.';
  }

  /* ---- utils ------------------------------------------------ */
  function byId(arr, key, val) { return (arr || []).filter(function (x) { return x[key] === val; })[0] || null; }
  function lc(s) { return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }
  function stripDot(s) { return s ? String(s).replace(/[.\s]+$/, '') : s; }
  function round(n) { return Math.round(n * 100) / 100; }
  function confidenceLabel(n) {
    if (n >= 0.55) return 'High';
    if (n >= 0.33) return 'Medium';
    if (n > 0) return 'Low';
    return '—';
  }

  /* ============================================================
     TIER 1 — Guided research (deeper, AI-driven)
     Builds on the Tier-0 hypothesis: goes deeper, corroborates,
     raises confidence where justified, and adds concrete
     interventions. Optionally guided by pasted public info.
     ============================================================ */
  function aiSynthesizeTier1(org, mis, t0, publicInfo) {
    return new Promise(function (resolve, reject) {
      var sys = [
        'You are doing TIER 1 "guided research": a DEEPER pass that builds on an existing Tier-0 outside-in hypothesis.',
        'You cannot browse. Reason from the mission, org fields, the prior Tier-0 hypothesis, and any pasted public text.',
        'Go further than Tier 0: corroborate or correct it, sharpen each frequency dimension with concrete reasoning, raise confidence ONLY where the evidence justifies it, and propose specific next interventions.',
        'Still a hypothesis — prefer "appears/likely", but be more decisive and specific than Tier 0.',
        'Return ONLY a JSON object, no prose, no fences:',
        '{',
        '  "findings": [{"finding": string, "source_type": one of ' + JSON.stringify(SOURCE_TYPES) + ', "confidence": 0..1}],',
        '  "essence_narrative": string, "essence_attributes": string[],',
        '  "frequency_summary": string,',
        '  "dimension_estimates": [{"dimension": one of ' + JSON.stringify(DIMENSIONS) + ', "estimate": string, "confidence": 0..1, "evidence": string}],',
        '  "required_hypothesis": string, "current_hypothesis": string,',
        '  "risks": string[], "next_research_needed": string',
        '}',
        'Cover as many of the ' + DIMENSIONS.length + ' dimensions as the evidence reasonably allows.'
      ].join('\n');

      var t0Block = '';
      if (t0 && t0.essence) t0Block += '\nTIER-0 ESSENCE: ' + (t0.essence.core_narrative || '');
      if (t0 && t0.frequency && t0.frequency.dimension_estimates) {
        t0Block += '\nTIER-0 DIMENSIONS: ' + t0.frequency.dimension_estimates
          .map(function (d) { return d.dimension + '=' + d.estimate + ' (' + Math.round((d.confidence || 0) * 100) + '%)'; })
          .join('; ');
      }
      if (t0 && t0.analysis) {
        t0Block += '\nTIER-0 REQUIRED: ' + (t0.analysis.required_organization_hypothesis || '');
        t0Block += '\nTIER-0 CURRENT: ' + (t0.analysis.current_organization_hypothesis || '');
      }

      var user = 'ORG: ' + (org.organization_name || '') +
        '\nindustry: ' + (org.industry || '—') + '; size: ' + (org.size || '—') + '; location: ' + (org.location || '—') +
        '\n\nMISSION: ' + (mis ? (mis.mission_name + ' — ' + (mis.desired_outcome || mis.mission_description)) : '—') +
        '\ntype: ' + (mis && mis.mission_type) + '; stage: ' + (mis && mis.mission_stage) + '; hiring_relevance: ' + (mis && mis.hiring_relevance) +
        '\nobstacle: ' + ((mis && mis.obstacles && mis.obstacles[0]) || '—') +
        '\n\nPRIOR TIER-0 HYPOTHESIS:' + (t0Block || ' (none)') +
        '\n\nPUBLIC TEXT (may be empty):\n' + (publicInfo || '(none provided)');

      var done = false;
      var guard = setTimeout(function () { if (!done) { done = true; reject(new Error('timeout')); } }, 20000);
      window.claude.complete({ system: sys, messages: [{ role: 'user', content: user }] })
        .then(function (reply) {
          if (done) return; done = true; clearTimeout(guard);
          try {
            var m = String(reply).match(/\{[\s\S]*\}/);
            resolve(m ? JSON.parse(m[0]) : null);
          } catch (e) { resolve(null); }
        })
        .catch(function (e) { if (done) return; done = true; clearTimeout(guard); reject(e); });
    });
  }

  function finishTier1(store, org, mis, syn) {
    var startISO = nowISO();
    var seeds = syn.findings.map(function (fd) {
      var seed = OF.seam.makeSeed('evidence', 'organization', org.organization_id, {
        summary: fd.finding, source: fd.source_type, confidence: fd.confidence,
        inferred: !!fd.inferred, linked_attribute: 'tier1_research'
      });
      seed.origin = 'tier1_research';
      store.seeds.push(seed);
      return seed;
    });
    var seedIds = seeds.map(function (s) { return s.seed_id; });

    var record = {
      research_id: uid('t1'),
      organization_id: org.organization_id,
      mission_id: mis ? mis.mission_id : null,
      research_status: 'completed',
      started_at: startISO,
      completed_at: nowISO(),
      findings: syn.findings,
      summary: syn.research_summary,
      confidence: syn.confidence
    };

    var essence = newEssenceHypothesis({
      organization_id: org.organization_id, core_narrative: syn.essence_narrative,
      attributes: syn.essence_attributes, confidence: syn.essence_confidence, supporting_evidence: seedIds
    });
    var frequency = newFrequencyHypothesis({
      organization_id: org.organization_id, frequency_summary: syn.frequency_summary,
      dimension_estimates: syn.dimension_estimates, confidence: syn.frequency_confidence, supporting_evidence: seedIds
    });
    var analysis = mis ? newMissionAnalysis({
      mission_id: mis.mission_id, organization_id: org.organization_id,
      required_organization_hypothesis: syn.required_hypothesis,
      current_organization_hypothesis: syn.current_hypothesis,
      mission_risk_observations: syn.risks, confidence: syn.analysis_confidence,
      next_research_needed: syn.next_research_needed
    }) : null;

    // Tier 1 supersedes the Tier-0 hypotheses with the deeper read.
    store.tier1_research = store.tier1_research.filter(function (r) { return r.organization_id !== org.organization_id; });
    store.org_essence_hypotheses = store.org_essence_hypotheses.filter(function (r) { return r.organization_id !== org.organization_id; });
    store.org_frequency_hypotheses = store.org_frequency_hypotheses.filter(function (r) { return r.organization_id !== org.organization_id; });
    if (mis) store.mission_analyses = store.mission_analyses.filter(function (r) { return r.mission_id !== mis.mission_id; });

    store.tier1_research.push(record);
    store.org_essence_hypotheses.push(essence);
    store.org_frequency_hypotheses.push(frequency);
    if (analysis) store.mission_analyses.push(analysis);

    org.research_status = 'tier1';
    org.updated_at = nowISO();
    if (mis && mis.research) {
      mis.research.status = 'tier1';
      mis.research.tier1.status = 'completed';
      mis.research.tier1.ran_at = record.completed_at;
      mis.updated_at = nowISO();
    }

    OF.save(store);
    return { research: record, essence: essence, frequency: frequency, analysis: analysis, seeds: seeds, store: store };
  }

  // runTier1(orgId, missionId, { publicInfo }) -> Promise(result)
  function runTier1(orgId, missionId, opts) {
    opts = opts || {};
    var store = ensure(OF.load());
    var org = byId(store.organizations, 'organization_id', orgId);
    var mis = byId(store.missions, 'mission_id', missionId) ||
              store.missions.filter(function (m) { return m.organization_id === orgId; })[0];
    if (!org) return Promise.reject(new Error('organization not found'));
    if (!(window.claude && typeof window.claude.complete === 'function')) {
      return Promise.reject(new Error('AI is required for Tier 1 guided research'));
    }
    var t0 = {
      essence: byId(store.org_essence_hypotheses, 'organization_id', orgId),
      frequency: byId(store.org_frequency_hypotheses, 'organization_id', orgId),
      analysis: mis ? byId(store.mission_analyses, 'mission_id', mis.mission_id) : null
    };
    var publicInfo = (opts.publicInfo || '').trim();
    return aiSynthesizeTier1(org, mis, t0, publicInfo).then(function (ai) {
      if (!ai) throw new Error('Tier 1 produced no usable result');
      return finishTier1(store, org, mis, synthesize(org, mis, publicInfo, ai));
    });
  }

  OF.research = {
    SOURCE_TYPES: SOURCE_TYPES,
    RESEARCH_STATUS: RESEARCH_STATUS,
    DIMENSIONS: DIMENSIONS,
    ensure: ensure,
    newTier0Research: newTier0Research,
    newEssenceHypothesis: newEssenceHypothesis,
    newFrequencyHypothesis: newFrequencyHypothesis,
    newMissionAnalysis: newMissionAnalysis,
    runTier0: runTier0,
    runTier1: runTier1,
    getResearchForOrg: getResearchForOrg,
    getAnalysisForMission: getAnalysisForMission,
    recommendedNext: recommendedNext,
    confidenceLabel: confidenceLabel
  };
})();
