/* =============================================================
   Organizational Frequency — Discovery Runtime  (Build 1K)
   =============================================================
   The OPERATIONAL Deep Lane. Builds on 1A–1J WITHOUT redesigning.

   CORE DOCTRINE — Deep Discovery does NOT begin with a blank
   sheet. By the time it starts the runtime already holds a
   Mission hypothesis, an Organization Essence hypothesis, a
   Frequency hypothesis, a Frequency Map and Tier-0 research. So
   discovery is never "tell us about your company." It is:

     "We built an initial map of your organization from public
      signal. We now want to validate, challenge, refine and
      deepen it."

         Research → Hypothesis → Validation → Refinement
                  → Frequency Evolution

   Hard rules enforced here:
     • Discovery cannot begin until the SPONSOR is verified.
     • No upfront payment — ₹25,000 is payable AFTER completion.
     • Required stakeholders: Founder/CEO, Hiring Manager, Direct
       Supervisor, Skip-Level.
     • ONE thread per stakeholder; website / email / WhatsApp /
       voice all write into the SAME thread. No channel-specific
       memory. The thread is primary; the channel is irrelevant.
     • Questions are generated ONLY from gaps in understanding —
       research evidence, a hypothesis, a contradiction, an
       unknown frequency dimension, an open validation. NEVER from
       curiosity.
     • Contradiction is a SIGNAL, not an error — surfaced actively.
     • Coherence measures ALIGNMENT, not correctness.
     • Discovery ends when required stakeholders are reached, the
       frequency model stabilizes, major contradictions are
       reviewed and the report is generated — NOT when every
       question is answered.

   Augments window.OF with window.OF.discovery.
   ============================================================= */
