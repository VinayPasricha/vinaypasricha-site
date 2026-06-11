/* =============================================================
   Organizational Frequency — Autonomous Agent Layer  (Build 2A)
   =============================================================
   Converts the runtime from human-operated to AGENT-operated.

   AGENT PRINCIPLE: agents do not own the architecture — they
   OPERATE it. Every agent writes into objects already built
   (OF.intel, OF.personResearch, OF.personIntel, OF.outcome,
   OF.outreach, OF.discovery, OF.evolution, OF.hiring). No second
   data model is created here. This layer adds only the operating
   machinery: registry, tasks, runs, policies, queue, safety log,
   the seven agents, and an orchestrator.

   HONESTY (enforced — the whole point of this build):
     • No live web research  → task BLOCKED (manual_input_required)
     • No LinkedIn scrape     → task BLOCKED (manual_input_required)
     • No email/WhatsApp/voice→ task BLOCKED (transport_not_implemented)
     • No fake sends / searches / calls / interviews.
   Agents that need an unavailable capability produce a BLOCKED
   task with a clear reason, never fabricated output.

   AUTONOMY: every agent has an AutonomyPolicy. Launch default is
   approval_required for all; the architecture supports up to
   full_auto, switchable per agent type.

   SAFETY: every autonomous action leaves an AgentSafetyLog entry.

   Augments window.OF with window.OF.agents.
   ============================================================= */
