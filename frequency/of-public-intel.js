/* =============================================================
   Organizational Frequency — Public Organizational Intelligence
   Engine  (Build 3B · consumes the 3A Research Queue)
   =============================================================
   3A selected companies and queued them. 3B turns a queued
   company — given ONLY its URL — into a public, SEO-ready
   Organizational Frequency profile page built strictly from
   PUBLICLY AVAILABLE material.

       Research Queue (3A)
          ↓  Company URL only
       PublicCompanyResearch
          ↓  public research (live blocked; manual sources work)
       PublicSignal[]            (signal inventory)
          ↓
       PublicFrequencyEstimate   (12 dimensions, probabilistic)
          ↓
       PublicContradiction[]     (claim vs counter-signal)
          ↓
       PublicCompanyPage         (SEO: slug/title/meta/JSON-LD)
          ↓  status = ready_for_review  (never auto-published)

   HONESTY (matches the rest of OF):
     • No live web/search/social fetch. Starting research with no
       provider BLOCKS honestly and fabricates nothing.
     • Manual import of public source text is the working path.
     • With only manual sources, the page is built and labelled
       "Based on limited public material."
     • The page is probabilistic by construction — "Public signals
       suggest…", "This remains unvalidated…". Never final truth,
       never numeric ratings, never defamatory.

   NOT in 3B: stakeholder outreach, emails, validation
   questionnaires, candidate discovery, resonance, hiring, or any
   automatic publishing.

   Augments window.OF with window.OF.pubintel.
   Depends on: of-model.js (store) + of-icp.js (research_queue).
   ============================================================= */
