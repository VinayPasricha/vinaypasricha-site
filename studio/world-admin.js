/* World Discovery dashboard (Build 3A) — renders OF.world over the shared OF store. */
(function () {
  'use strict';
  if (!window.OF || !window.OF.world) { console.warn('world-admin.js requires of-world.js'); return; }
  var W = window.OF.world;

  var viewEl = document.getElementById('wd-view');
  var statsEl = document.getElementById('wd-stats');
  var policyEl = document.getElementById('wd-policy');
  var toastEl = document.getElementById('wd-toast');

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function titleCase(s) { return String(s || '').replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(function () { toastEl.classList.remove('show'); }, 2600); }
  function confLevel(c) { return (c && c.level) ? c.level : (typeof c === 'string' ? c : 'low'); }

  function render() {
    var s = W.snapshot();
    renderStats(s);
    renderPolicy(s);
    var html = '';
    html += importPanel();
    html += scanPanel(s);
    html += opportunitiesPanel(s);
    html += signalsPanel(s);
    html += runsPanel(s);
    viewEl.innerHTML = html;
    wire();
  }

  function renderStats(s) {
    var c = s.counts;
    statsEl.innerHTML =
      stat(c.signals, 'World signals') +
      stat(c.opportunities, 'Opportunities') +
      stat(c.runs, 'Discovery runs') +
      stat(c.drafts, 'Outreach drafts') +
      stat(c.blocked_runs, 'Blocked runs');
  }
  function stat(n, l) { return '<div class="wd-stat"><div class="n">' + n + '</div><div class="l">' + l + '</div></div>'; }

  function renderPolicy(s) {
    var p = s.policy || {};
    policyEl.innerHTML =
      '<span>Policy</span>' +
      '<span>scope <b>' + esc(titleCase(p.scan_scope)) + '</b></span>' +
      '<span>min confidence <b>' + esc(p.confidence_threshold) + '</b></span>' +
      '<span>max / run <b>' + esc(p.max_opportunities_per_run) + '</b></span>' +
      '<span class="gate">review ' + (p.requires_review ? 'REQUIRED' : 'off') + '</span>' +
      '<span class="gate">autonomous outreach OFF</span>';
  }

  /* ---- import a signal ---- */
  function importPanel() {
    var opts = W.SOURCE_TYPES.map(function (t) { return '<option value="' + t + '">' + titleCase(t) + '</option>'; }).join('');
    return '' +
      '<div class="wd-panel">' +
      '<div class="wd-ptop"><span class="wd-plabel">Import a world signal</span><span class="wd-run rd" style="border:none;padding:0;margin:0">manual import · live providers honest-blocked</span></div>' +
      '<div class="wd-pbody">' +
      '<div class="wd-form">' +
      '<input id="wd-co" placeholder="Company name" style="min-width:180px">' +
      '<select id="wd-src">' + opts + '</select>' +
      '<input id="wd-st" placeholder="Source title (optional)" style="min-width:170px">' +
      '<input id="wd-url" placeholder="Source URL (optional)" style="min-width:170px">' +
      '<textarea id="wd-rt" placeholder="Paste the real public material — job listing, news, careers copy, a Glassdoor excerpt. Signals are detected from the language and quote the sentence they matched."></textarea>' +
      '<button class="wd-act primary" id="wd-import">Detect &amp; import</button>' +
      '</div></div></div>';
  }

  /* ---- scan ---- */
  function scanPanel(s) {
    var runOpts = W.RUN_TYPES.map(function (t) { return '<option value="' + t + '">' + titleCase(t) + '</option>'; }).join('');
    return '' +
      '<div class="wd-panel">' +
      '<div class="wd-ptop"><span class="wd-plabel">Run a discovery scan</span></div>' +
      '<div class="wd-pbody"><div class="wd-form" style="align-items:center">' +
      '<select id="wd-runtype">' + runOpts + '</select>' +
      '<button class="wd-act primary" id="wd-scan">Run scan</button>' +
      '<span class="wd-run rd" style="border:none;padding:0;margin:0">Processes imported signals into opportunities. No live web fetch in this environment — the run says so honestly.</span>' +
      '</div></div></div>';
  }

  /* ---- opportunities ---- */
  function opportunitiesPanel(s) {
    var body;
    var live = s.opportunities.filter(function (o) { return o.status !== 'dismissed'; });
    if (!live.length) {
      body = '<div class="wd-empty">No company opportunities yet. Import a signal, then run a scan.</div>';
    } else {
      body = live.map(function (o) { return oppCard(o, s); }).join('');
    }
    var dismissed = s.opportunities.filter(function (o) { return o.status === 'dismissed'; }).length;
    return '<div class="wd-panel"><div class="wd-ptop"><span class="wd-plabel">Company opportunities</span>' +
      (dismissed ? '<span class="wd-run rd" style="border:none;padding:0;margin:0">' + dismissed + ' dismissed</span>' : '') +
      '</div><div class="wd-pbody">' + body + '</div></div>';
  }

  function oppCard(o, s) {
    var cl = confLevel(o.confidence);
    var hyp = s.hypotheses.filter(function (h) { return h.opportunity_id === o.opportunity_id; })[0];
    var draft = s.drafts.filter(function (d) { return d.opportunity_id === o.opportunity_id; })[0];
    var researched = (o.status === 'researched' || o.status === 'outreach_ready' || o.status === 'outreach_started');

    var meta =
      '<span class="wd-chip ' + cl + '">conf ' + cl + '</span>' +
      '<span class="wd-chip urg-' + o.urgency + '">urgency ' + o.urgency + '</span>' +
      '<span class="wd-chip status">' + titleCase(o.status) + '</span>' +
      '<span class="wd-chip">' + o.signals.length + ' signal' + (o.signals.length === 1 ? '' : 's') + '</span>' +
      (o.organization_id ? '<span class="wd-chip observed">in Intelligence</span>' : '');

    var h = '<div class="wd-opp">' +
      '<div class="oh"><div><div class="nm">' + esc(o.company_name) + '</div><div class="ty">' + titleCase(o.opportunity_type) + '</div></div></div>' +
      '<div class="meta">' + meta + '</div>' +
      '<div class="angle">' + esc(o.recommended_angle) + '</div>' +
      '<div class="reason">' + esc((o.confidence && o.confidence.reasoning) || '') + '</div>';

    if (hyp) {
      h += '<div class="wd-hyp"><div class="hl">Mission hypothesis · ' + confLevel(hyp.confidence) + '</div>' +
        '<div class="ht">' + esc(hyp.hypothesis) + '</div>' +
        '<div class="hr">' + esc(hyp.reasoning) + '</div>' +
        hyp.validation_questions.map(function (q) { return '<div class="vq">' + esc(q) + '</div>'; }).join('') +
        '</div>';
    }
    if (draft) {
      h += '<div class="wd-draft"><div class="dl"><span>Organization outreach draft</span><span>' + esc(draft.status) + '</span></div>' +
        '<div class="ds">' + esc(draft.subject) + '</div>' +
        '<div class="db">' + esc(draft.body) + '</div>' +
        '<div class="blk">⊘ ' + esc(draft.send_blocked_reason) + '</div></div>';
    }

    h += '<div class="actions">' +
      '<button class="wd-act" data-act="hyp" data-id="' + o.opportunity_id + '">' + (hyp ? 'Regenerate hypothesis' : 'Generate mission hypothesis') + '</button>' +
      '<button class="wd-act" data-act="intel" data-id="' + o.opportunity_id + '">' + (researched ? 'Re-send to Intelligence' : 'Send to Intelligence') + '</button>' +
      '<button class="wd-act primary" data-act="draft" data-id="' + o.opportunity_id + '">' + (draft ? 'Regenerate outreach draft' : 'Generate outreach draft') + '</button>' +
      (o.brief_id ? '<a class="wd-act" href="intel.html">Open brief ↗</a>' : '') +
      '<button class="wd-act danger" data-act="dismiss" data-id="' + o.opportunity_id + '">Dismiss</button>' +
      '</div></div>';
    return h;
  }

  /* ---- signals ---- */
  function signalsPanel(s) {
    var body;
    if (!s.signals.length) body = '<div class="wd-empty">No signals imported yet.</div>';
    else body = s.signals.map(function (sig) {
      var observed = W.OBSERVED_SOURCES.indexOf(sig.source_type) !== -1;
      return '<div class="wd-sig' + (observed ? ' observed' : '') + '">' +
        '<div class="top">' +
        '<span class="ty">' + titleCase(sig.signal_type) + '</span>' +
        '<span class="co">' + esc(sig.company_name || '(unknown company)') + '</span>' +
        '<span class="wd-chip ' + sig.confidence + '">' + sig.confidence + '</span>' +
        '<span class="wd-chip' + (observed ? ' observed' : '') + '">' + titleCase(sig.source_type) + '</span>' +
        '</div>' +
        (sig.evidence ? '<div class="ev">"' + esc(sig.evidence) + '"</div>' : '') +
        '</div>';
    }).join('');
    return '<div class="wd-panel"><div class="wd-ptop"><span class="wd-plabel">Signals</span><span class="wd-run rd" style="border:none;padding:0;margin:0">each quotes the material it was matched from</span></div><div class="wd-pbody">' + body + '</div></div>';
  }

  /* ---- runs ---- */
  function runsPanel(s) {
    var body;
    if (!s.runs.length) body = '<div class="wd-empty">No discovery runs yet.</div>';
    else body = s.runs.map(function (r) {
      return '<div class="wd-run ' + r.status + '">' +
        '<span class="rt">' + titleCase(r.run_type) + ' · ' + r.status + '</span>' +
        '<span class="rd">' + r.signals_found + ' signal' + (r.signals_found === 1 ? '' : 's') + ' processed · ' + r.opportunities_created + ' opportunit' + (r.opportunities_created === 1 ? 'y' : 'ies') + ' · ' + (r.completed_at ? new Date(r.completed_at).toLocaleString() : 'running') + '</span>' +
        (r.errors && r.errors.length ? '<span class="err">⊘ ' + esc(r.errors.join(' ')) + '</span>' : '') +
        '</div>';
    }).join('');
    return '<div class="wd-panel"><div class="wd-ptop"><span class="wd-plabel">Discovery runs</span></div><div class="wd-pbody">' + body + '</div></div>';
  }

  /* ---- events ---- */
  function wire() {
    var imp = document.getElementById('wd-import');
    if (imp) imp.addEventListener('click', function () {
      var co = document.getElementById('wd-co').value.trim();
      var rt = document.getElementById('wd-rt').value.trim();
      if (!co) { toast('Add a company name.'); return; }
      if (!rt && !document.getElementById('wd-url').value.trim()) { toast('Paste the source material.'); return; }
      var res = W.importSignal({
        company_name: co, source_type: document.getElementById('wd-src').value,
        source_title: document.getElementById('wd-st').value.trim(),
        source_url: document.getElementById('wd-url').value.trim(),
        raw_text: rt
      });
      if (res.error) { toast(res.error); return; }
      toast(res.signals.length + ' signal(s) detected: ' + res.signals.map(function (x) { return titleCase(x.signal_type); }).join(', '));
      render();
    });

    var scan = document.getElementById('wd-scan');
    if (scan) scan.addEventListener('click', function () {
      var res = W.runScan(document.getElementById('wd-runtype').value);
      var r = res.run;
      toast('Scan ' + r.status + ' · ' + r.signals_found + ' signals → ' + r.opportunities_created + ' opportunities');
      render();
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-act]'), function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id'), act = btn.getAttribute('data-act'), res;
        if (act === 'hyp') { res = W.generateMissionHypothesis(id); if (!res.error) toast('Mission hypothesis generated.'); }
        else if (act === 'intel') {
          res = W.sendToIntelligence(id);
          if (!res.error) toast('Sent to Intelligence · brief ' + (res.brief ? res.brief.brief_id : 'created') + (res.brief ? ' (' + confLevel(res.brief.confidence) + ')' : ''));
        }
        else if (act === 'draft') { res = W.generateOutreachDraft(id); if (!res.error) toast('Outreach draft generated — review required, not sent.'); }
        else if (act === 'dismiss') { res = W.dismissOpportunity(id); if (!res.error) toast('Opportunity dismissed.'); }
        if (res && res.error) toast(res.error);
        render();
      });
    });
  }

  var reset = document.getElementById('wd-reset');
  if (reset) reset.addEventListener('click', function () {
    if (confirm('Reset all World Discovery data on this device? (Signals, opportunities, hypotheses, drafts, runs.)')) { W.resetWorld(); toast('World Discovery reset.'); render(); }
  });

  render();
})();
