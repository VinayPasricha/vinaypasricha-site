/* =============================================================
   capabilities-admin.js — Studio · Search & Transport Layer  (2B)
   =============================================================
   Capability registry + provider status, manual import, outbound
   queue/send, inbound ingest + thread routing, safety flags.
   ============================================================= */
(function () {
  'use strict';
  var OF = window.OF;
  var C = OF.capabilities;

  function $(id) { return document.getElementById(id); }
  function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function ttl(s) { return (s || '').replace(/_/g, ' '); }
  function cands() { var st = OF.load(); return (st.cd_candidates || []).map(function (c) { return { id: c.candidate_discovery_id, name: c.person_name }; }); }

  function render() {
    var s = C.snapshot();
    // registry
    $('cp-registry').innerHTML = s.registry.map(function (c) {
      var configurable = c.status !== 'configured' && c.status !== 'available';
      return '<div class="cp-cap">' +
        '<div><div class="cn">' + esc(ttl(c.capability_type)) + '</div><div class="cd">agents: ' + (c.allowed_agents.join(', ') || '—') + ' · risk ' + esc(c.risk_level) + (c.daily_limit ? ' · ' + c.daily_limit + '/day' : '') + '</div></div>' +
        '<div class="cprov">' + esc(c.provider_name) + '</div>' +
        '<span class="cp-st ' + esc(c.status) + '">' + esc(ttl(c.status)) + '</span>' +
        '<div class="cp-capact">' +
          (configurable ? '<button class="cp-mini pos" data-config="' + esc(c.capability_type) + '">Simulate provider</button>' : '<button class="cp-mini warn" data-unconfig="' + esc(c.capability_type) + '">Mark not configured</button>') +
        '</div>' +
      '</div>';
    }).join('');

    // import form
    $('cp-import').innerHTML =
      '<select id="cp-imp-type">' + C.SEARCH_TYPES.map(function (t) { return '<option value="' + t + '">' + esc(t) + '</option>'; }).join('') + '</select>' +
      '<div class="cp-row2"><input id="cp-imp-title" placeholder="Title"><input id="cp-imp-url" placeholder="URL (optional)"></div>' +
      '<textarea id="cp-imp-text" placeholder="Paste the real result text / snippet…"></textarea>' +
      '<button class="cp-act" id="cp-imp-go" type="button">Import as SearchResult</button>';

    // outbound form
    $('cp-outform').innerHTML =
      '<div class="cp-row2"><select id="cp-out-rt">' + C.RECIPIENT_TYPES.map(function (t) { return '<option value="' + t + '">' + esc(t) + '</option>'; }).join('') + '</select>' +
        '<select id="cp-out-ch"><option value="email">email</option><option value="whatsapp">whatsapp</option></select></div>' +
      '<select id="cp-out-cand"><option value="">— link a candidate (optional) —</option>' + cands().map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>'; }).join('') + '</select>' +
      '<input id="cp-out-subj" placeholder="Subject">' +
      '<textarea id="cp-out-body" placeholder="Message body…"></textarea>' +
      '<button class="cp-act" id="cp-out-go" type="button">Queue draft &amp; attempt send</button>';

    // inbound form
    $('cp-inform').innerHTML =
      '<div class="cp-row2"><select id="cp-in-st">' + C.RECIPIENT_TYPES.map(function (t) { return '<option value="' + t + '">' + esc(t) + '</option>'; }).join('') + '</select>' +
        '<select id="cp-in-ch"><option value="email">email</option><option value="whatsapp">whatsapp</option></select></div>' +
      '<select id="cp-in-cand"><option value="">— sender candidate (for routing) —</option>' + cands().map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>'; }).join('') + '</select>' +
      '<textarea id="cp-in-body" placeholder="Paste the reply text…"></textarea>' +
      '<button class="cp-act" id="cp-in-go" type="button">Ingest reply &amp; route to thread</button>';

    // safety
    var sf = s.safety;
    $('cp-safety').innerHTML =
      '<div style="font-family:var(--cp-mono);font-size:9px;letter-spacing:0.08em;text-transform:uppercase;color:var(--cp-ink4);line-height:1.8">' +
        'do_not_contact: ' + (sf.do_not_contact.length || 0) + ' · unsubscribed: ' + (sf.unsubscribed.length || 0) + ' · consent_required: ' + (sf.consent_required ? 'on' : 'off') + '</div>' +
      '<select id="cp-sf-cand"><option value="">— candidate —</option>' + cands().map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>'; }).join('') + '</select>' +
      '<div class="cp-row2">' +
        '<button class="cp-mini warn" id="cp-sf-dnc" type="button">Toggle do-not-contact</button>' +
        '<button class="cp-mini warn" id="cp-sf-unsub" type="button">Toggle unsubscribe</button>' +
        '<button class="cp-mini" id="cp-sf-consentreq" type="button">Toggle consent-required</button>' +
        '<button class="cp-mini pos" id="cp-sf-consent" type="button">Grant consent</button>' +
      '</div>';

    // message lists
    $('cp-outbound').innerHTML = s.outbound.length ? s.outbound.map(function (m) {
      return '<div class="cp-msg"><div class="ms">' + esc(m.subject || '(no subject)') + ' <span class="cp-mst ' + esc(m.status) + '">' + esc(ttl(m.status)) + '</span></div>' +
        '<div class="mm">' + esc(m.recipient_type) + ' · ' + esc(m.channel) + ' · ' + esc(m.provider) + (m.block_reason ? ' · ⚠ ' + esc(m.block_reason) : '') + (m.sent_at ? ' · sent ' + esc(m.sent_at.slice(0, 16)) : '') + '</div>' +
        '<div class="mb">' + esc((m.body || '').slice(0, 120)) + '</div></div>';
    }).join('') : '<div class="cp-empty">No outbound messages yet.</div>';

    $('cp-inbound').innerHTML = s.inbound.length ? s.inbound.map(function (m) {
      return '<div class="cp-msg"><div class="ms">' + esc((m.body || '').slice(0, 70)) + ' <span class="cp-mst ' + esc(m.status) + '">' + esc(ttl(m.status)) + '</span></div>' +
        '<div class="mm">' + esc(m.sender_type) + ' · ' + esc(m.channel) + (m.route_note ? ' · ⚠ ' + esc(m.route_note) : ' · routed to thread') + '</div></div>';
    }).join('') : '<div class="cp-empty">No inbound messages yet.</div>';

    $('cp-results').innerHTML = s.search_results.length ? s.search_results.map(function (r) {
      return '<div class="cp-msg"><div class="ms">' + esc(r.title || '(untitled)') + ' <span class="cp-mst ' + esc(r.status === 'imported' ? 'routed' : 'draft') + '">' + esc(r.status) + '</span></div>' +
        '<div class="mm">' + esc(r.search_type) + ' · ' + esc(r.source) + (r.url ? ' · ' + esc(r.url) : '') + '</div>' +
        '<div class="mb">' + esc((r.raw_text || r.snippet || '').slice(0, 120)) + '</div></div>';
    }).join('') : '<div class="cp-empty">No search results yet — import one manually.</div>';
  }

  document.addEventListener('click', function (e) {
    var t = e.target, id = t.id;
    var cfg = t.getAttribute && t.getAttribute('data-config'); if (cfg) { C.configure(cfg, 'Simulated ' + cfg + ' provider'); render(); return; }
    var unc = t.getAttribute && t.getAttribute('data-unconfig'); if (unc) { C.markStatus(unc, 'not_configured'); render(); return; }
    if (id === 'cp-imp-go') { var txt = (document.getElementById('cp-imp-text') || {}).value; if (!txt || !txt.trim()) { alert('Paste result text.'); return; } C.importSearchResult({ search_type: v('cp-imp-type'), title: v('cp-imp-title'), url: v('cp-imp-url'), raw_text: txt, snippet: txt.slice(0, 100) }); render(); return; }
    if (id === 'cp-out-go') {
      var subj = v('cp-out-subj'), body = (document.getElementById('cp-out-body') || {}).value || '';
      if (!subj && !body) { alert('Add a subject or body.'); return; }
      var ch = v('cp-out-ch');
      var msg = C.queueOutbound({ recipient_type: v('cp-out-rt'), recipient_id: v('cp-out-cand') || null, channel: ch, subject: subj, body: body });
      var res = ch === 'whatsapp' ? C.sendWhatsApp(msg.message_id) : C.sendEmail(msg.message_id);
      if (res && res.reason && res.status === 'blocked') alert('Blocked: ' + res.reason);
      render(); return;
    }
    if (id === 'cp-in-go') {
      var ibody = (document.getElementById('cp-in-body') || {}).value || '';
      if (!ibody.trim()) { alert('Paste the reply text.'); return; }
      var r = C.ingestInbound({ sender_type: v('cp-in-st'), sender_id: v('cp-in-cand') || null, channel: v('cp-in-ch'), body: ibody });
      if (r.routed && !r.routed.ok) alert('Held for review: ' + r.routed.reason);
      render(); return;
    }
    if (id === 'cp-sf-dnc') { var c1 = v('cp-sf-cand'); if (c1) { var st = OF.load(); var on = (st.contact_safety.do_not_contact || []).indexOf(c1) === -1; C.setSafetyFlag('do_not_contact', c1, on); render(); } return; }
    if (id === 'cp-sf-unsub') { var c2 = v('cp-sf-cand'); if (c2) { var st2 = OF.load(); var on2 = (st2.contact_safety.unsubscribed || []).indexOf(c2) === -1; C.setSafetyFlag('unsubscribed', c2, on2); render(); } return; }
    if (id === 'cp-sf-consentreq') { var st3 = OF.load(); C.setSafetyFlag('consent_required', null, !st3.contact_safety.consent_required); render(); return; }
    if (id === 'cp-sf-consent') { var c3 = v('cp-sf-cand'); if (c3) { C.setSafetyFlag('consent', c3, true); render(); } return; }
    if (id === 'cp-reset') { if (confirm('Reset capabilities, messages and safety flags?')) { C.resetCapabilities(); render(); } return; }
  });
  function v(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }

  render();
})();
