/* =============================================================
   Organizational Frequency — Person Intelligence Runtime  (1N)
   =============================================================
   The person-side mirror of the org Intelligence runtime. Builds
   a serious Person Intelligence Brief from REAL material the
   recruiter provides (resume / LinkedIn text / articles / posts /
   press / portfolio), then prepares 10 professional references
   with explicit consent and hypothesis-driven questions.

   HONESTY (enforced):
     • The runtime does NOT search the internet or scrape LinkedIn.
       It reasons over text/links the user supplies. Live web
       search = NOT IMPLEMENTED (paste/link placeholders only).
     • No signal without a source; no hypothesis without a signal.
     • Resume-only hypotheses are labelled weak; confidence rises
       with more, and especially with validated references.
     • Only professional behaviour from professional evidence —
       no private traits, no personality typing, no psychometrics.

   Produces intelligence + reference scaffolding only. No matching,
   ranking, fit score, recommendation, or automated outreach.

   Augments window.OF with window.OF.personIntel.
   ============================================================= */
(function () {
  'use strict';
  if (!window.OF) { console.warn('of-person-intel.js requires of-model.js'); return; }
  var OF = window.OF;

  var DIMENSIONS = (OF.person && OF.person.DIMENSIONS) || (OF.frequency && OF.frequency.DIMENSIONS) || [];
  var SOURCE_TYPES = ['resume', 'linkedin_profile', 'linkedin_post', 'article', 'press', 'personal_website', 'github', 'portfolio', 'social_media', 'public_commentary', 'reference', 'other'];
  var SOURCE_STATUS = ['provided', 'retrieved', 'ignored', 'pending_review', 'conflicted'];
  var SIGNAL_TYPES = ['career_pattern', 'achievement', 'role_progression', 'tenure_pattern', 'communication', 'leadership', 'execution', 'innovation', 'autonomy', 'pace', 'pressure', 'trust', 'values', 'belief', 'judgment', 'people_development', 'risk', 'contradiction', 'growth_direction', 'other'];
  var REL_TYPES = ['supervisor', 'peer', 'junior', 'client', 'customer', 'vendor', 'investor', 'mentor', 'other'];
  var REF_STATUS = ['not_contacted', 'contacted', 'responded', 'validated', 'declined', 'unreachable'];
  var CHANNELS = ['website', 'email', 'whatsapp', 'voice'];
  // self-claim vs observed-reality, for confidence + contradictions
  var CLAIM_SOURCES = ['resume', 'linkedin_profile', 'personal_website', 'portfolio', 'social_media'];
  var OBSERVED_SOURCES = ['press', 'reference', 'public_commentary', 'github', 'article', 'linkedin_post'];

  function nowISO() { return new Date().toISOString(); }
  function uid(p) { return OF.uid(p); }
  function byId(arr, key, val) { return (arr || []).filter(function (x) { return x[key] === val; })[0] || null; }
  function lc(s) { return (s == null) ? '' : String(s).toLowerCase(); }

  function ensure(store) {
    store.pi_sources = store.pi_sources || [];
    store.pi_signals = store.pi_signals || [];
    store.pi_briefs = store.pi_briefs || [];
    store.pi_reference_requests = store.pi_reference_requests || [];
    store.pi_reference_threads = store.pi_reference_threads || [];
    return store;
  }

  /* ---- SCHEMAS ---------------------------------------------- */
  function newSource(f) {
    f = f || {};
    return {
      source_id: f.source_id || uid('psrc'), person_id: f.person_id || null,
      source_type: SOURCE_TYPES.indexOf(f.source_type) !== -1 ? f.source_type : 'other',
      title: f.title || '', url: f.url || '', raw_text: f.raw_text || '',
      retrieved_at: f.retrieved_at || nowISO(),
      status: SOURCE_STATUS.indexOf(f.status) !== -1 ? f.status : 'provided',
      confidence: f.confidence || 'medium', created_at: f.created_at || nowISO()
    };
  }
  function newSignal(f) {
    f = f || {};
    return {
      signal_id: f.signal_id || uid('psig'), person_id: f.person_id || null, source_id: f.source_id || null,
      signal_type: SIGNAL_TYPES.indexOf(f.signal_type) !== -1 ? f.signal_type : 'other',
      signal: f.signal || '', evidence: f.evidence || '', confidence: f.confidence || 'low',
      created_at: f.created_at || nowISO()
    };
  }
  function newBrief(f) {
    f = f || {};
    return {
      brief_id: f.brief_id || uid('pibrief'), person_id: f.person_id || null,
      created_at: f.created_at || nowISO(), updated_at: nowISO(),
      source_count: f.source_count || 0, confidence: f.confidence || { level: 'low', reasoning: '' },
      evidence_summary: f.evidence_summary || '',
      career_pattern_hypothesis: f.career_pattern_hypothesis || null,
      person_essence_hypothesis: f.person_essence_hypothesis || null,
      person_frequency_hypothesis: f.person_frequency_hypothesis || null,
      motivation_hypothesis: f.motivation_hypothesis || null,
      growth_hypothesis: f.growth_hypothesis || null,
      constraint_hypothesis: f.constraint_hypothesis || null,
      beliefs_and_values_hypothesis: f.beliefs_and_values_hypothesis || null,
      communication_hypothesis: f.communication_hypothesis || null,
      leadership_hypothesis: f.leadership_hypothesis || null,
      risk_hypothesis: f.risk_hypothesis || null,
      contradiction_hypotheses: f.contradiction_hypotheses || [],
      validation_questions: f.validation_questions || []
    };
  }
  function newReferenceRequest(f) {
    f = f || {};
    return {
      request_id: f.request_id || uid('refreq'), person_id: f.person_id || null,
      references: f.references || [],          // [{reference_id, name, relationship_type, company, designation, email, phone, years_known, permission_to_contact, preferred_channel, notes}]
      consent: f.consent || false,
      consent_text: f.consent_text || 'I authorize Goodspace / Organizational Frequency to contact these references for professional validation.',
      consent_at: f.consent_at || null,
      created_at: f.created_at || nowISO(), updated_at: nowISO()
    };
  }
  function newRefThread(f) {
    f = f || {};
    return {
      thread_id: f.thread_id || uid('refthr'), reference_id: f.reference_id || null, person_id: f.person_id || null,
      messages: f.messages || [], channel_history: f.channel_history || [],
      open_questions: f.open_questions || [], validated_answers: f.validated_answers || [],
      last_interaction: f.last_interaction || null,
      status: REF_STATUS.indexOf(f.status) !== -1 ? f.status : 'not_contacted'
    };
  }

  /* ---- create / find a person ------------------------------- */
  function createPerson(fields, store) {
    store = ensure(store || OF.load());
    var p;
    if (OF.person && OF.person.createPerson) { p = OF.person.createPerson(Object.assign({ source: 'person_intel' }, fields || {}), store); store = OF.load(); ensure(store); }
    else { p = { person_id: uid('per'), name: (fields || {}).name || '', created_at: nowISO() }; store.persons = store.persons || []; store.persons.push(p); OF.save(store); }
    return p;
  }
  function people(store) {
    store = ensure(store || OF.load());
    return (store.persons || []).map(function (p) {
      return { person_id: p.person_id, name: p.name || 'Unnamed', title: p.current_title || '',
        sources: store.pi_sources.filter(function (s) { return s.person_id === p.person_id; }).length,
        brief: !!byId(store.pi_briefs, 'person_id', p.person_id) };
    });
  }

  /* ---- sources + signal extraction -------------------------- */
  function addSource(personId, fields, store) {
    store = ensure(store || OF.load());
    var s = newSource(Object.assign({}, fields || {}, { person_id: personId }));
    s.confidence = sourceQuality(s.source_type);
    store.pi_sources.push(s);
    extractSignals(s, store);
    OF.save(store);
    return s;
  }
  function deleteSource(sourceId, store) {
    store = ensure(store || OF.load());
    store.pi_signals = store.pi_signals.filter(function (g) { return g.source_id !== sourceId; });
    store.pi_sources = store.pi_sources.filter(function (s) { return s.source_id !== sourceId; });
    OF.save(store);
  }
  function sourceQuality(t) {
    if (['press', 'reference', 'public_commentary'].indexOf(t) !== -1) return 'high';
    if (['linkedin_post', 'article', 'github', 'portfolio'].indexOf(t) !== -1) return 'medium';
    if (['resume', 'linkedin_profile', 'personal_website', 'social_media'].indexOf(t) !== -1) return 'medium';
    return 'low';
  }

  // NOTE: stemmed alternatives (autonom, disciplin, mentor…) use a LEADING \b
  // only — a trailing \b would fail on "autonomy"/"discipline" (letter follows
  // the stem). Keep patterns anchored at word start, open at the end.
  var LEX = [
    ['leadership', /\b(led |managed|head of|director of|vp of|\bchief |founded|co-?founded|built a team|built the team|hired|ran the|leading)/, 'Has held leadership / team-building responsibility'],
    ['execution', /\b(shipped|shipping|delivered|launch|scaled|scaling|grew|increased|reduced|drove|owned|rolled out|executed|ship fast|shipping fast)/, 'Shows a delivery / execution orientation'],
    ['achievement', /(\d+\s?%|\$\s?\d|\d+x\b|\bmillion\b|\bbillion\b|award|recogni[sz]ed|ranked|top \d)/, 'Quantified achievement claimed'],
    ['innovation', /\b(founded|invented|0-?\s?to-?\s?1|new product|from scratch|prototype|patent|greenfield|first to|pioneered|first-?principles|\br&d\b|research)/, 'Signals building-from-scratch / innovation'],
    ['autonomy', /\b(independent|self-?directed|solo|autonom|ownership|own the|owned end-to-end|own end-to-end|self-?starter|freedom)/, 'Signals high autonomy / ownership'],
    ['communication', /\b(wrote|author|speaker|keynote|published|presented|evangeli|spokesperson|taught|transparen)/, 'Communicates publicly / transparently'],
    ['people_development', /\b(mentor|coach|grew the team|trained|hired and grew|nurtur|sponsored|developed \d|develop the team)/, 'Develops other people'],
    ['pace', /\b(fast-?paced|move fast|moving fast|ship fast|shipping fast|speed|momentum|startup|hyper-?growth|rapid|scaled quickly|seed stage|early-?stage|always shipping)/, 'Comfortable in fast / startup pace'],
    ['execution', /\b(process|operational|systems|framework|disciplin|rigor|compliance|quality|governance|\bsla\b)/, 'Signals process / operational discipline'],
    ['pressure', /\b(pressure|turnaround|crisis|under pressure|high-?stakes|tight deadline|brutal deadline|deadline|incident|on-?call|firefighting)/, 'Has operated under pressure'],
    ['values', /\b(believe|passionate about|mission-?driven|our values|care deeply|advocate|integrity|ethic)/, 'Expresses values / beliefs'],
    ['belief', /\b(i think|in my view|i've learned|my philosophy|i argue|contrarian|strong opinion|kills|beats|first-?principles)/, 'Expresses a point of view / judgment'],
    ['growth_direction', /\b(transition|moving into|increasingly|now focused on|next chapter|exploring|pivot)/, 'Signals a direction of change'],
    ['tenure_pattern', /\b(\d+\s?(months?|years?)\b|short stint|brief stint|\bstints?\b)/, 'A tenure / stint pattern'],
    ['risk', /\b(laid off|let go|gap year|career break|stepped down|left after \d|short stint|sabbatical|between roles)/, 'A potential career-continuity signal']
  ];

  function extractSignals(source, store) {
    store = ensure(store || OF.load());
    var text = source.raw_text || '';
    if (!text.trim()) return [];
    var sentences = text.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+|\n+|•|\u2022|;/).map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 3; });
    var made = [], seen = {};
    sentences.forEach(function (sent) {
      var low = lc(sent);
      LEX.forEach(function (rule) {
        if (rule[1].test(low)) {
          var key = rule[0] + '|' + sent.slice(0, 50);
          if (seen[key]) return; seen[key] = true;
          var sig = newSignal({
            person_id: source.person_id, source_id: source.source_id, signal_type: rule[0], signal: rule[2],
            confidence: source.confidence,
            evidence: '"' + (sent.length > 200 ? sent.slice(0, 197) + '…' : sent) + '" — ' + source.source_type.replace(/_/g, ' ') + (source.title ? ' (' + source.title + ')' : '')
          });
          store.pi_signals.push(sig);
          made.push(sig);
        }
      });
    });
    // tenure / role-progression: detect date ranges + "X years"
    var ranges = (text.match(/\b(19|20)\d{2}\s*[–\-—to]+\s*((19|20)\d{2}|present|current)\b/gi) || []);
    if (ranges.length >= 2) {
      var sig2 = newSignal({ person_id: source.person_id, source_id: source.source_id, signal_type: 'role_progression', signal: ranges.length + ' dated roles — a traceable career progression', confidence: source.confidence, evidence: 'Date ranges found: ' + ranges.slice(0, 5).join('; ') + ' — ' + source.source_type.replace(/_/g, ' ') });
      store.pi_signals.push(sig2); made.push(sig2);
    }
    var shortStints = (text.match(/\b(\d{1,2})\s*months?\b/gi) || []).filter(function (m) { return parseInt(m, 10) <= 12; });
    if (shortStints.length >= 2) {
      var sig3 = newSignal({ person_id: source.person_id, source_id: source.source_id, signal_type: 'tenure_pattern', signal: 'Several short stints — a tenure pattern worth probing', confidence: source.confidence, evidence: 'Short durations: ' + shortStints.slice(0, 4).join(', ') + ' — ' + source.source_type.replace(/_/g, ' ') });
      store.pi_signals.push(sig3); made.push(sig3);
    }
    return made;
  }

  /* ---- BRIEF GENERATION (from signals only) ----------------- */
  function generateBrief(personId, store) {
    store = ensure(store || OF.load());
    var person = byId(store.persons, 'person_id', personId);
    var sources = store.pi_sources.filter(function (s) { return s.person_id === personId && s.status !== 'ignored'; });
    var signals = store.pi_signals.filter(function (g) { return g.person_id === personId; });
    if (!sources.length) return { error: 'Add at least one real source (resume / LinkedIn / article) — intelligence needs evidence.' };
    var name = (person && person.name) || 'This person';

    var byType = {};
    SIGNAL_TYPES.forEach(function (t) { byType[t] = signals.filter(function (g) { return g.signal_type === t; }); });
    function hyp(statement, sl) { var c = score(sl, sources); return { statement: statement, confidence: c.level, reasoning: c.reasoning, signal_ids: sl.map(function (s) { return s.signal_id; }) }; }

    var onlyResume = sources.length === 1 && sources[0].source_type === 'resume';

    // career pattern
    var leadership = byType.leadership, exec = byType.execution, innov = byType.innovation;
    var career = hyp(name + ' shows a ' + (innov.length > exec.length ? 'building / 0-to-1' : (leadership.length >= 2 ? 'leadership-and-delivery' : 'execution-focused')) + ' career pattern across ' + sources.length + ' source' + (sources.length === 1 ? '' : 's') + ((byType.role_progression[0]) ? ', with a traceable role progression' : '') + '.', leadership.concat(exec).concat(innov).concat(byType.role_progression));

    // essence archetype
    var essence = essenceArchetype(name, byType);

    // frequency hypothesis
    var freqMap = {
      'Pace': byType.pace, 'Execution Discipline': byType.execution, 'Communication Style': byType.communication,
      'Pressure Tolerance': byType.pressure, 'Leadership Style': byType.leadership, 'Autonomy Level': byType.autonomy,
      'Innovation Requirement': byType.innovation, 'Process Maturity': byType.execution,
      'Trust / Goodness Layer': byType.values, 'People Development Orientation': byType.people_development
    };
    var frequency = DIMENSIONS.map(function (dim) {
      var sl = freqMap[dim] || [];
      var c = score(sl, sources);
      return { dimension: dim, reading: sl.length ? readDim(dim, sl) : 'Not observable in supplied material',
        confidence: sl.length ? c.level : 'low', reasoning: sl.length ? c.reasoning : 'No signal for this dimension in the sources provided.',
        evidence: sl.slice(0, 2).map(function (s) { return s.evidence; }) };
    });

    var motivation = hyp(name + ' appears energised by ' + motivationFrom(byType) + '.', byType.values.concat(byType.innovation).concat(byType.belief).concat(byType.achievement));
    var growth = byType.growth_direction.length ? hyp(name + ' appears to be moving toward ' + growthFrom(byType) + '.', byType.growth_direction) : hyp('No clear growth-direction signal in the supplied material — recent posts / articles would reveal trajectory.', []);
    var constraint = constraintFrom(name, byType, score, sources);
    var beliefs = (byType.values.length || byType.belief.length) ? hyp(name + ' expresses ' + (byType.belief.length ? 'distinct points of view' : 'clear values') + ' in public material — see evidence.', byType.values.concat(byType.belief)) : hyp('No public writing supplied — beliefs/values unobserved. Articles or posts would surface them.', []);
    var communication = byType.communication.length ? hyp(name + ' communicates publicly (writing / speaking / teaching).', byType.communication) : hyp('No public communication signal in the supplied material.', []);
    var leadershipHyp = byType.leadership.length ? hyp(name + ' has carried leadership / team responsibility — style to be validated with references.', byType.leadership.concat(byType.people_development)) : hyp('No leadership signal in the supplied material.', []);
    var risk = riskFrom(name, byType, sources);

    var contradictions = findContradictions(name, byType, store, personId);
    var vq = buildValidationQuestions(name, { essence: essence, frequency: frequency, leadership: leadershipHyp, constraint: constraint, growth: growth }, byType, contradictions);

    var overall = overallConfidence(sources, signals, onlyResume);
    var evidenceSummary = sources.length + ' source' + (sources.length === 1 ? '' : 's') + ' (' + sources.map(function (s) { return s.source_type.replace(/_/g, ' '); }).join(', ') + '), ' + signals.length + ' signals.';

    store.pi_briefs = store.pi_briefs.filter(function (b) { return b.person_id !== personId; });
    var brief = newBrief({
      person_id: personId, source_count: sources.length, confidence: overall, evidence_summary: evidenceSummary,
      career_pattern_hypothesis: career, person_essence_hypothesis: essence, person_frequency_hypothesis: frequency,
      motivation_hypothesis: motivation, growth_hypothesis: growth, constraint_hypothesis: constraint,
      beliefs_and_values_hypothesis: beliefs, communication_hypothesis: communication, leadership_hypothesis: leadershipHyp,
      risk_hypothesis: risk, contradiction_hypotheses: contradictions, validation_questions: vq
    });
    store.pi_briefs.push(brief);
    OF.save(store);
    return { brief: brief };
  }

  function essenceArchetype(name, byType) {
    var scores = {
      Builder: byType.innovation.length * 2 + byType.autonomy.length,
      Operator: byType.execution.length * 2 + byType.leadership.length,
      Explorer: byType.growth_direction.length + byType.innovation.length,
      Craftsman: byType.execution.length + byType.communication.length,
      Scientist: byType.innovation.length + byType.belief.length,
      Teacher: byType.communication.length * 2 + byType.people_development.length * 2,
      Merchant: byType.achievement.length + byType.leadership.length,
      Specialist: (byType.execution.length && !byType.leadership.length) ? 3 : 0
    };
    var best = Object.keys(scores).sort(function (a, b) { return scores[b] - scores[a]; })[0];
    var sl = byType.innovation.concat(byType.execution).concat(byType.leadership).concat(byType.communication);
    var c = score(sl, []);
    return { statement: name + ' reads, professionally, as a ' + best + ' — ' + archetypeWhy(best) + '. An outside-in hypothesis from public material, to be validated — not a personality label.', archetype: best, confidence: sl.length >= 3 ? c.level : 'low', reasoning: 'Weighted from signal mix: ' + Object.keys(scores).filter(function (k) { return scores[k]; }).map(function (k) { return k + ' ' + scores[k]; }).join(', ') + '.', signal_ids: sl.map(function (s) { return s.signal_id; }) };
  }
  function archetypeWhy(a) {
    return ({ Builder: 'creates new things from scratch and owns them end-to-end', Operator: 'makes things run and ship at scale', Explorer: 'moves toward the new and ambiguous', Craftsman: 'cares about the quality of the work itself', Scientist: 'reasons from principles and ideas', Teacher: 'develops others and communicates', Merchant: 'drives outcomes and growth', Specialist: 'goes deep in a domain' })[a] || 'a distinct professional shape';
  }
  function motivationFrom(b) {
    if (b.innovation.length) return 'building new things and solving open-ended problems';
    if (b.people_development.length) return 'growing teams and people';
    if (b.achievement.length) return 'measurable impact and outcomes';
    if (b.communication.length) return 'ideas, writing and influence';
    return 'the work itself (limited motivational signal in the material)';
  }
  function growthFrom(b) {
    var ev = lc(b.growth_direction.map(function (s) { return s.evidence; }).join(' '));
    if (/leadership|manage|head|director|vp|chief/.test(ev)) return 'broader leadership scope';
    if (/found|start|build|0-?to-?1/.test(ev)) return 'founding / building something of their own';
    if (/ai|data|platform|technical|deep/.test(ev)) return 'deeper technical / domain specialisation';
    return 'a new chapter (direction stated but not yet specific)';
  }
  function constraintFrom(name, b, score, sources) {
    var sl = b.tenure_pattern.concat(b.risk);
    if (b.tenure_pattern.length) return { statement: name + ' may be constrained by tenure pattern — short stints suggest either fast growth or unsettled fit; references should probe.', confidence: 'medium', reasoning: score(sl, sources).reasoning, signal_ids: sl.map(function (s) { return s.signal_id; }) };
    if (!b.execution.length && b.innovation.length) return { statement: name + ' may be constrained by follow-through — strong on starting, less observable on finishing/operating.', confidence: 'low', reasoning: 'Innovation signals without matching execution signals.', signal_ids: b.innovation.map(function (s) { return s.signal_id; }) };
    if (!b.people_development.length && b.leadership.length) return { statement: name + ' shows leadership but little people-development signal — may lead through doing rather than growing others.', confidence: 'low', reasoning: 'Leadership signals without people-development signals.', signal_ids: b.leadership.map(function (s) { return s.signal_id; }) };
    return { statement: 'No strong constraint surfaced from the supplied material — references and more sources would sharpen this.', confidence: 'low', reasoning: 'Absence of constraint signal is not evidence of none.', signal_ids: [] };
  }
  function riskFrom(name, b, sources) {
    var sl = b.risk.concat(b.tenure_pattern);
    if (sl.length) return { statement: 'Continuity signals present (' + sl.length + ') — worth understanding the story behind transitions before relying on the picture.', confidence: 'medium', reasoning: sl.length + ' continuity/tenure signals.', signal_ids: sl.map(function (s) { return s.signal_id; }) };
    return { statement: 'No explicit risk signal; note that self-claim sources rarely surface risk — references and press would.', confidence: 'low', reasoning: 'Self-claim sources only.', signal_ids: [] };
  }

  function findContradictions(name, byType, store, personId) {
    var out = [];
    function fromObserved(re) { return store.pi_signals.filter(function (g) { return g.person_id === personId && OBSERVED_SOURCES.indexOf(srcType(g.source_id, store)) !== -1 && re.test(lc(g.evidence)); }); }
    function fromClaim(sl) { return sl.filter(function (s) { return CLAIM_SOURCES.indexOf(srcType(s.source_id, store)) !== -1; }); }
    // leadership claim vs no observed corroboration
    var leadClaim = fromClaim(byType.leadership);
    if (leadClaim.length && !byType.leadership.some(function (s) { return OBSERVED_SOURCES.indexOf(srcType(s.source_id, store)) !== -1; })) out.push({ tension: 'Stated leadership vs unobserved', claim: 'Résumé/LinkedIn claim leadership', observed: 'no press, article, or reference yet corroborates it', severity: 'moderate', signal_ids: leadClaim.map(function (s) { return s.signal_id; }) });
    // achievement numbers self-reported only
    var achClaim = fromClaim(byType.achievement);
    if (achClaim.length && !byType.achievement.some(function (s) { return OBSERVED_SOURCES.indexOf(srcType(s.source_id, store)) !== -1; })) out.push({ tension: 'Quantified claims vs verification', claim: 'Self-reported metrics (%/$/x)', observed: 'no third-party source confirms the numbers', severity: 'moderate', signal_ids: achClaim.map(function (s) { return s.signal_id; }) });
    // builder claim vs short tenure
    if (byType.innovation.length && byType.tenure_pattern.length) out.push({ tension: 'Builder narrative vs tenure', claim: 'Presents as a builder / 0-to-1', observed: 'short stints suggest things may not have been seen through', severity: 'major', signal_ids: byType.innovation.concat(byType.tenure_pattern).map(function (s) { return s.signal_id; }) });
    // autonomy vs process
    if (byType.autonomy.length && byType.execution.filter(function (s) { return /process|governance|compliance|sla/.test(lc(s.evidence)); }).length) out.push({ tension: 'Autonomy vs process', claim: 'Self-directed / autonomous', observed: 'also claims heavy process/governance work — which is the real preference?', severity: 'moderate', signal_ids: byType.autonomy.map(function (s) { return s.signal_id; }) });
    // leadership vs people-development absence
    if (byType.leadership.length >= 2 && !byType.people_development.length) out.push({ tension: 'Leads but develops?', claim: 'Led teams', observed: 'no signal of growing/mentoring people — leadership may be task not people', severity: 'moderate', signal_ids: byType.leadership.map(function (s) { return s.signal_id; }) });
    return out;
  }

  function buildValidationQuestions(name, h, byType, contradictions) {
    var vq = [];
    function q(target, question, src) { vq.push({ target: target, question: question, source: src }); }
    // candidate
    q('candidate', 'Walk me through why you moved between your last two roles — what were you moving toward?', 'tenure/growth');
    q('candidate', 'Of everything in your material, what are you proudest of building or owning end-to-end?', 'essence');
    if (byType.autonomy.length) q('candidate', 'Do you do your best work with high autonomy, or with clear structure around you?', 'frequency:Autonomy');
    q('candidate', 'Where does your public narrative overstate or understate how you actually work?', 'contradiction');
    q('candidate', 'What kind of environment brings out your worst?', 'constraint');
    // supervisor
    q('supervisor', 'Did ' + name + ' work best with high autonomy, or did they need regular structure and check-ins?', 'frequency:Autonomy');
    q('supervisor', 'When ' + name + ' said they "' + (byType.achievement[0] ? 'drove a number' : 'delivered') + '", how much was them versus the team?', 'achievement');
    q('supervisor', 'How did ' + name + ' behave when a project went wrong?', 'frequency:Pressure');
    q('supervisor', 'Would you hire ' + name + ' again, and into what kind of role specifically?', 'overall');
    q('supervisor', 'What did ' + name + ' need from you to do their best work?', 'constraint');
    // peer
    q('peer', 'How did ' + name + ' behave under pressure or conflicting priorities?', 'frequency:Pressure');
    q('peer', 'Was ' + name + ' someone who created clarity, or added ambiguity, for the people around them?', 'frequency:Communication');
    q('peer', 'Where did ' + name + ' add the most value — and where did they need support?', 'constraint');
    q('peer', 'How does ' + name + ' handle disagreement with a peer?', 'frequency:Communication');
    q('peer', 'Is ' + name + ' more energised by starting things or finishing them?', 'essence');
    // junior / direct report
    q('junior', 'Did ' + name + ' create clarity and grow you, or leave ambiguity?', 'frequency:People Development');
    q('junior', 'Did ' + name + ' give you room to own work, or stay closely involved?', 'leadership');
    q('junior', 'What did you learn from ' + name + ' that stuck?', 'frequency:People Development');
    q('junior', 'When you made a mistake, how did ' + name + ' respond?', 'frequency:Trust');
    q('junior', 'Would you choose to work for ' + name + ' again?', 'overall');
    return vq;
  }

  /* ---- references + consent --------------------------------- */
  function ensureReferenceRequest(personId, store) {
    store = ensure(store || OF.load());
    var r = byId(store.pi_reference_requests, 'person_id', personId);
    if (!r) { r = newReferenceRequest({ person_id: personId }); store.pi_reference_requests.push(r); OF.save(store); }
    return r;
  }
  function addReference(personId, fields, store) {
    store = ensure(store || OF.load());
    var r = ensureReferenceRequest(personId, store);
    var ref = {
      reference_id: uid('ref'), name: (fields || {}).name || '',
      relationship_type: REL_TYPES.indexOf((fields || {}).relationship_type) !== -1 ? fields.relationship_type : 'other',
      company: fields.company || '', designation: fields.designation || '', email: fields.email || '', phone: fields.phone || '',
      years_known: fields.years_known || '', permission_to_contact: !!fields.permission_to_contact,
      preferred_channel: CHANNELS.indexOf(fields.preferred_channel) !== -1 ? fields.preferred_channel : 'email', notes: fields.notes || ''
    };
    r.references.push(ref); r.updated_at = nowISO();
    // one thread per reference (placeholder; channels are hooks)
    store.pi_reference_threads.push(newRefThread({ reference_id: ref.reference_id, person_id: personId }));
    OF.save(store);
    return ref;
  }
  function removeReference(personId, refId, store) {
    store = ensure(store || OF.load());
    var r = byId(store.pi_reference_requests, 'person_id', personId);
    if (r) { r.references = r.references.filter(function (x) { return x.reference_id !== refId; }); r.updated_at = nowISO(); }
    store.pi_reference_threads = store.pi_reference_threads.filter(function (t) { return t.reference_id !== refId; });
    OF.save(store);
  }
  function setConsent(personId, granted, store) {
    store = ensure(store || OF.load());
    var r = ensureReferenceRequest(personId, store);
    r.consent = !!granted; r.consent_at = granted ? nowISO() : null; r.updated_at = nowISO();
    OF.save(store);
    return r;
  }
  // required categories vs what's collected
  function referenceCoverage(personId, store) {
    store = ensure(store || OF.load());
    var r = byId(store.pi_reference_requests, 'person_id', personId);
    var refs = r ? r.references : [];
    function count(types) { return refs.filter(function (x) { return types.indexOf(x.relationship_type) !== -1; }).length; }
    return {
      total: refs.length,
      supervisors: count(['supervisor']), peers: count(['peer']), juniors: count(['junior']),
      external: count(['client', 'customer', 'vendor', 'investor']), other: count(['mentor', 'other']),
      required: { supervisors: 2, peers: 2, juniors: 2, external: 2, discretionary: 2 }
    };
  }

  /* ---- confidence ------------------------------------------- */
  function score(sl, sources) {
    var n = sl.length;
    if (!n) return { level: 'low', reasoning: 'No supporting signal.' };
    var srcIds = {}; sl.forEach(function (s) { srcIds[s.source_id] = true; });
    var nSrc = Object.keys(srcIds).length;
    var observed = sl.some(function (s) { return s.confidence === 'high'; });
    var level = (n >= 4 && nSrc >= 2 && observed) ? 'high' : ((n >= 2 && nSrc >= 2) || observed) ? 'medium' : (n >= 2 ? 'medium' : 'low');
    return { level: level, reasoning: n + ' signal' + (n === 1 ? '' : 's') + ' across ' + nSrc + ' source' + (nSrc === 1 ? '' : 's') + (observed ? ', incl. an observed source' : ', self-claim sources only') + '.' };
  }
  function overallConfidence(sources, signals, onlyResume) {
    var nObs = sources.filter(function (s) { return OBSERVED_SOURCES.indexOf(s.source_type) !== -1; }).length;
    var hasRef = sources.some(function (s) { return s.source_type === 'reference'; });
    var level = 'low';
    if (onlyResume) level = 'low';
    else if (sources.length >= 4 && nObs >= 1 && signals.length >= 8) level = hasRef ? 'high' : 'medium';
    else if (sources.length >= 2 && signals.length >= 4) level = 'medium';
    var reasoning = sources.length + ' source' + (sources.length === 1 ? '' : 's') + ' (' + nObs + ' observed), ' + signals.length + ' signals. ' +
      (onlyResume ? 'Résumé only — treat all hypotheses as WEAK until corroborated.' : nObs ? 'Self-claim partly corroborated by observed sources.' : 'Self-claim sources only — add articles/press/references to harden.') +
      (hasRef ? ' Includes a reference — strongest signal class.' : ' No validated references yet.');
    return { level: level, reasoning: reasoning };
  }

  /* ---- reads ------------------------------------------------ */
  function readDim(dim, sl) {
    var ev = lc(sl.map(function (s) { return s.signal + ' ' + s.evidence; }).join(' '));
    if (dim === 'Pace') return /startup|fast|rapid|hyper|0-?to-?1/.test(ev) ? 'Comfortable at fast / startup pace' : 'Pace not clearly observable';
    if (dim === 'Leadership Style') return /found|chief|vp|head|director/.test(ev) ? 'Has held senior leadership' : 'Has led teams / projects';
    if (dim === 'Autonomy Level') return /found|solo|independent|self/.test(ev) ? 'Appears highly autonomous' : 'Autonomy present';
    if (dim === 'Innovation Requirement') return 'Building / innovation signal present';
    if (dim === 'Execution Discipline' || dim === 'Process Maturity') return 'Execution / delivery signal present';
    if (dim === 'Communication Style') return 'Communicates publicly / writes';
    if (dim === 'People Development Orientation') return 'Develops others (signal present)';
    if (dim === 'Pressure Tolerance') return 'Has operated under pressure';
    if (dim === 'Trust / Goodness Layer') return 'Expresses values';
    return 'Signal present';
  }
  function getPersonIntel(personId, store) {
    store = ensure(store || OF.load());
    return {
      person: byId(store.persons, 'person_id', personId),
      sources: store.pi_sources.filter(function (s) { return s.person_id === personId; }),
      signals: store.pi_signals.filter(function (g) { return g.person_id === personId; }),
      brief: byId(store.pi_briefs, 'person_id', personId),
      reference_request: byId(store.pi_reference_requests, 'person_id', personId),
      reference_threads: store.pi_reference_threads.filter(function (t) { return t.person_id === personId; }),
      coverage: referenceCoverage(personId, store)
    };
  }
  function srcType(srcId, store) { var s = byId(store.pi_sources, 'source_id', srcId); return s ? s.source_type : 'other'; }

  OF.personIntel = {
    SOURCE_TYPES: SOURCE_TYPES, SIGNAL_TYPES: SIGNAL_TYPES, REL_TYPES: REL_TYPES, REF_STATUS: REF_STATUS, CHANNELS: CHANNELS,
    OBSERVED_SOURCES: OBSERVED_SOURCES, CLAIM_SOURCES: CLAIM_SOURCES, WEB_SEARCH_IMPLEMENTED: false,
    ensure: ensure, createPerson: createPerson, people: people,
    addSource: addSource, deleteSource: deleteSource, extractSignals: extractSignals, generateBrief: generateBrief,
    ensureReferenceRequest: ensureReferenceRequest, addReference: addReference, removeReference: removeReference,
    setConsent: setConsent, referenceCoverage: referenceCoverage,
    getPersonIntel: getPersonIntel
  };
})();