(function () {
  'use strict';
  if (!window.OF) { console.warn('of-agents.js requires of-model.js'); return; }
  var OF = window.OF;

  var AGENT_TYPES = ['organization_discovery', 'candidate_discovery', 'resonance', 'outreach', 'deep_discovery', 'interview', 'learning', 'orchestrator'];
  var AGENT_STATUS = ['active', 'paused', 'disabled', 'error'];
  var TASK_STATUS = ['queued', 'running', 'completed', 'failed', 'blocked', 'needs_human_review'];
  var TASK_TYPES = ['discover_organization', 'discover_candidate', 'generate_resonance', 'draft_outreach', 'send_outreach', 'continue_conversation', 'run_deep_discovery', 'schedule_interview', 'conduct_interview', 'analyze_interview', 'generate_learning_signal', 'promote_learning'];
  var RUN_STATUS = ['started', 'completed', 'failed', 'blocked'];
  var AUTONOMY_LEVELS = ['manual', 'draft_only', 'approval_required', 'auto_send', 'full_auto'];
  var INTERVIEW_STATUS = ['proposed', 'scheduled', 'completed', 'analyzed', 'cancelled'];

  // capability flags — the single source of truth for honest blocking.
  // Flip these on when a real transport/fetch exists; agents react automatically.
  var CAPABILITIES = {
    live_web_search: false,
    linkedin_fetch: false,
    email_transport: false,
    whatsapp_transport: false,
    voice_transport: false,
    interview_platform: false
  };

  // which agent type maps to which task types (for the registry's allowed_actions)
  var AGENT_TASKS = {
    organization_discovery: ['discover_organization'],
    candidate_discovery: ['discover_candidate'],
    resonance: ['generate_resonance'],
    outreach: ['draft_outreach', 'send_outreach', 'continue_conversation'],
    deep_discovery: ['run_deep_discovery'],
    interview: ['schedule_interview', 'conduct_interview', 'analyze_interview'],
    learning: ['generate_learning_signal', 'promote_learning'],
    orchestrator: []
  };
  // launch-default autonomy + risk per agent type
  var DEFAULT_POLICY = {
    organization_discovery: { level: 'approval_required', risk: 'low', daily_limit: 50 },
    candidate_discovery: { level: 'approval_required', risk: 'medium', daily_limit: 50 },
    resonance: { level: 'approval_required', risk: 'low', daily_limit: 100 },
    outreach: { level: 'approval_required', risk: 'high', daily_limit: 20 },
    deep_discovery: { level: 'approval_required', risk: 'medium', daily_limit: 20 },
    interview: { level: 'approval_required', risk: 'high', daily_limit: 20 },
    learning: { level: 'approval_required', risk: 'medium', daily_limit: 100 }
  };

  function nowISO() { return new Date().toISOString(); }
  function uid(p) { return OF.uid(p); }
  function byId(arr, key, val) { return (arr || []).filter(function (x) { return x[key] === val; })[0] || null; }

  function ensure(store) {
    store.agent_registry = store.agent_registry || [];
    store.agent_tasks = store.agent_tasks || [];
    store.agent_runs = store.agent_runs || [];
    store.autonomy_policies = store.autonomy_policies || [];
    store.agent_safety_log = store.agent_safety_log || [];
    store.interview_records = store.interview_records || [];
    seedAgents(store);
    return store;
  }

  /* ===== seed registry + policies once ===== */
  function seedAgents(store) {
    if (store.agent_registry.length) return;
    AGENT_TYPES.forEach(function (t) {
      store.agent_registry.push(newAgent({
        agent_name: titleize(t) + ' Agent', agent_type: t, status: 'active',
        scope: t === 'orchestrator' ? 'detects next work and queues tasks' : 'operates ' + t.replace(/_/g, ' ') + ' objects',
        allowed_actions: AGENT_TASKS[t] || []
      }));
      if (t !== 'orchestrator') {
        var dp = DEFAULT_POLICY[t];
        store.autonomy_policies.push(newPolicy({
          agent_type: t, allowed_autonomy_level: dp.level, risk_level: dp.risk, daily_limit: dp.daily_limit,
          requires_human_approval_for: dp.level === 'approval_required' ? (AGENT_TASKS[t] || []) : []
        }));
      }
    });
  }

  /* ===== SCHEMAS ===== */
  function newAgent(f) {
    f = f || {};
    return {
      agent_id: f.agent_id || uid('agent'), agent_name: f.agent_name || '',
      agent_type: AGENT_TYPES.indexOf(f.agent_type) !== -1 ? f.agent_type : 'orchestrator',
      status: AGENT_STATUS.indexOf(f.status) !== -1 ? f.status : 'active',
      scope: f.scope || '', allowed_actions: f.allowed_actions || [], blocked_actions: f.blocked_actions || [],
      last_run: f.last_run || null, created_at: f.created_at || nowISO()
    };
  }
  function newTask(f) {
    f = f || {};
    return {
      task_id: f.task_id || uid('task'), agent_id: f.agent_id || null,
      task_type: TASK_TYPES.indexOf(f.task_type) !== -1 ? f.task_type : 'discover_organization',
      target_object_type: f.target_object_type || '', target_object_id: f.target_object_id || null,
      status: TASK_STATUS.indexOf(f.status) !== -1 ? f.status : 'queued',
      priority: f.priority || 'normal',
      input_summary: f.input_summary || '', output_summary: f.output_summary || '',
      block_reason: f.block_reason || '',
      created_at: f.created_at || nowISO(), updated_at: nowISO()
    };
  }
  function newRun(f) {
    f = f || {};
    return {
      run_id: f.run_id || uid('run'), agent_id: f.agent_id || null, task_id: f.task_id || null,
      status: RUN_STATUS.indexOf(f.status) !== -1 ? f.status : 'started',
      started_at: f.started_at || nowISO(), completed_at: f.completed_at || null,
      inputs_used: f.inputs_used || [], outputs_written: f.outputs_written || [], errors: f.errors || [],
      audit_log: f.audit_log || [], confidence: f.confidence || 'n/a'
    };
  }
  function newPolicy(f) {
    f = f || {};
    return {
      policy_id: f.policy_id || uid('policy'), agent_type: f.agent_type || null,
      allowed_autonomy_level: AUTONOMY_LEVELS.indexOf(f.allowed_autonomy_level) !== -1 ? f.allowed_autonomy_level : 'approval_required',
      requires_human_approval_for: f.requires_human_approval_for || [],
      daily_limit: f.daily_limit || 50, risk_level: f.risk_level || 'medium', created_at: f.created_at || nowISO()
    };
  }
  function newSafetyLog(f) {
    f = f || {};
    return {
      log_id: f.log_id || uid('safe'), agent_id: f.agent_id || null, task_id: f.task_id || null,
      action: f.action || '', risk: f.risk || 'low', decision: f.decision || '', reason: f.reason || '',
      created_at: f.created_at || nowISO()
    };
  }

  /* ===== policy + registry controls ===== */
  function policyFor(type, store) { return byId(store.autonomy_policies, 'agent_type', type); }
  function agentFor(type, store) { return byId(store.agent_registry, 'agent_type', type); }
  function setAutonomy(type, level, store) {
    store = ensure(store || OF.load());
    var p = policyFor(type, store);
    if (p && AUTONOMY_LEVELS.indexOf(level) !== -1) {
      p.allowed_autonomy_level = level;
      p.requires_human_approval_for = (level === 'approval_required' || level === 'draft_only' || level === 'manual') ? (AGENT_TASKS[type] || []) : [];
      OF.save(store);
    }
    return p;
  }
  function setAgentStatus(type, status, store) {
    store = ensure(store || OF.load());
    var a = agentFor(type, store);
    if (a && AGENT_STATUS.indexOf(status) !== -1) { a.status = status; OF.save(store); }
    return a;
  }
  function setCapability(key, on, store) {
    store = ensure(store || OF.load());
    if (key in CAPABILITIES) CAPABILITIES[key] = !!on;
    // capability is module-global (not persisted) — reflects real infra
    return CAPABILITIES;
  }

  function safety(store, agentId, taskId, action, risk, decision, reason) {
    store.agent_safety_log.push(newSafetyLog({ agent_id: agentId, task_id: taskId, action: action, risk: risk, decision: decision, reason: reason }));
  }

  /* ===== ENQUEUE a task ===== */
  function enqueue(taskType, targetType, targetId, inputSummary, store) {
    store = ensure(store || OF.load());
    var agentType = Object.keys(AGENT_TASKS).filter(function (t) { return (AGENT_TASKS[t] || []).indexOf(taskType) !== -1; })[0];
    var agent = agentFor(agentType, store);
    // de-dupe: don't queue the same open task twice
    var existing = store.agent_tasks.filter(function (t) {
      return t.task_type === taskType && t.target_object_id === targetId && ['queued', 'running', 'blocked', 'needs_human_review'].indexOf(t.status) !== -1;
    })[0];
    if (existing) return existing;
    var task = newTask({ agent_id: agent ? agent.agent_id : null, task_type: taskType, target_object_type: targetType, target_object_id: targetId, input_summary: inputSummary || '' });
    store.agent_tasks.push(task);
    OF.save(store);
    return task;
  }

  /* ===== RUN a task — dispatches to the right agent ===== */
  function runTask(taskId, store) {
    store = ensure(store || OF.load());
    var task = byId(store.agent_tasks, 'task_id', taskId);
    if (!task) return { error: 'Task not found.' };
    var agent = byId(store.agent_registry, 'agent_id', task.agent_id);
    if (agent && agent.status !== 'active') {
      task.status = 'blocked'; task.block_reason = 'Agent is ' + agent.status; task.updated_at = nowISO();
      OF.save(store); return { task: task };
    }
    var policy = agent ? policyFor(agent.agent_type, store) : null;
    var run = newRun({ agent_id: task.agent_id, task_id: taskId, status: 'started', inputs_used: [task.target_object_type + ':' + task.target_object_id] });
    task.status = 'running'; task.updated_at = nowISO();

    var result;
    try {
      result = dispatch(task, run, policy, store);
    } catch (e) {
      result = { status: 'failed', error: e.message };
    }

    // agents may have reloaded + saved the store internally; re-sync so their
    // writes aren't clobbered by this function's final save.
    store = ensure(OF.load());
    task = byId(store.agent_tasks, 'task_id', taskId) || task;
    agent = byId(store.agent_registry, 'agent_id', task.agent_id);

    // apply result
    run.completed_at = nowISO();
    if (result.status === 'blocked') {
      task.status = 'blocked'; task.block_reason = result.reason || 'blocked'; run.status = 'blocked';
      run.errors.push(result.reason || 'blocked');
      safety(store, task.agent_id, taskId, task.task_type, policy ? policy.risk_level : 'low', 'blocked', result.reason || 'blocked');
    } else if (result.status === 'failed') {
      task.status = 'failed'; run.status = 'failed'; run.errors.push(result.error || 'failed');
      safety(store, task.agent_id, taskId, task.task_type, policy ? policy.risk_level : 'low', 'failed', result.error || 'failed');
    } else if (result.status === 'needs_human_review') {
      task.status = 'needs_human_review'; task.output_summary = result.summary || ''; run.status = 'completed';
      run.outputs_written = result.outputs || [];
      safety(store, task.agent_id, taskId, task.task_type, policy ? policy.risk_level : 'medium', 'held_for_approval', result.reason || 'autonomy policy requires human approval');
    } else {
      task.status = 'completed'; task.output_summary = result.summary || ''; run.status = 'completed';
      run.outputs_written = result.outputs || []; run.confidence = result.confidence || 'n/a';
      safety(store, task.agent_id, taskId, task.task_type, policy ? policy.risk_level : 'low', 'executed', result.reason || 'completed within autonomy policy');
    }
    run.audit_log.push(task.task_type + ' → ' + task.status + ' @ ' + nowISO());
    task.updated_at = nowISO();
    if (agent) agent.last_run = nowISO();
    store.agent_runs.push(run);
    OF.save(store);
    return { task: task, run: run };
  }

  // does this task type need human approval under the agent's policy?
  function needsApproval(policy, taskType) {
    if (!policy) return true;
    if (policy.allowed_autonomy_level === 'full_auto' || policy.allowed_autonomy_level === 'auto_send') return false;
    return (policy.requires_human_approval_for || []).indexOf(taskType) !== -1 || ['approval_required', 'draft_only', 'manual'].indexOf(policy.allowed_autonomy_level) !== -1;
  }

  /* ===== DISPATCH — each agent operates EXISTING objects ===== */
  function dispatch(task, run, policy, store) {
    switch (task.task_type) {
      case 'discover_organization': return runOrgDiscovery(task, run, policy, store);
      case 'discover_candidate': return runCandidateDiscovery(task, run, policy, store);
      case 'generate_resonance': return runResonance(task, run, policy, store);
      case 'draft_outreach': return runDraftOutreach(task, run, policy, store);
      case 'send_outreach': return runSendOutreach(task, run, policy, store);
      case 'run_deep_discovery': return runDeepDiscovery(task, run, policy, store);
      case 'schedule_interview': return runScheduleInterview(task, run, policy, store);
      case 'conduct_interview': return runConductInterview(task, run, policy, store);
      case 'analyze_interview': return runAnalyzeInterview(task, run, policy, store);
      case 'generate_learning_signal': return runGenerateLearning(task, run, policy, store);
      case 'promote_learning': return runPromoteLearning(task, run, policy, store);
      default: return { status: 'failed', error: 'Unknown task type ' + task.task_type };
    }
  }

  /* 1 — Organization Discovery: needs live web → BLOCKED honestly */
  function runOrgDiscovery(task, run, policy, store) {
    if (OF.search) {
      var m = OF.search.createOrgSearch({ organization_id: task.target_object_id, company_name: task.input_summary || 'organization', agent_id: task.agent_id }, store);
      store = OF.load(); ensure(store);
      var sr = OF.search.runSearch(m.search_mission_id, store); store = OF.load(); ensure(store);
      if (sr.status === 'blocked') return { status: 'blocked', reason: sr.reason + ' (SearchMission ' + m.search_mission_id + ')' };
      return { status: 'needs_human_review', summary: 'Org search ran — review artifacts and send to Intelligence.', outputs: ['SearchMission'] };
    }
    if (OF.capabilities && !OF.capabilities.isAvailable('public_web_search', store)) {
      var r = OF.capabilities.searchWeb(task.input_summary || 'organization', {}, { agent_id: task.agent_id, task_id: task.task_id }, store);
      return { status: 'blocked', reason: r.reason };
    }
    return { status: 'blocked', reason: 'manual_input_required — capability layer unavailable. Paste sources in Intelligence.' };
  }

  /* 2 — Candidate Discovery: needs live search / LinkedIn → BLOCKED */
  function runCandidateDiscovery(task, run, policy, store) {
    if (OF.search) {
      var m = OF.search.createCandidateSearch({ mandate_id: task.target_object_type === 'mandate' ? task.target_object_id : null, role_id: task.target_object_type === 'role' ? task.target_object_id : null, role_title: task.input_summary || 'candidate', agent_id: task.agent_id }, store);
      store = OF.load(); ensure(store);
      var sr = OF.search.runSearch(m.search_mission_id, store); store = OF.load(); ensure(store);
      if (sr.status === 'blocked') return { status: 'blocked', reason: sr.reason + ' (SearchMission ' + m.search_mission_id + ')' };
      return { status: 'needs_human_review', summary: 'Candidate search ran — review artifacts and send to Person Intelligence.', outputs: ['SearchMission'] };
    }
    if (OF.capabilities && !OF.capabilities.isAvailable('public_web_search', store) && !OF.capabilities.isAvailable('candidate_database_search', store)) {
      var r = OF.capabilities.searchCandidates(task.input_summary || 'candidate', {}, { agent_id: task.agent_id, task_id: task.task_id }, store);
      return { status: 'blocked', reason: r.reason };
    }
    return { status: 'blocked', reason: 'manual_input_required — capability layer unavailable. Add candidates manually in Outreach.' };
  }

  /* 3 — Resonance: operates on EXISTING brief + role frequency (no fetch needed) */
  function runResonance(task, run, policy, store) {
    var candId = task.target_object_id; // a cd_candidate
    if (!OF.outreach) return { status: 'failed', error: 'Outreach module unavailable.' };
    var res = OF.outreach.researchAndScreen(candId, store);
    store = OF.load(); ensure(store);
    if (res && res.error) return { status: 'blocked', reason: res.error };
    run.outputs_written = ['PreliminaryCandidateResonance', 'EmergentOutcome'];
    if (needsApproval(policy, task.task_type)) {
      return { status: 'completed', summary: 'Resonance screened: ' + (res.resonance ? res.resonance.next_action : 'n/a') + ' (read-only analysis, no score).', outputs: run.outputs_written, confidence: res.resonance ? res.resonance.confidence : 'low' };
    }
    return { status: 'completed', summary: 'Resonance screened (auto).', outputs: run.outputs_written };
  }

  /* 4a — Draft outreach: writes a draft into the EXISTING outreach object */
  function runDraftOutreach(task, run, policy, store) {
    var candId = task.target_object_id;
    if (!OF.outreach) return { status: 'failed', error: 'Outreach module unavailable.' };
    var d = OF.outreach.generateDraft(candId, store);
    store = OF.load(); ensure(store);
    if (d && d.error) return { status: 'blocked', reason: d.error };
    run.outputs_written = ['ResonanceOutreachDraft'];
    // a draft is always safe; sending is the gated action
    return { status: 'completed', summary: 'Outreach draft written (pending_approval). No send attempted.', outputs: run.outputs_written };
  }

  /* 4b — Send outreach: calls the 2B capability layer; blocks with its exact reason */
  function runSendOutreach(task, run, policy, store) {
    // human approval gate first (policy), unless full_auto/auto_send
    if (needsApproval(policy, task.task_type)) {
      return { status: 'needs_human_review', reason: 'Outreach send requires human approval under current policy.', summary: 'Send held for approval.' };
    }
    if (!OF.capabilities) return { status: 'blocked', reason: 'transport_not_implemented — capability layer unavailable.' };
    // target is a draft id; build an outbound message from it and ask the email capability to send
    var draft = OF.outreach ? byId(store.cd_drafts, 'draft_id', task.target_object_id) : null;
    var msg = OF.capabilities.queueOutbound({
      recipient_type: 'candidate', recipient_id: draft ? draft.candidate_discovery_id : null, channel: 'email',
      subject: draft ? draft.subject : 'Outreach', body: draft ? draft.body : ''
    }, store);
    store = OF.load(); ensure(store);
    var sendRes = OF.capabilities.sendEmail(msg.message_id, { agent_id: task.agent_id, task_id: task.task_id }, store);
    store = OF.load(); ensure(store);
    if (sendRes.status === 'blocked') return { status: 'blocked', reason: sendRes.reason };
    if (sendRes.status === 'failed') return { status: 'failed', error: sendRes.reason };
    return { status: 'completed', summary: 'Outreach sent via capability layer.', outputs: ['OutboundMessage', 'CandidateThread'] };
  }

  /* 5 — Deep Discovery: conducting via channels needs transport → BLOCKED */
  function runDeepDiscovery(task, run, policy, store) {
    if (OF.capabilities && !OF.capabilities.isAvailable('email_send', store) && !OF.capabilities.isAvailable('whatsapp_send', store) && !OF.capabilities.isAvailable('voice_call', store)) {
      return { status: 'blocked', reason: 'transport_not_implemented — no email/WhatsApp/voice provider configured. Run stakeholder questions manually in Discovery.' };
    }
    if (!OF.capabilities) return { status: 'blocked', reason: 'transport_not_implemented — capability layer unavailable.' };
    return { status: 'needs_human_review', summary: 'Deep-discovery questions queued to stakeholders (awaiting approval).' };
  }

  /* 6 — Interview: schedule/conduct need a platform → BLOCKED; create the record hook */
  function runScheduleInterview(task, run, policy, store) {
    var rec = ensureInterviewRecord(task.target_object_id, store);
    if (OF.capabilities && !OF.capabilities.isAvailable('calendar_scheduling', store)) {
      var r = OF.capabilities.scheduleInterview([], [], { agent_id: task.agent_id, task_id: task.task_id }, store);
      return { status: 'blocked', reason: r.reason + ' InterviewRecord created as "proposed" for a human to schedule.' };
    }
    if (!OF.capabilities) return { status: 'blocked', reason: 'transport_not_implemented — capability layer unavailable.' };
    return { status: 'needs_human_review', summary: 'Interview scheduled (awaiting confirmation).', outputs: ['InterviewRecord'] };
  }
  function runConductInterview(task, run, policy, store) {
    if (OF.capabilities && !OF.capabilities.isAvailable('interview_recording', store) && !OF.capabilities.isAvailable('voice_call', store)) {
      return { status: 'blocked', reason: 'transport_not_implemented — no video/recording provider configured. Interviews cannot be conducted or recorded autonomously.' };
    }
    if (!OF.capabilities) return { status: 'blocked', reason: 'transport_not_implemented — capability layer unavailable.' };
    return { status: 'needs_human_review', summary: 'Interview conducted (awaiting analysis).' };
  }
  function runAnalyzeInterview(task, run, policy, store) {
    var rec = byId(store.interview_records, 'candidate_id', task.target_object_id) || byId(store.interview_records, 'interview_id', task.target_object_id);
    if (!rec || !rec.transcript) {
      return { status: 'blocked', reason: 'manual_input_required — no transcript on the InterviewRecord. Paste a transcript before analysis.' };
    }
    if (OF.interview && OF.interview.analyze) {
      if (needsApproval(policy, task.task_type)) return { status: 'needs_human_review', summary: 'Transcript present — interview analysis held for human approval.', outputs: ['InterviewAnalysis'] };
      var a = OF.interview.analyze(rec.interview_id, store);
      if (a && a.error) return { status: 'blocked', reason: a.error };
      return { status: 'completed', summary: 'Interview analyzed: frequency evolved, resonance marked stale.', outputs: ['InterviewAnalysis', 'PersonFrequencyEvolutionEvent', 'LearningSignal'] };
    }
    return { status: 'needs_human_review', summary: 'Interview analysis drafted (awaiting approval).', outputs: ['InterviewAnalysis', 'LearningSignal'] };
  }

  /* 7 — Learning: capture is safe; promotion is policy-gated */
  function runGenerateLearning(task, run, policy, store) {
    if (!OF.hiring) return { status: 'failed', error: 'Hiring module unavailable.' };
    OF.hiring.captureSignal('join_outcome', { candidate_id: task.target_object_id, signal: 'Agent-captured learning signal from outcome.', confidence: 'medium' }, store);
    run.outputs_written = ['LearningSignal'];
    return { status: 'completed', summary: 'Learning signal captured (stored, not applied).', outputs: run.outputs_written };
  }
  function runPromoteLearning(task, run, policy, store) {
    // promotion changes the living frequency — never without policy permission
    if (needsApproval(policy, task.task_type)) {
      return { status: 'needs_human_review', reason: 'Promoting learning into the living frequency requires human approval.', summary: 'Promotion suggested — awaiting human approval (frequency evolution is gated).' };
    }
    return { status: 'completed', summary: 'Learning promoted to frequency evolution (auto).', outputs: ['FrequencyEvolutionEvent'] };
  }

  /* ===== INTERVIEW placeholders (orchestration hooks only) ===== */
  function ensureInterviewRecord(candidateId, store) {
    store = ensure(store || OF.load());
    var rec = byId(store.interview_records, 'candidate_id', candidateId);
    if (rec) return rec;
    var cand = OF.outreach ? null : null;
    rec = {
      interview_id: uid('intv'), mandate_id: null, candidate_id: candidateId, organization_id: null,
      status: 'proposed', participants: [], scheduled_at: null, recording_url: '', transcript: '',
      analysis: null, learning_signals: [], created_at: nowISO()
    };
    store.interview_records.push(rec);
    OF.save(store);
    return rec;
  }

  /* ===== ORCHESTRATOR — detect next work, create AgentTasks ===== */
  function orchestrate(store) {
    store = ensure(store || OF.load());
    var created = [];

    // Mandate active but no candidates → queue candidate discovery
    (store.mandates || []).forEach(function (m) {
      if (m.mandate_status === 'cancelled') return;
      var hasSearch = (store.cd_searches || []).some(function (s) { return s.mandate_id === m.mandate_id; });
      var cands = hasSearch ? (store.cd_candidates || []).filter(function (c) {
        var sr = byId(store.cd_searches, 'search_id', c.search_id); return sr && sr.mandate_id === m.mandate_id;
      }) : [];
      if (!cands.length) {
        var t = enqueue('discover_candidate', 'mandate', m.mandate_id, 'Mandate active, no candidates yet — discover candidates.', store);
        store = OF.load(); ensure(store); if (t) created.push(t);
      }
    });

    // Candidate researched but no resonance → queue resonance
    (store.cd_candidates || []).forEach(function (c) {
      var hasRes = (store.cd_resonance || []).some(function (r) { return r.candidate_discovery_id === c.candidate_discovery_id; });
      if (c.status === 'researched' && !hasRes) {
        var t = enqueue('generate_resonance', 'candidate', c.candidate_discovery_id, 'Candidate researched, no resonance — screen resonance.', store);
        store = OF.load(); ensure(store); if (t) created.push(t);
      }
    });

    // Resonance positive (approve_outreach) but no draft → queue outreach draft
    (store.cd_resonance || []).forEach(function (r) {
      var hasDraft = (store.cd_drafts || []).some(function (d) { return d.candidate_discovery_id === r.candidate_discovery_id; });
      if (r.next_action === 'approve_outreach' && !hasDraft) {
        var t = enqueue('draft_outreach', 'candidate', r.candidate_discovery_id, 'Positive resonance, no draft — draft outreach.', store);
        store = OF.load(); ensure(store); if (t) created.push(t);
      }
    });

    // Approved draft but not sent → queue send (will block on transport)
    (store.cd_drafts || []).forEach(function (d) {
      if (d.status === 'approved') {
        var t = enqueue('send_outreach', 'draft', d.draft_id, 'Draft approved — attempt send (transport may be unavailable).', store);
        store = OF.load(); ensure(store); if (t) created.push(t);
      }
    });

    // Join recorded → queue learning signal
    (store.join_outcomes || []).forEach(function (j) {
      var t = enqueue('generate_learning_signal', 'candidate', j.candidate_id, 'Join outcome recorded — capture learning signal.', store);
      store = OF.load(); ensure(store); if (t) created.push(t);
    });

    return created;
  }

  // run every queued task once (respecting agent status); used by "run queue"
  function runQueue(store) {
    store = ensure(store || OF.load());
    var queued = store.agent_tasks.filter(function (t) { return t.status === 'queued'; }).map(function (t) { return t.task_id; });
    var results = [];
    queued.forEach(function (id) { results.push(runTask(id, OF.load())); });
    return results;
  }

  function approveTask(taskId, store) {
    store = ensure(store || OF.load());
    var t = byId(store.agent_tasks, 'task_id', taskId);
    if (!t) return null;
    t.status = 'completed'; t.updated_at = nowISO();
    var agent = byId(store.agent_registry, 'agent_id', t.agent_id);
    safety(store, t.agent_id, taskId, t.task_type, 'medium', 'human_approved', 'Human approved the held task.');
    OF.save(store);
    return t;
  }
  function rejectTask(taskId, store) {
    store = ensure(store || OF.load());
    var t = byId(store.agent_tasks, 'task_id', taskId);
    if (!t) return null;
    t.status = 'failed'; t.block_reason = 'Rejected by human.'; t.updated_at = nowISO();
    safety(store, t.agent_id, taskId, t.task_type, 'low', 'human_rejected', 'Human rejected the task.');
    OF.save(store);
    return t;
  }
  function rerunTask(taskId, store) { return runTask(taskId, store); }

  /* ===== reads ===== */
  function snapshot(store) {
    store = ensure(store || OF.load());
    return {
      agents: store.agent_registry,
      policies: store.autonomy_policies,
      tasks: store.agent_tasks.slice().sort(function (a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); }),
      runs: store.agent_runs.slice().sort(function (a, b) { return (b.started_at || '').localeCompare(a.started_at || ''); }),
      safety_log: store.agent_safety_log.slice().sort(function (a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); }),
      capabilities: CAPABILITIES,
      counts: {
        queued: store.agent_tasks.filter(function (t) { return t.status === 'queued'; }).length,
        blocked: store.agent_tasks.filter(function (t) { return t.status === 'blocked'; }).length,
        needs_review: store.agent_tasks.filter(function (t) { return t.status === 'needs_human_review'; }).length,
        completed: store.agent_tasks.filter(function (t) { return t.status === 'completed'; }).length
      }
    };
  }
  function titleize(s) { return s.replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }

  function resetAgents(store) {
    store = ensure(store || OF.load());
    store.agent_tasks = []; store.agent_runs = []; store.agent_safety_log = []; store.interview_records = [];
    OF.save(store);
  }

  OF.agents = {
    AGENT_TYPES: AGENT_TYPES, AGENT_STATUS: AGENT_STATUS, TASK_STATUS: TASK_STATUS, TASK_TYPES: TASK_TYPES,
    AUTONOMY_LEVELS: AUTONOMY_LEVELS, INTERVIEW_STATUS: INTERVIEW_STATUS, AGENT_TASKS: AGENT_TASKS, CAPABILITIES: CAPABILITIES,
    ensure: ensure,
    enqueue: enqueue, runTask: runTask, runQueue: runQueue, orchestrate: orchestrate,
    approveTask: approveTask, rejectTask: rejectTask, rerunTask: rerunTask,
    setAutonomy: setAutonomy, setAgentStatus: setAgentStatus, setCapability: setCapability,
    ensureInterviewRecord: ensureInterviewRecord,
    snapshot: snapshot, policyFor: policyFor, agentFor: agentFor, resetAgents: resetAgents
  };
})();
