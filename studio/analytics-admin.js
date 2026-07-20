/* Studio · Website Analytics — reads /api/analytics/summary and renders the
   dashboard. Reuses the studio gate. Charts are inline SVG/CSS (no libraries)
   built on the site's own design tokens, so it matches the rest of Studio. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function toast(m) { var t = $('toast'); t.textContent = m; t.classList.add('show'); setTimeout(function () { t.classList.remove('show'); }, 1800); }
  function num(n) { return (n == null ? 0 : n).toLocaleString('en-US'); }
  function dur(s) {
    s = parseInt(s, 10) || 0;
    if (s < 60) return s + 's';
    var m = Math.floor(s / 60), r = s % 60;
    return m + 'm' + (r ? ' ' + r + 's' : '');
  }
  function shortDay(d) { var t = new Date(d + 'T00:00:00'); return isNaN(t) ? d : t.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }

  var days = 30;

  async function api(d) {
    var res = await fetch('/api/analytics/summary?days=' + d, { headers: { 'Content-Type': 'application/json' } });
    var body = {}; try { body = await res.json(); } catch (e) {}
    return { ok: res.ok && body.ok !== false, status: res.status, data: body };
  }

  // ---- auth gate ----
  async function boot() {
    var r = await api(days);
    if (r.status === 401 || r.status === 503) { showLogin(); return; }
    $('main').style.display = 'block';
    wireRange();
    if (r.ok) render(r.data); else toast(r.data.error || 'Failed to load');
  }
  function showLogin() {
    $('login').style.display = 'block';
    $('loginBtn').onclick = async function () {
      var res = await fetch('/api/studio/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: $('pw').value }) });
      if (res.ok) { $('login').style.display = 'none'; boot(); }
      else { $('loginErr').style.display = 'block'; }
    };
    $('pw').onkeydown = function (e) { if (e.key === 'Enter') $('loginBtn').click(); };
  }

  function wireRange() {
    Array.prototype.forEach.call(document.querySelectorAll('#range button'), function (b) {
      b.onclick = async function () {
        days = parseInt(b.getAttribute('data-days'), 10);
        Array.prototype.forEach.call(document.querySelectorAll('#range button'), function (x) { x.classList.toggle('on', x === b); });
        var r = await api(days);
        if (r.ok) render(r.data); else toast('Failed to load');
      };
    });
  }

  // ---- render ----
  function render(d) {
    var t = d.traffic || {};
    var eng = d.engagement || {};
    var fun = d.funnel || {};

    $('rangeSub').textContent = (d.range ? d.range.since + '  →  ' + d.range.until : '') + ' · ' + (d.range ? d.range.days : '') + ' days';

    $('note').innerHTML = '';
    if (d.indexNeeded) {
      $('note').innerHTML = '<div class="an-note">Traffic data needs a one-time Firestore index on <code>analytics_events (day)</code>. It builds automatically a minute after the first events arrive — or create it in the Firestore console. Engagement &amp; funnel below work regardless.</div>';
    } else if (t.views === 0) {
      $('note').innerHTML = '<div class="an-note">No page views recorded yet for this range. Once the tracker is deployed and pages are visited, traffic will appear here.</div>';
    } else if (d.partial) {
      $('note').innerHTML = '<div class="an-note">Showing a capped sample (20,000 most-recent events) for this range — totals may understate very high-traffic windows.</div>';
    }

    // KPI tiles
    var kpis = [
      { v: num(t.views), l: 'Page views', hot: true },
      { v: num(t.visitors), l: 'Unique visitors' },
      { v: num(t.sessions), l: 'Sessions' },
      { v: dur(t.avgSeconds), l: 'Avg time on page' },
      { v: (t.bounceRate || 0) + '%', l: 'Bounce rate', s: 'single-page sessions' },
      { v: dur((d.behavior && d.behavior.avgEngaged) || 0), l: 'Avg engaged time', s: 'active, not idle' },
      { v: num((d.people && d.people.known) || 0), l: 'Known people', hot: true, s: 'identified' },
      { v: num((d.events && d.events.total) || 0), l: 'Events tracked', s: 'clicks · forms · scroll' },
      { v: num(eng.conversations), l: 'AI conversations' },
      { v: num(eng.leads), l: 'Leads captured' },
      { v: num(fun.total), l: 'ABL participants', s: fun.avgRating ? ('avg ' + fun.avgRating + '★') : '' },
    ];
    $('kpis').innerHTML = kpis.map(function (k) {
      return '<div class="stat' + (k.hot ? ' hot' : '') + '"><div class="stat-v">' + k.v + '</div><div class="stat-l">' + esc(k.l) + '</div>' + (k.s ? '<div class="stat-s">' + esc(k.s) + '</div>' : '') + '</div>';
    }).join('');

    renderChart(t.timeseries || []);
    bars('topEvents', (d.events && d.events.topEvents) || [], evLabel);
    bars('eventTypes', (d.events && d.events.byType) || [], evLabel);
    loadPeople();
    renderFunnel(d.funnelSteps || []);

    var acq = d.acquisition || {};
    bars('acqSources', acq.topSources, function (k) { return k === 'direct' ? 'Direct / none' : k; });
    bars('acqCampaigns', acq.topCampaigns, function (k) { return k; });
    bars('acqLanding', acq.landingPages, function (k) { return k; }, openPage);
    bars('acqExit', acq.exitPages, function (k) { return k; }, openPage);

    var aud = d.audience || {};
    if ($('newV')) $('newV').textContent = num(aud.newVisitors || 0);
    if ($('retV')) $('retV').textContent = num(aud.returningVisitors || 0);
    bars('audCountries', aud.countries, function (k) { return k; });
    bars('audBrowsers', aud.browsers, function (k) { return k; });
    bars('audOS', aud.os, function (k) { return k; });

    var aiTiles = [
      { v: num(eng.conversations), l: 'AI conversations' },
      { v: (eng.avgMessages || 0), l: 'Avg messages / chat' },
      { v: (eng.completionRate || 0) + '%', l: 'Completion rate', s: 'reached a result' },
    ];
    if ($('aiDepth')) $('aiDepth').innerHTML = aiTiles.map(function (k) {
      return '<div class="stat"><div class="stat-v">' + k.v + '</div><div class="stat-l">' + esc(k.l) + '</div>' + (k.s ? '<div class="stat-s">' + esc(k.s) + '</div>' : '') + '</div>';
    }).join('');

    bars('topPages', t.topPages, function (k) { return k; }, openPage);
    bars('topRefs', t.topReferrers, function (k) { return k === 'direct' ? 'Direct / none' : k; });
    bars('devices', t.devices, cap);
    bars('langs', t.languages, function (k) { return k.toUpperCase(); });
    bars('runtimes', eng.byRuntime, cap);
    bars('funnel', (fun.byStatus || []).map(function (s) { return { key: s.status, count: s.count }; }), function (k) { return cap(k.replace(/_/g, ' ')); });

    var leads = eng.recentLeads || [];
    $('leads').innerHTML = leads.length
      ? leads.map(function (l) {
        return '<tr><td>' + esc(l.email || l.name || '—') + (l.name && l.email ? '<div style="font-size:11px;color:var(--ink-3)">' + esc(l.name) + '</div>' : '') + '</td><td class="r">' + esc(l.source || '') + '</td></tr>';
      }).join('')
      : '<tr><td class="muted">No leads captured yet.</td></tr>';
  }

  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }

  // Plain-language labels for the raw event names/types the tracker emits.
  var EVENT_LABELS = {
    pageview: 'Page views', duration: 'Time on page',
    click: 'Clicks', scroll: 'Scroll depth', event: 'Custom events', form_submit: 'Form submissions', identify: 'Identified',
    link: 'Internal link click', outbound_link: 'Outbound link click', button: 'Button click',
    contact_link: 'Email / phone link', form: 'Form submitted',
    depth_25: 'Scrolled 25%', depth_50: 'Scrolled halfway', depth_75: 'Scrolled 75%', depth_100: 'Scrolled to the end',
    rage_click: 'Rage click (frustration)',
  };
  function evLabel(k) { return EVENT_LABELS[k] || cap(String(k).replace(/_/g, ' ')); }

  // Horizontal bar list from [{key, count}]. Pass onClick to make rows clickable.
  function bars(id, items, fmt, onClick) {
    items = items || [];
    var el = $(id);
    if (!el) return;
    if (!items.length) { el.innerHTML = '<div class="muted">No data yet.</div>'; return; }
    var max = items.reduce(function (m, x) { return Math.max(m, x.count || 0); }, 0) || 1;
    el.innerHTML = items.map(function (x, i) {
      var pct = Math.max(2, Math.round((x.count || 0) / max * 100));
      var label = fmt ? fmt(x.key) : x.key;
      return '<div class="bar"><div class="lbl' + (onClick ? ' clk' : '') + '" data-i="' + i + '"><span class="fill" style="width:' + pct + '%"></span><span>' + esc(label) + '</span></div><div class="val">' + num(x.count) + '</div></div>';
    }).join('');
    if (onClick) {
      Array.prototype.forEach.call(el.querySelectorAll('.lbl.clk'), function (lbl) {
        lbl.onclick = function () { var it = items[parseInt(lbl.getAttribute('data-i'), 10)]; if (it) onClick(it.key); };
      });
    }
  }

  // Inline SVG line chart: daily page views (area) + unique visitors (line).
  function renderChart(series) {
    var el = $('chart');
    if (!series.length) { el.innerHTML = '<div class="muted">No traffic in this range yet.</div>'; return; }
    var W = 720, H = 240, padL = 34, padR = 8, padT = 12, padB = 22;
    var iw = W - padL - padR, ih = H - padT - padB;
    var max = series.reduce(function (m, p) { return Math.max(m, p.views, p.visitors); }, 0) || 1;
    // round the axis max up to something clean
    var step = Math.pow(10, Math.floor(Math.log10(max)));
    var axMax = Math.ceil(max / step) * step || 1;
    var n = series.length;
    function x(i) { return padL + (n === 1 ? iw / 2 : (i / (n - 1)) * iw); }
    function y(v) { return padT + ih - (v / axMax) * ih; }

    function path(key, close) {
      var pts = series.map(function (p, i) { return x(i).toFixed(1) + ',' + y(p[key]).toFixed(1); });
      if (!close) return 'M' + pts.join(' L');
      return 'M' + x(0).toFixed(1) + ',' + y(0).toFixed(1) + ' L' + pts.join(' L') + ' L' + x(n - 1).toFixed(1) + ',' + y(0).toFixed(1) + ' Z';
    }

    // gridlines + y labels (0, mid, max)
    var grid = '';
    [0, 0.5, 1].forEach(function (f) {
      var gy = padT + ih - f * ih, val = Math.round(axMax * f);
      grid += '<line x1="' + padL + '" y1="' + gy.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + gy.toFixed(1) + '" stroke="var(--rule)" stroke-width="1" opacity="0.6"/>';
      grid += '<text x="' + (padL - 6) + '" y="' + (gy + 3).toFixed(1) + '" text-anchor="end" font-family="var(--mono)" font-size="9" fill="var(--ink-3)">' + num(val) + '</text>';
    });

    // x labels: first, middle, last
    var xl = '';
    [0, Math.floor((n - 1) / 2), n - 1].forEach(function (i) {
      if (i < 0 || i >= n) return;
      xl += '<text x="' + x(i).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle" font-family="var(--mono)" font-size="9" fill="var(--ink-3)">' + esc(shortDay(series[i].day)) + '</text>';
    });

    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Daily traffic">' +
      grid +
      '<path d="' + path('views', true) + '" fill="color-mix(in srgb, var(--accent) 14%, transparent)" stroke="none"/>' +
      '<path d="' + path('views', false) + '" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="' + path('visitors', false) + '" fill="none" stroke="var(--ink-2)" stroke-width="1.5" stroke-dasharray="4 3" stroke-linejoin="round"/>' +
      xl +
      '</svg>' +
      '<div class="lgnd"><span class="k"><span class="sw" style="background:var(--accent)"></span>Page views</span>' +
      '<span class="k"><span class="sw" style="background:var(--ink-2)"></span>Unique visitors</span></div>';
    el.innerHTML = svg;
  }

  // ---- People directory ----------------------------------------------------
  var peopleCache = null;   // loaded once (people are all-time, not range-scoped)
  var peopleLoading = false;

  async function loadPeople() {
    if (peopleCache || peopleLoading) { if (peopleCache) renderPeople(peopleCache); return; }
    peopleLoading = true;
    var res = await fetch('/api/analytics/people?limit=500', { headers: { 'Content-Type': 'application/json' } });
    peopleLoading = false;
    var body = {}; try { body = await res.json(); } catch (e) {}
    peopleCache = (body && body.people) || [];
    renderPeople(peopleCache);
    var s = $('peopleSearch');
    if (s && !s._wired) { s._wired = true; s.oninput = function () { renderPeople(peopleCache); }; }
  }

  function renderPeople(people) {
    $('peopleCount').textContent = people.length ? '· ' + people.length + ' identified' : '';
    var q = ($('peopleSearch') && $('peopleSearch').value || '').trim().toLowerCase();
    var rows = people.filter(function (p) {
      if (!q) return true;
      return (p.name + ' ' + p.email + ' ' + p.company).toLowerCase().indexOf(q) !== -1;
    });
    var el = $('people');
    if (!people.length) { el.innerHTML = '<tr><td class="muted" style="padding:14px">No one identified yet. People appear here once a visitor submits a lead form, logs into the Participant Room, opens an ABL session, or shares their email in a chat.</td></tr>'; return; }
    el.innerHTML = '<thead><tr><th>Person</th><th>Company</th><th>Country</th><th>Source</th><th>Score</th><th>Events</th><th>Last seen</th></tr></thead><tbody>' +
      rows.map(function (p) {
        return '<tr data-pid="' + esc(p.id) + '">' +
          '<td><div class="pnm">' + esc(p.name || '—') + '</div><div class="pem">' + esc(p.email || '(no email)') + '</div></td>' +
          '<td>' + esc(p.company || '—') + '</td>' +
          '<td>' + esc(p.country || '—') + '</td>' +
          '<td>' + (p.source ? '<span class="badge">' + esc(p.source) + '</span>' : '—') + '</td>' +
          '<td class="num">' + num(p.score || 0) + '</td>' +
          '<td class="num">' + num(p.eventCount) + '</td>' +
          '<td class="num">' + when(p.lastSeen) + '</td>' +
          '</tr>';
      }).join('') + '</tbody>';
    Array.prototype.forEach.call(el.querySelectorAll('tr[data-pid]'), function (tr) {
      tr.onclick = function () { openPerson(tr.getAttribute('data-pid')); };
    });
  }

  var DOTS = { pageview: 'var(--accent)', duration: 'var(--ink-3)', click: '#6a8caf', form_submit: '#b08968', scroll: '#9a9a9a', event: '#7a9e7e', identify: 'var(--accent-2, #b08968)' };

  async function openPerson(pid) {
    var panel = $('personPanel');
    panel.innerHTML = '<div class="pcard"><div class="muted">Loading timeline…</div></div>';
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    var res = await fetch('/api/analytics/person/' + encodeURIComponent(pid) + '?limit=500', { headers: { 'Content-Type': 'application/json' } });
    var body = {}; try { body = await res.json(); } catch (e) {}
    if (!body.ok) { panel.innerHTML = '<div class="pcard"><div class="muted">Could not load this person.</div></div>'; return; }
    var p = body.person, evs = body.events || [];
    var meta = [];
    if (p.email) meta.push(esc(p.email));
    if (p.company) meta.push(esc(p.company));
    if (p.role) meta.push(esc(p.role));
    if (p.phone) meta.push(esc(p.phone));
    if (p.country) meta.push('📍 ' + esc(p.country));
    if (p.firstTouch) meta.push('first touch: ' + esc(p.firstTouch));
    meta.push(p.eventCount + ' events');
    meta.push(p.devices + ' device' + (p.devices === 1 ? '' : 's') + (p.moreDevices ? '+' : ''));
    meta.push('first ' + when(p.firstSeen) + ' · last ' + when(p.lastSeen));

    var tl = evs.map(function (e) {
      var dot = DOTS[e.type] || 'var(--ink-3)';
      var what = describe(e);
      return '<div class="tl-row"><div class="tl-when">' + whenTime(e.at) + '</div>' +
        '<div class="tl-type"><span class="dot" style="background:' + dot + '"></span>' + esc(evLabel(e.type)) + '</div>' +
        '<div class="tl-what">' + what + '</div></div>';
    }).join('');

    panel.innerHTML = '<div class="pcard">' +
      '<div class="ph"><div><h3>' + esc(p.name || p.email || 'Anonymous person') + '</h3>' +
      '<div class="meta">' + meta.join(' · ') + (p.source ? ' · <span class="badge">' + esc(p.source) + '</span>' : '') + '</div></div>' +
      '<button class="close" id="pclose">Close ✕</button></div>' +
      '<div class="tl">' + (tl || '<div class="muted" style="padding:12px">No events recorded for this person yet.</div>') + '</div></div>';
    $('pclose').onclick = function () { panel.innerHTML = ''; };
  }

  function describe(e) {
    if (e.type === 'pageview') return '<span>' + esc(e.title || e.path) + '</span> <span class="sub">' + esc(e.path) + (e.ref && e.ref !== 'direct' ? ' · via ' + esc(e.ref) : '') + '</span>';
    if (e.type === 'duration') return '<span class="sub">' + dur(e.seconds) + ' on ' + esc(e.path) + '</span>';
    if (e.type === 'click') { var pr = e.props || {}; return '<span>' + esc(e.name || 'click') + '</span> <span class="sub">' + esc(pr.text || pr.href || '') + (pr.outbound ? ' ↗' : '') + '</span>'; }
    if (e.type === 'form_submit') return '<span>form submit</span> <span class="sub">' + esc((e.props && e.props.action) || e.name || '') + '</span>';
    if (e.type === 'scroll') return '<span class="sub">scrolled ' + esc((e.props && e.props.depth) || '') + '% of ' + esc(e.path) + '</span>';
    if (e.type === 'identify') return '<span>identified</span> <span class="sub">' + esc(e.path) + '</span>';
    return '<span>' + esc(e.name || e.type) + '</span> <span class="sub">' + esc(e.path) + '</span>';
  }

  function when(v) {
    if (!v) return '—';
    var t = toDate(v); if (!t) return '—';
    var days = Math.floor((Date.now() - t.getTime()) / 86400000);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 30) return days + 'd ago';
    return t.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
  }
  function whenTime(v) {
    var t = toDate(v); if (!t) return '—';
    return t.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' + t.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
  function toDate(v) {
    try {
      if (!v) return null;
      if (typeof v === 'object' && v._seconds != null) return new Date(v._seconds * 1000);
      var t = new Date(v); return isNaN(t.getTime()) ? null : t;
    } catch (e) { return null; }
  }

  // ---- Conversion funnel ---------------------------------------------------
  function renderFunnel(steps) {
    var el = $('funnelSteps'); if (!el) return;
    if (!steps.length) { el.innerHTML = '<div class="muted">No sessions in this range yet.</div>'; return; }
    var prev = null;
    el.innerHTML = steps.map(function (s) {
      var drop = (prev != null && prev > 0) ? Math.round((1 - s.count / prev) * 100) : 0;
      prev = s.count;
      return '<div class="fstep"><div class="fhead"><span class="fname">' + esc(s.step) + '</span><span class="fval">' + num(s.count) + ' · ' + s.pct + '%</span></div>' +
        '<div class="ftrack"><div class="ffill" style="width:' + Math.max(3, s.pct) + '%">' + s.pct + '%</div></div>' +
        (drop > 0 ? '<div class="fdrop">↓ ' + drop + '% drop-off from previous step</div>' : '') + '</div>';
    }).join('');
  }

  // ---- Per-page drill-down -------------------------------------------------
  var H3 = 'font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3);margin-bottom:8px';
  async function openPage(path) {
    var panel = $('pagePanel'); if (!panel) return;
    panel.innerHTML = '<div class="ppage"><div class="muted">Loading page stats…</div></div>';
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    var res = await fetch('/api/analytics/page?path=' + encodeURIComponent(path) + '&days=' + days, { headers: { 'Content-Type': 'application/json' } });
    var b = {}; try { b = await res.json(); } catch (e) {}
    if (!b.ok) { panel.innerHTML = '<div class="ppage"><div class="muted">Could not load page stats.</div></div>'; return; }
    var st = [
      { v: num(b.views), l: 'Views' }, { v: num(b.visitors), l: 'Visitors' },
      { v: dur(b.avgSeconds), l: 'Avg time' }, { v: dur(b.avgEngaged), l: 'Avg engaged' },
    ];
    panel.innerHTML = '<div class="ppage"><div class="ph"><h3>' + esc(b.path) + '</h3><button class="close" id="pgclose">Close ✕</button></div>' +
      '<div class="pgstats">' + st.map(function (s) { return '<div class="s"><div class="v">' + s.v + '</div><div class="l">' + esc(s.l) + '</div></div>'; }).join('') + '</div>' +
      '<div class="pgcols">' +
        '<div><h3 style="' + H3 + '">Scroll depth reached</h3><div class="bars" id="pgScroll"></div></div>' +
        '<div><h3 style="' + H3 + '">Events on this page</h3><div class="bars" id="pgEvents"></div></div>' +
        '<div><h3 style="' + H3 + '">Referrers</h3><div class="bars" id="pgRefs"></div></div>' +
        '<div><h3 style="' + H3 + '">Countries</h3><div class="bars" id="pgCountries"></div></div>' +
      '</div></div>';
    bars('pgScroll', (b.scroll || []).map(function (s) { return { key: 'Scrolled ' + s.depth + '%', count: s.count }; }), function (k) { return k; });
    bars('pgEvents', b.topEvents, evLabel);
    bars('pgRefs', b.topReferrers, function (k) { return k === 'direct' ? 'Direct / none' : k; });
    bars('pgCountries', b.topCountries, function (k) { return k; });
    $('pgclose').onclick = function () { panel.innerHTML = ''; };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
