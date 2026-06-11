/* =============================================================
   transport-admin.js — Studio · Communication Transport (2C)
   =============================================================
   Providers + health, delivery tracking, simulate inbound reply.
   ============================================================= */
(function () {
  'use strict';
  var OF = window.OF;
  var T = OF.transport;

  function $(id) { return document.getElementById(id); }
  function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function ttl(s) { return (s || '').replace(/_/g, ' '); }
  function v(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }

  function render() {
    var s = T.snapshot();
    $('tr-tiles').innerHTML =
      tile('', s.counts.queued, 'Queued') + tile('sent', s.counts.sent, 'Sent') +
      tile('responded', s.counts.responded, 'Responded') + tile('failed', s.counts.failed, 'Failed') + tile('blocked', s.counts.blocked, 'Blocked');

    $('tr-providers').innerHTML = s.providers.map(function (p) {
      var isEmail = p.provider_type === 'email';
      var adapterSel = isEmail
        ? '<select data-adapter="email">' + T.EMAIL_ADAPTERS.map(function (a) { return '<option value="' + a + '"' + (p.configuration && p.configuration.adapter === a ? ' selected' : '') + '>' + esc(adapterName(a)) + '</option>'; }).join('') + '</select>'
        : '<span class="pd">adapter interface only</span>';
      var act = p.status === 'configured'
        ? '<button class="tr-mini warn" data-unconfig="' + esc(p.provider_type) + '">Set not configured</button>'
        : '<button class="tr-mini" data-config="' + esc(p.provider_type) + '">' + (isEmail ? 'Configure adapter' : 'Mark configured') + '</button>';
      return '<div class="tr-prov">' +
        '<div><div class="pn">' + esc(p.provider_name) + '</div><div class="pd">' + esc(ttl(p.provider_type)) + (p.daily_limit ? ' · ' + p.daily_limit + '/day' : '') + '</div></div>' +
        '<div>' + adapterSel + '</div>' +
        '<span class="tr-st ' + esc(p.status) + '">' + esc(ttl(p.status)) + '</span>' +
        act +
      '</div>';
    }).join('');

    // reply form
    $('tr-replyform').innerHTML =
      '<input id="tr-rep-token" placeholder="Thread token (OFREQ-…) — leave blank to paste it inside the body">' +
      '<textarea id="tr-rep-body" placeholder="Paste the reply text (include the OFREQ-… ref line to auto-route)…"></textarea>' +
      '<button class="tr-act" id="tr-rep-go" type="button">Ingest reply &amp; route</button>';

    // messages + events
    $('tr-messages').innerHTML = s.messages.length ? s.messages.map(function (m) {
      var evs = s.events.filter(function (e) { return e.transport_message_id === m.transport_message_id; });
      var canAdvance = m.status !== 'blocked' && m.status !== 'failed' && m.status !== 'responded';
      var evBtns = canAdvance ? ['delivered', 'opened', 'bounced'].map(function (t) { return '<span class="tr-evt" data-evt="' + t + '" data-tm="' + esc(m.transport_message_id) + '">simulate ' + t + '</span>'; }).join('') : '';
      return '<div class="tr-msg"><div class="ms">' + esc(m.subject || '(no subject)') + ' <span class="tr-mst ' + esc(m.status) + '">' + esc(ttl(m.status)) + '</span></div>' +
        '<div class="mm">' + esc(m.channel) + ' · ' + esc(m.provider) + ' · token <span class="mtok">' + esc(m.thread_token || '—') + '</span>' + (m.block_reason ? ' · ⚠ ' + esc(m.block_reason) : '') + (m.responded_at ? ' · replied ' + esc(m.responded_at.slice(0, 16)) : '') + '</div>' +
        '<div class="tr-evts">' + evs.map(function (e) { return '<span class="tr-evt" style="cursor:default">✓ ' + esc(e.event_type) + (e.payload && e.payload.simulated ? ' (sim)' : '') + '</span>'; }).join('') + evBtns + '</div>' +
      '</div>';
    }).join('') : '<div class="tr-empty">No transport messages yet. Configure the email adapter, then send from <a href="capabilities.html" style="color:var(--tr-freq)">Capabilities</a> or <a href="agents.html" style="color:var(--tr-freq)">Agents</a>.</div>';
  }
  function tile(cls, n, label) { return '<div class="tr-tile ' + cls + '"><div class="tn">' + n + '</div><div class="tl">' + label + '</div></div>'; }
  function adapterName(a) { return ({ smtp: 'SMTP', sendgrid: 'SendGrid', amazon_ses: 'Amazon SES', gmail: 'Gmail', simulate: 'Simulated (test)' })[a] || a; }

  document.addEventListener('click', function (e) {
    var t = e.target, id = t.id;
    var cfg = t.getAttribute && t.getAttribute('data-config');
    if (cfg) { var adp = cfg === 'email' ? (v2('email') || 'simulate') : 'configured'; T.configureProvider(cfg, adp); render(); return; }
    var unc = t.getAttribute && t.getAttribute('data-unconfig'); if (unc) { T.setProviderStatus(unc, 'not_configured'); render(); return; }
    var ev = t.getAttribute && t.getAttribute('data-evt'); if (ev) { T.simulateEvent(t.getAttribute('data-tm'), ev); render(); return; }
    if (id === 'tr-rep-go') {
      var body = (document.getElementById('tr-rep-body') || {}).value || '';
      var token = v('tr-rep-token');
      if (!body.trim() && !token) { alert('Paste reply text (with the OFREQ token) or enter the token.'); return; }
      var res = T.ingestReply(body, { token: token || null });
      if (res && res.routed && !res.routed.ok) alert('Held for review: ' + res.routed.reason);
      else if (res && res.routed) alert('Routed into ' + res.routed.thread);
      render(); return;
    }
    if (id === 'tr-reset') { if (confirm('Reset transport providers, messages and events?')) { T.resetTransport(); render(); } return; }
  });
  function v2(type) { var sel = document.querySelector('[data-adapter="' + type + '"]'); return sel ? sel.value : ''; }

  render();
})();
