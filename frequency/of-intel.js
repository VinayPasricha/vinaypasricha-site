/* =============================================================
   Organizational Frequency — Real Tier-0 Intelligence Runtime
   =============================================================
   Corrects what Test 2 exposed: Tier-0 was inferring from the
   mission, not researching the organization. This runtime builds
   the first OUTSIDE-IN model from REAL public source material the
   user provides (pasted website / about / careers / job specs /
   LinkedIn / news / Glassdoor / AmbitionBox text). Every signal is
   extracted from real text and quotes its evidence; every
   hypothesis traces back to signals; every confidence carries
   reasoning.

       Research → Organizational Intelligence → Validation →
       Frequency Evolution

   HARD RULES:
     • No hypothesis without evidence (signals → sources).
     • No confidence without reasoning.
     • No contradiction hidden — claim-vs-observed surfaced.
     • No signal promoted into the living frequency. Research
       produces HYPOTHESES; validation (1K) produces understanding.

   This runtime produces intelligence only — no sourcing,
   recruiting, representation, or frequency evolution.

   Augments window.OF with window.OF.intel.
   ============================================================= */
(function () {
  'use strict';
  if (!window.OF) { console.warn('of-intel.js requires of-model.js'); return; }
  var OF = window.OF;

  var SOURCE_TYPES = ['website', 'about_page', 'leadership_page', 'careers_page', 'job_description',
    'linkedin', 'news', 'blog', 'podcast', 'youtube', 'glassdoor', 'ambitionbox', 'competitor', 'investor', 'other'];
  var SOURCE_STATUS = ['retrieved', 'ignored', 'conflicted', 'pending_review'];
  var SIGNAL_TYPES = ['mission', 'leadership', 'pace', 'autonomy', 'communication', 'innovation',
    'execution', 'trust', 'people_development', 'risk', 'culture', 'evolution', 'hiring', 'contradiction', 'other'];
  // source types that speak the organization's CLAIM vs its OBSERVED reality
  var CLAIM_SOURCES = ['website', 'about_page', 'leadership_page', 'careers_page', 'blog', 'podcast', 'youtube'];
  var OBSERVED_SOURCES = ['job_description', 'glassdoor', 'ambitionbox', 'news', 'linkedin', 'competitor', 'investor'];

  function nowISO() { return new Date().toISOString(); }
  function uid(p) { return OF.uid(p); }
  function byId(arr, key, val) { return (arr || []).filter(function (x) { return x[key] === val; })[0] || null; }
  function lc(s) { return (s == null) ? '' : String(s).toLowerCase(); }

  function ensure(store) {
    store.intel_sources = store.intel_sources || [];
    store.intel_signals = store.intel_signals || [];
    store.intel_briefs = store.intel_briefs || [];
    store.intel_evolution = store.intel_evolution || [];
    return store;
  }

  /* ==========================================================
     BUILD OBJECT 2 — SOURCE REGISTRY
     ========================================================== */
  function newSource(f) {
    f = f || {};
    return {
      source_id: f.source_id || uid('src'),
      organization_id: f.organization_id || null,
      source_type: SOURCE_TYPES.indexOf(f.source_type) !== -1 ? f.source_type : 'other',
      url: f.url || '',
      title: f.title || '',
      text: f.text || '',                 // the real pasted public material
      retrieved_at: f.retrieved_at || nowISO(),
      confidence: f.confidence || 'medium',
      status: SOURCE_STATUS.indexOf(f.status) !== -1 ? f.status : 'retrieved',
      created_at: f.created_at || nowISO()
    };
  }

  /* ==========================================================
     BUILD OBJECT 4 — RESEARCH SIGNAL (traces to a source)
     ========================================================== */
  function newSignal(f) {
    f = f || {};
    return {
      signal_id: f.signal_id || uid('rsig'),
      organization_id: f.organization_id || null,
      source_id: f.source_id || null,
      signal_type: SIGNAL_TYPES.indexOf(f.signal_type) !== -1 ? f.signal_type : 'other',
      signal: f.signal || '',             // the read
      confidence: f.confidence || 'low',
      evidence: f.evidence || '',          // the quoted sentence it came from
      created_at: f.created_at || nowISO()
    };
  }

  /* ==========================================================
     BUILD OBJECT 6 — EVOLUTION HYPOTHESIS
     ========================================================== */
  function newEvolution(f) {
    f = f || {};
    return {
      evolution_id: f.evolution_id || uid('evo'),
      organization_id: f.organization_id || null,
      current_state: f.current_state || '',
      emerging_state: f.emerging_state || '',
      evidence: f.evidence || [],          // signal_id[]
      confidence: f.confidence || 'low',
      questions: f.questions || [],
      created_at: f.created_at || nowISO()
    };
  }

  /* ==========================================================
     BUILD OBJECT 1 — ORGANIZATIONAL INTELLIGENCE BRIEF
     ========================================================== */
  function newBrief(f) {
    f = f || {};
    return {
      brief_id: f.brief_id || uid('brief'),
      organization_id: f.organization_id || null,
      research_date: f.research_date || nowISO(),
      confidence: f.confidence || { level: 'low', reasoning: '' },
      sources: f.sources || [],            // source_id[]
      mission_hypothesis: f.mission_hypothesis || null,
      essence_hypothesis: f.essence_hypothesis || null,
      frequency_hypothesis: f.frequency_hypothesis || null,    // [{dimension, estimate, confidence, signal_ids}]
      leadership_hypothesis: f.leadership_hypothesis || null,
      hiring_hypothesis: f.hiring_hypothesis || null,
      evolution_hypothesis: f.evolution_hypothesis || null,
      contradiction_hypothesis: f.contradiction_hypothesis || [],
      risk_hypothesis: f.risk_hypothesis || [],
      validation_questions: f.validation_questions || [],
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }

  /* ==========================================================
     SOURCES
     ========================================================== */
  function addSource(orgId, fields, store) {
    store = ensure(store || OF.load());
    var s = newSource(Object.assign({}, fields || {}, { organization_id: orgId }));
    // source-type quality → base confidence
    s.confidence = sourceQuality(s.source_type);
    store.intel_sources.push(s);
    extractSignals(s, store);
    OF.save(store);
    return s;
  }
  function setSourceStatus(sourceId, status, store) {
    store = ensure(store || OF.load());
    var s = byId(store.intel_sources, 'source_id', sourceId);
    if (s && SOURCE_STATUS.indexOf(status) !== -1) { s.status = status; OF.save(store); }
    return s;
  }
  function deleteSource(sourceId, store) {
    store = ensure(store || OF.load());
    store.intel_signals = store.intel_signals.filter(function (g) { return g.source_id !== sourceId; });
    store.intel_sources = store.intel_sources.filter(function (s) { return s.source_id !== sourceId; });
    OF.save(store);
  }
  function sourceQuality(t) {
    if (['glassdoor', 'ambitionbox', 'job_description', 'news', 'investor'].indexOf(t) !== -1) return 'high'; // observed reality
    if (['about_page', 'leadership_page', 'careers_page', 'linkedin'].indexOf(t) !== -1) return 'medium';    // self-claim
    return 'low';
  }

  /* ==========================================================
     SIGNAL EXTRACTION — from REAL pasted text. Each matched
     sentence becomes a traceable signal quoting its evidence.
     ========================================================== */
  var LEX = [
    ['mission', /\b(our mission|we exist to|our purpose|we help|we enable|we're building|we are building|on a mission)\b/, 'States a purpose / mission'],
    ['leadership', /\b(founder|co-?founder|ceo|cto|leadership team|led by|our leaders|executive team)\b/, 'Leadership is named / visible'],
    ['leadership', /\b(top-down|centrali[sz]ed|sign-?off|approval|leadership decides|chain of command)\b/, 'Signals centralized decision-making'],
    ['autonomy', /\b(autonomy|ownership|own your|self-?directed|empower|decentrali[sz]ed|freedom to)\b/, 'Claims autonomy / ownership'],
    ['autonomy', /\b(closely managed|oversight|micromanag|require approval|escalate)\b/, 'Signals low autonomy / oversight'],
    ['pace', /\b(fast-?paced|move fast|rapid|hyper-?growth|high-?growth|ship quickly|velocity|breakneck)\b/, 'Signals a fast pace'],
    ['pace', /\b(deliberate|measured|methodical|steady|stable|long-?term)\b/, 'Signals a measured pace'],
    ['communication', /\b(transparent|open communication|candid|async|writing culture|documentation|over-?communicate)\b/, 'Signals open / transparent communication'],
    ['innovation', /\b(innovat|cutting-?edge|r&d|research|novel|invent|0-?to-?1|greenfield|state-of-the-art|frontier)\b/, 'Signals an innovation emphasis'],
    ['execution', /\b(execution|delivery|operational excellence|reliab|disciplin|rigor|process|on-?time)\b/, 'Signals execution / operational discipline'],
    ['trust', /\b(trust|integrity|psychological safety|our values|care deeply|respect|do the right thing)\b/, 'Signals a trust / values emphasis'],
    ['people_development', /\b(grow|develop|mentor|learning|career growth|l&d|coaching|upskill|invest in (our )?people)\b/, 'Signals people development'],
    ['culture', /\b(culture|our principles|we believe|our values are|life at|how we work)\b/, 'Describes claimed culture'],
    ['risk', /\b(layoff|lay-?off|attrition|turnover|restructur|down round|burnout|hiring freeze|backfill|left the company|poor management|long hours)\b/, 'Signals an organizational risk'],
    ['evolution', /\b(scaling|expanding|series [a-z]\b|ipo|went public|new market|going global|global expansion|platform|transform|professionali[sz]|next phase|from .* to)\b/, 'Signals the organization is changing'],
    ['hiring', /\b(hiring|we're looking for|we are looking for|join us|open roles|open positions|seeking|now hiring|we need)\b/, 'Signals an active hiring focus']
  ];

  function extractSignals(source, store) {
    store = ensure(store || OF.load());
    var text = source.text || '';
    if (!text.trim()) return [];
    // split into sentences (keep it simple + deterministic)
    var sentences = text.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+|\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
    var made = [];
    var seen = {};
    sentences.forEach(function (sent) {
      var low = lc(sent);
      LEX.forEach(function (rule) {
        if (rule[1].test(low)) {
          var key = rule[0] + '|' + sent.slice(0, 60);
          if (seen[key]) return; seen[key] = true;
          var sig = newSignal({
            organization_id: source.organization_id,
            source_id: source.source_id,
            signal_type: rule[0],
            signal: rule[2],
            confidence: source.confidence,         // inherit source quality
            evidence: '"' + (sent.length > 220 ? sent.slice(0, 217) + '…' : sent) + '" — ' + source.source_type.replace(/_/g, ' ') + (source.title ? ' (' + source.title + ')' : '')
          });
          store.intel_signals.push(sig);
          made.push(sig);
        }
      });
    });
    return made;
  }

  /* ==========================================================
     GENERATE THE INTELLIGENCE BRIEF (from signals only)
     ========================================================== */
  function generateBrief(orgId, store) {
    store = ensure(store || OF.load());
    var org = byId(store.organizations, 'organization_id', orgId);
    var sources = store.intel_sources.filter(function (s) { return s.organization_id === orgId && s.status !== 'ignored'; });
    var signals = store.intel_signals.filter(function (g) { return g.organization_id === orgId; });
    if (!sources.length) return { error: 'Add at least one real public source first — research needs evidence.' };

    var byType = {};
    SIGNAL_TYPES.forEach(function (t) { byType[t] = signals.filter(function (g) { return g.signal_type === t; }); });
    var orgName = (org && org.organization_name) || 'This organization';

    function hyp(statement, sigList) {
      var c = scoreConfidence(sigList, sources);
      return { statement: statement, confidence: c.level, reasoning: c.reasoning, signal_ids: sigList.map(function (s) { return s.signal_id; }) };
    }
    function topQuote(sigList) { return sigList.length ? sigList[0].evidence : ''; }

    // ---- Domain 1: Mission ----
    var mission = byType.mission.length
      ? hyp(orgName + ' appears to exist to ' + softVerb(byType.mission) + '. ' + (byType.mission.length + ' mission signal' + (byType.mission.length === 1 ? '' : 's') + ' across the material.'), byType.mission)
      : hyp('No explicit mission statement was found in the supplied sources; purpose remains unclear.', []);

    // ---- Domain 2: Leadership ----
    var leadSigs = byType.leadership;
    var centralized = leadSigs.filter(function (s) { return /centrali|top-down|approval|sign-?off|decides|chain of command/.test(lc(s.signal) + ' ' + lc(s.evidence)); });
    var distributed = byType.autonomy.filter(function (s) { return /autonomy|ownership|empower|decentrali|self-?directed/.test(lc(s.evidence)); });
    var leadStatement = centralized.length > distributed.length
      ? orgName + ' appears leader/decision-centralized — signals point to approvals and top-down direction.'
      : distributed.length ? orgName + ' presents as distributed / ownership-oriented in how decisions are framed.'
      : leadSigs.length ? 'Leadership is visible and named, but its decision style is not yet clear from the sources.'
      : 'Leadership style is not observable in the supplied sources.';
    var leadership = hyp(leadStatement, leadSigs.concat(distributed).concat(centralized));

    // ---- Domain 3: Hiring ----
    var hiring = byType.hiring.length || byType.people_development.length
      ? hyp(orgName + ' is actively building — ' + byType.hiring.length + ' hiring signal' + (byType.hiring.length === 1 ? '' : 's') +
          (byType.people_development.length ? ' and ' + byType.people_development.length + ' people-development signal' + (byType.people_development.length === 1 ? '' : 's') : '') + ' in the material.', byType.hiring.concat(byType.people_development))
      : hyp('No active hiring signal was found in the supplied sources.', []);

    // ---- Frequency hypothesis (10 dimensions, evidence-backed) ----
    var freqMap = {
      'Pace': byType.pace, 'Execution Discipline': byType.execution, 'Communication Style': byType.communication,
      'Pressure Tolerance': byType.risk, 'Leadership Style': leadSigs, 'Autonomy Level': byType.autonomy,
      'Innovation Requirement': byType.innovation, 'Process Maturity': byType.execution,
      'Trust / Goodness Layer': byType.trust, 'People Development Orientation': byType.people_development
    };
    var frequency = Object.keys(freqMap).map(function (dim) {
      var sl = freqMap[dim];
      var c = scoreConfidence(sl, sources);
      return {
        dimension: dim,
        estimate: sl.length ? readForDim(dim, sl) : 'Not observable in supplied sources',
        confidence: sl.length ? c.level : 'low',
        reasoning: sl.length ? c.reasoning : 'No signal for this dimension in the sources provided.',
        signal_ids: sl.map(function (s) { return s.signal_id; })
      };
    });

    // ---- Essence (synthesised from the strongest signals) ----
    var strongTypes = SIGNAL_TYPES.filter(function (t) { return byType[t] && byType[t].length >= 2 && t !== 'contradiction' && t !== 'other'; });
    var essenceSigs = strongTypes.reduce(function (a, t) { return a.concat(byType[t]); }, []);
    var essence = hyp(orgName + ' reads, from public signal, as ' + (strongTypes.length ? strongTypes.slice(0, 4).map(humanType).join(', ') : 'difficult to characterise yet') +
      '. An outside-in hypothesis, to be validated — not a conclusion.', essenceSigs);

    // ---- Contradictions (claim vs observed) ----
    var contradictions = findContradictions(orgId, store, byType, sources);

    // ---- Evolution ----
    var evolution = buildEvolution(orgId, orgName, byType, sources, store);

    // ---- Risk ----
    var risk = byType.risk.map(function (s) { return { statement: s.signal, evidence: s.evidence, confidence: s.confidence, signal_ids: [s.signal_id] }; });
    if (!risk.length) risk = [{ statement: 'No explicit risk signal surfaced; absence is not evidence of safety — observed-reality sources (Glassdoor / news) would sharpen this.', evidence: '', confidence: 'low', signal_ids: [] }];

    // ---- Validation questions (feed 1K) ----
    var vq = [];
    function vqFrom(h, kind) {
      if (!h || !h.statement || h.confidence === 'low') return;
      var clause = h.statement.split(/\s+—\s+|\.\s/)[0].replace(/\.$/, '');
      vq.push({ question: 'We believe ' + clause + '. Is that accurate?', source: kind, confidence: h.confidence });
    }
    vqFrom(leadership, 'leadership'); vqFrom(mission, 'mission'); vqFrom(hiring, 'hiring');
    frequency.filter(function (d) { return d.confidence !== 'low'; }).slice(0, 4).forEach(function (d) {
      vq.push({ question: 'We believe ' + lc(d.dimension) + ' is "' + d.estimate + '". Is that accurate?', source: 'frequency:' + d.dimension, confidence: d.confidence });
    });
    contradictions.forEach(function (c) { vq.push({ question: c.claim + ' — but ' + c.observed + '. Which is closer to how it actually works?', source: 'contradiction', confidence: 'medium' }); });
    if (evolution) vq.push({ question: 'We believe ' + orgName + ' is moving from ' + lc(evolution.current_state) + ' toward ' + lc(evolution.emerging_state) + '. Is that true?', source: 'evolution', confidence: evolution.confidence });

    // ---- overall confidence ----
    var overall = overallConfidence(sources, signals, contradictions);

    // store evolution as its own object too
    var evoStored = null;
    if (evolution) {
      store.intel_evolution = store.intel_evolution.filter(function (e) { return e.organization_id !== orgId; });
      evoStored = newEvolution({ organization_id: orgId, current_state: evolution.current_state, emerging_state: evolution.emerging_state,
        evidence: evolution.signal_ids, confidence: evolution.confidence, questions: ['Is this the direction of travel?'] });
      store.intel_evolution.push(evoStored);
    }

    store.intel_briefs = store.intel_briefs.filter(function (b) { return b.organization_id !== orgId; });
    var brief = newBrief({
      organization_id: orgId, sources: sources.map(function (s) { return s.source_id; }),
      confidence: overall,
      mission_hypothesis: mission, essence_hypothesis: essence, frequency_hypothesis: frequency,
      leadership_hypothesis: leadership, hiring_hypothesis: hiring,
      evolution_hypothesis: evolution, contradiction_hypothesis: contradictions,
      risk_hypothesis: risk, validation_questions: vq
    });
    store.intel_briefs.push(brief);
    OF.save(store);
    return { brief: brief };
  }

  /* ---- contradictions: claim (claim-sources) vs observed ---- */
  function findContradictions(orgId, store, byType, sources) {
    var out = [];
    function fromClaim(types) { return types.some(function (st) { return CLAIM_SOURCES.indexOf(sourceTypeOf(st.source_id, store)) !== -1; }); }
    function fromObserved(re) {
      return store.intel_signals.filter(function (g) {
        return g.organization_id === orgId && OBSERVED_SOURCES.indexOf(sourceTypeOf(g.source_id, store)) !== -1 && re.test(lc(g.evidence));
      });
    }
    // empowerment claim vs centralized/oversight observed
    var empowerClaim = byType.autonomy.filter(function (s) { return /autonomy|empower|ownership|decentrali/.test(lc(s.evidence)) && CLAIM_SOURCES.indexOf(sourceTypeOf(s.source_id, store)) !== -1; });
    var centralObserved = fromObserved(/approval|sign-?off|micromanag|oversight|top-down|centrali|escalate|closely managed/);
    if (empowerClaim.length && centralObserved.length) out.push({ dimension: 'Autonomy / Leadership', claim: 'Claims to empower people / give ownership', observed: 'observed signals point to approvals and centralized control', severity: 'major', signal_ids: empowerClaim.concat(centralObserved).map(function (s) { return s.signal_id; }) });
    // fast claim vs slow/process observed
    var fastClaim = byType.pace.filter(function (s) { return /fast|rapid|velocity|move fast/.test(lc(s.evidence)) && CLAIM_SOURCES.indexOf(sourceTypeOf(s.source_id, store)) !== -1; });
    var slowObserved = fromObserved(/slow|lengthy|bureaucr|many rounds|long hiring|process-?heavy|approval/);
    if (fastClaim.length && slowObserved.length) out.push({ dimension: 'Pace', claim: 'Claims to move fast', observed: 'observed signals suggest slower, process-heavy reality', severity: 'moderate', signal_ids: fastClaim.concat(slowObserved).map(function (s) { return s.signal_id; }) });
    // people-development claim vs attrition/risk observed
    var devClaim = byType.people_development.filter(function (s) { return CLAIM_SOURCES.indexOf(sourceTypeOf(s.source_id, store)) !== -1; });
    var attritionObserved = fromObserved(/attrition|turnover|burnout|left the company|poor management|long hours/);
    if (devClaim.length && attritionObserved.length) out.push({ dimension: 'People Development / Trust', claim: 'Claims to invest in and grow people', observed: 'observed signals mention attrition / burnout', severity: 'major', signal_ids: devClaim.concat(attritionObserved).map(function (s) { return s.signal_id; }) });
    return out;
  }

  function buildEvolution(orgId, orgName, byType, sources, store) {
    var evo = byType.evolution;
    if (!evo.length) return null;
    var ev = lc(evo.map(function (s) { return s.evidence; }).join(' '));
    var current = 'its current form', emerging = 'a more scaled form';
    if (/series [a-z]|seed|early/.test(ev)) { current = 'a founder-led startup'; emerging = 'a professionalized scale-up'; }
    if (/global|new market|international|expansion/.test(ev)) { current = 'a domestic / single-market company'; emerging = 'a multi-market / global company'; }
    if (/platform|consolidat|shared/.test(ev)) { current = 'a services / product-by-product company'; emerging = 'a platform company'; }
    if (/ipo|went public|public company/.test(ev)) { current = 'a private company'; emerging = 'a public-company operating model'; }
    var c = scoreConfidence(evo, sources);
    return { current_state: current, emerging_state: emerging, statement: orgName + ' may be moving from ' + current + ' toward ' + emerging + '.', confidence: c.level, reasoning: c.reasoning, signal_ids: evo.map(function (s) { return s.signal_id; }) };
  }

  /* ==========================================================
     CONFIDENCE MODEL — explainable, never arbitrary
     ========================================================== */
  function scoreConfidence(sigList, sources) {
    var n = sigList.length;
    if (!n) return { level: 'low', reasoning: 'No supporting signal.' };
    var srcIds = {}; sigList.forEach(function (s) { srcIds[s.source_id] = true; });
    var nSrc = Object.keys(srcIds).length;
    var hasObserved = sigList.some(function (s) { return ['high'].indexOf(s.confidence) !== -1; });
    var level;
    if (n >= 4 && nSrc >= 2 && hasObserved) level = 'high';
    else if (n >= 2 && nSrc >= 2) level = 'medium';
    else if (n >= 2 || hasObserved) level = 'medium';
    else level = 'low';
    var reasoning = n + ' signal' + (n === 1 ? '' : 's') + ' across ' + nSrc + ' source' + (nSrc === 1 ? '' : 's') +
      (hasObserved ? ', including an observed-reality source' : ', self-reported sources only') + '.';
    return { level: level, reasoning: reasoning };
  }
  function overallConfidence(sources, signals, contradictions) {
    var nSrc = sources.length, nObs = sources.filter(function (s) { return OBSERVED_SOURCES.indexOf(s.source_type) !== -1; }).length;
    var level = 'low';
    if (nSrc >= 4 && nObs >= 1 && signals.length >= 8) level = 'high';
    else if (nSrc >= 2 && signals.length >= 4) level = 'medium';
    var reasoning = nSrc + ' source' + (nSrc === 1 ? '' : 's') + ' (' + nObs + ' observed-reality), ' + signals.length + ' signal' + (signals.length === 1 ? '' : 's') +
      ', ' + contradictions.length + ' contradiction' + (contradictions.length === 1 ? '' : 's') + ' surfaced. ' +
      (nObs ? 'Self-claim corroborated by observed sources where present.' : 'Self-reported sources only — corroborate with Glassdoor / news / job specs to raise confidence.');
    return { level: level, reasoning: reasoning };
  }

  /* ---- reads ---- */
  function getIntel(orgId, store) {
    store = ensure(store || OF.load());
    return {
      organization: byId(store.organizations, 'organization_id', orgId),
      sources: store.intel_sources.filter(function (s) { return s.organization_id === orgId; }),
      signals: store.intel_signals.filter(function (g) { return g.organization_id === orgId; }),
      brief: byId(store.intel_briefs, 'organization_id', orgId),
      evolution: byId(store.intel_evolution, 'organization_id', orgId)
    };
  }
  function organizations(store) {
    store = ensure(store || OF.load());
    var withSrc = {};
    store.intel_sources.forEach(function (s) { withSrc[s.organization_id] = true; });
    return (store.organizations || []).map(function (o) {
      return { organization_id: o.organization_id, name: o.organization_name, sources: store.intel_sources.filter(function (s) { return s.organization_id === o.organization_id; }).length, brief: !!byId(store.intel_briefs, 'organization_id', o.organization_id) };
    });
  }
  function signalsForBrief(orgId, signalIds, store) {
    store = ensure(store || OF.load());
    return (signalIds || []).map(function (id) { return byId(store.intel_signals, 'signal_id', id); }).filter(Boolean);
  }

  /* ---- helpers ---- */
  function sourceTypeOf(srcId, store) { var s = byId(store.intel_sources, 'source_id', srcId); return s ? s.source_type : 'other'; }
  function humanType(t) { return ({ pace: 'fast-paced', execution: 'execution-disciplined', innovation: 'innovation-led', leadership: 'leader-driven', autonomy: 'ownership-oriented', communication: 'communication-open', trust: 'values-driven', people_development: 'people-developing', culture: 'culture-explicit', evolution: 'in transition', mission: 'mission-stated', hiring: 'actively building', risk: 'under strain' })[t] || t; }
  function readForDim(dim, sl) {
    var ev = lc(sl.map(function (s) { return s.signal + ' ' + s.evidence; }).join(' '));
    if (dim === 'Pace') return /deliberate|measured|steady/.test(ev) ? 'Measured' : 'Fast / accelerating';
    if (dim === 'Leadership Style') return /centrali|top-down|approval/.test(ev) ? 'Appears centralized' : /empower|ownership|decentrali/.test(ev) ? 'Appears distributed' : 'Visible, style unclear';
    if (dim === 'Autonomy Level') return /oversight|approval|micromanag/.test(ev) ? 'Appears low' : 'Appears high (claimed)';
    if (dim === 'Innovation Requirement') return 'Appears emphasized';
    if (dim === 'Execution Discipline' || dim === 'Process Maturity') return 'Process / delivery emphasis present';
    if (dim === 'Communication Style') return 'Appears open / transparent (claimed)';
    if (dim === 'Trust / Goodness Layer') return 'Values / trust language present';
    if (dim === 'People Development Orientation') return 'Development language present';
    if (dim === 'Pressure Tolerance') return 'Strain signals present';
    return 'Signal present';
  }
  function softVerb(sigs) { var q = sigs[0].evidence.replace(/^"/, '').split('"')[0]; return q.length > 90 ? q.slice(0, 90) + '…' : q; }
  function lcFirst(s) { return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }
  function stripOrg(s, orgName) { return s.replace(new RegExp('^' + (orgName || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*', 'i'), ''); }

  OF.intel = {
    SOURCE_TYPES: SOURCE_TYPES, SOURCE_STATUS: SOURCE_STATUS, SIGNAL_TYPES: SIGNAL_TYPES,
    CLAIM_SOURCES: CLAIM_SOURCES, OBSERVED_SOURCES: OBSERVED_SOURCES,
    ensure: ensure,
    newSource: newSource, newSignal: newSignal, newBrief: newBrief, newEvolution: newEvolution,
    addSource: addSource, setSourceStatus: setSourceStatus, deleteSource: deleteSource,
    extractSignals: extractSignals, generateBrief: generateBrief,
    getIntel: getIntel, organizations: organizations, signalsForBrief: signalsForBrief,
    sourceQuality: sourceQuality
  };
})();
