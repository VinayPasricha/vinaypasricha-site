/* =============================================================
   Organizational Frequency — Interview Orchestration  (Build 2F)
   =============================================================
   An interview is not merely evaluation — it is VALIDATION. Public
   research creates hypotheses; interviews validate or contradict
   them. Interview evidence updates the person's living frequency
   through the SAME gated path used everywhere:

       Interview Evidence → Validation → Validated Understanding
       → Person Frequency Evolution → Resonance Recompute → Learning

   REUSE (no new person model): OF.person (ingestEvidence,
   syncHypotheses, recordValidation, derivePersonFrequency) is the
   validation engine; the 1L recompute/evolution pattern is applied
   to the PERSON side here. Raw transcript NEVER updates frequency —
   only validated interview understanding does, and every change
   emits an evolution event with history preserved.

   HONESTY: calendar / video / recording / transcription are
   provider hooks (NOT IMPLEMENTED) — scheduling and transcript are
   manual. No scoring, no ranking, no hire/reject automation.

   Augments window.OF with window.OF.interview.
   ============================================================= */
(function () {
  'use strict';
  if (!window.OF) { console.warn('of-interview.js requires of-model.js'); return; }
  var OF = window.OF;
  var P = OF.person;

  var DIMENSIONS = (P && P.DIMENSIONS) || (OF.frequency && OF.frequency.DIMENSIONS) || [];
  var STATUS = ['proposed', 'invited', 'scheduled', 'completed', 'analyzed', 'cancelled'];
  var TYPES = ['screening', 'technical', 'manager', 'culture', 'final', 'reference', 'other'];
  var CONTRA_TYPES = ['public_read_vs_interview', 'interviewer_vs_interviewer', 'candidate_vs_reference', 'interview_vs_resonance', 'other'];
  var CHANGE_TYPES = (OF.evolution && OF.evolution.CHANGE_TYPES) || ['confirmed', 'refined', 'contradicted', 'strengthened', 'weakened', 'unknown_to_known'];
  var LEVELS = (P && P.LEVELS) || ['low', 'moderate', 'high', 'very_high'];
  var human = (P && P.human) || function (l) { return l === 'very_high' ? 'very high' : l; };

  function nowISO() { return new Date().toISOString(); }
  function uid(p) { return OF.uid(p); }
  function byId(arr, key, val) { return (arr || []).filter(function (x) { return x[key] === val; })[0] || null; }
  function lc(s) { return (s == null) ? '' : String(s).toLowerCase(); }
  function lvlIdx(l) { return LEVELS.indexOf(l); }

  function ensure(store) {
    store.interview_records = store.interview_records || [];
    store.interview_evidence = store.interview_evidence || [];
    store.interview_analyses = store.interview_analyses || [];
    store.person_contradictions = store.person_contradictions || [];
    store.person_frequency_evolution = store.person_frequency_evolution || [];
    return store;
  }

  /* ===== SCHEMAS ===== */
  function newInterview(f) {
    f = f || {};
    return {
      interview_id: f.interview_id || uid('intv'), mandate_id: f.mandate_id || null, candidate_id: f.candidate_id || null,
      person_id: f.person_id || null, organization_id: f.organization_id || null, role_id: f.role_id || null,
      round: f.round || 1, interview_type: TYPES.indexOf(f.interview_type) !== -1 ? f.interview_type : 'screening',
      status: STATUS.indexOf(f.status) !== -1 ? f.status : 'proposed',
      participants: f.participants || [], scheduled_at: f.scheduled_at || null,
      recording_url: f.recording_url || '', transcript: f.transcript || '',
      questions: f.questions || [], outcome: f.outcome || '',
      created_at: f.created_at || nowISO(), updated_at: nowISO()
    };
  }
  function newEvidence(f) {
    f = f || {};
    return { evidence_id: f.evidence_id || uid('iev'), interview_id: f.interview_id || null, candidate_id: f.candidate_id || null, dimension: f.dimension || null, statement: f.statement || '', level: f.level || 'moderate', confidence: f.confidence || 0.7, source: 'interview', created_at: f.created_at || nowISO() };
  }
  function newAnalysis(f) {
    f = f || {};
    return { analysis_id: f.analysis_id || uid('ianl'), interview_id: f.interview_id || null, candidate_id: f.candidate_id || null, summary: f.summary || '', dimension_findings: f.dimension_findings || [], validation_questions_answered: f.validation_questions_answered || [], contradictions_found: f.contradictions_found || [], frequency_updates: f.frequency_updates || [], resonance_updates: f.resonance_updates || [], learning_signals: f.learning_signals || [], confidence: f.confidence || 'medium', created_at: f.created_at || nowISO() };
  }
  function newContradiction(f) {
    f = f || {};
    return { contradiction_id: f.contradiction_id || uid('pcon'), candidate_id: f.candidate_id || null, person_id: f.person_id || null, dimension: f.dimension || null, statement_a: f.statement_a || '', source_a: f.source_a || '', statement_b: f.statement_b || '', source_b: f.source_b || '', severity: f.severity || 'moderate', contra_type: CONTRA_TYPES.indexOf(f.contra_type) !== -1 ? f.contra_type : 'public_read_vs_interview', status: f.status || 'open', resolution: f.resolution || '', created_at: f.created_at || nowISO(), updated_at: nowISO() };
  }
  function newEvoEvent(f) {
    f = f || {};
    return { event_id: f.event_id || uid('pfev'), person_id: f.person_id || null, candidate_id: f.candidate_id || null, dimension: f.dimension || null, previous_level: f.previous_level || 'unknown', new_level: f.new_level || 'unknown', change_type: CHANGE_TYPES.indexOf(f.change_type) !== -1 ? f.change_type : 'refined', evidence: f.evidence || [], confidence: f.confidence || 'medium', reasoning: f.reasoning || '', created_at: f.created_at || nowISO() };
  }

  /* ===== resolve the person behind a candidate (1P/1O/1N) ===== */
  function personForCandidate(candidateId, store) {
    var c = byId(store.cd_candidates, 'candidate_discovery_id', candidateId);
    if (!c) return null;
    if (c.research_request_id && OF.personResearch) {
      var rr = OF.personResearch.getRequest(c.research_request_id, store);
      if (rr && rr.person) return rr.person.person_id;
    }
    return null;
  }
  function ensurePerson(candidateId, store) {
    var pid = personForCandidate(candidateId, store);
    if (pid) return pid;
    var c = byId(store.cd_candidates, 'candidate_discovery_id', candidateId);
    var p = P.createPerson({ name: c ? c.person_name : 'Candidate', source: 'interview' }, store);
    return p.person_id;
  }

  /* ===== interview lifecycle ===== */
  function createInterview(fields, store) {
    store = ensure(store || OF.load());
    fields = fields || {};
    var c = fields.candidate_id ? byId(store.cd_candidates, 'candidate_discovery_id', fields.candidate_id) : null;
    var mandate = (c && c.mandate_id) ? byId(store.mandates, 'mandate_id', c.mandate_id) : (fields.mandate_id ? byId(store.mandates, 'mandate_id', fields.mandate_id) : null);
    var pid = fields.candidate_id ? ensurePerson(fields.candidate_id, OF.load()) : (fields.person_id || null);
    store = ensure(OF.load());
    var rec = newInterview(Object.assign({}, fields, {
      person_id: pid, mandate_id: mandate ? mandate.mandate_id : fields.mandate_id || null,
      organization_id: mandate ? mandate.organization_id : fields.organization_id || null,
      role_id: mandate ? mandate.role_id : fields.role_id || null,
      questions: fields.questions && fields.questions.length ? fields.questions : generateQuestions(pid, mandate, store),
      status: 'proposed'
    }));
    store.interview_records.push(rec);
    OF.save(store);
    return rec;
  }
  function setStatus(interviewId, status, store) {
    store = ensure(store || OF.load());
    var r = byId(store.interview_records, 'interview_id', interviewId);
    if (r && STATUS.indexOf(status) !== -1) { r.status = status; r.updated_at = nowISO(); OF.save(store); }
    return r;
  }
  function schedule(interviewId, at, participants, store) {
    store = ensure(store || OF.load());
    var r = byId(store.interview_records, 'interview_id', interviewId);
    if (!r) return null;
    r.scheduled_at = at || nowISO(); r.participants = participants || r.participants; r.status = 'scheduled'; r.updated_at = nowISO();
    OF.save(store); return r;
  }
  function addTranscript(interviewId, transcript, store) {
    store = ensure(store || OF.load());
    var r = byId(store.interview_records, 'interview_id', interviewId);
    if (!r) return null;
    r.transcript = transcript || ''; if (r.status === 'scheduled' || r.status === 'invited' || r.status === 'proposed') r.status = 'completed'; r.updated_at = nowISO();
    OF.save(store); return r;
  }

  /* ===== questions come from hypotheses / gaps (never generic) ===== */
  function generateQuestions(personId, mandate, store) {
    var qs = [];
    var pf = personId ? (store.person_frequencies || []).filter(function (x) { return x.person_id === personId; })[0] : null;
    // validation questions from the person research brief
    if (personId && store.pi_briefs) {
      var brief = store.pi_briefs.filter(function (b) { return b.person_id === personId; })[0];
      if (brief && brief.validation_questions) brief.validation_questions.slice(0, 4).forEach(function (q) { qs.push({ question: q.question, maps_to: q.source || 'person_hypothesis' }); });
    }
    // role-gap questions
    var rf = mandate && mandate.role_id ? (store.role_frequencies || []).filter(function (x) { return x.role_id === mandate.role_id; })[0] : null;
    if (rf && rf.dimensions) rf.dimensions.filter(function (d) { return d.primary; }).slice(0, 2).forEach(function (d) { qs.push({ question: 'The role centres on ' + lc(d.dimension) + ' at ' + human(d.required_level) + '. Tell me about a time that demanded exactly that.', maps_to: 'role_frequency:' + d.dimension }); });
    if (!qs.length) qs.push({ question: 'Walk me through the work you are proudest of owning end to end.', maps_to: 'essence' });
    return qs;
  }

  /* ===== ANALYZE — transcript → evidence → validation → frequency ===== */
  var DIM_CUES = {
    'Pace': /\b(fast|rapid|quick|speed|momentum|urgen|deliberate|measured|steady|slow)\b/,
    'Execution Discipline': /\b(ship|deliver|finish|follow.?through|discipline|rigor|reliab|process|detail|loose|improvis)\b/,
    'Communication Style': /\b(communicat|candid|direct|transparen|listen|reserved|diplomatic|written|async)\b/,
    'Pressure Tolerance': /\b(pressure|deadline|stress|crisis|calm|thrive|overwhelm|burn|firefight|stakes)\b/,
    'Leadership Style': /\b(lead|led|manage|managed|mentor|direction|vision|team|follow|contribute|rally)\b/,
    'Autonomy Level': /\b(autonom|ownership|own|independent|freedom|self.?direct|guidance|structure|micromanag|decide)\b/,
    'Innovation Requirement': /\b(new|novel|invent|create|build|0.?to.?1|greenfield|experiment|refine|optimis|maintain|proven)\b/,
    'Process Maturity': /\b(process|system|framework|structure|rhythm|organis|plan|chaos|ad.?hoc|unstructured)\b/,
    'Trust / Goodness Layer': /\b(trust|integrity|honest|values|fair|respect|safety|care|right thing)\b/,
    'People Development Orientation': /\b(develop|grow|coach|mentor|teach|nurtur|junior|grew the team|my own)\b/
  };

  function analyze(interviewId, store) {
    store = ensure(store || OF.load());
    var r = byId(store.interview_records, 'interview_id', interviewId);
    if (!r) return { error: 'Interview not found.' };
    if (!r.transcript || !r.transcript.trim()) return { error: 'Add a transcript before analysis — no fake transcripts.' };
    if (!r.person_id) return { error: 'No person linked to this interview.' };
    var personId = r.person_id;

    // snapshot the PRE-interview (public/prior) person frequency for evolution + contradiction
    var prevPF = (store.person_frequencies || []).filter(function (x) { return x.person_id === personId; })[0];
    var prevLevels = {};
    DIMENSIONS.forEach(function (d) { var dd = prevPF && (prevPF.dimensions || []).filter(function (x) { return x.dimension === d; })[0]; prevLevels[d] = dd ? dd.level : 'unknown'; });

    // 1. transcript → InterviewEvidence per dimension it actually speaks to
    var text = r.transcript;
    var made = [];
    DIMENSIONS.forEach(function (dim) {
      var cue = DIM_CUES[dim];
      if (cue && cue.test(lc(text))) {
        var read = P.readDimension ? P.readDimension(dim, text) : { level: 'moderate', statement: dim };
        var ev = newEvidence({ interview_id: interviewId, candidate_id: r.candidate_id, dimension: dim, statement: read.statement, level: read.level, confidence: 0.72 });
        store.interview_evidence.push(ev);
        made.push(ev);
        // feed the 1G person engine: interview evidence (high confidence, first-party)
        P.ingestEvidence(personId, { source: 'assessment', statement: read.statement, dimensions: [dim], confidence: 0.72 }, store);
        store = ensure(OF.load());
      }
    });
    // 2. hypotheses + validation (interview answers VALIDATE — first-party, supported)
    P.syncHypotheses(personId, store); store = ensure(OF.load());
    var evidenceByDim = {}; made.forEach(function (e) { evidenceByDim[e.dimension] = e; });
    var queue = P.nextToValidate(personId, undefined, store) || [];
    queue.forEach(function (h) {
      if (evidenceByDim[h.dimension]) { P.recordValidation(h.hypothesis_id, 'accurate', 'assessment', 'Validated in interview ' + interviewId, store); store = ensure(OF.load()); }
    });
    var newPF = P.derivePersonFrequency(personId, store); store = ensure(OF.load());

    // 3. evolution events (prev vs post) — only changed/known dims, history preserved
    var evoEvents = [], freqUpdates = [];
    DIMENSIONS.forEach(function (dim) {
      var postDim = (newPF.dimensions || []).filter(function (x) { return x.dimension === dim; })[0];
      var newLevel = postDim ? postDim.level : 'unknown';
      if (newLevel === 'unknown') return;
      var prev = prevLevels[dim];
      if (prev === newLevel && prev !== 'unknown') return; // no change, already known
      var ct = changeType(prev, newLevel);
      var ev = newEvoEvent({ person_id: personId, candidate_id: r.candidate_id, dimension: dim, previous_level: prev, new_level: newLevel, change_type: ct, evidence: evidenceByDim[dim] ? [evidenceByDim[dim].evidence_id] : [], confidence: 'high', reasoning: 'Interview ' + r.interview_type + ' validated ' + lc(dim) + ' at ' + human(newLevel) + (prev !== 'unknown' ? ' (was ' + human(prev) + ' on public signal).' : ' (previously unknown).') });
      store.person_frequency_evolution.push(ev);
      evoEvents.push(ev); freqUpdates.push(dim + ': ' + human(prev) + ' → ' + human(newLevel));
    });

    // 4. contradictions: interview level vs prior public read (materially different)
    var contradictions = [];
    DIMENSIONS.forEach(function (dim) {
      var prev = prevLevels[dim]; var postDim = (newPF.dimensions || []).filter(function (x) { return x.dimension === dim; })[0];
      if (!postDim || postDim.level === 'unknown' || prev === 'unknown') return;
      if (Math.abs(lvlIdx(postDim.level) - lvlIdx(prev)) >= 2) {
        var con = newContradiction({ candidate_id: r.candidate_id, person_id: personId, dimension: dim, statement_a: 'Public read: ' + human(prev), source_a: 'public_research', statement_b: 'Interview: ' + human(postDim.level), source_b: 'interview', severity: 'major', contra_type: 'public_read_vs_interview' });
        store.person_contradictions.push(con); contradictions.push(con);
        // lower confidence on the dimension — contradiction is signal, not firming
        if (postDim) postDim.confidence = Math.min(postDim.confidence, 0.5);
      }
    });

    // 5. resonance recompute — mark stale (never silent overwrite)
    var resonanceUpdates = markResonanceStale(personId, r.candidate_id, store);

    // 6. learning signals
    var signals = [];
    if (OF.hiring) {
      var s1 = OF.hiring.captureSignal('interview', { mandate_id: r.mandate_id, candidate_id: r.candidate_id, signal: 'Interview (' + r.interview_type + ') analyzed: ' + made.length + ' evidence, ' + evoEvents.length + ' frequency change(s), ' + contradictions.length + ' contradiction(s).', confidence: 'high' }, store);
      store = ensure(OF.load()); if (s1) signals.push(s1.signal_id);
    }

    // 7. analysis record
    store.interview_analyses = store.interview_analyses.filter(function (a) { return a.interview_id !== interviewId; });
    var analysis = newAnalysis({
      interview_id: interviewId, candidate_id: r.candidate_id,
      summary: 'Interview validated ' + made.length + ' of ' + DIMENSIONS.length + ' frequency dimensions first-hand; ' + evoEvents.length + ' moved the living person frequency' + (contradictions.length ? ', ' + contradictions.length + ' contradicted the public read' : '') + '. First-party evidence, higher confidence than public signal.',
      dimension_findings: made.map(function (e) { return { dimension: e.dimension, level: e.level, statement: e.statement }; }),
      validation_questions_answered: (r.questions || []).map(function (q) { return q.question; }),
      contradictions_found: contradictions.map(function (c) { return c.contradiction_id; }),
      frequency_updates: freqUpdates, resonance_updates: resonanceUpdates, learning_signals: signals, confidence: made.length >= 5 ? 'high' : 'medium'
    });
    store.interview_analyses.push(analysis);
    r.status = 'analyzed'; r.outcome = analysis.summary; r.updated_at = nowISO();
    OF.save(store);
    return { analysis: analysis, evidence: made, evolution: evoEvents, contradictions: contradictions, person_frequency: newPF };
  }

  function changeType(prev, next) {
    if (!prev || prev === 'unknown') return 'unknown_to_known';
    var pi = lvlIdx(prev), ni = lvlIdx(next);
    if (pi === -1 || ni === -1) return 'refined';
    if (ni > pi) return 'strengthened';
    if (ni < pi) return 'weakened';
    return 'confirmed';
  }

  /* ===== mark resonance / emergent outcomes stale for this person ===== */
  function markResonanceStale(personId, candidateId, store) {
    store = ensure(store || OF.load());
    var updates = [];
    (store.emergent_outcomes || []).filter(function (o) { return o.person_id === personId && o.generated; }).forEach(function (o) {
      o.stale = true; o.stale_reason = 'Person frequency changed after interview validation — regenerate to refresh these futures.'; o.updated_at = nowISO();
      updates.push(o.outcome_id);
    });
    // 1P candidate resonance — flag stale so the offer gate trips (persist immediately)
    var any = false;
    (store.cd_resonance || []).filter(function (x) { return x.candidate_discovery_id === candidateId; }).forEach(function (x) { x.stale = true; any = true; });
    if (any || updates.length) OF.save(store);
    return updates.length ? updates : (any ? ['cd_resonance'] : []);
  }
  // regenerate resonance for the candidate (reuses the emergent-outcome engine)
  function regenerateResonance(candidateId, store) {
    store = ensure(store || OF.load());
    if (!OF.outreach) return { error: 'Outreach/resonance engine unavailable.' };
    var res = OF.outreach.researchAndScreen(candidateId, store);
    if (res && res.error) return { error: res.error };
    return { resonance: res.resonance };
  }

  function resolveContradiction(contradictionId, resolution, store) {
    store = ensure(store || OF.load());
    var c = byId(store.person_contradictions, 'contradiction_id', contradictionId);
    if (c) { c.status = 'resolved'; c.resolution = resolution || 'reviewed'; c.updated_at = nowISO(); OF.save(store); }
    return c;
  }

  /* ===== reads ===== */
  function getInterview(interviewId, store) {
    store = ensure(store || OF.load());
    var r = byId(store.interview_records, 'interview_id', interviewId);
    if (!r) return null;
    return { interview: r, evidence: store.interview_evidence.filter(function (e) { return e.interview_id === interviewId; }), analysis: byId(store.interview_analyses, 'interview_id', interviewId), contradictions: store.person_contradictions.filter(function (c) { return c.person_id === r.person_id; }), evolution: store.person_frequency_evolution.filter(function (e) { return e.person_id === r.person_id; }), person_frequency: (store.person_frequencies || []).filter(function (x) { return x.person_id === r.person_id; })[0] || null };
  }
  function getInterviews(store) { store = ensure(store || OF.load()); return store.interview_records.slice().sort(function (a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); }); }
  function interviewableCandidates(store) {
    store = ensure(store || OF.load());
    return (store.cd_candidates || []).map(function (c) { return { candidate_discovery_id: c.candidate_discovery_id, name: c.person_name, status: c.status }; });
  }
  function resetInterviews(store) {
    store = ensure(store || OF.load());
    store.interview_records = []; store.interview_evidence = []; store.interview_analyses = []; store.person_contradictions = []; store.person_frequency_evolution = [];
    OF.save(store);
  }

  OF.interview = {
    STATUS: STATUS, TYPES: TYPES, CONTRA_TYPES: CONTRA_TYPES, DIMENSIONS: DIMENSIONS,
    ensure: ensure, createInterview: createInterview, setStatus: setStatus, schedule: schedule, addTranscript: addTranscript,
    generateQuestions: generateQuestions, analyze: analyze, regenerateResonance: regenerateResonance, resolveContradiction: resolveContradiction,
    markResonanceStale: markResonanceStale, personForCandidate: personForCandidate,
    getInterview: getInterview, getInterviews: getInterviews, interviewableCandidates: interviewableCandidates, resetInterviews: resetInterviews, human: human
  };
})();
