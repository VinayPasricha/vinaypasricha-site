/* =============================================================
   Organizational Frequency — ICP Discovery & Company Selection
   (Build 3A · the acquisition pipeline FRONT END)
   =============================================================
   The layer that runs BEFORE any research is done. It answers
   five questions, in order, and nothing more:

       1. What product are we selling?
       2. Who is the ideal customer?           → ICPDefinition
       3. Which companies fit that profile?     → TargetUniverse
       4. Which companies should be researched?  → CompanyCandidate
       5. Which become Organizational Frequency  → Research Queue
          pages?  (research begins in Build 3B)

   This build IDENTIFIES and SELECTS targets. It does NOT do
   deep organizational research, intelligence, frequency,
   outreach, or candidate discovery — those layers already exist
   and are not touched here. Research begins only AFTER a company
   is selected and Marked For Research.

   HONESTY (matches the rest of OF):
     • No live Apollo / LinkedIn / public-search / job-board fetch.
       A discovery run with no provider configured BLOCKS honestly
       (provider_not_configured) and fabricates nothing.
     • Manual import (CSV / Excel / Apollo export / pasted list)
       works today and is the launch path. Every candidate is real
       material the operator brought.
     • Marking For Research only QUEUES — it performs no research.

   Augments window.OF with window.OF.icp.
   Depends on: of-model.js (shared of.runtime.v1 store).
   ============================================================= */
