/* Organizational Validation Runtime (Build 3C)
   Renders OF.orgval over the shared of.runtime.v1 store.
   Reads 3B public pages/estimates/contradictions; writes validated understanding. */
(function () {
  'use strict';
  if (!window.OF || !window.OF.orgval) { console.warn('org-validation-admin.js requires of-org-validation.js'); return; }
  var V = window.OF.orgval;

  var viewEl = document.getElementById('ov-view');
  var ladderEl = document.getElementById('ov-ladder');
  var statsEl = document.getElementById('ov-stats');
  var toastEl = document.getElementById('ov-toast');

  var activeCampaign = null;   // open campaign workspace

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function titleCase(s) { return String(s || '').replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(function () { toastEl.classList.remove('show'); }, 2800); }

  function render() {
    var s = V.snapshot();
    renderLadder(s);
    renderStats(s);
    var html = '';
    html += campaignsPanel(s);
    if (activeCampaign) html += workspace(activeCampaign);
    viewEl.innerHTML = html;
    wire(s);
  }

  function renderLadder(s) {
    // ladder reflects the furthest-progressed open/active campaign
    var stage = 'public_estimate';
    if (activeCampaign) {
      var f = V.getCampaign(activeCampaign);
      if (f && f.profile) stage = f.profile.stage;
    } else {
      // otherwise show the max stage across campaigns
      var order = V.STAGES;
      s.campaigns.forEach(function (c) {
        var fc = V.getCampaign(c.campaign_id);
        if (fc && fc.profile && order.indexOf(fc.profile.stage) > order.indexOf(stage)) stage = fc.profile.stage;
      });
    }
    var idx = V.STAGES.indexOf(stage);
    ladderEl.innerHTML = V.STAGES.map(function (st, i) {
      var cls = i < idx ? 'done' : (i === idx ? (idx === 0 ? '' : 'now') : '');
      if (i < idx) cls = 'done';
      var num = ['01', '02', '03', '04', '05'][i];
      return '<div class="ov-rung ' + cls + '"><div class="rn">' + num + (i < idx ? ' <span class="tick">✓</span>' : (i === idx && idx > 0 ? ' ◆' : '')) + '</div><div class="rt">' + V.STAGE_LABELS[st] + '</div></div>';
    }).join('');
  }

  function renderStats(s) {
    var c = s.counts;
    statsEl.innerHTML =
      stat(c.pages, '3B pages') +
      stat(c.campaigns, 'Campaigns') +
      stat(c.stakeholders, 'Stakeholders') +
      stat(c.questions, 'Questions') +
      stat(c.responses, 'Responses') +
      stat(c.events, 'Validation events');
  }
  function stat(n, l) { return '<div class="ov-stat"><div class="n">' + n + '</div><div class="l">' + l + '</div></div>'; }

  /* ============ CAMPAIGNS + page picker ============ */
  function campaignsPanel(s) {
    var body = '';
    // pages without a campaign → can open one
    var openable = s.pages.filter(function (p) { return !p.has_campaign; });
    if (!s.pages.length) {
      body = '<div class="ov-empty">No public company pages yet. Generate one in <a href="public-intel.html">Public Intelligence (3B)</a> — campaigns are opened against a public page.</div>';
    } else {
      if (openable.length) {
        body += '<div class="ov-pnote" style="margin-bottom:8px;color:var(--ov-acc)">OPEN A CAMPAIGN FROM A 3B PAGE</div>';
        body += openable.map(function (o) {
          return '<div class="ov-pagecard"><div><div class="pn">' + esc(o.page.company_name) + '</div><div class="pm">' + esc(o.page.url) + ' · page ' + titleCase(o.page.status) + '</div></div>' +
            '<button class="ov-act primary" data-act="open-campaign" data-pid="' + o.page.page_id + '">Start validation campaign</button></div>';
        }).join('');
      }
      if (s.campaigns.length) {
        body += '<div class="ov-pnote" style="margin:16px 0 8px;color:var(--ov-acc)">ACTIVE CAMPAIGNS</div>';
        body += s.campaigns.map(function (c) {
          var fc = V.getCampaign(c.campaign_id);
          var prof = fc ? fc.profile : null;
          var isOpen = activeCampaign === c.campaign_id;
          return '<div class="ov-pagecard"><div><div class="pn">' + esc(c.company_name) + '</div>' +
            '<div class="pm">' + (fc ? fc.stakeholders.length : 0) + ' stakeholders · ' + (fc ? fc.questions.length : 0) + ' questions · ' + (fc ? fc.responses.length : 0) + ' responses · ' + (prof ? V.STAGE_LABELS[prof.stage] : '—') + '</div></div>' +
            '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><span class="ov-status ' + c.status + '">' + titleCase(c.status) + '</span>' +
            '<button class="ov-act' + (isOpen ? '' : ' primary') + '" data-act="toggle-campaign" data-cid="' + c.campaign_id + '">' + (isOpen ? 'Close' : 'Open') + '</button></div></div>';
        }).join('');
      }
    }
    return '<div class="ov-panel"><div class="ov-ptop"><span class="ov-plabel">Validation Campaigns</span><span class="ov-pnote">one campaign per public company page · purpose is accuracy, not sales</span></div><div class="ov-pbody">' + body + '</div></div>';
  }

  /* ============ WORKSPACE ============ */
  function workspace(cid) {
    var f = V.getCampaign(cid);
    if (!f) return '';
    var c = f.campaign, ctx = f.public, stks = f.stakeholders, qs = f.questions, resps = f.responses, events = f.events, prof = f.profile, invites = f.invites;

    var h = '<div class="ov-panel"><div class="ov-ptop"><span class="ov-plabel">Workspace · ' + esc(c.company_name) + '</span>' +
      '<span class="ov-pnote">' + (ctx && ctx.page ? ctx.page.url : '') + ' · ' + (prof ? V.STAGE_LABELS[prof.stage] : '') + '</span></div><div class="ov-pbody">';

    /* ---- stakeholders ---- */
    h += '<div class="ov-pnote" style="margin-bottom:8px;color:var(--ov-acc)">STAKEHOLDERS</div>';
    h += '<div class="ov-form" style="margin-bottom:12px">' +
      '<input id="ov-sname" placeholder="Name" style="min-width:150px">' +
      '<input id="ov-semail" placeholder="Email (optional)" style="min-width:150px">' +
      '<input id="ov-srole" placeholder="Role / title" style="min-width:140px">' +
      '<select id="ov-stype">' + V.STAKEHOLDER_TYPES.map(function (t) { return '<option value="' + t + '">' + titleCase(t) + '</option>'; }).join('') + '</select>' +
      '<button class="ov-act primary" data-act="add-stk" data-cid="' + cid + '">Add</button>' +
      '<button class="ov-act" data-act="apollo" data-cid="' + cid + '">Discover via Apollo</button>' +
      '</div>';
    if (!stks.length) h += '<div class="ov-empty">No stakeholders yet. Add leadership and HR by hand, or import a CSV. Apollo discovery is honest-blocked.</div>';
    else h += stks.map(function (st) { return stkRow(st, invites); }).join('');

    /* ---- questions ---- */
    h += '<div style="display:flex;justify-content:space-between;align-items:center;margin:20px 0 8px;flex-wrap:wrap;gap:8px"><span class="ov-pnote" style="color:var(--ov-acc)">VALIDATION QUESTIONS · from gaps only</span>' +
      '<button class="ov-act primary" data-act="gen-q" data-cid="' + cid + '">' + (qs.length ? 'Regenerate from gaps' : 'Generate questions') + '</button></div>';
    if (!ctx || !ctx.estimate) h += '<div class="ov-block">⊘ No public frequency estimate found for this company. Generate it in 3B first.</div>';
    else if (!qs.length) h += '<div class="ov-empty">No questions yet. Generate them — each will point to a specific low-confidence dimension, contradiction, unknown, or unvalidated claim.</div>';
    else {
      var order = { critical: 0, high: 1, medium: 2, low: 3 };
      h += qs.slice().sort(function (a, b) { return (order[a.priority] - order[b.priority]); }).map(function (q) { return qCard(q, resps, stks); }).join('');
    }

    /* ---- validated profile ---- */
    if (prof) h += profileBlock(prof, ctx);

    /* ---- validation events ---- */
    h += '<div style="margin-top:18px;padding-top:16px;border-top:1px solid var(--ov-rule)"><div class="ov-pnote" style="margin-bottom:10px;color:var(--ov-acc)">VALIDATION EVENTS · history preserved</div>';
    if (!events.length) h += '<div class="ov-empty">No confidence changes yet. Recording a response that supports or contradicts a hypothesis creates an event here.</div>';
    else h += events.map(function (e) {
      return '<div class="ov-evt ' + (e.old_confidence === e.new_confidence ? '' : '') + (e.reason.indexOf('contradict') !== -1 ? 'contested' : '') + '">' +
        '<div class="et"><b>' + esc(V.dimLabel(e.dimension)) + '</b> — ' + esc(e.reason) + '</div>' +
        '<div class="ec">' + esc(e.old_confidence) + ' <span class="arrow">→</span> ' + esc(e.new_confidence) + ' · ' + esc(e.source_stakeholder) + (e.frequency_evolution_event_id ? ' · <span class="freq">↳ frequency evolution event written</span>' : '') + '</div></div>';
    }).join('');
    h += '</div>';

    h += '</div></div>';
    return h;
  }

  function stkRow(st, invites) {
    var leadership = V.LEADERSHIP_TYPES.indexOf(st.stakeholder_type) !== -1;
    var inv = invites.filter(function (i) { return i.stakeholder_id === st.stakeholder_id; }).slice(-1)[0];
    var h = '<div class="ov-stk ' + (leadership ? 'leadership' : '') + '">' +
      '<div><span class="nm">' + esc(st.name) + '</span> <span class="ty">' + titleCase(st.stakeholder_type) + '</span>' +
      '<div class="meta">' + esc(st.role || '') + (st.email ? ' · ' + esc(st.email) : '') + ' · ' + esc(titleCase(st.source)) + '</div></div>' +
      '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><span class="ov-stkstat ' + st.status + '">' + titleCase(st.status) + '</span>' +
      '<button class="ov-act" data-act="invite" data-sid="' + st.stakeholder_id + '">' + (inv ? 'Re-draft invite' : 'Draft first contact') + '</button></div></div>';
    if (inv) {
      h += '<div class="ov-invite"><div class="il"><span>First contact · ' + titleCase(inv.channel) + '</span><span>' + titleCase(inv.status) + '</span></div>' +
        '<div class="isub">' + esc(inv.subject) + '</div><div class="ibody">' + esc(inv.message) + '</div>' +
        (inv.blocked_reason ? '<div class="ov-block">⊘ ' + esc(inv.blocked_reason) + '</div>' : '') +
        '<div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">' +
          '<select class="ov-chan" id="ov-chan-' + inv.invite_id + '" style="background:var(--ov-gr1);border:1px solid var(--ov-edge);border-radius:2px;color:var(--ov-ink);font-family:var(--ov-mono);font-size:9px;padding:7px 9px">' +
            V.INVITE_CHANNELS.map(function (ch) { return '<option value="' + ch + '"' + (ch === inv.channel ? ' selected' : '') + '>' + titleCase(ch) + '</option>'; }).join('') + '</select>' +
          '<button class="ov-act" data-act="send-invite" data-iid="' + inv.invite_id + '" data-sid="' + st.stakeholder_id + '">Send / queue</button>' +
        '</div></div>';
    }
    return h;
  }

  function qCard(q, resps, stks) {
    var answered = resps.filter(function (r) { return r.question_id === q.question_id; });
    var typeStks = stks.filter(function (s) { return s.stakeholder_type === q.target_stakeholder_type; });
    var allStks = stks.length ? stks : [];
    var opts = (typeStks.length ? typeStks : allStks).map(function (s) { return '<option value="' + s.stakeholder_id + '">' + esc(s.name) + ' (' + titleCase(s.stakeholder_type) + ')</option>'; }).join('');
    var h = '<div class="ov-q"><div class="qmeta">' +
      '<span class="qdim">' + esc(V.dimLabel(q.dimension)) + '</span>' +
      '<span class="ov-pri ' + q.priority + '">' + q.priority + '</span>' +
      '<span class="ov-gap">gap: ' + titleCase(q.gap_type) + '</span>' +
      '<span class="ov-gap">asks: ' + titleCase(q.target_stakeholder_type) + '</span>' +
      '<span class="ov-status ' + (q.status === 'answered' ? 'completed' : 'draft') + '">' + titleCase(q.status) + '</span>' +
      '</div>' +
      '<div class="qt">' + esc(q.question_text) + '</div>' +
      (q.source_hypothesis ? '<div class="qhyp">Tests the public reading: “' + esc(q.source_hypothesis) + '”' + (q.source_signal ? ' · evidence: “' + esc(String(q.source_signal).slice(0, 120)) + '”' : '') + '</div>' : '');

    // recorded responses
    answered.forEach(function (r) {
      var stk = stks.filter(function (s) { return s.stakeholder_id === r.stakeholder_id; })[0];
      h += '<div class="ov-respd ' + (r.contradicts_hypothesis ? 'contested' : '') + '"><div class="rtxt">“' + esc(r.response_text) + '”</div>' +
        '<div class="rmeta">' + esc(stk ? stk.name : 'stakeholder') + ' · <span class="imp-' + r.confidence_impact + '">' + titleCase(r.confidence_impact) + '</span>' +
        (r.supports_hypothesis ? ' · supports' : '') + (r.contradicts_hypothesis ? ' · contradicts' : '') + '</div></div>';
    });

    // answer form
    if (!stks.length) {
      h += '<div class="ov-block" style="border:none;color:var(--ov-ink4);padding-left:0;margin-top:10px">Add a stakeholder above to record a response.</div>';
    } else {
      h += '<div class="ov-answer">' +
        '<select id="ov-rstk-' + q.question_id + '">' + opts + '</select>' +
        '<textarea id="ov-rtext-' + q.question_id + '" placeholder="Paste the stakeholder\'s response…"></textarea>' +
        '<select id="ov-rimp-' + q.question_id + '"><option value="supports">Supports hypothesis</option><option value="contradicts">Contradicts hypothesis</option><option value="neutral">Adds context (neutral)</option></select>' +
        '<button class="ov-act primary" data-act="record" data-qid="' + q.question_id + '">Record</button>' +
        '</div>';
    }
    return h + '</div>';
  }

  function profileBlock(prof, ctx) {
    var dims = window.OF.pubintel ? window.OF.pubintel.DIMENSIONS : Object.keys(prof.dimensions);
    var rows = dims.filter(function (d) { return prof.dimensions[d]; }).map(function (d) {
      var pd = prof.dimensions[d];
      var hist = (pd.history || []).filter(function (hh) { return hh.confidence; });
      var lastHist = hist.length ? hist[hist.length - 1] : null;
      var contested = pd.level === 'contested';
      return '<div class="ov-dim"><div class="dn">' + esc(V.dimLabel(d)) + '</div>' +
        '<div class="dl' + (contested ? ' contested' : '') + '">' + esc(pd.level) + '</div>' +
        '<div class="dc ' + pd.confidence + '">' + esc(pd.confidence) + (pd.needs_validation && pd.confidence === 'none' ? ' · unknown' : '') + '</div>' +
        '<div class="dh">' + (lastHist ? esc(lastHist.confidence) + ' <span class="arrow">→</span> ' + esc(pd.confidence) + (pd.stakeholder_sources && pd.stakeholder_sources.length ? ' · ' + pd.stakeholder_sources.map(titleCase).join(', ') : '') : 'public estimate · unvalidated') + '</div></div>';
    }).join('');
    return '<div style="margin-top:18px;padding-top:16px;border-top:1px solid var(--ov-rule)"><div class="ov-pnote" style="margin-bottom:6px;color:var(--ov-acc)">VALIDATED ORGANIZATIONAL PROFILE · ' + esc(V.STAGE_LABELS[prof.stage]) + '</div>' +
      '<div class="ov-pnote" style="margin-bottom:10px;text-transform:none;font-style:italic;color:var(--ov-ink3)">A living copy seeded from the 3B public estimate. Confidence moves as stakeholders respond; prior values are kept in history. The 3B estimate is never overwritten.</div>' +
      rows + '</div>';
  }

  /* ============ EVENTS ============ */
  function wire(s) {
    each('[data-act]', function (btn) {
      btn.addEventListener('click', function () {
        var act = btn.getAttribute('data-act'), res;
        if (act === 'open-campaign') {
          res = V.createCampaign(btn.getAttribute('data-pid'));
          if (res.error) { toast(res.error); if (res.campaign) { activeCampaign = res.campaign.campaign_id; render(); } return; }
          activeCampaign = res.campaign.campaign_id;
          toast('Campaign opened for ' + res.campaign.company_name + '.');
          render();
        }
        else if (act === 'toggle-campaign') {
          var cid = btn.getAttribute('data-cid');
          activeCampaign = (activeCampaign === cid) ? null : cid;
          render();
        }
        else if (act === 'gen-q') {
          res = V.generateQuestions(btn.getAttribute('data-cid'));
          if (res.error) { toast(res.error); return; }
          toast(res.questions.length + ' new question(s) generated from gaps · ' + res.total + ' total.');
          render();
        }
        else if (act === 'add-stk') {
          var cid2 = btn.getAttribute('data-cid');
          var name = document.getElementById('ov-sname').value.trim();
          if (!name) { toast('Add a name.'); return; }
          res = V.addStakeholder(cid2, {
            name: name, email: document.getElementById('ov-semail').value.trim(),
            role: document.getElementById('ov-srole').value.trim(), stakeholder_type: document.getElementById('ov-stype').value
          });
          if (res.error) { toast(res.error); return; }
          toast('Added ' + name + '.');
          render();
        }
        else if (act === 'apollo') {
          res = V.apolloDiscover(btn.getAttribute('data-cid'));
          toast('⊘ ' + res.detail);
        }
        else if (act === 'invite') {
          res = V.generateInvite(btn.getAttribute('data-sid'), 'email');
          if (res.error) { toast(res.error); return; }
          toast('First-contact note drafted — review the tone, then send or deliver manually.');
          render();
        }
        else if (act === 'send-invite') {
          var iid = btn.getAttribute('data-iid');
          var chSel = document.getElementById('ov-chan-' + iid);
          // re-draft on chosen channel then send
          var sid = btn.getAttribute('data-sid');
          if (chSel) V.generateInvite(sid, chSel.value);
          var live = V.getCampaign(activeCampaign);
          var inv = live.invites.filter(function (i) { return i.stakeholder_id === sid; }).slice(-1)[0];
          res = V.sendInvite(inv.invite_id);
          if (res.error) { toast(res.error); return; }
          if (res.blocked) toast('⊘ Queued — ' + (inv ? inv.channel : '') + ' transport not configured. Use the manual channel.');
          else toast(res.manual ? 'Marked sent (manual) — deliver it and log the reply.' : 'Invite sent.');
          render();
        }
        else if (act === 'record') {
          var qid = btn.getAttribute('data-qid');
          var stk = document.getElementById('ov-rstk-' + qid);
          var txt = document.getElementById('ov-rtext-' + qid).value.trim();
          var imp = document.getElementById('ov-rimp-' + qid).value;
          if (!stk || !stk.value) { toast('Select the responding stakeholder.'); return; }
          if (!txt) { toast('Enter the response text.'); return; }
          res = V.recordResponse(qid, stk.value, {
            response_text: txt,
            supports_hypothesis: imp === 'supports',
            contradicts_hypothesis: imp === 'contradicts'
          });
          if (res.error) { toast(res.error); return; }
          toast(res.event ? 'Recorded · ' + res.event.old_confidence + ' → ' + res.event.new_confidence + (res.profile ? ' · ' + V.STAGE_LABELS[res.profile.stage] : '') : 'Response recorded.');
          render();
        }
      });
    });
  }
  function each(sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), fn); }

  var reset = document.getElementById('ov-reset');
  if (reset) reset.addEventListener('click', function () {
    if (confirm('Reset all Organizational Validation data on this device? (Campaigns, stakeholders, questions, responses, events, validated profiles.) 3B pages are NOT touched.')) {
      V.resetValidation(); activeCampaign = null; toast('Validation reset.'); render();
    }
  });

  render();
})();
