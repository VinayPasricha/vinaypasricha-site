/* =============================================================
   Organizational Frequency — Candidate Discovery & Outreach (1P)
   =============================================================
   The discovery + outreach layer AFTER a mandate. Recruiter-driven,
   approval-gated. Long-term goal is autonomous agent hiring; the
   LAUNCH goal is AI-ASSISTED discovery with human approval before
   any outreach. No unsafe full automation.

       Mandate → Role Frequency → Candidate Search → Public Research
       → Preliminary Person Intelligence → Resonance Screen →
       Outreach Draft → HUMAN APPROVAL → Send (placeholder)

   REUSE: candidate public research = OF.personResearch (which
   reuses the 1N person-intelligence engine). No new research or
   intelligence engine is built here.

   HONESTY (enforced):
     • Live candidate search (Goodspace DB / LinkedIn / Google /
       GitHub) = NOT IMPLEMENTED. A search mission is created and
       marked needs_manual_input — never fabricated results.
     • No email/WhatsApp is sent. Drafts reach 'sent_placeholder'
       only after explicit approval; the transport is a hook.
     • No score, no ranking, no hire/reject decision.

   Augments window.OF with window.OF.outreach.
   ============================================================= */
(function () {
  'use strict';
  if (!window.OF) { console.warn('of-discovery-outreach.js requires of-model.js'); return; }
  var OF = window.OF;
  var R = OF.personResearch; // 1O — reused

  var SEARCH_SOURCES = ['goodspace_database', 'linkedin', 'google_search', 'github', 'portfolio', 'public_web', 'manual_import', 'other'];
  var SEARCH_STATUS = ['draft', 'running', 'needs_manual_input', 'completed', 'failed'];
  var DISCOVERY_STATUS = ['identified', 'researched', 'screened', 'approved_for_outreach', 'rejected', 'needs_more_evidence'];
  var NEXT_ACTIONS = ['approve_outreach', 'collect_more_evidence', 'manual_review', 'do_not_approach'];
  var DRAFT_STATUS = ['draft', 'pending_approval', 'approved', 'sent_placeholder', 'rejected'];
  // future automation agents — placeholders only, all inactive at launch
  var AGENTS = [
    { key: 'search_agent', label: 'Search Agent', does: 'Find candidates across sources', status: 'not_implemented' },
    { key: 'research_agent', label: 'Research Agent', does: 'Gather public evidence', status: 'not_implemented' },
    { key: 'person_intelligence_agent', label: 'Person Intelligence Agent', does: 'Build the person brief', status: 'not_implemented' },
    { key: 'resonance_agent', label: 'Resonance Agent', does: 'Screen resonance vs mandate', status: 'not_implemented' },
    { key: 'outreach_agent', label: 'Outreach Agent', does: 'Draft + send outreach', status: 'not_implemented' },
    { key: 'followup_agent', label: 'Follow-up Agent', does: 'Sequence follow-ups', status: 'not_implemented' }
  ];
  var LIVE_SEARCH = false;
  var EMAIL_INTEGRATION = false;

  function nowISO() { return new Date().toISOString(); }
  function uid(p) { return OF.uid(p); }
  function byId(arr, key, val) { return (arr || []).filter(function (x) { return x[key] === val; })[0] || null; }

  function ensure(store) {
    R && R.ensure && R.ensure(store);
    store.cd_searches = store.cd_searches || [];
    store.cd_candidates = store.cd_candidates || [];
    store.cd_resonance = store.cd_resonance || [];
    store.cd_drafts = store.cd_drafts || [];
    return store;
  }

  /* ===== OBJECT 1 — CandidateSearchMission ===== */
  function newSearch(f) {
    f = f || {};
    return {
      search_id: f.search_id || uid('csm'),
      mandate_id: f.mandate_id || null, role_id: f.role_id || null, organization_id: f.organization_id || null,
      search_status: SEARCH_STATUS.indexOf(f.search_status) !== -1 ? f.search_status : 'draft',
      sources: f.sources || [],
      search_query: f.search_query || '',
      target_profile: f.target_profile || '',
      created_at: f.created_at || nowISO(), updated_at: nowISO()
    };
  }

  /* ===== OBJECT 2 — CandidateDiscoveryRecord ===== */
  function newCandidate(f) {
    f = f || {};
    return {
      candidate_discovery_id: f.candidate_discovery_id || uid('cdr'),
      search_id: f.search_id || null,
      person_name: f.person_name || '', linkedin_url: f.linkedin_url || '',
      current_company: f.current_company || '', current_title: f.current_title || '',
      public_sources: f.public_sources || [],
      evidence_summary: f.evidence_summary || '',
      confidence: f.confidence || 'low',
      status: DISCOVERY_STATUS.indexOf(f.status) !== -1 ? f.status : 'identified',
      research_request_id: f.research_request_id || null,   // link to 1O request
      created_at: f.created_at || nowISO(), updated_at: nowISO()
    };
  }

  /* ===== OBJECT 4 — PreliminaryCandidateResonance ===== */
  function newResonance(f) {
    f = f || {};
    return {
      resonance_id: f.resonance_id || uid('cres'),
      candidate_discovery_id: f.candidate_discovery_id || null,
      mandate_id: f.mandate_id || null, role_id: f.role_id || null, organization_id: f.organization_id || null,
      summary: f.summary || '',
      positive_resonance_signals: f.positive_resonance_signals || [],
      constructive_friction_signals: f.constructive_friction_signals || [],
      missing_evidence: f.missing_evidence || [], risks: f.risks || [],
      confidence: f.confidence || 'low',
      next_action: NEXT_ACTIONS.indexOf(f.next_action) !== -1 ? f.next_action : 'collect_more_evidence',
      created_at: f.created_at || nowISO()
    };
  }

  /* ===== OBJECT 5 — ResonanceOutreachDraft ===== */
  function newDraft(f) {
    f = f || {};
    return {
      draft_id: f.draft_id || uid('odraft'),
      candidate_discovery_id: f.candidate_discovery_id || null, mandate_id: f.mandate_id || null,
      subject: f.subject || '', body: f.body || '',
      evidence_used: f.evidence_used || [], resonance_reasoning: f.resonance_reasoning || [],
      status: DRAFT_STATUS.indexOf(f.status) !== -1 ? f.status : 'draft',
      created_at: f.created_at || nowISO(), updated_at: nowISO()
    };
  }

  /* ===== SEARCH MISSION ===== */
  function createSearch(mandateId, fields, store) {
    store = ensure(store || OF.load());
    var mandate = byId(store.mandates, 'mandate_id', mandateId);
    if (!mandate) return { error: 'Mandate not found.' };
    var role = byId(store.roles, 'role_id', mandate.role_id);
    var rf = role ? (store.role_frequencies || []).filter(function (x) { return x.role_id === role.role_id; })[0] : null;
    // target profile is derived from the role frequency — what the role REQUIRES
    var target = role ? (role.role_name + ' — ' + (role.role_purpose || '').slice(0, 100)) : 'role';
    if (rf && rf.dimensions) {
      var primary = rf.dimensions.filter(function (d) { return d.primary; })[0];
      if (primary) target += ' · core dimension: ' + primary.dimension + ' (' + (primary.required_level || '') + ')';
    }
    var s = newSearch({
      mandate_id: mandateId, role_id: mandate.role_id, organization_id: mandate.organization_id,
      sources: (fields && fields.sources) || ['goodspace_database', 'linkedin', 'public_web'],
      search_query: (fields && fields.search_query) || (role ? role.role_name : ''),
      target_profile: target,
      // honest: nothing can be searched live
      search_status: LIVE_SEARCH ? 'running' : 'needs_manual_input'
    });
    store.cd_searches.push(s);
    OF.save(store);
    return { search: s };
  }

  /* ===== ADD A CANDIDATE (manual / by URL) ===== */
  function addCandidate(searchId, fields, store) {
    store = ensure(store || OF.load());
    var search = byId(store.cd_searches, 'search_id', searchId);
    if (!search) return { error: 'Search mission not found.' };
    fields = fields || {};
    if (!fields.person_name && !fields.linkedin_url) return { error: 'Add a name or a LinkedIn URL.' };
    // open a 1O research request (which honestly handles the URL + manual paste)
    var mandate = byId(store.mandates, 'mandate_id', search.mandate_id);
    var req = R.startRequest({
      linkedin_url: fields.linkedin_url || '', person_name: fields.person_name || 'Candidate',
      current_company: fields.current_company || '', target_mandate_id: search.mandate_id
    }, store);
    store = OF.load(); ensure(store);
    var c = newCandidate({
      search_id: searchId, person_name: fields.person_name || 'Candidate', linkedin_url: fields.linkedin_url || '',
      current_company: fields.current_company || '', current_title: fields.current_title || '',
      research_request_id: req.request.request_id
    });
    store.cd_candidates.push(c);
    if (search.search_status === 'draft') search.search_status = 'needs_manual_input';
    OF.save(store);
    return { candidate: c, research_request_id: req.request.request_id };
  }

  // paste into a candidate's research request (delegates to 1O)
  function pasteForCandidate(candId, sourceId, rawText, store) {
    store = ensure(store || OF.load());
    var res = R.pasteSource(sourceId, rawText, store);
    return res;
  }

  /* ===== RESEARCH + RESONANCE (reuse 1O) ===== */
  function researchAndScreen(candId, store) {
    store = ensure(store || OF.load());
    var c = byId(store.cd_candidates, 'candidate_discovery_id', candId);
    if (!c || !c.research_request_id) return { error: 'Candidate or research request missing.' };
    var gen = R.generatePreliminary(c.research_request_id, store);
    store = OF.load(); ensure(store);
    if (gen && gen.error) return { error: gen.error };
    var rr = R.getRequest(c.research_request_id, store);
    c = byId(store.cd_candidates, 'candidate_discovery_id', candId);

    // summarise evidence onto the discovery record
    var brief = rr && rr.brief;
    var observed = brief ? (brief.person_frequency_hypothesis || []).filter(function (d) { return !/no signal|not.*observable/i.test(d.reading); }).length : 0;
    c.evidence_summary = brief ? (observed + ' of 10 frequency dimensions have public evidence; essence: ' + (brief.person_essence_hypothesis ? brief.person_essence_hypothesis.statement.split('—')[0].trim() : 'unclear')) : 'No brief yet.';
    c.confidence = brief && brief.confidence ? brief.confidence.level : 'low';
    c.status = 'researched';

    // resonance — copy the 1O screen into a candidate resonance record
    var screen = rr && rr.screen;
    var resonance = null;
    if (screen) {
      var nextMap = { approach_candidate: 'approve_outreach', collect_more_evidence: 'collect_more_evidence', manual_review: 'manual_review', do_not_approach_yet: 'do_not_approach' };
      store.cd_resonance = store.cd_resonance.filter(function (x) { return x.candidate_discovery_id !== candId; });
      resonance = newResonance({
        candidate_discovery_id: candId, mandate_id: c_searchMandate(c, store), role_id: screen.role_id, organization_id: screen.organization_id,
        summary: screen.screen_summary, positive_resonance_signals: screen.positive_resonance_signals,
        constructive_friction_signals: screen.constructive_friction_signals, missing_evidence: screen.missing_evidence,
        risks: screen.risks, confidence: screen.confidence, next_action: nextMap[screen.recommended_next_step] || 'collect_more_evidence'
      });
      store.cd_resonance.push(resonance);
      c.status = 'screened';
    }
    OF.save(store);
    return { candidate: c, brief: brief, resonance: resonance };
  }
  function c_searchMandate(c, store) { var s = byId(store.cd_searches, 'search_id', c.search_id); return s ? s.mandate_id : null; }

  /* ===== OUTREACH DRAFT GENERATION =====
     Not a JD blast. Six-beat structure, hedged, traceable to the
     evidence and resonance — and explicitly preliminary. */
  function generateDraft(candId, store) {
    store = ensure(store || OF.load());
    var c = byId(store.cd_candidates, 'candidate_discovery_id', candId);
    if (!c) return { error: 'Candidate not found.' };
    var resonance = byId(store.cd_resonance, 'candidate_discovery_id', candId);
    if (!resonance) return { error: 'Run research & resonance first — an outreach draft must rest on a screen.' };
    var rr = R.getRequest(c.research_request_id, store);
    var brief = rr && rr.brief;
    var mandate = byId(store.mandates, 'mandate_id', resonance.mandate_id);
    var role = byId(store.roles, 'role_id', resonance.role_id);
    var org = byId(store.organizations, 'organization_id', resonance.organization_id);
    var mission = mandate ? byId(store.missions, 'mission_id', mandate.mission_id) : null;

    var name = (c.person_name || 'there').split(' ')[0];
    var orgName = org ? org.organization_name : 'an organization we work with';
    var missionLine = mission ? (mission.desired_outcome || mission.mission_name) : (role ? role.role_purpose : 'a mission');
    // a clean pattern phrase — pull the descriptor out of the hypothesis, never splice the raw statement
    var patternPhrase = 'a pattern in how you have built your career';
    if (brief && brief.career_pattern_hypothesis) {
      var pm = brief.career_pattern_hypothesis.statement.match(/shows? (?:a |an )?(.+?) career pattern/i);
      if (pm && pm[1]) patternPhrase = 'what looks like ' + (/^[aeiou]/i.test(pm[1]) ? 'an ' : 'a ') + pm[1].trim() + ' way of working';
    }
    var posSignalRaw = (resonance.positive_resonance_signals[0] || '').replace(/^On the role\u2019s core dimension \([^)]*\),?\s*/i, '');
    var posSignal = posSignalRaw || 'a pattern that appears unusually relevant to this mission';

    // evidence + reasoning provenance
    var evidenceUsed = [];
    if (brief && brief.person_essence_hypothesis) evidenceUsed.push('essence: ' + brief.person_essence_hypothesis.statement.split('—')[0].trim());
    (resonance.positive_resonance_signals || []).slice(0, 2).forEach(function (p) { evidenceUsed.push('resonance: ' + p); });
    var reasoning = [];
    reasoning.push('Noticed via ' + (c.linkedin_url ? 'a public profile' : 'public material') + ' — not a database blast.');
    reasoning.push('Career pattern that stood out: ' + patternPhrase + '.');
    reasoning.push('Mission: ' + missionLine);
    reasoning.push('Possible resonance: ' + posSignal);
    reasoning.push('Stated as preliminary and fallible.');

    var subject = 'A possible resonance with what ' + orgName + ' is building';
    var body =
      'Hi ' + name + ',\n\n' +
      'I came across your public work and a pattern in it caught my attention — ' + patternPhrase + '. ' +
      'That\u2019s why I\u2019m reaching out directly rather than with a generic role blast.\n\n' +
      orgName + ' is pursuing something specific: ' + missionLine + '. ' +
      'Reading your trajectory against that, there *may* be a genuine resonance \u2014 for instance, ' + lcfirst(posSignal) + (/[.!?]$/.test(posSignal) ? '' : '.') + '\n\n' +
      'I want to be honest: this is a preliminary read from public signal, and I may be wrong. ' +
      'If any of it lands, I\u2019d value a short, no-pressure exploratory conversation to find out together — and if not, no harm done.\n\n' +
      'Would you be open to 20 minutes?\n\nWarmly,\nThe ' + orgName + ' team';

    store.cd_drafts = store.cd_drafts.filter(function (d) { return d.candidate_discovery_id !== candId; });
    var draft = newDraft({
      candidate_discovery_id: candId, mandate_id: resonance.mandate_id,
      subject: subject, body: body, evidence_used: evidenceUsed, resonance_reasoning: reasoning,
      status: 'pending_approval'
    });
    store.cd_drafts.push(draft);
    OF.save(store);
    return { draft: draft };
  }

  function approveDraft(draftId, store) {
    store = ensure(store || OF.load());
    var d = byId(store.cd_drafts, 'draft_id', draftId);
    if (!d) return null;
    d.status = 'approved'; d.updated_at = nowISO();
    var c = byId(store.cd_candidates, 'candidate_discovery_id', d.candidate_discovery_id);
    if (c) c.status = 'approved_for_outreach';
    OF.save(store);
    return d;
  }
  function rejectDraft(draftId, store) {
    store = ensure(store || OF.load());
    var d = byId(store.cd_drafts, 'draft_id', draftId);
    if (d) { d.status = 'rejected'; d.updated_at = nowISO(); OF.save(store); }
    return d;
  }
  // explicit, human-triggered "send" — placeholder only; no transport exists
  function sendApproved(draftId, store) {
    store = ensure(store || OF.load());
    var d = byId(store.cd_drafts, 'draft_id', draftId);
    if (!d) return { error: 'Draft not found.' };
    if (d.status !== 'approved') return { error: 'Draft must be approved by a human before sending.' };
    if (!EMAIL_INTEGRATION) {
      d.status = 'sent_placeholder'; d.updated_at = nowISO(); OF.save(store);
      return { placeholder: true, note: 'NOT IMPLEMENTED — no email transport. Marked sent_placeholder; nothing was actually sent.' };
    }
    d.status = 'sent_placeholder'; OF.save(store);
    return { placeholder: true };
  }
  function editDraft(draftId, fields, store) {
    store = ensure(store || OF.load());
    var d = byId(store.cd_drafts, 'draft_id', draftId);
    if (!d) return null;
    if (fields.subject != null) d.subject = fields.subject;
    if (fields.body != null) d.body = fields.body;
    d.updated_at = nowISO();
    OF.save(store);
    return d;
  }
  function setCandidateStatus(candId, status, store) {
    store = ensure(store || OF.load());
    var c = byId(store.cd_candidates, 'candidate_discovery_id', candId);
    if (c && DISCOVERY_STATUS.indexOf(status) !== -1) { c.status = status; c.updated_at = nowISO(); OF.save(store); }
    return c;
  }

  /* ===== reads ===== */
  function getSearches(store) {
    store = ensure(store || OF.load());
    return store.cd_searches.slice().sort(function (a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); }).map(function (s) {
      var mandate = byId(store.mandates, 'mandate_id', s.mandate_id);
      var role = byId(store.roles, 'role_id', s.role_id);
      var org = byId(store.organizations, 'organization_id', s.organization_id);
      return { search: s, mandate: mandate, role: role, organization: org, candidates: store.cd_candidates.filter(function (c) { return c.search_id === s.search_id; }).length };
    });
  }
  function getCandidate(candId, store) {
    store = ensure(store || OF.load());
    var c = byId(store.cd_candidates, 'candidate_discovery_id', candId);
    if (!c) return null;
    return {
      candidate: c,
      research: c.research_request_id ? R.getRequest(c.research_request_id, store) : null,
      resonance: byId(store.cd_resonance, 'candidate_discovery_id', candId),
      draft: byId(store.cd_drafts, 'candidate_discovery_id', candId)
    };
  }
  function getCandidatesForSearch(searchId, store) {
    store = ensure(store || OF.load());
    return store.cd_candidates.filter(function (c) { return c.search_id === searchId; })
      .sort(function (a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); })
      .map(function (c) { return getCandidate(c.candidate_discovery_id, store); });
  }
  function mandateTargets(store) { return R.targets(store); }
  function deleteSearch(searchId, store) {
    store = ensure(store || OF.load());
    var cands = store.cd_candidates.filter(function (c) { return c.search_id === searchId; });
    cands.forEach(function (c) {
      store.cd_resonance = store.cd_resonance.filter(function (x) { return x.candidate_discovery_id !== c.candidate_discovery_id; });
      store.cd_drafts = store.cd_drafts.filter(function (x) { return x.candidate_discovery_id !== c.candidate_discovery_id; });
      if (c.research_request_id) R.deleteRequest(c.research_request_id, store);
      store = OF.load(); ensure(store);
    });
    store.cd_candidates = store.cd_candidates.filter(function (c) { return c.search_id !== searchId; });
    store.cd_searches = store.cd_searches.filter(function (s) { return s.search_id !== searchId; });
    OF.save(store);
  }

  /* helpers */
  function lcfirst(s) { return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }
  function stripName(s, name) { if (!s || !name) return s; return s.replace(new RegExp((name.split(' ')[0] || '') + '\\s*', 'i'), ''); }

  OF.outreach = {
    SEARCH_SOURCES: SEARCH_SOURCES, SEARCH_STATUS: SEARCH_STATUS, DISCOVERY_STATUS: DISCOVERY_STATUS,
    NEXT_ACTIONS: NEXT_ACTIONS, DRAFT_STATUS: DRAFT_STATUS, AGENTS: AGENTS,
    LIVE_SEARCH: LIVE_SEARCH, EMAIL_INTEGRATION: EMAIL_INTEGRATION,
    ensure: ensure,
    createSearch: createSearch, addCandidate: addCandidate, pasteForCandidate: pasteForCandidate,
    researchAndScreen: researchAndScreen, generateDraft: generateDraft,
    approveDraft: approveDraft, rejectDraft: rejectDraft, sendApproved: sendApproved, editDraft: editDraft,
    setCandidateStatus: setCandidateStatus,
    getSearches: getSearches, getCandidate: getCandidate, getCandidatesForSearch: getCandidatesForSearch,
    mandateTargets: mandateTargets, deleteSearch: deleteSearch
  };
})();
