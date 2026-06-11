/* =============================================================
   person-intel-admin.js — Studio · Person Intelligence Runtime (1N)
   =============================================================
   Create a person → paste real material → see signals → generate
   the Person Intelligence Brief + frequency hypothesis → collect
   10 references with consent → see hypothesis-driven validation
   questions. Honest: no scraping, no automated outreach.
   ============================================================= */
(function () {
  'use strict';
  var OF = window.OF;
  var P = OF.personIntel;
  var SEL = 'of.pintel.selectedPerson';

  var pickEl = document.getElementById('pi-pick');
  var viewEl = document.getElementById('pi-view');
  function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function sel() { try { return localStorage.getItem(SEL); } catch (e) { return null; } }
  function setSel(o) { try { localStorage.setItem(SEL, o); } catch (e) {} }
  function val(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }

  function render() {
    var ppl = P.people();
    pickEl.innerHTML =
      (ppl.length ? '<div class="pi-field"><label>Person</label><select id="pi-person">' +
        ppl.map(function (p) { return '<option value="' + esc(p.person_id) + '"' + (p.person_id === sel() ? ' selected' : '') + '>' + esc(p.name) + ' · ' + p.sources + ' src' + (p.brief ? ' · brief' : '') + '</option>'; }).join('') + '</select></div>' : '') +
      '<div class="pi-field"><label>New person</label><input id="pi-newname" placeholder="Name"></div>' +
      '<div class="pi-field"><label>&nbsp;</label><input id="pi-newtitle" placeholder="Current title (optional)"></div>' +
      '<button class="pi-go" id="pi-create" type="button">Create person record</button>';

    if (!ppl.length) { viewEl.innerHTML = '<div class="pi-empty">No person yet. Create a record above, then paste their real public material to build intelligence.</div>'; return; }
    var pid = sel() && ppl.some(function (p) { return p.person_id === sel(); }) ? sel() : ppl[0].person_id;
    setSel(pid);
    renderView(pid);
  }

  function panel(label, cq, body, right) {
    return '<div class="pi-panel"><div class="pi-ptop"><div><div class="pi-plabel">' + esc(label) + '</div>' + (cq ? '<div class="pi-cq">' + esc(cq) + '</div>' : '') + '</div>' + (right || '') + '</div><div class="pi-pbody">' + body + '</div></div>';
  }

  function renderView(pid) {
    var d = P.getPersonIntel(pid);
    viewEl.innerHTML = sourcesPanel(d) + signalsPanel(d) + briefPanel(d) + referencesPanel(d);
  }

  function sourcesPanel(d) {
    var opts = P.SOURCE_TYPES.map(function (t) { return '<option value="' + t + '">' + esc(t.replace(/_/g, ' ')) + '</option>'; }).join('');
    var form = '<div class="pi-srcform">' +
      '<select id="pi-stype">' + opts + '</select>' +
      '<input id="pi-stitle" placeholder="Title (e.g. Resume, LinkedIn About)">' +
      '<input id="pi-surl" placeholder="URL (optional)">' +
      '<textarea id="pi-stext" placeholder="Paste the real text — resume body, LinkedIn experience/about, an article they wrote, a press mention. Signals are extracted from exactly this text. Live search is NOT IMPLEMENTED."></textarea>' +
      '<button class="pi-act primary" id="pi-addsrc" type="button">Add source &amp; extract signals</button></div>';
    var list = d.sources.length ? d.sources.map(function (s) {
      var observed = P.OBSERVED_SOURCES.indexOf(s.source_type) !== -1;
      var n = d.signals.filter(function (g) { return g.source_id === s.source_id; }).length;
      return '<div class="pi-src ' + (observed ? 'observed' : 'claim') + '"><div><span class="st">' + esc(s.title || s.source_type.replace(/_/g, ' ')) + '</span> <span class="pi-q ' + esc(s.confidence) + '">' + esc(s.confidence) + (observed ? ' · observed' : ' · self-claim') + '</span><div class="sm">' + esc(s.source_type.replace(/_/g, ' ')) + ' · ' + n + ' signal' + (n === 1 ? '' : 's') + '</div></div><button class="pi-act" data-delsrc="' + esc(s.source_id) + '" type="button">remove</button></div>';
    }).join('') : '<div class="pi-cq" style="font-style:normal;color:var(--pi-ink4)">No sources yet. A résumé alone yields a WEAK brief — add articles, posts, press, or references to harden it.</div>';
    return panel('Source Registry', 'Real material, manually provided. Self-claim (resume/LinkedIn) vs observed (article/press/reference).', form + '<div style="margin-top:14px">' + list + '</div>');
  }

  function signalsPanel(d) {
    if (!d.signals.length) return panel('Signals', 'Extracted from the source text — each quotes its evidence.', '<div class="pi-cq" style="font-style:normal;color:var(--pi-ink4)">No signals yet.</div>', '<span class="pi-q">0</span>');
    var html = '<div class="pi-sigcols">' + d.signals.map(function (g) {
      return '<div class="pi-sig"><div class="sgt">' + esc(g.signal_type.replace(/_/g, ' ')) + ' · ' + esc(g.confidence) + '</div><div class="sg">' + esc(g.signal) + '</div><div class="sge">' + esc(g.evidence) + '</div></div>';
    }).join('') + '</div>';
    return panel('Signals', 'Every signal traces to a source and quotes the line it came from.', html, '<span class="pi-q">' + d.signals.length + ' signals</span>');
  }

  function briefPanel(d) {
    var gen = '<button class="pi-go" id="pi-genbrief" type="button">' + (d.brief ? 'Regenerate brief' : 'Generate intelligence brief →') + '</button>';
    if (!d.brief) return panel('Person Intelligence Brief', 'Generated only from the signals above.', '<div class="pi-cq" style="font-style:normal;color:var(--pi-ink4)">Not generated. Add real material, then generate — every hypothesis will cite its signals.</div>', gen);
    var b = d.brief;
    function hyp(label, h) { if (!h) return ''; return '<div class="pi-hyp"><div class="hl">' + esc(label) + ' <span class="pi-q ' + esc(h.confidence) + '">' + esc(h.confidence) + '</span></div><div class="ht">' + esc(h.statement) + '</div><div class="hr"><b>traces to</b> ' + ((h.signal_ids || []).length) + ' signal' + (((h.signal_ids || []).length) === 1 ? '' : 's') + ' · ' + esc(h.reasoning || '') + '</div></div>'; }
    var conf = '<div class="pi-conf"><div class="cl">Confidence · explainable</div><div class="cb">' + esc(b.confidence.level) + '</div><div class="cr">' + esc(b.confidence.reasoning) + '</div></div>';
    var freq = '<div class="pi-frow"><div>Dimension</div><div>Reading</div><div>Conf</div><div>Why</div></div>' +
      (b.person_frequency_hypothesis || []).map(function (f) {
        return '<div class="pi-frow"><div class="fd">' + esc(f.dimension) + '</div><div class="fe' + (/not observable/i.test(f.reading) ? ' none' : '') + '">' + esc(f.reading) + '</div><div class="pi-q ' + esc(f.confidence) + '" style="justify-self:start">' + esc(f.confidence) + '</div><div class="fr">' + esc(f.reasoning) + '</div></div>';
      }).join('');
    var contra = (b.contradiction_hypotheses || []).length ? b.contradiction_hypotheses.map(function (c) {
      return '<div class="pi-contra ' + (c.severity === 'major' ? 'major' : '') + '"><div class="cd">' + esc(c.tension) + ' · ' + esc(c.severity) + '</div><div class="cs"><b>Claim:</b> ' + esc(c.claim) + '<br><b>Observed:</b> ' + esc(c.observed) + '</div></div>';
    }).join('') : '<div class="pi-cq" style="font-style:normal;color:var(--pi-ink4)">No contradiction detected. Observed sources (press / references) would test the claims harder.</div>';

    var body = conf +
      '<div class="pi-grid2">' + hyp('Career pattern', b.career_pattern_hypothesis) + hyp('Essence', b.person_essence_hypothesis) + '</div>' +
      '<div class="pi-grid2">' + hyp('Motivation', b.motivation_hypothesis) + hyp('Growth direction', b.growth_hypothesis) + '</div>' +
      '<div class="pi-grid2">' + hyp('Constraint', b.constraint_hypothesis) + hyp('Risk', b.risk_hypothesis) + '</div>' +
      '<div class="pi-grid2">' + hyp('Beliefs & values', b.beliefs_and_values_hypothesis) + hyp('Communication', b.communication_hypothesis) + '</div>' +
      hyp('Leadership', b.leadership_hypothesis) +
      '<div class="pi-plabel" style="margin:18px 0 10px;color:var(--pi-freq2)">Person Frequency hypothesis · 10 dimensions (professional, not a personality test)</div>' +
      '<div class="pi-ftable">' + freq + '</div>' +
      '<div class="pi-plabel" style="margin:18px 0 10px;color:var(--pi-neg)">Contradictions · claim vs observed</div>' + contra;
    return panel('Person Intelligence Brief', 'Every hypothesis traces to the signals above. ' + esc(b.evidence_summary), body, gen);
  }

  function referencesPanel(d) {
    var rr = d.reference_request;
    var cov = d.coverage;
    var relOpts = P.REL_TYPES.map(function (t) { return '<option value="' + t + '">' + esc(t) + '</option>'; }).join('');
    var covPills = [['supervisors', 2], ['peers', 2], ['juniors', 2], ['external', 2], ['other', 0]].map(function (c) {
      var have = cov[c[0]] || 0, need = c[0] === 'external' ? 2 : (c[0] === 'other' ? 0 : 2);
      var met = c[0] === 'other' ? have >= 2 : have >= need;
      return '<span class="pi-covpill' + (met ? ' met' : '') + '">' + (met ? '✓ ' : '') + esc(c[0]) + ' ' + have + (need ? '/' + need : '') + '</span>';
    }).join('');

    var form = '<div class="pi-srcform" style="margin-bottom:6px">' +
      '<input id="pi-rname" placeholder="Reference name">' +
      '<select id="pi-rrel">' + relOpts + '</select>' +
      '<input id="pi-rcompany" placeholder="Company">' +
      '<input id="pi-rdesig" placeholder="Designation">' +
      '<input id="pi-remail" placeholder="Email">' +
      '<input id="pi-ryears" placeholder="Years known" style="max-width:110px">' +
      '<button class="pi-act primary" id="pi-addref" type="button">Add reference</button></div>';

    var refs = (rr && rr.references.length) ? rr.references.map(function (r) {
      return '<div class="pi-ref"><div><span class="rn">' + esc(r.name || 'Unnamed') + '</span> <span class="pi-q">' + esc(r.relationship_type) + '</span><div class="rm">' + esc(r.designation || '') + (r.company ? ' · ' + esc(r.company) : '') + (r.years_known ? ' · ' + esc(r.years_known) + 'y known' : '') + ' · thread: not_contacted (hook)</div></div><button class="pi-act" data-delref="' + esc(r.reference_id) + '" type="button">remove</button></div>';
    }).join('') : '<div class="pi-cq" style="font-style:normal;color:var(--pi-ink4)">No references yet. Required: 2 supervisors · 2 peers · 2 juniors · 2 clients/external · 2 discretionary (10 total).</div>';

    var granted = rr && rr.consent;
    var consent = '<div class="pi-consent' + (granted ? ' granted' : '') + '"><div class="ct">' +
      (granted ? '✓ Consent on record (' + esc((rr.consent_at || '').slice(0, 10)) + '): ' : '') +
      '“' + esc(rr ? rr.consent_text : 'I authorize Goodspace / Organizational Frequency to contact these references for professional validation.') + '”</div>' +
      '<div style="margin-top:10px"><button class="pi-act ' + (granted ? '' : 'primary') + '" id="pi-consent" data-grant="' + (granted ? '0' : '1') + '" type="button">' + (granted ? 'Revoke consent' : 'Person authorizes contact') + '</button></div></div>';

    var vq = d.brief ? '<div class="pi-plabel" style="margin:16px 0 10px;color:var(--pi-gold)">Reference questions · mapped to hypotheses (' + (d.brief.validation_questions || []).length + ')</div>' +
      ['candidate', 'supervisor', 'peer', 'junior'].map(function (tg) {
        var qs = (d.brief.validation_questions || []).filter(function (q) { return q.target === tg; });
        if (!qs.length) return '';
        return '<div class="pi-plabel" style="margin:10px 0 6px;color:var(--pi-ink3);font-size:9px">For the ' + esc(tg) + '</div>' + qs.map(function (q) { return '<div class="pi-vq"><div class="vt">' + esc(q.question) + '</div><div class="vm">validates · ' + esc(q.source) + '</div></div>'; }).join('');
      }).join('') : '<div class="pi-cq" style="font-style:normal;color:var(--pi-ink4)">Generate the brief to produce hypothesis-driven reference questions.</div>';

    return panel('Reference Request · 10 professional references', 'One reference · one thread · many channels (contacting them = hook for a later build).',
      '<div class="pi-cov">' + covPills + '</div>' + form + '<div style="margin-top:10px">' + refs + '</div>' + consent + vq,
      '<span class="pi-q ' + (cov.total >= 10 ? 'high' : 'low') + '">' + cov.total + '/10</span>');
  }

  /* ---- events ---- */
  document.addEventListener('change', function (e) { if (e.target.id === 'pi-person') { setSel(e.target.value); render(); } });
  document.addEventListener('click', function (e) {
    var t = e.target, pid = sel();
    if (t.id === 'pi-create') { var nm = val('pi-newname'); if (!nm) { alert('Enter a name.'); return; } var p = P.createPerson({ name: nm, current_title: val('pi-newtitle') }); setSel(p.person_id); render(); return; }
    if (t.id === 'pi-addsrc') { var text = val('pi-stext'); if (!text) { alert('Paste the real text for this source.'); return; } P.addSource(pid, { source_type: val('pi-stype'), title: val('pi-stitle'), url: val('pi-surl'), raw_text: text }); render(); return; }
    var ds = t.getAttribute && t.getAttribute('data-delsrc'); if (ds) { P.deleteSource(ds); render(); return; }
    if (t.id === 'pi-genbrief') { var r = P.generateBrief(pid); if (r && r.error) alert(r.error); render(); return; }
    if (t.id === 'pi-addref') { var rn = val('pi-rname'); if (!rn) { alert('Enter a reference name.'); return; } P.addReference(pid, { name: rn, relationship_type: val('pi-rrel'), company: val('pi-rcompany'), designation: val('pi-rdesig'), email: val('pi-remail'), years_known: val('pi-ryears'), permission_to_contact: true }); render(); return; }
    var dr = t.getAttribute && t.getAttribute('data-delref'); if (dr) { P.removeReference(pid, dr); render(); return; }
    if (t.id === 'pi-consent') { P.setConsent(pid, t.getAttribute('data-grant') === '1'); render(); return; }
  });
  document.getElementById('pi-reset').addEventListener('click', function () {
    if (confirm('Clear all person intelligence on this device? Sources, signals, briefs, references and consent will be removed.')) {
      var s = P.ensure(OF.load());
      s.pi_sources = []; s.pi_signals = []; s.pi_briefs = []; s.pi_reference_requests = []; s.pi_reference_threads = [];
      OF.save(s); render();
    }
  });
  render();
})();
