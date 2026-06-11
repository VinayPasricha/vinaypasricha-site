/* =============================================================
   mandates-admin.js — Studio · Mission-to-Mandate Runtime  (1J)
   =============================================================
   The bridge from understanding to execution. Choose a defined
   role, hear Aeon1 explain the two honest journeys (Fast / Deep),
   pick a lane, and generate a Mandate.

   Per mandate it shows the chain Mission ↓ Gap ↓ Role ↓ Mandate,
   the constitutional WHY (why this role exists, stated first), the
   Mission Contribution, the Success Definition, confidence, lane,
   status, and — for the Deep Lane — the discovery proposal hook
   (Build 1K). No sourcing, candidates, or matching.
   ============================================================= */
(function () {
  'use strict';
  var OF = window.OF;
  var M = OF.mandate;

  var statsEl   = document.getElementById('md-stats');
  var composeEl = document.getElementById('md-compose');
  var listEl    = document.getElementById('md-list');

  function esc(s) {
    return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function render() {
    var store = M.ensure(OF.load());
    var roles = M.mandatableRoles(store);
    var mandates = M.getMandates(store);
    var open = roles.filter(function (r) { return !r.has_mandate; });

    var nActive = mandates.filter(function (d) { return d.mandate.mandate_status === 'active'; }).length;
    var nDeep = mandates.filter(function (d) { return d.mandate.lane_type === 'deep'; }).length;
    statsEl.innerHTML =
      '<span><b>' + mandates.length + '</b> mandate' + (mandates.length === 1 ? '' : 's') + '</span>' +
      '<span><b>' + roles.length + '</b> defined role' + (roles.length === 1 ? '' : 's') + '</span>' +
      '<span><b>' + nActive + '</b> active</span>' +
      '<span><b>' + nDeep + '</b> deep lane</span>';

    renderCompose(open);

    if (!mandates.length) {
      listEl.innerHTML =
        '<div class="md-empty">No mandates yet.<br>' +
        (open.length
          ? 'Choose a role above, then pick a lane to generate its mandate.'
          : (roles.length ? 'Every defined role already has a mandate.' : 'You need a <a href="missions.html">defined role</a> first — a mandate is generated from a role, its purpose and the gap it closes.')) +
        '</div>';
      return;
    }
    listEl.innerHTML = mandates.map(renderMandate).join('');
  }

  /* ---- compose: role pick → Aeon1 two journeys → lane buttons ---- */
  function renderCompose(open) {
    if (!open.length) {
      composeEl.innerHTML =
        '<div class="md-label">Generate a mandate</div>' +
        '<div class="md-cq" style="margin:0">' +
          (M.mandatableRoles(OF.load()).length
            ? 'Every defined role already has a mandate. Define another role in <a href="missions.html" style="color:var(--md-freq)">Missions</a> to generate more.'
            : 'No defined role yet. A mandate is generated from a role — define one in <a href="missions.html" style="color:var(--md-freq)">Missions</a> (purpose before title).') +
        '</div>';
      return;
    }
    var fast = M.LANES.fast, deep = M.LANES.deep;
    composeEl.innerHTML =
      '<div class="md-label">Generate a mandate · from a defined role</div>' +
      '<div class="md-rolepick">' +
        '<div class="md-field"><label>Role (mission · org)</label><select id="md-role">' +
          open.map(function (r) { return '<option value="' + esc(r.role_id) + '">' + esc(r.label) + '</option>'; }).join('') +
        '</select></div>' +
      '</div>' +

      '<div class="md-aeon"><div class="who">Aeon1</div><div class="say">' +
        'Now that the role is defined, there are <em>two possible journeys</em> from here. I\u2019ll lay both out plainly — ' +
        'neither is the \u201cright\u201d answer, and the lighter one is free. Choose whichever fits where you actually are.' +
      '</div></div>' +

      '<div class="md-lanes">' +
        laneCard(fast) +
        laneCard(deep) +
      '</div>' +
      '<div class="md-nopressure">Honest tradeoffs · no pressure · the Fast Lane is free and you can move to Deep later</div>';
  }

  function laneCard(lane) {
    return '<div class="md-lane ' + esc(lane.key) + '">' +
      '<div class="md-lane-top"><div class="md-lane-name">' + esc(lane.title) + '</div>' +
        '<span class="md-lane-price">' + esc(lane.price) + '</span></div>' +
      '<div class="md-lane-tag">' + esc(lane.tagline) + '</div>' +
      '<div class="md-lane-blurb">' + esc(lane.blurb) + '</div>' +
      '<div class="md-lane-flow">' + lane.flow.map(function (s, i) { return (i ? '<b>→</b> ' : '') + esc(s); }).join(' ') + '</div>' +
      '<ul class="md-lane-good">' + lane.good_for.map(function (g) { return '<li>' + esc(g) + '</li>'; }).join('') + '</ul>' +
      '<button class="md-lanebtn" type="button" data-lane="' + esc(lane.key) + '">Generate ' + esc(lane.title) + ' mandate →</button>' +
    '</div>';
  }

  /* ---- one mandate ----------------------------------------- */
  function renderMandate(d) {
    var m = d.mandate, role = d.role, mis = d.mission, org = d.organization, gap = d.gap;
    var sd = d.success_definition, mc = d.mission_contribution;
    var dimGap = gap && role ? (gap.dimension_gaps || []).filter(function (g) { return g.dimension === role.dimension; })[0] : null;

    var chain =
      '<div class="md-chain">' +
        '<b>' + esc(mis ? (mis.mission_name || 'mission') : 'mission') + '</b><span class="arr">↓ gap</span>' +
        '<b>' + esc(dimGap ? (role.dimension + ' · ' + dimGap.gap_level) : (role ? role.dimension : '—')) + '</b><span class="arr">↓ role</span>' +
        '<b>' + esc(role ? role.role_name : '—') + '</b><span class="arr">↓</span>' +
        '<span class="mandate-node">mandate</span>' +
      '</div>';

    var why =
      '<div class="md-why">' +
        '<div class="wl">Why this role exists · stated before who fills it</div>' +
        '<div class="wt">' + esc(m.mandate_summary) + '</div>' +
      '</div>';

    var contribution = mc ?
      '<div class="md-cell">' +
        '<div class="md-clabel">Mission Contribution</div>' +
        '<div class="md-cq">Why does this mandate exist?</div>' +
        '<div class="md-kv">' + esc(mc.contribution_summary) + '</div>' +
        (mc.frequency_gaps_addressed && mc.frequency_gaps_addressed.length
          ? '<div class="md-kv"><span class="k">Frequency gaps addressed</span><ul class="md-list">' +
            mc.frequency_gaps_addressed.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' : '') +
        (mc.expected_capabilities_created && mc.expected_capabilities_created.length
          ? '<div class="md-kv"><span class="k">Expected capabilities created</span><ul class="md-list">' +
            mc.expected_capabilities_created.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' : '') +
      '</div>' : '';

    var success = sd ?
      '<div class="md-cell">' +
        '<div class="md-clabel">Success Definition</div>' +
        '<div class="md-cq">What does success look like? (not: who should we hire?)</div>' +
        '<div class="md-kv"><span class="k">Role success</span>' + esc(sd.role_success) + '</div>' +
        '<div class="md-kv"><span class="k">Mission success</span>' + esc(sd.mission_success) + '</div>' +
        '<div class="md-kv"><span class="k">Organization success</span>' + esc(sd.organization_success) + '</div>' +
        '<div class="md-kv"><span class="k">Time horizon</span><em>' + esc(sd.time_horizon) + '</em></div>' +
      '</div>' : '';

    var deep = (m.lane_type === 'deep' && m.deep_discovery) ?
      '<div class="md-deep">' +
        '<div class="dl">Deep Discovery Proposal · hook for Build 1K</div>' +
        '<div class="dn">' + esc(m.deep_discovery.note) + ' These interviews are <em>proposed</em> here — the Deep Discovery Runtime that conducts them, across website / email / WhatsApp / voice, is now available.</div>' +
        '<div class="md-interviews">' +
          (m.deep_discovery.interviews || []).map(function (iv) {
            return '<span class="md-interview">' + esc(iv.type.replace(/_/g, ' ')) + ' <span class="s">· ' + esc(iv.status) + '</span></span>';
          }).join('') +
        '</div>' +
        '<a class="md-lanebtn" href="discovery.html" style="text-decoration:none;display:inline-block;margin-top:14px;max-width:280px">Open Deep Discovery →</a>' +
      '</div>' : '';

    var statusBtns = M.MANDATE_STATUS.map(function (s) {
      return '<button class="md-sbtn' + (m.mandate_status === s ? ' on' : '') + '" type="button" data-status="' + esc(m.mandate_id) + '" data-to="' + s + '">' + esc(s) + '</button>';
    }).join('');

    return '<div class="md-mandate ' + esc(m.lane_type) + '" data-mandate="' + esc(m.mandate_id) + '">' +
      '<div class="md-mtop">' +
        '<div>' +
          '<div class="md-mname">' + esc(role ? role.role_name : 'Mandate') + '</div>' +
          '<div class="md-mid">' + esc(m.mandate_id) + ' · ' + esc((m.created_at || '').slice(0, 10)) + '</div>' +
        '</div>' +
        '<div class="md-badges">' +
          '<span class="md-badge lane-' + esc(m.lane_type) + '">' + esc(m.lane_type) + ' lane</span>' +
          '<span class="md-badge st-' + esc(m.mandate_status) + '">' + esc(m.mandate_status) + '</span>' +
          '<span class="md-cbadge ' + esc(m.confidence) + '">confidence · ' + esc(m.confidence) + '</span>' +
        '</div>' +
      '</div>' +
      chain +
      why +
      '<div class="md-grid">' + contribution + success + '</div>' +
      deep +
      '<div class="md-foot">' +
        '<div class="md-status-controls"><span class="lbl">Status</span>' + statusBtns + '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
          '<a class="md-delbtn" href="../studio/hiring.html" style="text-decoration:none;border-color:var(--md-freq3);color:var(--md-freq)">Run this mandate (hiring) →</a>' +
          '<button class="md-delbtn" type="button" data-delmandate="' + esc(m.mandate_id) + '">Delete mandate</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ---- events ---------------------------------------------- */
  // generate a mandate (lane buttons in compose)
  composeEl.addEventListener('click', function (e) {
    var lb = e.target.closest && e.target.closest('[data-lane]');
    if (!lb) return;
    var sel = document.getElementById('md-role');
    if (!sel || !sel.value) return;
    M.generateMandate(sel.value, lb.getAttribute('data-lane'));
    render();
  });

  // status + delete (delegated on list)
  listEl.addEventListener('click', function (e) {
    var st = e.target.closest && e.target.closest('[data-status]');
    if (st) { M.setStatus(st.getAttribute('data-status'), st.getAttribute('data-to')); render(); return; }
    var del = e.target.closest && e.target.closest('[data-delmandate]');
    if (del) {
      if (confirm('Delete this mandate and its success definition + mission contribution?')) {
        M.deleteMandate(del.getAttribute('data-delmandate'));
        render();
      }
      return;
    }
  });

  document.getElementById('md-reset').addEventListener('click', function () {
    if (confirm('Clear all mandates on this device? Success definitions, mission contributions and lane selections will be removed.')) {
      var store = M.ensure(OF.load());
      store.mandates = [];
      store.mandate_success_definitions = [];
      store.mission_contributions = [];
      store.lane_selections = [];
      OF.save(store);
      render();
    }
  });

  render();
})();
