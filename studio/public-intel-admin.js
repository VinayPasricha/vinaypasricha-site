/* Public Organizational Intelligence Engine (Build 3B)
   Renders OF.pubintel over the shared of.runtime.v1 store.
   Consumes the 3A research_queue; only selected companies are researched. */
(function () {
  'use strict';
  if (!window.OF || !window.OF.pubintel) { console.warn('public-intel-admin.js requires of-public-intel.js'); return; }
  var P = window.OF.pubintel;

  var viewEl = document.getElementById('poi-view');
  var railEl = document.getElementById('poi-rail');
  var statsEl = document.getElementById('poi-stats');
  var toastEl = document.getElementById('poi-toast');

  var activeRid = null;   // currently-open research workspace

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function titleCase(s) { return String(s || '').replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(function () { toastEl.classList.remove('show'); }, 2800); }
  function extUrl(u) { return /^https?:\/\//i.test(u) ? u : 'https://' + u; }

  function render() {
    var s = P.snapshot();
    renderRail(s);
    renderStats(s);
    var html = '';
    html += queuePanel(s);
    if (activeRid) html += workspace(activeRid);
    viewEl.innerHTML = html;
    wire(s);
  }

  function renderRail(s) {
    var anyResearch = s.research.length > 0;
    var anySig = s.counts.signals > 0;
    var anyEst = (window.OF.load().pub_estimates || []).length > 0;
    var anyPage = s.pages.length > 0;
    var anyReady = s.counts.ready > 0;
    var stages = [
      { n: '01', t: 'Research queue (3A)', done: s.counts.queued > 0 },
      { n: '02', t: 'Company URL', done: s.research.some(function (r) { return r.website_url; }) },
      { n: '03', t: 'Public research', done: anyResearch, now: s.counts.queued > 0 && !anyResearch },
      { n: '04', t: 'Signal inventory', done: anySig },
      { n: '05', t: 'Frequency estimate', done: anyEst },
      { n: '06', t: 'Contradiction map', done: anyEst },
      { n: '07', t: 'Public page · ready', done: anyReady, now: anyEst && !anyReady }
    ];
    railEl.innerHTML = stages.map(function (st) {
      var cls = st.done ? 'done' : (st.now ? 'now' : '');
      return '<div class="poi-stage ' + cls + '"><div class="sn">' + st.n + (st.done ? ' <span class="tick">✓</span>' : '') + '</div><div class="st">' + st.t + '</div></div>';
    }).join('');
  }

  function renderStats(s) {
    var c = s.counts;
    statsEl.innerHTML =
      stat(c.queued, 'In 3A queue') +
      stat(c.researching, 'Researching') +
      stat(c.completed, 'Completed') +
      stat(c.signals, 'Public signals') +
      stat(c.pages, 'Profile pages') +
      stat(c.ready, 'Ready for review');
  }
  function stat(n, l) { return '<div class="poi-stat"><div class="n">' + n + '</div><div class="l">' + l + '</div></div>'; }

  /* ============ RESEARCH QUEUE ============ */
  function queuePanel(s) {
    var body;
    if (!s.queue.length) {
      body = '<div class="poi-empty">The 3A research queue is empty. Select companies in <a href="icp.html">ICP &amp; Targets</a> and <em>Mark For Research</em> — only selected companies appear here.</div>';
    } else {
      body = s.queue.map(function (q) { return queueRow(q); }).join('');
    }
    return '<div class="poi-panel"><div class="poi-ptop"><span class="poi-plabel">Research Queue · from 3A</span><span class="poi-pnote">company URL is the only required input · live providers honest-blocked</span></div><div class="poi-pbody">' + body + '</div></div>';
  }

  function queueRow(q) {
    var r = q.research;
    var status = q.research_status;
    var rid = r ? r.research_id : null;
    var isActive = rid && rid === activeRid;
    var page = null;
    if (rid) { var full = P.getResearch(rid); page = full ? full.page : null; }
    var url = q.website_url;
    return '<div class="poi-q">' +
      '<div class="qh"><div><div class="qn">' + esc(q.company_name) + '</div>' +
        (url ? '<div class="qurl"><a href="' + extUrl(url) + '" target="_blank" rel="noopener">' + esc(url) + ' ↗</a></div>' : '<div class="qurl" style="color:var(--poi-ink4)">no URL on file — add one to research</div>') +
      '</div><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">' +
        '<span class="poi-status ' + status + '">' + titleCase(status) + '</span>' +
        (page ? '<span class="poi-status ' + page.status + '">page: ' + titleCase(page.status) + '</span>' : '') +
      '</div></div>' +
      (r && r.status === 'blocked' && !r.source_inventory.length ? '<div class="poi-block">⊘ ' + esc(r.provider_note) + '</div>' : '') +
      '<div class="actions">' +
        (!url ? '<input id="poi-url-' + q.queue_entry.candidate_id + '" placeholder="https://company.com" style="background:var(--poi-gr1);border:1px solid var(--poi-edge);border-radius:2px;color:var(--poi-ink);font-family:var(--poi-sans);font-size:12px;padding:7px 9px;min-width:200px">' : '') +
        (!r
          ? '<button class="poi-act primary" data-act="start" data-cid="' + q.queue_entry.candidate_id + '">Start public research</button>'
          : '<button class="poi-act' + (isActive ? '' : ' primary') + '" data-act="open" data-rid="' + rid + '">' + (isActive ? 'Close workspace' : 'Open workspace') + '</button>') +
      '</div></div>';
  }

  /* ============ WORKSPACE (per company) ============ */
  function workspace(rid) {
    var f = P.getResearch(rid);
    if (!f) return '';
    var r = f.research, sigs = f.signals, est = f.estimate, cons = f.contradictions, page = f.page;
    var dimSigs = sigs.filter(function (x) { return x.frequency_dimension; });

    var h = '<div class="poi-panel"><div class="poi-ptop"><span class="poi-plabel">Workspace · ' + esc(r.company_name) + '</span>' +
      '<span class="poi-pnote">' + r.source_inventory.length + ' source' + (r.source_inventory.length === 1 ? '' : 's') + ' · ' + dimSigs.length + ' dimension signal' + (dimSigs.length === 1 ? '' : 's') + '</span></div><div class="poi-pbody">';

    // import public source
    var srcOpts = P.SOURCE_TYPES.map(function (t) { return '<option value="' + t + '">' + titleCase(t) + '</option>'; }).join('');
    h += '<div style="margin-bottom:18px"><div class="poi-pnote" style="margin-bottom:8px;color:var(--poi-acc)">IMPORT PUBLIC SOURCE</div><div class="poi-form">' +
      '<select id="poi-src">' + srcOpts + '</select>' +
      '<input id="poi-stitle" placeholder="Source title (optional)" style="min-width:160px">' +
      '<input id="poi-surl" placeholder="Source URL (optional)" style="min-width:160px">' +
      '<textarea id="poi-stext" placeholder="Paste real public material — careers copy, a news item, a public interview excerpt, public job posts, public employee comments. Signals are detected from the language and quote what they matched."></textarea>' +
      '<button class="poi-act primary" data-act="import" data-rid="' + rid + '">Detect &amp; import</button>' +
      '</div></div>';

    // signal inventory
    h += '<div class="poi-pnote" style="margin:18px 0 8px;color:var(--poi-acc)">SIGNAL INVENTORY</div>';
    if (!sigs.length) h += '<div class="poi-empty">No signals yet. Import a public source above.</div>';
    else h += sigs.map(sigRow).join('');

    // estimate + page actions
    h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:18px;padding-top:16px;border-top:1px solid var(--poi-rule)">' +
      '<button class="poi-act primary" data-act="estimate" data-rid="' + rid + '"' + (dimSigs.length ? '' : ' disabled') + '>' + (est ? 'Regenerate frequency estimate' : 'Generate frequency estimate') + '</button>' +
      '<button class="poi-act" data-act="page" data-rid="' + rid + '"' + (est ? '' : ' disabled') + '>' + (page ? 'Regenerate public page' : 'Generate public page') + '</button>' +
      (page && page.status !== 'ready_for_review' && page.status !== 'published' ? '<button class="poi-act gold" data-act="ready" data-pid="' + page.page_id + '">Mark ready for review →</button>' : '') +
      (page && page.status === 'ready_for_review' ? '<button class="poi-act" data-act="revise" data-pid="' + page.page_id + '">Send back (needs revision)</button>' : '') +
      '</div>';

    // estimate
    if (est) h += estimateBlock(est);
    // contradictions
    h += contradictionsBlock(cons);
    // page + SEO
    if (page) { h += pageBlock(page); h += seoBlock(page); }

    h += '</div></div>';
    return h;
  }

  function sigRow(s) {
    var rank = P.OBSERVED_SOURCES.indexOf(s.source_type) !== -1 ? 'observed' : (P.CLAIM_SOURCES.indexOf(s.source_type) !== -1 ? 'claim' : '');
    return '<div class="poi-sig ' + rank + '"><div class="top">' +
      (s.frequency_dimension ? '<span class="dim">' + esc(P.DIM_LABELS[s.frequency_dimension] || titleCase(s.frequency_dimension)) + '</span>' : '<span class="dim" style="color:var(--poi-ink4)">No dimension</span>') +
      '<span class="cat">' + titleCase(s.signal_category) + '</span>' +
      '<span class="poi-chip ' + s.confidence + '">' + s.confidence + '</span>' +
      '<span class="src">' + titleCase(s.source_type) + (rank ? ' · ' + rank : '') + '</span>' +
      '</div>' +
      '<div class="interp">' + esc(s.interpretation) + '</div>' +
      (s.raw_excerpt ? '<div class="ex">“' + esc(s.raw_excerpt) + '”</div>' : '') +
      '</div>';
  }

  function estimateBlock(est) {
    var rows = P.DIMENSIONS.map(function (dim) {
      var d = est.dimensions[dim] || {};
      var unknown = d.confidence === 'none';
      return '<div class="poi-dim"><div class="dn">' + esc(P.DIM_LABELS[dim]) + '</div>' +
        '<div class="dl' + (unknown ? ' unknown' : '') + '">' + esc(d.level || '—') + (d.needs_validation && !unknown ? ' <span class="needs">· needs validation</span>' : '') + '</div>' +
        '<div class="ds">' + esc(d.summary || '') + '</div></div>';
    }).join('');
    return '<div style="margin-top:18px;padding-top:16px;border-top:1px solid var(--poi-rule)">' +
      '<div class="poi-pnote" style="margin-bottom:6px;color:var(--poi-acc)">INITIAL FREQUENCY ESTIMATE · overall confidence ' + esc(est.overall_confidence) + (est.limited_material ? ' · <span class="poi-limited">based on limited public material</span>' : '') + '</div>' +
      '<div class="poi-pnote" style="margin-bottom:10px;text-transform:none;font-style:italic;color:var(--poi-ink3)">' + esc(est.confidence_reasoning) + '</div>' +
      rows + '</div>';
  }

  function contradictionsBlock(cons) {
    var h = '<div style="margin-top:18px;padding-top:16px;border-top:1px solid var(--poi-rule)"><div class="poi-pnote" style="margin-bottom:10px;color:var(--poi-acc)">CONTRADICTION MAP</div>';
    if (!cons.length) h += '<div class="poi-empty">No contradictions detected in current public signals. Generate an estimate first; tensions surface as a signal to validate, never a judgement.</div>';
    else h += cons.map(function (c) {
      return '<div class="poi-con ' + c.severity + '"><div class="cd">' + esc(titleCase(c.dimension)) + ' · ' + c.severity + ' · conf ' + c.confidence + '</div>' +
        '<div class="cl"><b>Claim:</b> “' + esc(c.claim) + '”</div>' +
        '<div class="cl"><b>Counter-signal:</b> “' + esc(c.counter_signal) + '”</div>' +
        '<div class="ci">' + esc(c.interpretation) + '</div></div>';
    }).join('');
    return h + '</div>';
  }

  function pageBlock(page) {
    var secs = page.sections.map(function (sec) {
      if (sec.key === 'cta') {
        return '<div class="poi-cta"><div class="ch">' + esc(sec.title) + '</div><div class="cb">' + esc(sec.body) + '</div>' +
          '<div class="cbtns">' + (sec.buttons || []).map(function (b) { return '<button class="poi-act gold" disabled style="opacity:.85">' + esc(b) + '</button>'; }).join('') + '</div>' +
          '<div class="poi-pnote" style="margin-top:8px">placeholder — no form functionality in this build</div></div>';
      }
      if (sec.key === 'estimate' && sec.items) {
        var rows = sec.items.map(function (it) {
          return '<div class="poi-estrow"><span class="el">' + esc(it.label) + (it.needs_validation ? ' · <span style="color:var(--poi-warm)">unvalidated</span>' : '') + '</span><span class="ev">' + esc(it.level) + '</span></div>';
        }).join('');
        return '<div class="poi-sec"><div class="sh">' + esc(sec.title) + '</div>' + rows + '</div>';
      }
      var inner = '';
      if (sec.body) inner += '<div class="sb">' + esc(sec.body) + '</div>';
      if (sec.items && sec.items.length) inner += '<ul>' + sec.items.map(function (it) { return '<li>' + esc(it) + '</li>'; }).join('') + '</ul>';
      return '<div class="poi-sec"><div class="sh">' + esc(sec.title) + '</div>' + inner + '</div>';
    }).join('');
    return '<div style="margin-top:18px;padding-top:16px;border-top:1px solid var(--poi-rule)"><div class="poi-pnote" style="margin-bottom:10px;color:var(--poi-acc)">PUBLIC PAGE PREVIEW · ' + esc(page.url) + ' · <span class="poi-status ' + page.status + '">' + titleCase(page.status) + '</span></div>' +
      '<div class="poi-page"><div class="pp-h1">' + esc(page.h1) + '</div><div class="pp-sum">' + esc(page.summary) + '</div>' +
      (page.limited_material ? '<div class="poi-limited" style="margin-top:8px">Based on limited public material.</div>' : '') +
      secs + '</div></div>';
  }

  function seoBlock(page) {
    var seo = page.seo || {};
    return '<div style="margin-top:18px;padding-top:16px;border-top:1px solid var(--poi-rule)"><div class="poi-pnote" style="margin-bottom:10px;color:var(--poi-acc)">SEO PREVIEW</div>' +
      '<div class="poi-seo">' +
      '<div class="poi-serp"><div class="u">vinaypasricha.com' + esc(page.url) + '</div><div class="t">' + esc(seo.title_tag || page.title) + '</div><div class="m">' + esc(seo.meta_description || page.meta_description) + '</div></div>' +
      '<div class="poi-kv">' +
        kv('Slug', esc(seo.slug || page.slug)) +
        kv('H1', esc(seo.h1 || page.h1)) +
        kv('Title tag', esc(seo.title_tag || page.title) + ' <span style="color:var(--poi-ink4)">(' + (seo.title_tag || page.title).length + ' chars)</span>') +
        kv('Meta desc', esc(seo.meta_description || page.meta_description) + ' <span style="color:var(--poi-ink4)">(' + (seo.meta_description || page.meta_description).length + ' chars)</span>') +
        kv('Target keywords', '<div class="poi-tags">' + (page.seo_keywords || []).map(function (k) { return '<span class="poi-tag">' + esc(k) + '</span>'; }).join('') + '</div>') +
        kv('Internal tags', '<div class="poi-tags">' + (seo.internal_tags || []).map(function (k) { return '<span class="poi-tag">' + esc(k) + '</span>'; }).join('') + '</div>') +
      '</div>' +
      '<div><div class="poi-pnote" style="margin-bottom:6px">schema.org JSON-LD</div><pre class="poi-jsonld">' + esc(seo.schema_json_ld || '') + '</pre></div>' +
      '</div></div>';
  }
  function kv(k, v) { return '<div class="k">' + k + '</div><div class="v">' + v + '</div>'; }

  /* ============ EVENTS ============ */
  function wire(s) {
    each('[data-act]', function (btn) {
      btn.addEventListener('click', function () {
        var act = btn.getAttribute('data-act'), res;
        if (act === 'start') {
          var cid = btn.getAttribute('data-cid');
          var urlInput = document.getElementById('poi-url-' + cid);
          res = P.startResearch(cid, urlInput ? urlInput.value.trim() : '');
          if (res.error) { toast(res.error); return; }
          activeRid = res.research.research_id;
          toast(res.blocked ? 'Research opened · live providers blocked — import public sources.' : 'Public research started for ' + res.research.company_name + '.');
          render();
        }
        else if (act === 'open') {
          var rid = btn.getAttribute('data-rid');
          activeRid = (activeRid === rid) ? null : rid;
          render();
        }
        else if (act === 'import') {
          var rid2 = btn.getAttribute('data-rid');
          var text = document.getElementById('poi-stext').value.trim();
          var surl = document.getElementById('poi-surl').value.trim();
          if (!text && !surl) { toast('Paste the public source text (or at least a URL).'); return; }
          res = P.importSource(rid2, {
            source_type: document.getElementById('poi-src').value,
            source_title: document.getElementById('poi-stitle').value.trim(),
            source_url: surl, raw_text: text
          });
          if (res.error) { toast(res.error); return; }
          toast(res.signals.length + ' signal(s) detected: ' + res.signals.map(function (x) { return x.frequency_dimension ? titleCase(x.frequency_dimension) : 'unknown'; }).slice(0, 4).join(', '));
          render();
        }
        else if (act === 'estimate') {
          res = P.generateEstimate(btn.getAttribute('data-rid'));
          if (res.error) { toast(res.error); return; }
          toast('Frequency estimate generated · overall confidence ' + res.estimate.overall_confidence + '.');
          render();
        }
        else if (act === 'page') {
          res = P.generatePage(btn.getAttribute('data-rid'));
          if (res.error) { toast(res.error); return; }
          toast('Public page drafted · /companies/' + res.page.slug);
          render();
        }
        else if (act === 'ready') {
          res = P.markReady(btn.getAttribute('data-pid'));
          if (res.error) { toast(res.error); return; }
          toast('Marked ready for review — not published. Human review required.');
          render();
        }
        else if (act === 'revise') {
          res = P.setPageStatus(btn.getAttribute('data-pid'), 'needs_revision');
          if (!res.error) toast('Sent back for revision.');
          render();
        }
      });
    });
  }

  function each(sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), fn); }

  var reset = document.getElementById('poi-reset');
  if (reset) reset.addEventListener('click', function () {
    if (confirm('Reset all Public Intelligence research on this device? (Research records, signals, estimates, contradictions, pages.) The 3A research queue is NOT touched.')) {
      P.resetPublic(); activeRid = null; toast('Public research reset.'); render();
    }
  });

  render();
})();
