/* =============================================================
   hiring-admin.js — Studio · Live Hiring Execution Runtime  (1M)
   =============================================================
   The recruiter workspace. Dashboard tiles (My Mandates /
   Candidates / Shortlists / Interviews / Offers / Joins), the
   mandate pipelines, and a mandate-detail view to run the whole
   operational loop: add candidate → fast frequency discovery →
   resonance analysis → shortlist → feedback → join → signals.
   Recruiters stay in control. No automation, no scores.
   ============================================================= */
(function () {
  'use strict';
  var OF = window.OF;
  var H = OF.hiring;
  var REC_KEY = 'of.hiring.recruiter';
  var SEL_KEY = 'of.hiring.selectedMandate';

  var tilesEl = document.getElementById('hr-tiles');
  var pipesEl = document.getElementById('hr-pipelines');
  var detailEl = document.getElementById('hr-detail');
  var recruiterEl = document.getElementById('hr-recruiter');

  function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function recruiter() { try { return localStorage.getItem(REC_KEY) || ''; } catch (e) { return ''; } }
  function selectedMandate() { try { return localStorage.getItem(SEL_KEY); } catch (e) { return null; } }
  function setSelected(m) { try { localStorage.setItem(SEL_KEY, m); } catch (e) {} }
  function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }

  function render() {
    recruiterEl.value = recruiter();
    var summary = H.recruiterSummary(recruiter() || null);
    tilesEl.innerHTML = [
      ['mandates', 'My Mandates'], ['candidates', 'Candidates'], ['shortlists', 'Shortlists'],
      ['interviewing', 'Interviews'], ['offers', 'Offers'], ['joins', 'Joins']
    ].map(function (t) {
      return '<div class="hr-tile"><div class="tn">' + summary[t[0]] + '</div><div class="tl">' + t[1] + '</div></div>';
    }).join('');

    var pipes = H.getPipelines();
    if (!pipes.length) {
      pipesEl.innerHTML = '<div class="hr-empty">No mandates yet. Generate a mandate in <a href="mandates.html">Mandates</a> first — hiring runs a mandate\u2019s pipeline.</div>';
      detailEl.innerHTML = '';
      return;
    }
    pipesEl.innerHTML = pipes.map(renderPipe).join('');

    var sel = selectedMandate();
    if (sel && pipes.some(function (p) { return p.mandate.mandate_id === sel; })) renderDetail(sel);
    else detailEl.innerHTML = '<div class="hr-empty">Select a mandate above to run its pipeline.</div>';
  }

  function renderPipe(p) {
    var stageCells = H.PIPELINE_STAGES.map(function (s) {
      var n = p.stage_counts[s] || 0;
      return '<div class="hr-stagecell"><div class="sc' + (n ? '' : ' zero') + '">' + n + '</div><div class="sl">' + esc(s) + '</div></div>';
    }).join('');
    var sel = p.mandate.mandate_id === selectedMandate();
    return '<div class="hr-pipe' + (sel ? ' sel' : '') + '" data-mandate="' + esc(p.mandate.mandate_id) + '">' +
      '<div class="hr-pipe-top">' +
        '<div class="hr-pipe-name">' + esc(p.role ? p.role.role_name : 'Mandate') +
          '<div class="sub">' + esc(p.mission ? (p.mission.mission_name || 'mission') : 'mission') + ' · ' + esc(p.organization ? p.organization.organization_name : 'org') + '</div></div>' +
        '<div class="hr-pipe-meta">' +
          '<span><b>' + p.candidate_count + '</b> candidates</span>' +
          '<span><b>' + p.days_open + '</b> days open</span>' +
          '<span>owner <b>' + esc(p.owner || '—') + '</b></span>' +
          '<span>' + esc(p.mandate.lane_type) + ' · conf <b>' + esc(p.confidence) + '</b></span>' +
        '</div>' +
      '</div>' +
      '<div class="hr-stages">' + stageCells + '</div>' +
    '</div>';
  }

  /* ---- mandate detail ---- */
  function renderDetail(mandateId) {
    var pipe = H.getPipelines().filter(function (p) { return p.mandate.mandate_id === mandateId; })[0];
    if (!pipe) { detailEl.innerHTML = ''; return; }
    var cands = H.getCandidatesForMandate(mandateId);
    var shortlist = H.getShortlist(mandateId);
    var slIds = shortlist ? shortlist.candidates : [];
    var signals = H.getLearningSignals(mandateId);

    var addForm =
      '<div class="hr-addrow">' +
        '<input class="hr-in" id="hr-cname" placeholder="Candidate name">' +
        '<input class="hr-in" id="hr-ctitle" placeholder="Current title">' +
        '<input class="hr-in" id="hr-ccompany" placeholder="Current company">' +
        '<input class="hr-in" id="hr-clinkedin" placeholder="LinkedIn (optional)">' +
        '<button class="hr-act primary" id="hr-addcand" type="button">Add candidate</button>' +
      '</div>';

    var candHtml = cands.length ? cands.map(function (d) { return renderCandidate(d, slIds); }).join('')
      : '<div class="hr-qlabel">No candidates yet. Add one above to start the pipeline.</div>';

    var cols =
      '<div class="hr-cols">' +
        '<div class="hr-col"><div class="hr-section-label" style="color:var(--hr-gold)">Shortlist workspace</div>' +
          (slIds.length ? slIds.map(function (cid) {
            var c = cands.filter(function (x) { return x.candidate.candidate_id === cid; })[0];
            return '<div class="hr-sl-cand"><span>' + esc(c ? (c.candidate.name || 'Candidate') : cid) + '</span><span style="color:var(--hr-ink4)">' + esc(c ? c.candidate.status : '') + '</span></div>';
          }).join('') : '<div class="hr-qlabel">No one shortlisted yet — shortlist a qualified candidate below.</div>') +
          '<details class="hr-fold"><summary>Notes & client feedback</summary>' +
            '<textarea data-sl="notes" data-mid="' + esc(mandateId) + '" placeholder="Recruiter notes…">' + esc(shortlist ? shortlist.notes : '') + '</textarea>' +
            '<textarea data-sl="client_feedback" data-mid="' + esc(mandateId) + '" placeholder="Client feedback on the shortlist…">' + esc(shortlist ? shortlist.client_feedback : '') + '</textarea>' +
            '<button class="hr-act" data-slsave="' + esc(mandateId) + '" type="button" style="margin-top:8px">Save shortlist notes</button>' +
          '</details>' +
        '</div>' +
        '<div class="hr-col"><div class="hr-section-label" style="color:var(--hr-warm)">Learning signals</div>' +
          (signals.length ? signals.slice(0, 12).map(function (s) {
            return '<div class="hr-sig"><div class="st">' + esc(s.signal) + '</div><div class="sm">' + esc(s.source.replace(/_/g, ' ')) + ' · ' + esc(s.confidence) + ' · ' + esc((s.created_at || '').slice(0, 10)) + '</div></div>';
          }).join('') : '<div class="hr-qlabel">No signals yet. Feedback and joins are captured here as learning signals.</div>') +
        '</div>' +
      '</div>';

    detailEl.innerHTML =
      '<div class="hr-detail">' +
        '<div class="hr-dtop"><div><div class="dn">' + esc(pipe.role ? pipe.role.role_name : 'Mandate') + ' · pipeline</div>' +
          '<div class="ds">' + esc(pipe.organization ? pipe.organization.organization_name : '') + ' · ' + pipe.candidate_count + ' candidates · ' + pipe.days_open + ' days open</div></div>' +
          '<a class="hr-act" href="mandates.html" style="text-decoration:none">View mandate ↗</a>' +
        '</div>' +
        '<div class="hr-dbody">' + addForm + candHtml + cols + '</div>' +
      '</div>';
  }

  function renderCandidate(d, slIds) {
    var c = d.candidate;
    var hasFreq = d.person_frequency && (d.person_frequency.dimensions || []).some(function (x) { return x.level !== 'unknown'; });
    var onSl = slIds.indexOf(c.candidate_id) !== -1;
    var cid = c.candidate_id;

    var freqQs = (OF.person.DISCOVERY || []).slice(0, 4).map(function (q) {
      return '<textarea data-fq="' + esc(q.key) + '" data-cid="' + esc(cid) + '" placeholder="' + esc(q.q) + '"></textarea>';
    }).join('');

    var resonance = d.resonance ? (
      '<div class="hr-res"><div class="rl">Resonance · future-state <span class="rcb">confidence ' + esc(d.resonance.confidence) + '</span></div>' +
        '<div class="rsum">' + esc(d.resonance.summary) + '</div>' +
        (d.resonance.growth_opportunities.length ? '<div class="rk">Growth opportunities</div><ul>' + d.resonance.growth_opportunities.slice(0, 3).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
        (d.resonance.risks.length ? '<div class="rk">Risks</div><ul>' + d.resonance.risks.slice(0, 3).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
        '<div class="noscore">no score · no ranking · no percentage · future-state analysis only</div>' +
      '</div>') : '';

    var efb = d.employer_feedback.map(function (f) { return '<div class="hr-fb employer"><div class="ft">' + esc(f.feedback || f.reason || '(no note)') + '</div><div class="fm">employer · ' + esc(f.decision) + ' · ' + esc((f.created_at || '').slice(0, 10)) + '</div></div>'; }).join('');
    var cfb = d.candidate_feedback.map(function (f) { return '<div class="hr-fb candidate"><div class="ft">' + esc(f.feedback || '(no note)') + '</div><div class="fm">candidate · interest ' + esc(f.interest_level) + (f.concerns && f.concerns.length ? ' · ' + esc(f.concerns.join(', ')) : '') + '</div></div>'; }).join('');
    var join = d.join ? '<div class="hr-fb"><div class="ft">' + (d.join.joined ? 'Joined' + (d.join.join_date ? ' ' + esc(d.join.join_date) : '') : 'Did not join') + ' · 30d: ' + esc(d.join['30_day_status']) + ' · 90d: ' + esc(d.join['90_day_status']) + '</div></div>' : '';

    return '<div class="hr-cand" data-cand="' + esc(cid) + '">' +
      '<div class="hr-cand-top"><div class="hr-cand-name">' + esc(c.name || 'Unnamed') +
        (c.current_title ? ' <span class="role">· ' + esc(c.current_title) + (c.current_company ? ', ' + esc(c.current_company) : '') + '</span>' : '') + '</div>' +
        '<span class="hr-status ' + esc(c.status) + '">' + esc(c.status.replace(/_/g, ' ')) + '</span></div>' +

      // fast frequency discovery
      (hasFreq ? '<div class="hr-qlabel" style="color:var(--hr-pos)">✓ Person frequency captured.</div>'
        : '<details class="hr-fold"><summary>Run Frequency Discovery · 15-minute flow</summary>' +
            '<div class="hr-qlabel">A few notes from the conversation — each becomes evidence, validated into a person frequency.</div>' +
            freqQs +
            '<button class="hr-act primary" data-runfreq="' + esc(cid) + '" type="button" style="margin-top:8px">Generate person frequency →</button>' +
          '</details>') +

      resonance +

      // actions
      '<div class="hr-cand-row">' +
        (hasFreq && !d.resonance ? '<button class="hr-act primary" data-resonance="' + esc(cid) + '" type="button">Generate resonance analysis</button>' : '') +
        (hasFreq ? '<button class="hr-act ' + (onSl ? 'on' : '') + '" data-shortlist="' + esc(cid) + '" type="button">' + (onSl ? '★ Shortlisted' : 'Add to shortlist') + '</button>' : '') +
        stageBtn(cid, c.status, 'interviewing', 'Mark interviewing') +
        '<span class="hr-shortpill" style="border:none;color:var(--hr-ink4)">' + esc(cid) + '</span>' +
      '</div>' +

      // feedback + join folds
      '<details class="hr-fold"><summary>Feedback & join</summary>' +
        '<div class="hr-qlabel">Employer feedback</div>' +
        '<textarea data-efb="' + esc(cid) + '" placeholder="What did the employer say?"></textarea>' +
        '<div class="hr-cand-row">' +
          H.EMPLOYER_DECISIONS.map(function (dn) { return '<button class="hr-act" data-efbdec="' + dn + '" data-cid="' + esc(cid) + '" type="button">' + esc(dn) + '</button>'; }).join('') +
        '</div>' +
        '<div class="hr-qlabel">Candidate feedback</div>' +
        '<textarea data-cfb="' + esc(cid) + '" placeholder="What did the candidate say?"></textarea>' +
        '<div class="hr-cand-row"><span class="hr-qlabel" style="margin:0">interest:</span>' +
          ['high', 'medium', 'low'].map(function (lv) { return '<button class="hr-act" data-cfbint="' + lv + '" data-cid="' + esc(cid) + '" type="button">' + lv + '</button>'; }).join('') +
        '</div>' +
        '<div class="hr-qlabel">Join tracking</div>' +
        '<div class="hr-cand-row">' +
          '<button class="hr-act primary" data-join="yes" data-cid="' + esc(cid) + '" type="button">Mark joined</button>' +
          '<button class="hr-act" data-join="no" data-cid="' + esc(cid) + '" type="button">Did not join</button>' +
          (d.join && d.join.joined ? '<button class="hr-act" data-day="30" data-cid="' + esc(cid) + '" type="button">30d ✓</button><button class="hr-act" data-day="90" data-cid="' + esc(cid) + '" type="button">90d ✓</button>' : '') +
        '</div>' +
        (efb || cfb || join ? '<div style="margin-top:8px">' + efb + cfb + join + '</div>' : '') +
      '</details>' +
    '</div>';
  }
  function stageBtn(cid, cur, to, label) {
    if (cur === to || cur === 'joined' || cur === 'rejected') return '';
    return '<button class="hr-act" data-stage="' + esc(to) + '" data-cid="' + esc(cid) + '" type="button">' + esc(label) + '</button>';
  }

  /* ---- events ---- */
  recruiterEl.addEventListener('input', function () { try { localStorage.setItem(REC_KEY, recruiterEl.value.trim()); } catch (e) {} render(); });

  pipesEl.addEventListener('click', function (e) {
    var p = e.target.closest && e.target.closest('.hr-pipe');
    if (p) { setSelected(p.getAttribute('data-mandate')); render(); }
  });

  detailEl.addEventListener('click', function (e) {
    var t = e.target, mid = selectedMandate();
    if (t.id === 'hr-addcand') {
      var name = val('hr-cname'); if (!name) { alert('Enter a candidate name.'); return; }
      H.addCandidate(mid, { name: name, current_title: val('hr-ctitle'), current_company: val('hr-ccompany'), linkedin: val('hr-clinkedin'), owner: recruiter() });
      render(); return;
    }
    var rf = t.getAttribute && t.getAttribute('data-runfreq');
    if (rf) {
      var answers = {};
      detailEl.querySelectorAll('[data-fq][data-cid="' + rf + '"]').forEach(function (ta) { answers[ta.getAttribute('data-fq')] = ta.value; });
      var r = H.runFrequencyDiscovery(rf, answers); if (r && r.error) alert(r.error);
      render(); return;
    }
    var rs = t.getAttribute && t.getAttribute('data-resonance');
    if (rs) { var rr = H.generateResonance(rs); if (rr && rr.error) alert(rr.error); render(); return; }
    var sl = t.getAttribute && t.getAttribute('data-shortlist');
    if (sl) { H.toggleShortlist(mid, sl); render(); return; }
    var stg = t.getAttribute && t.getAttribute('data-stage');
    if (stg) { H.setStatus(t.getAttribute('data-cid'), stg); render(); return; }
    var slsave = t.getAttribute && t.getAttribute('data-slsave');
    if (slsave) {
      var fields = {};
      detailEl.querySelectorAll('[data-sl][data-mid="' + slsave + '"]').forEach(function (ta) { fields[ta.getAttribute('data-sl')] = ta.value; });
      H.updateShortlist(slsave, fields); render(); return;
    }
    var efbdec = t.getAttribute && t.getAttribute('data-efbdec');
    if (efbdec) {
      var cid = t.getAttribute('data-cid');
      var note = (detailEl.querySelector('[data-efb="' + cid + '"]') || {}).value || '';
      H.addEmployerFeedback(cid, { decision: efbdec, feedback: note, reason: note }); render(); return;
    }
    var cfbint = t.getAttribute && t.getAttribute('data-cfbint');
    if (cfbint) {
      var cid2 = t.getAttribute('data-cid');
      var note2 = (detailEl.querySelector('[data-cfb="' + cid2 + '"]') || {}).value || '';
      H.addCandidateFeedback(cid2, { interest_level: cfbint, feedback: note2 }); render(); return;
    }
    var join = t.getAttribute && t.getAttribute('data-join');
    if (join) { H.recordJoin(t.getAttribute('data-cid'), { joined: join === 'yes', join_date: join === 'yes' ? new Date().toISOString().slice(0, 10) : null }); render(); return; }
    var day = t.getAttribute && t.getAttribute('data-day');
    if (day) {
      var cid3 = t.getAttribute('data-cid');
      var d = H.getCandidate(cid3);
      var fields2 = { joined: true, join_date: d.join ? d.join.join_date : new Date().toISOString().slice(0, 10) };
      fields2[day + '_day_status'] = 'on_track';
      H.recordJoin(cid3, fields2); render(); return;
    }
  });

  render();
})();
