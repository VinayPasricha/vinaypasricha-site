/* =============================================================
   person-research-admin.js — Studio · Person Public Research (1O)
   =============================================================
   URL/name intake → honest manual-paste slots → reuse Person Intel
   engine → preliminary brief + frequency + resonance screen + next
   action. Never pretends to fetch.
   ============================================================= */
(function () {
  'use strict';
  var OF = window.OF;
  var R = OF.personResearch;
  var SEL = 'of.presearch.selected';

  var bannerEl = document.getElementById('pr-banner');
  var intakeEl = document.getElementById('pr-intake');
  var reqsEl = document.getElementById('pr-reqs');
  var viewEl = document.getElementById('pr-view');

  function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function sel() { try { return localStorage.getItem(SEL); } catch (e) { return null; } }
  function setSel(v) { try { localStorage.setItem(SEL, v); } catch (e) {} }
  function val(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }

  function render() {
    bannerEl.innerHTML = 'Live web search · ' + (R.LIVE_WEB_SEARCH ? 'live' : '<strong>NOT IMPLEMENTED</strong>') +
      ' &nbsp;·&nbsp; LinkedIn fetch/scrape · ' + (R.LIVE_LINKEDIN_FETCH ? 'live' : '<strong>NOT IMPLEMENTED</strong>') +
      ' &nbsp;·&nbsp; the runtime stores the URL and asks you to paste real public text. It never pretends to have searched.';
    renderIntake();
    var reqs = R.getRequests();
    renderReqs(reqs);
    if (!reqs.length) { viewEl.innerHTML = '<div class="pr-empty">No research requests yet. Enter a LinkedIn URL or a name + company above to open one.</div>'; return; }
    var id = sel() && reqs.some(function (r) { return r.request.request_id === sel(); }) ? sel() : reqs[0].request.request_id;
    setSel(id);
    renderView(id);
  }

  function renderIntake() {
    var tg = R.targets();
    intakeEl.innerHTML =
      '<div class="pr-label">New research request</div>' +
      '<div class="pr-row">' +
        '<div class="pr-field"><label>LinkedIn URL</label><input id="pr-url" placeholder="https://www.linkedin.com/in/…"></div>' +
        '<div class="pr-field"><label>Name</label><input id="pr-name" placeholder="Candidate name"></div>' +
        '<div class="pr-field"><label>Current company</label><input id="pr-company" placeholder="Company"></div>' +
        '<div class="pr-field"><label>Target role / mandate (optional)</label><select id="pr-target"><option value="">— none —</option>' +
          tg.map(function (t) { return '<option value="' + esc(t.mandate_id) + '">' + esc(t.label) + '</option>'; }).join('') +
        '</select></div>' +
        '<button class="pr-go" id="pr-start" type="button">Open research request →</button>' +
      '</div>';
  }

  function renderReqs(reqs) {
    if (!reqs.length) { reqsEl.innerHTML = ''; return; }
    reqsEl.innerHTML = reqs.map(function (d) {
      var r = d.request;
      return '<div class="pr-reqchip' + (r.request_id === sel() ? ' sel' : '') + '" data-req="' + esc(r.request_id) + '">' +
        esc(r.person_name || 'Unnamed') + '<span class="s">' + esc(r.status.replace(/_/g, ' ')) + (d.screen ? ' · screened' : (d.brief ? ' · brief' : '')) + '</span></div>';
    }).join('');
  }

  function panel(label, cq, body, right) {
    return '<div class="pr-panel"><div class="pr-ptop"><div><div class="pr-plabel">' + esc(label) + '</div>' + (cq ? '<div class="pr-cq">' + esc(cq) + '</div>' : '') + '</div>' + (right || '') + '</div><div class="pr-pbody">' + body + '</div></div>';
  }

  function renderView(reqId) {
    var d = R.getRequest(reqId);
    if (!d) { viewEl.innerHTML = ''; return; }
    viewEl.innerHTML = requestPanel(d) + sourcesPanel(d) + briefPanel(d) + screenPanel(d);
  }

  function requestPanel(d) {
    var r = d.request;
    var right = '<button class="pr-btn" data-delreq="' + esc(r.request_id) + '" type="button">Delete</button>';
    var body = '<div class="pr-frow" style="grid-template-columns:1fr 1fr"><div class="fd">Candidate</div><div class="fr">' + esc(r.person_name || 'Unnamed') + (r.current_company ? ' · ' + esc(r.current_company) : '') + '</div></div>' +
      (r.linkedin_url ? '<div class="pr-frow" style="grid-template-columns:1fr 1fr"><div class="fd">LinkedIn URL</div><div class="fr"><a href="' + esc(r.linkedin_url) + '" target="_blank" rel="noopener" style="color:var(--pr-freq2)">' + esc(r.linkedin_url) + '</a> <span class="pr-q manual_input_required">stored · not fetched</span></div></div>' : '') +
      (d.target_role ? '<div class="pr-frow" style="grid-template-columns:1fr 1fr"><div class="fd">Target role</div><div class="fr">' + esc(d.target_role.role_name) + '</div></div>' : '') +
      '<div class="pr-frow" style="grid-template-columns:1fr 1fr"><div class="fd">Status</div><div class="fr"><span class="pr-q ' + esc(r.status) + '">' + esc(r.status.replace(/_/g, ' ')) + '</span></div></div>';
    return panel('Research Request', 'LinkedIn URL behaviour: stored, never scraped — paste the profile text below.', body, right);
  }

  function sourcesPanel(d) {
    var pasted = d.sources.filter(function (s) { return s.status === 'manual_paste'; }).length;
    var canGen = pasted > 0;
    var list = d.sources.filter(function (s) { return s.status !== 'ignored'; }).map(function (s) {
      var done = s.status === 'manual_paste';
      return '<div class="pr-src">' +
        '<div class="pr-src-top"><div><span class="stt">' + esc(s.title || s.source_type.replace(/_/g, ' ')) + '</span>' +
          '<div class="stm">' + esc(s.source_type.replace(/_/g, ' ')) + (s.url ? ' · <a href="' + esc(s.url) + '" target="_blank" rel="noopener">link</a>' : '') + '</div></div>' +
          '<span class="pr-q ' + esc(s.status) + '">' + esc(s.status.replace(/_/g, ' ')) + '</span></div>' +
        (s.notes && !done ? '<div class="note">' + esc(s.notes) + '</div>' : '') +
        (done ? '<div class="pasted">Pasted ' + (s.raw_text ? s.raw_text.length : 0) + ' chars → fed to Person Intelligence engine.</div>'
              : '<textarea data-paste="' + esc(s.source_id) + '" placeholder="Paste the real public text for this source…"></textarea>' +
                '<button class="pr-act primary" data-pastebtn="' + esc(s.source_id) + '" type="button">Save &amp; extract signals</button>') +
      '</div>';
    }).join('');
    var addRow = '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
      '<select class="pr-act" id="pr-addtype" style="cursor:pointer">' + R.SOURCE_TYPES.map(function (t) { return '<option value="' + t + '">' + esc(t.replace(/_/g, ' ')) + '</option>'; }).join('') + '</select>' +
      '<button class="pr-act" data-addslot="' + esc(d.request.request_id) + '" type="button">+ add another source slot</button>' +
      (canGen ? '<button class="pr-go" data-gen="' + esc(d.request.request_id) + '" type="button" style="margin-left:auto">Generate preliminary brief &amp; screen →</button>' : '<span class="pr-cq" style="margin-left:auto">Paste at least one source to generate.</span>') +
      '</div>';
    return panel('Sources · public evidence', 'Three levels: manual paste (live) · URL intake (stored) · live search (NOT IMPLEMENTED).', list + addRow, '<span class="pr-q ' + (pasted ? 'manual_paste' : 'manual_input_required') + '">' + pasted + ' pasted</span>');
  }

  function briefPanel(d) {
    if (!d.brief) return panel('Preliminary Person Intelligence Brief', 'Reuses the Person Intelligence engine — no second engine.', '<div class="pr-cq" style="font-style:normal;color:var(--pr-ink4)">Not generated yet. Paste evidence, then generate. Resume-only or thin evidence yields a weak, clearly-labelled brief.</div>');
    var b = d.brief;
    function hyp(label, h) { if (!h) return ''; return '<div class="pr-hyp"><div class="ht"><b style="color:var(--pr-freq)">' + esc(label) + ':</b> ' + esc(h.statement) + '</div><div class="hr">traces to ' + (h.signal_ids ? h.signal_ids.length : 0) + ' signals · ' + esc(h.confidence) + ' · ' + esc(h.reasoning || '') + '</div></div>'; }
    var freq = '<div class="pr-frow"><div>Dimension</div><div>Reading</div><div>Conf</div></div>' +
      (b.person_frequency_hypothesis || []).map(function (f) {
        var none = /no signal|not.*observable/i.test(f.reading);
        return '<div class="pr-frow"><div class="fd">' + esc(f.dimension) + '</div><div class="fr' + (none ? ' none' : '') + '">' + esc(f.reading) + '</div><div><span class="pr-q ' + esc(f.confidence) + '">' + esc(f.confidence) + '</span></div></div>';
      }).join('');
    var body = hyp('Essence', b.person_essence_hypothesis) + hyp('Career pattern', b.career_pattern_hypothesis) + hyp('Motivation', b.motivation_hypothesis) +
      '<div class="pr-plabel" style="margin:16px 0 8px;color:var(--pr-freq2)">Preliminary Person Frequency · 10 dimensions</div>' + freq;
    return panel('Preliminary Person Intelligence Brief', 'Generated from pasted evidence only — every hypothesis traces to signals.', body, '<span class="pr-q ' + esc(b.confidence ? b.confidence.level : 'low') + '">confidence ' + esc(b.confidence ? b.confidence.level : 'low') + '</span>');
  }

  function screenPanel(d) {
    if (!d.screen) {
      var hasTarget = d.target_role || d.request.target_mandate_id;
      return panel('Preliminary Resonance Screen', 'Recruiter aid — should you approach? No score, rank, or hire decision.',
        '<div class="pr-cq" style="font-style:normal;color:var(--pr-ink4)">' + (hasTarget ? 'Generate the brief above to produce the screen.' : 'No target role/mandate attached — re-open the request with a target to enable the screen.') + '</div>');
    }
    var s = d.screen;
    function grp(cls, label, items) { if (!items || !items.length) return ''; return '<div class="pr-sgrp ' + cls + '"><div class="gl">' + esc(label) + '</div><ul>' + items.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>'; }
    var body = '<div class="pr-next ' + esc(s.recommended_next_step) + '">→ ' + esc(s.recommended_next_step.replace(/_/g, ' ')) + '</div>' +
      '<div class="pr-ssum">' + esc(s.screen_summary) + '</div>' +
      grp('pos', 'Positive resonance signals', s.positive_resonance_signals) +
      grp('fric', 'Constructive friction', s.constructive_friction_signals) +
      grp('miss', 'Missing evidence', s.missing_evidence) +
      grp('risk', 'Risks', s.risks) +
      '<div class="pr-noscore">recruiter aid · no score · no ranking · no fit % · no hire/reject · no automated contact</div>';
    return panel('Preliminary Resonance Screen', 'Should the recruiter approach? A next-action only.', body, '<span class="pr-q ' + esc(s.confidence) + '">confidence ' + esc(s.confidence) + '</span>');
  }

  /* ---- events ---- */
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t.id === 'pr-start') {
      var url = val('pr-url'), name = val('pr-name');
      if (!url && !name) { alert('Enter a LinkedIn URL or a name.'); return; }
      var d = R.startRequest({ linkedin_url: url, person_name: name || 'Candidate', current_company: val('pr-company'), target_mandate_id: val('pr-target') || null });
      if (d) setSel(d.request.request_id);
      render(); return;
    }
    var rq = t.getAttribute && t.getAttribute('data-req'); if (rq) { setSel(rq); render(); return; }
    var pb = t.getAttribute && t.getAttribute('data-pastebtn');
    if (pb) {
      var ta = viewEl.querySelector('[data-paste="' + pb + '"]');
      var res = R.pasteSource(pb, ta ? ta.value : '');
      if (res && res.error) alert(res.error);
      render(); return;
    }
    var as = t.getAttribute && t.getAttribute('data-addslot');
    if (as) { var ty = (document.getElementById('pr-addtype') || {}).value || 'other'; R.addSourceSlot(as, { source_type: ty, title: ty.replace(/_/g, ' ') }); render(); return; }
    var gen = t.getAttribute && t.getAttribute('data-gen');
    if (gen) { var g = R.generatePreliminary(gen); if (g && g.error) alert(g.error); render(); return; }
    var del = t.getAttribute && t.getAttribute('data-delreq');
    if (del) { if (confirm('Delete this research request and its sources?')) { R.deleteRequest(del); try { localStorage.removeItem(SEL); } catch (e2) {} render(); } return; }
  });

  render();
})();
