/* =============================================================
   memory.js — client storage-adapter + essence schema  (v1.1)
   =============================================================
   Implements "Event Schema + API Contracts v1.1" against the
   browser today and the API tomorrow, UNCHANGED.

   • localStorage mode (default): one key `of.memory.v2` holding
     { user_id, email, phone, events[], turns[], sessions{}, living_summary }.
     Events are stored WITHOUT hashes (the server builds the chain
     at migration upload).
   • API mode: Memory.config({ apiBase: 'https://…' }) switches every
     write/read to the §11 endpoints. Same objects, same shapes —
     a transport swap, not a reshape.

   Truth model honoured: append-only events, contradictions via
   `supersedes` (never edit), mandatory provenance, conversation_summary
   per (session_id, pass), 30-min inactivity + sweeper finalization with
   a compare-and-set so double-write is impossible.

   Exposes window.Memory.  No dependencies.
   ============================================================= */
(function () {
  'use strict';

  var KEY = 'of.memory.v2';
  var CFG = { apiBase: null, inactivityMs: 30 * 60 * 1000 };

  /* ---------- low-level ---------- */
  function uuid() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8); return v.toString(16);
    });
  }
  function nowISO() { return new Date().toISOString(); }
  function emptyStore() { return { user_id: null, email: null, phone: null, google_id: null, events: [], turns: [], sessions: {}, living_summary: '' }; }
  function load() {
    try { var r = localStorage.getItem(KEY); if (r) { var s = JSON.parse(r); s.events = s.events || []; s.turns = s.turns || []; s.sessions = s.sessions || {}; return s; } } catch (e) {}
    return emptyStore();
  }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} return s; }

  /* ---------- identity (Google email verified + phone collected, no OTP) ---------- */
  function setUser(f) {
    f = f || {}; var s = load();
    if (!s.user_id) s.user_id = uuid();
    if (f.email) s.email = f.email;
    if (f.phone) s.phone = f.phone;       // collected, NOT verified — metadata only
    if (f.google_id) s.google_id = f.google_id;
    save(s); return s.user_id;
  }
  function getUserId() { return load().user_id; }

  /* ---------- event envelope + factories ---------- */
  function envelope(type, content, o) {
    o = o || {}; var s = load();
    return {
      event_id: uuid(),                 // client-generated = idempotency key
      user_id: s.user_id,
      ts: nowISO(),
      runtime: o.runtime || 'org_frequency',
      agent: o.agent || { name: 'aeon1', version: 'v1' },
      session_id: o.session_id || null,
      pass: o.pass || 'live',
      type: type,
      content: content || {},
      provenance: {
        source: o.source || 'agent_inferred',          // user_said | agent_inferred | operator_asserted
        confidence: (o.confidence != null ? o.confidence : 0.5),
        status: o.status || 'provisional',             // provisional | validated | retired
        supersedes: o.supersedes || null
      }
      // prev_hash / hash are SERVER-assigned — never computed here.
    };
  }
  var events = {
    conversationSummary: function (c, o) { return envelope('conversation_summary', c, o); },
    fact:                function (c, o) { return envelope('fact', c, o); },
    frequencyUpdate:     function (c, o) { return envelope('frequency_update', c, o); },
    innerChangeNote:     function (c, o) { return envelope('inner_change_note', c, o); },
    journeyPosition:     function (c, o) { return envelope('journey_position', c, o); },
    operatorValidation:  function (c, o) { return envelope('operator_validation', c, o); },
    erasureTombstone:    function (c, o) { return envelope('erasure_tombstone', c || { reason: 'user_command' }, o); }
  };

  /* ---------- append events (POST /events contract) ---------- */
  function appendEvents(evs) {
    evs = Array.isArray(evs) ? evs : [evs];
    if (CFG.apiBase) return apiPost('/events', { user_id: getUserId(), events: evs });

    var s = load();
    var accepted = [], rejected = [];
    var seen = {}; s.events.forEach(function (e) { seen[e.event_id] = 1; });
    var summ = {}; s.events.forEach(function (e) { if (e.type === 'conversation_summary') summ[e.session_id + '|' + e.pass] = 1; });

    evs.forEach(function (e) {
      if (seen[e.event_id]) { rejected.push({ event_id: e.event_id, reason: 'duplicate' }); return; }
      if (e.type === 'conversation_summary') {
        var k = e.session_id + '|' + e.pass;
        if (summ[k]) { rejected.push({ event_id: e.event_id, reason: 'finalized_session' }); return; }
        summ[k] = 1;
      }
      s.events.push(e); seen[e.event_id] = 1; accepted.push(e.event_id);
      if (e.type === 'conversation_summary') updateLiving(s, e);
    });
    save(s);
    return Promise.resolve({ accepted: accepted, rejected: rejected, chain_head: null });
  }
  function updateLiving(s, e) {
    var sum = (e.content && e.content.summary) || '';
    if (!sum) return;
    s.living_summary = (sum + (s.living_summary ? '\n\n' + s.living_summary : '')).slice(0, 4000);
  }

  /* ---------- turns / Holding Buffer (POST /turns) ---------- */
  function recordTurn(session_id, role, text) {
    var s = load(); var sess = s.sessions[session_id];
    if (!sess) return null;
    var turn = { session_id: session_id, user_id: s.user_id, turn_index: sess.turn_count || 0, role: role, text: text, ts: nowISO() };
    if (CFG.apiBase) { apiPost('/turns', turn); } else { s.turns.push(turn); }
    sess.turn_count = (sess.turn_count || 0) + 1;
    sess.lastActivity = Date.now();
    if (sess.state === 'open' && !sess.startedMs) sess.startedMs = Date.now();
    save(s);
    return turn;
  }

  /* ---------- session lifecycle ---------- */
  function startSession(runtime, agent) {
    var s = load(); var id = uuid();
    s.sessions[id] = { state: 'open', runtime: runtime || 'org_frequency', agent: agent || { name: 'aeon1', version: 'v1' }, started: nowISO(), startedMs: Date.now(), lastActivity: Date.now(), turn_count: 0 };
    save(s); return id;
  }

  // compare-and-set open -> finalizing; only the winner writes essence.
  function finalizeSession(session_id, endedBy, pass) {
    pass = pass || 'live';
    var s = load(); var sess = s.sessions[session_id];
    if (!sess) return Promise.resolve(null);
    if (pass === 'live') {
      if (sess.state !== 'open') return Promise.resolve(null);   // lost the race
      sess.state = 'finalizing'; save(s);
    }
    var turns = s.turns.filter(function (t) { return t.session_id === session_id; });
    var content = deriveSummary(turns, endedBy, sess);
    var ev = events.conversationSummary(content, { runtime: sess.runtime, agent: sess.agent, session_id: session_id, pass: pass, source: 'agent_inferred', confidence: 0.6, status: 'provisional' });
    return appendEvents([ev]).then(function (res) {
      var s2 = load(); var ss = s2.sessions[session_id];
      if (ss) { ss.state = 'finalized'; ss.finalizedAt = nowISO(); save(s2); }
      return { event: ev, result: res };
    });
  }

  // toy essence derivation (the real pass is a model call server-side).
  function deriveSummary(turns, endedBy, sess) {
    var userTurns = turns.filter(function (t) { return t.role === 'user'; });
    var joined = userTurns.map(function (t) { return t.text; }).join(' ').replace(/\s+/g, ' ').trim();
    var summary = joined ? ('Conversation covered: ' + joined.slice(0, 360)) : 'Brief session; no substantive content.';
    var surprise = userTurns.length >= 4 ? 'high' : userTurns.length >= 2 ? 'low' : 'none';
    var dur = sess && sess.startedMs ? Math.round((Date.now() - sess.startedMs) / 1000) : 0;
    return { summary: summary, surprise: surprise, open_questions: [], turn_count: turns.length, duration_seconds: dur, ended_by: endedBy || 'explicit' };
  }

  /* ---------- inactivity + sweeper (the two non-explicit finalizers) ---------- */
  function dueOpenSessions() {
    var s = load(); var out = [];
    Object.keys(s.sessions).forEach(function (id) {
      var ss = s.sessions[id];
      if (ss.state === 'open' && (Date.now() - ss.lastActivity) > CFG.inactivityMs) out.push(id);
    });
    return out;
  }
  function checkInactivity() { dueOpenSessions().forEach(function (id) { finalizeSession(id, 'inactivity'); }); }
  function sweepOpen()       { dueOpenSessions().forEach(function (id) { finalizeSession(id, 'sweeper'); }); }

  /* ---------- reconciliation pass (run before the 30-day delete) ---------- */
  function reconcile(session_id) {
    var s = load();
    var live = s.events.filter(function (e) { return e.type === 'conversation_summary' && e.session_id === session_id && e.pass === 'live'; })[0];
    var turns = s.turns.filter(function (t) { return t.session_id === session_id; });
    var sess = s.sessions[session_id] || {};
    var content = deriveSummary(turns, live ? live.content.ended_by : 'explicit', sess);
    var ev = events.conversationSummary(content, {
      runtime: sess.runtime, agent: sess.agent, session_id: session_id, pass: 'reconciliation',
      source: 'agent_inferred', confidence: 0.7, status: 'provisional', supersedes: live ? live.event_id : null
    });
    return appendEvents([ev]);
  }

  /* ---------- reads (GET /memory contract) ---------- */
  function getMemory() {
    if (CFG.apiBase) return apiGet('/memory/' + getUserId());
    var s = load();
    var journey = s.events.filter(function (e) { return e.type === 'journey_position'; }).slice(-1)[0];
    return Promise.resolve({
      user_id: s.user_id,
      journey_position: journey ? journey.content : null,
      living_summary: s.living_summary || '',
      recent_events: s.events.slice().reverse().slice(0, 20),
      validated_facts: s.events.filter(function (e) { return e.type === 'fact' && e.provenance.status === 'validated'; }).map(function (e) { return e.content; }),
      chain_head: null,
      as_of: nowISO()
    });
  }

  /* ---------- erasure (crypto-shred analog) ---------- */
  function erase(reason) {
    if (CFG.apiBase) return apiPost('/erase', { user_id: getUserId(), reason: reason || 'user_command' });
    var tomb = events.erasureTombstone({ reason: reason || 'user_command' });
    // local analog of key-destruction: everything becomes unreadable (dropped); tombstone retained.
    save({ user_id: null, email: null, phone: null, google_id: null, events: [], turns: [], sessions: {}, living_summary: '', _tombstone: { ts: nowISO(), reason: reason || 'user_command', event_id: tomb.event_id } });
    return Promise.resolve({ erased: true, tombstone: tomb });
  }

  /* ---------- transport (API mode) ---------- */
  function apiPost(path, body) { return fetch(CFG.apiBase + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(function (r) { return r.json(); }); }
  function apiGet(path) { return fetch(CFG.apiBase + path).then(function (r) { return r.json(); }); }

  function config(o) { o = o || {}; if (o.apiBase !== undefined) CFG.apiBase = o.apiBase; if (o.inactivityMs != null) CFG.inactivityMs = o.inactivityMs; return { apiBase: CFG.apiBase, inactivityMs: CFG.inactivityMs }; }

  /* ---------- boot ---------- */
  try { sweepOpen(); setInterval(checkInactivity, 60 * 1000); } catch (e) {}

  window.Memory = {
    config: config,
    setUser: setUser, getUserId: getUserId,
    startSession: startSession, recordTurn: recordTurn,
    endSession: function (id, reason) { return finalizeSession(id, reason || 'explicit'); },
    finalizeSession: finalizeSession, reconcile: reconcile,
    appendEvents: appendEvents, events: events,
    getMemory: getMemory, erase: erase,
    _load: load, _KEY: KEY
  };
})();