(function () {
  'use strict';
  if (!window.OF) { console.warn('of-public-intel.js requires of-model.js'); return; }
  var OF = window.OF;

  /* ===== controlled vocabularies ===== */
  var RESEARCH_STATUS = ['queued', 'researching', 'blocked', 'completed', 'failed'];
  var SOURCE_TYPES = [
    'company_website', 'careers_page', 'linkedin_company', 'linkedin_post', 'youtube',
    'instagram', 'facebook', 'x', 'news', 'press_release', 'interview', 'article',
    'job_post', 'employee_review', 'vendor_comment', 'customer_comment', 'public_database', 'manual_import'
  ];
  var SIGNAL_CATEGORIES = [
    'leadership', 'communication', 'execution', 'pressure', 'culture', 'talent_philosophy',
    'growth', 'autonomy', 'risk', 'stability', 'innovation', 'employee_experience',
    'hiring_pressure', 'contradiction', 'unknown'
  ];
  var DIMENSIONS = [
    'leadership_style', 'decision_making', 'communication_culture', 'execution_style',
    'pressure_environment', 'autonomy_level', 'collaboration_style', 'talent_philosophy',
    'growth_orientation', 'stability_vs_chaos', 'innovation_orientation', 'employee_flourishing'
  ];
  var DIM_LABELS = {
    leadership_style: 'Leadership Style', decision_making: 'Decision-Making',
    communication_culture: 'Communication Culture', execution_style: 'Execution Style',
    pressure_environment: 'Pressure Environment', autonomy_level: 'Autonomy Level',
    collaboration_style: 'Collaboration Style', talent_philosophy: 'Talent Philosophy',
    growth_orientation: 'Growth Orientation', stability_vs_chaos: 'Stability vs. Chaos',
    innovation_orientation: 'Innovation Orientation', employee_flourishing: 'Employee Flourishing'
  };
  var PAGE_STATUS = ['draft', 'ready_for_review', 'published', 'needs_revision'];
  var SEVERITY = ['minor', 'moderate', 'major'];

  // sources that speak the company's CLAIM vs its OBSERVED reality
  var CLAIM_SOURCES = ['company_website', 'careers_page', 'linkedin_company', 'linkedin_post', 'youtube', 'instagram', 'facebook', 'x', 'interview', 'press_release'];
  var OBSERVED_SOURCES = ['news', 'article', 'job_post', 'employee_review', 'vendor_comment', 'customer_comment', 'public_database'];

  /* ===== signal lexicon — cue → category + dimension + reading =====
     Each entry: the dimension it informs, a short descriptive level,
     the cues that match it, and an interpretation template. */
  var LEXICON = [
    { dim: 'pressure_environment', cat: 'pressure', level: 'high-intensity', polarity: 'intense',
      cues: ['long hours', 'overtime', 'burnout', 'pressure', 'peak', 'crunch', 'fast-paced', 'high-pressure', 'demanding', 'always on', 'tight deadlines', 'hustle'],
      interp: 'a high-intensity, deadline-driven environment, especially during peak cycles' },
    { dim: 'pressure_environment', cat: 'pressure', level: 'measured', polarity: 'calm',
      cues: ['work-life balance', 'sustainable pace', 'flexible hours', 'calm', 'relaxed', 'no overtime'],
      interp: 'a more measured, sustainable working pace' },
    { dim: 'execution_style', cat: 'execution', level: 'speed-led', polarity: 'fast',
      cues: ['speed', 'urgency', 'move fast', 'fast decisions', 'rapid', 'bias for action', 'ship', 'execution', 'get things done', 'velocity'],
      interp: 'a speed-led execution culture that prizes moving quickly' },
    { dim: 'execution_style', cat: 'execution', level: 'process-led', polarity: 'structured',
      cues: ['process', 'methodical', 'rigorous', 'structured', 'quality-first', 'careful', 'deliberate'],
      interp: 'a process-led, methodical approach to execution' },
    { dim: 'autonomy_level', cat: 'autonomy', level: 'high-autonomy', polarity: 'high',
      cues: ['ownership', 'autonomy', 'decentralization', 'decentralized', 'empowered', 'self-directed', 'independent', 'take ownership', 'own your', 'freedom'],
      interp: 'high individual autonomy and ownership' },
    { dim: 'autonomy_level', cat: 'autonomy', level: 'directed', polarity: 'low',
      cues: ['top-down', 'centralized', 'tightly managed', 'micromanage', 'strict oversight', 'command'],
      interp: 'a more directed, centrally-managed structure' },
    { dim: 'decision_making', cat: 'leadership', level: 'decentralized', polarity: 'distributed',
      cues: ['decentralization', 'decentralized', 'distributed decision', 'local decision', 'autonomy to decide', 'empowered to decide'],
      interp: 'decision-making pushed close to the work rather than held at the top' },
    { dim: 'decision_making', cat: 'leadership', level: 'founder-led', polarity: 'central',
      cues: ['founder-led', 'ceo decides', 'leadership decides', 'centralized decision', 'top-down decision'],
      interp: 'decision-making concentrated with founders or senior leadership' },
    { dim: 'leadership_style', cat: 'leadership', level: 'visible & directive', polarity: 'directive',
      cues: ['founder', 'ceo', 'leadership interview', 'leadership emphasiz', 'visionary', 'hands-on leadership', 'leadership team'],
      interp: 'visible, vision-driven leadership that sets direction openly' },
    { dim: 'communication_culture', cat: 'communication', level: 'open & direct', polarity: 'open',
      cues: ['transparent', 'open communication', 'candid', 'direct', 'honest feedback', 'open door'],
      interp: 'an open, direct communication style' },
    { dim: 'collaboration_style', cat: 'communication', level: 'collaborative', polarity: 'collaborative',
      cues: ['collaboration', 'cross-functional', 'teamwork', 'together', 'collaborative', 'team-first'],
      interp: 'a collaborative, cross-functional way of working' },
    { dim: 'talent_philosophy', cat: 'talent_philosophy', level: 'capacity-building', polarity: 'mixed',
      cues: ['customer obsession', 'customer-first', 'customer obsessed', 'meritocracy', 'high performers', 'A-players', 'talent density', 'learning', 'develop'],
      interp: 'a talent philosophy oriented around performance and customer outcomes' },
    { dim: 'growth_orientation', cat: 'growth', level: 'expansion-mode', polarity: 'growth',
      cues: ['expanding', 'expansion', 'fast-growing', 'scaling', 'growth', 'new market', 'opening', 'across', 'doubling', 'hypergrowth'],
      interp: 'an active expansion and growth posture' },
    { dim: 'stability_vs_chaos', cat: 'stability', level: 'fluid & changing', polarity: 'chaos',
      cues: ['fast-changing', 'chaos', 'ambiguity', 'shifting priorities', 'reactive', 'firefighting', 'evolving', 'startup'],
      interp: 'a fluid, fast-changing environment where priorities shift' },
    { dim: 'stability_vs_chaos', cat: 'stability', level: 'established', polarity: 'stable',
      cues: ['established', 'mature', 'stable', 'well-structured', 'long-standing', 'predictable'],
      interp: 'a relatively established and stable operating environment' },
    { dim: 'innovation_orientation', cat: 'innovation', level: 'innovation-forward', polarity: 'innovative',
      cues: ['innovation', 'innovative', 'r&d', 'cutting-edge', 'new product', 'experiment', 'pioneering', 'invent'],
      interp: 'an orientation toward innovation and new ideas' },
    { dim: 'employee_flourishing', cat: 'employee_experience', level: 'strained', polarity: 'negative',
      cues: ['long hours', 'burnout', 'attrition', 'turnover', 'stress', 'poor management', 'underpaid', 'toxic'],
      interp: 'possible strain on day-to-day employee experience' },
    { dim: 'employee_flourishing', cat: 'employee_experience', level: 'supported', polarity: 'positive',
      cues: ['great place to work', 'supportive', 'well-being', 'benefits', 'caring', 'people-first', 'inclusive'],
      interp: 'signals of a supportive employee experience' },
    { dim: 'talent_philosophy', cat: 'hiring_pressure', level: 'high hiring volume', polarity: 'mixed',
      cues: ['hiring', 'repeated hiring', 'job posts', 'open roles', 'recruiting', 'operations managers', 'warehouse supervisors', 'multiple roles'],
      interp: 'sustained hiring activity, suggesting either growth or churn' }
  ];

  /* dimension level vocab fallback */
  var DEFAULT_LEVEL = 'unclear from public signals';

  /* ===== helpers ===== */
  function nowISO() { return new Date().toISOString(); }
  function uid(p) { return OF.uid(p); }
  function byId(arr, key, val) { return (arr || []).filter(function (x) { return x[key] === val; })[0] || null; }
  function lc(s) { return (s == null ? '' : String(s)).toLowerCase(); }
  function titleish(s) { return String(s || '').replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }
  function host(url) {
    var m = String(url || '').replace(/^https?:\/\//i, '').replace(/^www\./i, '').split(/[\/?#]/)[0];
    return m || '';
  }
  function slugify(name) {
    return String(name || '').toLowerCase().trim()
      .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-+/g, '-');
  }
  function sentences(text) { return String(text || '').split(/(?<=[.!?])\s+/).map(function (s) { return s.trim(); }).filter(Boolean); }
  function firstSentenceWith(text, cue) {
    var ss = sentences(text);
    for (var i = 0; i < ss.length; i++) if (lc(ss[i]).indexOf(cue) !== -1) return ss[i];
    return (text || '').slice(0, 180).trim();
  }
  function sourceRank(t) { return OBSERVED_SOURCES.indexOf(t) !== -1 ? 'observed' : (CLAIM_SOURCES.indexOf(t) !== -1 ? 'claim' : 'other'); }

  function ensure(store) {
    store.pub_research = store.pub_research || [];
    store.pub_signals = store.pub_signals || [];
    store.pub_estimates = store.pub_estimates || [];
    store.pub_contradictions = store.pub_contradictions || [];
    store.pub_pages = store.pub_pages || [];
    store.pub_audit_log = store.pub_audit_log || [];
    return store;
  }
  function audit(store, object_type, ref, action, detail) {
    store.pub_audit_log.push({ log_id: uid('paud'), object_type: object_type, object_ref: ref, action: action, detail: detail || '', created_at: nowISO() });
  }

  /* ==========================================================
     SCHEMAS
     ========================================================== */
  function newResearch(f) {
    f = f || {};
    return {
      research_id: f.research_id || uid('pres'),
      candidate_id: f.candidate_id || null,
      company_name: f.company_name || '',
      website_url: f.website_url || '',
      discovered_domain: f.discovered_domain || '',
      discovered_linkedin: f.discovered_linkedin || '',
      discovered_careers_page: f.discovered_careers_page || '',
      discovered_social_links: f.discovered_social_links || [],
      discovered_leadership: f.discovered_leadership || [],
      discovered_news: f.discovered_news || [],
      discovered_videos: f.discovered_videos || [],
      discovered_reviews: f.discovered_reviews || [],
      discovered_job_posts: f.discovered_job_posts || [],
      source_inventory: f.source_inventory || [],   // [{source_type, source_url, source_title, added_at, origin}]
      status: RESEARCH_STATUS.indexOf(f.status) !== -1 ? f.status : 'queued',
      provider_note: f.provider_note || '',
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }
  function newSignal(f) {
    f = f || {};
    return {
      signal_id: f.signal_id || uid('psig'),
      research_id: f.research_id || null,
      company_name: f.company_name || '',
      source_type: SOURCE_TYPES.indexOf(f.source_type) !== -1 ? f.source_type : 'manual_import',
      source_url: f.source_url || '',
      source_title: f.source_title || '',
      raw_excerpt: f.raw_excerpt || '',
      signal_category: SIGNAL_CATEGORIES.indexOf(f.signal_category) !== -1 ? f.signal_category : 'unknown',
      frequency_dimension: DIMENSIONS.indexOf(f.frequency_dimension) !== -1 ? f.frequency_dimension : null,
      interpretation: f.interpretation || '',
      confidence: f.confidence || 'low',
      _polarity: f._polarity || '',
      _level: f._level || '',
      created_at: f.created_at || nowISO()
    };
  }
  function newEstimate(f) {
    f = f || {};
    return {
      estimate_id: f.estimate_id || uid('pest'),
      research_id: f.research_id || null,
      company_name: f.company_name || '',
      dimensions: f.dimensions || {},        // { dim: {level, summary, evidence[], confidence, needs_validation} }
      overall_confidence: f.overall_confidence || 'low',
      confidence_reasoning: f.confidence_reasoning || '',
      unvalidated_claims: f.unvalidated_claims || [],
      needs_validation: f.needs_validation || [],
      limited_material: !!f.limited_material,
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }
  function newContradiction(f) {
    f = f || {};
    return {
      contradiction_id: f.contradiction_id || uid('pcon'),
      research_id: f.research_id || null,
      company_name: f.company_name || '',
      dimension: f.dimension || '',
      claim: f.claim || '',
      counter_signal: f.counter_signal || '',
      evidence: f.evidence || [],
      severity: SEVERITY.indexOf(f.severity) !== -1 ? f.severity : 'minor',
      interpretation: f.interpretation || '',
      confidence: f.confidence || 'low'
    };
  }
  function newPage(f) {
    f = f || {};
    return {
      page_id: f.page_id || uid('ppage'),
      research_id: f.research_id || null,
      company_name: f.company_name || '',
      slug: f.slug || '',
      url: f.url || '',
      title: f.title || '',
      meta_description: f.meta_description || '',
      h1: f.h1 || '',
      summary: f.summary || '',
      sections: f.sections || [],            // [{key, title, body, items[]}]
      seo_keywords: f.seo_keywords || [],
      seo: f.seo || {},                       // {title_tag, meta_description, slug, h1, schema_json_ld, internal_tags[]}
      status: PAGE_STATUS.indexOf(f.status) !== -1 ? f.status : 'draft',
      limited_material: !!f.limited_material,
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }

  /* ==========================================================
     QUEUE — read 3A research_queue; surface only SELECTED companies
     ========================================================== */
  function queue(store) {
    store = ensure(store || OF.load());
    var q = store.research_queue || [];
    return q.map(function (entry) {
      var research = store.pub_research.filter(function (r) { return r.candidate_id === entry.candidate_id; })[0] || null;
      var cand = (store.company_candidates || []).filter(function (c) { return c.candidate_id === entry.candidate_id; })[0] || null;
      return {
        queue_entry: entry,
        candidate: cand,
        company_name: entry.company_name,
        website_url: cand ? cand.website_url : '',
        research: research,
        research_status: research ? research.status : 'queued'
      };
    });
  }

  /* ==========================================================
     START PUBLIC RESEARCH — URL is the only required input
     ========================================================== */
  function startResearch(candidateId, websiteUrlOverride, store) {
    store = ensure(store || OF.load());
    var entry = (store.research_queue || []).filter(function (q) { return q.candidate_id === candidateId; })[0];
    if (!entry) return { error: 'That company is not in the 3A research queue. Only selected companies can be researched.' };
    var cand = (store.company_candidates || []).filter(function (c) { return c.candidate_id === candidateId; })[0];
    var url = websiteUrlOverride || (cand && cand.website_url) || '';
    var existing = store.pub_research.filter(function (r) { return r.candidate_id === candidateId; })[0];
    var r = existing || newResearch({ candidate_id: candidateId, company_name: entry.company_name });
    if (url) { r.website_url = url; r.discovered_domain = host(url); }
    // honest provider posture: no live fetch in this environment
    var liveConfigured = OF.search && OF.search.isConfigured && OF.search.isConfigured('web_search', store);
    if (!liveConfigured) {
      var hasManual = r.source_inventory.length > 0;
      r.status = hasManual ? 'researching' : 'blocked';
      r.provider_note = 'Live web/search/social discovery is not configured — no sources are auto-discovered or fabricated. Import public source material manually to proceed.';
    } else {
      r.status = 'researching';
      r.provider_note = 'Provider reports configured, but this environment performs no network egress — use manual import.';
    }
    if (!existing) store.pub_research.push(r);
    r.updated_at = nowISO();
    if (entry.status === 'queued') entry.status = 'researching';
    audit(store, 'research', entry.company_name, 'started', r.status);
    OF.save(store);
    return { research: r, blocked: r.status === 'blocked' };
  }

  /* ==========================================================
     IMPORT PUBLIC SOURCE — manual material → signal inventory
     ========================================================== */
  function importSource(researchId, fields, store) {
    store = ensure(store || OF.load());
    var r = byId(store.pub_research, 'research_id', researchId);
    if (!r) return { error: 'Research record not found.' };
    fields = fields || {};
    if (!fields.raw_text && !fields.source_url) return { error: 'Paste the public source text (or at least a URL + title).' };
    var st = SOURCE_TYPES.indexOf(fields.source_type) !== -1 ? fields.source_type : 'manual_import';
    // record in source inventory + the appropriate discovered_* bucket
    var inv = { source_type: st, source_url: fields.source_url || '', source_title: fields.source_title || titleish(st), added_at: nowISO(), origin: 'manual_import' };
    r.source_inventory.push(inv);
    if (fields.source_url) {
      if (st === 'linkedin_company') r.discovered_linkedin = fields.source_url;
      else if (st === 'careers_page') r.discovered_careers_page = fields.source_url;
      else if (st === 'news' || st === 'press_release' || st === 'article') r.discovered_news.push(fields.source_url);
      else if (st === 'youtube') r.discovered_videos.push(fields.source_url);
      else if (st === 'employee_review') r.discovered_reviews.push(fields.source_url);
      else if (st === 'job_post') r.discovered_job_posts.push(fields.source_url);
      else if (['instagram', 'facebook', 'x'].indexOf(st) !== -1) r.discovered_social_links.push(fields.source_url);
    }
    // extract signals from the text
    var created = extractSignals(r, st, fields, store);
    if (r.status === 'blocked' || r.status === 'queued') r.status = 'researching';
    r.updated_at = nowISO();
    audit(store, 'source', r.company_name, 'imported', st + ' · ' + created.length + ' signal(s)');
    OF.save(store);
    return { research: r, signals: created };
  }

  function extractSignals(r, sourceType, fields, store) {
    var text = fields.raw_text || fields.source_title || '';
    var t = lc(text);
    var created = [], seen = {};
    LEXICON.forEach(function (entry) {
      for (var i = 0; i < entry.cues.length; i++) {
        var cue = entry.cues[i];
        if (t.indexOf(cue) !== -1) {
          var key = entry.dim + '|' + entry.polarity;
          if (seen[key]) break;            // one signal per dim+polarity per source
          seen[key] = true;
          var rank = sourceRank(sourceType);
          var conf = rank === 'observed' ? 'medium' : (rank === 'claim' ? 'low' : 'low');
          // a dimension corroborated by an observed source reads higher
          var sig = newSignal({
            research_id: r.research_id, company_name: r.company_name,
            source_type: sourceType, source_url: fields.source_url || '', source_title: fields.source_title || titleish(sourceType),
            raw_excerpt: firstSentenceWith(text, cue),
            signal_category: entry.cat, frequency_dimension: entry.dim,
            interpretation: 'Public signals suggest ' + entry.interp + '.',
            confidence: conf, _polarity: entry.polarity, _level: entry.level
          });
          store.pub_signals.push(sig); created.push(sig);
          break;
        }
      }
    });
    if (!created.length) {
      // honest: no signposted language found — record an unknown signal, fabricate nothing
      var u = newSignal({
        research_id: r.research_id, company_name: r.company_name, source_type: sourceType,
        source_url: fields.source_url || '', source_title: fields.source_title || titleish(sourceType),
        raw_excerpt: (text || '').slice(0, 180).trim(), signal_category: 'unknown', frequency_dimension: null,
        interpretation: 'No clear organizational-frequency language detected in this source.', confidence: 'low'
      });
      store.pub_signals.push(u); created.push(u);
    }
    return created;
  }

  /* ==========================================================
     FREQUENCY ESTIMATE — 12 dimensions, probabilistic
     ========================================================== */
  function generateEstimate(researchId, store) {
    store = ensure(store || OF.load());
    var r = byId(store.pub_research, 'research_id', researchId);
    if (!r) return { error: 'Research record not found.' };
    var sigs = store.pub_signals.filter(function (s) { return s.research_id === researchId && s.frequency_dimension; });
    if (!sigs.length) return { error: 'No dimension-bearing signals yet. Import public source material first.' };

    var dims = {}, needs = [], unvalidated = [];
    var observedCount = 0, claimCount = 0;
    DIMENSIONS.forEach(function (dim) {
      var ds = sigs.filter(function (s) { return s.frequency_dimension === dim; });
      if (!ds.length) {
        dims[dim] = { level: DEFAULT_LEVEL, summary: 'Available public material does not yet speak clearly to ' + DIM_LABELS[dim].toLowerCase() + '. This remains unvalidated.', evidence: [], confidence: 'none', needs_validation: true };
        needs.push(dim);
        return;
      }
      var observed = ds.filter(function (s) { return sourceRank(s.source_type) === 'observed'; });
      var claim = ds.filter(function (s) { return sourceRank(s.source_type) === 'claim'; });
      observed.length && observedCount++; claim.length && claimCount++;
      // pick the dominant level (prefer observed signal's reading)
      var lead = observed[0] || ds[0];
      var level = lead._level || DEFAULT_LEVEL;
      var conf = (observed.length && ds.length >= 2) ? 'medium' : (observed.length ? 'medium' : 'low');
      if (observed.length && claim.length && ds.length >= 3) conf = 'medium';
      var needsVal = conf === 'low' || (claim.length && !observed.length);
      var summary = 'Public signals suggest ' + interpFor(dim, ds) + (needsVal ? ' This reading is drawn from limited public material and remains unvalidated.' : ' Available evidence is consistent across sources, though still unvalidated by the company.');
      dims[dim] = {
        level: level,
        summary: summary,
        evidence: ds.map(function (s) { return { excerpt: s.raw_excerpt, source_type: s.source_type, confidence: s.confidence }; }),
        confidence: conf,
        needs_validation: needsVal
      };
      if (needsVal) needs.push(dim);
      if (claim.length && !observed.length) {
        unvalidated.push({ dimension: dim, claim: (claim[0].raw_excerpt || level), note: 'Company self-claim with no independent public corroboration.' });
      }
    });

    var nKnown = DIMENSIONS.length - DIMENSIONS.filter(function (d) { return dims[d].confidence === 'none'; }).length;
    var overall = (observedCount >= 2 && nKnown >= 6) ? 'medium' : 'low';
    var limited = (store.pub_signals.filter(function (s) { return s.research_id === researchId; }).length <= 3) || (observedCount === 0);
    var reasoning = nKnown + ' of ' + DIMENSIONS.length + ' dimensions show public signal · ' +
      observedCount + ' dimension(s) corroborated by observed-reality sources, ' + claimCount + ' from company self-claim. ' +
      (limited ? 'Based on limited public material — treat as a starting hypothesis, not a verdict.' : 'Still unvalidated by the company.');

    // replace any prior estimate for this research
    store.pub_estimates = store.pub_estimates.filter(function (e) { return e.research_id !== researchId; });
    var est = newEstimate({
      research_id: researchId, company_name: r.company_name, dimensions: dims,
      overall_confidence: overall, confidence_reasoning: reasoning,
      unvalidated_claims: unvalidated, needs_validation: needs, limited_material: limited
    });
    store.pub_estimates.push(est);
    audit(store, 'estimate', r.company_name, 'generated', overall + ' · ' + nKnown + '/' + DIMENSIONS.length + ' dims');
    // also (re)build contradictions
    buildContradictions(r, sigs, store);
    OF.save(store);
    return { estimate: est };
  }

  function interpFor(dim, ds) {
    // combine distinct interpretations for the dimension, stripped of the lead-in
    var seen = {}, parts = [];
    ds.forEach(function (s) {
      var p = (s.interpretation || '').replace(/^Public signals suggest\s*/i, '').replace(/\.$/, '');
      if (p && !seen[lc(p)]) { seen[lc(p)] = 1; parts.push(p); }
    });
    if (!parts.length) return DIM_LABELS[dim].toLowerCase() + ' is not yet clear.';
    if (parts.length === 1) return parts[0] + '.';
    return parts.slice(0, 2).join(', and ') + '.';
  }

  /* ==========================================================
     CONTRADICTION MAP — claim vs counter-signal on a dimension
     ========================================================== */
  function buildContradictions(r, sigs, store) {
    store.pub_contradictions = store.pub_contradictions.filter(function (c) { return c.research_id !== r.research_id; });
    // group by dimension; a contradiction is opposing polarities OR claim-positive vs observed-negative
    var byDim = {};
    sigs.forEach(function (s) { (byDim[s.frequency_dimension] = byDim[s.frequency_dimension] || []).push(s); });
    Object.keys(byDim).forEach(function (dim) {
      var ds = byDim[dim];
      var pols = {}; ds.forEach(function (s) { pols[s._polarity] = (pols[s._polarity] || []).concat([s]); });
      var keys = Object.keys(pols);
      if (keys.length >= 2) {
        // opposing readings within the same dimension
        var a = pols[keys[0]][0], b = pols[keys[1]][0];
        addContradiction(r, dim, a, b, store);
      }
    });
    // cross-dimension flagship contradiction: claimed autonomy/flourishing vs observed pressure/strain
    var claimsAuto = sigs.filter(function (s) { return (s.frequency_dimension === 'autonomy_level' && s._polarity === 'high' && sourceRank(s.source_type) === 'claim'); });
    var obsPressure = sigs.filter(function (s) { return (s.frequency_dimension === 'pressure_environment' && s._polarity === 'intense' && sourceRank(s.source_type) === 'observed'); });
    if (claimsAuto.length && obsPressure.length) {
      var c = newContradiction({
        research_id: r.research_id, company_name: r.company_name, dimension: 'autonomy_level / pressure_environment',
        claim: claimsAuto[0].raw_excerpt, counter_signal: obsPressure[0].raw_excerpt,
        evidence: [claimsAuto[0].signal_id, obsPressure[0].signal_id], severity: 'moderate',
        interpretation: 'The company presents ownership and autonomy, while observed signals point to intensity and pressure. Both can be true at once — but the gap is worth validating.',
        confidence: 'medium'
      });
      if (!store.pub_contradictions.some(function (x) { return x.dimension === c.dimension; })) store.pub_contradictions.push(c);
    }
  }
  function addContradiction(r, dim, a, b, store) {
    var claimSig = sourceRank(a.source_type) === 'claim' ? a : (sourceRank(b.source_type) === 'claim' ? b : a);
    var counterSig = claimSig === a ? b : a;
    var sev = (sourceRank(counterSig.source_type) === 'observed') ? 'moderate' : 'minor';
    store.pub_contradictions.push(newContradiction({
      research_id: r.research_id, company_name: r.company_name, dimension: dim,
      claim: claimSig.raw_excerpt, counter_signal: counterSig.raw_excerpt,
      evidence: [a.signal_id, b.signal_id], severity: sev,
      interpretation: 'Public sources point in different directions on ' + DIM_LABELS[dim].toLowerCase() + '. Recorded as a signal to validate, not a judgement.',
      confidence: 'low'
    }));
  }

  /* ==========================================================
     PUBLIC COMPANY PAGE — SEO-ready, ready_for_review
     ========================================================== */
  function generatePage(researchId, store) {
    store = ensure(store || OF.load());
    var r = byId(store.pub_research, 'research_id', researchId);
    if (!r) return { error: 'Research record not found.' };
    var est = store.pub_estimates.filter(function (e) { return e.research_id === researchId; })[0];
    if (!est) return { error: 'Generate the frequency estimate first.' };
    var contradictions = store.pub_contradictions.filter(function (c) { return c.research_id === researchId; });
    var name = r.company_name;
    var slug = slugify(name) + '-organizational-frequency';
    var url = '/companies/' + slug;
    var d = est.dimensions;

    function dimLine(dim) { return d[dim] && d[dim].confidence !== 'none' ? d[dim].summary : 'Public material does not yet speak clearly to ' + DIM_LABELS[dim].toLowerCase() + '; this remains unvalidated.'; }

    var sections = [];
    sections.push({ key: 'snapshot', title: 'Company Snapshot', body:
      name + (r.discovered_domain ? ' (' + r.discovered_domain + ')' : '') + ' is profiled here from publicly available signals only. ' +
      'This Organizational Frequency profile is an outside-in read of how the organization may operate — assembled from ' +
      r.source_inventory.length + ' public source' + (r.source_inventory.length === 1 ? '' : 's') + '. It has not been validated by the company.' });
    sections.push({ key: 'public_signals', title: 'What Public Signals Suggest', body:
      'Available evidence indicates ' + overviewLine(est) + ' The following estimate is probabilistic and should be read as a starting hypothesis, not a verdict.' +
      (est.limited_material ? ' Based on limited public material.' : '') });
    sections.push({ key: 'estimate', title: 'Initial Organizational Frequency Estimate', items:
      DIMENSIONS.map(function (dim) { return { label: DIM_LABELS[dim], level: d[dim].level, confidence: d[dim].confidence, needs_validation: d[dim].needs_validation, summary: d[dim].summary }; }) });
    sections.push({ key: 'leadership', title: 'Leadership Style', body: dimLine('leadership_style') + ' ' + dimLine('decision_making') });
    sections.push({ key: 'communication', title: 'Communication Culture', body: dimLine('communication_culture') + ' ' + dimLine('collaboration_style') });
    sections.push({ key: 'execution', title: 'Execution & Pressure Environment', body: dimLine('execution_style') + ' ' + dimLine('pressure_environment') });
    sections.push({ key: 'talent', title: 'Talent Philosophy', body: dimLine('talent_philosophy') });
    sections.push({ key: 'growth', title: 'Growth & Autonomy Signals', body: dimLine('growth_orientation') + ' ' + dimLine('autonomy_level') });
    sections.push({ key: 'thrive', title: 'Who May Thrive Here', items: thriveList(d) });
    sections.push({ key: 'struggle', title: 'Who May Struggle Here', items: struggleList(d) });
    sections.push({ key: 'validation', title: 'Signals That Need Validation', items:
      est.needs_validation.map(function (dim) { return DIM_LABELS[dim] + ' — unvalidated public read.'; })
        .concat(est.unvalidated_claims.map(function (u) { return DIM_LABELS[u.dimension] + ' — company self-claim, not independently corroborated.'; }))
        .concat(contradictions.map(function (c) { return 'Possible tension (' + c.severity + '): ' + titleish(c.dimension) + '.'; })) });
    sections.push({ key: 'cta', title: 'Is this your organization?', body:
      'This profile is based on publicly available signals and has not yet been validated by the company. If you represent this organization, you may help improve its accuracy by sharing leadership, culture, hiring, and organizational context.',
      buttons: ['Claim this profile', 'Add company context', 'Request review'] });

    var seoKeywords = [
      name + ' culture', name + ' work environment', name + ' leadership style',
      name + ' hiring process', name + ' employee experience', name + ' organizational frequency'
    ];
    var metaDesc = ('What public signals suggest about working at ' + name + ': leadership style, communication culture, execution & pressure, talent philosophy and growth. An evidence-based, unvalidated Organizational Frequency profile.').slice(0, 158);
    var title = name + ' — Work Culture & Organizational Frequency (Public Profile)';
    var h1 = 'The Organizational Frequency of ' + name;
    var jsonld = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'Organization', name: name,
      url: r.website_url || (r.discovered_domain ? 'https://' + r.discovered_domain : undefined),
      description: metaDesc,
      subjectOf: { '@type': 'WebPage', name: title, url: url }
    }, null, 2);

    var page = newPage({
      research_id: researchId, company_name: name, slug: slug, url: url, title: title,
      meta_description: metaDesc, h1: h1,
      summary: 'A public, evidence-based read of ' + name + "'s organizational frequency — what public signals suggest about how it leads, communicates, executes, and grows. Unvalidated by the company.",
      sections: sections, seo_keywords: seoKeywords,
      seo: {
        title_tag: title, meta_description: metaDesc, slug: slug, h1: h1,
        schema_json_ld: jsonld,
        internal_tags: ['organizational-frequency', slugify(name), 'work-culture', 'leadership-style', 'employee-experience', 'hiring']
      },
      status: 'draft', limited_material: est.limited_material
    });
    store.pub_pages = store.pub_pages.filter(function (p) { return p.research_id !== researchId; });
    store.pub_pages.push(page);
    if (r.status !== 'completed') r.status = 'completed';
    r.updated_at = nowISO();
    audit(store, 'page', name, 'generated', 'slug ' + slug + ' · draft');
    OF.save(store);
    return { page: page };
  }

  function overviewLine(est) {
    var d = est.dimensions, picks = [];
    ['execution_style', 'pressure_environment', 'autonomy_level', 'growth_orientation'].forEach(function (dim) {
      if (d[dim] && d[dim].confidence !== 'none') picks.push(d[dim].level);
    });
    if (!picks.length) return 'a limited but emerging public signature';
    return 'a ' + picks.slice(0, 3).join(', ') + ' organizational signature.';
  }
  function thriveList(d) {
    var out = [];
    if (lvl(d, 'autonomy_level') === 'high-autonomy') out.push('People who want ownership and room to make their own calls.');
    if (lvl(d, 'execution_style') === 'speed-led') out.push('People energized by pace, shipping, and fast decisions.');
    if (lvl(d, 'growth_orientation') === 'expansion-mode') out.push('People who enjoy building amid expansion and ambiguity.');
    if (lvl(d, 'innovation_orientation') === 'innovation-forward') out.push('People drawn to experimentation and new ideas.');
    if (!out.length) out.push('Difficult to say from current public signals — this needs validation.');
    return out;
  }
  function struggleList(d) {
    var out = [];
    if (lvl(d, 'pressure_environment') === 'high-intensity') out.push('People who need a predictable, low-pressure rhythm — public signals point to intensity during peak cycles.');
    if (lvl(d, 'stability_vs_chaos') === 'fluid & changing') out.push('People who prefer stable structure and fixed priorities.');
    if (lvl(d, 'autonomy_level') === 'high-autonomy') out.push('People who prefer clear direction and detailed guardrails over open-ended ownership.');
    if (!out.length) out.push('Difficult to say from current public signals — this needs validation.');
    return out;
  }
  function lvl(d, dim) { return d[dim] ? d[dim].level : DEFAULT_LEVEL; }

  function markReady(pageId, store) {
    store = ensure(store || OF.load());
    var p = byId(store.pub_pages, 'page_id', pageId);
    if (!p) return { error: 'Page not found.' };
    p.status = 'ready_for_review';
    p.updated_at = nowISO();
    audit(store, 'page', p.company_name, 'ready_for_review', 'awaiting human review — not published');
    OF.save(store);
    return { page: p };
  }
  function setPageStatus(pageId, status, store) {
    store = ensure(store || OF.load());
    var p = byId(store.pub_pages, 'page_id', pageId);
    if (!p) return { error: 'Page not found.' };
    if (PAGE_STATUS.indexOf(status) === -1) return { error: 'Invalid status.' };
    p.status = status; p.updated_at = nowISO();
    audit(store, 'page', p.company_name, status, '');
    OF.save(store);
    return { page: p };
  }

  /* ==========================================================
     READS
     ========================================================== */
  function getResearch(researchId, store) {
    store = ensure(store || OF.load());
    var r = byId(store.pub_research, 'research_id', researchId);
    if (!r) return null;
    return {
      research: r,
      signals: store.pub_signals.filter(function (s) { return s.research_id === researchId; }),
      estimate: store.pub_estimates.filter(function (e) { return e.research_id === researchId; })[0] || null,
      contradictions: store.pub_contradictions.filter(function (c) { return c.research_id === researchId; }),
      page: store.pub_pages.filter(function (p) { return p.research_id === researchId; })[0] || null
    };
  }
  function snapshot(store) {
    store = ensure(store || OF.load());
    return {
      queue: queue(store),
      research: store.pub_research.slice().reverse(),
      pages: store.pub_pages.slice().reverse(),
      audit: store.pub_audit_log.slice().reverse(),
      counts: {
        queued: (store.research_queue || []).length,
        researching: store.pub_research.filter(function (r) { return r.status === 'researching'; }).length,
        completed: store.pub_research.filter(function (r) { return r.status === 'completed'; }).length,
        signals: store.pub_signals.length,
        pages: store.pub_pages.length,
        ready: store.pub_pages.filter(function (p) { return p.status === 'ready_for_review'; }).length
      }
    };
  }
  function resetPublic(store) {
    store = ensure(store || OF.load());
    store.pub_research = []; store.pub_signals = []; store.pub_estimates = [];
    store.pub_contradictions = []; store.pub_pages = []; store.pub_audit_log = [];
    OF.save(store);
  }

  OF.pubintel = {
    RESEARCH_STATUS: RESEARCH_STATUS, SOURCE_TYPES: SOURCE_TYPES, SIGNAL_CATEGORIES: SIGNAL_CATEGORIES,
    DIMENSIONS: DIMENSIONS, DIM_LABELS: DIM_LABELS, PAGE_STATUS: PAGE_STATUS, SEVERITY: SEVERITY,
    CLAIM_SOURCES: CLAIM_SOURCES, OBSERVED_SOURCES: OBSERVED_SOURCES,
    ensure: ensure, slugify: slugify,
    queue: queue, startResearch: startResearch, importSource: importSource,
    generateEstimate: generateEstimate, generatePage: generatePage,
    markReady: markReady, setPageStatus: setPageStatus,
    getResearch: getResearch, snapshot: snapshot, resetPublic: resetPublic
  };
})();
