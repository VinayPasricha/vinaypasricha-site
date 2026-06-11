/* =============================================================
   Organizational Frequency — Organizational Validation Runtime
   (Build 3C · the layer between Public Intelligence and Deep
   Discovery)
   =============================================================
   3B produced a PUBLIC frequency estimate — useful, but
   unvalidated. 3C improves its ACCURACY through structured
   stakeholder participation:

       Public Company Page (3B)
          ↓  open a campaign
       ValidationCampaign
          ↓  identify / import
       Stakeholder[]
          ↓  generate from gaps only
       ValidationQuestion[]   (low-confidence · contradiction ·
          ↓                    unknown · unvalidated claim)
       ValidationResponse[]
          ↓  confidence changes (never overwrite history)
       ValidationEvent[]  →  Frequency Evolution (1L) hook
          ↓
       Validated Organizational Profile

   PURPOSE: accuracy of the profile. NOT sales, lead-gen,
   recruitment, or hiring. Questions come only from gaps, never
   curiosity, and each points to a specific hypothesis.

   HONESTY (matches the rest of OF):
     • Apollo / live contact discovery is not configured — it
       BLOCKS honestly and fabricates no contacts. CSV / manual
       import and manual entry work today.
     • Invites are drafted and queued; email / WhatsApp send is
       not wired (blocks honestly). The manual channel lets the
       operator send it themselves and log the response.
     • Every confidence change creates a ValidationEvent; prior
       values are preserved in history, never overwritten.

   NOT in 3C: candidate discovery, hiring, outreach campaigns,
   resonance, interviews, offers, scoring, rankings, ratings.

   Augments window.OF with window.OF.orgval.
   Depends on: of-model.js (store) + of-public-intel.js (3B).
   Optional hook: of-evolution.js (1L).
   ============================================================= */
