/* =============================================================
   discovery-admin.js — Studio · Frequency Discovery Runtime  (1K)
   =============================================================
   The operational Deep Lane admin. Shows exactly where discovery
   stands, what remains unresolved, and who must be contacted next:
   state machine · sponsor · commitment · stakeholders · queue ·
   threads · contradictions · coherence · report.
   ============================================================= */
(function () {
  'use strict';
  var OF = window.OF;
  var D = OF.discovery;
  var SEL_KEY = 'of.discovery.selectedOrg';

  var pickEl  = document.getElementById('dv-pick');
  var stageEl = document.getElementById('dv-stage-row');
  var viewEl  = document.getElementById('dv-view');

  function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function selectedOrg() { try { return localStorage.getItem(SEL_KEY); } catch (e) { return null; } }
  function setSelected(o) { try { localStorage.setItem(SEL_KEY, o); } catch (e) {} }

  function render() {
    var all = D.getAllDiscoveries();
    var eligible = D.eligibleOrganizations();
    renderPick(all, eligible);

    var orgId = selectedOrg();
    var d = orgId ? D.getDiscovery(orgId) : (all[0] || null) && all[0].discovery.organization_id ? D.getDiscovery(all[0].discovery.organization_id) : null;
    if (!d && all.length) { d = all[0]; setSelected(d.discovery.organization_id); }

    if (!d) {
      stageEl.innerHTML = '';
      viewEl.innerHTML = eligible.length
        ? '<div class="dv-empty">No discovery in progress. Choose an organization above and <em>propose a discovery</em> to begin the Deep Lane.</div>'
        : '<div class="dv-empty">No organizations yet. Capture a <a href="../frequency/index.html">mission</a> (and ideally choose the <a href="mandates.html">Deep Lane</a>) first — discovery deepens a map that already exists.</div>';
      return;
    }
    renderStages(d);
    renderView(d);
  }

  /* ---- pick / propose -------------------------------------- */
  function renderPick(all, eligible) {
    var opts = all.map(function (d) {
      var o = d.organization;
      return '<option value="' + esc(d.discovery.organization_id) + '"' + (d.discovery.organization_id === selectedOrg() ? ' selected' : '') + '>' +
        esc(o ? o.organization_name : d.discovery.organization_id) + ' · stage ' + d.stage + '</option>';
    }).join('');
    var propose = eligible.length
      ? '<div class="dv-field"><label>Start a new discovery</label><select id="dv-elig">' +
          eligible.map(function (e) { return '<option value="' + esc(e.organization_id) + '">' + esc(e.label) + '</option>'; }).join('') +
        '</select></div><button class="dv-go" id="dv-propose" type="button">Propose discovery →</button>'
      : '';
    pickEl.innerHTML =
      (all.length ? '<div class="dv-field"><label>Discovery</label><select id="dv-switch">' + opts + '</select></div>' : '') +
      propose;
  }

  /* ---- state machine --------------------------------------- */
  function renderStages(d) {
    var cells = D.STAGES.map(function (label, i) {
      var cls = i < d.stage ? 'done' : (i === d.stage ? 'now' : '');
      return '<div class="dv-stage ' + cls + '">' +
        '<div class="sn">Stage ' + i + (i < d.stage ? ' <span class="tick">✓</span>' : '') + '</div>' +
        '<div class="st">' + esc(label) + '</div>' +
      '</div>';
    }).join('');
    stageEl.innerHTML = '<div class="dv-states">' + cells + '</div>';
  }

  /* ---- the full discovery view ----------------------------- */
  function renderView(d) {
    viewEl.innerHTML =
      sponsorPanel(d) +
      commitmentPanel(d) +
      stakeholdersPanel(d) +
      queuePanel(d) +
      threadsPanel(d) +
      contradictionsPanel(d) +
      coherencePanel(d) +
      reportPanel(d) +
      evolutionPanel(d);
  }

  function panel(label, cq, bodyHtml, topRight) {
    return '<div class="dv-panel"><div class="dv-ptop"><div><div class="dv-plabel">' + esc(label) + '</div>' +
      (cq ? '<div class="dv-cq">' + esc(cq) + '</div>' : '') + '</div>' + (topRight || '') + '</div>' +
      '<div class="dv-pbody">' + bodyHtml + '</div></div>';
  }

  /* Sponsor (Stage 1) */
  function sponsorPanel(d) {
    var s = d.sponsor;
    var badge = s
      ? (s.verification_status === 'verified' ? '<span class="dv-badge ok">verified · ' + esc(s.method) + '</span>' : '<span class="dv-badge warn">' + esc(s.verification_status) + '</span>')
      : '<span class="dv-badge pend">no sponsor</span>';
    var body;
    if (!s) {
      body = '<div class="dv-inline">' +
        '<input class="dv-mini" id="sp-name" placeholder="Name">' +
        '<input class="dv-mini" id="sp-desig" placeholder="Designation">' +
        '<input class="dv-mini" id="sp-email" placeholder="Company email">' +
        '<button class="dv-act primary" id="sp-add" type="button">Add sponsor</button>' +
      '</div>';
    } else {
      body = '<div class="dv-kv"><span class="k">Sponsor</span><em>' + esc(s.name || '—') + '</em>' + (s.designation ? ' · ' + esc(s.designation) : '') + '</div>' +
        '<div class="dv-kv"><span class="k">Email</span>' + esc(s.email || '—') + '</div>' +
        (s.verification_status !== 'verified'
          ? '<div class="dv-inline"><span class="dv-cq" style="font-style:normal">Discovery cannot begin until the sponsor is verified.</span>' +
            '<button class="dv-act primary" data-verify="company_email" type="button">Verify · company email</button>' +
            '<button class="dv-act" data-verify="otp" type="button">Verify · OTP</button>' +
            '<button class="dv-act" data-verify="manual" type="button">Verify · manual</button></div>'
          : '<div class="dv-kv"><span class="k">Verified</span><span class="dv-badge ok">' + esc((s.verified_at || '').slice(0, 10)) + ' · ' + esc(s.method) + '</span></div>');
    }
    return panel('Sponsor Verification', 'Stage 1 · discovery cannot begin until the sponsor is verified.', body, badge);
  }

  /* Commitment (Stage 2) */
  function commitmentPanel(d) {
    var c = d.commitment;
    var verified = d.sponsor && d.sponsor.verification_status === 'verified';
    var badge = '<span class="dv-badge ' + (c && (c.status === 'accepted' || c.status === 'completed' || c.status === 'invoiced' || c.status === 'paid') ? 'ok' : 'pend') + '">' + esc(c ? c.status : '—') + '</span>';
    var body =
      '<div class="dv-kv"><span class="k">Agreed fee</span><em>' + esc(D.AGREED_FEE) + '</em> · payable after discovery completion</div>' +
      '<div class="dv-kv"><span class="k">Payment trigger</span>discovery_complete · <span style="color:var(--dv-ink4)">no upfront payment</span></div>' +
      (c && c.status === 'proposed'
        ? '<div class="dv-inline">' + (verified ? '' : '<span class="dv-cq" style="font-style:normal;color:var(--dv-warm)">Verify the sponsor first.</span>') +
          '<button class="dv-act primary" id="dv-accept" type="button"' + (verified ? '' : ' disabled') + '>Accept commitment</button></div>'
        : '<div class="dv-kv"><span class="k">Accepted</span><span class="dv-badge ok">' + esc((c && c.accepted_at || '').slice(0, 10) || 'yes') + '</span></div>');
    return panel('Discovery Commitment', 'Stage 2 · no upfront payment — ₹25,000 after completion.', body, badge);
  }

  /* Stakeholders (Stage 3) */
  function stakeholdersPanel(d) {
    var have = {};
    d.stakeholders.forEach(function (s) { have[s.type] = true; });
    var req = [
      { t: 'founder', label: 'Founder / CEO', alt: 'ceo' },
      { t: 'hiring_manager', label: 'Hiring Manager' },
      { t: 'direct_supervisor', label: 'Direct Supervisor' },
      { t: 'skip_level', label: 'Skip-Level' }
    ];
    var pills = req.map(function (r) {
      var ok = have[r.t] || (r.alt && have[r.alt]);
      return '<span class="dv-reqpill' + (ok ? ' have' : '') + '">' + (ok ? '✓ ' : '') + esc(r.label) + '</span>';
    }).join('');
    var list = d.stakeholders.length ? d.stakeholders.map(function (s) {
      return '<div class="dv-stk"><div><span class="nm">' + esc(s.name || 'Unnamed') + '</span> <span class="ty">' + esc(s.type.replace(/_/g, ' ')) + '</span>' +
        (s.designation ? '<div class="meta">' + esc(s.designation) + (s.email ? ' · ' + esc(s.email) : '') + '</div>' : '') + '</div>' +
        '<span class="dv-badge ' + (s.status === 'engaged' ? 'ok' : 'pend') + '">' + esc(s.status) + '</span></div>';
    }).join('') : '<div class="dv-cq" style="font-style:normal;color:var(--dv-ink4)">No stakeholders registered yet.</div>';

    var canAdd = d.commitment && (d.commitment.status === 'accepted' || d.commitment.status === 'completed');
    var form = canAdd ? '<div class="dv-inline" style="margin-top:12px">' +
      '<select class="dv-chan" id="stk-type">' + D.STAKEHOLDER_TYPES.map(function (t) { return '<option value="' + t + '">' + esc(t.replace(/_/g, ' ')) + '</option>'; }).join('') + '</select>' +
      '<input class="dv-mini" id="stk-name" placeholder="Name">' +
      '<input class="dv-mini" id="stk-desig" placeholder="Designation">' +
      '<input class="dv-mini" id="stk-email" placeholder="Email">' +
      '<button class="dv-act primary" id="stk-add" type="button">Register stakeholder</button>' +
    '</div>' : '<div class="dv-cq" style="font-style:normal;color:var(--dv-warm);margin-top:8px">Accept the commitment to register stakeholders.</div>';

    var badge = '<span class="dv-badge ' + (d.required_met ? 'ok' : 'pend') + '">' + (d.required_met ? 'required met' : 'required pending') + '</span>';
    return panel('Stakeholder Directory', 'Stage 3 · required: Founder/CEO · Hiring Manager · Direct Supervisor · Skip-Level.',
      '<div class="dv-req">' + pills + '</div>' + list + form, badge);
  }

  /* Queue (gap-driven questions) */
  function queuePanel(d) {
    var canGen = d.required_met;
    var open = d.queue.filter(function (q) { return q.status === 'pending' || q.status === 'sent'; });
    var byStk = {};
    open.forEach(function (q) { (byStk[q.stakeholder_id] = byStk[q.stakeholder_id] || []).push(q); });
    var stkName = {};
    d.stakeholders.forEach(function (s) { stkName[s.stakeholder_id] = (s.name || 'Unnamed') + ' · ' + s.type.replace(/_/g, ' '); });

    var body = '';
    if (!d.queue.length) {
      body = '<div class="dv-cq" style="font-style:normal;color:var(--dv-ink4)">No questions generated yet. Every question originates from a gap — a Tier-0 estimate, an unknown frequency dimension, an open validation, or a contradiction. Never from curiosity.</div>';
    } else if (!open.length) {
      body = '<div class="dv-cq" style="font-style:normal;color:var(--dv-pos)">All generated questions have been answered. Discovery ends when the model stabilizes — not when every question is answered.</div>';
    } else {
      body = Object.keys(byStk).map(function (sid) {
        return '<div class="dv-q-group"><div class="dv-qrole" style="margin-bottom:8px;color:var(--dv-freq2)">' + esc(stkName[sid] || sid) + '</div>' +
          byStk[sid].map(queueItem).join('') + '</div>';
      }).join('');
    }
    var gen = '<button class="dv-act primary" id="dv-genq" type="button"' + (canGen ? '' : ' disabled') + '>Generate questions from gaps</button>';
    return panel('Discovery Queue', 'Questions are generated only from gaps in understanding — never curiosity.',
      body, gen);
  }
  function queueItem(q) {
    return '<div class="dv-q" data-item="' + esc(q.item_id) + '">' +
      '<div class="qq">' + esc(q.question) + '</div>' +
      '<div class="qsrc"><b>source:</b> ' + esc(q.source_hypothesis) + ' · <b>origin:</b> ' + esc(q.origin.replace(/_/g, ' ')) + ' · <b>dimension:</b> ' + esc(q.dimension) + '</div>' +
      '<div class="dv-answer">' +
        '<span class="lbl">Answer via</span>' +
        '<select class="dv-chan" data-chan="' + esc(q.item_id) + '">' + D.CHANNELS.map(function (c) { return '<option value="' + c + '">' + esc(c) + '</option>'; }).join('') + '</select>' +
        '<input class="dv-mini" data-note="' + esc(q.item_id) + '" placeholder="Their answer (optional)" style="flex:1;min-width:140px">' +
        '<button class="dv-act" data-ans="confirm" data-q="' + esc(q.item_id) + '" type="button">Confirm</button>' +
        '<button class="dv-act" data-ans="refine" data-q="' + esc(q.item_id) + '" type="button">Refine</button>' +
        '<button class="dv-act" data-ans="challenge" data-q="' + esc(q.item_id) + '" type="button">Challenge</button>' +
      '</div>' +
    '</div>';
  }

  /* Threads (one per stakeholder, channel-agnostic) */
  function threadsPanel(d) {
    var stkName = {};
    d.stakeholders.forEach(function (s) { stkName[s.stakeholder_id] = (s.name || 'Unnamed') + ' · ' + s.type.replace(/_/g, ' '); });
    var threads = d.threads.filter(function (t) { return t.messages.length; });
    var body = threads.length ? threads.map(function (t) {
      var msgs = t.messages.slice(-8).map(function (m) {
        return '<div class="dv-msg ' + esc(m.role) + '"><div class="mtxt">' + esc(m.text) + '</div>' +
          '<div class="mmeta">' + esc(m.role === 'aeon' ? 'Aeon1' : 'stakeholder') + ' · <span class="dv-chanbadge">' + esc(m.channel) + '</span> · ' + esc((m.at || '').slice(0, 10)) + '</div></div>';
      }).join('');
      return '<div class="dv-thread"><div class="th"><span class="thn">' + esc(stkName[t.stakeholder_id] || 'Stakeholder') + '</span>' +
        '<span class="ths">' + t.validated_answers.length + ' answered · ' + t.open_questions.length + ' open · state: ' + esc(t.conversation_state) + '</span></div>' + msgs + '</div>';
    }).join('') : '<div class="dv-cq" style="font-style:normal;color:var(--dv-ink4)">No interactions yet. One thread per stakeholder — website, email, WhatsApp and voice all write here.</div>';
    return panel('Stakeholder Threads', 'One stakeholder · one thread · many channels. No channel-specific memory.', body);
  }

  /* Contradictions (signals) */
  function contradictionsPanel(d) {
    var body = d.contradictions.length ? d.contradictions.map(function (c) {
      var canReview = c.status === 'open' || c.status === 'reviewing';
      return '<div class="dv-contra ' + (c.severity === 'major' ? 'major' : '') + '">' +
        '<div class="cd">' + esc(c.dimension) + ' · ' + esc(c.severity) + ' · ' + esc(c.status) + '</div>' +
        '<div class="cs"><b>' + esc(c.source_a) + ':</b> ' + esc(c.statement_a) + '<br><b>' + esc(c.source_b) + ':</b> ' + esc(c.statement_b) + '</div>' +
        (c.resolution ? '<div class="cs" style="margin-top:5px;color:var(--dv-pos)">Resolution: ' + esc(c.resolution) + '</div>' : '') +
        (canReview ? '<div class="dv-inline" style="margin-top:8px">' +
          '<input class="dv-mini" data-res="' + esc(c.contradiction_id) + '" placeholder="How is it reconciled? (optional)" style="flex:1;min-width:160px">' +
          '<button class="dv-act" data-review="reviewed" data-c="' + esc(c.contradiction_id) + '" type="button">Mark reviewed</button>' +
          '<button class="dv-act primary" data-review="resolved" data-c="' + esc(c.contradiction_id) + '" type="button">Resolve</button></div>' : '') +
      '</div>';
    }).join('') : '<div class="dv-cq" style="font-style:normal;color:var(--dv-ink4)">No contradictions surfaced. A contradiction is a signal, not an error — it appears when stakeholders read a dimension differently.</div>';
    var badge = '<span class="dv-badge ' + (d.contradictions.filter(function (c) { return c.status === 'open'; }).length ? 'warn' : 'ok') + '">' +
      d.contradictions.filter(function (c) { return c.status === 'open'; }).length + ' open</span>';
    return panel('Contradiction Map', 'Stage 9 · contradiction is a signal, surfaced actively.', body, badge);
  }

  /* Coherence (alignment, not correctness) */
  function coherencePanel(d) {
    var body = d.coherence.length ? d.coherence.map(function (c) {
      return '<div class="dv-coh"><div class="cdn">' + esc(c.dimension) + '</div>' +
        '<div class="clv ' + esc(c.coherence_level) + '">' + esc(c.coherence_level) + ' · ' + esc(c.confidence) + '</div>' +
        '<div class="cev">' + esc(c.evidence) + '</div></div>';
    }).join('') : '<div class="dv-cq" style="font-style:normal;color:var(--dv-ink4)">No coherence reads yet. Coherence measures alignment between stakeholders — not who is correct.</div>';
    return panel('Coherence Map', 'Measures alignment, not correctness.', body);
  }

  /* Report (Stage 11 → 13) */
  function reportPanel(d) {
    var canGen = d.stage >= 9; // contradictions reviewed at least
    var r = d.report;
    var actions = '';
    if (!r) {
      actions = '<button class="dv-act primary" id="dv-genreport" type="button"' + (canGen ? '' : ' disabled') + '>Generate discovery report</button>' +
        (canGen ? '' : '<span class="dv-cq" style="font-style:normal;color:var(--dv-ink4);margin-left:10px">Review major contradictions first.</span>');
    } else {
      var inv = d.discovery.status;
      actions =
        '<button class="dv-act" id="dv-genreport" type="button">Regenerate</button>' +
        (inv === 'completed' ? '<button class="dv-act gold" id="dv-invoice" type="button">Raise invoice (' + esc(D.AGREED_FEE) + ')</button>' : '') +
        (inv === 'invoiced' ? '<button class="dv-act primary" id="dv-paid" type="button">Mark paid</button>' : '') +
        (inv === 'paid' ? '<span class="dv-badge ok">paid · discovery closed</span>' : '');
    }
    var body;
    if (!r) {
      body = '<div class="dv-cq" style="font-style:normal;color:var(--dv-ink4)">Not generated. The report assembles from the map we deepened — Mission Reality, Essence, Frequency, Contradictions, Coherence, Energy Sources, Constraints, Evolution Direction, Resonance Profile, Emergent Outcomes and Frequency Confidence.</div>';
    } else {
      body = reportBody(r);
    }
    return panel('Organizational Discovery Report', 'Stage 11–13 · produced when the frequency model stabilizes.', body,
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' + actions + '</div>');
  }
  function reportBody(r) {
    function sec(label, txt) { return '<div class="dv-rsec"><div class="rl">' + esc(label) + '</div><div class="rt">' + txt + '</div></div>'; }
    function list(label, arr, empty) {
      return '<div class="dv-rsec"><div class="rl">' + esc(label) + '</div>' +
        (arr && arr.length ? '<ul>' + arr.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '<div class="rt" style="color:var(--dv-ink4)">' + esc(empty) + '</div>') + '</div>';
    }
    var contra = r.contradictions.map(function (c) { return c.dimension + ' (' + c.severity + ', ' + c.status + '): ' + c.a + ' vs ' + c.b + (c.resolution ? ' → ' + c.resolution : ''); });
    var coh = r.coherence_map.map(function (c) { return c.dimension + ' — ' + c.level + ' (' + c.confidence + ')'; });
    return '<div class="dv-report">' +
      sec('Mission Reality', esc(r.mission_reality)) +
      sec('Organization Essence', esc(r.organization_essence)) +
      sec('Organization Frequency', esc(r.organization_frequency)) +
      list('Contradictions', contra, 'No contradictions surfaced.') +
      list('Coherence Map', coh, 'No coherence reads.') +
      list('Energy Sources', r.energy_sources, 'Not yet evident.') +
      list('Constraints', r.constraints, 'No major constraints identified.') +
      sec('Evolution Direction', esc(r.evolution_direction)) +
      sec('Resonance Profile', esc(r.resonance_profile)) +
      list('Emergent Outcomes', r.emergent_outcomes, 'None framed yet.') +
      sec('Frequency Confidence', '<span class="dv-badge ' + (r.frequency_confidence === 'high' ? 'ok' : (r.frequency_confidence === 'medium' ? 'warn' : 'pend')) + '">' + esc(r.frequency_confidence) + '</span>') +
    '</div>';
  }

  /* Frequency Evolution (1L) — promote discovery into the living model */
  function evolutionPanel(d) {
    if (!OF.evolution) return '';
    var ev = OF.evolution.getEvolution(d.discovery.organization_id);
    if (!ev) return '';
    var canPromote = ev.can_promote;
    var promoteBtn = '<button class="dv-bigbtn" id="dv-promote" type="button"' + (canPromote ? '' : ' disabled') + '>' +
      (ev.promoted ? 'Re-promote discovery → frequency' : 'Promote discovery into frequency →') + '</button>' +
      (canPromote ? '' : '<span class="dv-cq" style="font-style:normal;color:var(--dv-ink4);margin-left:10px">Generate the discovery report first — discovery must be complete.</span>');

    if (!ev.promoted) {
      var body0 = '<div class="dv-cq" style="font-style:normal;color:var(--dv-ink4);margin-bottom:14px">' +
        'Discovery is not complete until it changes the living model. Only <em>stakeholder-validated</em> dimensions update the living organization frequency; no unvalidated answer and no raw public research ever writes here. Contradictions are preserved and lower confidence \u2014 never hidden.</div>' + promoteBtn;
      return panel('Frequency Evolution', 'Stage \u2192 living model · promote validated discovery into the organization frequency.', body0,
        '<span class="dv-badge pend">not promoted</span>');
    }

    // living frequency table
    var lf = (ev.living_frequency.dimensions || []).slice().sort(function (a, b) {
      return (b.last_updated || '').localeCompare(a.last_updated || '');
    });
    var lfRows = lf.map(function (x) {
      var contested = x.source === 'deep_discovery_contradicted' || x.contested;
      return '<div class="dv-lf">' +
        '<div class="lfd">' + esc(x.dimension) + '</div>' +
        '<div class="lfl' + (contested ? ' contested' : '') + '">' + esc(x.level === 'contested' ? 'contested' : OF.evolution.human(x.level)) + '</div>' +
        '<div class="lfs">' + esc(typeof x.confidence === 'number' ? x.confidence.toFixed(2) : x.confidence) + '</div>' +
        '<div class="lfsrc' + (contested ? ' contra' : '') + '">' + esc((x.source || '').replace(/_/g, ' ')) +
          (x.stakeholder_sources && x.stakeholder_sources.length ? ' · ' + x.stakeholder_sources.map(function (s) { return s.replace(/_/g, ' '); }).join(', ') : '') +
          (x.history && x.history.length ? ' · ' + x.history.length + ' prior' : '') + '</div>' +
      '</div>';
    }).join('') || '<div class="dv-cq" style="font-style:normal;color:var(--dv-ink4)">Living frequency not yet populated.</div>';

    // change events
    var evRows = ev.events.slice(0, 12).map(function (e) {
      return '<div class="dv-evt ' + esc(e.change_type) + '">' +
        '<div class="et"><b>' + esc(e.dimension) + '</b> · ' + esc(OF.evolution.human(e.previous_level)) + ' → ' + esc(e.new_level === 'contested' ? 'contested' : OF.evolution.human(e.new_level)) + '</div>' +
        '<div class="em"><span class="ct">' + esc(e.change_type.replace(/_/g, ' ')) + '</span> · ' + esc(e.confidence) + ' confidence' +
          (e.stakeholder_sources && e.stakeholder_sources.length ? ' · ' + e.stakeholder_sources.map(function (s) { return s.replace(/_/g, ' '); }).join(', ') : '') + '</div>' +
        '<div class="em" style="color:var(--dv-ink3);text-transform:none;letter-spacing:0">' + esc(e.reasoning) + '</div>' +
      '</div>';
    }).join('');

    var mandRows = ev.mandates.length ? ev.mandates.map(function (m) {
      return '<div class="dv-mand"><div class="mt">' + esc(m.lane_type) + ' lane mandate · confidence <b>' + esc(m.confidence) + '</b> · basis: ' + esc((m.mandate_confidence_basis || 'tier0_only').replace(/_/g, ' ')) + '</div></div>';
    }).join('') : '<div class="dv-cq" style="font-style:normal;color:var(--dv-ink4)">No mandates for this organization.</div>';

    var staleRows = ev.stale_outcomes.length
      ? ev.stale_outcomes.map(function (o) { return '<div class="dv-stale">⚠ ' + esc(o.outcome_summary.slice(0, 110)) + '…</div>'; }).join('') +
        '<div style="margin-top:10px"><button class="dv-act primary" id="dv-regen" type="button">Regenerate affected outcomes →</button>' +
        '<span class="dv-cq" style="font-style:normal;color:var(--dv-ink4);margin-left:10px">The underlying frequency changed. Outcomes are not auto-regenerated.</span></div>'
      : '<div class="dv-cq" style="font-style:normal;color:var(--dv-pos)">No stale outcomes — emergent futures are current with the living frequency.</div>';

    var contraLine = '<div class="dv-kv"><span class="k">Contradictions</span>' +
      '<span class="dv-badge ' + (ev.open_contradictions.length ? 'warn' : 'ok') + '">' + ev.open_contradictions.length + ' unresolved</span> ' +
      '<span class="dv-badge ok">' + ev.resolved_contradictions.length + ' reviewed/resolved</span> · preserved as signal, never hidden</div>';

    var body =
      '<div class="dv-kv"><span class="k">Promotion status</span><span class="dv-badge ok">promoted · ' + ev.events.length + ' evolution event' + (ev.events.length === 1 ? '' : 's') + '</span></div>' +
      '<div class="dv-kv"><span class="k">Downstream</span>current frequency · gap · interventions · role frequency · mandate confidence · outcomes — recomputed</div>' +
      contraLine +
      '<div style="margin:16px 0 8px">' + promoteBtn + '</div>' +
      '<div class="dv-plabel" style="margin-top:18px;color:var(--dv-freq2)">Living organization frequency · validated, with history</div>' +
      '<div style="margin-top:8px">' + lfRows + '</div>' +
      '<div class="dv-plabel" style="margin-top:20px;color:var(--dv-freq2)">Frequency evolution events</div>' +
      '<div style="margin-top:8px">' + (evRows || '<div class="dv-cq" style="font-style:normal;color:var(--dv-ink4)">No events.</div>') + '</div>' +
      '<div class="dv-plabel" style="margin-top:20px;color:var(--dv-freq2)">Affected mandates</div>' +
      '<div style="margin-top:8px">' + mandRows + '</div>' +
      '<div class="dv-plabel" style="margin-top:20px;color:var(--dv-freq2)">Emergent outcomes</div>' +
      '<div style="margin-top:8px">' + staleRows + '</div>';

    return panel('Frequency Evolution', 'The system learns from discovery — only stakeholder-validated dimensions update the living model.', body,
      '<span class="dv-badge ok">promoted</span>');
  }

  /* ---- events ---------------------------------------------- */
  document.addEventListener('change', function (e) {
    if (e.target.id === 'dv-switch') { setSelected(e.target.value); render(); }
  });
  document.addEventListener('click', function (e) {
    var t = e.target;
    var orgId = selectedOrg();

    if (t.id === 'dv-propose') { var el = document.getElementById('dv-elig'); if (el) { D.proposeDiscovery(el.value); setSelected(el.value); render(); } return; }
    if (t.id === 'sp-add') {
      D.setSponsor(orgId, { name: val('sp-name'), designation: val('sp-desig'), email: val('sp-email') }); render(); return;
    }
    if (t.getAttribute && t.getAttribute('data-verify')) { D.verifySponsor(orgId, t.getAttribute('data-verify')); render(); return; }
    if (t.id === 'dv-accept') { var res = D.acceptCommitment(orgId); if (res && res.error) alert(res.error); render(); return; }
    if (t.id === 'stk-add') {
      D.addStakeholder(orgId, { type: val('stk-type'), name: val('stk-name'), designation: val('stk-desig'), email: val('stk-email') }); render(); return;
    }
    if (t.id === 'dv-genq') { D.generateQuestions(orgId); render(); return; }
    if (t.getAttribute && t.getAttribute('data-ans')) {
      var qid = t.getAttribute('data-q');
      var chan = (document.querySelector('[data-chan="' + qid + '"]') || {}).value || 'website';
      var note = (document.querySelector('[data-note="' + qid + '"]') || {}).value || '';
      D.recordAnswer(qid, { channel: chan, stance: t.getAttribute('data-ans'), note: note }); render(); return;
    }
    if (t.getAttribute && t.getAttribute('data-review')) {
      var cid = t.getAttribute('data-c');
      var resv = (document.querySelector('[data-res="' + cid + '"]') || {}).value || '';
      D.reviewContradiction(cid, resv, t.getAttribute('data-review')); render(); return;
    }
    if (t.id === 'dv-genreport') { D.generateReport(orgId); render(); return; }
    if (t.id === 'dv-promote') {
      var pr = OF.evolution.promoteDiscoveryToFrequency(D.getDiscovery(orgId).discovery.discovery_id);
      if (pr && pr.error) alert(pr.error);
      render(); return;
    }
    if (t.id === 'dv-regen') {
      var evd = OF.evolution.getEvolution(orgId);
      (evd ? evd.stale_outcomes : []).forEach(function (o) { if (OF.outcome && OF.outcome.generate) OF.outcome.generate(o.outcome_id); });
      render(); return;
    }
    if (t.id === 'dv-invoice') { var r1 = D.raiseInvoice(orgId); if (r1 && r1.error) alert(r1.error); render(); return; }
    if (t.id === 'dv-paid') { var r2 = D.markPaid(orgId); if (r2 && r2.error) alert(r2.error); render(); return; }
  });
  function val(id) { var el = document.getElementById(id); return el ? el.value : ''; }

  document.getElementById('dv-reset').addEventListener('click', function () {
    if (confirm('Clear all discovery missions on this device? Sponsors, stakeholders, threads, queue, contradictions, coherence and reports will be removed.')) {
      var store = D.ensure(OF.load());
      ['discovery_missions', 'discovery_sponsors', 'discovery_commitments', 'stakeholder_directories', 'stakeholder_threads', 'discovery_queue', 'contradiction_maps', 'coherence_maps', 'discovery_reports']
        .forEach(function (k) { store[k] = []; });
      OF.save(store);
      try { localStorage.removeItem(SEL_KEY); } catch (e) {}
      render();
    }
  });

  render();
})();
