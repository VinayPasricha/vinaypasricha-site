/* Mission Discovery & Organizational Gap Engine (Build 3D)
   Renders OF.missiongap over the shared of.runtime.v1 store.
   Reads the 3C validated profile as Current Frequency. */
(function () {
  'use strict';
  if (!window.OF || !window.OF.missiongap) { console.warn('mission-gap-admin.js requires of-mission-gap.js'); return; }
  var M = window.OF.missiongap;

  var viewEl = document.getElementById('mg-view');
  var railEl = document.getElementById('mg-rail');
  var statsEl = document.getElementById('mg-stats');
  var toastEl = document.getElementById('mg-toast');

  var activeMission = null;

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function titleCase(s) { return String(s || '').replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(function () { toastEl.classList.remove('show'); }, 2800); }

  function render() {
    var s = M.snapshot();
    renderRail(s);
    renderStats(s);
    var html = '';
    html += missionsPanel(s);
    if (activeMission) html += workspace(activeMission);
    viewEl.innerHTML = html;
    wire(s);
  }

  function renderRail(s) {
    var hasAnchor = s.counts.anchors > 0;
    var hasMission = s.counts.missions > 0;
    var f = activeMission ? M.getMission(activeMission) : null;
    var hasFreq = f && f.mission_frequency;
    var hasGaps = f && f.gaps.length;
    var stages = [
      { n: '01', t: 'Validated profile (3C)', done: hasAnchor },
      { n: '02', t: 'Mission discovery', done: hasMission, now: hasAnchor && !hasMission },
      { n: '03', t: 'Mission frequency', done: !!hasFreq, now: hasMission && !hasFreq },
      { n: '04', t: 'Gap analysis', done: !!hasGaps, now: !!hasFreq && !hasGaps },
      { n: '05', t: 'Constraints', done: f && f.constraints.length > 0 },
      { n: '06', t: 'Recommendations', done: f && f.recommendations.length > 0 }
    ];
    railEl.innerHTML = stages.map(function (st) {
      var cls = st.done ? 'done' : (st.now ? 'now' : '');
      return '<div class="mg-stage ' + cls + '"><div class="sn">' + st.n + (st.done ? ' <span class="tick">✓</span>' : '') + '</div><div class="st">' + st.t + '</div></div>';
    }).join('');
  }

  function renderStats(s) {
    var c = s.counts;
    statsEl.innerHTML =
      stat(c.anchors, '3C profiles') +
      stat(c.missions, 'Missions') +
      stat(c.gaps, 'Frequency gaps') +
      stat(c.constraints, 'Constraints') +
      stat(c.recommendations, 'Recommendations');
  }
  function stat(n, l) { return '<div class="mg-stat"><div class="n">' + n + '</div><div class="l">' + l + '</div></div>'; }

  /* ============ MISSIONS + anchor picker ============ */
  function missionsPanel(s) {
    var body = '';
    if (!s.anchors.length) {
      body = '<div class="mg-empty">No validated organizational profiles yet. A mission anchors to a 3C <a href="org-validation.html">Validation</a> profile — run a campaign and record at least one response first.</div>';
    } else {
      // anchors without a mission → can start one
      var withMission = {};
      s.missions.forEach(function (m) { withMission[m.campaign_id] = true; });
      var openable = s.anchors.filter(function (a) { return !withMission[a.campaign_id]; });
      if (openable.length) {
        body += '<div class="mg-pnote" style="margin-bottom:8px;color:var(--mg-acc)">DEFINE A MISSION FOR A VALIDATED PROFILE</div>';
        body += openable.map(function (a) {
          return '<div class="mg-card"><div><div class="cn">' + esc(a.company_name) + '</div><div class="cm">' + titleCase(a.stage) + ' · validated profile</div></div>' +
            '<button class="mg-act primary" data-act="new-mission" data-cid="' + a.campaign_id + '">Define mission</button></div>';
        }).join('');
      }
      if (s.missions.length) {
        body += '<div class="mg-pnote" style="margin:16px 0 8px;color:var(--mg-acc)">MISSIONS</div>';
        body += s.missions.map(function (m) {
          var f = M.getMission(m.mission_id);
          var isOpen = activeMission === m.mission_id;
          return '<div class="mg-card"><div><div class="cn">' + esc(m.title) + '</div>' +
            '<div class="cm">' + esc(m.company_name) + (m.time_horizon ? ' · ' + esc(m.time_horizon) : '') + ' · ' + (f ? f.gaps.length : 0) + ' gaps · ' + (f ? f.recommendations.length : 0) + ' recommendations</div></div>' +
            '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><span class="mg-status active">' + titleCase(m.status) + '</span>' +
            '<button class="mg-act' + (isOpen ? '' : ' primary') + '" data-act="toggle-mission" data-mid="' + m.mission_id + '">' + (isOpen ? 'Close' : 'Open') + '</button></div></div>';
        }).join('');
      }
      // the new-mission form
      if (window.__mgNewFor) {
        var a2 = s.anchors.filter(function (x) { return x.campaign_id === window.__mgNewFor; })[0];
        if (a2) body += missionForm(a2);
      }
    }
    return '<div class="mg-panel"><div class="mg-ptop"><span class="mg-plabel">Missions</span><span class="mg-pnote">a mission is what the org is trying to become · anchored to a validated profile</span></div><div class="mg-pbody">' + body + '</div></div>';
  }

  function missionForm(anchor) {
    return '<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--mg-rule)">' +
      '<div class="mg-pnote" style="margin-bottom:10px;color:var(--mg-acc)">NEW MISSION · ' + esc(anchor.company_name) + '</div>' +
      '<div class="mg-form">' +
      '<span class="mg-flabel">Mission title</span>' +
      '<input id="mg-title" placeholder="e.g. Launch a new AI product line within 12 months" style="min-width:100%">' +
      '<span class="mg-flabel">Description / narrative</span>' +
      '<textarea id="mg-desc" placeholder="What is the organization trying to do, and why now? Paste a mission statement, strategic-plan excerpt, leadership-interview note, or public objective. The richer the language, the higher the mission-frequency confidence."></textarea>' +
      '<span class="mg-flabel">Strategic objectives (comma or newline separated)</span>' +
      '<textarea id="mg-objs" placeholder="e.g. Ship a GA AI product, win 50 reference customers, build an ML platform team" style="min-height:54px"></textarea>' +
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;width:100%">' +
      '<input id="mg-horizon" placeholder="Time horizon — e.g. 12 months" style="min-width:180px">' +
      '<select id="mg-source">' + M.SOURCE_KINDS.map(function (k) { return '<option value="' + k + '">' + titleCase(k) + '</option>'; }).join('') + '</select>' +
      '<button class="mg-act primary" data-act="create-mission" data-cid="' + anchor.campaign_id + '">Create &amp; derive frequency</button>' +
      '<button class="mg-act" data-act="cancel-mission">Cancel</button>' +
      '</div></div></div>';
  }

  /* ============ WORKSPACE ============ */
  function workspace(mid) {
    var f = M.getMission(mid);
    if (!f) return '';
    var m = f.mission, cur = f.current, mf = f.mission_frequency, gaps = f.gaps, cons = f.constraints, recs = f.recommendations, conf = f.confidence;

    var h = '<div class="mg-panel"><div class="mg-ptop"><span class="mg-plabel">Mission Dashboard · ' + esc(m.company_name) + '</span>' +
      '<span class="mg-pnote">' + esc(m.title) + (m.time_horizon ? ' · ' + esc(m.time_horizon) : '') + '</span></div><div class="mg-pbody">';

    // mission confidence card
    h += '<div class="mg-confcard"><div class="cct">Mission confidence: ' + titleCase(conf.level) + '</div><div class="ccr">' + esc(conf.reasoning) + '</div></div>';

    if (m.strategic_objectives && m.strategic_objectives.length) {
      h += '<div class="mg-pnote" style="margin-bottom:8px">Strategic objectives</div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">' +
        m.strategic_objectives.map(function (o) { return '<span class="mg-status" style="text-transform:none;letter-spacing:0.02em;font-size:10px;color:var(--mg-ink2)">' + esc(o) + '</span>'; }).join('') + '</div>';
    }

    if (!mf) {
      h += '<div class="mg-block">⊘ No mission frequency yet. <button class="mg-act" data-act="gen-freq" data-mid="' + mid + '">Derive mission frequency</button></div>';
    } else {
      // ---- current vs mission frequency + gap map ----
      h += '<div class="mg-sech">Current Frequency vs Mission Frequency · Gap Map</div>';
      h += freqGrid(cur, mf, gaps);
      h += '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">' +
        '<button class="mg-act primary" data-act="analyze" data-mid="' + mid + '">' + (gaps.length ? 'Re-run gap + constraint analysis' : 'Run gap + constraint analysis') + '</button>' +
        '<button class="mg-act" data-act="gen-freq" data-mid="' + mid + '">Re-derive mission frequency</button>' +
        '</div>';
    }

    // ---- gaps ----
    if (gaps.length) {
      h += '<div class="mg-sech">Frequency Gaps</div>';
      h += gaps.slice().sort(function (a, b) { return M.SEVERITY.indexOf(b.severity) - M.SEVERITY.indexOf(a.severity); }).map(function (g) {
        return '<div class="mg-item ' + g.severity + '"><div class="imeta"><span class="idim">' + esc(M.DIM_LABELS[g.dimension]) + '</span>' +
          '<span class="mg-sevtag ' + g.severity + '">' + g.severity + '</span>' +
          '<span class="igap">' + esc(g.current_state) + ' → ' + esc(g.required_state) + ' · ' + esc(g.gap_size) + '</span></div>' +
          '<div class="idesc">' + esc(g.reasoning) + '</div></div>';
      }).join('');
    }

    // ---- constraints ----
    if (cons.length) {
      h += '<div class="mg-sech">Constraints · what blocks closing the gap</div>';
      h += cons.slice().sort(function (a, b) { return M.SEVERITY.indexOf(b.severity) - M.SEVERITY.indexOf(a.severity); }).map(function (c) {
        return '<div class="mg-item ' + c.severity + '"><div class="imeta"><span class="idim">' + titleCase(c.constraint_type) + '</span>' +
          '<span class="mg-sevtag ' + c.severity + '">' + c.severity + '</span>' +
          (c.dimension ? '<span class="igap">' + esc(M.DIM_LABELS[c.dimension] || titleCase(c.dimension)) + '</span>' : '') + '</div>' +
          '<div class="idesc">' + esc(c.description) + '</div>' +
          (c.evidence ? '<div class="ireason">' + esc(c.evidence) + '</div>' : '') + '</div>';
      }).join('');
    }

    // ---- recommendations ----
    if (recs.length) {
      h += '<div class="mg-sech">Priority Recommendations · organizational moves</div>';
      var order = { critical: 0, high: 1, medium: 2, low: 3 };
      h += recs.slice().sort(function (a, b) { return order[a.priority] - order[b.priority]; }).map(function (r) {
        return '<div class="mg-item ' + r.priority + '"><div class="imeta"><span class="mg-sevtag ' + r.priority + '">' + r.priority + '</span>' +
          '<span class="idim">' + esc(M.DIM_LABELS[r.dimension] || titleCase(r.dimension)) + '</span></div>' +
          '<div class="ititle">' + esc(r.title) + '</div>' +
          '<div class="idesc">' + esc(r.description) + '</div>' +
          (r.reasoning ? '<div class="ireason">' + esc(r.reasoning) + '</div>' : '') + '</div>';
      }).join('');
    } else if (mf && !gaps.length) {
      h += '<div class="mg-empty" style="margin-top:14px">Run the gap analysis to surface constraints and priority recommendations.</div>';
    }

    h += '</div></div>';
    return h;
  }

  function freqGrid(cur, mf, gaps) {
    var gapBy = {}; gaps.forEach(function (g) { gapBy[g.dimension] = g; });
    var h = '<div class="mg-freq">' +
      '<div class="fhead">Dimension</div><div class="fhead">Current</div><div class="fhead">Mission needs</div><div class="fhead">Gap</div>';
    M.MISSION_DIMS.forEach(function (dim) {
      var c = cur.dimensions[dim], r = mf.dimensions[dim];
      var g = gapBy[dim];
      var gapTxt;
      if (g) gapTxt = '<span class="mg-sevtag ' + g.severity + '">' + g.severity + '</span> <span class="mg-gapcell">' + esc(g.gap_size) + '</span>';
      else gapTxt = '<span class="mg-gapcell mg-aligned">aligned ✓</span>';
      h += '<div class="frow" style="display:contents">' +
        '<div class="fcell"><span class="fdim">' + esc(M.DIM_LABELS[dim]) + '</span></div>' +
        '<div class="fcell"><span class="mg-lv ' + c.level + '">' + esc(c.level) + '</span> <span class="mg-conf ' + c.confidence + '">' + esc(c.confidence) + '</span></div>' +
        '<div class="fcell"><span class="mg-lv ' + r.level + '">' + esc(r.level) + '</span></div>' +
        '<div class="fcell">' + gapTxt + '</div>' +
        '</div>';
    });
    h += '</div>';
    h += '<div class="mg-pnote" style="margin-top:8px;text-transform:none;font-style:italic;color:var(--mg-ink3)">Mission frequency: ' + esc(mf.reasoning) + '</div>';
    return h;
  }

  /* ============ EVENTS ============ */
  function wire(s) {
    each('[data-act]', function (btn) {
      btn.addEventListener('click', function () {
        var act = btn.getAttribute('data-act'), res;
        if (act === 'new-mission') {
          window.__mgNewFor = btn.getAttribute('data-cid');
          render();
          var el = document.getElementById('mg-title'); if (el) el.focus();
        }
        else if (act === 'cancel-mission') { window.__mgNewFor = null; render(); }
        else if (act === 'create-mission') {
          var cid = btn.getAttribute('data-cid');
          var title = document.getElementById('mg-title').value.trim();
          if (!title) { toast('Give the mission a title.'); return; }
          res = M.createMission(cid, {
            title: title,
            description: document.getElementById('mg-desc').value.trim(),
            strategic_objectives: document.getElementById('mg-objs').value.trim(),
            time_horizon: document.getElementById('mg-horizon').value.trim(),
            source_kind: document.getElementById('mg-source').value
          });
          if (res.error) { toast(res.error); return; }
          // immediately derive the mission frequency + run analysis
          M.generateMissionFrequency(res.mission.mission_id);
          M.analyze(res.mission.mission_id);
          window.__mgNewFor = null;
          activeMission = res.mission.mission_id;
          toast('Mission created · frequency derived · gaps analyzed.');
          render();
        }
        else if (act === 'toggle-mission') {
          var mid = btn.getAttribute('data-mid');
          activeMission = (activeMission === mid) ? null : mid;
          render();
        }
        else if (act === 'gen-freq') {
          res = M.generateMissionFrequency(btn.getAttribute('data-mid'));
          if (res.error) { toast(res.error); return; }
          M.analyze(btn.getAttribute('data-mid'));
          toast('Mission frequency derived (confidence ' + res.mission_frequency.confidence + ') · gaps analyzed.');
          render();
        }
        else if (act === 'analyze') {
          res = M.analyze(btn.getAttribute('data-mid'));
          if (res.error) { toast(res.error); return; }
          toast(res.gaps.length + ' gaps · ' + res.constraints.length + ' constraints · ' + res.recommendations.length + ' recommendations.');
          render();
        }
      });
    });
  }
  function each(sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), fn); }

  var reset = document.getElementById('mg-reset');
  if (reset) reset.addEventListener('click', function () {
    if (confirm('Reset all Mission & Gap data on this device? (Missions, mission frequencies, gaps, constraints, recommendations.) The 3C validated profiles are NOT touched.')) {
      M.resetMissionGap(); activeMission = null; window.__mgNewFor = null; toast('Missions reset.'); render();
    }
  });

  render();
})();
