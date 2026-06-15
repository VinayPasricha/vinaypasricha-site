/* =============================================================
   Organizational Frequency — chat persistence client
   =============================================================
   Records the Mission Capture conversation turn-by-turn and saves
   it to the backend (MongoDB) ANONYMOUSLY. No sign-in required.

   - A sessionId is generated once per sitting and kept in
     sessionStorage, so re-saves UPDATE the same document instead
     of creating duplicates.
   - Saving is best-effort and never blocks the chat UI: if the
     backend is unreachable, the conversation still works locally
     and we simply retry on the next turn.

   Exposes window.OFChatStore:
     .sessionId
     .addTurn(role, content)      // role: 'assistant' | 'user' | 'system'
     .setLead({ name, email, organizationName })
     .save({ status, artefact })  // returns a Promise
   ============================================================= */
(function () {
  'use strict';

  // ---- Where the API lives -----------------------------------
  // Same-origin in production (the Node backend serves this page too).
  // When developing with a separate static server (e.g. python on :8000),
  // point at the backend on :4000. Override anytime via window.OF_API_BASE.
  function apiBase() {
    if (typeof window.OF_API_BASE === 'string') return window.OF_API_BASE;
    var devPorts = { '8000': 1, '5500': 1, '3000': 1 };
    if (location.protocol === 'file:' || devPorts[location.port]) {
      return 'http://localhost:4000';
    }
    return ''; // same origin
  }

  // ---- Session id (stable for this sitting) ------------------
  var SID_KEY = 'of.chat.sessionId';
  function makeSid() {
    return 'of_' + Date.now().toString(36) + '_' +
      Math.random().toString(36).slice(2, 8);
  }
  var sessionId;
  try {
    sessionId = sessionStorage.getItem(SID_KEY) || makeSid();
    sessionStorage.setItem(SID_KEY, sessionId);
  } catch (e) {
    sessionId = makeSid(); // private mode / storage blocked
  }

  // ---- In-memory transcript ----------------------------------
  var messages = [];
  var lead = { name: '', email: '', organizationName: '' };

  function addTurn(role, content) {
    if (!content || !String(content).trim()) return;
    messages.push({ role: role, content: String(content), at: new Date().toISOString() });
  }

  function setLead(fields) {
    fields = fields || {};
    if (fields.name) lead.name = fields.name;
    if (fields.email) lead.email = fields.email;
    if (fields.organizationName) lead.organizationName = fields.organizationName;
  }

  // ---- Save (best-effort) ------------------------------------
  function save(opts) {
    opts = opts || {};
    var body = {
      sessionId: sessionId,
      messages: messages,
      status: opts.status || 'active',
      name: lead.name,
      email: lead.email,
      organizationName: lead.organizationName,
    };
    if (opts.artefact !== undefined) body.artefact = opts.artefact;

    var headers = { 'Content-Type': 'application/json' };
    // Attach a Google token if some other part of the site signed the user in.
    if (typeof window.OF_AUTH_TOKEN === 'string' && window.OF_AUTH_TOKEN) {
      headers['Authorization'] = 'Bearer ' + window.OF_AUTH_TOKEN;
    }

    return fetch(apiBase() + '/api/runtimes/of/conversations', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body),
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; }); // never throw into the UI
  }

  window.OFChatStore = {
    sessionId: sessionId,
    addTurn: addTurn,
    setLead: setLead,
    save: save,
  };
})();
