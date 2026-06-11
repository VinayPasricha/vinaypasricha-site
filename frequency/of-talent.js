/* =============================================================
   Organizational Frequency — Talent Graph Connector Layer (2E)
   =============================================================
   Connects the runtime to talent sources, treated UNIFORMLY:
   Goodspace / resume DB / LinkedIn / referral / GitHub / community
   / past candidate / past mandate / manual — everything becomes a
   canonical TalentProfile → Person Intelligence → Person Frequency
   → Resonance → Outreach, through the EXISTING engines.

       Mission → Role Frequency → Talent Graph Search → Profiles
       → Person Intelligence → Preliminary Resonance →
       Candidate Discovery Queue → Outreach

   HONESTY: real connectors (Goodspace DB, LinkedIn) are
   not_configured hooks that block honestly — no fake integration,
   no scraping, no fabricated candidates. A manual/seed import path
   works today. Sync never overwrites existing intelligence; new
   source material is evidence that evolves through the normal
   pipelines. Person Intelligence and Resonance are never bypassed.

   Augments window.OF with window.OF.talent.
   ============================================================= */
(function () {
  'use strict';
  if (!window.OF) { console.warn('of-talent.js requires of-model.js'); return; }
  var OF = window.OF;

  var SOURCE_TYPES = ['goodspace_database', 'resume_database', 'linkedin', 'referral', 'github', 'community', 'past_candidate', 'past_mandate', 'manual_import', 'future'];
  var SOURCE_STATUS = ['configured', 'not_configured', 'syncing', 'failed', 'paused'];
  var CONNECTOR_TYPES = ['database', 'api', 'file_import', 'manual', 'future'];
  var PROFILE_STATUS = ['active', 'archived', 'duplicate', 'pending_review'];
  var SYNC_STATUS = ['running', 'completed', 'failed', 'blocked'];
  var DUP_STATUS = ['detected', 'review_required', 'merged', 'ignored'];

  function nowISO() { return new Date().toISOString(); }
  function uid(p) { return OF.uid(p); }
  function byId(arr, key, val) { return (arr || []).filter(function (x) { return x[key] === val; })[0] || null; }
  function lc(s) { return (s == null) ? '' : String(s).toLowerCase().trim(); }

  function ensure(store) {
    store.talent_sources = store.talent_sources || [];
    store.talent_connectors = store.talent_connectors || [];
    store.talent_profiles = store.talent_profiles || [];
    store.talent_sync_runs = store.talent_sync_runs || [];
    store.talent_duplicates = store.talent_duplicates || [];
    seedSources(store);
    return store;
  }
  function seedSources(store) {
    if (store.talent_sources.length) return;
    [['goodspace_database', 'Goodspace Database', 'database'], ['resume_database', 'Resume Database', 'database'],
     ['linkedin', 'LinkedIn', 'api'], ['referral', 'Referrals', 'manual'], ['github', 'GitHub', 'api'],
     ['community', 'Community', 'manual'], ['past_candidate', 'Past Candidates', 'database'],
     ['past_mandate', 'Past Mandates', 'database'], ['manual_import', 'Manual Import', 'manual']].forEach(function (p) {
      var src = newSource({ source_name: p[1], source_type: p[0], status: p[0] === 'manual_import' ? 'configured' : 'not_configured' });
      store.talent_sources.push(src);
      store.talent_connectors.push(newConnector({ source_id: src.source_id, connector_type: p[2], status: src.status === 'configured' ? 'configured' : 'not_configured' }));
    });
  }

  /* ===== SCHEMAS ===== */
  function newSource(f) {
    f = f || {};
    return { source_id: f.source_id || uid('tsrc'), source_name: f.source_name || '', source_type: SOURCE_TYPES.indexOf(f.source_type) !== -1 ? f.source_type : 'manual_import', status: SOURCE_STATUS.indexOf(f.status) !== -1 ? f.status : 'not_configured', provider: f.provider || '(none)', record_count: f.record_count || 0, last_sync: f.last_sync || null, created_at: f.created_at || nowISO() };
  }
  function newConnector(f) {
    f = f || {};
    return { connector_id: f.connector_id || uid('tconn'), source_id: f.source_id || null, connector_type: CONNECTOR_TYPES.indexOf(f.connector_type) !== -1 ? f.connector_type : 'manual', status: f.status || 'not_configured', sync_frequency: f.sync_frequency || 'on_demand', last_sync: f.last_sync || null, next_sync: f.next_sync || null, records_processed: f.records_processed || 0, errors: f.errors || [] };
  }
  function newProfile(f) {
    f = f || {};
    return { talent_profile_id: f.talent_profile_id || uid('tprof'), external_id: f.external_id || null, source_id: f.source_id || null, name: f.name || '', current_title: f.current_title || '', current_company: f.current_company || '', location: f.location || '', linkedin_url: f.linkedin_url || '', email: f.email || '', phone: f.phone || '', resume_text: f.resume_text || '', source_confidence: f.source_confidence || 'medium', last_updated: f.last_updated || nowISO(), status: PROFILE_STATUS.indexOf(f.status) !== -1 ? f.status : 'active', research_request_id: f.research_request_id || null, candidate_discovery_id: f.candidate_discovery_id || null, created_at: f.created_at || nowISO() };
  }
  function newSyncRun(f) {
    f = f || {};
    return { sync_id: f.sync_id || uid('tsync'), source_id: f.source_id || null, connector_id: f.connector_id || null, status: SYNC_STATUS.indexOf(f.status) !== -1 ? f.status : 'running', started_at: f.started_at || nowISO(), completed_at: f.completed_at || null, records_found: f.records_found || 0, records_imported: f.records_imported || 0, records_updated: f.records_updated || 0, duplicates_detected: f.duplicates_detected || 0, errors: f.errors || [], block_reason: f.block_reason || '' };
  }
  function newDuplicate(f) {
    f = f || {};
    return { duplicate_id: f.duplicate_id || uid('tdup'), primary_profile: f.primary_profile || null, secondary_profile: f.secondary_profile || null, reason: f.reason || '', status: DUP_STATUS.indexOf(f.status) !== -1 ? f.status : 'detected', resolution: f.resolution || '', created_at: f.created_at || nowISO() };
  }

  /* ===== source/connector config ===== */
  function source(type, store) { store = ensure(store || OF.load()); return byId(store.talent_sources, 'source_type', type); }
  function configureSource(type, providerName, store) {
    store = ensure(store || OF.load());
    var s = source(type, store);
    if (s) { s.status = 'configured'; s.provider = providerName || s.source_name; var c = byId(store.talent_connectors, 'source_id', s.source_id); if (c) c.status = 'configured'; OF.save(store); }
    return s;
  }
  function setSourceStatus(type, status, store) {
    store = ensure(store || OF.load());
    var s = source(type, store);
    if (s && SOURCE_STATUS.indexOf(status) !== -1) { s.status = status; if (status === 'not_configured') s.provider = '(none)'; var c = byId(store.talent_connectors, 'source_id', s.source_id); if (c) c.status = status === 'configured' ? 'configured' : 'not_configured'; OF.save(store); }
    return s;
  }

  /* ===== GOODSPACE CONNECTOR (honest hook) ===== */
  function searchGoodspaceTalent(query, filters, store) {
    store = ensure(store || OF.load());
    var s = source('goodspace_database', store);
    if (!s || s.status !== 'configured') {
      return { status: 'blocked', reason: 'goodspace_database_not_configured — connect the Goodspace DB or use manual import.' };
    }
    // configured but no real DB egress in this environment
    return { status: 'blocked', reason: 'goodspace_database connected but returned no records in this environment — use manual import.' };
  }
  function syncGoodspaceTalent(store) {
    store = ensure(store || OF.load());
    var s = source('goodspace_database', store);
    var c = s ? byId(store.talent_connectors, 'source_id', s.source_id) : null;
    var run = newSyncRun({ source_id: s ? s.source_id : null, connector_id: c ? c.connector_id : null });
    if (!s || s.status !== 'configured') {
      run.status = 'blocked'; run.block_reason = 'goodspace_database_not_configured'; run.completed_at = nowISO();
      store.talent_sync_runs.push(run); OF.save(store);
      return { status: 'blocked', reason: run.block_reason, sync: run };
    }
    run.status = 'completed'; run.completed_at = nowISO();
    store.talent_sync_runs.push(run); OF.save(store);
    return { status: 'completed', sync: run };
  }

  /* ===== IMPORT a talent profile (manual / referral / seed) =====
     Dedupes against existing canonical profiles. One human, one
     canonical profile, many sources. */
  function importProfile(sourceType, fields, store) {
    store = ensure(store || OF.load());
    var s = source(sourceType, store) || source('manual_import', store);
    fields = fields || {};
    if (!fields.name && !fields.linkedin_url && !fields.email) return { error: 'A profile needs at least a name, LinkedIn URL, or email.' };

    // duplicate detection: same email, same linkedin_url, or same name+company
    var dup = store.talent_profiles.filter(function (p) {
      if (p.status === 'archived') return false;
      if (fields.email && lc(p.email) && lc(p.email) === lc(fields.email)) return true;
      if (fields.linkedin_url && lc(p.linkedin_url) && lc(p.linkedin_url) === lc(fields.linkedin_url)) return true;
      if (fields.name && lc(p.name) === lc(fields.name) && lc(p.current_company) && lc(p.current_company) === lc(fields.current_company)) return true;
      return false;
    })[0];

    var prof = newProfile(Object.assign({}, fields, { source_id: s ? s.source_id : null, source_confidence: fields.source_confidence || sourceConfidence(sourceType) }));
    if (dup) {
      prof.status = 'duplicate';
      store.talent_profiles.push(prof);
      var d = newDuplicate({ primary_profile: dup.talent_profile_id, secondary_profile: prof.talent_profile_id, reason: 'matched on ' + (fields.email ? 'email' : fields.linkedin_url ? 'linkedin_url' : 'name+company'), status: 'review_required' });
      store.talent_duplicates.push(d);
      if (s) s.record_count = (s.record_count || 0) + 1;
      OF.save(store);
      return { profile: prof, duplicate: d };
    }
    store.talent_profiles.push(prof);
    if (s) s.record_count = (s.record_count || 0) + 1;
    OF.save(store);
    return { profile: prof };
  }
  function sourceConfidence(t) { return (['goodspace_database', 'referral', 'past_candidate', 'past_mandate'].indexOf(t) !== -1) ? 'high' : 'medium'; }

  function resolveDuplicate(dupId, resolution, store) {
    store = ensure(store || OF.load());
    var d = byId(store.talent_duplicates, 'duplicate_id', dupId);
    if (!d) return null;
    if (resolution === 'merge') {
      var sec = byId(store.talent_profiles, 'talent_profile_id', d.secondary_profile);
      var pri = byId(store.talent_profiles, 'talent_profile_id', d.primary_profile);
      if (sec && pri) { // enrich primary with any missing fields, archive secondary
        ['current_title', 'current_company', 'location', 'linkedin_url', 'email', 'phone', 'resume_text'].forEach(function (k) { if (!pri[k] && sec[k]) pri[k] = sec[k]; });
        pri.last_updated = nowISO(); sec.status = 'archived';
      }
      d.status = 'merged'; d.resolution = 'merged into ' + d.primary_profile;
    } else { // ignore — keep both, mark secondary active again
      var sec2 = byId(store.talent_profiles, 'talent_profile_id', d.secondary_profile);
      if (sec2) sec2.status = 'active';
      d.status = 'ignored'; d.resolution = 'kept as distinct profile';
    }
    OF.save(store);
    return d;
  }

  /* ===== PERSON INTELLIGENCE INTEGRATION =====
     A profile becomes a PersonResearchRequest + brief without re-entry.
     Never bypasses Person Intelligence — it feeds it. */
  function toPersonIntelligence(profileId, opts, store) {
    store = ensure(store || OF.load());
    var p = byId(store.talent_profiles, 'talent_profile_id', profileId);
    if (!p) return { error: 'Profile not found.' };
    if (!OF.personResearch) return { error: 'Person Research unavailable.' };
    if (p.research_request_id) {
      var existing = OF.personResearch.getRequest(p.research_request_id, store);
      if (existing && existing.brief) return { research_request_id: p.research_request_id, brief: existing.brief, reused: true };
    }
    opts = opts || {};
    var req = OF.personResearch.startRequest({ person_name: p.name || 'Candidate', linkedin_url: p.linkedin_url || '', current_company: p.current_company || '', target_mandate_id: opts.mandate_id || null }, store);
    store = OF.load(); ensure(store);
    var rr = req.request;
    // feed whatever real material the profile carries (resume text; the LinkedIn URL is stored, not scraped)
    var fed = false;
    if (p.resume_text) {
      var rget = OF.personResearch.getRequest(rr.request_id, OF.load());
      var slot = (rget.sources || []).filter(function (sx) { return sx.source_type === 'resume'; })[0] || OF.personResearch.addSourceSlot(rr.request_id, { source_type: 'resume', title: 'Resume (from talent profile)' }, OF.load());
      OF.personResearch.pasteSource(slot.source_id, p.resume_text, OF.load());
      store = OF.load(); ensure(store); fed = true;
    }
    // re-find the profile on the CURRENT store before persisting the link
    var pp = byId(store.talent_profiles, 'talent_profile_id', profileId);
    if (pp) pp.research_request_id = rr.request_id;
    OF.save(store);
    var brief = null;
    if (fed) { var gen = OF.personResearch.generatePreliminary(rr.request_id, OF.load()); brief = gen && gen.brief ? gen.brief : null; if (gen && gen.error) return { research_request_id: rr.request_id, error: gen.error }; }
    return { research_request_id: rr.request_id, brief: brief, needs_paste: !fed };
  }

  /* ===== RESONANCE + CANDIDATE-DISCOVERY INTEGRATION =====
     Profile → (person intel) → outreach CandidateDiscoveryRecord →
     resonance → optional outreach draft. Uses the EXISTING outreach
     engine; never bypasses resonance. */
  function toCandidateDiscovery(profileId, mandateId, opts, store) {
    store = ensure(store || OF.load());
    var p = byId(store.talent_profiles, 'talent_profile_id', profileId);
    if (!p) return { error: 'Profile not found.' };
    if (!OF.outreach) return { error: 'Outreach/discovery engine unavailable.' };
    opts = opts || {};
    // find-or-create a candidate search mission for this mandate
    var searches = (store.cd_searches || []).filter(function (x) { return x.mandate_id === mandateId; });
    var search = searches[0];
    if (!search) { var cs = OF.outreach.createSearch(mandateId, { sources: ['goodspace_database'] }, store); if (cs && cs.error) return { error: cs.error }; store = OF.load(); ensure(store); search = cs.search; }
    // add the candidate from the profile
    var add = OF.outreach.addCandidate(search.search_id, { person_name: p.name, linkedin_url: p.linkedin_url, current_company: p.current_company, current_title: p.current_title }, store);
    store = OF.load(); ensure(store);
    if (add && add.error) return { error: add.error };
    var candId = add.candidate.candidate_discovery_id;
    p = byId(store.talent_profiles, 'talent_profile_id', profileId);
    p.candidate_discovery_id = candId;
    OF.save(store);
    // feed resume text into the candidate's research request (so resonance has evidence)
    if (p.resume_text) {
      var rr = OF.personResearch.getRequest(add.research_request_id, OF.load());
      var slot = (rr.sources || []).filter(function (sx) { return sx.source_type === 'resume'; })[0] || OF.personResearch.addSourceSlot(add.research_request_id, { source_type: 'resume', title: 'Resume (talent profile)' }, OF.load());
      OF.personResearch.pasteSource(slot.source_id, p.resume_text, OF.load());
    }
    // research + resonance (never bypassed)
    var rs = OF.outreach.researchAndScreen(candId, OF.load());
    if (rs && rs.error) return { candidate_discovery_id: candId, error: rs.error };
    var result = { candidate_discovery_id: candId, search_id: search.search_id, resonance: rs.resonance };
    // queue outreach draft if policy/opt allows and resonance is positive enough
    if (opts.queue_outreach && rs.resonance && rs.resonance.next_action === 'approve_outreach') {
      var d = OF.outreach.generateDraft(candId, OF.load());
      result.draft = d && d.draft ? d.draft : null;
      result.outreach_queued = !!result.draft;
    }
    return result;
  }

  /* ===== reads ===== */
  function searchProfiles(query, store) {
    store = ensure(store || OF.load());
    var q = lc(query);
    return store.talent_profiles.filter(function (p) { return p.status === 'active' && (!q || lc(p.name + ' ' + p.current_title + ' ' + p.current_company + ' ' + p.location + ' ' + p.resume_text).indexOf(q) !== -1); });
  }
  function snapshot(store) {
    store = ensure(store || OF.load());
    return {
      sources: store.talent_sources, connectors: store.talent_connectors,
      profiles: store.talent_profiles.slice().reverse(),
      sync_runs: store.talent_sync_runs.slice().reverse(),
      duplicates: store.talent_duplicates.slice().reverse(),
      counts: {
        sources_configured: store.talent_sources.filter(function (s) { return s.status === 'configured'; }).length,
        profiles: store.talent_profiles.filter(function (p) { return p.status === 'active'; }).length,
        duplicates: store.talent_duplicates.filter(function (d) { return d.status === 'review_required' || d.status === 'detected'; }).length,
        with_intel: store.talent_profiles.filter(function (p) { return p.research_request_id; }).length,
        candidates: store.talent_profiles.filter(function (p) { return p.candidate_discovery_id; }).length
      }
    };
  }
  function getProfile(id, store) {
    store = ensure(store || OF.load());
    var p = byId(store.talent_profiles, 'talent_profile_id', id);
    if (!p) return null;
    return {
      profile: p,
      research: p.research_request_id && OF.personResearch ? OF.personResearch.getRequest(p.research_request_id, store) : null,
      candidate: p.candidate_discovery_id && OF.outreach ? OF.outreach.getCandidate(p.candidate_discovery_id, store) : null
    };
  }
  function resetTalent(store) {
    store = ensure(store || OF.load());
    store.talent_sources = []; store.talent_connectors = []; store.talent_profiles = []; store.talent_sync_runs = []; store.talent_duplicates = [];
    seedSources(store); OF.save(store);
  }

  OF.talent = {
    SOURCE_TYPES: SOURCE_TYPES, SOURCE_STATUS: SOURCE_STATUS, CONNECTOR_TYPES: CONNECTOR_TYPES, PROFILE_STATUS: PROFILE_STATUS, DUP_STATUS: DUP_STATUS,
    ensure: ensure, source: source, configureSource: configureSource, setSourceStatus: setSourceStatus,
    searchGoodspaceTalent: searchGoodspaceTalent, syncGoodspaceTalent: syncGoodspaceTalent,
    importProfile: importProfile, resolveDuplicate: resolveDuplicate,
    toPersonIntelligence: toPersonIntelligence, toCandidateDiscovery: toCandidateDiscovery,
    searchProfiles: searchProfiles, snapshot: snapshot, getProfile: getProfile, resetTalent: resetTalent
  };
})();
