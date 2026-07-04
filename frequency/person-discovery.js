/* =============================================================
   Organizational Frequency — Person Discovery controller (1G)
   =============================================================
   Aeon1 guides a person through reflective discovery, then
   validates its own reads with them, then derives a Person
   Frequency — entirely in isolation. No mission, no role, no
   organization, no matching, no resonance.

   Flow:
     1. who are you (identity — light)
     2. seven reflective discovery questions   → Person Evidence
     3. Evidence → Hypotheses                   (per dimension)
     4. Aeon1 validates the strongest reads     → Validated Understanding
     5. Person Frequency derived from validated understanding only

   The promotion path has no shortcuts and nothing becomes truth
   automatically. Discovery is reflective, never an assessment.
   ============================================================= */
(function () {
  'use strict';
  var OF = window.OF;
  var P = OF.person;

  var OPENING =
    "I'm Aeon1. Before any role or any match, I want to understand you on your own — " +
    "the way you actually work and what brings out your best. This isn't a test, and " +
    "there's no score at the end. A few reflective questions. Answer them however feels true.";

  // Identity first (light), then the reflective discovery questions.
  var IDENTITY = { key: 'identity',
    q: 'First — who are you? Your name, and what you do right now.',
    placeholder: 'e.g. I’m Priya, a senior product designer at a fintech startup…' };

  var STEPS = [IDENTITY].concat(P.DISCOVERY);

  var RECEIPTS = [
    'Good to meet you.',
    'That tells me something about what energises you.',
    'Noted — that’s about the structure you want around you.',
    'I hear how much room you need.',
    'That’s useful — how pressure lands on you.',
    'Understood — what grinds against your way of working.',
    'That says a lot about the leadership you need and give.'
  ];

  var raw = {};
  var stepIndex = 0;
  var person = null;

  var stream   = document.getElementById('stream');
  var composer = document.getElementById('composer');
  var input    = document.getElementById('input');
  var send     = document.getElementById('send');
  var ticks    = document.getElementById('ticks').querySelectorAll('.of-tick');
  var spineEl  = document.getElementById('spine');

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(s) {
    return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  // Keep the latest message in view as the conversation grows.
  function scrollToBottom() {
    requestAnimationFrame(function () {
      try { window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); }
      catch (e) { window.scrollTo(0, document.body.scrollHeight); }
    });
  }
  function aeonTurn(text) {
    var t = el('div', 'of-turn aeon');
    t.appendChild(el('div', 'of-who', 'Aeon1'));
    t.appendChild(el('div', 'of-said', text));
    stream.appendChild(t);
    scrollToBottom();
  }
  function readerTurn(text) {
    var t = el('div', 'of-turn reader');
    t.appendChild(el('div', 'of-who', 'You'));
    t.appendChild(el('div', 'of-said', esc(text)));
    stream.appendChild(t);
    scrollToBottom();
  }
  function thinking() {
    var t = el('div', 'of-turn aeon');
    var d = el('div', 'of-thinking');
    d.appendChild(el('span')); d.appendChild(el('span')); d.appendChild(el('span'));
    t.appendChild(d);
    stream.appendChild(t);
    scrollToBottom();
    return t;
  }
  function holdComposer(ms) {
    composer.classList.add('is-held');
    setTimeout(function () {
      composer.classList.remove('is-held');
      input.focus();
    }, ms || 800);
  }
  function setTicks() {
    ticks.forEach(function (t, i) {
      t.classList.remove('is-done', 'is-now');
      if (i < stepIndex) t.classList.add('is-done');
      else if (i === stepIndex) t.classList.add('is-now');
    });
  }

  function start() {
    aeonTurn(OPENING);
    setTimeout(function () { askStep(); }, 1200);
  }
  function askStep() {
    setTicks();
    var step = STEPS[stepIndex];
    aeonTurn(step.q);
    input.placeholder = step.placeholder;
    holdComposer(700);
  }

  function submit() {
    var text = input.value.trim();
    if (!text || composer.classList.contains('is-held')) return;
    var step = STEPS[stepIndex];
    raw[step.key] = text;
    readerTurn(text);
    input.value = '';
    autosize();

    // First answer is identity — create the person; later answers are evidence.
    if (step.key === 'identity') {
      person = P.createPerson(parseIdentity(text));
    } else {
      P.ingestEvidence(person.person_id, {
        source: 'conversation',
        statement: text,
        dimensions: step.dimensions || [],
        confidence: 0.45
      });
    }

    stepIndex += 1;

    if (stepIndex < STEPS.length) {
      composer.classList.add('is-held');
      var receipt = RECEIPTS[stepIndex - 1];
      setTimeout(function () {
        if (receipt) aeonTurn(receipt);
        setTimeout(askStep, receipt ? 650 : 0);
      }, 480);
    } else {
      setTicks();
      composer.classList.add('is-held');
      assemble();
    }
  }

  // Light, deterministic identity parse — name + title + company.
  function parseIdentity(text) {
    var name = '', title = '', company = '';
    var m = text.match(/\bi(?:'m| am)\s+([A-Z][a-z]+)\b/i);
    if (m) name = m[1];
    var t = text.match(/\b(?:a|an)\s+([^,.\n]+?)(?:\s+(?:at|for|with|@)\s+([^,.\n]+))?[.,\n]/i);
    if (!t) t = text.match(/\b(?:a|an)\s+([^,.\n]+?)(?:\s+(?:at|for|with|@)\s+([^,.\n]+))?$/i);
    if (t) {
      title = (t[1] || '').trim();
      company = (t[2] || '').trim();
    }
    return {
      name: name,
      current_title: title,
      current_company: company,
      career_stage: P.inferStage(title),
      source: 'discovery'
    };
  }

  function assemble() {
    var th = thinking();
    // Live AI forms a read per dimension from the answers; deterministic fallback never fails.
    aiReads().then(function (reads) {
      if (!applyAIReads(reads)) P.syncHypotheses(person.person_id);
      finishAssemble(th);
    }).catch(function () {
      P.syncHypotheses(person.person_id);
      finishAssemble(th);
    });
  }

  function finishAssemble(th) {
    if (th) th.remove();
    aeonTurn('Thank you — that’s enough to begin. From what you’ve told me I’ve formed a few <em>reads</em> about how you work. None of them are conclusions. Let me reflect each one back and you tell me how true it feels.');
    composer.classList.add('hidden');
    setTimeout(renderUnderstanding, 900);
  }

  // ---- Live AI: turn the reflective answers into a read per dimension ----
  function aiReads() {
    return new Promise(function (resolve, reject) {
      if (!(window.claude && typeof window.claude.complete === 'function')) return reject(new Error('no ai'));
      var dims = P.DIMENSIONS;
      var sys = [
        'You are Aeon1, a reflective analyst forming an outside-in read of how ONE person works, from their own words.',
        'You are given a short self-description and answers to reflective questions. For EACH of these dimensions, infer a read:',
        dims.join(', ') + '.',
        'For every dimension return: "level" (one of: low | moderate | high | very_high), a one-sentence reflective "statement" written to complete the phrase "We currently believe: <statement>" (e.g. "you do your best work at a fast, urgent pace"), and a "confidence" 0..1.',
        'Be humble and specific to what they actually said. If a dimension is thinly supported, lower the confidence (<= 0.4) but still give your best read. Never invent facts about their employer.',
        'Return STRICT JSON only — no prose, no code fences:',
        '{ "reads": [ { "dimension": "<exact dimension name>", "level": "...", "statement": "...", "confidence": 0.0 } ] }'
      ].join('\n');
      var user = 'PERSON: ' + (raw.identity || '') + '\n\nREFLECTIVE ANSWERS:\n' +
        P.DISCOVERY.map(function (d, i) { return (i + 1) + '. ' + d.q + '\n' + (raw[d.key] || '(no answer)'); }).join('\n\n');
      var done = false;
      var guard = setTimeout(function () { if (!done) { done = true; reject(new Error('timeout')); } }, 18000);
      window.claude.complete({ system: sys, messages: [{ role: 'user', content: user }] }).then(function (reply) {
        if (done) return; done = true; clearTimeout(guard);
        try {
          var m = String(reply).match(/\{[\s\S]*\}/);
          var json = m ? JSON.parse(m[0]) : null;
          resolve((json && json.reads) || []);
        } catch (e) { reject(e); }
      }).catch(function (e) { if (!done) { done = true; clearTimeout(guard); reject(e); } });
    });
  }

  // Create one hypothesis per dimension from the AI reads. Returns count created.
  function applyAIReads(reads) {
    if (!reads || !reads.length) return 0;
    var store = P.ensure(OF.load());
    var dimsLower = {};
    P.DIMENSIONS.forEach(function (d) { dimsLower[d.toLowerCase()] = d; });
    var existing = {};
    store.person_hypotheses.forEach(function (h) { if (h.person_id === person.person_id) existing[h.dimension] = true; });
    var n = 0;
    reads.forEach(function (r) {
      if (!r || !r.dimension) return;
      var dim = dimsLower[String(r.dimension).toLowerCase().trim()];
      if (!dim || existing[dim]) return;
      var h = P.newPersonHypothesis({
        person_id: person.person_id,
        dimension: dim,
        level: r.level,
        statement: String(r.statement || '').trim() || ('a particular pattern in ' + dim.toLowerCase()),
        confidence: typeof r.confidence === 'number' ? r.confidence : 0.45
      });
      store.person_hypotheses.push(h); existing[dim] = true; n++;
    });
    if (n) OF.save(store);
    return n;
  }

  // Render the discovery summary shell, then run validation.
  function renderUnderstanding() {
    var data = P.getForPerson(person.person_id);
    spineEl.innerHTML =
      '<div class="of-spine-head">Person · understood in isolation</div>' +
      '<div class="of-spine-title">' + esc(person.name || 'You') +
        ' — a complete entity, built before any comparison.</div>' +

      '<div class="of-cards">' +
        card('Person', person.person_id, esc(person.name || 'Unnamed'), [
          person.current_title ? row('Doing now', esc(person.current_title) + (person.current_company ? ' · ' + esc(person.current_company) : '')) : '',
          row('Career stage', '<span class="of-pill">' + esc(person.career_stage) + '</span>'),
          row('Evidence', '<span class="of-pill">' + data.evidence.length + ' from conversation</span>'),
          row('Reads formed', '<span class="of-pill">' + data.hypotheses.length + ' hypotheses</span>')
        ]) +
      '</div>' +

      '<div class="of-spine-head" style="margin-top:26px">Validating · with you</div>' +
      '<div class="of-rp-aeon"><div class="of-who2">Aeon1</div><div class="of-rp-say">' +
        'Each answer is recorded as a <em>validation</em>, not an assumption. What you confirm becomes ' +
        'validated understanding; what you correct stays a hypothesis.</div></div>' +
      '<div id="of-validate"></div>';
    spineEl.classList.remove('hidden');
    startValidation();
  }

  function startValidation() {
    var box = document.getElementById('of-validate');
    var queue = P.nextToValidate(person.person_id, 12);
    renderValidationStep(box, queue, 0, []);
  }

  function renderValidationStep(box, queue, i, done) {
    if (i >= queue.length) {
      box.innerHTML =
        '<div class="of-rp-aeon"><div class="of-who2">Aeon1</div><div class="of-rp-say">' +
          esc(summarize(done)) + ' Only what you confirmed is held as understanding — and only that ' +
          'feeds your <em>frequency</em> below. Nothing was treated as fact on its own.</div></div>' +
        '<div id="of-freq"></div>';
      renderFrequency();
      return;
    }
    var h = queue[i];
    box.innerHTML =
      '<div class="of-vcard">' +
        '<div class="of-vq">We currently believe: <em>' + esc(lcfirst(h.statement)) + '</em></div>' +
        '<div class="of-vsub">Does that feel accurate?</div>' +
        '<div class="of-vbtns">' +
          '<button class="of-cbtn" type="button" data-r="accurate">Accurate</button>' +
          '<button class="of-cbtn" type="button" data-r="partially">Partially</button>' +
          '<button class="of-cbtn" type="button" data-r="inaccurate">Inaccurate</button>' +
          '<button class="of-cbtn" type="button" data-r="unsure">Unsure</button>' +
        '</div>' +
        '<div class="of-vmeta">' + (i + 1) + ' of ' + queue.length + ' · ' + esc(h.dimension) +
          ' · recorded as a validation · source: you (self)</div>' +
      '</div>';
    Array.prototype.forEach.call(box.querySelectorAll('.of-cbtn'), function (b) {
      b.addEventListener('click', function () {
        var r = b.getAttribute('data-r');
        var res = P.recordValidation(h.hypothesis_id, r, 'self');
        done.push({ statement: h.statement, response: r, understanding: res && res.understanding });
        renderValidationStep(box, queue, i + 1, done);
      });
    });
  }

  function renderFrequency() {
    var box = document.getElementById('of-freq');
    if (!box) return;
    var pf = P.derivePersonFrequency(person.person_id);
    var known = (pf.dimensions || []).filter(function (d) { return d.level !== 'unknown'; });

    var rows = (pf.dimensions || []).map(function (d) {
      var unknown = d.level === 'unknown';
      return '<div class="of-dim">' +
        '<div class="of-dim-name">' + esc(d.dimension) + '</div>' +
        '<div class="of-dim-est"' + (unknown ? ' style="color:var(--ink-4)"' : '') + '>' + esc(P.human(d.level)) + '</div>' +
        '<div class="of-dim-conf"' + (unknown ? ' style="color:var(--ink-4);border-color:var(--rule-edge)"' : '') + '>' + esc(confLabel(d.confidence)) + '</div>' +
      '</div>';
    }).join('');

    box.innerHTML =
      '<div class="of-spine-head" style="margin-top:30px">Person Frequency · from validated understanding only</div>' +
      '<div class="of-rp-aeon"><div class="of-who2">Aeon1</div><div class="of-rp-say">' + esc(pf.frequency_summary) + '</div></div>' +

      '<div class="of-card"><div class="oc-kind"><span>Person Frequency · 10 dimensions</span>' +
        '<span class="oc-id">' + known.length + ' of ' + (pf.dimensions || []).length + ' validated</span></div>' +
        '<div class="of-dims">' + rows + '</div>' +
        '<div class="of-dim-foot">No score, no percentage, no personality type. A dimension reads only once ' +
          'you have validated it — everything else stays <em>unknown</em> by design. Evidence never becomes ' +
          'frequency directly; it must pass through hypothesis, validation, and understanding first.</div></div>' +

      '<p class="of-foot-note">' +
        'Recorded. The runtime now understands a person the same way it understands an organization — and still ' +
        'performs no matching. Resonance, where a validated person frequency meets a validated role frequency, ' +
        'belongs to a later build.' +
      '</p>' +
      '<button class="of-restart" id="restart" type="button">Discover another person</button>';

    var rb = document.getElementById('restart');
    if (rb) rb.addEventListener('click', function () { window.location.reload(); });
  }

  function summarize(done) {
    if (!done.length) return 'There was nothing to reflect back yet.';
    var sup = done.filter(function (d) { return d.response === 'accurate'; }).length;
    var con = done.filter(function (d) { return d.response === 'inaccurate'; }).length;
    var und = done.filter(function (d) { return d.understanding; }).length;
    return 'Thank you — ' + sup + ' confirmed, ' + con + ' corrected' +
      (und ? ', ' + und + ' now held as understanding' : '') + '.';
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
  function lcfirst(s) { return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }
  function confLabel(c) {
    if (c == null) return '—';
    if (c >= 0.66) return 'high';
    if (c >= 0.4) return 'medium';
    return 'low';
  }

  function autosize() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 180) + 'px';
  }
  input.addEventListener('input', autosize);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  });
  send.addEventListener('click', submit);

  start();
})();
