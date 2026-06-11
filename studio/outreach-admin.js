/* =============================================================
   outreach-admin.js — Studio · Candidate Discovery & Outreach (1P)
   =============================================================
   Search mission → add candidate → paste public material →
   research+resonance (reuse 1O) → personalized outreach draft →
   approve/reject. Nothing sent automatically. Agent placeholders.
   ============================================================= */
(function () {
  'use strict';
  var OF = window.OF;
  var O = OF.outreach;
  var R = OF.personResearch;
  var SEL = 'of.outreach.selectedSearch';

  var bannerEl = document.getElementById('ou-banner');
  var intakeEl = document.getElementById('ou-intake');
  var searchesEl = document.getElementById('ou-searches');
  var viewEl = document.getElementById('ou-view');

  function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function sel() { try { return localStorage.getItem(SEL); } catch (e) { return null; } }
  function setSel(v) { try { localStorage.setItem(SEL, v); } catch (e) {} }
  function val(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }

  function render() {
    bannerEl.innerHTML = 'Live candidate search · <strong>' + (O.LIVE_SEARCH ? 'live' : 'NOT IMPLEMENTED') + '</strong> &nbsp;·&nbsp; Email/WhatsApp send · <strong>' + (O.EMAIL_INTEGRATION ? 'live' : 'NOT IMPLEMENTED') + '</strong> &nbsp;·&nbsp; candidates added manually / by URL; outreach requires human approval and is never auto-sent.';
    renderIntake();
    var searches = O.getSearches();
    renderSearches(searches);
    if (!searches.length) { viewEl.innerHTML = '<div class="ou-empty">No search missions yet. Pick a mandate above and open one. (Need a mandate first? Generate one in <a href="mandates.html">Mandates</a>.)</div>'; return; }
    var id = sel() && searches.some(function (s) { return s.search.search_id === sel(); }) ? sel() : searches[0].search.search_id;
    setSel(id);
    renderView(id);
  }

  function renderIntake() {
    var tg = O.mandateTargets();
    intakeEl.innerHTML = '<div class="ou-label">New candidate search mission</div>' +
      (tg.length ?
        '<div class="ou-row">' +
          '<div class="ou-field"><label>Mandate</label><select id="ou-mandate">' + tg.map(function (t) { return '<option value="' + esc(t.mandate_id) + '">' + esc(t.label) + '</option>'; }).join('') + '</select></div>' +
          '<button class="ou-go" id="ou-createsearch" type="button">Open search mission →</button>' +
        '</div>'
        : '<div class="ou-cq" style="font-style:normal;color:var(--ou-ink4)">No mandates yet — generate one in <a href="mandates.html" style="color:var(--ou-freq)">Mandates</a>. A search mission targets a mandate\u2019s role.</div>');
  }

  function renderSearches(searches) {
    if (!searches.length) { searchesEl.innerHTML = ''; return; }
    searchesEl.innerHTML = searches.map(function (d) {
      var s = d.search;
      return '<div class="ou-schip' + (s.search_id === sel() ? ' sel' : '') + '" data-search="' + esc(s.search_id) + '">' +
        esc(d.role ? d.role.role_name : 'role') + '<span class="s">' + esc(d.organization ? d.organization.organization_name : '') + ' · ' + d.candidates + ' cand · ' + esc(s.search_status.replace(/_/g, ' ')) + '</span></div>';
    }).join('');
  }

  function panel(label, cq, body, right) {
    return '<div class="ou-panel"><div class="ou-ptop"><div><div class="ou-plabel">' + esc(label) + '</div>' + (cq ? '<div class="ou-cq">' + esc(cq) + '</div>' : '') + '</div>' + (right || '') + '</div><div class="ou-pbody">' + body + '</div></div>';
  }

  function renderView(searchId) {
    var d = O.getSearches().filter(function (x) { return x.search.search_id === searchId; })[0];
    if (!d) { viewEl.innerHTML = ''; return; }
    var s = d.search;
    var missionBody =
      '<div class="ou-block"><div class="bl">Target profile · from the role frequency</div><div class="bt">' + esc(s.target_profile) + '</div></div>' +
      '<div class="ou-block"><div class="bl">Sources</div><div class="bt">' + s.sources.map(function (x) { return esc(x.replace(/_/g, ' ')); }).join(' · ') + ' <span class="ou-q needs_manual_input">live search NOT IMPLEMENTED</span></div></div>';
    var addForm = '<div class="ou-row" style="margin-top:10px">' +
      '<div class="ou-field"><label>Candidate name</label><input id="ou-cname" placeholder="Name"></div>' +
      '<div class="ou-field"><label>LinkedIn URL</label><input id="ou-curl" placeholder="https://www.linkedin.com/in/…"></div>' +
      '<div class="ou-field"><label>Company</label><input id="ou-ccompany" placeholder="Current company"></div>' +
      '<button class="ou-act primary" data-addcand="' + esc(searchId) + '" type="button">Add candidate</button></div>';
    var mission = panel('Search Mission', 'A mandate\u2019s role drives the target profile. Add candidates manually or by URL.', missionBody + addForm,
      '<button class="ou-btn" data-delsearch="' + esc(searchId) + '" type="button">Delete</button>');

    var cands = O.getCandidatesForSearch(searchId);
    var candHtml = cands.length ? cands.map(renderCandidate).join('') : '<div class="ou-cq" style="font-style:normal;color:var(--ou-ink4)">No candidates yet — add one above.</div>';

    viewEl.innerHTML = mission + panel('Candidates', 'Identify → research → screen → outreach draft → approve.', candHtml) + agentsPanel();
  }

  function renderCandidate(d) {
    var c = d.candidate, rr = d.research, res = d.resonance, draft = d.draft;
    var pasteSlots = '';
    if (rr && rr.sources) {
      var pending = rr.sources.filter(function (x) { return x.status !== 'manual_paste' && x.status !== 'ignored'; });
      var pasted = rr.sources.filter(function (x) { return x.status === 'manual_paste'; }).length;
      if (c.status === 'identified' || pasted === 0) {
        var liSlot = pending.filter(function (x) { return x.source_type === 'linkedin_profile'; })[0] || pending[0];
        if (liSlot) pasteSlots = '<div class="ou-src"><div class="note">' + esc(liSlot.notes || 'Paste real public text.') + '</div>' +
          '<textarea data-paste="' + esc(liSlot.source_id) + '" placeholder="Paste LinkedIn / resume / public text…"></textarea>' +
          '<button class="ou-act" data-pastebtn="' + esc(liSlot.source_id) + '" data-cand="' + esc(c.candidate_discovery_id) + '" type="button">Save material</button></div>';
      }
    }
    var actions = '<div style="margin-top:8px">';
    var pastedCount = rr && rr.sources ? rr.sources.filter(function (x) { return x.status === 'manual_paste'; }).length : 0;
    if (pastedCount > 0 && c.status !== 'screened' && c.status !== 'approved_for_outreach') actions += '<button class="ou-act primary" data-research="' + esc(c.candidate_discovery_id) + '" type="button">Research &amp; screen →</button>';
    if (res && !draft) actions += '<button class="ou-act primary" data-draft="' + esc(c.candidate_discovery_id) + '" type="button">Generate outreach draft →</button>';
    actions += '</div>';

    var resHtml = res ? '<div class="ou-block"><div class="bl">Preliminary Resonance · ' +
      '<span class="ou-next ' + esc(res.next_action) + '">→ ' + esc(res.next_action.replace(/_/g, ' ')) + '</span> · confidence ' + esc(res.confidence) + '</div>' +
      '<div class="bt">' + esc(res.summary) + '</div>' +
      (res.positive_resonance_signals.length ? '<div class="bt" style="color:var(--ou-pos);margin-top:5px">+ ' + esc(res.positive_resonance_signals[0]) + '</div>' : '') +
      (res.constructive_friction_signals.length ? '<div class="bt" style="color:var(--ou-warm);margin-top:3px">~ ' + esc(res.constructive_friction_signals[0]) + '</div>' : '') +
      (res.missing_evidence.length ? '<div class="bt" style="color:var(--ou-ink4);margin-top:3px">? ' + esc(res.missing_evidence[0]) + '</div>' : '') +
      '</div>' : '';

    var draftHtml = draft ? renderDraft(draft) : '';

    return '<div class="ou-cand">' +
      '<div class="ou-cand-top"><div><div class="ou-cand-name">' + esc(c.person_name) + (c.current_title ? ' <span class="r">· ' + esc(c.current_title) + '</span>' : '') + '</div>' +
        '<div class="ou-cand-meta">' + (c.linkedin_url ? '<a href="' + esc(c.linkedin_url) + '" target="_blank" rel="noopener">LinkedIn</a> · ' : '') + (c.evidence_summary || 'no evidence yet') + '</div></div>' +
        '<span class="ou-q ' + esc(c.status) + '">' + esc(c.status.replace(/_/g, ' ')) + '</span></div>' +
      pasteSlots + resHtml + draftHtml + actions +
    '</div>';
  }

  function renderDraft(draft) {
    var prov = '<div class="prov"><b>Evidence used:</b> ' + (draft.evidence_used.length ? draft.evidence_used.map(esc).join(' · ') : 'none') + '<br>' +
      '<b>Reasoning:</b> ' + draft.resonance_reasoning.map(esc).join(' · ') + '</div>';
    var controls = '<div style="margin-top:8px">';
    if (draft.status === 'pending_approval') controls += '<button class="ou-act pos" data-approve="' + esc(draft.draft_id) + '" type="button">Approve</button><button class="ou-act neg" data-reject="' + esc(draft.draft_id) + '" type="button">Reject</button>';
    else if (draft.status === 'approved') controls += '<button class="ou-act primary" data-send="' + esc(draft.draft_id) + '" type="button">Mark sent (placeholder)</button> <span class="ou-cq" style="font-style:normal">No transport — nothing actually sends.</span>';
    controls += '</div>';
    return '<div class="ou-draft"><div class="dl">Outreach Draft · <span class="ou-q ' + esc(draft.status) + '">' + esc(draft.status.replace(/_/g, ' ')) + '</span></div>' +
      '<div class="subj">' + esc(draft.subject) + '</div>' +
      '<div class="body">' + esc(draft.body) + '</div>' + prov + controls + '</div>';
  }

  function agentsPanel() {
    var cells = O.AGENTS.map(function (a) {
      return '<div class="ou-agent"><div class="an">' + esc(a.label) + '</div><div class="ad">' + esc(a.does) + '</div><span class="ou-q needs_manual_input">' + esc(a.status.replace(/_/g, ' ')) + '</span></div>';
    }).join('');
    return panel('Future automation agents', 'Placeholders only — no autonomous sending at launch. Human approval is required.', '<div class="ou-agents">' + cells + '</div>');
  }

  /* ---- events ---- */
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t.id === 'ou-createsearch') { var mid = val('ou-mandate'); var r = O.createSearch(mid); if (r && r.error) { alert(r.error); return; } if (r.search) setSel(r.search.search_id); render(); return; }
    var sc = t.getAttribute && t.getAttribute('data-search'); if (sc) { setSel(sc); render(); return; }
    var ac = t.getAttribute && t.getAttribute('data-addcand');
    if (ac) { var r2 = O.addCandidate(ac, { person_name: val('ou-cname'), linkedin_url: val('ou-curl'), current_company: val('ou-ccompany') }); if (r2 && r2.error) alert(r2.error); render(); return; }
    var pb = t.getAttribute && t.getAttribute('data-pastebtn');
    if (pb) { var ta = viewEl.querySelector('[data-paste="' + pb + '"]'); var r3 = O.pasteForCandidate(t.getAttribute('data-cand'), pb, ta ? ta.value : ''); if (r3 && r3.error) alert(r3.error); render(); return; }
    var rs = t.getAttribute && t.getAttribute('data-research');
    if (rs) { var r4 = O.researchAndScreen(rs); if (r4 && r4.error) alert(r4.error); render(); return; }
    var dr = t.getAttribute && t.getAttribute('data-draft');
    if (dr) { var r5 = O.generateDraft(dr); if (r5 && r5.error) alert(r5.error); render(); return; }
    var ap = t.getAttribute && t.getAttribute('data-approve'); if (ap) { O.approveDraft(ap); render(); return; }
    var rj = t.getAttribute && t.getAttribute('data-reject'); if (rj) { O.rejectDraft(rj); render(); return; }
    var sd = t.getAttribute && t.getAttribute('data-send'); if (sd) { var r6 = O.sendApproved(sd); if (r6 && r6.note) alert(r6.note); render(); return; }
    var del = t.getAttribute && t.getAttribute('data-delsearch'); if (del) { if (confirm('Delete this search mission and its candidates?')) { O.deleteSearch(del); try { localStorage.removeItem(SEL); } catch (e2) {} render(); } return; }
  });

  render();
})();
