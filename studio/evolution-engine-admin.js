/* Organizational Evolution Engine (Build 3E)
   Renders OF.evolengine over the shared of.runtime.v1 store.
   Reads 3D missions/gaps; tracks evolution toward the mission frequency. */
(function () {
  'use strict';
  if (!window.OF || !window.OF.evolengine) { console.warn('evolution-engine-admin.js requires of-evolution-engine.js'); return; }
  var E = window.OF.evolengine;

  var viewEl = document.getElementById('ee-view');
  var railEl = document.getElementById('ee-rail');
  var statsEl = document.getElementById('ee-stats');
  var toastEl = document.getElementById('ee-toast');

  var activePath = null;
  var recordFor = null;   // milestone_id the record-event form is open against ('path' = path-level)

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function titleCase(s) { return String(s || '').replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }
  function dimLabel(d) { return E.DIM_LABELS[d] || titleCase(d); }
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(function () { toastEl.classList.remove('show'); }, 2800); }

  function render() {
    var s = E.snapshot();
    renderRail(s);
    renderStats(s);
    var html = pathsPanel(s);
    if (activePath) html += workspace(activePath);
    viewEl.innerHTML = html;
    wire(s);
  }

  function renderRail(s) {
    var f = activePath ? E.getPath(activePath) : null;
    var hasPath = s.counts.paths > 0;
    var hasMile = s.counts.milestones > 0;
    var hasEvt = s.counts.events > 0;
    var someAchieved = s.counts.achieved > 0;
    var stages = [
      { n: '01', t: 'Mission gap (3D)', done: s.counts.anchors > 0 },
      { n: '02', t: 'Evolution path', done: hasPath, now: s.anchors.some(function (a) { return a.ready && !a.has_path; }) && !hasPath },
      { n: '03', t: 'Milestones', done: hasMile },
      { n: '04', t: 'Evolution events', done: hasEvt, now: hasMile && !hasEvt },
      { n: '05', t: 'Progress tracking', done: someAchieved },
      { n: '06', t: 'Frequency Evolution (1L)', done: hasEvt },
      { n: '07', t: 'Updated frequency', done: f && f.progress.pct === 100 }
    ];
    railEl.innerHTML = stages.map(function (st) {
      var cls = st.done ? 'done' : (st.now ? 'now' : '');
      return '<div class="ee-stage ' + cls + '"><div class="sn">' + st.n + (st.done ? ' <span class="tick">✓</span>' : '') + '</div><div class="st">' + st.t + '</div></div>';
    }).join('');
  }

  function renderStats(s) {
    var c = s.counts;
    statsEl.innerHTML =
      stat(c.paths, 'Paths') +
      stat(c.achieved + ' / ' + c.milestones, 'Milestones done') +
      stat(c.events, 'Evolution events') +
      stat(c.indicators, 'Tracked dimensions');
  }
  function stat(n, l) { return '<div class="ee-stat"><div class="n">' + n + '</div><div class="l">' + l + '</div></div>'; }

  /* ============ PATHS + anchor picker ============ */
  function pathsPanel(s) {
    var body = '';
    if (!s.anchors.length) {
      body = '<div class="ee-empty">No missions with a gap analysis yet. Define a mission and run its gap analysis in <a href="mission-gap.html">Mission &amp; Gaps (3D)</a> — an evolution path is built from the gaps.</div>';
    } else {
      var openable = s.anchors.filter(function (a) { return a.ready && !a.has_path; });
      var notReady = s.anchors.filter(function (a) { return !a.ready && !a.has_path; });
      if (openable.length) {
        body += '<div class="ee-pnote" style="margin-bottom:8px;color:var(--ee-acc)">BUILD A PATH FROM A MISSION GAP ANALYSIS</div>';
        body += openable.map(function (a) {
          return '<div class="ee-card"><div><div class="cn">' + esc(a.title) + '</div><div class="cm">' + esc(a.company_name) + (a.time_horizon ? ' · ' + esc(a.time_horizon) : '') + ' · ' + a.gaps + ' gaps</div></div>' +
            '<button class="ee-act primary" data-act="new-path" data-mid="' + a.mission_id + '">Build evolution path</button></div>';
        }).join('');
      }
      if (s.paths.length) {
        body += '<div class="ee-pnote" style="margin:16px 0 8px;color:var(--ee-acc)">EVOLUTION PATHS</div>';
        body += s.paths.map(function (p) {
          var f = E.getPath(p.path_id);
          var isOpen = activePath === p.path_id;
          return '<div class="ee-card"><div><div class="cn">' + esc(p.company_name) + '</div>' +
            '<div class="cm">' + (f ? f.progress.achieved + '/' + f.progress.total + ' milestones · ' + f.progress.pct + '% · ' + f.events.length + ' events' : '') + '</div></div>' +
            '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><span class="ee-status ' + p.status + '">' + titleCase(p.status) + '</span>' +
            '<button class="ee-act' + (isOpen ? '' : ' primary') + '" data-act="toggle-path" data-pid="' + p.path_id + '">' + (isOpen ? 'Close' : 'Open') + '</button></div></div>';
        }).join('');
      }
      if (notReady.length) {
        body += '<div class="ee-pnote" style="margin:16px 0 8px;color:var(--ee-ink4)">NOT YET READY — run the gap analysis in 3D first</div>';
        body += notReady.map(function (a) {
          return '<div class="ee-card" style="opacity:.6"><div><div class="cn">' + esc(a.title) + '</div><div class="cm">' + esc(a.company_name) + ' · no gap analysis</div></div>' +
            '<a class="ee-act" href="mission-gap.html">Open 3D ↗</a></div>';
        }).join('');
      }
    }
    return '<div class="ee-panel"><div class="ee-ptop"><span class="ee-plabel">Evolution Paths</span><span class="ee-pnote">plausible pathways from current frequency toward mission frequency · observed, not imposed</span></div><div class="ee-pbody">' + body + '</div></div>';
  }

  /* ============ WORKSPACE ============ */
  function workspace(pid) {
    var f = E.getPath(pid);
    if (!f) return '';
    var p = f.path, mission = f.mission, miles = f.milestones, events = f.events, inds = f.indicators, recs = f.recommendations, prog = f.progress;

    var h = '<div class="ee-panel"><div class="ee-ptop"><span class="ee-plabel">Evolution Dashboard · ' + esc(p.company_name) + '</span>' +
      '<span class="ee-pnote">' + (mission ? esc(mission.mission.title) : '') + (mission && mission.mission.time_horizon ? ' · ' + esc(mission.mission.time_horizon) : '') + '</span></div><div class="ee-pbody">';

    // overall progress
    h += '<div class="ee-progwrap"><div class="ee-progmeta"><span>Overall evolution progress</span><span>' + prog.achieved + ' / ' + prog.total + ' milestones · ' + prog.pct + '%</span></div>' +
      '<div class="ee-progbar"><div class="ee-progfill" style="width:' + prog.pct + '%"></div></div></div>';

    // ---- progress indicators: current → target ----
    h += '<div class="ee-sech">Progress Tracking · current → target frequency</div>';
    if (!inds.length) h += '<div class="ee-empty">No tracked dimensions.</div>';
    else h += inds.map(indRow).join('');

    // ---- record an evolution event (path level) ----
    h += '<div class="ee-sech">Record an Evolution Event</div>';
    h += '<div class="ee-pnote" style="margin-bottom:10px;text-transform:none;font-style:italic;color:var(--ee-ink3)">When the organization actually changes, record it here. Progress moves only on real, observed change — and each event writes a Frequency Evolution entry.</div>';
    h += recordForm(pid, miles, null);

    // ---- milestones grouped by dimension ----
    h += '<div class="ee-sech">Milestones · the plausible pathway</div>';
    var byDim = {};
    miles.forEach(function (m) { (byDim[m.dimension] = byDim[m.dimension] || []).push(m); });
    Object.keys(byDim).forEach(function (dim) {
      h += '<div class="ee-group"><div class="ee-grouph"><span class="gd">' + esc(dimLabel(dim)) + '</span><span class="gline"></span></div>';
      h += byDim[dim].map(function (m) { return mileRow(m); }).join('');
      h += '</div>';
    });

    // ---- events timeline ----
    h += '<div class="ee-sech">Evolution Events · observed changes</div>';
    if (!events.length) h += '<div class="ee-empty">No events recorded yet. The org has not been observed to change — progress stays put until it does.</div>';
    else h += events.map(evtRow).join('');

    // ---- recommendations ----
    if (recs.length) {
      h += '<div class="ee-sech">Evolution Recommendations · sequencing &amp; moves</div>';
      var order = { critical: 0, high: 1, medium: 2, low: 3 };
      h += recs.slice().sort(function (a, b) { return order[a.priority] - order[b.priority]; }).map(function (r) {
        return '<div class="ee-rec ' + r.priority + '"><div class="rmeta"><span class="ee-pri ' + r.priority + '">' + r.priority + '</span><span class="rdim">' + esc(dimLabel(r.dimension)) + '</span></div>' +
          '<div class="rt">' + esc(r.recommendation) + '</div>' +
          (r.reasoning ? '<div class="rr">' + esc(r.reasoning) + '</div>' : '') + '</div>';
      }).join('');
    }

    h += '</div></div>';
    return h;
  }

  function indRow(ind) {
    var ord = { unknown: 0, low: 1, medium: 2, high: 3 };
    var sOrd = ord[ind.starting_state] || 0, cOrd = ord[ind.current_state] || 0, tOrd = ord[ind.target_state] || 3;
    var dots = '';
    for (var i = 1; i <= 3; i++) {
      var cls = 'ee-dot';
      if (i <= cOrd) cls += ' filled';
      if (i === sOrd && i > cOrd) cls += ' start';
      dots += '<span class="' + cls + '"></span>';
    }
    return '<div class="ee-ind"><div class="idn">' + esc(dimLabel(ind.dimension)) + '</div>' +
      '<div class="ee-track"><span class="ee-lv ' + ind.starting_state + '">' + esc(ind.starting_state) + '</span>' +
      '<div class="ee-dots">' + dots + '</div>' +
      '<span class="ee-arrow">→</span><span class="ee-lv ' + ind.target_state + '">' + esc(ind.target_state) + '</span></div>' +
      '<div class="ee-trend ' + ind.trend + '">' + trendGlyph(ind.trend) + ' ' + ind.trend + '</div>' +
      '<div class="ee-cf ' + ind.confidence + '">conf ' + esc(ind.confidence) + '</div></div>';
  }
  function trendGlyph(t) { return t === 'improving' ? '▲' : t === 'declining' ? '▼' : t === 'stable' ? '▬' : '·'; }

  function mileRow(m) {
    var canRecord = m.status !== 'achieved' && m.status !== 'abandoned';
    var h = '<div class="ee-mile ' + m.status + '"><div class="seq">' + (m.status === 'achieved' ? '✓' : m.sequence_order) + '</div>' +
      '<div class="mbody"><div class="mt">' + esc(m.title) + '</div><div class="md">' + esc(m.description) + '</div>' +
      '<div class="mmeta">' +
        (m.is_validation ? '<span class="ee-validtag">validation step</span>' : '') +
        '<span class="ee-pri ' + m.priority + '">' + m.priority + '</span>' +
        '<span class="ee-mstat ' + m.status + '">' + titleCase(m.status) + '</span>' +
        '<span class="ee-mstat">target: ' + esc(m.target_state) + '</span>' +
      '</div>' +
      (recordFor === m.milestone_id ? recordForm(m.path_id, null, m) : '') +
      '</div>' +
      '<div class="mact">' +
        (canRecord ? '<button class="ee-act pos" data-act="open-record" data-mid="' + m.milestone_id + '" data-pid="' + m.path_id + '">Record change</button>' : '') +
        (m.status === 'achieved' ? '<button class="ee-act" data-act="mstatus" data-mid="' + m.milestone_id + '" data-status="active">Reopen</button>' : '') +
      '</div></div>';
    return h;
  }

  function recordForm(pathId, miles, milestone) {
    var idsfx = milestone ? milestone.milestone_id : 'path';
    var milePicker = '';
    if (!milestone && miles) {
      var open = miles.filter(function (m) { return m.status !== 'achieved' && m.status !== 'abandoned'; });
      milePicker = '<select id="ee-rmile-' + idsfx + '"><option value="">— against a milestone (optional) —</option>' +
        open.map(function (m) { return '<option value="' + m.milestone_id + '">' + esc(dimLabel(m.dimension)) + ': ' + esc(m.title) + '</option>'; }).join('') + '</select>';
    }
    var typeSel = '<select id="ee-rtype-' + idsfx + '">' + E.EVENT_TYPES.map(function (t) { return '<option value="' + t + '">' + titleCase(t) + '</option>'; }).join('') + '</select>';
    var dirSel = '<select id="ee-rdir-' + idsfx + '"><option value="forward">Forward</option><option value="setback">Setback</option><option value="neutral">Neutral</option></select>';
    return '<div class="ee-form" style="margin-top:' + (milestone ? '9px' : '0') + ';padding-top:' + (milestone ? '9px;border-top:1px solid var(--ee-rule)' : '0') + '">' +
      milePicker + typeSel + dirSel +
      '<textarea id="ee-rdesc-' + idsfx + '" placeholder="What changed in the organization? e.g. \'Spun up a dedicated ML platform team reporting to the CTO.\'"></textarea>' +
      '<input id="ee-revid-' + idsfx + '" placeholder="Evidence (optional) — link, note, who observed it" style="min-width:100%">' +
      '<label style="display:flex;align-items:center;gap:6px;font-family:var(--ee-mono);font-size:9px;letter-spacing:0.06em;text-transform:uppercase;color:var(--ee-ink3)"><input type="checkbox" id="ee-rdone-' + idsfx + '" style="accent-color:var(--ee-pos)"> mark milestone achieved</label>' +
      '<button class="ee-act pos" data-act="record" data-pid="' + pathId + '" data-sfx="' + idsfx + '"' + (milestone ? ' data-mid="' + milestone.milestone_id + '"' : '') + '>Record event</button>' +
      (milestone ? '<button class="ee-act" data-act="cancel-record">Cancel</button>' : '') +
      '</div>';
  }

  function evtRow(e) {
    return '<div class="ee-evt ' + (e.direction === 'setback' ? 'setback' : e.event_type) + '">' +
      '<div class="ed"><b>' + titleCase(e.event_type) + '</b>' + (e.dimension ? ' · ' + esc(dimLabel(e.dimension)) : '') + ' — ' + esc(e.description) + '</div>' +
      '<div class="em">' + esc(e.direction) + (e.frequency_evolution_event_id ? ' · <span class="freq">↳ frequency evolution event written</span>' : '') + ' · ' + new Date(e.created_at).toLocaleDateString() + '</div>' +
      (e.evidence ? '<div class="ev-ev">“' + esc(e.evidence) + '”</div>' : '') + '</div>';
  }

  /* ============ EVENTS ============ */
  function wire(s) {
    each('[data-act]', function (btn) {
      btn.addEventListener('click', function () {
        var act = btn.getAttribute('data-act'), res;
        if (act === 'new-path') {
          res = E.createPath(btn.getAttribute('data-mid'));
          if (res.error) { toast(res.error); if (res.path) { activePath = res.path.path_id; render(); } return; }
          activePath = res.path.path_id;
          toast('Evolution path built from the gap analysis.');
          render();
        }
        else if (act === 'toggle-path') {
          var pid = btn.getAttribute('data-pid');
          activePath = (activePath === pid) ? null : pid; recordFor = null;
          render();
        }
        else if (act === 'open-record') {
          recordFor = btn.getAttribute('data-mid');
          render();
          var el = document.getElementById('ee-rdesc-' + recordFor); if (el) el.focus();
        }
        else if (act === 'cancel-record') { recordFor = null; render(); }
        else if (act === 'mstatus') {
          res = E.setMilestoneStatus(btn.getAttribute('data-mid'), btn.getAttribute('data-status'));
          if (res.error) { toast(res.error); return; }
          toast('Milestone ' + btn.getAttribute('data-status') + '.');
          render();
        }
        else if (act === 'record') {
          var sfx = btn.getAttribute('data-sfx');
          var desc = document.getElementById('ee-rdesc-' + sfx).value.trim();
          if (!desc) { toast('Describe what changed.'); return; }
          var mid = btn.getAttribute('data-mid') || (document.getElementById('ee-rmile-' + sfx) ? document.getElementById('ee-rmile-' + sfx).value : '');
          res = E.recordEvent(btn.getAttribute('data-pid'), {
            milestone_id: mid || null,
            event_type: document.getElementById('ee-rtype-' + sfx).value,
            direction: document.getElementById('ee-rdir-' + sfx).value,
            description: desc,
            evidence: document.getElementById('ee-revid-' + sfx).value.trim(),
            mark_achieved: document.getElementById('ee-rdone-' + sfx).checked
          });
          if (res.error) { toast(res.error); return; }
          recordFor = null;
          toast('Event recorded · progress updated · frequency evolution written.');
          render();
        }
      });
    });
  }
  function each(sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), fn); }

  var reset = document.getElementById('ee-reset');
  if (reset) reset.addEventListener('click', function () {
    if (confirm('Reset all Organizational Evolution data on this device? (Paths, milestones, events, progress indicators, recommendations.) The 3D missions and 3C profiles are NOT touched.')) {
      E.resetEvolution(); activePath = null; recordFor = null; toast('Evolution reset.'); render();
    }
  });

  render();
})();
