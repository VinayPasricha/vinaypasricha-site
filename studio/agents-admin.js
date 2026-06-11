/* =============================================================
   agents-admin.js — Studio · Autonomous Agent Layer  (2A)
   =============================================================
   Registry + autonomy policies, capability flags, the orchestrator,
   the task queue (run / approve / reject / re-run), and the safety
   log. Blocked tasks show exactly why.
   ============================================================= */
(function () {
  'use strict';
  var OF = window.OF;
  var A = OF.agents;

  var capsEl = document.getElementById('ag-caps');
  var tilesEl = document.getElementById('ag-tiles');
  var registryEl = document.getElementById('ag-registry');
  var tasksEl = document.getElementById('ag-tasks');
  var safetyEl = document.getElementById('ag-safety');

  function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function ttl(s) { return (s || '').replace(/_/g, ' '); }

  function render() {
    var s = A.snapshot();
    // capabilities
    capsEl.innerHTML = Object.keys(s.capabilities).map(function (k) {
      var on = s.capabilities[k];
      return '<span class="ag-cap' + (on ? ' on' : '') + '" data-cap="' + esc(k) + '" style="cursor:pointer" title="click to toggle (reflects real infra)">' + esc(ttl(k)) + ' · ' + (on ? 'live' : 'NOT IMPLEMENTED') + '</span>';
    }).join('');
    // tiles
    tilesEl.innerHTML =
      tile('queued', s.counts.queued, 'Queued') + tile('blocked', s.counts.blocked, 'Blocked') +
      tile('review', s.counts.needs_review, 'Needs review') + tile('done', s.counts.completed, 'Completed');
    // registry + policies
    registryEl.innerHTML = s.agents.filter(function (a) { return a.agent_type !== 'orchestrator'; }).map(function (a) {
      var p = s.policies.filter(function (x) { return x.agent_type === a.agent_type; })[0];
      return '<div class="ag-agent">' +
        '<div><div class="an">' + esc(a.agent_name) + '</div><div class="as">' + esc(a.scope) + '</div></div>' +
        '<div><select data-autonomy="' + esc(a.agent_type) + '">' + A.AUTONOMY_LEVELS.map(function (l) { return '<option value="' + l + '"' + (p && p.allowed_autonomy_level === l ? ' selected' : '') + '>' + esc(ttl(l)) + '</option>'; }).join('') + '</select>' +
          '<div class="as">risk ' + esc(p ? p.risk_level : '—') + ' · limit ' + esc(p ? p.daily_limit : '—') + '/day</div></div>' +
        '<span class="ag-st ' + esc(a.status) + '">' + esc(a.status) + '</span>' +
        '<button class="ag-mini" data-agenttoggle="' + esc(a.agent_type) + '">' + (a.status === 'active' ? 'Pause' : 'Resume') + '</button>' +
      '</div>';
    }).join('');
    // tasks
    tasksEl.innerHTML = s.tasks.length ? s.tasks.map(function (t) {
      var act = '';
      if (t.status === 'queued') act = '<button class="ag-mini" data-run="' + esc(t.task_id) + '">Run</button>';
      else if (t.status === 'needs_human_review') act = '<button class="ag-mini pos" data-approve="' + esc(t.task_id) + '">Approve</button><button class="ag-mini neg" data-reject="' + esc(t.task_id) + '">Reject</button>';
      else if (t.status === 'blocked' || t.status === 'failed') act = '<button class="ag-mini" data-rerun="' + esc(t.task_id) + '">Re-run</button>';
      return '<div class="ag-task">' +
        '<div class="tt">' + esc(ttl(t.task_type)) + '</div>' +
        '<div class="ti">' + esc(t.input_summary || '') +
          (t.block_reason ? '<br><span class="blk">⚠ ' + esc(t.block_reason) + '</span>' : '') +
          (t.output_summary ? '<br><span style="color:var(--ag-pos)">✓ ' + esc(t.output_summary) + '</span>' : '') + '</div>' +
        '<span class="ag-tstat ' + esc(t.status) + '">' + esc(ttl(t.status)) + '</span>' +
        '<div class="ag-tact">' + act + '</div>' +
      '</div>';
    }).join('') : '<div class="ag-empty">No tasks yet. Click <b>Orchestrate</b> to detect work from active mandates / candidates / joins.</div>';
    // safety log
    safetyEl.innerHTML = s.safety_log.length ? s.safety_log.slice(0, 30).map(function (l) {
      return '<div class="ag-log"><div class="la">' + esc(ttl(l.action)) + '</div>' +
        '<div class="ld ' + esc(l.decision) + '">' + esc(ttl(l.decision)) + ' · ' + esc(l.risk) + '</div>' +
        '<div class="lr">' + esc(l.reason) + '</div></div>';
    }).join('') : '<div class="ag-empty">No autonomous actions yet. Every run, block, approval and rejection is logged here.</div>';
  }
  function tile(cls, n, label) { return '<div class="ag-tile ' + cls + '"><div class="tn">' + n + '</div><div class="tl">' + label + '</div></div>'; }

  document.getElementById('ag-orchestrate').addEventListener('click', function () { A.orchestrate(); render(); });
  document.getElementById('ag-runqueue').addEventListener('click', function () { A.runQueue(); render(); });
  document.getElementById('ag-reset').addEventListener('click', function () { if (confirm('Clear all agent tasks, runs and safety logs? (Registry & policies are kept.)')) { A.resetAgents(); render(); } });

  document.addEventListener('change', function (e) {
    var au = e.target.getAttribute && e.target.getAttribute('data-autonomy');
    if (au) { A.setAutonomy(au, e.target.value); render(); }
  });
  document.addEventListener('click', function (e) {
    var t = e.target;
    var cap = t.getAttribute && t.getAttribute('data-cap'); if (cap) { A.setCapability(cap, !A.CAPABILITIES[cap]); render(); return; }
    var tog = t.getAttribute && t.getAttribute('data-agenttoggle'); if (tog) { var a = A.agentFor(tog, OF.load()); A.setAgentStatus(tog, a && a.status === 'active' ? 'paused' : 'active'); render(); return; }
    var run = t.getAttribute && t.getAttribute('data-run'); if (run) { A.runTask(run); render(); return; }
    var ap = t.getAttribute && t.getAttribute('data-approve'); if (ap) { A.approveTask(ap); render(); return; }
    var rj = t.getAttribute && t.getAttribute('data-reject'); if (rj) { A.rejectTask(rj); render(); return; }
    var rr = t.getAttribute && t.getAttribute('data-rerun'); if (rr) { A.rerunTask(rr); render(); return; }
  });

  render();
})();
