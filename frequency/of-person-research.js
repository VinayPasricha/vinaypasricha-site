/* =============================================================
   Organizational Frequency — Person Public Research Runtime (1O)
   =============================================================
   The FRONT DOOR to Person Intelligence. A recruiter starts from
   a LinkedIn URL or name+company. The runtime CANNOT fetch the web
   or scrape LinkedIn — it says so honestly, stores the URL, and
   asks for pasted public material. It then REUSES the 1N Person
   Intelligence engine (OF.personIntel) to produce a preliminary
   brief + frequency, and a lightweight Preliminary Resonance Screen
   against an optional target role/mandate.

   HONESTY (enforced, per the audit):
     • Live web search        → NOT IMPLEMENTED
     • LinkedIn scraping      → NOT IMPLEMENTED
     • A LinkedIn URL is stored, never scraped; the source is
       marked manual_input_required and the recruiter pastes text.
     • No fabricated search results, ever.

   It reuses — never re-implements — the person engine. The screen
   gives a recruiter NEXT ACTION only: approach / collect more /
   manual review / do not approach yet. No score, rank, fit %, hire
   decision, or outreach.

   Augments window.OF with window.OF.personResearch.
   ============================================================= */
(function () {
  'use strict';
  if (!window.OF) { console.warn('of-person-research.js requires of-model.js'); return; }
  var OF = window.OF;
  var PI = OF.personIntel; // 1N engine — reused, not duplicated

  var REQ_STATUS = ['draft', 'queued', 'running', 'completed', 'failed', 'manual_input_required'];
  var SOURCE_TYPES = ['linkedin_profile', 'linkedin_post', 'resume', 'personal_website', 'article', 'press', 'podcast', 'youtube', 'github', 'portfolio', 'company_profile', 'public_search_result', 'other'];
  var PUB_SOURCE_STATUS = ['retrieved', 'manual_paste', 'blocked', 'ignored', 'failed', 'pending_review'];
  var NEXT_STEPS = ['approach_candidate', 'collect_more_evidence', 'do_not_approach_yet', 'manual_review'];
  // map a public-source type to the 1N PersonSourceRegistry type
  var TO_PI_TYPE = {
    linkedin_profile: 'linkedin_profile', linkedin_post: 'linkedin_post', resume: 'resume',
    personal_website: 'personal_website', article: 'article', press: 'press', podcast: 'public_commentary',
    youtube: 'public_commentary', github: 'github', portfolio: 'portfolio', company_profile: 'other',
    public_search_result: 'public_commentary', other: 'other'
  };
  // capability flags — the single source of truth for the honesty banner
  var LIVE_WEB_SEARCH = false;
  var LIVE_LINKEDIN_FETCH = false;

  function nowISO() { return new Date().toISOString(); }
  function uid(p) { return OF.uid(p); }
  function byId(arr, key, val) { return (arr || []).filter(function (x) { return x[key] === val; })[0] || null; }

  function ensure(store) {
    PI && PI.ensure && PI.ensure(store);
    store.pr_requests = store.pr_requests || [];
    store.pr_sources = store.pr_sources || [];        // intake-side mirror (URL/status); text is mirrored into PI on paste
    store.pr_screens = store.pr_screens || [];
    return store;
  }

  /* ==========================================================
     BUILD OBJECT 1 — PersonResearchRequest
     ========================================================== */
  function newRequest(f) {
    f = f || {};
    return {
      request_id: f.request_id || uid('preq'),
      person_id: f.person_id || null,
      linkedin_url: f.linkedin_url || '',
      person_name: f.person_name || '',
      current_company: f.current_company || '',
      target_role_id: f.target_role_id || null,
      target_mandate_id: f.target_mandate_id || null,
      status: REQ_STATUS.indexOf(f.status) !== -1 ? f.status : 'draft',
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }

  /* ==========================================================
     BUILD OBJECT 2 — PersonPublicSource (intake mirror)
     ========================================================== */
  function newPublicSource(f) {
    f = f || {};
    return {
      source_id: f.source_id || uid('pubsrc'),
      request_id: f.request_id || null,
      person_id: f.person_id || null,
      source_type: SOURCE_TYPES.indexOf(f.source_type) !== -1 ? f.source_type : 'other',
      url: f.url || '',
      title: f.title || '',
      raw_text: f.raw_text || '',
      status: PUB_SOURCE_STATUS.indexOf(f.status) !== -1 ? f.status : 'pending_review',
      retrieved_at: f.retrieved_at || null,
      confidence: f.confidence || 'low',
      notes: f.notes || '',
      pi_source_id: f.pi_source_id || null,   // link to the 1N source created on paste
      created_at: f.created_at || nowISO()
    };
  }

  /* ==========================================================
     BUILD OBJECT 5 — PreliminaryResonanceScreen
     ========================================================== */
  function newScreen(f) {
    f = f || {};
    return {
      screen_id: f.screen_id || uid('scrn'),
      person_id: f.person_id || null,
      mandate_id: f.mandate_id || null,
      role_id: f.role_id || null,
      organization_id: f.organization_id || null,
      brief_id: f.brief_id || null,
      screen_summary: f.screen_summary || '',
      positive_resonance_signals: f.positive_resonance_signals || [],
      constructive_friction_signals: f.constructive_friction_signals || [],
      missing_evidence: f.missing_evidence || [],
      risks: f.risks || [],
      confidence: f.confidence || 'low',
      recommended_next_step: NEXT_STEPS.indexOf(f.recommended_next_step) !== -1 ? f.recommended_next_step : 'collect_more_evidence',
      created_at: f.created_at || nowISO()
    };
  }

  /* ==========================================================
     START A RESEARCH REQUEST (LinkedIn URL or name+company)
     ========================================================== */
  function startRequest(fields, store) {
    store = ensure(store || OF.load());
    fields = fields || {};
    // create the underlying Person (1N) so sources attach
    var name = fields.person_name || '';
    var person = PI.createPerson({ name: name, current_company: fields.current_company || '', source: 'public_research' }, store);
    store = OF.load(); ensure(store);

    var req = newRequest({
      person_id: person.person_id,
      linkedin_url: fields.linkedin_url || '',
      person_name: name,
      current_company: fields.current_company || '',
      target_role_id: fields.target_role_id || null,
      target_mandate_id: fields.target_mandate_id || null
    });

    // Honest intake: nothing can be fetched. Seed placeholder sources
    // that the recruiter must fill by pasting real public text.
    var placeholders = [];
    if (req.linkedin_url) {
      placeholders.push(newPublicSource({
        request_id: req.request_id, person_id: person.person_id, source_type: 'linkedin_profile',
        url: req.linkedin_url, title: 'LinkedIn profile',
        status: LIVE_LINKEDIN_FETCH ? 'pending_review' : 'blocked',
        notes: LIVE_LINKEDIN_FETCH ? '' : 'NOT IMPLEMENTED — LinkedIn cannot be fetched/scraped. Paste the profile text (About + Experience).'
      }));
    }
    // standard public-evidence slots, all awaiting manual paste
    [['public_search_result', 'Web search results'], ['article', 'Articles by/about'], ['press', 'Press mentions'], ['github', 'GitHub / portfolio'], ['personal_website', 'Personal website / blog']].forEach(function (p) {
      placeholders.push(newPublicSource({
        request_id: req.request_id, person_id: person.person_id, source_type: p[0], title: p[1],
        status: 'pending_review',
        notes: LIVE_WEB_SEARCH ? '' : 'NOT IMPLEMENTED — no live web search. Paste any found text here.'
      }));
    });
    placeholders.forEach(function (s) { store.pr_sources.push(s); });

    req.status = 'manual_input_required';
    store.pr_requests.push(req);
    OF.save(store);
    return getRequest(req.request_id, store);
  }

  /* ==========================================================
     PASTE real text into a source → feeds the 1N engine.
     This is the ONLY way evidence enters (Level 1 / Level 2).
     ========================================================== */
  function pasteSource(sourceId, rawText, store) {
    store = ensure(store || OF.load());
    var src = byId(store.pr_sources, 'source_id', sourceId);
    if (!src) return { error: 'Source not found.' };
    if (!rawText || !rawText.trim()) return { error: 'Paste the real public text for this source.' };
    src.raw_text = rawText;
    src.status = 'manual_paste';
    src.retrieved_at = nowISO();
    src.confidence = 'medium';
    // feed the existing Person Intelligence engine (reuse, not re-implement)
    var piType = TO_PI_TYPE[src.source_type] || 'other';
    var piSrc = PI.addSource(src.person_id, { source_type: piType, title: src.title, url: src.url, raw_text: rawText }, store);
    store = OF.load(); ensure(store);
    var s2 = byId(store.pr_sources, 'source_id', sourceId);
    if (s2) s2.pi_source_id = piSrc.source_id;
    OF.save(store);
    return { source: s2, pi_source: piSrc };
  }

  // add an extra source slot (e.g. a second article) — also manual
  function addSourceSlot(requestId, fields, store) {
    store = ensure(store || OF.load());
    var req = byId(store.pr_requests, 'request_id', requestId);
    if (!req) return null;
    var s = newPublicSource(Object.assign({ request_id: requestId, person_id: req.person_id, status: 'pending_review',
      notes: 'Manual input required — paste real public text.' }, fields || {}));
    store.pr_sources.push(s);
    OF.save(store);
    return s;
  }
  function ignoreSource(sourceId, store) {
    store = ensure(store || OF.load());
    var s = byId(store.pr_sources, 'source_id', sourceId);
    if (s) { s.status = 'ignored'; OF.save(store); }
    return s;
  }

  /* ==========================================================
     GENERATE the preliminary brief (reuses 1N generateBrief) then,
     if a target role/mandate exists, the Preliminary Resonance Screen.
     ========================================================== */
  function generatePreliminary(requestId, store) {
    store = ensure(store || OF.load());
    var req = byId(store.pr_requests, 'request_id', requestId);
    if (!req) return { error: 'Request not found.' };
    var pasted = store.pr_sources.filter(function (s) { return s.request_id === requestId && s.status === 'manual_paste'; });
    if (!pasted.length) return { error: 'No pasted evidence yet. The runtime cannot fetch — paste LinkedIn / resume / public text first.' };

    var brief = PI.generateBrief(req.person_id, store);
    store = OF.load(); ensure(store);
    if (brief && brief.error) return { error: brief.error };

    req.status = 'completed';
    req.updated_at = nowISO();

    var screen = null;
    if (req.target_mandate_id || req.target_role_id) {
      screen = buildResonanceScreen(req, store);
    }
    OF.save(store);
    return { brief: brief.brief || brief, screen: screen };
  }

  /* ==========================================================
     PRELIMINARY RESONANCE SCREEN — lightweight, evidence-honest.
     Compares the preliminary person frequency against the role
     frequency (1F) / org frequency, via the doctrine's dimensions.
     Recruiter aid only: next-action, never a verdict.
     ========================================================== */
  function buildResonanceScreen(req, store) {
    store = ensure(store || OF.load());
    var mandate = req.target_mandate_id ? byId(store.mandates, 'mandate_id', req.target_mandate_id) : null;
    var roleId = req.target_role_id || (mandate && mandate.role_id);
    var role = roleId ? byId(store.roles, 'role_id', roleId) : null;
    var orgId = (mandate && mandate.organization_id) || (role && role.organization_id);
    var brief = (store.pi_briefs || []).filter(function (b) { return b.person_id === req.person_id; })[0];
    var pf = brief && brief.person_frequency_hypothesis;
    var rf = role ? (store.role_frequencies || []).filter(function (x) { return x.role_id === role.role_id; })[0] : null;

    var pos = [], friction = [], missing = [], risks = [];

    // which person dimensions are actually observable
    var observed = (pf || []).filter(function (d) { return !/no signal|not.*observable/i.test(d.reading); });
    var unobserved = (pf || []).filter(function (d) { return /no signal|not.*observable/i.test(d.reading); });
    unobserved.forEach(function (d) { missing.push(d.dimension + ' — no public evidence yet'); });

    if (rf && pf) {
      (rf.dimensions || []).forEach(function (rd) {
        var pd = pf.filter(function (x) { return x.dimension === rd.dimension; })[0];
        if (!pd || /no signal|not.*observable/i.test(pd.reading)) {
          if (rd.primary) missing.push('Role-critical dimension "' + rd.dimension + '" has no candidate evidence');
          return;
        }
        // crude alignment read on the dimension the role most needs
        if (rd.primary) {
          pos.push('On the role\u2019s core dimension (' + rd.dimension + '), there is candidate signal to probe: ' + pd.reading);
        }
      });
    } else if (role && !rf) {
      missing.push('Target role has no computed role frequency yet — define/compute it for a sharper screen.');
    } else if (!role) {
      missing.push('No target role/mandate attached — screen is person-only.');
    }

    // friction surfaces from the brief's own contradiction hypotheses
    (brief && brief.contradiction_hypotheses || []).forEach(function (c) {
      friction.push((c.tension || 'Tension') + ' — ' + (c.observed || ''));
    });
    (brief && brief.risk_hypothesis ? [].concat(brief.risk_hypothesis) : []).forEach(function (r) {
      if (r && r.statement) risks.push(r.statement);
    });

    // confidence + next step, honest about thin evidence
    var nObserved = observed.length, nSources = store.pr_sources.filter(function (s) { return s.request_id === req.request_id && s.status === 'manual_paste'; }).length;
    var conf = (nSources >= 3 && nObserved >= 6) ? 'medium' : 'low';
    var next;
    if (nObserved >= 6 && pos.length && conf === 'medium') next = 'approach_candidate';
    else if (nObserved >= 3) next = 'collect_more_evidence';
    else if (!nObserved) next = 'manual_review';
    else next = 'collect_more_evidence';

    var summary = 'Preliminary screen on ' + (req.person_name || 'this candidate') +
      (role ? ' against the ' + role.role_name + ' role' : '') + '. ' +
      nObserved + ' of ' + (pf ? pf.length : 10) + ' frequency dimensions have public evidence across ' + nSources + ' pasted source' + (nSources === 1 ? '' : 's') + '. ' +
      'This is a recruiter aid — no score, no ranking, no hire decision. ' +
      (next === 'approach_candidate' ? 'Enough signal to justify a conversation.' :
        next === 'collect_more_evidence' ? 'Promising but thin — gather more public evidence before approaching.' :
        next === 'manual_review' ? 'Too little evidence to screen — needs human review.' : '');

    store.pr_screens = store.pr_screens.filter(function (s) { return !(s.person_id === req.person_id && s.mandate_id === req.target_mandate_id && s.role_id === roleId); });
    var screen = newScreen({
      person_id: req.person_id, mandate_id: req.target_mandate_id, role_id: roleId, organization_id: orgId,
      brief_id: brief && brief.brief_id,
      screen_summary: summary, positive_resonance_signals: pos, constructive_friction_signals: friction,
      missing_evidence: missing, risks: risks, confidence: conf, recommended_next_step: next
    });
    store.pr_screens.push(screen);
    return screen;
  }

  /* ---- reads ---- */
  function getRequest(requestId, store) {
    store = ensure(store || OF.load());
    var req = byId(store.pr_requests, 'request_id', requestId);
    if (!req) return null;
    var pi = PI.getPersonIntel(req.person_id, store);
    return {
      request: req,
      person: pi && pi.person,
      sources: store.pr_sources.filter(function (s) { return s.request_id === requestId; }),
      brief: pi && pi.brief,
      person_frequency: pi && pi.brief && pi.brief.person_frequency_hypothesis,
      screen: (store.pr_screens || []).filter(function (s) { return s.person_id === req.person_id; })[0] || null,
      target_role: req.target_role_id ? byId(store.roles, 'role_id', req.target_role_id) : (req.target_mandate_id ? (function () { var m = byId(store.mandates, 'mandate_id', req.target_mandate_id); return m ? byId(store.roles, 'role_id', m.role_id) : null; })() : null)
    };
  }
  function getRequests(store) {
    store = ensure(store || OF.load());
    return store.pr_requests.slice().sort(function (a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); })
      .map(function (r) { return getRequest(r.request_id, store); });
  }
  function deleteRequest(requestId, store) {
    store = ensure(store || OF.load());
    var req = byId(store.pr_requests, 'request_id', requestId);
    store.pr_sources = store.pr_sources.filter(function (s) { return s.request_id !== requestId; });
    store.pr_requests = store.pr_requests.filter(function (r) { return r.request_id !== requestId; });
    if (req) store.pr_screens = store.pr_screens.filter(function (s) { return s.person_id !== req.person_id; });
    OF.save(store);
  }
  // mandates a screen can target
  function targets(store) {
    store = ensure(store || OF.load());
    return (store.mandates || []).map(function (m) {
      var role = byId(store.roles, 'role_id', m.role_id);
      var org = byId(store.organizations, 'organization_id', m.organization_id);
      return { mandate_id: m.mandate_id, role_id: m.role_id, label: (role ? role.role_name : 'role') + ' · ' + (org ? org.organization_name : 'org') + ' · ' + m.lane_type };
    });
  }

  OF.personResearch = {
    REQ_STATUS: REQ_STATUS, SOURCE_TYPES: SOURCE_TYPES, PUB_SOURCE_STATUS: PUB_SOURCE_STATUS, NEXT_STEPS: NEXT_STEPS,
    LIVE_WEB_SEARCH: LIVE_WEB_SEARCH, LIVE_LINKEDIN_FETCH: LIVE_LINKEDIN_FETCH,
    ensure: ensure,
    startRequest: startRequest, pasteSource: pasteSource, addSourceSlot: addSourceSlot, ignoreSource: ignoreSource,
    generatePreliminary: generatePreliminary, buildResonanceScreen: buildResonanceScreen,
    getRequest: getRequest, getRequests: getRequests, deleteRequest: deleteRequest, targets: targets
  };
})();
