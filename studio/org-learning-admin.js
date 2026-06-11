/* Organizational Learning Engine (Build 3F)
   Renders OF.orglearning over the shared of.runtime.v1 store.
   Cross-organizational pattern extraction. Observer only — no causal claims. */
(function () {
  'use strict';
  if (!window.OF || !window.OF.orglearning) { console.warn('org-learning-admin.js requires of-org-learning.js'); return; }
  var L = window.OF.orglearning;

  var viewEl = document.getElementById('ol-view');
  var statsEl = document.getElementById('ol-stats');
  var toastEl = document.getElementById('ol-toast');

  var tab = 'patterns';

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function titleCase(s) { return String(s || '').replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }
  function dimLabel(d) { return L.dimLabel(d); }
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(function () { toastEl.classList.remove('show'); }, 2800); }
  function confLabel(c) { return titleCase(c); }

  function render() {
    var s = L.snapshot();
    renderStats(s);
    var html = tabsBar(s);
    if (!s.counts.observations) {
      html += '<div class="ol-empty">No cross-organizational learning yet.<br>Run <em>Observe across organizations</em> to gather observations from every tracked evolution path, then <em>Extract patterns</em> to learn from them.<br><br>Need data first? Build evolution paths in <a href="evolution-engine.html">Evolution (3E)</a> for two or more companies.</div>';
    } else {
      if (tab === 'patterns') html += patternsView(s);
      else if (tab === 'failures') html += failuresView(s);
      else if (tab === 'insights') html += insightsView(s);
      else if (tab === 'observations') html += observationsView(s);
    }
    viewEl.innerHTML = html;
    wire();
  }

  function renderStats(s) {
    var c = s.counts;
    statsEl.innerHTML =
      stat(c.organizations, 'Organizations') +
      stat(c.observations, 'Observations') +
      stat(c.patterns, 'Patterns') +
      stat(c.failures, 'Failure patterns') +
      stat(c.contradictory, 'Contradicted') +
      stat(c.insights, 'Insights');
  }
  function stat(n, l) { return '<div class="ol-stat"><div class="n">' + n + '</div><div class="l">' + l + '</div></div>'; }

  function tabsBar(s) {
    var c = s.counts;
    function t(key, label, n) { return '<button class="ol-tab ' + (tab === key ? 'on' : '') + '" data-tab="' + key + '">' + label + ' <span class="badge">' + n + '</span></button>'; }
    return '<div class="ol-tabs">' +
      t('patterns', 'Patterns', c.patterns) +
      t('failures', 'Failure Patterns', c.failures) +
      t('insights', 'Insights', c.insights) +
      t('observations', 'Observations', c.observations) +
      '</div>';
  }

  /* ---- PATTERNS (success / emerging / contradictory) ---- */
  function patternsView(s) {
    if (!s.patterns.length) return '<div class="ol-empty">No patterns extracted yet. Run <em>Extract patterns &amp; insights</em>.</div>';
    return s.patterns.map(function (p) {
      var det = L.patternDetail(p.pattern_id);
      return patternCard(p, det);
    }).join('');
  }

  function patternCard(p, det) {
    var seqs = det ? det.sequences : [];
    var conf = det ? det.confidence : null;
    var h = '<div class="ol-pat ' + p.pattern_type + '">' +
      '<div class="pmeta"><span class="pdim">' + esc(dimLabel(p.dimension)) + '</span>' +
      '<span class="ptype">' + titleCase(p.pattern_type) + '</span>' +
      '<span class="ol-cf ' + p.confidence + '">conf ' + confLabel(p.confidence) + '</span>' +
      '<span class="ol-samp">n = ' + p.sample_size + ' org' + (p.sample_size === 1 ? '' : 's') + '</span></div>' +
      '<div class="pn">' + esc(p.title) + '</div>' +
      '<div class="pd">' + esc(p.description) + '</div>';

    // most common sequence
    seqs.forEach(function (sq) {
      if (!sq.steps.length) return;
      h += '<div class="ol-seq"><span class="ol-seqlbl">Most commonly observed sequence · n = ' + sq.sample_size + '</span>';
      sq.steps.forEach(function (st, i) {
        if (i) h += '<span class="ol-stepar">→</span>';
        h += '<span class="ol-step">' + esc(st) + '</span>';
      });
      h += '<div class="ol-seqout">Observed outcome: ' + esc(sq.observed_outcome) + ' · ' + confLabel(sq.confidence) + ' confidence</div></div>';
    });

    // support / contradiction split — contradictions are first-class
    if (det && (det.supporting.length || det.contradicting.length)) {
      h += '<div class="ol-split">' +
        '<div class="ol-col"><div class="ol-colh sup">Supporting · ' + det.supporting.length + '</div>' +
        det.supporting.slice(0, 5).map(obLine).join('') + '</div>' +
        '<div class="ol-col"><div class="ol-colh con">Contradicting · ' + det.contradicting.length + '</div>' +
        (det.contradicting.length ? det.contradicting.slice(0, 5).map(function (o) { return obLine(o, true); }).join('') : '<div class="ol-ob" style="border-left-color:transparent;color:var(--ol-ink4)">None observed yet.</div>') +
        '</div></div>';
    }

    // confidence reasoning + history
    if (conf) h += '<div class="ol-reason">' + esc(conf.reasoning) + '</div>';
    if (p.confidence_history && p.confidence_history.length) {
      h += '<div class="ol-hist"><span class="ol-histlbl">Confidence history</span>' +
        p.confidence_history.map(function (snap) {
          return '<span class="ol-snap"><span class="s-n">n=' + snap.sample_size + '</span> · ' + confLabel(snap.confidence) + '</span>';
        }).join('<span class="ol-stepar">→</span>') + '</div>';
    }
    return h + '</div>';
  }
  function obLine(o, con) {
    if (!o) return '';
    return '<div class="ol-ob ' + (con ? 'con' : '') + '"><b>' + esc(o.company_name) + '</b> — ' + esc(o.observation) + '</div>';
  }

  /* ---- FAILURE PATTERNS ---- */
  function failuresView(s) {
    if (!s.failures.length) return '<div class="ol-empty">No failure patterns observed yet. These surface when tracked organizations show stalled or reversed progress on a dimension.</div>';
    return s.failures.map(function (fp) {
      var h = '<div class="ol-pat failure_pattern">' +
        '<div class="pmeta"><span class="pdim">' + esc(dimLabel(fp.dimension)) + '</span>' +
        '<span class="ptype">Failure Pattern</span>' +
        '<span class="ol-cf ' + fp.confidence + '">conf ' + confLabel(fp.confidence) + '</span>' +
        '<span class="ol-samp">n = ' + fp.sample_size + ' org' + (fp.sample_size === 1 ? '' : 's') + '</span></div>' +
        '<div class="pd">' + esc(fp.description) + '</div>';
      if (fp.observed_sequence && fp.observed_sequence.length) {
        h += '<div class="ol-seq"><span class="ol-seqlbl">Recurring failure shape</span>';
        fp.observed_sequence.forEach(function (st, i) {
          if (i) h += '<span class="ol-stepar">→</span>';
          h += '<span class="ol-step">' + esc(st) + '</span>';
        });
        h += '</div>';
      }
      return h + '</div>';
    }).join('');
  }

  /* ---- INSIGHTS ---- */
  function insightsView(s) {
    if (!s.insights.length) return '<div class="ol-empty">No insights yet. Insights are cross-dimension associations drawn from the pattern pool — extract patterns first.</div>';
    return s.insights.map(function (i) {
      return '<div class="ol-ins"><div class="it">' + esc(i.title) + '</div>' +
        '<div class="id">' + esc(i.description) + '</div>' +
        '<div class="im"><span class="ol-cf ' + i.confidence + '">conf ' + confLabel(i.confidence) + '</span>' +
        '<span class="ol-samp">' + (i.supporting_patterns.length) + ' supporting pattern(s)</span></div></div>';
    }).join('');
  }

  /* ---- OBSERVATIONS (the evidence base) ---- */
  function observationsView(s) {
    if (!s.observations.length) return '<div class="ol-empty">No observations yet.</div>';
    var rows = s.observations.map(function (o) {
      return '<tr><td><div class="co">' + esc(o.company_name) + '</div></td>' +
        '<td>' + esc(dimLabel(o.dimension)) + (o.gap_severity ? '<br><span class="ol-samp">' + esc(o.gap_severity) + ' gap</span>' : '') + '</td>' +
        '<td><span class="ol-miniseq">' + (o.sequence.length ? esc(o.sequence.join(' → ')) : '—') + '</span></td>' +
        '<td><span class="ol-out ' + o.outcome + '">' + o.outcome + '</span>' + (o.validated ? '<br><span class="ol-samp">validated</span>' : '') + '</td>' +
        '<td>' + (o.progress_pct != null ? o.progress_pct + '%' : '—') + '<br><span class="ol-samp">' + esc(o.trend) + '</span></td>' +
        '<td><span class="ol-cf ' + o.confidence + '">' + confLabel(o.confidence) + '</span></td></tr>';
    }).join('');
    return '<div class="ol-panel"><div class="ol-ptop"><span class="ol-plabel">Organizational Observations</span><span class="ol-pnote">the evidence base · every pattern traces back to these</span></div><div class="ol-pbody">' +
      '<div class="ol-tablewrap"><table class="ol-table"><thead><tr><th>Organization</th><th>Dimension</th><th>Observed sequence</th><th>Outcome</th><th>Progress</th><th>Conf.</th></tr></thead><tbody>' +
      rows + '</tbody></table></div></div>';
  }

  /* ============ EVENTS ============ */
  function wire() {
    each('[data-tab]', function (b) { b.addEventListener('click', function () { tab = b.getAttribute('data-tab'); render(); }); });
  }
  function each(sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), fn); }

  document.getElementById('ol-observe').addEventListener('click', function () {
    var res = L.observeAll();
    if (res.error) { toast(res.error); return; }
    toast('Observed ' + res.total + ' dimension-level outcome(s) across organizations (' + res.created + ' new, ' + res.updated + ' updated).');
    render();
  });
  document.getElementById('ol-learn').addEventListener('click', function () {
    var res = L.learn();
    if (res.error) { toast(res.error); return; }
    toast(res.patterns + ' patterns · ' + res.failures + ' failure patterns · ' + res.insights + ' insights extracted.');
    tab = 'patterns';
    render();
  });
  document.getElementById('ol-reset').addEventListener('click', function () {
    if (confirm('Reset all Organizational Learning data on this device? (Observations, patterns, sequences, failures, insights, confidence history.) Evolution paths and all upstream layers are NOT touched.')) {
      L.resetLearning(); toast('Learning reset.'); render();
    }
  });

  render();
})();
