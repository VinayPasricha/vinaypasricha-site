/* ICP Discovery & Company Selection Console (Build 3A)
   Renders OF.icp over the shared of.runtime.v1 store. */
(function () {
  'use strict';
  if (!window.OF || !window.OF.icp) { console.warn('icp-admin.js requires of-icp.js'); return; }
  var I = window.OF.icp;

  var viewEl = document.getElementById('ic-view');
  var railEl = document.getElementById('ic-rail');
  var statsEl = document.getElementById('ic-stats');
  var toastEl = document.getElementById('ic-toast');

  /* selection of rows for bulk actions (candidate_id set) */
  var marked = {};

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function titleCase(s) { return String(s || '').replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(function () { toastEl.classList.remove('show'); }, 2800); }

  function render() {
    var s = I.snapshot();
    renderRail(s);
    renderStats(s);
    var html = '';
    html += icpPanel(s);
    html += universePanel(s);
    html += sourcesPanel(s);
    html += importPanel(s);
    html += consolePanel(s);
    html += queuePanel(s);
    viewEl.innerHTML = html;
    wire(s);
    var c = document.getElementById('ic-convo'); if (c) c.scrollTop = c.scrollHeight;
  }

  /* ---- pipeline rail ---- */
  function renderRail(s) {
    var hasICP = !!s.activeICP;
    var hasUni = s.universes.length > 0;
    var hasCand = s.candidates.length > 0;
    var hasSel = s.counts.selected > 0;
    var hasQ = s.queue.length > 0;
    var stages = [
      { n: '01', t: 'Product', done: hasICP || !!s.activeInterview },
      { n: '02', t: 'ICP definition', done: hasICP, now: !hasICP },
      { n: '03', t: 'Target universe', done: hasUni, now: hasICP && !hasUni },
      { n: '04', t: 'Company discovery', done: hasCand, now: hasUni && !hasCand },
      { n: '05', t: 'Human selection', done: hasSel, now: hasCand && !hasSel },
      { n: '06', t: 'Research queue → 3B', done: hasQ, now: hasSel && !hasQ }
    ];
    railEl.innerHTML = stages.map(function (st) {
      var cls = st.done ? 'done' : (st.now ? 'now' : '');
      return '<div class="ic-stage ' + cls + '"><div class="sn">' + st.n + (st.done ? ' <span class="tick">✓</span>' : '') + '</div><div class="st">' + st.t + '</div></div>';
    }).join('');
  }

  function renderStats(s) {
    var c = s.counts;
    statsEl.innerHTML =
      stat(c.icps, 'ICP definitions') +
      stat(c.universes, 'Target universes') +
      stat(c.candidates, 'Company candidates') +
      stat(c.selected, 'Selected') +
      stat(c.queued, 'In research queue') +
      stat(c.sources_configured + '/' + I.SOURCE_TYPES.length, 'Sources configured');
  }
  function stat(n, l) { return '<div class="ic-stat"><div class="n">' + n + '</div><div class="l">' + l + '</div></div>'; }

  /* ============ 1 · ICP — interview or definition ============ */
  function icpPanel(s) {
    var body;
    if (s.activeInterview) body = interviewBody(s.activeInterview);
    else if (s.activeICP) body = icpBody(s.activeICP, s);
    else body = '<div class="ic-empty">No ideal-customer profile yet. The agent will interview you — a conversation, not a form — to define the product and who it is for.<div style="margin-top:14px"><button class="ic-act primary" id="ic-startint">Begin ICP interview</button></div></div>';
    return '<div class="ic-panel"><div class="ic-ptop"><span class="ic-plabel">1 · Ideal Customer Profile</span>' +
      (s.activeICP && !s.activeInterview ? '<button class="ic-act" id="ic-newint">New interview</button>' : '<span class="ic-pnote">agent-led · product → who buys → where → signals</span>') +
      '</div><div class="ic-pbody">' + body + '</div></div>';
  }

  function interviewBody(iv) {
    var convo = iv.transcript.map(function (m) {
      return '<div class="ic-msg ' + m.role + '"><div class="who">' + (m.role === 'agent' ? 'Agent' : 'Vinay') + '</div><div class="ic-bubble">' + esc(m.text) + '</div></div>';
    }).join('');
    var cur = I.interviewQuestion(iv.step);
    var bar = '';
    if (iv.status === 'in_progress' && cur) {
      bar = '<div class="ic-answerbar"><textarea id="ic-ans" placeholder="Answer in your own words…"></textarea>' +
        '<button class="ic-act primary" id="ic-send" data-iv="' + iv.interview_id + '">Send</button></div>' +
        '<div class="ic-qhint">' + esc(cur.hint || '') + '</div>';
    } else {
      bar = '<div class="ic-answerbar" style="justify-content:flex-end"><button class="ic-act primary" id="ic-genicp" data-iv="' + iv.interview_id + '">Compile ICP definition →</button></div>';
    }
    return '<div class="ic-convo" id="ic-convo">' + convo + '</div>' + bar;
  }

  function icpBody(icp, s) {
    function tagRow(arr, cls) {
      if (!arr || !arr.length) return '<span class="ic-fld" style="color:var(--ic-ink4);font-family:var(--ic-mono);font-size:10px">—</span>';
      return '<div class="ic-tags">' + arr.map(function (x) { return '<span class="ic-tag ' + (cls || '') + '">' + esc(x) + '</span>'; }).join('') + '</div>';
    }
    function fld(k, content, full) { return '<div class="ic-fld' + (full ? ' full' : '') + '"><div class="k">' + k + '</div><div class="v">' + content + '</div></div>'; }
    var grid = '<div class="ic-icp">' +
      fld('Product', '<em style="font-style:normal;color:var(--ic-ink);font-weight:400">' + esc(icp.product_name) + '</em> — ' + esc(icp.product_description), true) +
      fld('Pain points', tagRow(icp.pain_points), true) +
      fld('Users (feel the pain)', tagRow(icp.target_roles)) +
      fld('Buyers (hold budget)', tagRow(icp.target_buyers)) +
      fld('Target industries', tagRow(icp.target_industries)) +
      fld('Excluded industries', tagRow(icp.excluded_industries, 'excl')) +
      fld('Company size', tagRow(icp.target_company_sizes)) +
      fld('Geographies', tagRow(icp.target_geographies) + (icp.excluded_geographies.length ? '<div style="margin-top:6px">' + tagRow(icp.excluded_geographies, 'excl').replace('<div class="ic-tags">', '<div class="ic-tags">') + '</div>' : '')) +
      fld('Required signals', tagRow(icp.required_signals, 'sig')) +
      fld('Success signals', tagRow(icp.success_signals, 'win')) +
      (icp.target_revenue_ranges.length ? fld('Revenue', tagRow(icp.target_revenue_ranges), true) : '') +
      '</div>';
    var hasUni = s.universes.some(function (u) { return u.icp_id === icp.icp_id; });
    grid += '<div style="display:flex;gap:8px;margin-top:18px;padding-top:16px;border-top:1px solid var(--ic-rule);flex-wrap:wrap">' +
      '<button class="ic-act primary" id="ic-genuni" data-icp="' + icp.icp_id + '">' + (hasUni ? 'Regenerate target universe' : 'Generate target universe →') + '</button>' +
      '</div>';
    return grid;
  }

  /* ============ 2 · TARGET UNIVERSE ============ */
  function universePanel(s) {
    var body;
    if (!s.universes.length) {
      body = '<div class="ic-empty">No target universe yet. Generate one from the ICP — it derives search criteria and defines the universe to discover companies in.</div>';
    } else {
      body = s.universes.map(function (u) {
        return '<div class="ic-uni"><div class="un">' + esc(u.name) + '</div>' +
          '<div class="ud">' + esc(u.description) + '</div>' +
          (u.estimated_company_count != null ? '<div class="ud" style="color:var(--ic-acc)">≈ ' + u.estimated_company_count + ' companies</div>' :
            '<div class="ud" style="color:var(--ic-ink4);font-family:var(--ic-mono);font-size:10px;margin-top:8px">estimated count unavailable — no provider configured to size against (honest)</div>') +
          (u.search_criteria.length ? '<div class="ic-crit">' + u.search_criteria.map(function (c) { return '<span class="ic-critpill">' + esc(c) + '</span>'; }).join('') + '</div>' : '') +
          '</div>';
      }).join('');
    }
    return '<div class="ic-panel"><div class="ic-ptop"><span class="ic-plabel">2 · Target Universe</span><span class="ic-pnote">search criteria derived from the ICP</span></div><div class="ic-pbody">' + body + '</div></div>';
  }

  /* ============ 3 · DISCOVERY SOURCES ============ */
  function sourcesPanel(s) {
    var rows = s.sources.map(function (src) {
      var working = src.provider_status === 'configured';
      var btn = src.source_type === 'manual_import'
        ? '<button class="ic-act" disabled style="opacity:.6">use Import panel ↓</button>'
        : '<button class="ic-act" data-disc="' + src.source_type + '"' + (s.universes.length ? '' : ' disabled') + '>Run discovery</button>';
      return '<div class="ic-src"><div class="sname">' + titleCase(src.source_type) + '</div>' +
        '<div class="sstat ' + src.provider_status + '">● ' + titleCase(src.provider_status) + '</div>' +
        '<div class="ic-src sbtn" style="border:none;background:none;padding:0;margin-top:10px">' + btn + '</div></div>';
    }).join('');
    return '<div class="ic-panel"><div class="ic-ptop"><span class="ic-plabel">3 · Discovery Sources</span><span class="ic-pnote">live providers honest-blocked · manual import is the working path</span></div><div class="ic-pbody"><div class="ic-srcrow">' + rows + '</div></div></div>';
  }

  /* ============ 4 · MANUAL IMPORT ============ */
  function importPanel(s) {
    return '<div class="ic-panel"><div class="ic-ptop"><span class="ic-plabel">4 · Manual Import</span><span class="ic-pnote">CSV · Excel paste · Apollo export · or one company per line</span></div>' +
      '<div class="ic-pbody"><div class="ic-form">' +
      '<textarea id="ic-imp" placeholder="Paste a company list. Accepts:&#10;  • CSV / Apollo export with a header row (Company, Website, Industry, Employees, Location, LinkedIn…)&#10;  • Tab-separated Excel paste&#10;  • Or simply one company name per line&#10;&#10;Example:&#10;Company,Website,Industry,Employees,Location&#10;Zluri,zluri.com,SaaS,500,Bengaluru"></textarea>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;width:100%;align-items:center">' +
      '<button class="ic-act primary" id="ic-doimport">Import companies</button>' +
      '<button class="ic-act" id="ic-example">Paste example list</button>' +
      '<span class="ic-pnote" style="margin-left:auto">Each row becomes a Company Candidate. Duplicates by name are skipped.</span>' +
      '</div>' +
      '<div style="width:100%;border-top:1px solid var(--ic-rule);margin-top:6px;padding-top:14px"><div class="ic-form" style="align-items:flex-end">' +
      '<input id="ic-mname" placeholder="Or add one company by name" style="min-width:200px">' +
      '<input id="ic-mind" placeholder="Industry (optional)" style="min-width:130px">' +
      '<input id="ic-memp" placeholder="Employees (optional)" style="min-width:130px">' +
      '<input id="ic-mloc" placeholder="Location (optional)" style="min-width:130px">' +
      '<button class="ic-act" id="ic-addone">Add</button>' +
      '</div></div>' +
      '</div></div></div>';
  }

  /* ============ 5 · COMPANY SELECTION CONSOLE ============ */
  function consolePanel(s) {
    var body;
    if (!s.candidates.length) {
      body = '<div class="ic-empty">No company candidates yet. Import a list above (or add one manually) — they will appear here for you to select.' +
        (s.dismissed ? '<div style="margin-top:10px;font-family:var(--ic-mono);font-size:10px;color:var(--ic-ink4)">' + s.dismissed + ' dismissed</div>' : '') + '</div>';
    } else {
      var bulk = '<div class="ic-bulkbar"><span class="lbl">' + s.candidates.length + ' candidate' + (s.candidates.length === 1 ? '' : 's') + ' · ' + s.counts.selected + ' selected</span>' +
        '<button class="ic-act" data-bulk="all">Select all</button>' +
        '<button class="ic-act" data-bulk="none">Deselect all</button>' +
        '<button class="ic-act gold" data-bulk="research">Mark selected for research →</button>' +
        '</div>';
      var rows = s.candidates.map(function (c) { return candRow(c); }).join('');
      body = bulk + '<div class="ic-tablewrap"><table class="ic-table"><thead><tr>' +
        '<th></th><th>Company</th><th>Website</th><th>Industry</th><th>Employees</th><th>Location</th><th>Source</th><th>Conf.</th><th>Reason</th><th>Status</th><th>Actions</th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }
    return '<div class="ic-panel"><div class="ic-ptop"><span class="ic-plabel">5 · Company Selection Console</span><span class="ic-pnote">select → mark for research · no research performed here</span></div><div class="ic-pbody">' + body + '</div></div>';
  }

  function candRow(c) {
    var queued = c.research_status === 'selected' && c.selected_for_research;
    var cls = queued ? 'queued' : (marked[c.candidate_id] ? 'selected' : '');
    var web = c.website_url ? '<a class="web" href="' + extUrl(c.website_url) + '" target="_blank" rel="noopener">open ↗</a>' : '<span style="color:var(--ic-ink4)">—</span>';
    var conf = c.confidence === 'high' ? 'high' : (c.confidence === 'medium' ? 'medium' : '');
    return '<tr class="' + cls + '" data-row="' + c.candidate_id + '">' +
      '<td><input type="checkbox" data-check="' + c.candidate_id + '"' + (marked[c.candidate_id] ? ' checked' : '') + '></td>' +
      '<td><div class="co">' + esc(c.company_name) + '</div>' + (c.linkedin_url ? '<a class="web" href="' + extUrl(c.linkedin_url) + '" target="_blank" rel="noopener" style="font-size:9px">linkedin ↗</a>' : '') + '</td>' +
      '<td>' + web + '</td>' +
      '<td>' + (esc(c.industry) || '<span style="color:var(--ic-ink4)">—</span>') + '</td>' +
      '<td>' + (esc(c.employee_count) || '<span style="color:var(--ic-ink4)">—</span>') + '</td>' +
      '<td>' + (esc(c.hq) || '<span style="color:var(--ic-ink4)">—</span>') + '</td>' +
      '<td><span class="ic-rs">' + titleCase(c.discovery_source) + '</span></td>' +
      '<td><span class="ic-conf ' + conf + '">' + c.confidence + '</span></td>' +
      '<td class="reason">' + esc(c.relevance_reason) + '</td>' +
      '<td><span class="ic-rs ' + (queued ? 'selected' : '') + '">' + titleCase(c.research_status) + '</span></td>' +
      '<td><div class="ic-rowact">' +
        (queued
          ? '<button class="danger" data-act="unqueue" data-id="' + c.candidate_id + '">Remove from queue</button>'
          : '<button class="go" data-act="research" data-id="' + c.candidate_id + '">Mark for research</button>') +
        '<button data-act="dismiss" data-id="' + c.candidate_id + '">Dismiss</button>' +
      '</div></td>' +
      '</tr>';
  }
  function extUrl(u) { return /^https?:\/\//i.test(u) ? u : 'https://' + u; }

  /* ============ 6 · RESEARCH QUEUE ============ */
  function queuePanel(s) {
    var body;
    if (!s.queue.length) {
      body = '<div class="ic-empty">The research queue is empty. Mark a company for research to add it here. <em style="font-style:italic">No research runs until Build 3B consumes this queue.</em></div>';
    } else {
      body = s.queue.map(function (q) {
        return '<div class="ic-q"><div><div class="qn">' + esc(q.company_name) + '</div>' +
          '<div class="qm">queued ' + new Date(q.queued_at).toLocaleString() + ' · ' + esc(q.note) + '</div></div>' +
          '<span class="qstat">● ' + titleCase(q.status) + '</span></div>';
      }).join('');
      body = '<div style="margin-bottom:12px;font-family:var(--ic-mono);font-size:9.5px;letter-spacing:0.04em;color:var(--ic-ink4)">→ HANDOFF TO BUILD 3B · these companies become Organizational Frequency research pages downstream. Nothing is researched here.</div>' + body;
    }
    return '<div class="ic-panel"><div class="ic-ptop"><span class="ic-plabel">6 · Research Queue</span><span class="ic-pnote">handoff to Build 3B research runtime</span></div><div class="ic-pbody">' + body + '</div></div>';
  }

  /* ============ EVENTS ============ */
  function wire(s) {
    on('ic-startint', 'click', function () { I.startInterview(); render(); });
    on('ic-newint', 'click', function () { I.startInterview(); render(); });

    var send = document.getElementById('ic-send');
    if (send) {
      var doSend = function () {
        var ta = document.getElementById('ic-ans');
        var res = I.answerInterview(send.getAttribute('data-iv'), ta.value.trim());
        if (res.error) { toast(res.error); return; }
        render();
      };
      send.addEventListener('click', doSend);
      var ta = document.getElementById('ic-ans');
      if (ta) ta.addEventListener('keydown', function (e) { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') doSend(); });
    }

    on('ic-genicp', 'click', function (btn) {
      var res = I.generateICP(btn.getAttribute('data-iv'));
      if (res.error) { toast(res.error); return; }
      toast('ICP compiled: ' + res.icp.product_name);
      render();
    });

    on('ic-genuni', 'click', function (btn) {
      var res = I.generateUniverse(btn.getAttribute('data-icp'));
      if (res.error) { toast(res.error); return; }
      toast('Target universe generated · ' + res.universe.search_criteria.length + ' search criteria');
      render();
    });

    // discovery providers
    each('[data-disc]', function (btn) {
      btn.addEventListener('click', function () {
        var uni = (I.snapshot().universes[0] || {}).universe_id;
        var res = I.runDiscovery(uni, btn.getAttribute('data-disc'));
        if (res.blocked) { toast('⊘ ' + res.detail); }
        else { toast(res.note || 'Use the import panel.'); }
        render();
      });
    });

    // import
    on('ic-doimport', 'click', function () {
      var txt = document.getElementById('ic-imp').value;
      var res = I.importCandidates(txt, {});
      if (res.error) { toast(res.error); return; }
      toast('Imported ' + res.created.length + ' (' + res.format + ')' + (res.skipped ? ' · ' + res.skipped + ' skipped' : ''));
      render();
    });
    on('ic-example', 'click', function () {
      document.getElementById('ic-imp').value = EXAMPLE_CSV;
      toast('Example pasted — review it, then Import.');
    });
    on('ic-addone', 'click', function () {
      var name = document.getElementById('ic-mname').value.trim();
      if (!name) { toast('Add a company name.'); return; }
      var res = I.addCandidateManual({
        company_name: name,
        industry: document.getElementById('ic-mind').value.trim(),
        employee_count: document.getElementById('ic-memp').value.trim(),
        hq: document.getElementById('ic-mloc').value.trim()
      });
      if (res.error) { toast(res.error); return; }
      toast('Added ' + name);
      render();
    });

    // row checkboxes
    each('[data-check]', function (cb) {
      cb.addEventListener('change', function () {
        var id = cb.getAttribute('data-check');
        if (cb.checked) marked[id] = true; else delete marked[id];
        var tr = document.querySelector('tr[data-row="' + id + '"]');
        if (tr && !tr.classList.contains('queued')) tr.classList.toggle('selected', cb.checked);
      });
    });

    // bulk
    each('[data-bulk]', function (btn) {
      btn.addEventListener('click', function () {
        var kind = btn.getAttribute('data-bulk');
        var ids = s.candidates.map(function (c) { return c.candidate_id; });
        if (kind === 'all') { ids.forEach(function (id) { marked[id] = true; }); render(); }
        else if (kind === 'none') { marked = {}; render(); }
        else if (kind === 'research') {
          var sel = Object.keys(marked);
          if (!sel.length) { toast('Select rows first (checkboxes), then mark for research.'); return; }
          var res = I.bulkMarkForResearch(sel);
          marked = {};
          toast(res.count + ' compan' + (res.count === 1 ? 'y' : 'ies') + ' queued for research — no research performed.');
          render();
        }
      });
    });

    // row actions
    each('[data-act]', function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id'), act = btn.getAttribute('data-act'), res;
        if (act === 'research') { res = I.markForResearch(id); if (!res.error) toast('Marked for research — queued for Build 3B. No research performed.'); }
        else if (act === 'dismiss') { res = I.dismissCandidate(id); delete marked[id]; if (!res.error) toast('Dismissed.'); }
        else if (act === 'unqueue') { res = I.unqueue(id); if (!res.error) toast('Removed from research queue.'); }
        if (res && res.error) toast(res.error);
        render();
      });
    });
  }

  function on(id, ev, fn) { var el = document.getElementById(id); if (el) el.addEventListener(ev, function () { fn(el); }); }
  function each(sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), fn); }

  var EXAMPLE_CSV = [
    'Company,Website,Industry,Employees,Location',
    'Zluri,zluri.com,SaaS,600,Bengaluru',
    'Darwinbox,darwinbox.com,SaaS,1200,Hyderabad',
    'Postman,postman.com,SaaS,800,Bengaluru',
    'Fractal Analytics,fractal.ai,IT Services,4500,Mumbai',
    'Mphasis,mphasis.com,IT Services,35000,Bengaluru',
    'WNS Global,wns.com,BPO,60000,Mumbai',
    'Firstsource,firstsource.com,BPO,28000,Mumbai',
    'Whatfix,whatfix.com,SaaS,1100,Bengaluru',
    'Chargebee,chargebee.com,SaaS,1000,Chennai',
    'Innovaccer,innovaccer.com,SaaS,1300,Noida'
  ].join('\n');

  var reset = document.getElementById('ic-reset');
  if (reset) reset.addEventListener('click', function () {
    if (confirm('Reset the entire ICP & target-selection pipeline on this device? (ICP, interviews, universes, candidates, research queue.)')) {
      I.resetICP(); marked = {}; toast('Pipeline reset.'); render();
    }
  });

  render();
})();
