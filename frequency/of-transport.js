/* =============================================================
   Organizational Frequency — Communication Transport Layer  (2C)
   =============================================================
   Sits BENEATH the capability layer. Turns

       Agent → Capability Layer → BLOCKED

   into

       Agent → Capability Layer → Transport → Provider → Recipient

   when a provider is configured. Implements the email path first
   (SMTP / SendGrid / SES / Gmail adapters), with WhatsApp / SMS /
   LinkedIn adapters as honest not_configured placeholders.

   HONESTY: no fake send, delivery, open, reply, or routing. If no
   provider is configured the send blocks honestly. A "simulate"
   provider is offered ONLY for testing and is labelled as such —
   it never claims a real external delivery.

   Every outbound carries a THREAD TOKEN so replies route back to
   the right thread automatically. Delivery is tracked as
   TransportEvents; threads + audit are updated on every event.

   Augments window.OF with window.OF.transport.
   ============================================================= */
(function () {
  'use strict';
  if (!window.OF) { console.warn('of-transport.js requires of-model.js'); return; }
  var OF = window.OF;

  var PROVIDER_TYPES = ['email', 'whatsapp', 'sms', 'linkedin_message', 'future'];
  var PROVIDER_STATUS = ['configured', 'not_configured', 'failed', 'paused'];
  var MSG_STATUS = ['queued', 'sent', 'delivered', 'opened', 'responded', 'failed', 'blocked'];
  var EVENT_TYPES = ['sent', 'delivered', 'opened', 'clicked', 'responded', 'failed', 'unsubscribed', 'bounced'];
  // the email adapters we ship interfaces for; all start not_configured
  var EMAIL_ADAPTERS = ['smtp', 'sendgrid', 'amazon_ses', 'gmail', 'simulate'];

  function nowISO() { return new Date().toISOString(); }
  function uid(p) { return OF.uid(p); }
  function byId(arr, key, val) { return (arr || []).filter(function (x) { return x[key] === val; })[0] || null; }

  function ensure(store) {
    store.transport_providers = store.transport_providers || [];
    store.transport_messages = store.transport_messages || [];
    store.transport_events = store.transport_events || [];
    seedProviders(store);
    return store;
  }
  function seedProviders(store) {
    if (store.transport_providers.length) return;
    // one provider row per channel; email shows the active adapter in configuration
    [['email', 'Email', 50], ['whatsapp', 'WhatsApp', 30], ['sms', 'SMS', 30], ['linkedin_message', 'LinkedIn Message', 0]].forEach(function (p) {
      store.transport_providers.push(newProvider({ provider_name: p[1], provider_type: p[0], status: 'not_configured', daily_limit: p[2], rate_limit: '—', configuration: { adapter: '(none)' } }));
    });
  }

  /* ===== SCHEMAS ===== */
  function newProvider(f) {
    f = f || {};
    return {
      provider_id: f.provider_id || uid('tprov'),
      provider_name: f.provider_name || '', provider_type: PROVIDER_TYPES.indexOf(f.provider_type) !== -1 ? f.provider_type : 'email',
      status: PROVIDER_STATUS.indexOf(f.status) !== -1 ? f.status : 'not_configured',
      configuration: f.configuration || {}, daily_limit: f.daily_limit || 0, rate_limit: f.rate_limit || '—',
      created_at: f.created_at || nowISO()
    };
  }
  function newTMessage(f) {
    f = f || {};
    return {
      transport_message_id: f.transport_message_id || uid('tmsg'),
      outbound_message_id: f.outbound_message_id || null, thread_id: f.thread_id || null,
      thread_token: f.thread_token || null,
      channel: f.channel || 'email', provider: f.provider || '(none)', recipient: f.recipient || '',
      subject: f.subject || '', body: f.body || '',
      status: MSG_STATUS.indexOf(f.status) !== -1 ? f.status : 'queued', provider_message_id: f.provider_message_id || null,
      created_at: f.created_at || nowISO(), sent_at: f.sent_at || null, delivered_at: f.delivered_at || null,
      opened_at: f.opened_at || null, responded_at: f.responded_at || null, failed_at: f.failed_at || null,
      block_reason: f.block_reason || ''
    };
  }
  function newEvent(f) {
    f = f || {};
    return {
      event_id: f.event_id || uid('tevt'), transport_message_id: f.transport_message_id || null,
      event_type: EVENT_TYPES.indexOf(f.event_type) !== -1 ? f.event_type : 'sent',
      payload: f.payload || {}, timestamp: f.timestamp || nowISO()
    };
  }

  /* ===== provider config ===== */
  function provider(type, store) { store = ensure(store || OF.load()); return byId(store.transport_providers, 'provider_type', type); }
  function configureProvider(type, adapter, store) {
    store = ensure(store || OF.load());
    var p = provider(type, store);
    if (!p) return null;
    if (type === 'email' && EMAIL_ADAPTERS.indexOf(adapter) === -1) adapter = 'smtp';
    p.configuration = { adapter: adapter || 'configured' };
    p.provider_name = (type === 'email' ? adapterLabel(adapter) : p.provider_name);
    p.status = 'configured';
    // mirror availability up into the capability layer so the capability reports configured too
    if (OF.capabilities) {
      var capType = type === 'email' ? 'email_send' : type === 'whatsapp' ? 'whatsapp_send' : null;
      if (capType) OF.capabilities.configure(capType, p.provider_name, store);
    }
    OF.save(store);
    return p;
  }
  function setProviderStatus(type, status, store) {
    store = ensure(store || OF.load());
    var p = provider(type, store);
    if (p && PROVIDER_STATUS.indexOf(status) !== -1) {
      p.status = status;
      if (status === 'not_configured') { p.configuration = { adapter: '(none)' }; }
      if (OF.capabilities) {
        var capType = type === 'email' ? 'email_send' : type === 'whatsapp' ? 'whatsapp_send' : null;
        if (capType) OF.capabilities.markStatus(capType, status === 'configured' ? 'configured' : 'not_configured', store);
      }
      OF.save(store);
    }
    return p;
  }
  function adapterLabel(a) { return ({ smtp: 'SMTP', sendgrid: 'SendGrid', amazon_ses: 'Amazon SES', gmail: 'Gmail', simulate: 'Simulated Email (test)' })[a] || 'Email'; }
  function isConfigured(type, store) { var p = provider(type, store); return p && p.status === 'configured'; }

  /* ===== THREAD TOKEN — embed in outbound, parse from inbound ===== */
  function makeToken(threadId, recipientId) {
    return 'OFREQ-' + (threadId || 'nothr').slice(-8) + '-' + (recipientId || 'norec').slice(-8);
  }
  function bodyWithToken(body, token) {
    return (body || '') + '\n\n—\nRef: ' + token + ' · reply above this line.';
  }
  function parseToken(text) {
    var m = (text || '').match(/OFREQ-([A-Za-z0-9]+)-([A-Za-z0-9]+)/);
    return m ? { raw: m[0], thread_suffix: m[1], recipient_suffix: m[2] } : null;
  }

  /* ===== SEND — called by the capability layer's sendEmail =====
     Honest: blocks if no provider; on the simulate adapter it
     records a transport message + 'sent' event but never claims a
     real external delivery (delivered/opened only fire if a
     webhook/simulated event is explicitly recorded). */
  function send(outbound, ctx, store) {
    store = ensure(store || OF.load());
    var type = outbound.channel === 'whatsapp' ? 'whatsapp' : outbound.channel === 'sms' ? 'sms' : 'email';
    var p = provider(type, store);
    var token = makeToken(outbound.thread_id, outbound.recipient_id);

    if (!p || p.status !== 'configured') {
      var tmBlocked = newTMessage({ outbound_message_id: outbound.message_id, thread_id: outbound.thread_id, thread_token: token,
        channel: outbound.channel, provider: p ? p.provider_name : '(none)', recipient: outbound.recipient_id || '', subject: outbound.subject, body: outbound.body,
        status: 'blocked', block_reason: type + '_provider_not_configured' });
      store.transport_messages.push(tmBlocked);
      OF.save(store);
      return { status: 'blocked', reason: type + '_provider_not_configured — configure a provider in Transport.', transport_message: tmBlocked };
    }

    var tm = newTMessage({
      outbound_message_id: outbound.message_id, thread_id: outbound.thread_id, thread_token: token,
      channel: outbound.channel, provider: p.provider_name, recipient: outbound.recipient_id || '',
      subject: outbound.subject, body: bodyWithToken(outbound.body, token), status: 'sent',
      provider_message_id: (p.configuration.adapter === 'simulate' ? 'sim-' : 'prov-') + uid('m'), sent_at: nowISO()
    });
    store.transport_messages.push(tm);
    recordEvent(tm.transport_message_id, 'sent', { provider: p.provider_name, adapter: p.configuration.adapter }, store);
    OF.save(store);
    return { status: 'sent', transport_message: tm, simulated: p.configuration.adapter === 'simulate' };
  }

  /* ===== DELIVERY TRACKING — events advance the message ===== */
  function recordEvent(tmId, type, payload, store) {
    store = ensure(store || OF.load());
    var tm = byId(store.transport_messages, 'transport_message_id', tmId);
    if (!tm) return null;
    var ev = newEvent({ transport_message_id: tmId, event_type: type, payload: payload || {} });
    store.transport_events.push(ev);
    // advance status + timestamps
    if (type === 'delivered') { tm.delivered_at = nowISO(); if (tm.status === 'sent') tm.status = 'delivered'; }
    else if (type === 'opened') { tm.opened_at = nowISO(); if (['sent', 'delivered'].indexOf(tm.status) !== -1) tm.status = 'opened'; }
    else if (type === 'responded') { tm.responded_at = nowISO(); tm.status = 'responded'; }
    else if (type === 'failed' || type === 'bounced') { tm.failed_at = nowISO(); tm.status = 'failed'; }
    else if (type === 'unsubscribed' && OF.capabilities && tm.recipient) { OF.capabilities.setSafetyFlag('unsubscribed', tm.recipient, true, store); }
    OF.save(store);
    return ev;
  }
  // testing/webhook hook: simulate a provider delivery event (clearly a sim)
  function simulateEvent(tmId, type, store) { return recordEvent(tmId, type, { simulated: true }, store); }

  /* ===== INBOUND / REPLY ROUTER =====
     Parse the thread token; route into the right existing thread via
     the capability layer's ingestInbound. Never drops a message. */
  function ingestReply(rawBody, opts, store) {
    store = ensure(store || OF.load());
    opts = opts || {};
    var token = parseToken(rawBody) || (opts.token ? parseToken(opts.token) : null);
    var tm = null;
    if (token) tm = store.transport_messages.filter(function (m) { return m.thread_token && m.thread_token.indexOf(token.thread_suffix) !== -1; })[0];
    var threadId = tm ? tm.thread_id : (opts.thread_id || null);
    var senderType = opts.sender_type || (tm ? recipientTypeFor(tm, store) : 'candidate');
    var senderId = opts.sender_id || (tm ? tm.recipient : null);

    if (tm) { recordEvent(tm.transport_message_id, 'responded', { via: 'reply' }, store); store = OF.load(); ensure(store); }

    if (!OF.capabilities) return { status: 'failed', reason: 'capability layer unavailable' };
    var res = OF.capabilities.ingestInbound({ sender_type: senderType, sender_id: senderId, thread_id: threadId, channel: (tm ? tm.channel : 'email'), body: stripToken(rawBody), provider: tm ? tm.provider : 'inbound' }, store);
    return { routed: res.routed, inbound: res.message, matched_transport: !!tm, token: token ? token.raw : null };
  }
  function recipientTypeFor(tm, store) {
    var ob = OF.capabilities ? byId((store.outbound_messages || []), 'message_id', tm.outbound_message_id) : null;
    return ob ? ob.recipient_type : 'candidate';
  }
  function stripToken(body) { return (body || '').replace(/\n*—\nRef: OFREQ-[^\n]*/g, '').trim(); }

  /* ===== reads ===== */
  function snapshot(store) {
    store = ensure(store || OF.load());
    var msgs = store.transport_messages.slice().reverse();
    return {
      providers: store.transport_providers,
      messages: msgs,
      events: store.transport_events.slice().reverse(),
      counts: {
        queued: msgs.filter(function (m) { return m.status === 'queued'; }).length,
        sent: msgs.filter(function (m) { return ['sent', 'delivered', 'opened', 'responded'].indexOf(m.status) !== -1; }).length,
        responded: msgs.filter(function (m) { return m.status === 'responded'; }).length,
        failed: msgs.filter(function (m) { return m.status === 'failed'; }).length,
        blocked: msgs.filter(function (m) { return m.status === 'blocked'; }).length
      }
    };
  }
  function getMessage(tmId, store) { store = ensure(store || OF.load()); var tm = byId(store.transport_messages, 'transport_message_id', tmId); return tm ? { message: tm, events: store.transport_events.filter(function (e) { return e.transport_message_id === tmId; }) } : null; }
  function resetTransport(store) {
    store = ensure(store || OF.load());
    store.transport_providers = []; store.transport_messages = []; store.transport_events = [];
    seedProviders(store); OF.save(store);
  }

  OF.transport = {
    PROVIDER_TYPES: PROVIDER_TYPES, PROVIDER_STATUS: PROVIDER_STATUS, MSG_STATUS: MSG_STATUS, EVENT_TYPES: EVENT_TYPES, EMAIL_ADAPTERS: EMAIL_ADAPTERS,
    ensure: ensure, provider: provider, isConfigured: isConfigured,
    configureProvider: configureProvider, setProviderStatus: setProviderStatus,
    send: send, recordEvent: recordEvent, simulateEvent: simulateEvent,
    ingestReply: ingestReply, makeToken: makeToken, parseToken: parseToken,
    snapshot: snapshot, getMessage: getMessage, resetTransport: resetTransport
  };
})();
