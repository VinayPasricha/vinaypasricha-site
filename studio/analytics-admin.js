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
      { v: num(eng.conversations), l: 'AI conversations' },
      { v: num(eng.leads), l: 'Leads captured' },
      { v: num(fun.total) + (fun.avgRating ? '' : ''), l: 'ABL participants', s: fun.avgRating ? ('avg ' + fun.avgRating + '★') : '' },
    ];
    $('kpis').innerHTML = kpis.map(function (k) {
      return '<div class="stat' + (k.hot ? ' hot' : '') + '"><div class="stat-v">' + k.v + '</div><div class="stat-l">' + esc(k.l) + '</div>' + (k.s ? '<div class="stat-s">' + esc(k.s) + '</div>' : '') + '</div>';
    }).join('');

    renderChart(t.timeseries || []);
    bars('topPages', t.topPages, function (k) { return k; });
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

  // Horizontal bar list from [{key, count}].
  function bars(id, items, fmt) {
    items = items || [];
    var el = $(id);
    if (!items.length) { el.innerHTML = '<div class="muted">No data yet.</div>'; return; }
    var max = items.reduce(function (m, x) { return Math.max(m, x.count || 0); }, 0) || 1;
    el.innerHTML = items.map(function (x) {
      var pct = Math.max(2, Math.round((x.count || 0) / max * 100));
      var label = fmt ? fmt(x.key) : x.key;
      return '<div class="bar"><div class="lbl"><span class="fill" style="width:' + pct + '%"></span><span>' + esc(label) + '</span></div><div class="val">' + num(x.count) + '</div></div>';
    }).join('');
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

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