(function () {
  'use strict';
  if (!window.OF) { console.warn('of-org-validation.js requires of-model.js'); return; }
  var OF = window.OF;

  /* ===== controlled vocabularies ===== */
  var CAMPAIGN_STATUS = ['draft', 'active', 'paused', 'completed', 'cancelled'];
  var STAKEHOLDER_TYPES = [
    'founder', 'ceo', 'chro', 'talent_acquisition', 'business_head',
    'functional_leader', 'manager', 'employee', 'former_employee', 'advisor'
  ];
  var STAKEHOLDER_STATUS = ['identified', 'invited', 'active', 'completed', 'declined'];
  var PRIORITY = ['critical', 'high', 'medium', 'low'];
  var QUESTION_STATUS = ['draft', 'sent', 'answered', 'closed'];
  var INVITE_CHANNELS = ['email', 'whatsapp', 'manual'];
  var INVITE_STATUS = ['draft', 'queued', 'sent', 'opened', 'responded', 'failed'];
  var CONTACT_SOURCES = ['apollo', 'csv_import', 'manual_import', 'manual_entry'];

  // leadership-grade stakeholders (used for the "Leadership Validated" stage)
  var LEADERSHIP_TYPES = ['founder', 'ceo', 'chro', 'business_head'];

  // confidence ladder (descriptive, never numeric ratings of the company)
  var CONF_LADDER = ['none', 'low', 'medium', 'high', 'validated'];
  function confIndex(c) { var i = CONF_LADDER.indexOf(c); return i === -1 ? 1 : i; }
  function confUp(c) { return CONF_LADDER[Math.min(CONF_LADDER.length - 1, confIndex(c) + 1)]; }

  // profile-progress stages
  var STAGES = ['public_estimate', 'partially_validated', 'leadership_validated', 'multi_stakeholder_validated', 'living_profile'];
  var STAGE_LABELS = {
    public_estimate: 'Public Estimate', partially_validated: 'Partially Validated',
    leadership_validated: 'Leadership Validated', multi_stakeholder_validated: 'Multi-Stakeholder Validated',
    living_profile: 'Living Organizational Profile'
  };

  /* dimension → who can speak to it + a hypothesis-pointed question template.
     {hyp} is replaced by the public reading (the level/claim). */
  var DIM_PLAN = {
    leadership_style: { who: 'founder', q: 'Public signals suggest {hyp} leadership. In practice, how does direction actually get set day to day — and by whom?' },
    decision_making: { who: 'business_head', q: 'Public signals suggest {hyp} decision-making. How much authority do managers typically have to make decisions without senior approval?' },
    communication_culture: { who: 'chro', q: 'Public signals suggest {hyp} communication. How openly is difficult feedback actually shared across levels?' },
    execution_style: { who: 'functional_leader', q: 'Public signals suggest a {hyp} execution culture. When speed and process conflict, which one usually wins?' },
    pressure_environment: { who: 'manager', q: 'Public signals point to a {hyp} environment. How sustainable is the pace outside of peak cycles?' },
    autonomy_level: { who: 'business_head', q: 'Public signals suggest {hyp} autonomy. How much can a manager decide and act on without sign-off from above?' },
    collaboration_style: { who: 'functional_leader', q: 'Public signals suggest a {hyp} way of working. How do teams actually coordinate across functions when priorities collide?' },
    talent_philosophy: { who: 'talent_acquisition', q: 'Public signals suggest {hyp}. What does the company really optimize for when hiring — and what makes someone succeed here?' },
    growth_orientation: { who: 'ceo', q: 'Public signals suggest {hyp}. What is the binding constraint on the next stage of growth?' },
    stability_vs_chaos: { who: 'business_head', q: 'Public signals suggest a {hyp} environment. How stable are priorities quarter to quarter?' },
    innovation_orientation: { who: 'functional_leader', q: 'Public signals suggest {hyp}. How are new ideas actually funded, tested, and either killed or scaled?' },
    employee_flourishing: { who: 'former_employee', q: 'Public signals point to {hyp}. Looking back, what did the day-to-day experience actually feel like, especially during busy periods?' }
  };
  var DIM_LABELS = (OF.pubintel && OF.pubintel.DIM_LABELS) || {};

  var FIRST_CONTACT =
    'We have created an Organizational Frequency profile of {company} using publicly available information. ' +
    'While useful, we believe some observations may be incomplete or inaccurate. We would value your perspective ' +
    'in helping improve the profile — a few short questions, entirely at your convenience. This is not a sales or ' +
    'recruitment conversation; the only aim is accuracy.';

  /* ===== helpers ===== */
  function nowISO() { return new Date().toISOString(); }
  function uid(p) { return OF.uid(p); }
  function byId(arr, key, val) { return (arr || []).filter(function (x) { return x[key] === val; })[0] || null; }
  function lc(s) { return (s == null ? '' : String(s)).toLowerCase(); }
  function titleish(s) { return String(s || '').replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }
  function dimLabel(d) { return DIM_LABELS[d] || titleish(d); }

  function ensure(store) {
    store.val_campaigns = store.val_campaigns || [];
    store.val_stakeholders = store.val_stakeholders || [];
    store.val_questions = store.val_questions || [];
    store.val_responses = store.val_responses || [];
    store.val_events = store.val_events || [];
    store.val_invites = store.val_invites || [];
    store.val_profiles = store.val_profiles || [];     // ValidatedProfile per campaign
    store.val_audit_log = store.val_audit_log || [];
    return store;
  }
  function audit(store, t, ref, action, detail) {
    store.val_audit_log.push({ log_id: uid('vaud'), object_type: t, object_ref: ref, action: action, detail: detail || '', created_at: nowISO() });
  }

  /* ==========================================================
     SCHEMAS
     ========================================================== */
  function newCampaign(f) {
    f = f || {};
    return {
      campaign_id: f.campaign_id || uid('vcmp'),
      company_name: f.company_name || '',
      company_page_id: f.company_page_id || null,
      research_id: f.research_id || null,
      status: CAMPAIGN_STATUS.indexOf(f.status) !== -1 ? f.status : 'draft',
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }
  function newStakeholder(f) {
    f = f || {};
    return {
      stakeholder_id: f.stakeholder_id || uid('vstk'),
      campaign_id: f.campaign_id || null,
      name: f.name || '',
      email: f.email || '',
      phone: f.phone || '',
      role: f.role || '',
      stakeholder_type: STAKEHOLDER_TYPES.indexOf(f.stakeholder_type) !== -1 ? f.stakeholder_type : 'employee',
      status: STAKEHOLDER_STATUS.indexOf(f.status) !== -1 ? f.status : 'identified',
      source: CONTACT_SOURCES.indexOf(f.source) !== -1 ? f.source : 'manual_entry',
      invited_at: f.invited_at || null,
      responded_at: f.responded_at || null,
      created_at: f.created_at || nowISO()
    };
  }
  function newQuestion(f) {
    f = f || {};
    return {
      question_id: f.question_id || uid('vq'),
      campaign_id: f.campaign_id || null,
      dimension: f.dimension || '',
      source_signal: f.source_signal || '',        // the public evidence/excerpt or claim
      source_hypothesis: f.source_hypothesis || '', // the public reading being tested
      gap_type: f.gap_type || 'low_confidence',     // low_confidence | unknown | contradiction | unvalidated_claim
      question_text: f.question_text || '',
      target_stakeholder_type: STAKEHOLDER_TYPES.indexOf(f.target_stakeholder_type) !== -1 ? f.target_stakeholder_type : 'business_head',
      priority: PRIORITY.indexOf(f.priority) !== -1 ? f.priority : 'medium',
      status: QUESTION_STATUS.indexOf(f.status) !== -1 ? f.status : 'draft',
      created_at: f.created_at || nowISO()
    };
  }
  function newResponse(f) {
    f = f || {};
    return {
      response_id: f.response_id || uid('vresp'),
      question_id: f.question_id || null,
      stakeholder_id: f.stakeholder_id || null,
      response_text: f.response_text || '',
      confidence_impact: f.confidence_impact || 'none',   // increase | decrease | contested | none
      supports_hypothesis: !!f.supports_hypothesis,
      contradicts_hypothesis: !!f.contradicts_hypothesis,
      created_at: f.created_at || nowISO()
    };
  }
  function newEvent(f) {
    f = f || {};
    return {
      event_id: f.event_id || uid('vevt'),
      campaign_id: f.campaign_id || null,
      dimension: f.dimension || '',
      old_confidence: f.old_confidence || '',
      new_confidence: f.new_confidence || '',
      reason: f.reason || '',
      evidence: f.evidence || '',
      source_stakeholder: f.source_stakeholder || '',
      frequency_evolution_event_id: f.frequency_evolution_event_id || null,
      created_at: f.created_at || nowISO()
    };
  }
  function newInvite(f) {
    f = f || {};
    return {
      invite_id: f.invite_id || uid('vinv'),
      stakeholder_id: f.stakeholder_id || null,
      campaign_id: f.campaign_id || null,
      channel: INVITE_CHANNELS.indexOf(f.channel) !== -1 ? f.channel : 'email',
      subject: f.subject || '',
      message: f.message || '',
      status: INVITE_STATUS.indexOf(f.status) !== -1 ? f.status : 'draft',
      blocked_reason: f.blocked_reason || '',
      created_at: f.created_at || nowISO()
    };
  }
  // ValidatedProfile — the living, history-preserving validated view (does NOT overwrite 3B).
  function newProfile(f) {
    f = f || {};
    return {
      profile_id: f.profile_id || uid('vprof'),
      campaign_id: f.campaign_id || null,
      company_name: f.company_name || '',
      dimensions: f.dimensions || {},   // { dim: {level, confidence, history[], stakeholder_sources[]} }
      stage: f.stage || 'public_estimate',
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }

  /* ==========================================================
     3B INTEGRATION — read the public page + estimate + contradictions
     ========================================================== */
  function publicContext(pageId, store) {
    store = ensure(store || OF.load());
    var page = byId(store.pub_pages || [], 'page_id', pageId);
    if (!page) return null;
    var est = (store.pub_estimates || []).filter(function (e) { return e.research_id === page.research_id; })[0] || null;
    var cons = (store.pub_contradictions || []).filter(function (c) { return c.research_id === page.research_id; });
    return { page: page, estimate: est, contradictions: cons };
  }
  function availablePages(store) {
    store = ensure(store || OF.load());
    return (store.pub_pages || []).map(function (p) {
      var hasCampaign = store.val_campaigns.some(function (c) { return c.company_page_id === p.page_id; });
      return { page: p, has_campaign: hasCampaign };
    });
  }

  /* ==========================================================
     CAMPAIGN — open against a 3B public page
     ========================================================== */
  function createCampaign(pageId, store) {
    store = ensure(store || OF.load());
    var ctx = publicContext(pageId, store);
    if (!ctx) return { error: 'Public company page not found. Generate one in Public Intelligence (3B) first.' };
    var existing = store.val_campaigns.filter(function (c) { return c.company_page_id === pageId; })[0];
    if (existing) return { error: 'A validation campaign already exists for this company.', campaign: existing };
    var cmp = newCampaign({ company_name: ctx.page.company_name, company_page_id: pageId, research_id: ctx.page.research_id, status: 'active' });
    store.val_campaigns.push(cmp);
    // seed the ValidatedProfile from the public estimate (a copy — 3B is never overwritten)
    var dims = {};
    if (ctx.estimate) {
      Object.keys(ctx.estimate.dimensions).forEach(function (d) {
        var pd = ctx.estimate.dimensions[d];
        dims[d] = { level: pd.level, confidence: pd.confidence === 'none' ? 'none' : pd.confidence, history: [], stakeholder_sources: [], needs_validation: !!pd.needs_validation };
      });
    }
    var prof = newProfile({ campaign_id: cmp.campaign_id, company_name: cmp.company_name, dimensions: dims, stage: 'public_estimate' });
    store.val_profiles.push(prof);
    audit(store, 'campaign', cmp.company_name, 'created', 'active');
    OF.save(store);
    return { campaign: cmp, profile: prof };
  }
  function setCampaignStatus(campaignId, status, store) {
    store = ensure(store || OF.load());
    var c = byId(store.val_campaigns, 'campaign_id', campaignId);
    if (!c) return { error: 'Campaign not found.' };
    if (CAMPAIGN_STATUS.indexOf(status) === -1) return { error: 'Invalid status.' };
    c.status = status; c.updated_at = nowISO();
    audit(store, 'campaign', c.company_name, status, '');
    OF.save(store);
    return { campaign: c };
  }

  /* ==========================================================
     QUESTION GENERATION — gaps only, every question points to a hypothesis
     ========================================================== */
  function generateQuestions(campaignId, store) {
    store = ensure(store || OF.load());
    var c = byId(store.val_campaigns, 'campaign_id', campaignId);
    if (!c) return { error: 'Campaign not found.' };
    var ctx = publicContext(c.company_page_id, store);
    if (!ctx || !ctx.estimate) return { error: 'No public frequency estimate to validate. Generate it in 3B first.' };
    var est = ctx.estimate;
    var created = [], seen = {};

    function add(dim, gapType, priority, sourceSignal, hyp) {
      var key = dim + '|' + gapType;
      if (seen[key]) return; seen[key] = true;
      var plan = DIM_PLAN[dim] || { who: 'business_head', q: 'Public signals suggest {hyp}. How does this actually work in practice?' };
      var hypTxt = (hyp || (est.dimensions[dim] && est.dimensions[dim].level) || 'a particular pattern');
      // the actionable ask is everything after the template's opening "lead" sentence
      var ask = plan.q.split(/(?<=[.?])\s+/).slice(1).join(' ') || plan.q;
      var qText;
      if (gapType === 'contradiction') {
        qText = 'Public sources point in different directions on ' + dimLabel(dim).toLowerCase() +
          ' — claimed one way, observed another. ' + ask;
      } else {
        qText = plan.q.replace('{hyp}', String(hypTxt).toLowerCase());
      }
      created.push(newQuestion({
        campaign_id: campaignId, dimension: dim,
        source_signal: sourceSignal || '', source_hypothesis: hypTxt, gap_type: gapType,
        question_text: qText,
        target_stakeholder_type: plan.who, priority: priority, status: 'draft'
      }));
    }

    // 1 — contradictions → CRITICAL
    ctx.contradictions.forEach(function (con) {
      var dim = (con.dimension || '').split('/')[0].trim();
      add(dim, 'contradiction', 'critical', con.counter_signal || con.claim, (est.dimensions[dim] && est.dimensions[dim].level) || 'the public reading');
    });
    // 2 — unvalidated claims → HIGH
    (est.unvalidated_claims || []).forEach(function (u) {
      add(u.dimension, 'unvalidated_claim', 'high', u.claim, est.dimensions[u.dimension] && est.dimensions[u.dimension].level);
    });
    // 3 — needs-validation dimensions → HIGH (unknown) / MEDIUM (low)
    (est.needs_validation || []).forEach(function (dim) {
      var d = est.dimensions[dim] || {};
      var unknown = d.confidence === 'none';
      var ev = (d.evidence && d.evidence[0] && d.evidence[0].excerpt) || '';
      add(dim, unknown ? 'unknown' : 'low_confidence', unknown ? 'high' : 'medium', ev, d.level);
    });

    // append only the ones not already present (by dimension+gap_type)
    var existingKeys = {};
    store.val_questions.filter(function (q) { return q.campaign_id === campaignId; }).forEach(function (q) { existingKeys[q.dimension + '|' + q.gap_type] = 1; });
    var net = created.filter(function (q) { return !existingKeys[q.dimension + '|' + q.gap_type]; });
    net.forEach(function (q) { store.val_questions.push(q); });
    audit(store, 'questions', c.company_name, 'generated', net.length + ' question(s)');
    OF.save(store);
    return { questions: net, total: store.val_questions.filter(function (q) { return q.campaign_id === campaignId; }).length };
  }

  /* ==========================================================
     STAKEHOLDERS — Apollo blocked; CSV / manual work
     ========================================================== */
  function apolloDiscover(campaignId, store) {
    store = ensure(store || OF.load());
    audit(store, 'contact_discovery', 'apollo', 'blocked', 'provider_not_configured');
    OF.save(store);
    return { blocked: true, reason: 'provider_not_configured', detail: 'Apollo / live contact discovery is not configured in this environment. No contacts are fabricated. Import a CSV or add leadership contacts manually.' };
  }
  function addStakeholder(campaignId, fields, store) {
    store = ensure(store || OF.load());
    var c = byId(store.val_campaigns, 'campaign_id', campaignId);
    if (!c) return { error: 'Campaign not found.' };
    if (!fields || !fields.name) return { error: 'A name is required.' };
    var stk = newStakeholder(Object.assign({}, fields, { campaign_id: campaignId, source: fields.source || 'manual_entry' }));
    store.val_stakeholders.push(stk);
    audit(store, 'stakeholder', stk.name, 'added', stk.stakeholder_type);
    OF.save(store);
    return { stakeholder: stk };
  }
  function importStakeholdersCSV(campaignId, text, store) {
    store = ensure(store || OF.load());
    var c = byId(store.val_campaigns, 'campaign_id', campaignId);
    if (!c) return { error: 'Campaign not found.' };
    var lines = String(text || '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    if (!lines.length) return { error: 'Paste CSV rows: name, email, role, type (one per line).' };
    var header = null, start = 0;
    if (/name/i.test(lines[0]) && /email|role|type/i.test(lines[0])) { header = splitCSV(lines[0]).map(lc); start = 1; }
    var created = [];
    for (var i = start; i < lines.length; i++) {
      var cells = splitCSV(lines[i]);
      var rec = {};
      if (header) { header.forEach(function (h, idx) { rec[mapHeader(h)] = cells[idx]; }); }
      else { rec = { name: cells[0], email: cells[1], role: cells[2], stakeholder_type: cells[3] }; }
      if (!rec.name) continue;
      rec.stakeholder_type = normalizeType(rec.stakeholder_type || rec.role);
      rec.source = 'csv_import';
      var stk = newStakeholder(Object.assign({}, rec, { campaign_id: campaignId }));
      store.val_stakeholders.push(stk); created.push(stk);
    }
    if (!created.length) return { error: 'No valid rows found.' };
    audit(store, 'stakeholder', c.company_name, 'csv_import', created.length + ' contact(s)');
    OF.save(store);
    return { created: created };
  }
  function splitCSV(line) {
    var out = [], cur = '', inq = false;
    for (var i = 0; i < line.length; i++) { var ch = line[i];
      if (ch === '"') { if (inq && line[i + 1] === '"') { cur += '"'; i++; } else inq = !inq; }
      else if ((ch === ',' || ch === '\t') && !inq) { out.push(cur.trim()); cur = ''; }
      else cur += ch; }
    out.push(cur.trim()); return out;
  }
  function mapHeader(h) {
    if (/name/.test(h)) return 'name';
    if (/email|mail/.test(h)) return 'email';
    if (/phone|mobile/.test(h)) return 'phone';
    if (/type|category/.test(h)) return 'stakeholder_type';
    if (/role|title|position/.test(h)) return 'role';
    return h;
  }
  function normalizeType(s) {
    var t = lc(s).replace(/[^a-z]/g, '_');
    if (STAKEHOLDER_TYPES.indexOf(t) !== -1) return t;
    if (/found/.test(t)) return 'founder';
    if (/ceo|chief exec/.test(t)) return 'ceo';
    if (/chro|chief (people|hr|human)/.test(t)) return 'chro';
    if (/talent|recruit|ta\b/.test(t)) return 'talent_acquisition';
    if (/head|vp|director|business/.test(t)) return 'business_head';
    if (/lead|functional/.test(t)) return 'functional_leader';
    if (/manager|mgr/.test(t)) return 'manager';
    if (/former|ex-/.test(t)) return 'former_employee';
    if (/advisor|board/.test(t)) return 'advisor';
    return 'employee';
  }

  /* ==========================================================
     INVITES — first-contact message; send honest-blocked
     ========================================================== */
  function generateInvite(stakeholderId, channel, store) {
    store = ensure(store || OF.load());
    var stk = byId(store.val_stakeholders, 'stakeholder_id', stakeholderId);
    if (!stk) return { error: 'Stakeholder not found.' };
    var c = byId(store.val_campaigns, 'campaign_id', stk.campaign_id);
    var ch = INVITE_CHANNELS.indexOf(channel) !== -1 ? channel : 'email';
    var msg = FIRST_CONTACT.replace('{company}', c ? c.company_name : 'your company');
    var inv = newInvite({
      stakeholder_id: stakeholderId, campaign_id: stk.campaign_id, channel: ch,
      subject: 'Improving ' + (c ? c.company_name : 'your') + "'s Organizational Frequency profile",
      message: msg, status: 'draft'
    });
    store.val_invites = store.val_invites.filter(function (x) { return !(x.stakeholder_id === stakeholderId && x.status === 'draft'); });
    store.val_invites.push(inv);
    audit(store, 'invite', stk.name, 'drafted', ch);
    OF.save(store);
    return { invite: inv };
  }
  function sendInvite(inviteId, store) {
    store = ensure(store || OF.load());
    var inv = byId(store.val_invites, 'invite_id', inviteId);
    if (!inv) return { error: 'Invite not found.' };
    var stk = byId(store.val_stakeholders, 'stakeholder_id', inv.stakeholder_id);
    var transportConfigured = OF.transport && OF.transport.isConfigured && OF.transport.isConfigured(inv.channel, store);
    if (inv.channel === 'manual') {
      inv.status = 'sent';
      inv.blocked_reason = '';
      if (stk) { stk.status = 'invited'; stk.invited_at = nowISO(); }
      audit(store, 'invite', stk ? stk.name : inviteId, 'sent', 'manual — operator delivers it');
      OF.save(store);
      return { invite: inv, sent: true, manual: true };
    }
    if (!transportConfigured) {
      inv.status = 'queued';
      inv.blocked_reason = titleish(inv.channel) + ' transport is not configured — invite queued, not sent. Use the manual channel to deliver it yourself, then log the response.';
      audit(store, 'invite', stk ? stk.name : inviteId, 'blocked', inv.channel + ' not configured');
      OF.save(store);
      return { invite: inv, blocked: true };
    }
    inv.status = 'sent';
    if (stk) { stk.status = 'invited'; stk.invited_at = nowISO(); }
    audit(store, 'invite', stk ? stk.name : inviteId, 'sent', inv.channel);
    OF.save(store);
    return { invite: inv, sent: true };
  }

  /* ==========================================================
     RESPONSES → confidence change → ValidationEvent → (1L hook)
     ========================================================== */
  function recordResponse(questionId, stakeholderId, fields, store) {
    store = ensure(store || OF.load());
    var q = byId(store.val_questions, 'question_id', questionId);
    if (!q) return { error: 'Question not found.' };
    var stk = byId(store.val_stakeholders, 'stakeholder_id', stakeholderId);
    if (!stk) return { error: 'Select the stakeholder who responded.' };
    fields = fields || {};
    if (!fields.response_text) return { error: 'Enter the stakeholder response text.' };

    var supports = !!fields.supports_hypothesis;
    var contradicts = !!fields.contradicts_hypothesis;
    var impact = contradicts ? 'contested' : (supports ? 'increase' : 'none');

    var resp = newResponse({
      question_id: questionId, stakeholder_id: stakeholderId, response_text: fields.response_text,
      confidence_impact: impact, supports_hypothesis: supports, contradicts_hypothesis: contradicts
    });
    store.val_responses.push(resp);
    q.status = 'answered';
    stk.status = 'completed'; stk.responded_at = nowISO();

    // update the ValidatedProfile dimension (history preserved, never overwritten)
    var prof = store.val_profiles.filter(function (p) { return p.campaign_id === q.campaign_id; })[0];
    var evt = null;
    if (prof) {
      var dim = q.dimension;
      var d = prof.dimensions[dim] || { level: (q.source_hypothesis || 'unclear'), confidence: 'low', history: [], stakeholder_sources: [] };
      var oldConf = d.confidence || 'low';
      var newConf = oldConf, newLevel = d.level, reason = '';
      if (contradicts) {
        newLevel = 'contested'; newConf = 'medium';
        reason = stk.stakeholder_type + ' response contradicts the public reading — recorded as a signal to reconcile, not an error. Contradiction is preserved.';
      } else if (supports) {
        newConf = confUp(oldConf);
        reason = stk.stakeholder_type + ' response supports the public reading; confidence raised ' + oldConf + ' → ' + newConf + '.';
      } else {
        newConf = oldConf;
        reason = stk.stakeholder_type + ' added context without changing the reading; recorded for the trail.';
      }
      // append the prior value to history (never overwrite)
      d.history = (d.history || []).concat([{ level: d.level, confidence: oldConf, source: stk.stakeholder_type, at: d.updated_at || nowISO() }]);
      d.level = newLevel; d.confidence = newConf;
      d.stakeholder_sources = (d.stakeholder_sources || []).concat([stk.stakeholder_type]);
      d.updated_at = nowISO();
      prof.dimensions[dim] = d;

      if (newConf !== oldConf || newLevel !== d.level || contradicts) {
        evt = newEvent({
          campaign_id: q.campaign_id, dimension: dim, old_confidence: oldConf, new_confidence: newConf,
          reason: reason, evidence: (fields.response_text || '').slice(0, 240), source_stakeholder: stk.name || stk.stakeholder_type
        });
        // ---- Frequency Evolution (1L) hook — append-only, never overwrites history ----
        if (OF.evolution && OF.evolution.newEvent) {
          try {
            var fev = OF.evolution.newEvent({
              organization_id: null, dimension: dim,
              previous_level: d.history.length ? d.history[d.history.length - 1].level : 'unknown',
              new_level: newLevel, confidence: newConf,
              note: '[3C validation] ' + reason, source: 'org_validation', change_type: contradicts ? 'contradicted' : 'reinforced'
            });
            // append into the SAME store object (do not reload — that would drop unsaved mutations)
            store.frequency_evolution_events = store.frequency_evolution_events || [];
            store.frequency_evolution_events.push(fev);
            evt.frequency_evolution_event_id = fev.event_id || fev.evolution_event_id || null;
          } catch (e) { /* 1L is optional — never block validation on it */ }
        }
        store.val_events.push(evt);
      }
      // recompute stage
      prof.stage = computeStage(q.campaign_id, store);
      prof.updated_at = nowISO();
    }
    audit(store, 'response', stk.name, 'recorded', q.dimension + ' · ' + impact);
    OF.save(store);
    return { response: resp, event: evt, profile: prof };
  }

  /* ==========================================================
     PROFILE PROGRESS
     ========================================================== */
  function computeStage(campaignId, store) {
    store = ensure(store || OF.load());
    var qs = store.val_questions.filter(function (q) { return q.campaign_id === campaignId; });
    var resps = store.val_responses.filter(function (r) { return qs.some(function (q) { return q.question_id === r.question_id; }); });
    if (!resps.length) return 'public_estimate';
    var respStakeholders = resps.map(function (r) { return byId(store.val_stakeholders, 'stakeholder_id', r.stakeholder_id); }).filter(Boolean);
    var types = {}; respStakeholders.forEach(function (s) { types[s.stakeholder_type] = 1; });
    var distinctTypes = Object.keys(types).length;
    // "Leadership Validated" = a top leader (founder/CEO) has validated. CHRO / heads
    // are senior, but the leadership rung specifically means founder/CEO sign-off.
    var leadershipResponded = respStakeholders.some(function (s) { return s.stakeholder_type === 'founder' || s.stakeholder_type === 'ceo'; });

    // living profile: a strong majority of generated questions answered AND multi-stakeholder
    var answered = qs.filter(function (q) { return q.status === 'answered'; }).length;
    var coverage = qs.length ? answered / qs.length : 0;
    if (distinctTypes >= 3 && coverage >= 0.8) return 'living_profile';
    if (distinctTypes >= 2) return 'multi_stakeholder_validated';
    if (leadershipResponded) return 'leadership_validated';
    return 'partially_validated';
  }

  /* ==========================================================
     READS
     ========================================================== */
  function getCampaign(campaignId, store) {
    store = ensure(store || OF.load());
    var c = byId(store.val_campaigns, 'campaign_id', campaignId);
    if (!c) return null;
    var ctx = publicContext(c.company_page_id, store);
    return {
      campaign: c,
      public: ctx,
      stakeholders: store.val_stakeholders.filter(function (s) { return s.campaign_id === campaignId; }),
      questions: store.val_questions.filter(function (q) { return q.campaign_id === campaignId; }),
      responses: store.val_responses.filter(function (r) { return store.val_questions.some(function (q) { return q.campaign_id === campaignId && q.question_id === r.question_id; }); }),
      events: store.val_events.filter(function (e) { return e.campaign_id === campaignId; }).slice().reverse(),
      invites: store.val_invites.filter(function (i) { return i.campaign_id === campaignId; }),
      profile: store.val_profiles.filter(function (p) { return p.campaign_id === campaignId; })[0] || null
    };
  }
  function snapshot(store) {
    store = ensure(store || OF.load());
    return {
      pages: availablePages(store),
      campaigns: store.val_campaigns.slice().reverse(),
      audit: store.val_audit_log.slice().reverse(),
      counts: {
        pages: (store.pub_pages || []).length,
        campaigns: store.val_campaigns.length,
        stakeholders: store.val_stakeholders.length,
        questions: store.val_questions.length,
        responses: store.val_responses.length,
        events: store.val_events.length
      }
    };
  }
  function resetValidation(store) {
    store = ensure(store || OF.load());
    store.val_campaigns = []; store.val_stakeholders = []; store.val_questions = [];
    store.val_responses = []; store.val_events = []; store.val_invites = []; store.val_profiles = [];
    store.val_audit_log = [];
    OF.save(store);
  }

  OF.orgval = {
    CAMPAIGN_STATUS: CAMPAIGN_STATUS, STAKEHOLDER_TYPES: STAKEHOLDER_TYPES, STAKEHOLDER_STATUS: STAKEHOLDER_STATUS,
    PRIORITY: PRIORITY, QUESTION_STATUS: QUESTION_STATUS, INVITE_CHANNELS: INVITE_CHANNELS, INVITE_STATUS: INVITE_STATUS,
    CONTACT_SOURCES: CONTACT_SOURCES, LEADERSHIP_TYPES: LEADERSHIP_TYPES, STAGES: STAGES, STAGE_LABELS: STAGE_LABELS,
    DIM_PLAN: DIM_PLAN, dimLabel: dimLabel,
    ensure: ensure,
    availablePages: availablePages, publicContext: publicContext,
    createCampaign: createCampaign, setCampaignStatus: setCampaignStatus,
    generateQuestions: generateQuestions,
    apolloDiscover: apolloDiscover, addStakeholder: addStakeholder, importStakeholdersCSV: importStakeholdersCSV,
    generateInvite: generateInvite, sendInvite: sendInvite,
    recordResponse: recordResponse, computeStage: computeStage,
    getCampaign: getCampaign, snapshot: snapshot, resetValidation: resetValidation
  };
})();
