/* =============================================================
   Organizational Frequency — Mission Capture controller (1A)
   =============================================================
   Pull Mode only. Aeon1 asks five questions, in order, then
   assembles the Mission Spine (Organization + Mission + User +
   relationships + memory seeds) via window.OF.commitCapture.

   The five questions are fixed and doctrinal — mission first.
   It never asks "what role are you hiring for" or "what
   frequency are you".

   Structured extraction is attempted via window.claude.complete;
   if unavailable or it errors, a deterministic local extractor
   runs so the spine is ALWAYS produced.
   ============================================================= */
(function () {
  'use strict';

  var OF = window.OF;

  // ---- The five questions, in doctrinal order ----------------
  var OPENING =
    "I'm Aeon1. I help with the mission before anything else — " +
    "not the role, not the hire. Five short questions. Take them plainly.";

  var STEPS = [
    { key: 'q1', q: 'What organization are you from?',
      placeholder: 'e.g. I’m Sarah, from Hyphae — a nine-person design studio…' },
    { key: 'q2', q: 'What is your organization trying to achieve right now?',
      placeholder: 'The outcome you’re working toward…' },
    { key: 'q3', q: 'Why is that important?',
      placeholder: 'What’s at stake, what it unlocks…' },
    { key: 'q4', q: 'What is preventing that from happening?',
      placeholder: 'The obstacle, the constraint, the friction…' },
    { key: 'q5', q: 'How important are people and talent to solving this challenge?',
      placeholder: 'Central, partly, not really — and why…' }
  ];

  // Connective receipts between answers — neutral, no flattery.
  var RECEIPTS = [
    'Noted.',
    'Good — that’s the outcome.',
    'I hear why it matters.',
    'That’s the constraint, then.'
  ];

  // ---- State -------------------------------------------------
  var raw = {};
  var stepIndex = 0;

  // ---- DOM ---------------------------------------------------
  var stream   = document.getElementById('stream');
  var composer = document.getElementById('composer');
  var input    = document.getElementById('input');
  var send     = document.getElementById('send');
  var ticks    = document.getElementById('ticks').querySelectorAll('.of-tick');
  var spineEl  = document.getElementById('spine');
  var captureEl= document.getElementById('capture');

  // ---- Helpers ----------------------------------------------
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(s) {
    return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  // Persist a turn to the backend transcript (best-effort, anonymous).
  function record(role, text) {
    if (window.OFChatStore) window.OFChatStore.addTurn(role, text);
  }
  function aeonTurn(text) {
    var t = el('div', 'of-turn aeon');
    t.appendChild(el('div', 'of-who', 'Aeon1'));
    t.appendChild(el('div', 'of-said', text));
    stream.appendChild(t);
    record('assistant', text);
  }
  function readerTurn(text) {
    var t = el('div', 'of-turn reader');
    t.appendChild(el('div', 'of-who', 'You'));
    t.appendChild(el('div', 'of-said', esc(text)));
    stream.appendChild(t);
    record('user', text);
  }
  function thinking() {
    var t = el('div', 'of-turn aeon');
    t.id = 'thinking';
    var d = el('div', 'of-thinking');
    d.appendChild(el('span')); d.appendChild(el('span')); d.appendChild(el('span'));
    t.appendChild(d);
    stream.appendChild(t);
    return t;
  }
  function holdComposer(ms) {
    composer.classList.add('is-held');
    setTimeout(function () {
      composer.classList.remove('is-held');
      input.focus();
    }, ms || 900);
  }
  function setTicks() {
    ticks.forEach(function (t, i) {
      t.classList.remove('is-done', 'is-now');
      if (i < stepIndex) t.classList.add('is-done');
      else if (i === stepIndex) t.classList.add('is-now');
    });
  }

  // ---- Flow --------------------------------------------------
  function start() {
    aeonTurn(OPENING);
    setTimeout(function () { askStep(); }, 1100);
  }

  function askStep() {
    setTicks();
    var step = STEPS[stepIndex];
    aeonTurn(step.q);
    input.placeholder = step.placeholder;
    holdComposer(800);
  }

  function submit() {
    var text = input.value.trim();
    if (!text || composer.classList.contains('is-held')) return;
    var step = STEPS[stepIndex];
    raw[step.key] = text;
    readerTurn(text);
    input.value = '';
    autosize();

    stepIndex += 1;

    // Persist progress after every answer so a partial intake is never lost.
    if (window.OFChatStore) window.OFChatStore.save({ status: 'active' });

    if (stepIndex < STEPS.length) {
      // brief receipt, then next question
      composer.classList.add('is-held');
      var receipt = RECEIPTS[stepIndex - 1];
      setTimeout(function () {
        if (receipt) aeonTurn(receipt);
        setTimeout(askStep, receipt ? 700 : 0);
      }, 500);
    } else {
      // all five captured — assemble the spine
      setTicks();
      composer.classList.add('is-held');
      assemble();
    }
  }

  function assemble() {
    var th = thinking();
    function finish(fields) {
      // Use the name the visitor gave at the lead gate if the chat didn't state one.
      if (!fields.name && window.OF_LEAD && window.OF_LEAD.name) fields.name = window.OF_LEAD.name;
      var result = OF.commitCapture(buildCapture(fields, raw));
      th.remove();
      aeonTurn('That’s enough to hold the mission. Here is what the runtime now knows.');
      persistComplete(fields, result);
      setTimeout(function () { renderSpine(result); }, 900);
    }
    extract(raw)
      .then(finish)
      .catch(function () { finish(localExtract(raw)); }); // never fail
  }

  // Save the finished chat + assembled Mission Spine to the backend (MongoDB).
  function persistComplete(fields, result) {
    if (!window.OFChatStore) return;
    window.OFChatStore.setLead({
      name: fields.name || '',
      organizationName: fields.organization_name || '',
    });
    window.OFChatStore.save({
      status: 'complete',
      artefact: {
        organization: result.organization,
        mission: result.mission,
        user: result.user,
        seeds: result.seeds,
        raw: raw,
      },
    });
  }

  // ---- Extraction (AI with deterministic fallback) -----------
  function extract(raw) {
    return new Promise(function (resolve, reject) {
      if (!(window.claude && typeof window.claude.complete === 'function')) {
        return resolve(localExtract(raw));
      }
      var system = extractionSystemPrompt();
      var userMsg =
        'Q1 What organization are you from?\n' + raw.q1 + '\n\n' +
        'Q2 What is your organization trying to achieve right now?\n' + raw.q2 + '\n\n' +
        'Q3 Why is that important?\n' + raw.q3 + '\n\n' +
        'Q4 What is preventing that from happening?\n' + raw.q4 + '\n\n' +
        'Q5 How important are people and talent to solving this challenge?\n' + raw.q5;

      var done = false;
      var guard = setTimeout(function () {
        if (!done) { done = true; resolve(localExtract(raw)); }
      }, 14000);

      window.claude.complete({
        system: system,
        messages: [{ role: 'user', content: userMsg }]
      }).then(function (reply) {
        if (done) return;
        done = true; clearTimeout(guard);
        try {
          var json = JSON.parse(stripFences(reply));
          resolve(reconcile(json, raw));
        } catch (e) {
          resolve(localExtract(raw));
        }
      }).catch(function () {
        if (done) return;
        done = true; clearTimeout(guard);
        resolve(localExtract(raw));
      });
    });
  }

  function extractionSystemPrompt() {
    return [
      'You read a five-answer mission intake and return ONLY a JSON object — no prose, no code fences.',
      'Mission comes first; hiring is only one possible intervention. Do not assume hiring is the answer.',
      'Fields and allowed values:',
      '{',
      '  "name": string (the speaker\'s name if stated, else ""),',
      '  "organization_name": string,',
      '  "website": string,',
      '  "industry": string,',
      '  "size": string,',
      '  "location": string,',
      '  "mission_name": string (a short title, <= 8 words),',
      '  "mission_description": string,',
      '  "desired_outcome": string,',
      '  "time_horizon": string,',
      '  "obstacles": string[],',
      '  "people_dependency": string,',
      '  "mission_type": one of ["expansion","new_geography","new_office","new_product","technology","sales","operations","customer_support","fundraising","hiring","culture","transformation","unknown"],',
      '  "mission_stage": one of ["emerging","defined","active","urgent","blocked","completed"],',
      '  "hiring_relevance": one of ["none","possible","likely","central"],',
      '  "primary_role": one of ["founder","ceo","hr_head","hiring_manager","team_lead","employee","consultant","unknown"],',
      '  "confidence": number 0..1',
      '}',
      'Leave a field "" or [] if not present. Return the JSON object and nothing else.'
    ].join('\n');
  }

  function stripFences(s) {
    if (!s) return '{}';
    var m = String(s).match(/\{[\s\S]*\}/);
    return m ? m[0] : '{}';
  }

  // Make sure AI output is well-formed against our enums; fill gaps
  // from the local extractor so nothing is ever empty.
  function reconcile(json, raw) {
    var local = localExtract(raw);
    function pick(k) { return (json[k] != null && json[k] !== '' && !(Array.isArray(json[k]) && !json[k].length)) ? json[k] : local[k]; }
    return {
      name: json.name || local.name,
      organization_name: pick('organization_name'),
      website: json.website || '',
      industry: json.industry || '',
      size: json.size || '',
      location: json.location || '',
      mission_name: pick('mission_name'),
      mission_description: pick('mission_description'),
      desired_outcome: pick('desired_outcome'),
      time_horizon: json.time_horizon || local.time_horizon,
      obstacles: pick('obstacles'),
      people_dependency: pick('people_dependency'),
      mission_type: inEnum('mission_type', json.mission_type, local.mission_type),
      mission_stage: inEnum('mission_stage', json.mission_stage, local.mission_stage),
      hiring_relevance: inEnum('hiring_relevance', json.hiring_relevance, local.hiring_relevance),
      primary_role: inEnum('primary_role', json.primary_role, local.primary_role),
      confidence: typeof json.confidence === 'number' ? json.confidence : 0.6
    };
  }
  function inEnum(name, v, fallback) {
    return (OF.ENUMS[name] || []).indexOf(v) !== -1 ? v : fallback;
  }

  // Deterministic local extraction — keyword heuristics. Never fails.
  function localExtract(raw) {
    var q1 = raw.q1 || '', q2 = raw.q2 || '', q3 = raw.q3 || '', q4 = raw.q4 || '', q5 = raw.q5 || '';
    var name = '';
    var orgName = q1.trim();
    // "I'm Sarah from Hyphae" / "Sarah, Hyphae" style splitting
    var m = q1.match(/\bi(?:'m| am)\s+([A-Z][a-z]+)\b[\s,]+(?:from|at|with|of)\s+([^.,\n]+)/i);
    if (m) { name = cap(m[1]); orgName = m[2].trim(); }
    else {
      var m2 = q1.match(/\bfrom\s+([^.,\n]+)/i);
      if (m2) orgName = m2[1].trim();
    }
    orgName = orgName.replace(/^(the\s+)?company\s+(called\s+)?/i, '').replace(/[.…]+$/, '').trim();
    if (orgName.length > 60) orgName = orgName.slice(0, 60).trim();

    var blob = (q2 + ' ' + q3 + ' ' + q4).toLowerCase();
    var missionType = classifyType(blob);
    var missionStage = classifyStage((q2 + ' ' + q4).toLowerCase());
    var hiring = classifyHiring(q5.toLowerCase());

    return {
      name: name,
      organization_name: orgName || 'Unnamed organization',
      website: '', industry: '', size: '', location: '',
      mission_name: shorten(q2, 8),
      mission_description: q2,
      desired_outcome: q2,
      time_horizon: detectHorizon(blob),
      obstacles: q4 ? [q4.trim()] : [],
      people_dependency: q5,
      mission_type: missionType,
      mission_stage: missionStage,
      hiring_relevance: hiring,
      primary_role: classifyRole(q1.toLowerCase()),
      confidence: 0.35
    };
  }

  function classifyType(s) {
    var map = [
      ['new_office', /\b(new office|open(ing)? an office|second office)\b/],
      ['new_geography', /\b(expand(ing)? (into|to)|new (market|country|geography|region)|internationa)/],
      ['expansion', /\b(expand|scal(e|ing)|grow(th| the))\b/],
      ['new_product', /\b(launch|new product|ship|build(ing)? a (new )?product)\b/],
      ['technology', /\b(ai team|machine learning|platform|infrastructure|engineering|rebuild|migrat)/],
      ['sales', /\b(sales|revenue|pipeline|close more|go.to.market|gtm)\b/],
      ['customer_support', /\b(support|customer service|help desk|response time)\b/],
      ['operations', /\b(operations|process|efficien|throughput|delivery)\b/],
      ['fundraising', /\b(raise|fundrais|series [a-z]|seed round|investors?)\b/],
      ['hiring', /\b(hir(e|ing)|recruit|staff up|build a team)\b/],
      ['culture', /\b(culture|attrition|retention|morale|engagement)\b/],
      ['transformation', /\b(transform|turnaround|reinvent|overhaul)\b/]
    ];
    for (var i = 0; i < map.length; i++) if (map[i][1].test(s)) return map[i][0];
    return 'unknown';
  }
  function classifyStage(s) {
    if (/\b(urgent|asap|immediately|behind|running out|deadline|by (next )?(month|quarter))\b/.test(s)) return 'urgent';
    if (/\b(blocked|stuck|can.?t|cannot|stalled|frozen)\b/.test(s)) return 'blocked';
    if (/\b(already|currently|underway|in progress|started)\b/.test(s)) return 'active';
    if (/\b(thinking about|exploring|considering|might|planning to|early)\b/.test(s)) return 'emerging';
    return 'defined';
  }
  function classifyHiring(s) {
    if (/\b(central|critical|essential|core|everything|the whole|most important|can.?t do it without|entirely)\b/.test(s)) return 'central';
    if (/\b(very important|key|major|big part|crucial|significant)\b/.test(s)) return 'likely';
    if (/\b(not (really|that)|minimal|little|not the|less about people|not about hiring)\b/.test(s)) return 'none';
    if (/\b(somewhat|partly|partially|to some|a bit|maybe)\b/.test(s)) return 'possible';
    return 'possible';
  }
  function classifyRole(s) {
    if (/\b(founder|co-?founder)\b/.test(s)) return 'founder';
    if (/\b(ceo|chief exec)\b/.test(s)) return 'ceo';
    if (/\b(head of (hr|people)|chro|hr (head|lead|director))\b/.test(s)) return 'hr_head';
    if (/\b(hiring manager)\b/.test(s)) return 'hiring_manager';
    if (/\b(team lead|lead|manager)\b/.test(s)) return 'team_lead';
    if (/\b(consultant|advisor|advisor)\b/.test(s)) return 'consultant';
    if (/\b(i work|employee|on the team)\b/.test(s)) return 'employee';
    return 'unknown';
  }
  function detectHorizon(s) {
    var m = s.match(/\b(this (quarter|year|month)|next (quarter|year|month)|\d+\s*(weeks?|months?|years?)|by (q[1-4]|end of \w+)|h[12])\b/);
    return m ? m[0] : '';
  }

  function cap(w) { return w ? w.charAt(0).toUpperCase() + w.slice(1) : w; }
  function shorten(s, words) {
    if (!s) return '';
    var parts = s.replace(/\s+/g, ' ').trim().split(' ');
    var out = parts.slice(0, words).join(' ');
    return out + (parts.length > words ? '…' : '');
  }

  // ---- Build the capture payload for OF.commitCapture --------
  function buildCapture(f, raw) {
    return {
      organization: {
        organization_name: f.organization_name,
        website: f.website, industry: f.industry, size: f.size, location: f.location
      },
      mission: {
        mission_name: f.mission_name,
        mission_description: f.mission_description,
        desired_outcome: f.desired_outcome,
        time_horizon: f.time_horizon,
        obstacles: f.obstacles,
        people_dependency: f.people_dependency,
        mission_type: f.mission_type,
        mission_stage: f.mission_stage,
        hiring_relevance: f.hiring_relevance,
        confidence: f.confidence
      },
      user: {
        name: f.name,
        primary_role: f.primary_role
      },
      raw: raw
    };
  }

  // ---- Render the assembled spine ---------------------------
  function renderSpine(result) {
    var org = result.organization, mis = result.mission, usr = result.user, seeds = result.seeds;
    composer.classList.add('hidden');

    var seedRows = seeds.map(function (s) {
      return '<div class="of-seed">' +
        '<div class="os-kind">' + esc(seedLabel(s)) + '</div>' +
        '<div class="os-text">' + esc(seedText(s)) + '</div>' +
        '</div>';
    }).join('');

    var html =
      '<div class="of-spine-head">The Mission Spine · assembled</div>' +
      '<div class="of-spine-title">Three objects now exist, and their relationships are recorded.</div>' +

      '<div class="of-cards">' +

        // Organization
        card('Organization', org.organization_id, esc(org.organization_name), [
          row('Research', '<span class="of-pill" id="of-research-pill">' + esc(org.research_status) + '</span>'),
          row('Frequency', '<span class="of-pill">placeholder · not computed</span>'),
          org.industry ? row('Industry', esc(org.industry)) : '',
          org.size ? row('Size', esc(org.size)) : ''
        ]) +

        // Mission
        card('Mission', mis.mission_id, esc(mis.mission_name || mis.desired_outcome), [
          row('Outcome', esc(mis.desired_outcome || '—')),
          row('Type', '<span class="of-pill">' + esc(mis.mission_type) + '</span>'),
          row('Stage', '<span class="of-pill">' + esc(mis.mission_stage) + '</span>'),
          row('Hiring relevance', '<span class="of-pill">' + esc(mis.hiring_relevance) + '</span>'),
          mis.time_horizon ? row('Horizon', esc(mis.time_horizon)) : '',
          mis.obstacles && mis.obstacles.length ? row('Obstacle', esc(mis.obstacles[0])) : ''
        ]) +

        // Person
        card('Person', usr.user_id, esc(usr.name || 'Unnamed describer'), [
          row('Primary role', '<span class="of-pill">' + esc(usr.primary_role) + '</span>'),
          row('Relationship', '<span class="of-pill">' + esc(usr.relationship_to_mission) + '</span>')
        ]) +

      '</div>' +

      // Relationship map
      '<div class="of-rel">' +
        '<b>' + esc(org.organization_name) + '</b><span class="arr">owns →</span><b>' + esc(mis.mission_name || 'mission') + '</b>' +
      '</div>' +
      '<div class="of-rel">' +
        '<b>' + esc(usr.name || 'The describer') + '</b><span class="arr">describes →</span><b>' + esc(mis.mission_name || 'mission') + '</b>' +
      '</div>' +

      // Seeds
      '<div class="of-spine-head" style="margin-top:30px">Memory seeds · Evidence → Transformation → Essence</div>' +
      '<div class="of-spine-title" style="font-size:18px;margin-bottom:18px">Lightweight records, deposited onto the seam for later promotion.</div>' +
      '<div class="of-seeds">' + seedRows + '</div>' +

      // Tier-0 research phase fills here
      '<div class="of-research-slot" id="of-research"></div>' +

      '<p class="of-foot-note">' +
        'Recorded. The runtime is now mission-centric — it holds a mission, the organization that owns it, ' +
        'and the person who described it. Next, the organization’s <em>frequency</em> would be researched ' +
        'before any talk of resonance or candidates. ' +
        '<a href="../studio/missions.html">Open the Mission admin →</a>' +
      '</p>' +
      '<button class="of-restart" id="restart" type="button">Describe another mission</button>';

    spineEl.innerHTML = html;
    spineEl.classList.remove('hidden');
    document.getElementById('restart').addEventListener('click', function () {
      window.location.reload();
    });
    runResearchPhase(result);
  }

  function card(kind, id, name, rows) {
    return '<div class="of-card">' +
      '<div class="oc-kind"><span>' + esc(kind) + '</span><span class="oc-id">' + esc(id) + '</span></div>' +
      '<div class="oc-name">' + name + '</div>' +
      rows.filter(Boolean).join('') +
      '</div>';
  }
  function row(k, v) {
    return '<div class="oc-row"><div class="oc-k">' + esc(k) + '</div><div class="oc-v">' + v + '</div></div>';
  }
  function seedLabel(s) {
    var map = {
      evidence: 'Evidence seed',
      mission_summary: 'Mission summary',
      open_question: 'Open question',
      transformation: 'Transformation candidate',
      essence: 'Essence seed'
    };
    return (map[s.kind] || s.kind) + ' · ' + s.subject_type;
  }
  function seedText(s) {
    var p = s.payload || {};
    return p.summary || p.question || p.description || p.core_paragraph || '—';
  }

  // ---- Input wiring ------------------------------------------
  function autosize() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 180) + 'px';
  }
  input.addEventListener('input', autosize);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  });
  send.addEventListener('click', submit);

  // ---- Tier-0 research phase (after the spine) ---------------
  function runResearchPhase(result) {
    var slot = document.getElementById('of-research');
    if (!slot || !(OF.research && OF.research.runTier0)) return;
    var org = result.organization, mis = result.mission;
    slot.innerHTML =
      '<div class="of-spine-head" style="margin-top:32px">Outside-in · Tier-0</div>' +
      '<div class="of-rp-aeon"><div class="of-who2">Aeon1</div><div class="of-rp-say">Thank you. Based on what you’ve shared, I’d like to develop an initial understanding of your organization before going further — only from public signal, and only as a hypothesis.</div></div>' +
      '<div class="of-thinking" style="padding-left:2px"><span></span><span></span><span></span></div>';
    OF.research.runTier0(org.organization_id, mis.mission_id, { ai: true }).then(function (r) {
      // Research has run — update the Organization card's Research pill.
      var pill = document.getElementById('of-research-pill');
      if (pill) {
        var o = (OF.load().organizations || []).filter(function (x) { return x.organization_id === org.organization_id; })[0];
        pill.textContent = (o && o.research_status) || 'tier0';
      }
      renderHypothesis(slot, org, mis, r);
    }).catch(function () {
      slot.innerHTML += '<div class="of-rp-say" style="color:var(--ink-3)">A preliminary view could not be formed right now.</div>';
    });
  }

  function renderHypothesis(slot, org, mis, r) {
    var ess = r.essence, freq = r.frequency, ana = r.analysis;
    var topDims = freq.dimension_estimates.slice().sort(function (a, b) { return b.confidence - a.confidence; }).slice(0, 4);
    var dimRows = topDims.map(function (d) {
      return '<div class="of-dim"><div class="of-dim-name">' + esc(d.dimension) + '</div>' +
        '<div class="of-dim-est">' + esc(d.estimate) + '</div>' +
        '<div class="of-dim-conf">' + esc(OF.research.confidenceLabel(d.confidence)) + '</div></div>';
    }).join('');
    var riskRows = ana ? ana.mission_risk_observations.slice(0, 3).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') : '';

    slot.innerHTML =
      '<div class="of-spine-head" style="margin-top:32px">Outside-in · Tier-0 · <span style="color:var(--ink-4)">hypothesis</span></div>' +
      '<div class="of-rp-aeon"><div class="of-who2">Aeon1</div><div class="of-rp-say">From publicly available signal, a first picture — held loosely, not a conclusion. ' +
        esc(firstClause(ess.core_narrative)) + ' Does that sound roughly right?</div></div>' +

      '<div class="of-card"><div class="oc-kind"><span>Organization essence · hypothesis</span><span class="oc-id">' + esc(OF.research.confidenceLabel(ess.confidence)) + ' confidence</span></div>' +
        '<div class="of-rp-narr">' + esc(ess.core_narrative) + '</div></div>' +

      '<div class="of-card"><div class="oc-kind"><span>Frequency · strongest signal</span><span class="oc-id">' + esc(OF.research.confidenceLabel(freq.confidence)) + ' confidence</span></div>' +
        '<div class="of-dims">' + dimRows + '</div>' +
        '<div class="of-dim-foot">All 10 dimensions estimated in the admin · ' + esc(freq.frequency_summary) + '</div></div>' +

      (ana ?
        '<div class="of-card"><div class="oc-kind"><span>Mission analysis</span><span class="oc-id">' + esc(OF.research.confidenceLabel(ana.confidence)) + ' confidence</span></div>' +
          '<div class="oc-row"><div class="oc-k">Must become</div><div class="oc-v">' + esc(ana.required_organization_hypothesis) + '</div></div>' +
          '<div class="oc-row"><div class="oc-k">Appears today</div><div class="oc-v">' + esc(ana.current_organization_hypothesis) + '</div></div>' +
          (riskRows ? '<div class="oc-row"><div class="oc-k">Risks</div><div class="oc-v"><ul class="of-risks">' + riskRows + '</ul></div></div>' : '') +
        '</div>' : '') +

      '<div class="of-spine-head" style="margin-top:30px">Validating · with you</div>' +
      '<div class="of-rp-aeon"><div class="of-who2">Aeon1</div><div class="of-rp-say">None of that is treated as fact. Let me check the few strongest reads with you — each answer is recorded as a validation, not an assumption.</div></div>' +
      '<div id="of-validate"></div>';

    startValidation(org, mis);
  }

  // ---- Aeon1 validation sub-flow (1C) ------------------------
  function startValidation(org, mis) {
    var box = document.getElementById('of-validate');
    if (!box) return;
    var queue = (OF.validation && OF.validation.nextToValidate) ? OF.validation.nextToValidate(org.organization_id, 3) : [];
    renderValidationStep(box, org, mis, queue, 0, []);
  }

  function renderValidationStep(box, org, mis, queue, i, done) {
    if (i >= queue.length) {
      box.innerHTML =
        '<div class="of-rp-aeon"><div class="of-who2">Aeon1</div><div class="of-rp-say">' +
          esc(summarizeValidation(done)) + ' What you confirmed is now held as <em>validated understanding</em>; what you corrected stays a hypothesis. Nothing was treated as fact on its own.</div></div>' +
        '<div id="of-required"></div>' +
        '<div id="of-freq"></div>';
      startRequiredValidation(org, mis);
      return;
    }
    var v = queue[i];
    box.innerHTML =
      '<div class="of-vcard">' +
        '<div class="of-vq">We currently believe: <em>' + esc(v.statement) + '</em></div>' +
        '<div class="of-vsub">Does that feel accurate?</div>' +
        '<div class="of-vbtns">' +
          '<button class="of-cbtn" type="button" data-r="accurate">Accurate</button>' +
          '<button class="of-cbtn" type="button" data-r="partially">Partially</button>' +
          '<button class="of-cbtn" type="button" data-r="inaccurate">Inaccurate</button>' +
          '<button class="of-cbtn" type="button" data-r="unsure">Unsure</button>' +
        '</div>' +
        '<div class="of-vmeta">' + (i + 1) + ' of ' + queue.length + ' · recorded as a validation · source: you (mission owner)</div>' +
      '</div>';
    Array.prototype.forEach.call(box.querySelectorAll('.of-cbtn'), function (b) {
      b.addEventListener('click', function () {
        var r = b.getAttribute('data-r');
        var res = OF.validation.recordValidation(v.validation_id, r, 'mission_owner');
        done.push({ statement: v.statement, response: r, understanding: res && res.understanding });
        renderValidationStep(box, org, mis, queue, i + 1, done);
      });
    });
  }

  // ---- Aeon1 required-side validation (1E) -------------------
  function startRequiredValidation(org, mis) {
    if (OF.frequency && OF.frequency.recompute) OF.frequency.recompute(org.organization_id, mis.mission_id);
    var box = document.getElementById('of-required');
    var rf = (OF.load().required_frequencies || []).filter(function (x) { return x.mission_id === mis.mission_id; })[0];
    if (!box || !rf || !OF.requiredValidation) { explainFrequency(org, mis); return; }
    var rfid = rf.required_frequency_id;
    if (!OF.requiredValidation.nextRequired(rfid, 1).length) { explainFrequency(org, mis); return; }
    box.innerHTML =
      '<div class="of-spine-head" style="margin-top:30px">Validating the requirement</div>' +
      '<div class="of-rp-aeon"><div class="of-who2">Aeon1</div><div class="of-rp-say">And the other side — what the mission <em>requires</em>. I should not assume these either. Tell me whether each is truly required.</div></div>' +
      '<div id="of-rvstep"></div>';
    renderRequiredStep(org, mis, rfid, 0, 3);
  }

  // Re-fetches the next untested required validation FRESH each step
  // (recordRequired recomputes the layer, so ids must be read live).
  function renderRequiredStep(org, mis, rfid, asked, maxAsk) {
    var box = document.getElementById('of-rvstep');
    if (!box) return;
    var next = (OF.requiredValidation.nextRequired(rfid, 1) || [])[0];
    if (!next || asked >= maxAsk) {
      box.innerHTML = '<div class="of-rp-aeon"><div class="of-who2">Aeon1</div><div class="of-rp-say">Both sides now rest on what you confirmed, not on assumption.</div></div>';
      explainFrequency(org, mis);
      return;
    }
    var v = next;
    box.innerHTML =
      '<div class="of-vcard">' +
        '<div class="of-vq">' + esc(v.statement) + '</div>' +
        '<div class="of-vsub">Will this really be required for the mission?</div>' +
        '<div class="of-vbtns">' +
          '<button class="of-cbtn" type="button" data-r="accurate">Accurate</button>' +
          '<button class="of-cbtn" type="button" data-r="partially">Partially</button>' +
          '<button class="of-cbtn" type="button" data-r="inaccurate">Inaccurate</button>' +
          '<button class="of-cbtn" type="button" data-r="unsure">Unsure</button>' +
        '</div>' +
        '<div class="of-vmeta">validating the required side · source: you</div>' +
      '</div>';
    Array.prototype.forEach.call(box.querySelectorAll('.of-cbtn'), function (b) {
      b.addEventListener('click', function () {
        OF.requiredValidation.recordRequired(v.required_validation_id, b.getAttribute('data-r'), 'mission_owner');
        renderRequiredStep(org, mis, rfid, asked + 1, maxAsk);
      });
    });
  }

  // Aeon1 explains mission → required → current → gap (tentative).
  function explainFrequency(org, mis) {
    var box = document.getElementById('of-freq');
    if (!box || !OF.frequency) return;
    if (!OF.frequency.hasUnderstanding(org.organization_id)) {
      box.innerHTML =
        '<div class="of-rp-aeon"><div class="of-who2">Aeon1</div><div class="of-rp-say">Once a few of these are validated, I can compare what the mission <em>requires</em> against what your organization currently <em>appears to be</em>. We are not there yet — nothing was confirmed strongly enough.</div></div>' +
        '<p class="of-foot-note" style="border:none;padding-top:8px">Continue validating in the <a href="../studio/missions.html">Mission admin</a>.</p>';
      return;
    }
    var r = OF.frequency.recompute(org.organization_id, mis.mission_id);
    if (!r) return;
    var gaps = (r.gap.dimension_gaps || []).filter(function (g) { return g.gap_level === 'moderate' || g.gap_level === 'major'; });
    var areas = (r.interventions || []).filter(function (iv) { return iv.dimension; }).slice(0, 3)
      .map(function (iv) { return iv.intervention_type.replace('_', ' '); });
    var uniqAreas = areas.filter(function (a, i) { return areas.indexOf(a) === i; });
    box.innerHTML =
      '<div class="of-spine-head" style="margin-top:30px">Mission → required → current → gap</div>' +
      '<div class="of-rp-aeon"><div class="of-who2">Aeon1</div><div class="of-rp-say">' +
        esc(firstClause(r.required.required_summary)) + ' ' + esc(firstClause(r.current.current_summary)) + ' ' +
        (gaps.length
          ? 'Tentatively, that points to a gap in ' + esc(gaps.slice(0, 2).map(function (g) { return g.dimension.toLowerCase(); }).join(' and ')) + '.'
          : 'No clear gap stands out yet on what has been validated.') +
      '</div></div>' +
      (uniqAreas.length
        ? '<div class="of-card"><div class="oc-kind"><span>Potential intervention areas · hypotheses</span><span class="oc-id">tentative</span></div>' +
          '<div class="of-rp-narr">' + esc(uniqAreas.join(', ')) + ' — possibilities to explore, not recommendations. No score, no ranking.</div></div>'
        : '') +
      '<div id="of-roles"></div>' +
      '<p class="of-foot-note" style="border:none;padding-top:8px">The full required / current / gap table is in the <a href="../studio/missions.html">Mission admin</a>.</p>';
    explainRoles(org, mis);
  }

  // Aeon1 discusses role PURPOSE before title (1F).
  function explainRoles(org, mis) {
    var box = document.getElementById('of-roles');
    if (!box || !OF.role) return;
    OF.role.syncHypotheses(mis.mission_id);
    var data = OF.role.getForMission(mis.mission_id);
    var open = data.hypotheses.filter(function (h) { return !h.promoted_role_id; });
    if (!open.length) {
      box.innerHTML = '<div class="of-rp-aeon" style="margin-top:20px"><div class="of-who2">Aeon1</div><div class="of-rp-say">Not every gap is a hire. On what is validated, these gaps point to other interventions — so I am not proposing a role yet. A role only appears when a gap is best closed by a person.</div></div>';
      return;
    }
    var dim = open[0].dimension;
    var titles = open.filter(function (h) { return h.dimension === dim; }).map(function (h) { return h.role_name; });
    box.innerHTML =
      '<div class="of-spine-head" style="margin-top:28px">Gap → role · purpose first</div>' +
      '<div class="of-rp-aeon"><div class="of-who2">Aeon1</div><div class="of-rp-say">' +
        'We currently believe ' + esc(dim.toLowerCase()) + ' may be limiting this mission. One possible intervention is creating or strengthening a role whose <em>purpose</em> is to raise it — to build the capability between where the organization is and where the mission needs it to be. ' +
        'The title is secondary. Possible shapes: ' + esc(titles.join(', ')) + '. Each is a hypothesis, not a requisition.' +
      '</div></div>' +
      '<p class="of-foot-note" style="border:none;padding-top:6px">Define a role from these in the <a href="../studio/missions.html">Mission admin</a> — purpose is written before the title. Once a role is defined, two journeys open: a free <em>Fast Lane</em> to begin quickly, or a paid <em>Deep Lane</em> to understand first — generate a <a href="../studio/mandates.html">mandate</a> from either.</p>';
  }

  function summarizeValidation(done) {
    if (!done.length) return 'There was nothing pressing to validate yet.';
    var sup = done.filter(function (d) { return d.response === 'accurate'; }).length;
    var con = done.filter(function (d) { return d.response === 'inaccurate'; }).length;
    var und = done.filter(function (d) { return d.understanding; }).length;
    return 'Thank you — ' + sup + ' confirmed, ' + con + ' corrected' + (und ? ', ' + und + ' now held as understanding' : '') + '.';
  }

  function firstClause(s) {
    if (!s) return '';
    var m = String(s).match(/^[^.]+\./);
    return m ? m[0] : s;
  }

  // ---- Go ----------------------------------------------------
  start();
})();
