/* =============================================================
   Organizational Frequency — Live Hiring Execution Runtime (1M)
   =============================================================
   The LAUNCH operational layer. Builds on 1A–1L WITHOUT
   redesigning the doctrine, frequency, or discovery.

   The system can understand. Now it must EXECUTE. The objective
   is real hires, real joins, real outcomes, real learning — a
   recruiter can run a mandate next week.

   The runtime exists to help organizations discover people and
   people discover organizations through Organizational Frequency.

   KEY REUSE (no new models):
     • Fast Frequency Discovery wraps the 1G person engine
       (evidence → hypothesis → validation → person frequency).
     • Resonance Analysis wraps the 1H/1I Emergent Outcome engine.
       NO score, NO ranking, NO percentage, NO fit score — only
       future-state analysis.

   Recruiters stay in control: no sourcing automation, no bulk
   outreach, no auto-offers, no autonomous agents. Every candidate
   interaction, on any channel, writes into ONE CandidateThread.

   Augments window.OF with window.OF.hiring.
   ============================================================= */
(function () {
  'use strict';
  if (!window.OF) { console.warn('of-hiring.js requires of-model.js'); return; }
  var OF = window.OF;

  var CANDIDATE_STATUS = ['new', 'contacted', 'frequency_discovery', 'qualified', 'submitted', 'interviewing', 'offered', 'joined', 'rejected', 'withdrawn'];
  var PIPELINE_STAGES = ['New', 'Researching', 'Candidate Discovery', 'Frequency Discovery', 'Shortlisting', 'Client Review', 'Client Interview', 'Offer', 'Join', 'Closed'];
  // candidate status → pipeline stage
  var STATUS_STAGE = {
    'new': 'New', 'contacted': 'Candidate Discovery', 'frequency_discovery': 'Frequency Discovery',
    'qualified': 'Shortlisting', 'submitted': 'Client Review', 'interviewing': 'Client Interview',
    'offered': 'Offer', 'joined': 'Join', 'rejected': 'Closed', 'withdrawn': 'Closed'
  };
  var CHANNELS = ['website', 'email', 'whatsapp', 'voice'];
  var EMPLOYER_DECISIONS = ['advance', 'hold', 'reject', 'offer'];
  var SIGNAL_SOURCES = ['employer_feedback', 'candidate_feedback', 'join_outcome', 'discovery'];

  function nowISO() { return new Date().toISOString(); }
  function uid(p) { return OF.uid(p); }
  function byId(arr, key, val) { return (arr || []).filter(function (x) { return x[key] === val; })[0] || null; }

  function ensure(store) {
    store.candidates = store.candidates || [];
    store.candidate_threads = store.candidate_threads || [];
    store.resonance_analyses = store.resonance_analyses || [];
    store.shortlist_workspaces = store.shortlist_workspaces || [];
    store.employer_feedback = store.employer_feedback || [];
    store.candidate_feedback = store.candidate_feedback || [];
    store.join_outcomes = store.join_outcomes || [];
    store.learning_signals = store.learning_signals || [];
    return store;
  }

  /* ==========================================================
     BUILD OBJECT 1 — CANDIDATE  (mandate_id added for the pipeline)
     ========================================================== */
  function newCandidate(f) {
    f = f || {};
    return {
      candidate_id: f.candidate_id || uid('cand'),
      person_id: f.person_id || null,
      mandate_id: f.mandate_id || null,     // operational: which mandate pipeline
      owner: f.owner || '',                 // recruiter name
      name: f.name || '',
      source: f.source || 'manual',         // manual | referral | inbound | …
      resume: f.resume || '',
      linkedin: f.linkedin || '',
      current_company: f.current_company || '',
      current_title: f.current_title || '',
      location: f.location || '',
      status: CANDIDATE_STATUS.indexOf(f.status) !== -1 ? f.status : 'new',
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }

  /* ==========================================================
     BUILD OBJECT 2 — CANDIDATE THREAD (one candidate, many channels)
     ========================================================== */
  function newThread(f) {
    f = f || {};
    return {
      thread_id: f.thread_id || uid('cthr'),
      candidate_id: f.candidate_id || null,
      messages: f.messages || [],            // {role, channel, text, at}
      memory_links: f.memory_links || [],
      open_questions: f.open_questions || [],
      validated_answers: f.validated_answers || [],
      channel_history: f.channel_history || [],
      last_interaction: f.last_interaction || null
    };
  }

  /* ==========================================================
     BUILD OBJECT 5 — RESONANCE ANALYSIS (future-state, no score)
     ========================================================== */
  function newResonance(f) {
    f = f || {};
    return {
      resonance_id: f.resonance_id || uid('res'),
      candidate_id: f.candidate_id || null,
      mandate_id: f.mandate_id || null,
      emergent_outcome_id: f.emergent_outcome_id || null,
      summary: f.summary || '',
      confidence: f.confidence || 'unknown',  // descriptive
      risks: f.risks || [],
      growth_opportunities: f.growth_opportunities || [],
      mission_contribution: f.mission_contribution || '',
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }

  /* ==========================================================
     BUILD OBJECT 6 — SHORTLIST WORKSPACE
     ========================================================== */
  function newShortlist(f) {
    f = f || {};
    return {
      workspace_id: f.workspace_id || uid('slw'),
      mandate_id: f.mandate_id || null,
      candidates: f.candidates || [],        // candidate_id[]
      notes: f.notes || '',
      client_feedback: f.client_feedback || '',
      recruiter_feedback: f.recruiter_feedback || '',
      status: f.status || 'open',            // open | sent_to_client | closed
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }

  /* ==========================================================
     BUILD OBJECTS 7/8 — EMPLOYER / CANDIDATE FEEDBACK
     ========================================================== */
  function newEmployerFeedback(f) {
    f = f || {};
    return {
      feedback_id: f.feedback_id || uid('efb'),
      candidate_id: f.candidate_id || null,
      mandate_id: f.mandate_id || null,
      feedback: f.feedback || '',
      decision: EMPLOYER_DECISIONS.indexOf(f.decision) !== -1 ? f.decision : 'hold',
      reason: f.reason || '',
      created_at: f.created_at || nowISO()
    };
  }
  function newCandidateFeedback(f) {
    f = f || {};
    return {
      feedback_id: f.feedback_id || uid('cfb'),
      candidate_id: f.candidate_id || null,
      mandate_id: f.mandate_id || null,
      feedback: f.feedback || '',
      interest_level: f.interest_level || 'unknown', // high | medium | low | unknown
      concerns: f.concerns || [],
      created_at: f.created_at || nowISO()
    };
  }

  /* ==========================================================
     BUILD OBJECT 9 — JOIN OUTCOME (the first real reality signal)
     ========================================================== */
  function newJoin(f) {
    f = f || {};
    return {
      join_id: f.join_id || uid('join'),
      candidate_id: f.candidate_id || null,
      mandate_id: f.mandate_id || null,
      joined: !!f.joined,
      join_date: f.join_date || null,
      '30_day_status': f['30_day_status'] || 'pending',
      '90_day_status': f['90_day_status'] || 'pending',
      notes: f.notes || '',
      created_at: f.created_at || nowISO()
    };
  }

  /* ==========================================================
     BUILD OBJECT 10 — LEARNING SIGNAL (captured, not auto-applied)
     ========================================================== */
  function newSignal(f) {
    f = f || {};
    return {
      signal_id: f.signal_id || uid('sig'),
      source: SIGNAL_SOURCES.indexOf(f.source) !== -1 ? f.source : 'discovery',
      mandate_id: f.mandate_id || null,
      candidate_id: f.candidate_id || null,
      signal: f.signal || '',
      confidence: f.confidence || 'low',
      created_at: f.created_at || nowISO()
    };
  }
  function captureSignal(source, fields, store) {
    store = ensure(store || OF.load());
    var s = newSignal(Object.assign({ source: source }, fields || {}));
    store.learning_signals.push(s);
    return s;
  }

  /* ==========================================================
     CANDIDATE CRUD + THREAD
     A candidate is a Person in a hiring context. Creating one
     also creates the underlying Person (1G) so frequency can attach.
     ========================================================== */
  function addCandidate(mandateId, fields, store) {
    store = ensure(store || OF.load());
    fields = fields || {};
    var personId = fields.person_id;
    if (!personId && OF.person) {
      var p = OF.person.createPerson({
        name: fields.name || '', current_title: fields.current_title || '',
        current_company: fields.current_company || '', location: fields.location || '',
        source: 'candidate'
      }, store);
      store = OF.load(); ensure(store);
      personId = p.person_id;
    }
    var c = newCandidate(Object.assign({}, fields, { mandate_id: mandateId, person_id: personId }));
    store.candidates.push(c);
    store.candidate_threads.push(newThread({ candidate_id: c.candidate_id }));
    OF.save(store);
    return c;
  }
  function setStatus(candidateId, status, store) {
    store = ensure(store || OF.load());
    var c = byId(store.candidates, 'candidate_id', candidateId);
    if (!c || CANDIDATE_STATUS.indexOf(status) === -1) return null;
    c.status = status; c.updated_at = nowISO();
    OF.save(store);
    return c;
  }
  function addThreadMessage(candidateId, channel, role, text, store) {
    store = ensure(store || OF.load());
    var t = byId(store.candidate_threads, 'candidate_id', candidateId);
    if (!t) return null;
    channel = CHANNELS.indexOf(channel) !== -1 ? channel : 'website';
    t.messages.push({ role: role || 'recruiter', channel: channel, text: text || '', at: nowISO() });
    if (t.channel_history.indexOf(channel) === -1) t.channel_history.push(channel);
    t.last_interaction = nowISO();
    OF.save(store);
    return t;
  }

  /* ==========================================================
     BUILD OBJECT 4 — FREQUENCY DISCOVERY FAST FLOW
     15-minute flow. Reuses the 1G engine: each answer → evidence,
     hypotheses formed, then validated (the candidate's self-report
     captured on the call) → Person Frequency. No new models.
     answers = { energy, structure, autonomy, pressure, friction,
                 leadership, trust }  (keys mirror OF.person.DISCOVERY)
     ========================================================== */
  function runFrequencyDiscovery(candidateId, answers, store) {
    store = ensure(store || OF.load());
    var c = byId(store.candidates, 'candidate_id', candidateId);
    if (!c || !c.person_id || !OF.person) return null;
    answers = answers || {};
    var qs = OF.person.DISCOVERY || [];
    var any = false;
    qs.forEach(function (q) {
      var a = (answers[q.key] || '').trim();
      if (!a) return;
      any = true;
      OF.person.ingestEvidence(c.person_id, { source: 'conversation', statement: a, dimensions: q.dimensions || [], confidence: 0.5 }, store);
      store = OF.load(); ensure(store);
    });
    if (!any) return { error: 'Add at least one note from the frequency conversation.' };
    OF.person.syncHypotheses(c.person_id, store);
    store = OF.load(); ensure(store);
    // validate (self-report captured on the call) → person frequency
    var queue = OF.person.nextToValidate(c.person_id, undefined, store);
    queue.forEach(function (h) { OF.person.recordValidation(h.hypothesis_id, 'accurate', 'self'); store = OF.load(); ensure(store); });
    var pf = OF.person.derivePersonFrequency(c.person_id, store);
    // thread record + status
    addThreadMessage(candidateId, 'voice', 'aeon', 'Ran a 15-minute frequency conversation.', store);
    store = OF.load(); ensure(store);
    var cc = byId(store.candidates, 'candidate_id', candidateId);
    if (cc && (cc.status === 'new' || cc.status === 'contacted')) { cc.status = 'frequency_discovery'; cc.updated_at = nowISO(); }
    captureSignal('discovery', { mandate_id: cc ? cc.mandate_id : null, candidate_id: candidateId, signal: 'Person frequency captured via fast discovery.', confidence: 'medium' }, store);
    OF.save(store);
    return { person_frequency: pf };
  }

  /* ==========================================================
     RESONANCE ANALYSIS — wraps the Emergent Outcome engine.
     Requires the candidate's person frequency + the mandate's role.
     Future-state only: summary, risks, growth, mission contribution.
     ========================================================== */
  function generateResonance(candidateId, store) {
    store = ensure(store || OF.load());
    var c = byId(store.candidates, 'candidate_id', candidateId);
    if (!c) return { error: 'Candidate not found.' };
    var mandate = byId(store.mandates, 'mandate_id', c.mandate_id);
    if (!mandate || !mandate.role_id) return { error: 'This candidate\u2019s mandate has no defined role yet.' };
    var pf = (store.person_frequencies || []).filter(function (x) { return x.person_id === c.person_id; })[0];
    if (!pf || !(pf.dimensions || []).some(function (d) { return d.level !== 'unknown'; })) {
      return { error: 'Run Frequency Discovery first — resonance needs a person frequency.' };
    }
    if (!OF.outcome || !OF.outcome.frameOutcome || !OF.outcome.generate) return { error: 'Emergent Outcome engine not loaded.' };

    var framed = OF.outcome.frameOutcome(mandate.role_id, c.person_id, '90_days', store);
    if (!framed) return { error: 'Could not frame an outcome.' };
    store = OF.load(); ensure(store);
    var gen = OF.outcome.generate(framed.outcome.outcome_id, store);
    store = OF.load(); ensure(store);

    var po = gen.person_outcome, ro = gen.risk_outcome, mo = gen.mission_outcome;
    var growth = (po && po.growth_vectors || []).map(itemText);
    var risks = (ro && ro.identified_risks || []).map(itemText);

    // replace any prior resonance for this candidate+mandate
    store.resonance_analyses = store.resonance_analyses.filter(function (r) { return !(r.candidate_id === candidateId && r.mandate_id === c.mandate_id); });
    var res = newResonance({
      candidate_id: candidateId,
      mandate_id: c.mandate_id,
      emergent_outcome_id: framed.outcome.outcome_id,
      summary: (mo && mo.summary) || framed.outcome.outcome_summary,
      confidence: gen.outcome.confidence || 'unknown',
      risks: risks,
      growth_opportunities: growth,
      mission_contribution: (mo && mo.summary) || ''
    });
    store.resonance_analyses.push(res);
    // qualified once we have a future-state read
    var cc = byId(store.candidates, 'candidate_id', candidateId);
    if (cc && (cc.status === 'frequency_discovery')) { cc.status = 'qualified'; cc.updated_at = nowISO(); }
    OF.save(store);
    return { resonance: res };
  }
  function itemText(it) { return typeof it === 'string' ? it : (it && it.text) || ''; }

  /* ==========================================================
     SHORTLIST
     ========================================================== */
  function ensureShortlist(mandateId, store) {
    store = ensure(store || OF.load());
    var w = byId(store.shortlist_workspaces, 'mandate_id', mandateId);
    if (!w) { w = newShortlist({ mandate_id: mandateId }); store.shortlist_workspaces.push(w); OF.save(store); }
    return w;
  }
  function toggleShortlist(mandateId, candidateId, store) {
    store = ensure(store || OF.load());
    var w = byId(store.shortlist_workspaces, 'mandate_id', mandateId) || newShortlist({ mandate_id: mandateId });
    if (!byId(store.shortlist_workspaces, 'mandate_id', mandateId)) store.shortlist_workspaces.push(w);
    var i = w.candidates.indexOf(candidateId);
    if (i === -1) { w.candidates.push(candidateId); var c = byId(store.candidates, 'candidate_id', candidateId); if (c && c.status === 'qualified') { c.status = 'submitted'; c.updated_at = nowISO(); } }
    else w.candidates.splice(i, 1);
    w.updated_at = nowISO();
    OF.save(store);
    return w;
  }
  function updateShortlist(mandateId, fields, store) {
    store = ensure(store || OF.load());
    var w = ensureShortlist(mandateId, store);
    ['notes', 'client_feedback', 'recruiter_feedback', 'status'].forEach(function (k) { if (fields[k] != null) w[k] = fields[k]; });
    w.updated_at = nowISO();
    OF.save(store);
    return w;
  }

  /* ==========================================================
     FEEDBACK → learning signals (recruiter stays in control)
     ========================================================== */
  function addEmployerFeedback(candidateId, fields, store) {
    store = ensure(store || OF.load());
    var c = byId(store.candidates, 'candidate_id', candidateId);
    var fb = newEmployerFeedback(Object.assign({}, fields, { candidate_id: candidateId, mandate_id: c ? c.mandate_id : null }));
    store.employer_feedback.push(fb);
    // decision may move status (explicit decisions only)
    if (c) {
      if (fb.decision === 'offer') c.status = 'offered';
      else if (fb.decision === 'reject') c.status = 'rejected';
      else if (fb.decision === 'advance' && c.status === 'submitted') c.status = 'interviewing';
      c.updated_at = nowISO();
    }
    captureSignal('employer_feedback', { mandate_id: c ? c.mandate_id : null, candidate_id: candidateId,
      signal: 'Employer ' + fb.decision + (fb.reason ? ': ' + fb.reason : (fb.feedback ? ': ' + fb.feedback : '')), confidence: 'medium' }, store);
    OF.save(store);
    return fb;
  }
  function addCandidateFeedback(candidateId, fields, store) {
    store = ensure(store || OF.load());
    var c = byId(store.candidates, 'candidate_id', candidateId);
    var fb = newCandidateFeedback(Object.assign({}, fields, { candidate_id: candidateId, mandate_id: c ? c.mandate_id : null }));
    store.candidate_feedback.push(fb);
    captureSignal('candidate_feedback', { mandate_id: c ? c.mandate_id : null, candidate_id: candidateId,
      signal: 'Candidate interest ' + fb.interest_level + (fb.concerns && fb.concerns.length ? '; concerns: ' + fb.concerns.join(', ') : '') + (fb.feedback ? '; ' + fb.feedback : ''), confidence: 'medium' }, store);
    OF.save(store);
    return fb;
  }

  /* ==========================================================
     JOIN TRACKING (the first real reality signal)
     ========================================================== */
  function recordJoin(candidateId, fields, store) {
    store = ensure(store || OF.load());
    var c = byId(store.candidates, 'candidate_id', candidateId);
    store.join_outcomes = store.join_outcomes.filter(function (j) { return j.candidate_id !== candidateId; });
    var j = newJoin(Object.assign({}, fields, { candidate_id: candidateId, mandate_id: c ? c.mandate_id : null }));
    store.join_outcomes.push(j);
    if (c && j.joined) { c.status = 'joined'; c.updated_at = nowISO(); }
    captureSignal('join_outcome', { mandate_id: c ? c.mandate_id : null, candidate_id: candidateId,
      signal: j.joined ? ('Joined' + (j.join_date ? ' on ' + j.join_date : '') + ' · 30d: ' + j['30_day_status'] + ' · 90d: ' + j['90_day_status']) : 'Did not join', confidence: 'high' }, store);
    OF.save(store);
    return j;
  }

  /* ==========================================================
     READS — pipelines + candidate detail + recruiter workspace
     ========================================================== */
  function getPipelines(store) {
    store = ensure(store || OF.load());
    var mandates = (store.mandates || []);
    return mandates.map(function (m) {
      var cands = store.candidates.filter(function (c) { return c.mandate_id === m.mandate_id; });
      var stageCounts = {};
      PIPELINE_STAGES.forEach(function (s) { stageCounts[s] = 0; });
      cands.forEach(function (c) { var st = STATUS_STAGE[c.status] || 'New'; stageCounts[st] = (stageCounts[st] || 0) + 1; });
      var role = byId(store.roles, 'role_id', m.role_id);
      var mis = byId(store.missions, 'mission_id', m.mission_id);
      var org = byId(store.organizations, 'organization_id', m.organization_id);
      var owner = (cands.filter(function (c) { return c.owner; })[0] || {}).owner || '';
      return {
        mandate: m, role: role, mission: mis, organization: org,
        candidate_count: cands.length, stage_counts: stageCounts,
        days_open: daysSince(m.created_at), owner: owner, confidence: m.confidence
      };
    });
  }
  function getCandidate(candidateId, store) {
    store = ensure(store || OF.load());
    var c = byId(store.candidates, 'candidate_id', candidateId);
    if (!c) return null;
    var pf = (store.person_frequencies || []).filter(function (x) { return x.person_id === c.person_id; })[0] || null;
    return {
      candidate: c,
      person: byId(store.persons, 'person_id', c.person_id),
      person_frequency: pf,
      thread: byId(store.candidate_threads, 'candidate_id', candidateId),
      resonance: (store.resonance_analyses || []).filter(function (r) { return r.candidate_id === candidateId; })[0] || null,
      employer_feedback: (store.employer_feedback || []).filter(function (f) { return f.candidate_id === candidateId; }),
      candidate_feedback: (store.candidate_feedback || []).filter(function (f) { return f.candidate_id === candidateId; }),
      join: (store.join_outcomes || []).filter(function (j) { return j.candidate_id === candidateId; })[0] || null
    };
  }
  function getCandidatesForMandate(mandateId, store) {
    store = ensure(store || OF.load());
    return store.candidates.filter(function (c) { return c.mandate_id === mandateId; })
      .sort(function (a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); })
      .map(function (c) { return getCandidate(c.candidate_id, store); });
  }
  function getShortlist(mandateId, store) {
    store = ensure(store || OF.load());
    return byId(store.shortlist_workspaces, 'mandate_id', mandateId) || null;
  }
  function getLearningSignals(mandateId, store) {
    store = ensure(store || OF.load());
    var sigs = store.learning_signals.slice().sort(function (a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); });
    return mandateId ? sigs.filter(function (s) { return s.mandate_id === mandateId; }) : sigs;
  }
  function recruiterSummary(owner, store) {
    store = ensure(store || OF.load());
    var cands = store.candidates;
    if (owner) cands = cands.filter(function (c) { return c.owner === owner; });
    var mandateIds = {};
    cands.forEach(function (c) { if (c.mandate_id) mandateIds[c.mandate_id] = true; });
    return {
      mandates: Object.keys(mandateIds).length,
      candidates: cands.length,
      shortlists: (store.shortlist_workspaces || []).filter(function (w) { return !owner || mandateIds[w.mandate_id]; }).length,
      interviewing: cands.filter(function (c) { return c.status === 'interviewing'; }).length,
      offers: cands.filter(function (c) { return c.status === 'offered'; }).length,
      joins: cands.filter(function (c) { return c.status === 'joined'; }).length
    };
  }

  function daysSince(iso) { if (!iso) return 0; return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86400000)); }

  OF.hiring = {
    CANDIDATE_STATUS: CANDIDATE_STATUS, PIPELINE_STAGES: PIPELINE_STAGES, STATUS_STAGE: STATUS_STAGE,
    CHANNELS: CHANNELS, EMPLOYER_DECISIONS: EMPLOYER_DECISIONS, SIGNAL_SOURCES: SIGNAL_SOURCES,
    ensure: ensure,
    newCandidate: newCandidate, newResonance: newResonance, newShortlist: newShortlist,
    newEmployerFeedback: newEmployerFeedback, newCandidateFeedback: newCandidateFeedback,
    newJoin: newJoin, newSignal: newSignal,
    addCandidate: addCandidate, setStatus: setStatus, addThreadMessage: addThreadMessage,
    runFrequencyDiscovery: runFrequencyDiscovery, generateResonance: generateResonance,
    ensureShortlist: ensureShortlist, toggleShortlist: toggleShortlist, updateShortlist: updateShortlist,
    addEmployerFeedback: addEmployerFeedback, addCandidateFeedback: addCandidateFeedback,
    recordJoin: recordJoin, captureSignal: captureSignal,
    getPipelines: getPipelines, getCandidate: getCandidate, getCandidatesForMandate: getCandidatesForMandate,
    getShortlist: getShortlist, getLearningSignals: getLearningSignals, recruiterSummary: recruiterSummary
  };
})();