(function () {
  'use strict';
  if (!window.OF) { console.warn('of-icp.js requires of-model.js'); return; }
  var OF = window.OF;

  /* ===== controlled vocabularies ===== */
  var SOURCE_TYPES = ['apollo', 'linkedin', 'public_search', 'job_boards', 'manual_import'];
  var PROVIDER_STATUS = ['configured', 'not_configured', 'blocked'];
  var RESEARCH_STATUS = ['not_selected', 'selected', 'researching', 'researched', 'published'];
  // which providers are actually wired in this environment. Manual import is
  // the only honest "configured" path; everything else blocks honestly.
  var CONFIGURED = { manual_import: true };

  /* ===== the interview script — natural questions, not a form =====
     Each step maps a conversational question to the ICP field(s) it
     fills. Array fields are split on commas / newlines / semicolons. */
  var INTERVIEW = [
    { id: 'product', field: 'product', kind: 'text',
      q: "Let's start at the source. What product are we selling — and in a sentence, what is it?",
      hint: 'e.g. "Goodspace TA Platform — an AI hiring runtime that finds resonant candidates, not just résumés."' },
    { id: 'pain_points', field: 'pain_points', kind: 'list',
      q: 'What problem does it solve? What pain is sharp enough that someone goes looking?',
      hint: 'List the pains, separated by commas.' },
    { id: 'target_roles', field: 'target_roles', kind: 'list',
      q: 'Who actually feels that pain day to day — which roles?',
      hint: 'e.g. Head of Talent, Founder, Hiring Manager' },
    { id: 'target_buyers', field: 'target_buyers', kind: 'list',
      q: 'And who signs for it — who holds the budget and makes the call?',
      hint: 'e.g. CHRO, CEO, VP People' },
    { id: 'target_industries', field: 'target_industries', kind: 'list',
      q: 'Which industries does it land in best — where does the value land fastest?',
      hint: 'e.g. SaaS, IT Services, BPO' },
    { id: 'excluded_industries', field: 'excluded_industries', kind: 'list',
      q: 'Are there industries to explicitly exclude — where it is a poor fit or not worth the cost?',
      hint: 'Leave blank if none.' },
    { id: 'target_company_sizes', field: 'company_size', kind: 'size',
      q: 'What company size works best? Give me a sense of headcount, and revenue if it matters.',
      hint: 'e.g. 100–5000 employees; ₹50Cr+ revenue' },
    { id: 'target_geographies', field: 'target_geographies', kind: 'list',
      q: 'What geography are we hunting in? And anywhere to rule out?',
      hint: 'e.g. India (exclude: US, EU)' },
    { id: 'required_signals', field: 'required_signals', kind: 'list',
      q: 'What visible signals tell you a company is in the market — hiring volume, growth, anything observable?',
      hint: 'e.g. recruitment-intensive, high job volume, recent funding' },
    { id: 'success_signals', field: 'success_signals', kind: 'list',
      q: 'Last one. When this is working, what does a great-fit company look like — the signals of a win?',
      hint: 'e.g. multiple open roles, scaling team, talent is the bottleneck' }
  ];

  /* ===== helpers ===== */
  function nowISO() { return new Date().toISOString(); }
  function uid(p) { return OF.uid(p); }
  function byId(arr, key, val) { return (arr || []).filter(function (x) { return x[key] === val; })[0] || null; }
  function lc(s) { return (s || '').toLowerCase().trim(); }
  function toList(s) {
    if (Array.isArray(s)) return s.filter(Boolean);
    return String(s || '').split(/[,;\n]+/).map(function (x) { return x.trim(); }).filter(Boolean);
  }
  function splitExclude(s) {
    // "India (exclude: US, EU)" → { include:['India'], exclude:['US','EU'] }
    var m = String(s || '').match(/\(?\s*exclud\w*\s*[:\-]?\s*([^)]*)\)?/i);
    var exclude = m ? toList(m[1]) : [];
    var include = toList(String(s || '').replace(/\(?\s*exclud\w*\s*[:\-]?\s*[^)]*\)?/i, ''));
    return { include: include, exclude: exclude };
  }

  function ensure(store) {
    store.icp_definitions = store.icp_definitions || [];
    store.icp_interviews = store.icp_interviews || [];
    store.target_universes = store.target_universes || [];
    store.company_candidates = store.company_candidates || [];
    store.discovery_sources = store.discovery_sources || [];
    store.research_queue = store.research_queue || [];
    store.icp_audit_log = store.icp_audit_log || [];
    seedSources(store);
    return store;
  }
  function seedSources(store) {
    if (store.discovery_sources.length) return;
    SOURCE_TYPES.forEach(function (t) {
      store.discovery_sources.push(newSource({
        source_type: t,
        provider_status: CONFIGURED[t] ? 'configured' : 'not_configured'
      }));
    });
  }
  function audit(store, object_type, object_ref, action, detail) {
    store.icp_audit_log.push({ log_id: uid('iaud'), object_type: object_type, object_ref: object_ref, action: action, detail: detail || '', created_at: nowISO() });
  }

  /* ==========================================================
     SCHEMAS
     ========================================================== */
  function newICP(f) {
    f = f || {};
    return {
      icp_id: f.icp_id || uid('icp'),
      product_name: f.product_name || '',
      product_description: f.product_description || '',
      target_geographies: f.target_geographies || [],
      target_industries: f.target_industries || [],
      target_company_sizes: f.target_company_sizes || [],
      target_employee_ranges: f.target_employee_ranges || [],
      target_revenue_ranges: f.target_revenue_ranges || [],
      target_roles: f.target_roles || [],
      target_buyers: f.target_buyers || [],
      required_signals: f.required_signals || [],
      excluded_industries: f.excluded_industries || [],
      excluded_geographies: f.excluded_geographies || [],
      excluded_signals: f.excluded_signals || [],
      pain_points: f.pain_points || [],
      success_signals: f.success_signals || [],
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }
  function newInterview(f) {
    f = f || {};
    return {
      interview_id: f.interview_id || uid('icpint'),
      icp_id: f.icp_id || null,
      status: f.status || 'in_progress',     // in_progress | complete
      step: typeof f.step === 'number' ? f.step : 0,
      transcript: f.transcript || [],         // [{role:'agent'|'vinay', text, field, at}]
      answers: f.answers || {},               // { stepId: rawAnswer }
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }
  function newUniverse(f) {
    f = f || {};
    return {
      universe_id: f.universe_id || uid('uni'),
      icp_id: f.icp_id || null,
      name: f.name || '',
      description: f.description || '',
      estimated_company_count: f.estimated_company_count || null,
      target_geographies: f.target_geographies || [],
      target_industries: f.target_industries || [],
      target_sizes: f.target_sizes || [],
      search_criteria: f.search_criteria || [],   // generated query labels
      created_at: f.created_at || nowISO()
    };
  }
  function newCandidate(f) {
    f = f || {};
    return {
      candidate_id: f.candidate_id || uid('cand'),
      company_name: f.company_name || '',
      website_url: f.website_url || '',
      linkedin_url: f.linkedin_url || '',
      industry: f.industry || '',
      hq: f.hq || '',
      employee_count: f.employee_count || '',
      estimated_stage: f.estimated_stage || '',
      short_description: f.short_description || '',
      discovery_source: SOURCE_TYPES.indexOf(f.discovery_source) !== -1 ? f.discovery_source : 'manual_import',
      relevance_reason: f.relevance_reason || '',
      confidence: f.confidence || 'low',          // low | medium | high
      selected_for_research: !!f.selected_for_research,
      research_status: RESEARCH_STATUS.indexOf(f.research_status) !== -1 ? f.research_status : 'not_selected',
      icp_id: f.icp_id || null,
      universe_id: f.universe_id || null,
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }
  function newSource(f) {
    f = f || {};
    return {
      source_id: f.source_id || uid('dsrc'),
      source_type: SOURCE_TYPES.indexOf(f.source_type) !== -1 ? f.source_type : 'manual_import',
      provider_status: PROVIDER_STATUS.indexOf(f.provider_status) !== -1 ? f.provider_status : 'not_configured',
      note: f.note || '',
      created_at: f.created_at || nowISO()
    };
  }

  /* ==========================================================
     ICP INTERVIEW — agent interviews the operator
     ========================================================== */
  function startInterview(store) {
    store = ensure(store || OF.load());
    var iv = newInterview({});
    iv.transcript.push({ role: 'agent', text: INTERVIEW[0].q, field: INTERVIEW[0].id, at: nowISO() });
    store.icp_interviews.push(iv);
    audit(store, 'interview', iv.interview_id, 'started', '');
    OF.save(store);
    return { interview: iv, question: INTERVIEW[0] };
  }
  function interviewQuestion(step) { return INTERVIEW[step] || null; }
  function answerInterview(interviewId, answer, store) {
    store = ensure(store || OF.load());
    var iv = byId(store.icp_interviews, 'interview_id', interviewId);
    if (!iv) return { error: 'Interview not found.' };
    if (iv.status === 'complete') return { error: 'Interview already complete.' };
    var cur = INTERVIEW[iv.step];
    if (!cur) return { error: 'No question pending.' };
    var text = String(answer == null ? '' : answer).trim();
    iv.answers[cur.id] = text;
    iv.transcript.push({ role: 'vinay', text: text || '(skipped)', field: cur.id, at: nowISO() });
    // a brief, natural acknowledgement, then the next question
    var ack = acknowledge(cur, text);
    iv.step += 1;
    var next = INTERVIEW[iv.step];
    if (next) {
      iv.transcript.push({ role: 'agent', text: ack + ' ' + next.q, field: next.id, at: nowISO() });
    } else {
      iv.status = 'complete';
      iv.transcript.push({ role: 'agent', text: ack + " That's everything I need. I'll compile this into an ICP definition — review it before we build the target universe.", field: null, at: nowISO() });
    }
    iv.updated_at = nowISO();
    audit(store, 'interview', iv.interview_id, 'answered', cur.id);
    OF.save(store);
    return { interview: iv, next: next || null, complete: iv.status === 'complete' };
  }
  function acknowledge(step, text) {
    if (!text) return 'Noted — we can refine that later.';
    var phrases = {
      product: 'Good — that frames everything.',
      pain_points: 'That pain is the wedge.',
      target_roles: 'So they live the problem.',
      target_buyers: 'And they hold the budget — useful to separate from the users.',
      target_industries: 'Clear.',
      excluded_industries: 'Understood — we will keep those out.',
      company_size: 'Sizing it now.',
      target_geographies: 'Got the territory.',
      required_signals: 'Those are observable — good for targeting.',
      success_signals: 'That gives us a shape to look for.'
    };
    return phrases[step.id] || 'Noted.';
  }

  /* Compile the answered interview into an ICPDefinition. */
  function generateICP(interviewId, store) {
    store = ensure(store || OF.load());
    var iv = byId(store.icp_interviews, 'interview_id', interviewId);
    if (!iv) return { error: 'Interview not found.' };
    var a = iv.answers || {};
    // product → name + description
    var prod = a.product || '';
    var name = prod, desc = '';
    var dash = prod.split(/\s+[—\-–:]\s+/);
    if (dash.length > 1) { name = dash[0].trim(); desc = dash.slice(1).join(' — ').trim(); }
    var geo = splitExclude(a.target_geographies);
    var sizeRaw = a.company_size || '';
    var emp = (sizeRaw.match(/[\d,]+\s*[–\-to]+\s*[\d,]+\+?\s*(employees|people|headcount|staff)?/gi) || []);
    var rev = (sizeRaw.match(/[₹$€£]\s?[\d,.]+\s*(cr|crore|mn|million|bn|billion|k|m|b)?\+?(\s*(revenue|arr|turnover))?/gi) || []);

    var icp = newICP({
      product_name: name,
      product_description: desc || prod,
      pain_points: toList(a.pain_points),
      target_roles: toList(a.target_roles),
      target_buyers: toList(a.target_buyers),
      target_industries: toList(a.target_industries),
      excluded_industries: toList(a.excluded_industries),
      target_company_sizes: emp.length ? emp.map(function (x) { return x.trim(); }) : toList(sizeRaw),
      target_employee_ranges: emp.map(function (x) { return x.trim(); }),
      target_revenue_ranges: rev.map(function (x) { return x.trim(); }),
      target_geographies: geo.include,
      excluded_geographies: geo.exclude,
      required_signals: toList(a.required_signals),
      success_signals: toList(a.success_signals)
    });
    // replace any ICP previously generated from this interview
    if (iv.icp_id) store.icp_definitions = store.icp_definitions.filter(function (x) { return x.icp_id !== iv.icp_id; });
    store.icp_definitions.push(icp);
    iv.icp_id = icp.icp_id;
    iv.updated_at = nowISO();
    audit(store, 'icp', icp.icp_id, 'generated', icp.product_name);
    OF.save(store);
    return { icp: icp };
  }

  function updateICP(icpId, patch, store) {
    store = ensure(store || OF.load());
    var icp = byId(store.icp_definitions, 'icp_id', icpId);
    if (!icp) return { error: 'ICP not found.' };
    Object.keys(patch || {}).forEach(function (k) {
      if (k in icp) icp[k] = Array.isArray(icp[k]) ? toList(patch[k]) : patch[k];
    });
    icp.updated_at = nowISO();
    audit(store, 'icp', icpId, 'edited', Object.keys(patch || {}).join(', '));
    OF.save(store);
    return { icp: icp };
  }

  /* ==========================================================
     TARGET UNIVERSE — generated from an ICPDefinition
     ========================================================== */
  function generateSearchCriteria(icp) {
    var out = [];
    var geos = icp.target_geographies.length ? icp.target_geographies : [''];
    geos.forEach(function (g) {
      icp.target_industries.forEach(function (ind) {
        out.push((g ? g + ' ' : '') + ind + ' companies');
      });
    });
    if (icp.required_signals.length) {
      icp.required_signals.forEach(function (sig) {
        out.push(titleish(sig) + ' companies' + (icp.target_geographies[0] ? ' in ' + icp.target_geographies[0] : ''));
      });
    }
    // de-dupe
    var seen = {}; return out.filter(function (x) { var k = lc(x); if (seen[k]) return false; seen[k] = 1; return true; });
  }
  function titleish(s) { return String(s || '').replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }

  function generateUniverse(icpId, store) {
    store = ensure(store || OF.load());
    var icp = byId(store.icp_definitions, 'icp_id', icpId);
    if (!icp) return { error: 'ICP not found.' };
    var crit = generateSearchCriteria(icp);
    var geoTxt = icp.target_geographies.join(' / ') || 'global';
    var indTxt = icp.target_industries.slice(0, 4).join(', ') || 'all industries';
    var sizeTxt = (icp.target_employee_ranges[0] || icp.target_company_sizes[0] || 'any size');
    var u = newUniverse({
      icp_id: icpId,
      name: (icp.target_geographies[0] || 'Target') + ' · ' + (icp.target_industries.slice(0, 2).join(' + ') || 'Companies'),
      description: 'Companies in ' + geoTxt + ' across ' + indTxt + ' at ' + sizeTxt +
        (icp.required_signals.length ? ', showing ' + icp.required_signals.slice(0, 3).join(', ') : '') + '.',
      estimated_company_count: null,   // honest: no provider to estimate against
      target_geographies: icp.target_geographies.slice(),
      target_industries: icp.target_industries.slice(),
      target_sizes: icp.target_employee_ranges.length ? icp.target_employee_ranges.slice() : icp.target_company_sizes.slice(),
      search_criteria: crit
    });
    store.target_universes.push(u);
    audit(store, 'universe', u.universe_id, 'generated', crit.length + ' search criteria');
    OF.save(store);
    return { universe: u };
  }

  /* ==========================================================
     COMPANY DISCOVERY — honest about providers
     ========================================================== */
  function sourceStatus(sourceType, store) {
    store = ensure(store || OF.load());
    var s = store.discovery_sources.filter(function (x) { return x.source_type === sourceType; })[0];
    return s ? s.provider_status : 'not_configured';
  }
  function runDiscovery(universeId, sourceType, store) {
    store = ensure(store || OF.load());
    var u = byId(store.target_universes, 'universe_id', universeId);
    if (!u) return { error: 'Universe not found.' };
    var status = sourceStatus(sourceType, store);
    if (sourceType === 'manual_import') {
      return { blocked: false, note: 'Manual import is the working path — use the import panel to add real company lists.' };
    }
    // every other provider is not wired in this environment → block honestly
    audit(store, 'discovery', sourceType, 'blocked', 'provider_not_configured');
    OF.save(store);
    return {
      blocked: true,
      reason: 'provider_not_configured',
      detail: titleish(sourceType.replace(/_/g, ' ')) + ' is not configured in this environment. No companies are fabricated. ' +
        'Generate search criteria, then bring a real export (CSV / Apollo / list) through Manual Import.',
      criteria: u.search_criteria
    };
  }

  /* ==========================================================
     MANUAL IMPORT — CSV / Excel-paste / Apollo export / list
     Each imported company becomes a CompanyCandidate.
     ========================================================== */
  var HEADER_MAP = {
    company_name: ['company', 'company name', 'name', 'organization', 'account', 'account name', 'employer'],
    website_url: ['website', 'url', 'domain', 'company website', 'site', 'web'],
    linkedin_url: ['linkedin', 'linkedin url', 'linkedin company url', 'company linkedin'],
    industry: ['industry', 'sector', 'vertical'],
    hq: ['hq', 'location', 'headquarters', 'city', 'country', 'company location', 'region'],
    employee_count: ['employees', 'employee count', '# employees', 'headcount', 'size', 'company size', 'num employees', 'staff'],
    estimated_stage: ['stage', 'company stage', 'funding stage', 'type'],
    short_description: ['description', 'short description', 'about', 'summary', 'keywords']
  };
  function detectField(header) {
    var h = lc(header);
    for (var f in HEADER_MAP) { if (HEADER_MAP[f].indexOf(h) !== -1) return f; }
    return null;
  }
  function splitCSVLine(line) {
    // handles simple quoted CSV
    var out = [], cur = '', inq = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (ch === '"') { if (inq && line[i + 1] === '"') { cur += '"'; i++; } else inq = !inq; }
      else if ((ch === ',' || ch === '\t') && !inq) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out.map(function (x) { return x.trim(); });
  }
  function parseImport(text) {
    var lines = String(text || '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    if (!lines.length) return { rows: [], format: 'empty' };
    var first = lines[0];
    var delim = (first.indexOf('\t') !== -1) ? '\t' : (first.indexOf(',') !== -1 ? ',' : null);
    // header detection: first row maps to >=1 known field AND has a delimiter
    var headerCells = delim ? splitCSVLine(first) : [first];
    var mapped = headerCells.map(detectField);
    var hasHeader = delim && mapped.filter(Boolean).length >= 1 &&
      !/^https?:|\.(com|io|ai|co|in)\b/i.test(first); // a URL-leading first row is data, not header
    var rows = [];
    if (hasHeader) {
      for (var r = 1; r < lines.length; r++) {
        var cells = splitCSVLine(lines[r]);
        var obj = {};
        cells.forEach(function (c, i) { var f = mapped[i]; if (f && c) obj[f] = c; });
        if (obj.company_name) rows.push(obj);
      }
      return { rows: rows, format: 'csv', columns: mapped.filter(Boolean) };
    }
    // no header — each line is either "Name, website, industry..." or just a name
    lines.forEach(function (l) {
      if (delim) {
        var cells = splitCSVLine(l);
        var obj = { company_name: cells[0] };
        if (cells[1]) obj.website_url = cells[1];
        if (cells[2]) obj.industry = cells[2];
        if (cells[3]) obj.employee_count = cells[3];
        if (cells[4]) obj.hq = cells[4];
        if (obj.company_name) rows.push(obj);
      } else {
        rows.push({ company_name: l });
      }
    });
    return { rows: rows, format: delim ? 'delimited' : 'list' };
  }

  function importCandidates(text, opts, store) {
    store = ensure(store || OF.load());
    opts = opts || {};
    var parsed = parseImport(text);
    if (!parsed.rows.length) return { error: 'Nothing to import — paste a CSV, an Apollo export, or one company per line.' };
    var icpId = opts.icp_id || (store.icp_definitions[store.icp_definitions.length - 1] || {}).icp_id || null;
    var uniId = opts.universe_id || (store.target_universes[store.target_universes.length - 1] || {}).universe_id || null;
    var created = [], skipped = 0;
    parsed.rows.forEach(function (row) {
      var name = row.company_name;
      if (!name) { skipped++; return; }
      // de-dupe by name (case-insensitive)
      if (store.company_candidates.some(function (c) { return lc(c.company_name) === lc(name); })) { skipped++; return; }
      var cand = newCandidate({
        company_name: name,
        website_url: row.website_url || '',
        linkedin_url: row.linkedin_url || '',
        industry: row.industry || '',
        hq: row.hq || '',
        employee_count: row.employee_count || '',
        estimated_stage: row.estimated_stage || '',
        short_description: row.short_description || '',
        discovery_source: opts.source_type || 'manual_import',
        relevance_reason: row.short_description ? 'Imported with context: ' + row.short_description.slice(0, 90) : 'Manually imported into the target list — relevance to be confirmed in research.',
        confidence: row.industry || row.employee_count ? 'medium' : 'low',
        icp_id: icpId,
        universe_id: uniId
      });
      store.company_candidates.push(cand);
      created.push(cand);
    });
    audit(store, 'import', parsed.format, 'imported', created.length + ' candidate(s), ' + skipped + ' skipped');
    OF.save(store);
    return { created: created, skipped: skipped, format: parsed.format };
  }

  function addCandidateManual(fields, store) {
    store = ensure(store || OF.load());
    if (!fields || !fields.company_name) return { error: 'Company name is required.' };
    if (store.company_candidates.some(function (c) { return lc(c.company_name) === lc(fields.company_name); })) return { error: 'That company is already in the list.' };
    var icpId = (store.icp_definitions[store.icp_definitions.length - 1] || {}).icp_id || null;
    var uniId = (store.target_universes[store.target_universes.length - 1] || {}).universe_id || null;
    var cand = newCandidate(Object.assign({}, fields, { icp_id: icpId, universe_id: uniId, discovery_source: 'manual_import',
      relevance_reason: fields.relevance_reason || 'Added manually to the target list.' }));
    store.company_candidates.push(cand);
    audit(store, 'candidate', cand.company_name, 'added', 'manual');
    OF.save(store);
    return { candidate: cand };
  }

  /* ==========================================================
     SELECTION — the most important actions
     ========================================================== */
  function setSelected(candidateId, on, store) {
    store = ensure(store || OF.load());
    var c = byId(store.company_candidates, 'candidate_id', candidateId);
    if (!c) return { error: 'Candidate not found.' };
    c.selected_for_research = !!on;
    if (on && c.research_status === 'not_selected') c.research_status = 'selected';
    if (!on && c.research_status === 'selected') c.research_status = 'not_selected';
    c.updated_at = nowISO();
    OF.save(store);
    return { candidate: c };
  }
  function dismissCandidate(candidateId, store) {
    store = ensure(store || OF.load());
    var c = byId(store.company_candidates, 'candidate_id', candidateId);
    if (!c) return { error: 'Candidate not found.' };
    c.selected_for_research = false;
    c.research_status = 'not_selected';
    c._dismissed = true;
    c.updated_at = nowISO();
    // drop from research queue if present
    store.research_queue = store.research_queue.filter(function (q) { return q.candidate_id !== candidateId; });
    audit(store, 'candidate', c.company_name, 'dismissed', '');
    OF.save(store);
    return { candidate: c };
  }
  function bulkSelect(ids, on, store) {
    store = ensure(store || OF.load());
    (ids || []).forEach(function (id) { setSelected(id, on, store); store = OF.load(); ensure(store); });
    OF.save(store);
    return { count: (ids || []).length };
  }

  /* MARK FOR RESEARCH — the most important action.
     Sets selected_for_research = true and ADDS to the research queue.
     NO research is performed here. Build 3B consumes the queue. */
  function markForResearch(candidateId, store) {
    store = ensure(store || OF.load());
    var c = byId(store.company_candidates, 'candidate_id', candidateId);
    if (!c) return { error: 'Candidate not found.' };
    c.selected_for_research = true;
    c.research_status = 'selected';
    c._dismissed = false;
    c.updated_at = nowISO();
    if (!store.research_queue.some(function (q) { return q.candidate_id === candidateId; })) {
      store.research_queue.push({
        queue_id: uid('rq'),
        candidate_id: candidateId,
        company_name: c.company_name,
        icp_id: c.icp_id,
        universe_id: c.universe_id,
        status: 'queued',                 // queued → (Build 3B) researching → researched → published
        queued_at: nowISO(),
        note: 'Awaiting Build 3B research runtime. No research performed.'
      });
    }
    audit(store, 'research_queue', c.company_name, 'queued', 'marked for research — no research performed');
    OF.save(store);
    return { candidate: c };
  }
  function bulkMarkForResearch(ids, store) {
    store = ensure(store || OF.load());
    var n = 0;
    (ids || []).forEach(function (id) { var r = markForResearch(id, store); store = ensure(OF.load()); if (!r.error) n++; });
    OF.save(store);
    return { count: n };
  }
  function unqueue(candidateId, store) {
    store = ensure(store || OF.load());
    store.research_queue = store.research_queue.filter(function (q) { return q.candidate_id !== candidateId; });
    var c = byId(store.company_candidates, 'candidate_id', candidateId);
    if (c) { c.selected_for_research = false; c.research_status = 'not_selected'; c.updated_at = nowISO(); }
    audit(store, 'research_queue', c ? c.company_name : candidateId, 'unqueued', '');
    OF.save(store);
    return { ok: true };
  }

  /* ==========================================================
     READS
     ========================================================== */
  function snapshot(store) {
    store = ensure(store || OF.load());
    var cands = store.company_candidates.filter(function (c) { return !c._dismissed; });
    return {
      icps: store.icp_definitions.slice().reverse(),
      activeICP: store.icp_definitions[store.icp_definitions.length - 1] || null,
      interviews: store.icp_interviews.slice().reverse(),
      activeInterview: store.icp_interviews.filter(function (i) { return i.status === 'in_progress'; }).slice(-1)[0] || null,
      universes: store.target_universes.slice().reverse(),
      candidates: cands.slice().reverse(),
      dismissed: store.company_candidates.filter(function (c) { return c._dismissed; }).length,
      sources: store.discovery_sources.slice(),
      queue: store.research_queue.slice().reverse(),
      audit: store.icp_audit_log.slice().reverse(),
      counts: {
        icps: store.icp_definitions.length,
        universes: store.target_universes.length,
        candidates: cands.length,
        selected: cands.filter(function (c) { return c.selected_for_research; }).length,
        queued: store.research_queue.length,
        sources_configured: store.discovery_sources.filter(function (s) { return s.provider_status === 'configured'; }).length
      }
    };
  }
  function resetICP(store) {
    store = ensure(store || OF.load());
    store.icp_definitions = []; store.icp_interviews = []; store.target_universes = [];
    store.company_candidates = []; store.research_queue = []; store.icp_audit_log = [];
    store.discovery_sources = []; seedSources(store);
    OF.save(store);
  }

  OF.icp = {
    SOURCE_TYPES: SOURCE_TYPES, PROVIDER_STATUS: PROVIDER_STATUS, RESEARCH_STATUS: RESEARCH_STATUS,
    INTERVIEW: INTERVIEW, CONFIGURED: CONFIGURED,
    ensure: ensure,
    // interview
    startInterview: startInterview, interviewQuestion: interviewQuestion, answerInterview: answerInterview,
    generateICP: generateICP, updateICP: updateICP,
    // universe + discovery
    generateSearchCriteria: generateSearchCriteria, generateUniverse: generateUniverse,
    sourceStatus: sourceStatus, runDiscovery: runDiscovery,
    // import
    parseImport: parseImport, importCandidates: importCandidates, addCandidateManual: addCandidateManual,
    // selection
    setSelected: setSelected, dismissCandidate: dismissCandidate, bulkSelect: bulkSelect,
    markForResearch: markForResearch, bulkMarkForResearch: bulkMarkForResearch, unqueue: unqueue,
    // reads
    snapshot: snapshot, resetICP: resetICP
  };
})();
