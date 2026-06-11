/* =============================================================
   interviews-admin.js — Studio · Interview & Offer Orchestration (2F)
   ============================================================= */
(function () {
  'use strict';
  var OF = window.OF;
  var IV = OF.interview, OFR = OF.offer;

  function $(id) { return document.getElementById(id); }
  function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function ttl(s) { return (s || '').replace(/_/g, ' '); }
  function v(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }

  var STAGES = ['proposed', 'invited', 'scheduled', 'completed', 'analyzed'];

  function render() {
    $('iv-banner').innerHTML = 'Calendar · <strong>NOT IMPLEMENTED</strong> &nbsp;·&nbsp; Video / recording / transcription · <strong>NOT IMPLEMENTED</strong> &nbsp;·&nbsp; scheduling &amp; transcript are manual; no fake recordings.';
    // new-interview row
    var cands = IV.interviewableCandidates();
    $('iv-new').innerHTML = cands.length
      ? '<div class="iv-field"><label>Candidate</label><select id="iv-cand">' + cands.map(function (c) { return '<option value="' + esc(c.candidate_discovery_id) + '">' + esc(c.name) + ' · ' + esc(c.status) + '</option>'; }).join('') + '</select></div>' +
        '<div class="iv-field"><label>Type</label><select id="iv-type">' + IV.TYPES.map(function (t) { return '<option value="' + t + '">' + esc(t) + '</option>'; }).join('') + '</select></div>' +
        '<button class="iv-btn go" id="iv-create" type="button">Create interview →</button>'
      : '<div class="iv-field" style="min-width:auto"><label>Candidate</label><span class="iv-sub" style="margin:0">No candidates yet — add one in <a href="outreach.html" style="color:var(--iv-freq)">Outreach</a> or <a href="talent.html" style="color:var(--iv-freq)">Talent Graph</a>.</span></div>';

    var list = IV.getInterviews();
    $('iv-list').innerHTML = list.length ? list.map(renderInterview).join('') : '<div class="iv-empty">No interviews yet. Create one above to begin.</div>';
  }

  function renderInterview(r) {
    var d = IV.getInterview(r.interview_id);
    var iv = d.interview;
    var stages = '<div class="iv-stage">' + STAGES.map(function (s) { return '<span class="iv-step ' + (STAGES.indexOf(iv.status) >= STAGES.indexOf(s) && iv.status !== 'cancelled' ? 'on' : '') + '">' + esc(s) + '</span>'; }).join('') + '</div>';
    var qs = (iv.questions || []).map(function (q) { return '<div class="iv-q"><div class="qt">' + esc(q.question) + '</div><div class="qm">maps to · ' + esc(q.maps_to || 'hypothesis') + '</div></div>'; }).join('');

    var body = '<div class="iv-label">Questions · from hypotheses, gaps &amp; concerns (never generic)</div>' + qs;

    // transcript + analyze
    if (iv.status !== 'analyzed') {
      body += '<div class="iv-label">Transcript · pasted (no fake recordings)</div>' +
        '<textarea class="iv-ta" data-transcript="' + esc(iv.interview_id) + '" placeholder="Paste the interview transcript…">' + esc(iv.transcript || '') + '</textarea>' +
        '<div><button class="iv-act" data-savetrans="' + esc(iv.interview_id) + '" type="button">Save transcript</button>' +
        (iv.transcript ? '<button class="iv-act primary" data-analyze="' + esc(iv.interview_id) + '" type="button">Analyze → validate frequency</button>' : '') +
        (iv.status === 'proposed' ? '<button class="iv-act" data-sched="' + esc(iv.interview_id) + '" type="button">Mark scheduled</button>' : '') + '</div>';
    }

    // analysis
    if (d.analysis) {
      var a = d.analysis;
      body += '<div class="iv-label">Interview analysis · ' + esc(a.confidence) + ' confidence</div>' +
        '<div class="iv-obasis" style="color:var(--iv-ink2)">' + esc(a.summary) + '</div>' +
        (a.dimension_findings.length ? '<div class="iv-findings">' + a.dimension_findings.map(function (f) { return '<div class="iv-find"><div class="fd">' + esc(f.dimension) + ' · ' + esc(IV.human(f.level)) + '</div><div class="ft">' + esc(f.statement) + '</div></div>'; }).join('') + '</div>' : '');
      // evolution
      if (d.evolution && d.evolution.length) {
        body += '<div class="iv-label">Person frequency evolution · history preserved</div>' +
          d.evolution.slice(0, 10).map(function (e) { return '<div class="iv-evo"><div class="et"><b>' + esc(e.dimension) + '</b> · ' + esc(IV.human(e.previous_level)) + ' → ' + esc(IV.human(e.new_level)) + '</div><div class="em">' + esc(ttl(e.change_type)) + ' · ' + esc(e.confidence) + ' · ' + esc(e.reasoning) + '</div></div>'; }).join('');
      }
      // contradictions
      if (d.contradictions && d.contradictions.length) {
        body += '<div class="iv-label" style="color:var(--iv-neg)">Contradictions · preserved as signal</div>' +
          d.contradictions.map(function (c) { return '<div class="iv-con"><div class="ct"><b>' + esc(c.dimension) + ':</b> ' + esc(c.statement_a) + ' (' + esc(ttl(c.source_a)) + ') vs ' + esc(c.statement_b) + ' (' + esc(ttl(c.source_b)) + ') · ' + esc(c.severity) + ' · ' + esc(c.status) + '</div></div>'; }).join('');
      }
      // stale resonance + regenerate
      if (a.resonance_updates && a.resonance_updates.length) {
        body += '<div class="iv-stale">⚠ Resonance is stale — person frequency changed after this interview. <button class="iv-act primary" data-regen="' + esc(iv.candidate_id) + '" type="button" style="margin-top:6px">Regenerate resonance</button></div>';
      }
      // offer block
      body += renderOffer(iv);
    }

    return '<div class="iv-card"><div class="iv-ctop"><div><div class="iv-cname">' + esc(candName(iv.candidate_id)) + ' <span class="r">· ' + esc(iv.interview_type) + ' · round ' + iv.round + '</span></div>' + stages + '</div>' +
      '<span class="iv-status ' + esc(iv.status) + '">' + esc(iv.status) + '</span></div>' +
      '<div class="iv-cbody">' + body + '</div></div>';
  }

  function renderOffer(iv) {
    var oc = OFR.getForCandidate(iv.candidate_id);
    var rs = oc.resonance;
    var html = '<div class="iv-offer"><div class="ol">Offer' + (oc.offer ? ' <span class="iv-ostat ' + esc(oc.offer.status) + '">' + esc(ttl(oc.offer.status)) + '</span>' : '') + '</div>';
    if (!oc.offer) {
      if (rs.stale) html += '<div class="iv-obasis" style="color:var(--iv-warm)">⚠ Regenerate resonance before offer — the screen is stale.</div>';
      else if (!rs.fresh) html += '<div class="iv-obasis">No fresh resonance screen yet — generate one in Outreach/Talent before an offer.</div>';
      else html += '<div class="iv-obasis">Resonance is fresh. An offer is the human acting on a future-state read — never a score.</div><input class="iv-oin" id="iv-terms-' + esc(iv.candidate_id) + '" placeholder="Offer terms (role, comp, start…)"><button class="iv-act primary" data-draftoffer="' + esc(iv.candidate_id) + '" type="button">Draft offer</button>';
    } else {
      var o = oc.offer;
      html += '<div class="iv-obasis">' + esc(o.confidence_basis) + (o.terms ? '<br><b style="color:var(--iv-ink2)">Terms:</b> ' + esc(o.terms) : '') + '</div>';
      if (o.status === 'draft') html += '<button class="iv-act primary" data-submit="' + esc(o.offer_id) + '" type="button">Submit for employer approval</button>';
      if (o.status === 'pending_approval') html += '<input class="iv-oin" id="iv-appr-' + esc(o.offer_id) + '" placeholder="Approver name & role"><button class="iv-act pos" data-approve="' + esc(o.offer_id) + '" type="button">Record approval</button><button class="iv-act neg" data-rejectoffer="' + esc(o.offer_id) + '" type="button">Reject</button>';
      if (o.status === 'approved') html += '<button class="iv-act" data-sendoffer="' + esc(o.offer_id) + '" type="button">Send offer</button><span class="iv-obasis" style="display:inline">  then record the candidate\u2019s own response:</span><br><button class="iv-act pos" data-resp="accepted" data-offer="' + esc(o.offer_id) + '" type="button">Candidate accepted</button><button class="iv-act neg" data-resp="declined" data-offer="' + esc(o.offer_id) + '" type="button">Candidate declined</button>';
      if (o.status === 'sent') html += '<button class="iv-act pos" data-resp="accepted" data-offer="' + esc(o.offer_id) + '" type="button">Candidate accepted</button><button class="iv-act neg" data-resp="declined" data-offer="' + esc(o.offer_id) + '" type="button">Candidate declined</button>';
      if (o.status === 'accepted') html += '<div class="iv-obasis" style="color:var(--iv-pos)">✓ Accepted — JoinOutcome opened in Hiring, learning signal captured.</div>';
      if (oc.response) html += '<div class="iv-obasis">Candidate response: <b style="color:var(--iv-ink2)">' + esc(oc.response.response) + '</b>' + (oc.response.reason ? ' — ' + esc(oc.response.reason) : '') + '</div>';
    }
    return html + '</div>';
  }

  function candName(cid) { var c = OF.load().cd_candidates.filter(function (x) { return x.candidate_discovery_id === cid; })[0]; return c ? c.person_name : 'Candidate'; }

  document.addEventListener('click', function (e) {
    var t = e.target, id = t.id;
    if (id === 'iv-create') { IV.createInterview({ candidate_id: v('iv-cand'), interview_type: v('iv-type') }); render(); return; }
    var st = t.getAttribute && t.getAttribute('data-savetrans'); if (st) { var ta = document.querySelector('[data-transcript="' + st + '"]'); IV.addTranscript(st, ta ? ta.value : ''); render(); return; }
    var sc = t.getAttribute && t.getAttribute('data-sched'); if (sc) { IV.schedule(sc, null, []); render(); return; }
    var an = t.getAttribute && t.getAttribute('data-analyze'); if (an) { var r = IV.analyze(an); if (r && r.error) alert(r.error); render(); return; }
    var rg = t.getAttribute && t.getAttribute('data-regen'); if (rg) { var rr = IV.regenerateResonance(rg); if (rr && rr.error) alert(rr.error); else alert('Resonance regenerated (now interview-validated).'); render(); return; }
    var df = t.getAttribute && t.getAttribute('data-draftoffer'); if (df) { var ro = OFR.draftOffer(df, { terms: v('iv-terms-' + df) }); if (ro && ro.error) alert(ro.error); render(); return; }
    var sb = t.getAttribute && t.getAttribute('data-submit'); if (sb) { OFR.submitForApproval(sb); render(); return; }
    var ap = t.getAttribute && t.getAttribute('data-approve'); if (ap) { var ar = (v('iv-appr-' + ap) || 'Employer').split(/\s+/); OFR.recordApproval(ap, { approver_name: ar[0] || 'Employer', approver_role: ar.slice(1).join(' ') || 'hiring manager', decision: 'approved', reason: 'Approved' }); render(); return; }
    var rj = t.getAttribute && t.getAttribute('data-rejectoffer'); if (rj) { OFR.recordApproval(rj, { approver_name: 'Employer', decision: 'rejected', reason: 'Rejected' }); render(); return; }
    var so = t.getAttribute && t.getAttribute('data-sendoffer'); if (so) { var sr = OFR.sendOffer(so); if (sr && sr.reason) alert(sr.reason); render(); return; }
    var rp = t.getAttribute && t.getAttribute('data-resp'); if (rp) { OFR.recordResponse(t.getAttribute('data-offer'), rp, ''); render(); return; }
    if (id === 'iv-reset') { if (confirm('Reset interviews and offers?')) { IV.resetInterviews(); OFR.resetOffers(); render(); } return; }
  });

  render();
})();
