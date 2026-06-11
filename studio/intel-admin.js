/* =============================================================
   intel-admin.js — Studio · Organizational Intelligence Dashboard
   =============================================================
   Add real public sources → see extracted signals → generate the
   Intelligence Brief. Every hypothesis traces to signals; every
   signal quotes its source; every confidence shows its reasoning.
   ============================================================= */
(function () {
  'use strict';
  var OF = window.OF;
  var I = OF.intel;
  var SEL = 'of.intel.selectedOrg';

  var pickEl = document.getElementById('iq-pick');
  var viewEl = document.getElementById('iq-view');

  function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function sel() { try { return localStorage.getItem(SEL); } catch (e) { return null; } }
  function setSel(o) { try { localStorage.setItem(SEL, o); } catch (e) {} }
  function val(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }

  function render() {
    var orgs = I.organizations();
    renderPick(orgs);
    if (!orgs.length) {
      viewEl.innerHTML = '<div class="iq-empty">No organizations yet. Capture a <a href="../frequency/index.html">mission</a> first (any organization with a mission can be researched), then return here to build its intelligence brief.</div>';
      return;
    }
    var orgId = sel() && orgs.some(function (o) { return o.organization_id === sel(); }) ? sel() : orgs[0].organization_id;
    setSel(orgId);
    renderView(orgId);
  }

  function renderPick(orgs) {
    if (!orgs.length) { pickEl.innerHTML = ''; return; }
    pickEl.innerHTML = '<div class="iq-field"><label>Organization</label><select id="iq-org">' +
      orgs.map(function (o) { return '<option value="' + esc(o.organization_id) + '"' + (o.organization_id === sel() ? ' selected' : '') + '>' + esc(o.name) + ' · ' + o.sources + ' source' + (o.sources === 1 ? '' : 's') + (o.brief ? ' · brief' : '') + '</option>'; }).join('') +
      '</select></div>';
  }

  function panel(label, cq, body, right) {
    return '<div class="iq-panel"><div class="iq-ptop"><div><div class="iq-plabel">' + esc(label) + '</div>' + (cq ? '<div class="iq-cq">' + esc(cq) + '</div>' : '') + '</div>' + (right || '') + '</div><div class="iq-pbody">' + body + '</div></div>';
  }

  function renderView(orgId) {
    var d = I.getIntel(orgId);
    viewEl.innerHTML = sourcesPanel(d) + signalsPanel(d) + briefPanel(d);
  }

  /* ---- sources ---- */
  function sourcesPanel(d) {
    var typeOpts = I.SOURCE_TYPES.map(function (t) { return '<option value="' + t + '">' + esc(t.replace(/_/g, ' ')) + '</option>'; }).join('');
    var form =
      '<div class="iq-srcform">' +
        '<select id="iq-stype">' + typeOpts + '</select>' +
        '<input id="iq-stitle" placeholder="Title (e.g. Careers page)">' +
        '<input id="iq-surl" placeholder="URL (optional)">' +
        '<textarea id="iq-stext" placeholder="Paste the real public text from this source — about page copy, a job description, a Glassdoor review, a news excerpt. Signals are extracted from exactly this text."></textarea>' +
        '<button class="iq-act primary" id="iq-addsrc" type="button">Add source &amp; extract signals</button>' +
      '</div>';
    var list = d.sources.length ? d.sources.map(function (s) {
      var observed = I.OBSERVED_SOURCES.indexOf(s.source_type) !== -1;
      var nsig = d.signals.filter(function (g) { return g.source_id === s.source_id; }).length;
      return '<div class="iq-src ' + (observed ? 'observed' : 'claim') + '">' +
        '<div><span class="st">' + esc(s.title || s.source_type.replace(/_/g, ' ')) + '</span> <span class="iq-q ' + esc(s.confidence) + '">' + esc(s.confidence) + (observed ? ' · observed' : ' · self-claim') + '</span>' +
          '<div class="sm">' + esc(s.source_type.replace(/_/g, ' ')) + ' · ' + nsig + ' signal' + (nsig === 1 ? '' : 's') + ' · ' + esc((s.retrieved_at || '').slice(0, 10)) + (s.url ? ' · ' + esc(s.url) : '') + '</div></div>' +
        '<button class="iq-act" data-delsrc="' + esc(s.source_id) + '" type="button">remove</button>' +
      '</div>';
    }).join('') : '<div class="iq-cq" style="font-style:normal;color:var(--iq-ink4)">No sources yet. Paste real public material above — the brief is only as good, and only as honest, as the sources behind it.</div>';
    return panel('Source Registry', 'Real public material — claim sources (about/careers) and observed sources (Glassdoor/news/job specs).', form + '<div style="margin-top:14px">' + list + '</div>');
  }

  /* ---- signals ---- */
  function signalsPanel(d) {
    if (!d.signals.length) return panel('Signals', 'Extracted from the source text — each quotes its evidence.', '<div class="iq-cq" style="font-style:normal;color:var(--iq-ink4)">No signals yet. Add a source with real text and signals are extracted automatically.</div>', '<span class="iq-q">' + 0 + '</span>');
    var html = '<div class="iq-sigcols">' + d.signals.map(function (g) {
      return '<div class="iq-sig"><div class="sgt">' + esc(g.signal_type.replace(/_/g, ' ')) + ' · ' + esc(g.confidence) + '</div>' +
        '<div class="sg">' + esc(g.signal) + '</div>' +
        '<div class="sge">' + esc(g.evidence) + '</div></div>';
    }).join('') + '</div>';
    return panel('Signals', 'Every signal traces to a source and quotes the sentence it came from.', html, '<span class="iq-q">' + d.signals.length + ' signals</span>');
  }

  /* ---- brief ---- */
  function briefPanel(d) {
    var gen = '<button class="iq-go" id="iq-genbrief" type="button">' + (d.brief ? 'Regenerate brief' : 'Generate intelligence brief →') + '</button>';
    if (!d.brief) {
      return panel('Organizational Intelligence Brief', 'The outside-in model — generated only from the signals above.',
        '<div class="iq-cq" style="font-style:normal;color:var(--iq-ink4)">Not generated yet. Add real sources, then generate. Every hypothesis will cite its signals; every confidence will state its reasoning.</div>', gen);
    }
    var b = d.brief;
    function hyp(label, h) {
      if (!h) return '';
      return '<div class="iq-hyp"><div class="hl">' + esc(label) + ' <span class="iq-q ' + esc(h.confidence) + '">' + esc(h.confidence) + '</span></div>' +
        '<div class="ht">' + esc(h.statement) + '</div>' +
        '<div class="hr"><b>traces to</b> ' + (h.signal_ids ? h.signal_ids.length : 0) + ' signal' + ((h.signal_ids && h.signal_ids.length === 1) ? '' : 's') + ' · ' + esc(h.reasoning || '') + '</div></div>';
    }
    var conf = '<div class="iq-conf"><div class="cl">Research confidence · explainable</div>' +
      '<div class="cb">' + esc(b.confidence.level) + '</div><div class="cr">' + esc(b.confidence.reasoning) + '</div></div>';

    var freqRows = '<div class="iq-frow"><div>Dimension</div><div>Estimate</div><div>Conf</div><div>Why</div></div>' +
      (b.frequency_hypothesis || []).map(function (f) {
        return '<div class="iq-frow"><div class="fd">' + esc(f.dimension) + '</div>' +
          '<div class="fe' + (/not observable/i.test(f.estimate) ? ' none' : '') + '">' + esc(f.estimate) + '</div>' +
          '<div class="iq-q ' + esc(f.confidence) + '" style="justify-self:start">' + esc(f.confidence) + '</div>' +
          '<div class="fr">' + esc(f.reasoning) + '</div></div>';
      }).join('');

    var contra = (b.contradiction_hypothesis || []).length ? (b.contradiction_hypothesis || []).map(function (c) {
      return '<div class="iq-contra ' + (c.severity === 'major' ? 'major' : '') + '"><div class="cd">' + esc(c.dimension) + ' · ' + esc(c.severity) + '</div>' +
        '<div class="cs"><b>Claim:</b> ' + esc(c.claim) + '<br><b>Observed:</b> ' + esc(c.observed) + '</div></div>';
    }).join('') : '<div class="iq-cq" style="font-style:normal;color:var(--iq-ink4)">No claim-vs-observed contradiction detected. Adding observed-reality sources (Glassdoor / news) would test the claims harder.</div>';

    var risks = (b.risk_hypothesis || []).map(function (r) { return '<div class="iq-sig"><div class="sg">' + esc(r.statement) + '</div>' + (r.evidence ? '<div class="sge">' + esc(r.evidence) + '</div>' : '') + '</div>'; }).join('');

    var vq = (b.validation_questions || []).map(function (q) { return '<div class="iq-vq"><div class="vt">' + esc(q.question) + '</div><div class="vm">→ feeds Deep Discovery · ' + esc(q.source) + ' · ' + esc(q.confidence) + '</div></div>'; }).join('') || '<div class="iq-cq" style="font-style:normal;color:var(--iq-ink4)">No validation questions — strengthen the hypotheses with more sources.</div>';

    var evo = b.evolution_hypothesis;
    var evoHtml = evo ? '<div class="iq-hyp"><div class="hl">Evolution · what it is becoming <span class="iq-q ' + esc(evo.confidence) + '">' + esc(evo.confidence) + '</span></div>' +
      '<div class="ht">From <em>' + esc(evo.current_state) + '</em> → <em>' + esc(evo.emerging_state) + '</em></div>' +
      '<div class="hr"><b>traces to</b> ' + (evo.signal_ids ? evo.signal_ids.length : 0) + ' signals · ' + esc(evo.reasoning || '') + '</div></div>'
      : '<div class="iq-cq" style="font-style:normal;color:var(--iq-ink4)">No evolution signal yet — news / investor / careers-growth language would reveal direction of travel.</div>';

    var body = conf +
      '<div class="iq-grid2">' + hyp('Mission', b.mission_hypothesis) + hyp('Leadership', b.leadership_hypothesis) + '</div>' +
      '<div class="iq-grid2">' + hyp('Hiring', b.hiring_hypothesis) + hyp('Essence', b.essence_hypothesis) + '</div>' +
      '<div class="iq-plabel" style="margin:18px 0 10px;color:var(--iq-freq2)">Frequency hypothesis · 10 dimensions (evidence-backed)</div>' +
      '<div class="iq-ftable">' + freqRows + '</div>' +
      '<div class="iq-plabel" style="margin:18px 0 10px;color:var(--iq-freq2)">Evolution</div>' + evoHtml +
      '<div class="iq-plabel" style="margin:18px 0 10px;color:var(--iq-neg)">Contradictions · claim vs observed</div>' + contra +
      '<div class="iq-plabel" style="margin:18px 0 10px;color:var(--iq-warm)">Risk</div>' + risks +
      '<div class="iq-plabel" style="margin:18px 0 10px;color:var(--iq-gold)">Validation questions → Deep Discovery</div>' + vq;

    return panel('Organizational Intelligence Brief', 'Generated ' + esc((b.research_date || '').slice(0, 10)) + ' · every hypothesis traces to signals above.', body, gen);
  }

  /* ---- events ---- */
  document.addEventListener('change', function (e) { if (e.target.id === 'iq-org') { setSel(e.target.value); render(); } });
  document.addEventListener('click', function (e) {
    var t = e.target, orgId = sel();
    if (t.id === 'iq-addsrc') {
      var text = val('iq-stext'); if (!text) { alert('Paste the real public text for this source.'); return; }
      I.addSource(orgId, { source_type: val('iq-stype'), title: val('iq-stitle'), url: val('iq-surl'), text: text });
      render(); return;
    }
    var del = t.getAttribute && t.getAttribute('data-delsrc');
    if (del) { I.deleteSource(del); render(); return; }
    if (t.id === 'iq-genbrief') { var r = I.generateBrief(orgId); if (r && r.error) alert(r.error); render(); return; }
  });
  document.getElementById('iq-reset').addEventListener('click', function () {
    if (confirm('Clear all organizational intelligence on this device? Sources, signals, briefs and evolution hypotheses will be removed.')) {
      var s = I.ensure(OF.load());
      s.intel_sources = []; s.intel_signals = []; s.intel_briefs = []; s.intel_evolution = [];
      OF.save(s);
      render();
    }
  });

  render();
})();
