/* =============================================================
   Organizational Frequency — Real Search Layer  (Build 2D)
   =============================================================
   Gives agents real search capability OR honest provider hooks.
   The search layer FINDS and IMPORTS evidence; it does NOT
   interpret meaning — the intelligence runtimes do that.

       Org Discovery Agent → Search → Org Sources → OF.intel
       Candidate Disc. Agent → Search → Person Sources → OF.personResearch

   HONESTY: no provider configured → search blocks (provider_not_
   configured), never fabricated results. LinkedIn is never scraped
   (URL stored, profile text pasted). Manual import works today and
   is the launch fallback. Every search attempt is audited.

   Augments window.OF with window.OF.search.
   ============================================================= */
(function () {
  'use strict';
  if (!window.OF) { console.warn('of-search.js requires of-model.js'); return; }
  var OF = window.OF;

  var PROVIDER_TYPES = ['web_search', 'google_custom_search', 'brave_search', 'serpapi', 'tavily', 'linkedin_provider', 'github_search', 'goodspace_database', 'manual_import'];
  var PROVIDER_STATUS = ['configured', 'not_configured', 'blocked', 'failed'];
  var MISSION_TYPES = ['organization_discovery', 'candidate_discovery', 'role_research', 'market_research', 'company_news', 'leadership_research', 'article_discovery', 'social_post_discovery'];
  var MISSION_STATUS = ['draft', 'queued', 'running', 'completed', 'blocked', 'failed', 'needs_review'];
  var SOURCE_TYPES = ['company_website', 'careers_page', 'job_description', 'linkedin_profile', 'linkedin_post', 'github_profile', 'portfolio', 'article', 'press', 'news', 'podcast', 'youtube', 'glassdoor', 'ambitionbox', 'resume', 'other'];
  var ARTIFACT_STATUS = ['found', 'retrieved', 'manual_paste_required', 'blocked', 'ignored', 'failed', 'needs_review'];
  var USED_FOR = ['organization_intelligence', 'person_intelligence', 'role_research', 'market_context', 'validation_question_generation'];

  // map search source_type → OF.intel source_type (org side)
  var TO_INTEL = { company_website: 'website', careers_page: 'careers_page', job_description: 'job_description', linkedin_profile: 'linkedin', linkedin_post: 'linkedin', article: 'article', press: 'press', news: 'news', glassdoor: 'glassdoor', ambitionbox: 'ambitionbox', podcast: 'blog', youtube: 'blog', portfolio: 'other', github_profile: 'other', resume: 'other', other: 'other' };
  // map → OF.personResearch source_type (person side)
  var TO_PR = { linkedin_profile: 'linkedin_profile', linkedin_post: 'linkedin_post', resume: 'resume', portfolio: 'portfolio', github_profile: 'github', article: 'article', press: 'press', podcast: 'podcast', youtube: 'youtube', company_website: 'personal_website', other: 'other' };

  function nowISO() { return new Date().toISOString(); }
  function uid(p) { return OF.uid(p); }
  function byId(arr, key, val) { return (arr || []).filter(function (x) { return x[key] === val; })[0] || null; }

  function ensure(store) {
    store.search_providers = store.search_providers || [];
    store.search_missions = store.search_missions || [];
    store.search_artifacts = store.search_artifacts || [];
    store.search_import_batches = store.search_import_batches || [];
    store.search_audit_log = store.search_audit_log || [];
    seedProviders(store);
    return store;
  }
  function seedProviders(store) {
    if (store.search_providers.length) return;
    PROVIDER_TYPES.forEach(function (t) {
      store.search_providers.push(newProvider({
        provider_name: label(t), provider_type: t,
        status: t === 'manual_import' ? 'configured' : 'not_configured',  // manual import works today
        rate_limit: '—', daily_limit: t === 'manual_import' ? 0 : 100
      }));
    });
  }

  /* ===== SCHEMAS ===== */
  function newProvider(f) {
    f = f || {};
    return { provider_id: f.provider_id || uid('sprov'), provider_name: f.provider_name || '', provider_type: PROVIDER_TYPES.indexOf(f.provider_type) !== -1 ? f.provider_type : 'web_search', status: PROVIDER_STATUS.indexOf(f.status) !== -1 ? f.status : 'not_configured', configuration: f.configuration || {}, rate_limit: f.rate_limit || '—', daily_limit: f.daily_limit || 0, created_at: f.created_at || nowISO() };
  }
  function newMission(f) {
    f = f || {};
    return { search_mission_id: f.search_mission_id || uid('smsn'), mission_type: MISSION_TYPES.indexOf(f.mission_type) !== -1 ? f.mission_type : 'organization_discovery', agent_id: f.agent_id || null, target_object_type: f.target_object_type || '', target_object_id: f.target_object_id || null, queries: f.queries || [], query: f.query || '', filters: f.filters || {}, status: MISSION_STATUS.indexOf(f.status) !== -1 ? f.status : 'draft', provider_used: f.provider_used || null, block_reason: f.block_reason || '', created_at: f.created_at || nowISO(), updated_at: nowISO() };
  }
  function newArtifact(f) {
    f = f || {};
    return { artifact_id: f.artifact_id || uid('sart'), search_mission_id: f.search_mission_id || null, source_type: SOURCE_TYPES.indexOf(f.source_type) !== -1 ? f.source_type : 'other', title: f.title || '', url: f.url || '', snippet: f.snippet || '', raw_text: f.raw_text || '', provider: f.provider || 'manual_import', retrieved_at: f.retrieved_at || null, status: ARTIFACT_STATUS.indexOf(f.status) !== -1 ? f.status : 'found', confidence: f.confidence || 'low', used_for: f.used_for || null, created_at: f.created_at || nowISO() };
  }
  function newBatch(f) { f = f || {}; return { batch_id: f.batch_id || uid('sbatch'), search_mission_id: f.search_mission_id || null, artifacts: f.artifacts || [], import_status: f.import_status || 'open', created_at: f.created_at || nowISO(), updated_at: nowISO() }; }
  function newAudit(f) { f = f || {}; return { log_id: f.log_id || uid('saud'), search_mission_id: f.search_mission_id || null, provider: f.provider || '(none)', action: f.action || '', status: f.status || '', reason: f.reason || '', created_at: f.created_at || nowISO() }; }

  /* ===== provider config ===== */
  function provider(type, store) { store = ensure(store || OF.load()); return byId(store.search_providers, 'provider_type', type); }
  function isConfigured(type, store) { var p = provider(type, store); return p && p.status === 'configured'; }
  function configureProvider(type, name, store) { store = ensure(store || OF.load()); var p = provider(type, store); if (p) { p.status = 'configured'; p.provider_name = name || label(type); p.configuration = { wired: true }; OF.save(store); } return p; }
  function setProviderStatus(type, status, store) { store = ensure(store || OF.load()); var p = provider(type, store); if (p && PROVIDER_STATUS.indexOf(status) !== -1) { p.status = status; if (status === 'not_configured') p.configuration = {}; OF.save(store); } return p; }
  function audit(store, missionId, providerName, action, status, reason) { store.search_audit_log.push(newAudit({ search_mission_id: missionId, provider: providerName, action: action, status: status, reason: reason })); }

  /* ===== QUERY GENERATION ===== */
  function orgQueries(name) {
    name = name || 'the company';
    return [name + ' leadership', name + ' careers', name + ' jobs', name + ' founder interview', name + ' employee reviews', name + ' news', name + ' about'];
  }
  function candidateQueries(ctx) {
    ctx = ctx || {};
    var role = ctx.role_title || 'role', ind = ctx.industry || '', loc = ctx.location || '', skill = ctx.skill || '';
    var qs = [];
    qs.push((role + ' ' + ind + ' ' + loc).trim() + ' LinkedIn');
    if (skill) qs.push((skill + ' ' + role + ' LinkedIn').trim());
    qs.push((role + ' GitHub portfolio').trim());
    if (ctx.person_name) { qs.push(ctx.person_name + ' LinkedIn'); qs.push(ctx.person_name + ' articles'); }
    return qs.filter(Boolean);
  }

  /* ===== CREATE MISSIONS ===== */
  function createOrgSearch(fields, store) {
    store = ensure(store || OF.load());
    fields = fields || {};
    var m = newMission({ mission_type: 'organization_discovery', target_object_type: 'organization', target_object_id: fields.organization_id || null, agent_id: fields.agent_id || null, queries: orgQueries(fields.company_name), query: (fields.company_name || '') + ' discovery', filters: { industry: fields.industry || '', website: fields.website || '' } });
    m._company_name = fields.company_name || '';
    store.search_missions.push(m);
    audit(store, m.search_mission_id, 'query_generator', 'generate_queries', 'completed', m.queries.length + ' org queries');
    OF.save(store);
    return m;
  }
  function createCandidateSearch(fields, store) {
    store = ensure(store || OF.load());
    fields = fields || {};
    var m = newMission({ mission_type: 'candidate_discovery', target_object_type: fields.mandate_id ? 'mandate' : 'role', target_object_id: fields.mandate_id || fields.role_id || null, agent_id: fields.agent_id || null, queries: candidateQueries(fields), query: (fields.role_title || 'candidate') + ' discovery', filters: { industry: fields.industry || '', location: fields.location || '', role_title: fields.role_title || '', person_name: fields.person_name || '' } });
    store.search_missions.push(m);
    audit(store, m.search_mission_id, 'query_generator', 'generate_queries', 'completed', m.queries.length + ' candidate queries');
    OF.save(store);
    return m;
  }

  /* ===== RUN SEARCH — honest provider interface ===== */
  function runSearch(missionId, store) {
    store = ensure(store || OF.load());
    var m = byId(store.search_missions, 'search_mission_id', missionId);
    if (!m) return { error: 'Search mission not found.' };
    // pick the provider this mission would use
    var pType = m.mission_type === 'candidate_discovery' ? 'linkedin_provider' : 'web_search';
    m.provider_used = pType;
    if (!isConfigured(pType, store)) {
      m.status = 'blocked'; m.block_reason = pType + '_not_configured — no live search provider. Use manual import.'; m.updated_at = nowISO();
      audit(store, missionId, label(pType), 'run_search', 'blocked', m.block_reason);
      OF.save(store);
      return { status: 'blocked', reason: m.block_reason };
    }
    // provider configured but this prototype has no real network egress → honest no-result
    m.status = 'needs_review'; m.updated_at = nowISO();
    audit(store, missionId, label(pType), 'run_search', 'needs_review', 'provider configured but returned no result in this environment — use manual import.');
    OF.save(store);
    return { status: 'needs_review', reason: 'Provider configured but no result in this environment; import manually.' };
  }

  /* ===== MANUAL IMPORT — works today (launch fallback) ===== */
  function manualImport(missionId, fields, store) {
    store = ensure(store || OF.load());
    var m = byId(store.search_missions, 'search_mission_id', missionId);
    if (!m) return { error: 'Search mission not found.' };
    fields = fields || {};
    if (!fields.raw_text && !fields.url) return { error: 'Paste the source text or a URL.' };
    var a = newArtifact({ search_mission_id: missionId, source_type: fields.source_type || 'other', title: fields.title || '', url: fields.url || '', snippet: (fields.raw_text || '').slice(0, 120), raw_text: fields.raw_text || '', status: 'retrieved', confidence: 'medium', retrieved_at: nowISO() });
    store.search_artifacts.push(a);
    if (m.status === 'draft' || m.status === 'blocked' || m.status === 'needs_review') { m.status = 'completed'; m.updated_at = nowISO(); }
    audit(store, missionId, 'manual_import', 'import_artifact', 'completed', a.source_type + ' artifact');
    OF.save(store);
    return { artifact: a };
  }
  function ignoreArtifact(artifactId, store) { store = ensure(store || OF.load()); var a = byId(store.search_artifacts, 'artifact_id', artifactId); if (a) { a.status = 'ignored'; OF.save(store); } return a; }

  /* ===== FEED ARTIFACTS INTO INTELLIGENCE ENGINES =====
     Search finds; intelligence interprets. We hand artifacts to the
     existing runtimes; we never interpret here. */
  function sendToOrgIntelligence(missionId, store) {
    store = ensure(store || OF.load());
    var m = byId(store.search_missions, 'search_mission_id', missionId);
    if (!m || !OF.intel) return { error: 'Mission or Organization Intelligence unavailable.' };
    var arts = store.search_artifacts.filter(function (a) { return a.search_mission_id === missionId && a.status === 'retrieved'; });
    if (!arts.length) return { error: 'No retrieved artifacts to send. Import some first.' };
    // ensure an organization exists to attach to
    var orgId = m.target_object_id;
    if (!orgId) {
      var org = OF.intel.ensure ? null : null;
      // create a lightweight organization via the model if needed
      var s2 = store; s2.organizations = s2.organizations || [];
      var existing = byId(s2.organizations, 'organization_name', m._company_name);
      if (existing) orgId = existing.organization_id;
      else { var no = { organization_id: uid('org'), organization_name: m._company_name || 'Discovered org', research_status: 'tier0', created_at: nowISO(), updated_at: nowISO() }; s2.organizations.push(no); orgId = no.organization_id; }
      m.target_object_id = orgId;
    }
    var batch = newBatch({ search_mission_id: missionId, artifacts: arts.map(function (a) { return a.artifact_id; }), import_status: 'sent_to_org_intelligence' });
    store.search_import_batches.push(batch); OF.save(store);
    arts.forEach(function (a) {
      OF.intel.addSource(orgId, { source_type: TO_INTEL[a.source_type] || 'other', title: a.title || a.source_type, url: a.url, text: a.raw_text }, store);
      store = OF.load(); ensure(store);
      var aa = byId(store.search_artifacts, 'artifact_id', a.artifact_id); if (aa) aa.used_for = 'organization_intelligence';
    });
    audit(store, missionId, 'manual_import', 'send_to_org_intelligence', 'completed', arts.length + ' artifacts → OF.intel (' + orgId + ')');
    OF.save(store);
    var brief = OF.intel.generateBrief(orgId, OF.load());
    return { organization_id: orgId, artifacts: arts.length, brief: brief && brief.brief ? brief.brief : null };
  }

  function sendToPersonIntelligence(missionId, opts, store) {
    store = ensure(store || OF.load());
    var m = byId(store.search_missions, 'search_mission_id', missionId);
    if (!m || !OF.personResearch) return { error: 'Mission or Person Research unavailable.' };
    var arts = store.search_artifacts.filter(function (a) { return a.search_mission_id === missionId && a.status === 'retrieved'; });
    if (!arts.length) return { error: 'No retrieved artifacts to send. Import some first.' };
    opts = opts || {};
    // open a person research request (honest LinkedIn-URL handling lives there)
    var li = arts.filter(function (a) { return a.source_type === 'linkedin_profile'; })[0];
    var req = OF.personResearch.startRequest({ person_name: opts.person_name || m.filters.person_name || 'Candidate', linkedin_url: (li && li.url) || '', current_company: opts.company || '', target_mandate_id: (m.target_object_type === 'mandate' ? m.target_object_id : null) }, store);
    store = OF.load(); ensure(store);
    var personReq = req.request;
    var batch = newBatch({ search_mission_id: missionId, artifacts: arts.map(function (a) { return a.artifact_id; }), import_status: 'sent_to_person_intelligence' });
    store.search_import_batches.push(batch); OF.save(store);
    // paste each artifact into the matching research source slot
    arts.forEach(function (a) {
      var rr = OF.personResearch.getRequest(personReq.request_id, OF.load());
      var prType = TO_PR[a.source_type] || 'other';
      var slot = rr.sources.filter(function (sx) { return sx.source_type === prType && sx.status !== 'manual_paste'; })[0];
      if (!slot) slot = OF.personResearch.addSourceSlot(personReq.request_id, { source_type: prType, title: a.title || a.source_type }, OF.load());
      OF.personResearch.pasteSource(slot.source_id, a.raw_text, OF.load());
      store = OF.load(); ensure(store);
      var aa = byId(store.search_artifacts, 'artifact_id', a.artifact_id); if (aa) aa.used_for = 'person_intelligence';
    });
    audit(store, missionId, 'manual_import', 'send_to_person_intelligence', 'completed', arts.length + ' artifacts → OF.personResearch (' + personReq.request_id + ')');
    OF.save(store);
    var gen = OF.personResearch.generatePreliminary(personReq.request_id, OF.load());
    return { research_request_id: personReq.request_id, artifacts: arts.length, brief: gen && gen.brief ? gen.brief : null, error: gen && gen.error };
  }

  /* ===== reads ===== */
  function snapshot(store) {
    store = ensure(store || OF.load());
    return {
      providers: store.search_providers,
      missions: store.search_missions.slice().reverse(),
      artifacts: store.search_artifacts.slice().reverse(),
      batches: store.search_import_batches.slice().reverse(),
      audit: store.search_audit_log.slice().reverse(),
      counts: { missions: store.search_missions.length, blocked: store.search_missions.filter(function (m) { return m.status === 'blocked'; }).length, artifacts: store.search_artifacts.length, configured: store.search_providers.filter(function (p) { return p.status === 'configured'; }).length }
    };
  }
  function getMission(id, store) { store = ensure(store || OF.load()); var m = byId(store.search_missions, 'search_mission_id', id); if (!m) return null; return { mission: m, artifacts: store.search_artifacts.filter(function (a) { return a.search_mission_id === id; }) }; }
  function resetSearch(store) { store = ensure(store || OF.load()); store.search_providers = []; store.search_missions = []; store.search_artifacts = []; store.search_import_batches = []; store.search_audit_log = []; seedProviders(store); OF.save(store); }

  function label(t) { return ({ web_search: 'Public Web Search', google_custom_search: 'Google Custom Search', brave_search: 'Brave Search', serpapi: 'SerpAPI', tavily: 'Tavily', linkedin_provider: 'LinkedIn Provider', github_search: 'GitHub Search', goodspace_database: 'Goodspace Database', manual_import: 'Manual Import' })[t] || t; }

  OF.search = {
    PROVIDER_TYPES: PROVIDER_TYPES, PROVIDER_STATUS: PROVIDER_STATUS, MISSION_TYPES: MISSION_TYPES, SOURCE_TYPES: SOURCE_TYPES, USED_FOR: USED_FOR,
    ensure: ensure, provider: provider, isConfigured: isConfigured, configureProvider: configureProvider, setProviderStatus: setProviderStatus,
    orgQueries: orgQueries, candidateQueries: candidateQueries,
    createOrgSearch: createOrgSearch, createCandidateSearch: createCandidateSearch, runSearch: runSearch,
    manualImport: manualImport, ignoreArtifact: ignoreArtifact,
    sendToOrgIntelligence: sendToOrgIntelligence, sendToPersonIntelligence: sendToPersonIntelligence,
    snapshot: snapshot, getMission: getMission, resetSearch: resetSearch, label: label
  };
})();
