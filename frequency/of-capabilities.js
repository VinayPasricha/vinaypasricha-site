/* =============================================================
   Organizational Frequency — Search & Transport Capability Layer (2B)
   =============================================================
   Gives the 2A agents real capabilities OR honest provider hooks.
   Agents do not fake capability. Every capability reports one of:
     available · configured · not_configured · blocked · failed
   If a provider is not configured, the task blocks honestly — no
   fake search, no fake send, no fake reply, no fake call.

   This layer adds the capability machinery and provider INTERFACES
   (stubs that honestly report not_configured), a manual-import path
   for every capability, thread routing for inbound/outbound, and
   the safety/compliance gate. It does NOT add business logic and
   does NOT redesign the agent layer.

   Augments window.OF with window.OF.capabilities.
   ============================================================= */
(function () {
  'use strict';
  if (!window.OF) { console.warn('of-capabilities.js requires of-model.js'); return; }
  var OF = window.OF;

  var CAP_TYPES = ['public_web_search', 'linkedin_intake', 'candidate_database_search', 'email_send', 'email_reply_ingest', 'whatsapp_send', 'whatsapp_reply_ingest', 'voice_call', 'interview_recording', 'calendar_scheduling', 'resume_parse'];
  var CAP_STATUS = ['available', 'configured', 'not_configured', 'blocked', 'failed'];
  var RUN_STATUS = ['started', 'completed', 'failed', 'blocked'];
  var SEARCH_TYPES = ['organization', 'candidate', 'role', 'market', 'article', 'press', 'linkedin_url', 'github', 'portfolio'];
  var SEARCH_STATUS = ['found', 'imported', 'ignored', 'needs_review', 'failed'];
  var OUT_STATUS = ['draft', 'queued', 'blocked', 'sent', 'failed'];
  var IN_STATUS = ['received', 'routed', 'needs_review', 'failed'];
  var RECIPIENT_TYPES = ['candidate', 'organization', 'stakeholder', 'reference'];
  var CHANNELS = ['website', 'email', 'whatsapp', 'voice'];

  // which agent types may call which capability
  var CAP_AGENTS = {
    public_web_search: ['organization_discovery', 'candidate_discovery'],
    linkedin_intake: ['candidate_discovery'],
    candidate_database_search: ['candidate_discovery'],
    email_send: ['outreach', 'deep_discovery'],
    email_reply_ingest: ['learning', 'outreach', 'deep_discovery'],
    whatsapp_send: ['outreach', 'deep_discovery'],
    whatsapp_reply_ingest: ['learning', 'outreach', 'deep_discovery'],
    voice_call: ['deep_discovery', 'interview'],
    interview_recording: ['interview'],
    calendar_scheduling: ['interview'],
    resume_parse: ['candidate_discovery']
  };
  var CAP_RISK = { email_send: 'high', whatsapp_send: 'high', voice_call: 'high', interview_recording: 'high', calendar_scheduling: 'medium' };
  var DEFAULT_DAILY = { email_send: 50, whatsapp_send: 30, voice_call: 10 };

  function nowISO() { return new Date().toISOString(); }
  function uid(p) { return OF.uid(p); }
  function byId(arr, key, val) { return (arr || []).filter(function (x) { return x[key] === val; })[0] || null; }
  function today() { return new Date().toISOString().slice(0, 10); }

  function ensure(store) {
    store.capability_registry = store.capability_registry || [];
    store.capability_runs = store.capability_runs || [];
    store.search_results = store.search_results || [];
    store.outbound_messages = store.outbound_messages || [];
    store.inbound_messages = store.inbound_messages || [];
    store.contact_safety = store.contact_safety || { do_not_contact: [], unsubscribed: [], blocked_domains: [], consent: {}, sent_today: {}, cooldown: {} };
    seedCaps(store);
    return store;
  }

  function seedCaps(store) {
    if (store.capability_registry.length) return;
    CAP_TYPES.forEach(function (t) {
      store.capability_registry.push(newCapability({
        capability_type: t, provider_name: '(none)', status: 'not_configured', config_status: 'no provider wired',
        allowed_agents: CAP_AGENTS[t] || [], daily_limit: DEFAULT_DAILY[t] || 0, risk_level: CAP_RISK[t] || 'low'
      }));
    });
  }

  /* ===== SCHEMAS ===== */
  function newCapability(f) {
    f = f || {};
    return {
      capability_id: f.capability_id || uid('cap'),
      capability_type: CAP_TYPES.indexOf(f.capability_type) !== -1 ? f.capability_type : 'public_web_search',
      provider_name: f.provider_name || '(none)',
      status: CAP_STATUS.indexOf(f.status) !== -1 ? f.status : 'not_configured',
      config_status: f.config_status || '',
      allowed_agents: f.allowed_agents || [], daily_limit: f.daily_limit || 0, risk_level: f.risk_level || 'low',
      last_checked: f.last_checked || nowISO(), created_at: f.created_at || nowISO()
    };
  }
  function newCapRun(f) {
    f = f || {};
    return {
      run_id: f.run_id || uid('caprun'), capability_type: f.capability_type || null, provider_name: f.provider_name || '(none)',
      agent_id: f.agent_id || null, task_id: f.task_id || null,
      status: RUN_STATUS.indexOf(f.status) !== -1 ? f.status : 'started',
      input_summary: f.input_summary || '', output_summary: f.output_summary || '', errors: f.errors || [],
      created_at: f.created_at || nowISO(), completed_at: f.completed_at || null
    };
  }
  function newSearchResult(f) {
    f = f || {};
    return {
      result_id: f.result_id || uid('sr'), search_type: SEARCH_TYPES.indexOf(f.search_type) !== -1 ? f.search_type : 'organization',
      query: f.query || '', source: f.source || 'manual_import', title: f.title || '', url: f.url || '',
      snippet: f.snippet || '', raw_text: f.raw_text || '', confidence: f.confidence || 'low',
      status: SEARCH_STATUS.indexOf(f.status) !== -1 ? f.status : 'found', created_at: f.created_at || nowISO()
    };
  }
  function newOutbound(f) {
    f = f || {};
    return {
      message_id: f.message_id || uid('out'), thread_id: f.thread_id || null,
      recipient_type: RECIPIENT_TYPES.indexOf(f.recipient_type) !== -1 ? f.recipient_type : 'candidate',
      recipient_id: f.recipient_id || null, channel: CHANNELS.indexOf(f.channel) !== -1 ? f.channel : 'email',
      subject: f.subject || '', body: f.body || '',
      status: OUT_STATUS.indexOf(f.status) !== -1 ? f.status : 'draft', provider: f.provider || '(none)',
      block_reason: f.block_reason || '', created_at: f.created_at || nowISO(), sent_at: f.sent_at || null
    };
  }
  function newInbound(f) {
    f = f || {};
    return {
      message_id: f.message_id || uid('in'), thread_id: f.thread_id || null,
      sender_type: RECIPIENT_TYPES.indexOf(f.sender_type) !== -1 ? f.sender_type : 'candidate',
      sender_id: f.sender_id || null, channel: CHANNELS.indexOf(f.channel) !== -1 ? f.channel : 'email',
      body: f.body || '', provider: f.provider || 'manual',
      received_at: f.received_at || nowISO(), status: IN_STATUS.indexOf(f.status) !== -1 ? f.status : 'received'
    };
  }

  /* ===== capability status ===== */
  function capability(type, store) { store = ensure(store || OF.load()); return byId(store.capability_registry, 'capability_type', type); }
  function isAvailable(type, store) { var c = capability(type, store); return c && (c.status === 'available' || c.status === 'configured'); }
  function configure(type, providerName, store) {
    store = ensure(store || OF.load());
    var c = capability(type, store);
    if (c) { c.provider_name = providerName || 'configured provider'; c.status = 'configured'; c.config_status = 'provider wired'; c.last_checked = nowISO(); OF.save(store); }
    return c;
  }
  function markStatus(type, status, store) {
    store = ensure(store || OF.load());
    var c = capability(type, store);
    if (c && CAP_STATUS.indexOf(status) !== -1) { c.status = status; c.last_checked = nowISO(); if (status === 'not_configured') { c.provider_name = '(none)'; c.config_status = 'no provider wired'; } OF.save(store); }
    return c;
  }
  function setDailyLimit(type, n, store) { store = ensure(store || OF.load()); var c = capability(type, store); if (c) { c.daily_limit = Math.max(0, n | 0); OF.save(store); } return c; }

  function logRun(store, type, agentId, taskId, status, input, output, err) {
    var c = capability(type, store);
    var r = newCapRun({ capability_type: type, provider_name: c ? c.provider_name : '(none)', agent_id: agentId, task_id: taskId, status: status, input_summary: input || '', output_summary: output || '', errors: err ? [err] : [], completed_at: nowISO() });
    store.capability_runs.push(r);
    return r;
  }

  /* ===== PROVIDER INTERFACES (honest stubs) =====
     Each returns { ok|blocked, reason, ... }. No fabrication. */
  function searchWeb(query, opts, ctx, store) {
    store = ensure(store || OF.load());
    opts = opts || {}; ctx = ctx || {};
    if (!isAvailable('public_web_search', store)) {
      logRun(store, 'public_web_search', ctx.agent_id, ctx.task_id, 'blocked', query, '', 'not_configured');
      OF.save(store);
      return { status: 'blocked', reason: 'public_web_search not_configured — no live search provider. Use manual import (paste results).' };
    }
    // a real provider would populate SearchResults here; none is wired
    logRun(store, 'public_web_search', ctx.agent_id, ctx.task_id, 'blocked', query, '', 'no_provider_response');
    OF.save(store);
    return { status: 'blocked', reason: 'public_web_search configured but returned no provider response.' };
  }
  function searchCandidates(query, filters, ctx, store) {
    store = ensure(store || OF.load());
    if (!isAvailable('candidate_database_search', store)) {
      logRun(store, 'candidate_database_search', (ctx || {}).agent_id, (ctx || {}).task_id, 'blocked', query, '', 'not_configured');
      OF.save(store);
      return { status: 'blocked', reason: 'candidate_database_search not_configured — Goodspace DB not connected. Use manual import.' };
    }
    return { status: 'blocked', reason: 'candidate_database_search configured but returned no provider response.' };
  }
  // LinkedIn intake never scrapes — it stores the URL and asks for text
  function linkedinIntake(url, ctx, store) {
    store = ensure(store || OF.load());
    return { status: 'manual_profile_text_required', url_stored: !!url, reason: 'LinkedIn scraping is not permitted/available. URL stored; paste the profile text into Person Research.' };
  }
  function sendEmail(outboundId, ctx, store) {
    store = ensure(store || OF.load());
    var msg = byId(store.outbound_messages, 'message_id', outboundId);
    if (!msg) return { status: 'failed', reason: 'Outbound message not found.' };
    // safety gate first
    var gate = safetyCheck(msg, store);
    if (!gate.ok) { msg.status = 'blocked'; msg.block_reason = gate.reason; OF.save(store); logRun(store, 'email_send', (ctx || {}).agent_id, (ctx || {}).task_id, 'blocked', msg.subject, '', gate.reason); OF.save(store); return { status: 'blocked', reason: gate.reason }; }
    if (!isAvailable('email_send', store)) {
      msg.status = 'blocked'; msg.block_reason = 'email_provider_not_configured';
      logRun(store, 'email_send', (ctx || {}).agent_id, (ctx || {}).task_id, 'blocked', msg.subject, '', 'email_provider_not_configured');
      OF.save(store);
      return { status: 'blocked', reason: 'email_provider_not_configured — draft remains for human send.' };
    }
    // provider configured → delegate to the transport layer (2C) if present
    countSend(msg, store);
    if (OF.transport) {
      var tr = OF.transport.send(msg, ctx, store); store = OF.load(); ensure(store);
      var m2 = byId(store.outbound_messages, 'message_id', outboundId);
      if (tr.status === 'sent') { m2.status = 'sent'; m2.sent_at = nowISO(); m2.provider = tr.transport_message.provider; m2.transport_message_id = tr.transport_message.transport_message_id; routeOutboundToThread(m2, store); logRun(store, 'email_send', (ctx || {}).agent_id, (ctx || {}).task_id, 'completed', m2.subject, 'sent via ' + m2.provider + (tr.simulated ? ' (simulated)' : '')); OF.save(store); return { status: 'sent', message: m2, transport: tr.transport_message }; }
      m2.status = 'blocked'; m2.block_reason = tr.reason; logRun(store, 'email_send', (ctx || {}).agent_id, (ctx || {}).task_id, 'blocked', m2.subject, '', tr.reason); OF.save(store); return { status: 'blocked', reason: tr.reason };
    }
    msg.status = 'sent'; msg.sent_at = nowISO(); msg.provider = capability('email_send', store).provider_name;
    routeOutboundToThread(msg, store);
    logRun(store, 'email_send', (ctx || {}).agent_id, (ctx || {}).task_id, 'completed', msg.subject, 'sent via ' + msg.provider);
    OF.save(store);
    return { status: 'sent', message: msg };
  }
  function sendWhatsApp(outboundId, ctx, store) {
    store = ensure(store || OF.load());
    var msg = byId(store.outbound_messages, 'message_id', outboundId);
    if (!msg) return { status: 'failed', reason: 'Outbound message not found.' };
    var gate = safetyCheck(msg, store);
    if (!gate.ok) { msg.status = 'blocked'; msg.block_reason = gate.reason; OF.save(store); return { status: 'blocked', reason: gate.reason }; }
    if (!isAvailable('whatsapp_send', store)) {
      msg.status = 'blocked'; msg.block_reason = 'whatsapp_provider_not_configured';
      logRun(store, 'whatsapp_send', (ctx || {}).agent_id, (ctx || {}).task_id, 'blocked', msg.subject, '', 'whatsapp_provider_not_configured');
      OF.save(store);
      return { status: 'blocked', reason: 'whatsapp_provider_not_configured.' };
    }
    msg.status = 'sent'; msg.sent_at = nowISO(); msg.provider = capability('whatsapp_send', store).provider_name; countSend(msg, store); routeOutboundToThread(msg, store);
    OF.save(store);
    return { status: 'sent', message: msg };
  }
  function voiceCall(ctx, store) {
    store = ensure(store || OF.load());
    if (!isAvailable('voice_call', store)) return { status: 'blocked', reason: 'voice_provider_not_configured — no calls or recordings.' };
    return { status: 'blocked', reason: 'voice_call configured but no provider response.' };
  }
  function scheduleInterview(participants, slots, ctx, store) {
    store = ensure(store || OF.load());
    if (!isAvailable('calendar_scheduling', store)) return { status: 'blocked', reason: 'calendar_provider_not_configured — no scheduling.' };
    return { status: 'blocked', reason: 'calendar_scheduling configured but no provider response.' };
  }
  function recordInterview(ctx, store) {
    store = ensure(store || OF.load());
    if (!isAvailable('interview_recording', store)) return { status: 'blocked', reason: 'interview_recording provider_not_configured — no recordings.' };
    return { status: 'blocked', reason: 'interview_recording configured but no provider response.' };
  }

  /* ===== OUTBOUND creation (drafts a message; never auto-sends) ===== */
  function queueOutbound(fields, store) {
    store = ensure(store || OF.load());
    var msg = newOutbound(Object.assign({ status: 'draft' }, fields || {}));
    store.outbound_messages.push(msg);
    OF.save(store);
    return msg;
  }

  /* ===== MANUAL IMPORT — search results & candidates & profile text ===== */
  function importSearchResult(fields, store) {
    store = ensure(store || OF.load());
    var r = newSearchResult(Object.assign({ source: 'manual_import', status: 'imported' }, fields || {}));
    store.search_results.push(r);
    OF.save(store);
    return r;
  }

  /* ===== INBOUND ingest + thread routing =====
     One person, one thread, many channels. Routes by thread_id, or
     by known recipient/email token; uncertain → needs_review. */
  function ingestInbound(fields, store) {
    store = ensure(store || OF.load());
    var msg = newInbound(fields || {});
    // route
    var routed = routeInboundToThread(msg, store);
    msg.status = routed.ok ? 'routed' : 'needs_review';
    if (!routed.ok) msg.route_note = routed.reason;
    store.inbound_messages.push(msg);
    OF.save(store);
    return { message: msg, routed: routed };
  }

  function routeInboundToThread(msg, store) {
    // candidate threads (1M) — by thread_id or candidate_id
    if (msg.sender_type === 'candidate') {
      var ct = msg.thread_id ? byId(store.candidate_threads, 'thread_id', msg.thread_id) : (msg.sender_id ? byId(store.candidate_threads, 'candidate_id', msg.sender_id) : null);
      if (ct && OF.hiring) {
        OF.hiring.addThreadMessage(ct.candidate_id, msg.channel, 'candidate', msg.body, store);
        return { ok: true, thread: 'CandidateThread', candidate_id: ct.candidate_id };
      }
    }
    // stakeholder / reference / org threads (1K/1N) — write into their message arrays
    if (msg.sender_type === 'stakeholder' && store.stakeholder_threads) {
      var stt = msg.thread_id ? byId(store.stakeholder_threads, 'thread_id', msg.thread_id) : (msg.sender_id ? byId(store.stakeholder_threads, 'stakeholder_id', msg.sender_id) : null);
      if (stt) { stt.messages = stt.messages || []; stt.messages.push({ role: 'stakeholder', channel: msg.channel, text: msg.body, at: nowISO() }); stt.last_interaction = nowISO(); return { ok: true, thread: 'StakeholderThread' }; }
    }
    if (msg.sender_type === 'reference' && store.pi_reference_threads) {
      var rt = msg.thread_id ? byId(store.pi_reference_threads, 'thread_id', msg.thread_id) : (msg.sender_id ? byId(store.pi_reference_threads, 'reference_id', msg.sender_id) : null);
      if (rt) { rt.messages = rt.messages || []; rt.messages.push({ role: 'reference', channel: msg.channel, text: msg.body, at: nowISO() }); rt.last_interaction = nowISO(); rt.status = 'responded'; return { ok: true, thread: 'ReferenceValidationThread' }; }
    }
    return { ok: false, reason: 'Could not match a thread by thread_id or sender — held for human review.' };
  }
  function routeOutboundToThread(msg, store) {
    if (msg.recipient_type === 'candidate' && OF.hiring) {
      var ct = msg.thread_id ? byId(store.candidate_threads, 'thread_id', msg.thread_id) : (msg.recipient_id ? byId(store.candidate_threads, 'candidate_id', msg.recipient_id) : null);
      if (ct) OF.hiring.addThreadMessage(ct.candidate_id, msg.channel, 'recruiter', '[sent] ' + msg.subject + ' — ' + msg.body.slice(0, 80), store);
    }
  }

  /* ===== SAFETY / COMPLIANCE ===== */
  function safetyCheck(msg, store) {
    var s = store.contact_safety;
    var rid = msg.recipient_id;
    if (rid && s.do_not_contact.indexOf(rid) !== -1) return { ok: false, reason: 'do_not_contact flag set for this recipient.' };
    if (rid && s.unsubscribed.indexOf(rid) !== -1) return { ok: false, reason: 'recipient has unsubscribed.' };
    if (rid && s.consent_required && !s.consent[rid]) return { ok: false, reason: 'consent required but absent.' };
    // daily cap
    var cap = capability(msg.channel === 'whatsapp' ? 'whatsapp_send' : 'email_send', store);
    var key = (msg.channel || 'email') + ':' + today();
    var sent = (s.sent_today[key] || 0);
    if (cap && cap.daily_limit && sent >= cap.daily_limit) return { ok: false, reason: 'daily send limit (' + cap.daily_limit + ') exceeded for ' + msg.channel + '.' };
    // cooldown
    if (rid && s.cooldown[rid] && Date.now() < s.cooldown[rid]) return { ok: false, reason: 'recipient in cooldown period.' };
    return { ok: true };
  }
  function countSend(msg, store) {
    var s = store.contact_safety;
    var key = (msg.channel || 'email') + ':' + today();
    s.sent_today[key] = (s.sent_today[key] || 0) + 1;
    if (msg.recipient_id) s.cooldown[msg.recipient_id] = Date.now() + 1000 * 60 * 60 * 24 * 3; // 3-day cooldown
  }
  function setSafetyFlag(flag, id, on, store) {
    store = ensure(store || OF.load());
    var s = store.contact_safety;
    if (flag === 'consent_required') { s.consent_required = !!on; OF.save(store); return s; }
    var list = flag === 'do_not_contact' ? s.do_not_contact : flag === 'unsubscribed' ? s.unsubscribed : flag === 'consent' ? null : null;
    if (flag === 'consent') { s.consent[id] = !!on; OF.save(store); return s; }
    if (list) { var i = list.indexOf(id); if (on && i === -1) list.push(id); if (!on && i !== -1) list.splice(i, 1); OF.save(store); }
    return s;
  }

  /* ===== reads ===== */
  function snapshot(store) {
    store = ensure(store || OF.load());
    return {
      registry: store.capability_registry,
      runs: store.capability_runs.slice().sort(function (a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); }),
      search_results: store.search_results.slice().reverse(),
      outbound: store.outbound_messages.slice().reverse(),
      inbound: store.inbound_messages.slice().reverse(),
      safety: store.contact_safety
    };
  }
  function resetCapabilities(store) {
    store = ensure(store || OF.load());
    store.capability_registry = []; store.capability_runs = []; store.search_results = []; store.outbound_messages = []; store.inbound_messages = [];
    store.contact_safety = { do_not_contact: [], unsubscribed: [], blocked_domains: [], consent: {}, sent_today: {}, cooldown: {} };
    seedCaps(store); OF.save(store);
  }

  OF.capabilities = {
    CAP_TYPES: CAP_TYPES, CAP_STATUS: CAP_STATUS, SEARCH_TYPES: SEARCH_TYPES, OUT_STATUS: OUT_STATUS, RECIPIENT_TYPES: RECIPIENT_TYPES, CHANNELS: CHANNELS, CAP_AGENTS: CAP_AGENTS,
    ensure: ensure, capability: capability, isAvailable: isAvailable,
    configure: configure, markStatus: markStatus, setDailyLimit: setDailyLimit,
    searchWeb: searchWeb, searchCandidates: searchCandidates, linkedinIntake: linkedinIntake,
    sendEmail: sendEmail, sendWhatsApp: sendWhatsApp, voiceCall: voiceCall, scheduleInterview: scheduleInterview, recordInterview: recordInterview,
    queueOutbound: queueOutbound, importSearchResult: importSearchResult, ingestInbound: ingestInbound,
    routeInboundToThread: routeInboundToThread, safetyCheck: safetyCheck, setSafetyFlag: setSafetyFlag,
    snapshot: snapshot, resetCapabilities: resetCapabilities
  };
})();
