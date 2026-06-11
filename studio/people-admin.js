/* =============================================================
   people-admin.js — Studio · the Person Frequency Engine view  (1G)
   =============================================================
   Reads the shared OF store (of.runtime.v1) that the Aeon1
   person-discovery flow writes to, and renders, per person, the
   full promotion path with nothing hidden:

       Person
       Evidence            (atomic, from conversation)
       Hypotheses          (per dimension — validate inline)
       Validations         (history)
       Validated Understanding
       Person Frequency    (derived from understanding only)
       Confidence
       Promotion History

   The admin should clearly show Evidence → Understanding → Frequency.
   No matching, no resonance, no fit scores, no personality types.
   ============================================================= */
(function () {
  'use strict';
  var OF = window.OF;
  var P = OF.person;

  var listEl  = document.getElementById('px-list');
  var statsEl = document.getElementById('px-stats');

  function esc(s) {
    return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function human(l) { return P.human(l); }
  function lcfirst(s) { return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }
  function confLabel(c) {
    if (c == null) return '—';
    if (c >= 0.66) return 'high';
    if (c >= 0.4) return 'medium';
    return 'low';
  }

  function render() {
    var store = P.ensure(OF.load());
    var people = P.getPeople(store);

    var nEv = (store.person_evidence || []).length;
    var nHyp = (store.person_hypotheses || []).length;
    var nUnd = (store.validated_person_understandings || []).length;
    var nFreq = (store.person_frequencies || []).filter(function (f) {
      return (f.dimensions || []).some(function (d) { return d.level !== 'unknown'; });
    }).length;
    statsEl.innerHTML =
      '<span><b>' + people.length + '</b> ' + (people.length === 1 ? 'person' : 'people') + '</span>' +
      '<span><b>' + nEv + '</b> evidence</span>' +
      '<span><b>' + nHyp + '</b> hypothes' + (nHyp === 1 ? 'is' : 'es') + '</span>' +
      '<span><b>' + nUnd + '</b> understanding' + (nUnd === 1 ? '' : 's') + '</span>' +
      '<span><b>' + nFreq + '</b> with frequency</span>';

    if (!people.length) {
      listEl.innerHTML =
        '<div class="px-empty">No people understood yet.<br>' +
        'Run a <a href="../frequency/person.html">person discovery</a>, or load a mock example above.</div>';
      return;
    }
    listEl.innerHTML = people.map(function (p) { return renderPerson(p.person_id); }).join('');
  }

  function renderPerson(personId) {
    var d = P.getForPerson(personId);
    var p = d.person;
    if (!p) return '';
    var isMock = p.source === 'mock_example';

    var pills =
      pill(p.career_stage) +
      pill('source: ' + p.source, 'mute');

    /* ---- top grid: identity + promotion chain ---- */
    var identity =
      '<div class="px-cell">' +
        '<div class="px-label">Person · identity</div>' +
        kv('Name', '<em>' + esc(p.name || 'Unnamed') + '</em>') +
        (p.current_title ? kv('Doing now', esc(p.current_title) + (p.current_company ? ' · ' + esc(p.current_company) : '')) : '') +
        kv('Career stage', '<span class="px-pill">' + esc(p.career_stage) + '</span>') +
        (p.location ? kv('Location', esc(p.location)) : '') +
        (p.email ? kv('Email', esc(p.email)) : '') +
      '</div>';

    var known = (d.person_frequency && d.person_frequency.dimensions || []).filter(function (x) { return x.level !== 'unknown'; });
    var chain =
      '<div class="px-cell">' +
        '<div class="px-label">Promotion path · no shortcuts</div>' +
        '<div class="px-chain">' +
          '<b>' + d.evidence.length + '</b> evidence<br>' +
          '↓<br>' +
          '<b>' + d.hypotheses.length + '</b> hypothes' + (d.hypotheses.length === 1 ? 'is' : 'es') + '<br>' +
          '↓<br>' +
          '<b>' + d.validations.length + '</b> validation' + (d.validations.length === 1 ? '' : 's') + '<br>' +
          '↓<br>' +
          '<b>' + d.understandings.length + '</b> validated understanding<br>' +
          '↓<br>' +
          '<b>' + known.length + '</b> of ' + P.DIMENSIONS.length + ' dimensions of person frequency' +
        '</div>' +
      '</div>';

    return '<div class="px-person' + (isMock ? ' is-mock' : '') + '">' +
      '<div class="px-ptop">' +
        '<div>' +
          '<div class="px-pname">' + esc(p.name || 'Unnamed person') + '</div>' +
          '<div class="px-pid">' + esc(p.person_id) + ' · ' + esc((p.created_at || '').slice(0, 10)) + '</div>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:10px">' +
          (isMock ? '<span class="px-mock-tag">mock</span>' : '') +
          '<div class="px-pills">' + pills + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="px-grid">' + identity + chain + '</div>' +
      buildEvidence(d) +
      buildHypotheses(d) +
      buildUnderstanding(d) +
      buildFrequency(d) +
      buildPromotionHistory(d) +
    '</div>';
  }

  /* ---- Evidence ---- */
  function buildEvidence(d) {
    if (!d.evidence.length) return '';
    var rows = d.evidence.map(function (e) {
      var dims = (e.dimensions || []).map(function (x) { return '<span class="dim">' + esc(x) + '</span>'; }).join(' · ');
      return '<div class="px-ev"><div class="et">' + esc(e.statement) + '</div>' +
        '<div class="em2">' + esc(e.source) + ' · ' + esc(confLabel(e.confidence)) + ' confidence' +
        (dims ? ' · ' + dims : '') + '</div></div>';
    }).join('');
    return '<div class="px-sect alt">' +
      '<div class="px-label">Evidence · atomic, from conversation</div>' +
      '<div class="px-fsum" style="color:var(--px-ink4)">Cheap, plentiful, low-commitment. Evidence never becomes frequency directly — it must pass through hypothesis, validation and understanding.</div>' +
      rows +
    '</div>';
  }

  /* ---- Hypotheses (with inline validation) ---- */
  function buildHypotheses(d) {
    if (!d.hypotheses.length) return '';
    var rows = d.hypotheses.slice().sort(function (a, b) { return b.confidence - a.confidence; }).map(function (h) {
      var btns = '<div class="px-hbtns">' +
        hbtn(h.hypothesis_id, 'accurate', 'Accurate') +
        hbtn(h.hypothesis_id, 'partially', 'Partially') +
        hbtn(h.hypothesis_id, 'inaccurate', 'Inaccurate') +
        hbtn(h.hypothesis_id, 'unsure', 'Unsure') +
      '</div>';
      return '<div class="px-hrow ' + esc(h.status) + '">' +
        '<div class="px-hstate">We currently believe <em>' + esc(lcfirst(h.statement)) + '</em></div>' +
        '<div class="px-hmeta">' +
          '<span class="px-status ' + esc(h.status) + '">' + esc(h.status) + '</span>' +
          '<span class="px-pill mute">' + esc(h.dimension) + '</span>' +
          '<span class="px-pill mute">read: ' + esc(human(h.level)) + '</span>' +
          '<span class="px-conf">conf <b>' + esc(confLabel(h.confidence)) + '</b></span>' +
        '</div>' +
        btns +
      '</div>';
    }).join('');
    var untested = d.hypotheses.filter(function (h) { return h.status === 'untested'; }).length;
    var next = untested
      ? untested + ' read' + (untested === 1 ? '' : 's') + ' still untested — reflect each back to the person before it can become understanding.'
      : 'All reads have been put to the person at least once.';
    return '<div class="px-sect">' +
      '<div class="px-label">Hypotheses · reflective reads, one per dimension</div>' +
      '<div class="px-fsum" style="color:var(--px-ink4)">A read on a single dimension, inferred from evidence. Validate as the person (self) — accurate adds confidence toward understanding; inaccurate keeps it a hypothesis. Nothing becomes truth automatically.</div>' +
      rows +
      '<div class="px-vnext"><b>Next validation:</b> ' + esc(next) + '</div>' +
    '</div>';
  }

  /* ---- Validated Understanding ---- */
  function buildUnderstanding(d) {
    if (!d.understandings.length) {
      return '<div class="px-sect alt">' +
        '<div class="px-label">Validated understanding</div>' +
        '<div class="px-fsum" style="color:var(--px-ink4)">None yet. A hypothesis becomes understanding only when the person confirms it as <em>accurate</em> and confidence crosses the threshold (' + P.UNDERSTANDING_THRESHOLD + ').</div>' +
      '</div>';
    }
    var rows = d.understandings.map(function (u) {
      return '<div class="px-und"><div class="ut">' + esc(u.statement) + '</div>' +
        '<div class="um">' + esc(u.dimension) + ' · ' + esc(human(u.level)) + ' · ' + esc(confLabel(u.confidence)) +
        ' confidence · ' + u.supporting_validations.length + ' validation' + (u.supporting_validations.length === 1 ? '' : 's') +
        ' · promoted past threshold ' + P.UNDERSTANDING_THRESHOLD + '</div></div>';
    }).join('');
    return '<div class="px-sect alt">' +
      '<div class="px-label">Validated understanding · earned, per dimension</div>' +
      rows +
    '</div>';
  }

  /* ---- Person Frequency ---- */
  function buildFrequency(d) {
    var pf = d.person_frequency;
    if (!pf) {
      return '<div class="px-sect">' +
        '<div class="px-label">Person Frequency</div>' +
        '<div class="px-fsum" style="color:var(--px-ink4)">Not derived yet — validate at least one hypothesis. Person Frequency reads only from validated understanding.</div>' +
      '</div>';
    }
    var known = (pf.dimensions || []).filter(function (x) { return x.level !== 'unknown'; });
    var rows = (pf.dimensions || []).map(function (g) {
      var unknown = g.level === 'unknown';
      return '<div class="px-frow">' +
        '<div class="dn">' + esc(g.dimension) + '</div>' +
        '<div class="lv' + (unknown ? ' unknown' : '') + '">' + esc(human(g.level)) + '</div>' +
        '<div><span class="px-gpc ' + esc(confLabel(g.confidence)) + '">' + esc(confLabel(g.confidence)) + ' conf</span></div>' +
        '<div class="px-fev">' + esc(g.evidence) + '</div>' +
      '</div>';
    }).join('');
    return '<div class="px-sect">' +
      '<div class="px-label">Person Frequency · explanation, not a scorecard</div>' +
      '<div class="px-fsum"><b>Summary:</b> ' + esc(pf.frequency_summary) + '</div>' +
      '<div class="px-ftable">' +
        '<div class="px-fhead"><div>Dimension</div><div>Level (validated)</div><div>Confidence</div></div>' +
        rows +
      '</div>' +
      '<div class="px-conf-line">Person frequency confidence · <b>' + esc(confLabel(pf.confidence)) +
        '</b> · ' + known.length + ' of ' + (pf.dimensions || []).length + ' dimensions validated · no scores, no ranking</div>' +
      '<div class="px-noscore">no score · no percentage · no personality type · a dimension reads only once validated</div>' +
    '</div>';
  }

  /* ---- Promotion History ---- */
  function buildPromotionHistory(d) {
    if (!d.understandings.length) return '';
    var rows = d.understandings.slice().sort(function (a, b) {
      return (b.updated_at || '').localeCompare(a.updated_at || '');
    }).map(function (u) {
      return '<div class="px-plog"><div class="pt">' + esc(u.dimension) + ' → <em>' + esc(human(u.level)) + '</em> · understanding</div>' +
        '<div class="pm">evidence → hypothesis → validation → understanding → frequency · ' +
        esc(confLabel(u.confidence)) + ' conf · ' + esc((u.updated_at || u.created_at || '').slice(0, 10)) + '</div></div>';
    }).join('');
    return '<div class="px-sect alt">' +
      '<div class="px-label">Promotion history · evidence → understanding → frequency</div>' +
      rows +
    '</div>';
  }

  function hbtn(id, r, label) {
    return '<button class="px-hbtn" type="button" data-pval="' + esc(id) + '" data-r="' + r + '">' + esc(label) + '</button>';
  }
  function kv(k, v) {
    return '<div class="px-kv"><div class="k">' + esc(k) + '</div><div class="v">' + v + '</div></div>';
  }
  function pill(text, cls) {
    return '<span class="px-pill ' + (cls || '') + '">' + esc(text) + '</span>';
  }

  /* ---- Mock example — fully validated, end to end ---------- */
  function seedExample() {
    var p = P.createPerson({
      name: 'Marcus Vela',
      current_title: 'Senior backend engineer',
      current_company: 'a logistics scale-up',
      career_stage: 'senior',
      source: 'mock_example'
    });
    var EV = [
      { dims: ['Innovation Requirement', 'Pace'], text: 'I lose track of time building new systems from scratch — greenfield, ambiguous, net-new problems where nobody has the answer yet.' },
      { dims: ['Process Maturity', 'Execution Discipline'], text: 'I want just enough structure to stay oriented, but heavy process boxes me in. I keep my own discipline and follow through without being chased.' },
      { dims: ['Autonomy Level'], text: 'I need real ownership — leave me to run my own work and trust me to decide. Micromanagement kills it for me.' },
      { dims: ['Pressure Tolerance', 'Pace'], text: 'When timelines compress I get sharper, not rattled. A fast pace energises me more than it overwhelms me.' },
      { dims: ['Communication Style', 'Execution Discipline'], text: 'Teams that talk around problems frustrate me. I value direct, candid people who say what they mean and finish what they start.' },
      { dims: ['Leadership Style', 'People Development Orientation'], text: 'I do my best under leaders who set a clear direction then get out of the way. I like mentoring juniors and seeing them grow.' },
      { dims: ['Trust / Goodness Layer'], text: 'I have to trust the people and that the place has real integrity before I give it everything.' }
    ];
    EV.forEach(function (e) {
      P.ingestEvidence(p.person_id, { source: 'conversation', statement: e.text, dimensions: e.dims, confidence: 0.5 });
    });
    P.syncHypotheses(p.person_id);
    // validate the strongest reads as the person — drives the full chain
    var queue = P.nextToValidate(p.person_id);
    queue.forEach(function (h, i) {
      // confirm most, correct one, leave one mixed — a realistic trail
      var r = (i === queue.length - 1) ? 'inaccurate' : (i === 1 ? 'partially' : 'accurate');
      P.recordValidation(h.hypothesis_id, r, 'self');
    });
    render();
  }

  document.getElementById('px-seed-example').addEventListener('click', seedExample);
  document.getElementById('px-reset').addEventListener('click', function () {
    if (confirm('Clear all people on this device? Discovered people, evidence, hypotheses, validations, understanding and frequencies will be removed.')) {
      var store = P.ensure(OF.load());
      store.persons = [];
      store.person_evidence = [];
      store.person_hypotheses = [];
      store.person_validations = [];
      store.validated_person_understandings = [];
      store.person_frequencies = [];
      OF.save(store);
      render();
    }
  });

  // Validate a person hypothesis inline (delegated)
  listEl.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.px-hbtn[data-pval]');
    if (!btn) return;
    var id = btn.getAttribute('data-pval');
    var r = btn.getAttribute('data-r');
    P.recordValidation(id, r, 'self');
    render();
  });

  render();
})();