(function () {
  'use strict';
  if (!window.OF) { console.warn('of-discovery.js requires of-model.js'); return; }
  var OF = window.OF;

  var AGREED_FEE = '\u20B925,000';   // ₹25,000 — payable after completion
  var DIMENSIONS = (OF.frequency && OF.frequency.DIMENSIONS) || (OF.person && OF.person.DIMENSIONS) || [];
  var human = (OF.frequency && OF.frequency.human) || function (l) { return l === 'very_high' ? 'very high' : l; };

  var DISCOVERY_STATUS = ['proposed', 'accepted', 'in_progress', 'awaiting_response', 'completed', 'invoiced', 'paid'];
  var SPONSOR_STATUS = ['pending', 'verified', 'rejected'];
  var SPONSOR_METHODS = ['company_email', 'otp', 'manual', 'future'];
  var COMMITMENT_STATUS = ['proposed', 'accepted', 'completed', 'invoiced', 'paid'];
  var STAKEHOLDER_TYPES = ['founder', 'ceo', 'hiring_manager', 'direct_supervisor', 'skip_level', 'optional'];
  var REQUIRED_TYPES = ['founder_or_ceo', 'hiring_manager', 'direct_supervisor', 'skip_level'];
  var CHANNELS = ['website', 'email', 'whatsapp', 'voice'];
  var QUEUE_STATUS = ['pending', 'sent', 'answered', 'validated', 'closed'];
  var CONTRA_STATUS = ['open', 'reviewing', 'reviewed', 'resolved'];

  // The 14-stage discovery state machine (Stage 0 → 13).
  var STAGES = [
    'Lead Created', 'Sponsor Verified', 'Discovery Commitment Accepted',
    'Stakeholders Submitted', 'Tier-0 Research Complete', 'Founder Discovery Complete',
    'Hiring Manager Discovery Complete', 'Supervisor Discovery Complete',
    'Skip-Level Discovery Complete', 'Contradictions Reviewed', 'Frequency Stabilized',
    'Discovery Report Generated', 'Invoice Raised', 'Discovery Closed'
  ];

  // Which stakeholder type owns which frequency dimension's discovery.
  var ROUTING = {
    'Innovation Requirement': 'founder', 'Leadership Style': 'founder', 'Autonomy Level': 'founder',
    'People Development Orientation': 'hiring_manager', 'Pace': 'hiring_manager',
    'Execution Discipline': 'direct_supervisor', 'Process Maturity': 'direct_supervisor', 'Communication Style': 'direct_supervisor',
    'Trust / Goodness Layer': 'skip_level', 'Pressure Tolerance': 'skip_level'
  };

  function nowISO() { return new Date().toISOString(); }
  function uid(p) { return OF.uid(p); }
  function lc(s) { return (s == null) ? s : String(s).toLowerCase(); }

  function ensure(store) {
    store.discovery_missions = store.discovery_missions || [];
    store.discovery_sponsors = store.discovery_sponsors || [];
    store.discovery_commitments = store.discovery_commitments || [];
    store.stakeholder_directories = store.stakeholder_directories || [];
    store.stakeholder_threads = store.stakeholder_threads || [];
    store.discovery_queue = store.discovery_queue || [];
    store.contradiction_maps = store.contradiction_maps || [];
    store.coherence_maps = store.coherence_maps || [];
    store.discovery_reports = store.discovery_reports || [];
    return store;
  }

  /* ==========================================================
     SCHEMAS (Build Objects 1–8)
     ========================================================== */
  function newDiscoveryMission(f) {
    f = f || {};
    return {
      discovery_id: f.discovery_id || uid('disc'),
      organization_id: f.organization_id || null,
      sponsor_id: f.sponsor_id || null,
      status: DISCOVERY_STATUS.indexOf(f.status) !== -1 ? f.status : 'proposed',
      agreed_fee: f.agreed_fee || AGREED_FEE,
      fee_status: f.fee_status || 'unpaid',         // unpaid → invoiced → paid
      start_date: f.start_date || null,
      completion_date: f.completion_date || null,
      stakeholders: f.stakeholders || [],           // stakeholder_id[]
      findings: f.findings || [],
      contradictions: f.contradictions || [],       // contradiction_id[]
      frequency_updates: f.frequency_updates || [],
      completion_status: f.completion_status || 'incomplete', // incomplete | complete
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }
  function newSponsor(f) {
    f = f || {};
    return {
      sponsor_id: f.sponsor_id || uid('spon'),
      organization_id: f.organization_id || null,
      name: f.name || '', designation: f.designation || '',
      email: f.email || '', phone: f.phone || '',
      verification_status: SPONSOR_STATUS.indexOf(f.verification_status) !== -1 ? f.verification_status : 'pending',
      method: SPONSOR_METHODS.indexOf(f.method) !== -1 ? f.method : 'company_email',
      verified_at: f.verified_at || null,
      created_at: f.created_at || nowISO()
    };
  }
  function newCommitment(f) {
    f = f || {};
    return {
      commitment_id: f.commitment_id || uid('comm'),
      organization_id: f.organization_id || null,
      agreed_fee: f.agreed_fee || AGREED_FEE,
      payment_trigger: 'discovery_complete',         // never upfront
      status: COMMITMENT_STATUS.indexOf(f.status) !== -1 ? f.status : 'proposed',
      accepted_at: f.accepted_at || null,
      created_at: f.created_at || nowISO()
    };
  }
  function newStakeholder(f) {
    f = f || {};
    return {
      stakeholder_id: f.stakeholder_id || uid('stk'),
      type: STAKEHOLDER_TYPES.indexOf(f.type) !== -1 ? f.type : 'optional',
      name: f.name || '', designation: f.designation || '',
      email: f.email || '', phone: f.phone || '',
      status: f.status || 'registered',              // registered | contacted | engaged | complete
      created_at: f.created_at || nowISO()
    };
  }
  function newThread(f) {
    f = f || {};
    return {
      thread_id: f.thread_id || uid('thr'),
      stakeholder_id: f.stakeholder_id || null,
      organization_id: f.organization_id || null,
      conversation_state: f.conversation_state || 'not_started', // not_started | active | complete
      messages: f.messages || [],          // {role, channel, text, at}
      memory_links: f.memory_links || [],  // links into research / frequency / hypotheses
      open_questions: f.open_questions || [],   // queue_item_id[]
      validated_answers: f.validated_answers || [], // {dimension, read, agreement, channel, at}
      last_interaction: f.last_interaction || null
    };
  }
  function newQueueItem(f) {
    f = f || {};
    return {
      item_id: f.item_id || uid('q'),
      organization_id: f.organization_id || null,
      stakeholder_id: f.stakeholder_id || null,
      dimension: f.dimension || null,
      question: f.question || '',
      source_hypothesis: f.source_hypothesis || '',  // every question originates from a gap
      origin: f.origin || 'unknown_dimension',       // research | hypothesis | contradiction | unknown_dimension | open_validation
      priority: f.priority || 'medium',
      status: QUEUE_STATUS.indexOf(f.status) !== -1 ? f.status : 'pending',
      channel: f.channel || null,
      created_at: f.created_at || nowISO(),
      due_at: f.due_at || null
    };
  }
  function newContradiction(f) {
    f = f || {};
    return {
      contradiction_id: f.contradiction_id || uid('contra'),
      organization_id: f.organization_id || null,
      dimension: f.dimension || null,
      statement_a: f.statement_a || '', source_a: f.source_a || '',
      statement_b: f.statement_b || '', source_b: f.source_b || '',
      severity: f.severity || 'moderate',            // minor | moderate | major
      status: CONTRA_STATUS.indexOf(f.status) !== -1 ? f.status : 'open',
      resolution: f.resolution || '',
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }
  function newCoherence(f) {
    f = f || {};
    return {
      coherence_id: f.coherence_id || uid('coh'),
      organization_id: f.organization_id || null,
      dimension: f.dimension || null,
      stakeholder_views: f.stakeholder_views || [],  // {stakeholder_id, type, read}
      coherence_level: f.coherence_level || 'unknown', // aligned | partial | divergent | unknown
      confidence: f.confidence || 'low',
      evidence: f.evidence || '',
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }

  /* ==========================================================
     LEAD → PROPOSE DISCOVERY  (Stage 0)
     One discovery per organization. Seeds the commitment +
     stakeholder directory. No payment, no start until verified.
     ========================================================== */
  function proposeDiscovery(orgId, store) {
    store = ensure(store || OF.load());
    var existing = byId(store.discovery_missions, 'organization_id', orgId);
    if (existing) return getDiscovery(orgId, store);
    var d = newDiscoveryMission({ organization_id: orgId, status: 'proposed' });
    store.discovery_missions.push(d);
    store.discovery_commitments.push(newCommitment({ organization_id: orgId }));
    store.stakeholder_directories.push({ directory_id: uid('dir'), organization_id: orgId, stakeholders: [], created_at: nowISO() });
    OF.save(store);
    return getDiscovery(orgId, store);
  }

  /* ---- Sponsor (Stage 1) ------------------------------------ */
  function setSponsor(orgId, fields, store) {
    store = ensure(store || OF.load());
    var d = byId(store.discovery_missions, 'organization_id', orgId);
    if (!d) return null;
    var s = newSponsor(Object.assign({}, fields || {}, { organization_id: orgId }));
    // one sponsor per org — replace
    store.discovery_sponsors = store.discovery_sponsors.filter(function (x) { return x.organization_id !== orgId; });
    store.discovery_sponsors.push(s);
    d.sponsor_id = s.sponsor_id; d.updated_at = nowISO();
    OF.save(store);
    return s;
  }
  function verifySponsor(orgId, method, store) {
    store = ensure(store || OF.load());
    var s = byId(store.discovery_sponsors, 'organization_id', orgId);
    if (!s) return null;
    s.verification_status = 'verified';
    s.method = SPONSOR_METHODS.indexOf(method) !== -1 ? method : s.method;
    s.verified_at = nowISO();
    OF.save(store);
    return s;
  }

  /* ---- Commitment (Stage 2) — requires verified sponsor ----- */
  function acceptCommitment(orgId, store) {
    store = ensure(store || OF.load());
    var sponsor = byId(store.discovery_sponsors, 'organization_id', orgId);
    if (!sponsor || sponsor.verification_status !== 'verified') return { error: 'Sponsor must be verified before discovery can begin.' };
    var c = byId(store.discovery_commitments, 'organization_id', orgId);
    var d = byId(store.discovery_missions, 'organization_id', orgId);
    if (!c || !d) return null;
    c.status = 'accepted'; c.accepted_at = nowISO();
    d.status = 'accepted';
    d.updated_at = nowISO();
    OF.save(store);
    return { commitment: c, discovery: d };
  }

  /* ---- Stakeholders (Stage 3) ------------------------------- */
  function addStakeholder(orgId, fields, store) {
    store = ensure(store || OF.load());
    var dir = byId(store.stakeholder_directories, 'organization_id', orgId);
    if (!dir) return null;
    var s = newStakeholder(fields);
    dir.stakeholders.push(s);
    // one thread per stakeholder (channel-agnostic)
    store.stakeholder_threads.push(newThread({ stakeholder_id: s.stakeholder_id, organization_id: orgId }));
    var d = byId(store.discovery_missions, 'organization_id', orgId);
    if (d && d.stakeholders.indexOf(s.stakeholder_id) === -1) d.stakeholders.push(s.stakeholder_id);
    OF.save(store);
    return s;
  }
  function requiredStakeholdersMet(orgId, store) {
    store = ensure(store || OF.load());
    var dir = byId(store.stakeholder_directories, 'organization_id', orgId);
    var types = (dir ? dir.stakeholders : []).map(function (s) { return s.type; });
    return (types.indexOf('founder') !== -1 || types.indexOf('ceo') !== -1) &&
      types.indexOf('hiring_manager') !== -1 &&
      types.indexOf('direct_supervisor') !== -1 &&
      types.indexOf('skip_level') !== -1;
  }

  /* ==========================================================
     QUESTION GENERATION — ONLY from gaps. Never curiosity.
     Every question carries its source_hypothesis + origin and is
     routed to the stakeholder type that owns its dimension. The
     top gap dimensions are cross-checked with a second stakeholder
     so alignment / contradiction can surface.
     ========================================================== */
  function generateQuestions(orgId, store) {
    store = ensure(store || OF.load());
    var dir = byId(store.stakeholder_directories, 'organization_id', orgId);
    if (!dir || !dir.stakeholders.length) return [];
    var byType = {};
    dir.stakeholders.forEach(function (s) { if (!byType[s.type]) byType[s.type] = s; });
    function stakeholderFor(type) {
      if (type === 'founder') return byType.founder || byType.ceo;
      return byType[type] || byType.optional || byType.founder || byType.ceo;
    }

    // the map we already hold (research → hypothesis)
    var research = (OF.research && OF.research.getResearchForOrg) ? OF.research.getResearchForOrg(orgId) : {};
    var freqHyp = research && research.frequency ? index(research.frequency.dimension_estimates, 'dimension') : {};
    var gap = (store.frequency_gaps || []).filter(function (g) {
      var mis = byId(store.missions, 'mission_id', g.mission_id);
      return mis && mis.organization_id === orgId;
    })[0];
    var gapByDim = gap ? index(gap.dimension_gaps, 'dimension') : {};
    var validated = (store.validated_understandings || []).filter(function (u) { return u.organization_id === orgId; });
    var validatedDims = {};
    validated.forEach(function (u) {
      DIMENSIONS.forEach(function (dn) { if ((u.statement || '').toLowerCase().indexOf(dn.toLowerCase()) === 0) validatedDims[dn] = true; });
    });

    var existing = {};
    store.discovery_queue.forEach(function (q) { if (q.organization_id === orgId) existing[q.dimension + '|' + q.stakeholder_id] = true; });

    var created = [];
    function pushQ(dim, stakeholder, origin, source, priority) {
      if (!stakeholder) return;
      if (existing[dim + '|' + stakeholder.stakeholder_id]) return;
      var est = freqHyp[dim] ? freqHyp[dim].estimate : (gapByDim[dim] ? human(gapByDim[dim].current_level) : 'unclear');
      var q = newQueueItem({
        organization_id: orgId, stakeholder_id: stakeholder.stakeholder_id, dimension: dim,
        question: questionText(dim, est),
        source_hypothesis: source, origin: origin, priority: priority || 'medium'
      });
      store.discovery_queue.push(q);
      var thr = threadFor(store, stakeholder.stakeholder_id);
      if (thr) thr.open_questions.push(q.item_id);
      created.push(q);
      existing[dim + '|' + stakeholder.stakeholder_id] = true;
    }

    DIMENSIONS.forEach(function (dim) {
      var primaryType = ROUTING[dim] || 'founder';
      var stakeholder = stakeholderFor(primaryType);
      var g = gapByDim[dim];
      var unknown = !g || g.current_level === 'unknown';
      var alreadyValidated = validatedDims[dim];
      if (alreadyValidated) return; // no gap → no question (validation already closed it)
      var origin = unknown ? 'unknown_dimension' : (freqHyp[dim] ? 'hypothesis' : 'open_validation');
      var source = freqHyp[dim]
        ? 'Tier-0 estimate: ' + dim + ' \u2248 ' + freqHyp[dim].estimate + ' (' + (OF.research ? OF.research.confidenceLabel(freqHyp[dim].confidence) : 'low') + ' confidence)'
        : (g ? 'Frequency map: ' + dim + ' required ' + human(g.required_level) + ', current ' + human(g.current_level) : 'Unknown frequency dimension: ' + dim);
      var priority = g && (g.gap_level === 'major' || g.gap_level === 'moderate') ? 'high' : 'medium';
      pushQ(dim, stakeholder, origin, source, priority);
      // cross-check the most material dimensions with a second voice
      if (priority === 'high') {
        var second = stakeholderFor('skip_level');
        if (second && second.stakeholder_id !== (stakeholder ? stakeholder.stakeholder_id : null)) {
          pushQ(dim, second, 'hypothesis', source + ' \u00b7 cross-checked for alignment', 'high');
        }
      }
    });

    // contradiction-driven questions: any open contradiction re-opens a question to a fresh voice
    (store.contradiction_maps || []).filter(function (cm) { return cm.organization_id === orgId && cm.status === 'open'; })
      .forEach(function (cm) {
        var founder = stakeholderFor('founder');
        pushQ(cm.dimension, founder, 'contradiction',
          'Contradiction on ' + cm.dimension + ': "' + cm.statement_a + '" vs "' + cm.statement_b + '"', 'high');
      });

    if (created.length) OF.save(store);
    return created;
  }

  function questionText(dim, est) {
    return 'From public signal we read ' + lc(dim) + ' as ' + lc(est) + '. ' +
      'Does that match how it actually works here \u2014 or would you challenge or refine it?';
  }

  /* ==========================================================
     ANSWER A QUEUED QUESTION (any channel → the one thread)
     stance: 'confirm' | 'refine' | 'challenge'
     Writes a channel-tagged message into the stakeholder's single
     thread, records a validated_answer, advances the queue, then
     recomputes coherence / contradiction for that dimension.
     ========================================================== */
  function recordAnswer(itemId, opts, store) {
    store = ensure(store || OF.load());
    opts = opts || {};
    var q = byId(store.discovery_queue, 'item_id', itemId);
    if (!q) return null;
    var channel = CHANNELS.indexOf(opts.channel) !== -1 ? opts.channel : 'website';
    var stance = ['confirm', 'refine', 'challenge'].indexOf(opts.stance) !== -1 ? opts.stance : 'confirm';
    var note = opts.note || '';

    var thr = threadFor(store, q.stakeholder_id);
    if (!thr) return null;
    var read = readFor(q.dimension, stance, note, q);

    thr.messages.push({ role: 'aeon', channel: channel, text: q.question, at: nowISO() });
    thr.messages.push({ role: 'stakeholder', channel: channel, text: note || stanceLabel(stance), at: nowISO() });
    thr.validated_answers.push({ dimension: q.dimension, read: read, stance: stance, channel: channel, note: note, at: nowISO() });
    thr.open_questions = thr.open_questions.filter(function (id) { return id !== itemId; });
    thr.conversation_state = 'active';
    thr.last_interaction = nowISO();
    if (thr.memory_links.indexOf(q.source_hypothesis) === -1) thr.memory_links.push(q.source_hypothesis);

    q.status = stance === 'confirm' ? 'validated' : 'answered';
    q.channel = channel;

    // stakeholder status
    var dir = byId(store.stakeholder_directories, 'organization_id', q.organization_id);
    var stk = dir ? dir.stakeholders.filter(function (s) { return s.stakeholder_id === q.stakeholder_id; })[0] : null;
    if (stk) stk.status = 'engaged';

    recomputeAlignment(store, q.organization_id, q.dimension);
    markDiscoveryInProgress(store, q.organization_id);
    OF.save(store);
    return { queue_item: q, thread: thr, read: read };
  }

  function readFor(dim, stance, note, q) {
    if (stance === 'confirm') return 'confirms the public read of ' + lc(dim);
    if (stance === 'refine') return 'refines ' + lc(dim) + (note ? ': ' + note : ' from the public read');
    return 'challenges the public read of ' + lc(dim) + (note ? ': ' + note : '');
  }
  function stanceLabel(s) { return ({ confirm: 'Confirmed.', refine: 'Partly — with a refinement.', challenge: 'No — I\u2019d challenge that.' })[s] || s; }

  /* ==========================================================
     COHERENCE / CONTRADICTION — alignment, not correctness.
     For a dimension, gather every stakeholder's read. If the
     stances agree → coherence (aligned). If they diverge →
     contradiction (a signal, surfaced, never an error).
     ========================================================== */
  function recomputeAlignment(store, orgId, dim) {
    var dir = byId(store.stakeholder_directories, 'organization_id', orgId);
    var views = [];
    (store.stakeholder_threads || []).filter(function (t) { return t.organization_id === orgId; }).forEach(function (t) {
      var ans = (t.validated_answers || []).filter(function (a) { return a.dimension === dim; });
      if (!ans.length) return;
      var latest = ans[ans.length - 1];
      var stk = dir ? dir.stakeholders.filter(function (s) { return s.stakeholder_id === t.stakeholder_id; })[0] : null;
      views.push({ stakeholder_id: t.stakeholder_id, type: stk ? stk.type : 'optional', read: latest.read, stance: latest.stance });
    });
    if (views.length < 1) return;

    // coherence entry (replace prior for this dim)
    var stances = views.map(function (v) { return v.stance; });
    var allConfirm = stances.every(function (s) { return s === 'confirm'; });
    var anyChallenge = stances.indexOf('challenge') !== -1;
    var mixed = !allConfirm;
    var level = views.length < 2 ? 'partial' : (allConfirm ? 'aligned' : (anyChallenge ? 'divergent' : 'partial'));
    store.coherence_maps = store.coherence_maps.filter(function (c) { return !(c.organization_id === orgId && c.dimension === dim); });
    store.coherence_maps.push(newCoherence({
      organization_id: orgId, dimension: dim, stakeholder_views: views,
      coherence_level: level,
      confidence: views.length >= 2 ? (allConfirm ? 'high' : 'medium') : 'low',
      evidence: views.map(function (v) { return v.type + ' ' + v.read; }).join(' · ')
    }));

    // contradiction when two stakeholders diverge (a confirm vs a challenge, or two challenges with notes)
    if (views.length >= 2) {
      var confirmV = views.filter(function (v) { return v.stance === 'confirm'; })[0];
      var dissentV = views.filter(function (v) { return v.stance === 'challenge' || v.stance === 'refine'; })[0];
      var existing = (store.contradiction_maps || []).filter(function (c) { return c.organization_id === orgId && c.dimension === dim && c.status !== 'resolved'; })[0];
      if (anyChallenge && confirmV && dissentV && !existing) {
        store.contradiction_maps.push(newContradiction({
          organization_id: orgId, dimension: dim,
          statement_a: confirmV.read, source_a: confirmV.type,
          statement_b: dissentV.read, source_b: dissentV.type,
          severity: dissentV.stance === 'challenge' ? 'major' : 'moderate'
        }));
        var d = byId(store.discovery_missions, 'organization_id', orgId);
        if (d) d.contradictions = (store.contradiction_maps || []).filter(function (c) { return c.organization_id === orgId; }).map(function (c) { return c.contradiction_id; });
      }
    }
  }

  function reviewContradiction(contraId, resolution, status, store) {
    store = ensure(store || OF.load());
    var c = byId(store.contradiction_maps, 'contradiction_id', contraId);
    if (!c) return null;
    c.status = CONTRA_STATUS.indexOf(status) !== -1 ? status : 'reviewed';
    c.resolution = resolution || c.resolution;
    c.updated_at = nowISO();
    OF.save(store);
    return c;
  }

  function markDiscoveryInProgress(store, orgId) {
    var d = byId(store.discovery_missions, 'organization_id', orgId);
    if (d && (d.status === 'accepted')) { d.status = 'in_progress'; if (!d.start_date) d.start_date = nowISO(); d.updated_at = nowISO(); }
  }

  /* ==========================================================
     STATE MACHINE — Stage 0 → 13. Derived from current state.
     ========================================================== */
  function computeStage(orgId, store) {
    store = ensure(store || OF.load());
    var d = byId(store.discovery_missions, 'organization_id', orgId);
    if (!d) return -1;
    var sponsor = byId(store.discovery_sponsors, 'organization_id', orgId);
    var commit = byId(store.discovery_commitments, 'organization_id', orgId);
    var dir = byId(store.stakeholder_directories, 'organization_id', orgId);
    var report = byId(store.discovery_reports, 'organization_id', orgId);

    var stage = 0; // Lead Created
    if (sponsor && sponsor.verification_status === 'verified') stage = 1;
    if (stage >= 1 && commit && (commit.status === 'accepted' || commit.status === 'completed' || commit.status === 'invoiced' || commit.status === 'paid')) stage = 2;
    if (stage >= 2 && requiredStakeholdersMet(orgId, store)) stage = 3;
    if (stage >= 3 && tier0Complete(orgId, store)) stage = 4;
    if (stage >= 4 && stakeholderComplete(orgId, 'founder', store)) stage = 5;
    if (stage >= 5 && stakeholderComplete(orgId, 'hiring_manager', store)) stage = 6;
    if (stage >= 6 && stakeholderComplete(orgId, 'direct_supervisor', store)) stage = 7;
    if (stage >= 7 && stakeholderComplete(orgId, 'skip_level', store)) stage = 8;
    if (stage >= 8 && contradictionsReviewed(orgId, store)) stage = 9;
    if (stage >= 9 && frequencyStabilized(orgId, store)) stage = 10;
    if (stage >= 10 && report) stage = 11;
    if (stage >= 11 && (d.status === 'invoiced' || d.status === 'paid')) stage = 12;
    if (stage >= 12 && d.status === 'paid') stage = 13;
    return stage;
  }
  function tier0Complete(orgId, store) {
    if (OF.research && OF.research.getResearchForOrg) {
      var r = OF.research.getResearchForOrg(orgId);
      if (r && r.research) return true;
    }
    // or a computed frequency layer counts as the map already existing
    return (store.frequency_gaps || []).some(function (g) {
      var mis = byId(store.missions, 'mission_id', g.mission_id);
      return mis && mis.organization_id === orgId;
    });
  }
  function stakeholderComplete(orgId, type, store) {
    var dir = byId(store.stakeholder_directories, 'organization_id', orgId);
    if (!dir) return false;
    var stks = dir.stakeholders.filter(function (s) { return s.type === type || (type === 'founder' && s.type === 'ceo'); });
    if (!stks.length) return false;
    // complete when the stakeholder has no pending queue items AND has at least one answer
    return stks.some(function (stk) {
      var pending = (store.discovery_queue || []).filter(function (q) { return q.stakeholder_id === stk.stakeholder_id && (q.status === 'pending' || q.status === 'sent'); });
      var thr = threadFor(store, stk.stakeholder_id);
      var answered = thr && thr.validated_answers.length;
      return answered && !pending.length;
    });
  }
  function contradictionsReviewed(orgId, store) {
    var open = (store.contradiction_maps || []).filter(function (c) { return c.organization_id === orgId && (c.status === 'open' || c.severity === 'major' && c.status === 'reviewing'); });
    return open.length === 0;
  }
  function frequencyStabilized(orgId, store) {
    // stabilized when most dimensions have a coherence read and few open contradictions
    var coh = (store.coherence_maps || []).filter(function (c) { return c.organization_id === orgId; });
    var openContra = (store.contradiction_maps || []).filter(function (c) { return c.organization_id === orgId && c.status === 'open'; });
    return coh.length >= Math.ceil(DIMENSIONS.length * 0.5) && openContra.length === 0;
  }

  /* ==========================================================
     DISCOVERY REPORT (Stage 11)
     Assembled from the map we deepened — not written from scratch.
     ========================================================== */
  function generateReport(orgId, store) {
    store = ensure(store || OF.load());
    var org = byId(store.organizations, 'organization_id', orgId);
    if (!org) return null;
    var mission = (store.missions || []).filter(function (m) { return m.organization_id === orgId; })[0];
    var gap = (store.frequency_gaps || []).filter(function (g) { return mission && g.mission_id === mission.mission_id; })[0];
    var coh = (store.coherence_maps || []).filter(function (c) { return c.organization_id === orgId; });
    var contra = (store.contradiction_maps || []).filter(function (c) { return c.organization_id === orgId; });
    var aligned = coh.filter(function (c) { return c.coherence_level === 'aligned'; });
    var divergent = coh.filter(function (c) { return c.coherence_level === 'divergent'; });
    var answeredDims = {};
    coh.forEach(function (c) { answeredDims[c.dimension] = true; });

    var freqConf = aligned.length >= Math.ceil(DIMENSIONS.length * 0.6) && contra.filter(function (c) { return c.status === 'open'; }).length === 0
      ? 'high' : (Object.keys(answeredDims).length >= Math.ceil(DIMENSIONS.length * 0.4) ? 'medium' : 'low');

    var report = {
      report_id: uid('rep'),
      organization_id: orgId,
      mission_reality: mission
        ? 'The mission as the organization actually holds it: ' + (mission.desired_outcome || mission.mission_name) +
          (mission.time_horizon ? ' (' + mission.time_horizon + ')' : '') + '. Deepened through discovery, not taken from public signal alone.'
        : 'No mission on record for this organization.',
      organization_essence: org.preliminary_essence || 'Essence hypothesis not yet formed from Tier-0 research.',
      organization_frequency: gap
        ? gap.gap_summary
        : 'Frequency map not yet computed; discovery answers populate it.',
      contradictions: contra.map(function (c) {
        return { dimension: c.dimension, severity: c.severity, status: c.status,
          a: c.source_a + ': ' + c.statement_a, b: c.source_b + ': ' + c.statement_b, resolution: c.resolution };
      }),
      coherence_map: coh.map(function (c) { return { dimension: c.dimension, level: c.coherence_level, confidence: c.confidence, evidence: c.evidence }; }),
      energy_sources: aligned.map(function (c) { return c.dimension + ' \u2014 stakeholders align here; a source of organizational energy.'; }),
      constraints: divergent.concat(
        (gap ? (gap.dimension_gaps || []).filter(function (g) { return g.gap_level === 'major'; }).map(function (g) { return { dimension: g.dimension }; }) : [])
      ).map(function (c) { return c.dimension + ' \u2014 a constraint: ' + (c.coherence_level === 'divergent' ? 'stakeholders diverge' : 'a major frequency gap'); }),
      evolution_direction: gap
        ? 'The organization may evolve by closing its largest validated gaps and resolving where stakeholders diverge. Direction, not destiny.'
        : 'Evolution direction will sharpen once the frequency map stabilizes.',
      resonance_profile: 'Resonance is not computed in this build. The organization\u2019s frequency is now grounded enough that a future role/person resonance read would rest on validated understanding rather than public signal.',
      emergent_outcomes: (store.emergent_outcomes || []).filter(function (o) { return o.organization_id === orgId; }).length
        ? (store.emergent_outcomes || []).filter(function (o) { return o.organization_id === orgId; }).map(function (o) { return o.outcome_summary; })
        : ['No emergent outcomes framed yet — the Outcomes runtime can now reason on firmer ground.'],
      frequency_confidence: freqConf,
      generated_at: nowISO()
    };
    store.discovery_reports = store.discovery_reports.filter(function (r) { return r.organization_id !== orgId; });
    store.discovery_reports.push(report);

    // completing the report completes the discovery → enables invoicing (payment AFTER completion)
    var d = byId(store.discovery_missions, 'organization_id', orgId);
    if (d) { d.completion_status = 'complete'; d.completion_date = nowISO(); if (d.status === 'in_progress' || d.status === 'awaiting_response') d.status = 'completed'; d.updated_at = nowISO(); }
    var commit = byId(store.discovery_commitments, 'organization_id', orgId);
    if (commit && commit.status === 'accepted') commit.status = 'completed';
    OF.save(store);
    return report;
  }

  /* ---- invoicing (Stage 12 / 13) — only after completion ---- */
  function raiseInvoice(orgId, store) {
    store = ensure(store || OF.load());
    var d = byId(store.discovery_missions, 'organization_id', orgId);
    var commit = byId(store.discovery_commitments, 'organization_id', orgId);
    if (!d || d.completion_status !== 'complete') return { error: 'Discovery must be complete before an invoice can be raised.' };
    d.status = 'invoiced'; d.fee_status = 'invoiced';
    if (commit) commit.status = 'invoiced';
    OF.save(store);
    return d;
  }
  function markPaid(orgId, store) {
    store = ensure(store || OF.load());
    var d = byId(store.discovery_missions, 'organization_id', orgId);
    var commit = byId(store.discovery_commitments, 'organization_id', orgId);
    if (!d || d.status !== 'invoiced') return { error: 'Raise the invoice first.' };
    d.status = 'paid'; d.fee_status = 'paid';
    if (commit) commit.status = 'paid';
    OF.save(store);
    return d;
  }

  /* ---- reads ------------------------------------------------ */
  function getDiscovery(orgId, store) {
    store = ensure(store || OF.load());
    var d = byId(store.discovery_missions, 'organization_id', orgId);
    if (!d) return null;
    var dir = byId(store.stakeholder_directories, 'organization_id', orgId);
    var stks = dir ? dir.stakeholders : [];
    return {
      discovery: d,
      organization: byId(store.organizations, 'organization_id', orgId),
      sponsor: byId(store.discovery_sponsors, 'organization_id', orgId),
      commitment: byId(store.discovery_commitments, 'organization_id', orgId),
      directory: dir,
      stakeholders: stks,
      threads: (store.stakeholder_threads || []).filter(function (t) { return t.organization_id === orgId; }),
      queue: (store.discovery_queue || []).filter(function (q) { return q.organization_id === orgId; }),
      contradictions: (store.contradiction_maps || []).filter(function (c) { return c.organization_id === orgId; }),
      coherence: (store.coherence_maps || []).filter(function (c) { return c.organization_id === orgId; }),
      report: byId(store.discovery_reports, 'organization_id', orgId),
      stage: computeStage(orgId, store),
      required_met: requiredStakeholdersMet(orgId, store)
    };
  }
  function getAllDiscoveries(store) {
    store = ensure(store || OF.load());
    return store.discovery_missions.slice()
      .sort(function (a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); })
      .map(function (d) { return getDiscovery(d.organization_id, store); });
  }
  // organizations that have a deep-lane mandate or any mission — eligible to enter discovery
  function eligibleOrganizations(store) {
    store = ensure(store || OF.load());
    var have = {};
    store.discovery_missions.forEach(function (d) { have[d.organization_id] = true; });
    return (store.organizations || []).filter(function (o) { return !have[o.organization_id]; })
      .map(function (o) {
        var deep = (store.mandates || []).some(function (m) { return m.organization_id === o.organization_id && m.lane_type === 'deep'; });
        return { organization_id: o.organization_id, label: o.organization_name + (deep ? ' · deep mandate' : ''), deep: deep };
      });
  }
  function threadFor(store, stakeholderId) {
    return (store.stakeholder_threads || []).filter(function (t) { return t.stakeholder_id === stakeholderId; })[0] || null;
  }

  function index(arr, key) { var o = {}; (arr || []).forEach(function (x) { o[x[key]] = x; }); return o; }
  function byId(arr, key, val) { return (arr || []).filter(function (x) { return x[key] === val; })[0] || null; }

  OF.discovery = {
    AGREED_FEE: AGREED_FEE, STAGES: STAGES, CHANNELS: CHANNELS,
    STAKEHOLDER_TYPES: STAKEHOLDER_TYPES, REQUIRED_TYPES: REQUIRED_TYPES,
    DISCOVERY_STATUS: DISCOVERY_STATUS, SPONSOR_METHODS: SPONSOR_METHODS,
    QUEUE_STATUS: QUEUE_STATUS, CONTRA_STATUS: CONTRA_STATUS, ROUTING: ROUTING,
    ensure: ensure,
    proposeDiscovery: proposeDiscovery,
    setSponsor: setSponsor, verifySponsor: verifySponsor,
    acceptCommitment: acceptCommitment,
    addStakeholder: addStakeholder, requiredStakeholdersMet: requiredStakeholdersMet,
    generateQuestions: generateQuestions, recordAnswer: recordAnswer,
    reviewContradiction: reviewContradiction,
    computeStage: computeStage,
    generateReport: generateReport, raiseInvoice: raiseInvoice, markPaid: markPaid,
    getDiscovery: getDiscovery, getAllDiscoveries: getAllDiscoveries,
    eligibleOrganizations: eligibleOrganizations,
    human: human
  };
})();
