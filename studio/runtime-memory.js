/* =============================================================
   runtime-memory.js — the Runtime Memory admin room (render + UX)

   Reads the five layers, pointer, open questions, notes, events and
   rights for one being at a time, and runs The Hand (runtime-engine)
   live as a pure function of the model. Local-first: edits, sent
   reach-outs, reactivations and erasures persist to localStorage,
   exactly like every other Studio room. "Reset seed" restores the
   authored narrative.
   ============================================================= */
(function () {
  'use strict';

  var LS_KEY = 'studio.runtimeMemory.v1';
  var E = window.RM_ENGINE;
  var state = { users: [], selected: null, today: window.RM_TODAY };

  /* ---------- tiny DOM helper ---------- */
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[<>&]/g, function (c) {
      return { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c];
    });
  }

  /* ---------- persistence ---------- */
  function load() {
    var raw = null;
    try { raw = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) {}
    if (raw && raw.users) { state.users = raw.users; state.today = raw.today || window.RM_TODAY; }
    else { state.users = JSON.parse(JSON.stringify(window.RM_SEED.users)); }
  }
  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ users: state.users, today: state.today })); } catch (e) {}
  }
  function resetSeed() {
    localStorage.removeItem(LS_KEY);
    state.users = JSON.parse(JSON.stringify(window.RM_SEED.users));
    state.today = window.RM_TODAY;
    if (!byId(state.selected)) state.selected = state.users[0].user_id;
    render();
    toast('Seed restored');
  }
  function byId(id) { return state.users.filter(function (u) { return u.user_id === id; })[0]; }

  /* ---------- toast (reuses studio .toast) ---------- */
  var toastTimer = null;
  function toast(msg) {
    var t = document.getElementById('rm-toast');
    if (!t) { t = el('div', 'toast'); t.id = 'rm-toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  /* =============================================================
     ROSTER
     ============================================================= */
  function renderRoster() {
    var ul = document.getElementById('rm-roster');
    ul.innerHTML = '';
    state.users.forEach(function (u) {
      var li = el('button', 'rm-person' + (u.user_id === state.selected ? ' active' : '') + (u.status === 'erased' ? ' is-erased' : ''));
      li.type = 'button';
      var decision = (u.status !== 'erased') ? E.decideReachout(u, state.today) : null;
      var firesHtml = '';
      if (decision && decision.fires) {
        firesHtml = '<div class="pn-fires"><span class="pulse"></span>' + esc(decision.triggerLabel) + '</div>';
      }
      var metaBits = [];
      if (u.status === 'erased') metaBits.push('erased ' + esc(u.erased_date || ''));
      else {
        if (u.pointer && u.pointer.current_chamber) metaBits.push(esc(u.pointer.current_chamber));
        if (u.pointer && u.pointer.last_touched) metaBits.push('touched ' + esc(u.pointer.last_touched));
      }
      li.innerHTML =
        '<div class="pn-top"><span class="rm-dot ' + esc(u.status) + '"></span><span class="pn-name">' + esc(u.name) + '</span></div>' +
        '<div class="pn-meta">' + metaBits.join(' · ') + '</div>' +
        firesHtml;
      li.addEventListener('click', function () { state.selected = u.user_id; render(); window.scrollTo(0, 0); });
      ul.appendChild(li);
    });
  }

  /* =============================================================
     RECORD
     ============================================================= */
  function renderRecord() {
    var host = document.getElementById('rm-record');
    host.innerHTML = '';
    var u = byId(state.selected);
    if (!u) return;

    if (u.status === 'erased' || u.erased_tombstone) {
      host.appendChild(renderTombstone(u));
      return;
    }

    var inner = el('div', 'rm-record-inner');

    /* header */
    var head = el('div', 'rm-phead');
    head.innerHTML =
      '<div><div class="ph-id">' + esc(u.user_id) + ' · joined ' + esc(u.joined_date) + ' · ' + esc(u.language) + '</div>' +
      '<h2>' + esc(u.name) + '</h2>' +
      '<div class="ph-contacts"><span>' + esc(u.email) + '</span><span>' + esc(u.whatsapp) + '</span></div></div>' +
      '<div class="ph-status ' + esc(u.status) + '">' + esc(u.status) + '</div>';
    inner.appendChild(head);

    /* return banner (silenced + returned) */
    if (u.status === 'silenced' && u.returned) {
      var rb = el('div', 'rm-return');
      rb.innerHTML =
        '<div class="ret-l">Return · after ' + esc(E.yearsAndMonths(u.pointer.last_touched, state.today)) + '</div>' +
        '<div class="ret-text">A reader marked <em>silenced</em> has come back to the field. The orchestrator drops chase mode and holds the <em>return ritual</em> below — acknowledge the gap, restate the permanence promise, resume from the pointer. Do not re-threshold.</div>';
      inner.appendChild(rb);
    }

    /* pointer */
    inner.appendChild(renderPointer(u));

    /* layer stack head */
    var sh = el('div', 'rm-stack-head');
    sh.innerHTML = '<div class="sh-l">THE MODEL · FIVE LAYERS</div><div class="sh-r">slowest first — each a compression of the one below</div>';
    inner.appendChild(sh);

    inner.appendChild(layerEssence(u));
    inner.appendChild(layerMethod(u));
    inner.appendChild(layerTransformation(u));
    inner.appendChild(layerEvidence(u));
    inner.appendChild(layerSignal(u));

    /* open questions */
    inner.appendChild(renderOpenQuestions(u));
    /* conversation notes */
    inner.appendChild(renderNotes(u));
    /* orchestrator */
    inner.appendChild(renderOrchestrator(u));
    /* events */
    inner.appendChild(renderEvents(u));
    /* rights */
    inner.appendChild(renderRights(u));

    host.appendChild(inner);
  }

  function renderPointer(u) {
    var p = u.pointer || {};
    var wrap = el('div');
    var grid = el('div', 'rm-pointer');
    var cells = [
      ['Current book', esc(p.current_book), false],
      ['Chamber', esc(p.current_chamber) + (p.chamber_status === 'mid' ? ' · mid' : ' · complete'), false],
      ['Concept', esc(p.current_concept), true],
      ['Last touched', esc(p.last_touched), false],
      ['Next natural step', esc(p.next_natural_step), true]
    ];
    cells.forEach(function (c) {
      grid.appendChild(el('div', 'pt-cell', '<div class="pt-k">' + c[0] + '</div><div class="pt-v' + (c[2] ? ' italic' : '') + '">' + c[1] + '</div>'));
    });
    wrap.appendChild(grid);
    wrap.appendChild(el('div', 'rm-pointer-note', 'The Pointer is the state of the relationship — not memory of the person. It is the bookmark the website chat reads to know where to resume.'));
    return wrap;
  }

  /* ---------- accordion shell ---------- */
  function layerShell(key, tempo, title, count, openByDefault) {
    var lay = el('div', 'rm-layer' + (openByDefault ? ' open' : ''));
    lay.dataset.key = key;
    var head = el('div', 'rm-layer-head');
    head.innerHTML =
      '<div class="rm-layer-rate"><b>' + title + '</b>' + tempo + '</div>' +
      '<div class="rm-layer-title"><em>' + title + '</em></div>' +
      '<div class="rm-layer-count">' + count + '</div>' +
      '<div class="rm-layer-tw">›</div>';
    head.addEventListener('click', function () { lay.classList.toggle('open'); });
    lay.appendChild(head);
    var body = el('div', 'rm-layer-body');
    lay.appendChild(body);
    return { lay: lay, body: body };
  }

  function layerEssence(u) {
    var e = u.essence || {};
    var s = layerShell('essence', 'continental drift', 'Essence', 'revised ' + esc(e.last_revised || '—'), true);
    var b = s.body;

    var para = el('div', 'rm-essence-para');
    para.setAttribute('contenteditable', 'true');
    para.spellcheck = false;
    para.textContent = e.core_paragraph || '';
    para.addEventListener('blur', function () {
      var nv = para.textContent.trim();
      if (nv && nv !== e.core_paragraph) {
        e.revisions = e.revisions || [];
        e.revisions.unshift({ date: state.today, note: 'Edited in admin. Prior opening: “' + (e.core_paragraph || '').slice(0, 90) + '…”' });
        e.core_paragraph = nv;
        e.last_revised = state.today;
        save();
        toast('Essence rewritten · prior version logged');
        renderRecord();
      }
    });
    b.appendChild(para);

    var attrs = el('div', 'rm-attrs');
    (e.core_attributes || []).forEach(function (a) {
      var chip = el('span', 'rm-chip' + (a.source === 'told' ? ' told' : ''));
      chip.innerHTML = esc(a.attribute) + ' · <em>' + esc(a.value) + '</em>' +
        '<span class="cf">' + (a.source === 'told' ? 'told' : 'inf ' + a.confidence) + '</span>';
      chip.title = (a.source === 'told' ? 'Told — outranks inferred on conflict. ' : 'Inferred · confidence ' + a.confidence + '. ') +
        'first seen ' + a.first_seen + ' · last confirmed ' + a.last_confirmed;
      attrs.appendChild(chip);
    });
    b.appendChild(attrs);

    if ((e.contextual_essences || []).length) {
      b.appendChild(el('div', 'rm-subline', 'CONTEXTUAL ESSENCES · ' + e.contextual_essences.length + ' OF 5 EARNED'));
      e.contextual_essences.forEach(function (c) {
        var ce = el('div', 'rm-ctx-essence');
        ce.innerHTML = '<div class="ce-name">' + esc(c.name) + '</div><div class="ce-para">' + esc(c.paragraph) + '</div>';
        var ca = el('div', 'rm-attrs');
        (c.attributes || []).forEach(function (x) { ca.appendChild(el('span', 'rm-chip', esc(x))); });
        ce.appendChild(ca);
        b.appendChild(ce);
      });
    }

    if ((e.revisions || []).length) {
      var det = el('details', 'rm-revlog');
      det.innerHTML = '<summary>REVISION HISTORY · ' + e.revisions.length + ' LOGGED (essence is rewritten, never appended)</summary>';
      e.revisions.forEach(function (r) {
        det.appendChild(el('div', 'rm-rev', '<span class="rev-date">' + esc(r.date) + '</span>' + esc(r.note)));
      });
      b.appendChild(det);
    }
    return s.lay;
  }

  function layerMethod(u) {
    var m = u.method || {};
    var s = layerShell('method', 'updates on repeat', 'Method', 'updated ' + esc(m.updated_date || '—'), false);
    var modes = el('div', 'rm-modes');
    (m.evolution_modes || []).forEach(function (md, i) {
      modes.appendChild(el('div', 'rm-mode', '<span class="ord">' + (i + 1) + '</span>' + esc(md)));
    });
    s.body.appendChild(modes);
    s.body.appendChild(el('div', 'rm-pointer-note', 'How <em>this</em> being evolves best. The orchestrator reads the first mode to choose how to approach.'));
    return s.lay;
  }

  function layerTransformation(u) {
    var ts = u.transformations || [];
    var s = layerShell('transformation', 'verified shifts', 'Transformation', ts.length + (ts.length === 1 ? ' shift' : ' shifts'), false);
    if (!ts.length) s.body.appendChild(el('div', 'rm-pointer-note', 'No verified shift yet. Early in the work — the system resists over-reading.'));
    ts.forEach(function (t) {
      var row = el('div', 'rm-row');
      row.innerHTML =
        '<div class="r-top"><div class="r-desc">' + esc(t.description) + (t.just_verified ? ' <em>· just verified</em>' : '') + '</div><div class="r-date">' + esc(t.date) + '</div></div>' +
        '<div class="rm-conf"><div class="bar"><i style="width:' + Math.round(t.confidence * 100) + '%"></i></div><div class="val">confidence ' + t.confidence + '</div></div>' +
        '<div class="r-links">' + (t.linked_essence_attributes || []).map(function (a) { return '<span class="lk attr">' + esc(a) + '</span>'; }).join('') +
        (t.evidence_ids || []).map(function (e) { return '<span class="lk">' + esc(e) + '</span>'; }).join('') + '</div>';
      s.body.appendChild(row);
    });
    return s.lay;
  }

  function layerEvidence(u) {
    var ev = u.evidence || [];
    var s = layerShell('evidence', 'moments that proved', 'Evidence', ev.length + (ev.length === 1 ? ' moment' : ' moments'), false);
    ev.forEach(function (e) {
      var row = el('div', 'rm-row');
      row.innerHTML =
        '<div class="r-top"><div class="r-desc">' + esc(e.summary) + '</div><div class="r-date">' + esc(e.date) + '</div></div>' +
        '<div class="r-links"><span class="lk">' + esc(e.source_conversation_id) + '</span>' +
        (e.linked_transformation_id ? '<span class="lk">→ ' + esc(e.linked_transformation_id) + '</span>' : '') +
        (e.linked_essence_attribute ? '<span class="lk attr">' + esc(e.linked_essence_attribute) + '</span>' : '') + '</div>';
      s.body.appendChild(row);
    });
    return s.lay;
  }

  function layerSignal(u) {
    var sg = u.signals || [];
    var s = layerShell('signal', 'raw · transient', 'Signal', sg.length + ' raw', false);
    s.body.appendChild(el('div', 'rm-pointer-note', 'Raw interactions. Most is discarded; the meaningful is filtered up into Evidence.'));
    sg.forEach(function (g) {
      var row = el('div', 'rm-row signal' + (g.promoted ? ' promoted' : ''));
      row.innerHTML = '<div class="r-desc"><span class="sig-kind">' + esc(g.kind) + '</span>' + esc(g.summary) + '</div>' +
        '<div class="r-links"><span class="lk">' + esc(g.date) + '</span></div>';
      s.body.appendChild(row);
    });
    return s.lay;
  }

  function renderOpenQuestions(u) {
    var qs = u.open_questions || [];
    var wrap = el('div');
    var sh = el('div', 'rm-stack-head');
    sh.innerHTML = '<div class="sh-l">OPEN QUESTIONS · ' + qs.length + '</div><div class="sh-r">stay open until evidence resolves them</div>';
    wrap.appendChild(sh);
    var card = el('div', 'rm-layer open'); var body = el('div', 'rm-layer-body rm-oq'); body.style.paddingTop = '14px'; card.appendChild(body);
    qs.forEach(function (q) {
      var resolved = q.status === 'resolved';
      var wk = E.weeks(q.last_touched || q.opened_date, state.today);
      var row = el('div', 'rm-row');
      row.innerHTML =
        '<div class="r-top"><div class="r-desc' + (resolved ? ' resolved' : '') + '">' + esc(q.question) + '</div>' +
        '<div class="oq-status ' + (resolved ? 'resolved' : 'open') + '">' + (resolved ? 'resolved' : (wk >= 4 ? wk + 'w dormant' : 'open')) + '</div></div>' +
        '<div class="r-links"><span class="lk">opened ' + esc(q.opened_date) + '</span></div>';
      body.appendChild(row);
    });
    wrap.appendChild(card);
    return wrap;
  }

  function renderNotes(u) {
    var cn = u.conversation_notes || { notes: [], running_summary: '' };
    var wrap = el('div');
    var sh = el('div', 'rm-stack-head');
    sh.innerHTML = '<div class="sh-l">CONVERSATION NOTES</div><div class="sh-r">summary rewritten · notes appended</div>';
    wrap.appendChild(sh);
    var card = el('div', 'rm-layer open'); var body = el('div', 'rm-layer-body'); body.style.paddingTop = '14px'; card.appendChild(body);
    body.appendChild(el('div', 'rm-summary', esc(cn.running_summary)));
    (cn.notes || []).forEach(function (n) {
      body.appendChild(el('div', 'rm-note', '<div class="n-date">' + esc(n.date) + '</div><div class="n-body">' + esc(n.short_note) + '</div>'));
    });
    wrap.appendChild(card);
    return wrap;
  }

  /* =============================================================
     ORCHESTRATOR PANEL
     ============================================================= */
  function renderOrchestrator(u) {
    var d = E.decideReachout(u, state.today);
    var panel = el('div', 'rm-orch');

    var head = el('div', 'rm-orch-head');
    head.innerHTML =
      '<div class="oh-eyebrow">THE HAND · ORCHESTRATOR — A PURE FUNCTION OF THE MODEL</div>' +
      '<h3>Decision for <em>' + esc(u.name.split(' ')[0]) + '</em>, run on ' + esc(state.today) + '</h3>' +
      '<div class="oh-desc">Runs once a day per active being. Reads only the layers, the pointer, the open questions and the chase state — no hidden state. Asks four questions in strict order; the first to fire wins.</div>';
    panel.appendChild(head);

    /* controls */
    var ctrl = el('div', 'rm-orch-controls');
    ctrl.innerHTML = '<label>Run as of</label>';
    var dateIn = el('input'); dateIn.type = 'date'; dateIn.value = state.today;
    dateIn.addEventListener('change', function () { state.today = dateIn.value || window.RM_TODAY; save(); render(); });
    ctrl.appendChild(dateIn);
    var btnNow = el('button', 'rm-orch-btn ghost', 'Today'); btnNow.addEventListener('click', function () { state.today = window.RM_TODAY; save(); render(); });
    ctrl.appendChild(btnNow);
    panel.appendChild(ctrl);

    var body = el('div', 'rm-orch-body');

    /* the ladder of four questions */
    var ladder = el('ol', 'rm-ladder');
    d.rungs.forEach(function (r) {
      var li = el('li', 'rm-rung' + (r.status === 'fire' ? ' fired' : (r.status === 'skip' ? ' skipped' : '')));
      var flag = r.status === 'fire' ? '<span class="rung-flag fire">→ trigger</span>' :
                 (r.status === 'skip' ? '<span class="rung-flag skip">— not reached</span>' : '<span class="rung-flag no">no</span>');
      li.innerHTML = '<div class="rung-n">' + esc(r.n) + '</div>' +
        '<div><div class="rung-q">' + esc(r.q) + '</div><div class="rung-why">' + esc(r.why) + '</div></div>' + flag;
      ladder.appendChild(li);
    });
    body.appendChild(ladder);

    /* outcome */
    if (!d.fires) {
      var hold = el('div', 'rm-compose');
      hold.innerHTML = '<div class="cm-message"><div class="cm-channel">OUTCOME · NO REACH-OUT</div>' +
        '<div class="cm-quiet">' + esc(d.triggerLabel) + '. Signal over stimulation — the field stays silent and waits.</div></div>';
      body.appendChild(hold);
      panel.appendChild(body);
      return panel;
    }

    /* composed message */
    var c = d.composed;
    var comp = el('div', 'rm-compose');
    var ingredients = d.isReturn
      ? [['Reading', 'return ritual'], ['Tone · from essence', c.tone], ['Approach · from method', c.approach], ['Left off · pointer', c.leftOff]]
      : [['Tone · from essence', c.tone], ['Approach · from method', c.approach], ['Left off · pointer', c.leftOff], ['Gap', c.gapAck ? 'acknowledged' : 'recent — none']];
    var headRow = el('div', 'cm-head');
    ingredients.forEach(function (it) {
      headRow.appendChild(el('div', 'cm-ingredient', '<div class="cm-k">' + esc(it[0]) + '</div><div class="cm-v">' + esc(it[1] || '—') + '</div>'));
    });
    comp.appendChild(headRow);
    var msg = el('div', 'cm-message');
    msg.innerHTML = '<div class="cm-channel">' + esc(d.isReturn ? 'RETURN RITUAL · ' : 'COMPOSE · ') + esc((c.channelLabel || c.channel).toUpperCase()) + '</div>' +
      '<div class="' + (d.isReturn ? 'cm-text' : 'cm-text') + '">' + esc(c.message) + '</div>';
    comp.appendChild(msg);
    body.appendChild(comp);

    /* channel ladder (not for return) */
    if (d.chase && !d.isReturn) {
      var chase = el('div', 'rm-chase');
      chase.innerHTML = '<div class="chase-l">CHANNEL LADDER · this chase opens at day 0 · any response or website visit resets to normal mode</div>';
      var track = el('div', 'rm-chase-track');
      d.chase.steps.forEach(function (st) {
        track.appendChild(el('div', 'rm-chase-step ' + st.state,
          '<div class="cs-day">day ' + st.day + '</div><div class="cs-ch">' + esc(st.label) + '</div>'));
      });
      chase.appendChild(track);
      body.appendChild(chase);
    }

    /* actions */
    var acts = el('div', 'rm-orch-controls'); acts.style.borderBottom = '0'; acts.style.paddingTop = '20px';
    if (d.isReturn) {
      var reBtn = el('button', 'rm-orch-btn', 'Reactivate · resume from pointer');
      reBtn.addEventListener('click', function () {
        u.status = 'active'; u.returned = false;
        u.events = u.events || [];
        u.events.unshift({ event_id: 'ev_' + Date.now(), event_type: 'response_received', channel: 'web', date: state.today, content_summary: 'Returned and reactivated. Resumed from pointer; chase reset to normal mode.' });
        if (u.signals) u.signals.forEach(function (s) { if (s.kind === 'visit') s.promoted = true; });
        save(); render(); toast('Reactivated · resumed from pointer');
      });
      acts.appendChild(reBtn);
    } else {
      var sendBtn = el('button', 'rm-orch-btn', 'Send via ' + (c.channel) + ' · day ' + (d.chase ? d.chase.currentDay : 0));
      sendBtn.addEventListener('click', function () {
        u.chase = u.chase || {};
        u.chase.active = true;
        u.chase.last_contact_date = state.today;
        u.chase.day = d.chase ? d.chase.currentDay : 0;
        u.events = u.events || [];
        u.events.unshift({ event_id: 'ev_' + Date.now(), event_type: 'reachout_sent', channel: c.channel, date: state.today, content_summary: d.triggerLabel + ' — ' + (c.channelLabel || c.channel) + '.' });
        save(); render(); toast('Reach-out logged · ' + c.channel);
      });
      acts.appendChild(sendBtn);
      var holdBtn = el('button', 'rm-orch-btn ghost', 'Hold');
      holdBtn.addEventListener('click', function () { toast('Held. The orchestrator will ask again tomorrow.'); });
      acts.appendChild(holdBtn);
    }
    body.appendChild(acts);

    panel.appendChild(body);
    return panel;
  }

  function renderEvents(u) {
    var ev = (u.events || []).slice(0, 10);
    var wrap = el('div', 'rm-events');
    var sh = el('div', 'rm-stack-head');
    sh.innerHTML = '<div class="sh-l">ORCHESTRATOR EVENTS · last ' + ev.length + '</div><div class="sh-r">the relationship\u2019s audit trail</div>';
    wrap.appendChild(sh);
    ev.forEach(function (e) {
      var row = el('div', 'rm-event');
      row.innerHTML =
        '<div class="ev-date">' + esc(e.date) + '</div>' +
        '<div class="ev-type ' + esc(e.event_type) + '">' + esc(e.event_type.replace(/_/g, ' ')) + '</div>' +
        '<div class="ev-summary">' + esc(e.content_summary) + (e.channel && e.channel !== '\u2014' ? ' <span class="ch">· ' + esc(e.channel) + '</span>' : '') + '</div>';
      wrap.appendChild(row);
    });
    return wrap;
  }

  function renderRights(u) {
    var box = el('div', 'rm-rights');
    box.innerHTML =
      '<h3>The <em>Governor</em> · this record belongs to ' + esc(u.name.split(' ')[0]) + '</h3>' +
      '<p>The deepest layer of the system is consent, not intelligence. One phrase — <em>“erase me”</em> — on any channel wipes every layer, the pointer and the notes, leaves a tombstone so the orchestrator never chases, and lets them return later as a brand-new being with no history.</p>';
    var acts = el('div', 'rm-rights-actions');
    var exp = el('button', 'rm-rbtn', 'Export full model · JSON');
    exp.addEventListener('click', function () { exportUser(u); });
    var erase = el('button', 'rm-rbtn danger', 'Erase me · wipe everything');
    erase.addEventListener('click', function () {
      if (!confirm('Erase ' + u.name + '? This wipes all five layers, the pointer, and the notes, and leaves only a tombstone. In the seed this is reversible via “Reset seed”.')) return;
      eraseUser(u);
    });
    acts.appendChild(exp); acts.appendChild(erase);
    box.appendChild(acts);
    return box;
  }

  function renderTombstone(u) {
    var t = el('div', 'rm-tomb');
    t.innerHTML =
      '<div class="tomb-mark">◌</div>' +
      '<h2>This being asked to be forgotten.</h2>' +
      '<p>Every layer, the pointer and the notes were erased. A tombstone remains so the orchestrator never reaches out again. If they ever return, they enter as a brand-new being, with no history.</p>' +
      '<div class="tomb-date">' + esc(u.user_id) + ' · erased ' + esc(u.erased_date || '—') + '</div>';
    return t;
  }

  /* ---------- rights actions ---------- */
  function eraseUser(u) {
    u.status = 'erased';
    u.erased_tombstone = true;
    u.erased_date = state.today;
    u.email = '\u2014 erased \u2014'; u.whatsapp = '\u2014 erased \u2014';
    u.pointer = null; u.essence = null; u.method = null;
    u.transformations = []; u.evidence = []; u.signals = []; u.open_questions = [];
    u.conversation_notes = null;
    u.events = [{ event_id: 'ev_' + Date.now(), event_type: 'chase_complete', channel: 'whatsapp', date: state.today, content_summary: '“erase me” received. All layers, pointer and notes erased. Tombstone left so the system will not chase.' }];
    save(); render(); toast('Erased. Tombstone left.');
  }
  function exportUser(u) {
    var blob = new Blob([JSON.stringify(u, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = u.user_id + '.model.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    toast('Model exported');
  }

  /* =============================================================
     RENDER + INIT
     ============================================================= */
  function render() { renderRoster(); renderRecord(); }

  function init() {
    load();
    if (!byId(state.selected)) state.selected = state.users[0].user_id;
    var rb = document.getElementById('rm-reset');
    if (rb) rb.addEventListener('click', resetSeed);
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
