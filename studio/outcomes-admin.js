/* =============================================================
   outcomes-admin.js — Studio · the Emergent Outcome Framework  (1H)
   =============================================================
   The convergence view. Where Mission → Organization → Role →
   Person finally meet and a frame for POSSIBLE FUTURES is held.

   This admin FRAMES outcomes (binds the four objects + horizon,
   attaches traceability + standing assumptions, creates six EMPTY
   sub-outcome containers). It does NOT generate any future — no
   forecasting, no scoring, no ranking. The vectors stay empty and
   confidence stays unassessed until the Emergent Outcome Engine
   (Build 1I).

   Shows per outcome: Mission/Person/Organization/Capability/Risk/
   Evolution outcomes · Time Horizon · Confidence · Assumptions ·
   Evidence — and the chain Mission ↓ Organization ↓ Role ↓ Person
   ↓ Possible Futures.
   ============================================================= */
(function () {
  'use strict';
  var OF = window.OF;
  var O = OF.outcome;

  var statsEl   = document.getElementById('oc-stats');
  var composeEl = document.getElementById('oc-compose');
  var listEl    = document.getElementById('oc-list');

  function esc(s) {
    return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function render() {
    var store = O.ensure(OF.load());
    var fr = O.frameable(store);
    var outcomes = O.getOutcomes(store);

    var nGen = outcomes.filter(function (x) { return x.outcome.generated; }).length;
    statsEl.innerHTML =
      '<span><b>' + outcomes.length + '</b> outcome frame' + (outcomes.length === 1 ? '' : 's') + '</span>' +
      '<span><b>' + fr.roles.length + '</b> defined role' + (fr.roles.length === 1 ? '' : 's') + '</span>' +
      '<span><b>' + fr.people.length + '</b> ' + (fr.people.length === 1 ? 'person' : 'people') + '</span>' +
      '<span><b>' + nGen + '</b> generated <span style="color:var(--oc-ink4)">· emergent hypotheses, not predictions</span></span>';

    renderCompose(fr);

    if (!outcomes.length) {
      listEl.innerHTML =
        '<div class="oc-empty">No outcome frames yet.<br>' +
        (fr.roles.length && fr.people.length
          ? 'Choose a role and a person above, then <em>frame possible futures</em>.'
          : 'You need at least one <a href="missions.html">defined role</a> and one <a href="people.html">discovered person</a> before a future can be framed.') +
        '</div>';
      return;
    }
    listEl.innerHTML = outcomes.map(renderOutcome).join('');
  }

  /* ---- compose / frame control ----------------------------- */
  function renderCompose(fr) {
    if (!fr.roles.length || !fr.people.length) {
      composeEl.innerHTML =
        '<div class="oc-label">Frame possible futures</div>' +
        '<div class="oc-compose-note" style="color:var(--oc-ink3)">' +
          'The convergence needs both sides. ' +
          (fr.roles.length ? '' : 'Define a role in <a href="missions.html" style="color:var(--oc-freq)">Missions</a> (purpose before title). ') +
          (fr.people.length ? '' : 'Discover a person in <a href="people.html" style="color:var(--oc-freq)">People</a>. ') +
          'A future is only framed where a defined role and a discovered person both exist.' +
        '</div>';
      return;
    }
    composeEl.innerHTML =
      '<div class="oc-label">Frame possible futures · a container, not a forecast</div>' +
      '<div class="oc-fields">' +
        '<div class="oc-field"><label>Role (mission · org)</label><select id="oc-role">' +
          fr.roles.map(function (r) { return '<option value="' + esc(r.role_id) + '">' + esc(r.label) + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="oc-field"><label>Person</label><select id="oc-person">' +
          fr.people.map(function (p) { return '<option value="' + esc(p.person_id) + '">' + esc(p.label) + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="oc-field" style="flex:0 0 150px"><label>Time horizon</label><select id="oc-horizon">' +
          fr.horizons.map(function (h) { return '<option value="' + h + '"' + (h === '90_days' ? ' selected' : '') + '>' + esc(O.humanHorizon(h)) + '</option>'; }).join('') +
        '</select></div>' +
        '<button class="oc-framebtn" id="oc-frame" type="button">Frame futures →</button>' +
      '</div>' +
      '<div class="oc-compose-note">Binds the four objects at a horizon and attaches traceability, then creates six empty sub-outcome containers. Run <em>Generate emergent hypotheses</em> on the frame to fill them — per-dimension, hedged, traceable, with descriptive confidence and no scores.</div>';
  }

  /* ---- one outcome frame ----------------------------------- */
  function renderOutcome(d) {
    var o = d.outcome;
    var chain =
      '<div class="oc-converge">' +
        '<div class="cl">Convergence · the whole runtime, in one line</div>' +
        '<div class="oc-chain">' +
          cnode('Mission', d.mission ? (d.mission.mission_name || d.mission.desired_outcome || '—') : '—') +
          carrow() +
          cnode('Organization', d.organization ? d.organization.organization_name : '—') +
          carrow() +
          cnode('Role', d.role ? d.role.role_name : '—') +
          carrow() +
          cnode('Person', d.person ? (d.person.name || 'Unnamed') : '—') +
          carrow() +
          cnodeFuture('Possible futures', o.generated
            ? 'six containers · ' + esc(O.humanHorizon(o.time_horizon)) + ' · confidence ' + esc(o.confidence || 'unknown')
            : 'six containers · ' + esc(O.humanHorizon(o.time_horizon)) + ' · unassessed') +
        '</div>' +
      '</div>';

    var mo = d.mission_outcome, po = d.person_outcome, oo = d.organization_outcome,
        co = d.capability_outcome, ro = d.risk_outcome, eo = d.evolution_outcome;

    var grid =
      '<div class="oc-grid">' +
        subCell('Mission Outcome', 'How might mission execution change?', mo, [
          slot('pos', 'positive trajectories', mo ? mo.positive_trajectories : []),
          slot('neg', 'negative trajectories', mo ? mo.negative_trajectories : [])
        ]) +
        subCell('Person Outcome', 'What future becomes more likely for the person?', po, [
          slot('pos', 'growth vectors', po ? po.growth_vectors : []),
          slot('neutral', 'stagnation vectors', po ? po.stagnation_vectors : []),
          slot('warm', 'stress vectors', po ? po.stress_vectors : [])
        ]) +
        subCell('Organization Outcome', 'What future becomes more likely for the organization?', oo, [
          slot('pos', 'capability gains', oo ? oo.capability_gains : []),
          slot('neg', 'capability losses', oo ? oo.capability_losses : []),
          slot('neutral', 'cultural effects', oo ? oo.cultural_effects : [])
        ]) +
        subCell('Capability Outcome', 'What organizational capabilities emerge?', co, [
          slot('pos', 'capabilities strengthened', co ? co.capabilities_strengthened : []),
          slot('neg', 'capabilities weakened', co ? co.capabilities_weakened : [])
        ]) +
        subCell('Risk Outcome', 'What new risks become more likely?', ro, [
          slot('warm', 'identified risks', ro ? ro.identified_risks : []),
          slot('pos', 'risk mitigations', ro ? ro.risk_mitigations : [])
        ]) +
        // Evolution Outcome — full width, emphasised
        '<div class="oc-cell full evo">' +
          '<div class="oc-clabel">Evolution Outcome <span style="font-family:var(--oc-mono);font-size:8.5px;letter-spacing:0.12em;color:var(--oc-freq2)">· the most important object</span></div>' +
          '<div class="oc-cq">How may the organization, the person and the role evolve together over time?</div>' +
          evoLine('Organization evolution', eo ? eo.organization_evolution : '') +
          evoLine('Person evolution', eo ? eo.person_evolution : '') +
          evoLine('Role evolution', eo ? eo.role_evolution : '') +
          (eo && eo.generated ? subMeta(eo) : '') +
        '</div>' +
      '</div>';

    var genbar =
      '<div class="oc-genbar">' +
        '<div class="oc-genbanner">' + (o.generated
          ? '⬡ Generated · these are emergent hypotheses, not predictions'
          : '⬡ Containers empty · run the engine to fill them with emergent hypotheses') + '</div>' +
        '<div style="display:flex;gap:8px">' +
          '<button class="oc-genbtn" type="button" data-gen="' + esc(o.outcome_id) + '">' + (o.generated ? 'Regenerate' : 'Generate emergent hypotheses →') + '</button>' +
          (o.generated ? '<button class="oc-addbtn" type="button" data-cleargen="' + esc(o.outcome_id) + '" style="padding:0 12px">Clear</button>' : '') +
        '</div>' +
      '</div>';

    return '<div class="oc-out" data-outcome="' + esc(o.outcome_id) + '">' +
      '<div class="oc-otop">' +
        '<div>' +
          '<div class="oc-osummary">' + esc(o.outcome_summary) + '</div>' +
          '<div class="oc-oid">' + esc(o.outcome_id) + ' · ' + esc((o.created_at || '').slice(0, 10)) + '</div>' +
        '</div>' +
        '<div class="oc-horizon">' + esc(O.humanHorizon(o.time_horizon)) + '</div>' +
      '</div>' +
      chain +
      genbar +
      grid +
      renderFoot(o) +
    '</div>';
  }

  /* ---- assumptions + evidence + confidence ----------------- */
  function renderFoot(o) {
    var assum = (o.assumptions || []).map(function (a, i) {
      return '<div class="oc-assum"><div class="at">' + esc(a) + '</div>' +
        '<button class="ax" type="button" data-rmassum="' + esc(o.outcome_id) + '" data-idx="' + i + '">remove</button></div>';
    }).join('') || '<div class="oc-assum"><div class="at" style="color:var(--oc-ink4)">No assumptions — an outcome must never appear certain. Add at least one.</div></div>';

    var evidence = (o.evidence || []).map(function (e) {
      return '<div class="oc-ev"><div class="ek">' + esc((e.kind || '').replace(/_/g, ' ')) + '</div>' +
        '<div class="et">' + esc(e.label) + (e.ref_id ? ' <span style="color:var(--oc-ink4);font-family:var(--oc-mono);font-size:10px">' + esc(e.ref_id) + '</span>' : '') + '</div></div>';
    }).join('') || '<div class="oc-ev"><div class="et" style="color:var(--oc-ink4)">No traceability — this should never happen.</div></div>';

    var confLine = o.generated
      ? '<div class="oc-confidence">Overall confidence · <b>' + esc(o.confidence || 'unknown') + '</b> — descriptive, never a score, never a percentage. ' + esc(o.reasoning || '') + '</div>'
      : '<div class="oc-confidence">Confidence · <b>unassessed</b> — a container is not a prediction. No score, no probability, no certainty until the engine reasons over it.</div>';

    return '<div class="oc-foot">' +
      confLine +

      '<div class="oc-clabel">Assumptions · so it can never appear certain</div>' +
      assum +
      '<div class="oc-addrow">' +
        '<input type="text" placeholder="Add an assumption — e.g. “This assumes budget for the hire is approved.”" data-assuminput="' + esc(o.outcome_id) + '">' +
        '<button class="oc-addbtn" type="button" data-addassum="' + esc(o.outcome_id) + '">Add</button>' +
      '</div>' +

      '<div class="oc-clabel" style="margin-top:8px">Evidence · traceability back to Mission · Frequency · Validation · Role · Person</div>' +
      evidence +

      '<button class="oc-delbtn" type="button" data-delout="' + esc(o.outcome_id) + '">Delete this frame</button>' +
    '</div>';
  }

  /* ---- small renderers ------------------------------------- */
  function cnode(role, val) {
    return '<div class="oc-cnode"><div class="role">' + esc(role) + '</div><div class="val">' + esc(val) + '</div></div>';
  }
  function cnodeFuture(role, valHtml) {
    return '<div class="oc-cnode future"><div class="role">' + esc(role) + '</div><div class="val"><em>' + valHtml + '</em></div></div>';
  }
  function carrow() { return '<div class="oc-carrow">↓</div>'; }
  function subCell(label, q, sub, slots) {
    var summary = (sub && sub.generated && sub.summary)
      ? '<div class="oc-sub-summary">' + esc(sub.summary) + '</div>' + subMeta(sub)
      : '';
    return '<div class="oc-cell">' +
      '<div class="oc-clabel">' + esc(label) + '</div>' +
      '<div class="oc-cq">' + esc(q) + '</div>' +
      summary +
      slots.join('') +
    '</div>';
  }
  // confidence + assumptions + reasoning footer for a generated sub-outcome
  function subMeta(sub) {
    if (!sub || !sub.generated) return '';
    var conf = sub.confidence || 'unknown';
    var assum = (sub.assumptions || []).length
      ? '<div class="oc-sub-assum"><b>Assumes:</b> ' + sub.assumptions.map(esc).join(' ') + '</div>' : '';
    var reason = sub.reasoning ? '<div class="oc-sub-reason">Reasoning · ' + esc(sub.reasoning) + '</div>' : '';
    return '<div class="oc-sub-meta"><span class="oc-cbadge ' + esc(conf) + '">confidence · ' + esc(conf) + '</span>' +
      '<span class="oc-sub-conf">hypothesis · not a prediction</span></div>' + assum + reason;
  }
  function slot(tone, label, items) {
    items = items || [];
    var body = items.length
      ? items.map(function (it) { return renderItem(tone, it); }).join('')
      : '<div class="empty">empty container · awaiting the engine (1I)</div>';
    return '<div class="oc-slot ' + tone + '">' +
      '<div class="sk"><span class="tick"></span>' + esc(label) + ' · ' + items.length + '</div>' +
      body +
    '</div>';
  }
  // an item is either a plain string (legacy) or a generated hypothesis object
  function renderItem(tone, it) {
    if (typeof it === 'string') return '<div class="item">' + esc(it) + '</div>';
    var conf = it.confidence || 'unknown';
    var ev = (it.evidence || []).length
      ? ' · <span class="ev">' + (it.evidence || []).map(function (e) { return esc((e.kind || '').replace(/_/g, ' ')); }).join(', ') + '</span>'
      : '';
    return '<div class="oc-item">' +
      '<div class="it">' + esc(it.text) + '</div>' +
      '<div class="im">' +
        (it.horizon ? '<span class="oc-htag">' + esc(O.humanHorizon(it.horizon)) + '</span>' : '') +
        '<span class="oc-cbadge ' + esc(conf) + '">' + esc(conf) + '</span>' +
      '</div>' +
      (it.reasoning ? '<div class="ir">' + esc(it.reasoning) + ev + '</div>' : (ev ? '<div class="ir">traced' + ev + '</div>' : '')) +
    '</div>';
  }
  function evoLine(label, val) {
    var filled = !!val;
    return '<div class="oc-evo-line"><div class="ek">' + esc(label) + '</div>' +
      '<div class="ev' + (filled ? ' filled' : '') + '">' + (filled ? esc(val) : 'empty container · awaiting the engine (1I)') + '</div></div>';
  }

  /* ---- events ---------------------------------------------- */
  // Frame a new outcome
  document.addEventListener('click', function (e) {
    var fb = e.target.closest && e.target.closest('#oc-frame');
    if (!fb) return;
    var roleId = document.getElementById('oc-role').value;
    var personId = document.getElementById('oc-person').value;
    var horizon = document.getElementById('oc-horizon').value;
    if (O.frameOutcome(roleId, personId, horizon)) render();
  });

  // Delegated: delete / add-assumption / remove-assumption
  listEl.addEventListener('click', function (e) {
    var del = e.target.closest && e.target.closest('[data-delout]');
    if (del) {
      if (confirm('Delete this outcome frame and its six sub-outcome containers?')) {
        O.deleteOutcome(del.getAttribute('data-delout'));
        render();
      }
      return;
    }
    var add = e.target.closest && e.target.closest('[data-addassum]');
    if (add) {
      var id = add.getAttribute('data-addassum');
      var input = listEl.querySelector('input[data-assuminput="' + id + '"]');
      if (input && input.value.trim()) { O.addAssumption(id, input.value); render(); }
      return;
    }
    var rm = e.target.closest && e.target.closest('[data-rmassum]');
    if (rm) {
      O.removeAssumption(rm.getAttribute('data-rmassum'), parseInt(rm.getAttribute('data-idx'), 10));
      render();
      return;
    }
    var gen = e.target.closest && e.target.closest('[data-gen]');
    if (gen) {
      O.generate(gen.getAttribute('data-gen'));
      render();
      return;
    }
    var clr = e.target.closest && e.target.closest('[data-cleargen]');
    if (clr) {
      O.clearGenerated(clr.getAttribute('data-cleargen'));
      render();
      return;
    }
  });
  // Enter to add an assumption
  listEl.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var input = e.target.closest && e.target.closest('input[data-assuminput]');
    if (!input) return;
    e.preventDefault();
    var id = input.getAttribute('data-assuminput');
    if (input.value.trim()) { O.addAssumption(id, input.value); render(); }
  });

  document.getElementById('oc-reset').addEventListener('click', function () {
    if (confirm('Clear all outcome frames on this device? The six sub-outcome containers for each will be removed.')) {
      var store = O.ensure(OF.load());
      store.emergent_outcomes = [];
      store.mission_outcomes = [];
      store.person_outcomes = [];
      store.organization_outcomes = [];
      store.capability_outcomes = [];
      store.risk_outcomes = [];
      store.evolution_outcomes = [];
      OF.save(store);
      render();
    }
  });

  render();
})();
