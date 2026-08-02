/* Book Growth Command Centre
   Server-backed daily growth tasks, proof, verification and analytics. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var state = { days: 30, command: null, activeProofTask: null, wired: false };

  var BOOKS = [
    { name: 'AI for Business Leaders', path: '/paths/ai-for-business', keyword: 'AI for business leaders' },
    { name: 'The SIV Method', path: '/paths/decisions', keyword: 'decision making framework for leaders' },
    { name: 'The Execution Doctrine', path: '/paths/execute', keyword: 'business execution system' },
    { name: 'Organizational Frequency', path: '/paths/hire', keyword: 'organizational alignment and hiring' },
    { name: 'The Signal', path: '/paths/evolve', keyword: 'AI and human evolution' },
    { name: 'Civilization', path: '/paths/civilization', keyword: 'future of civilization and AI' }
  ];

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function toast(message) {
    var el = $('toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  function num(value) { return (Number(value) || 0).toLocaleString('en-IN'); }
  function pct(value) { return Math.max(0, Math.min(100, Math.round(Number(value) || 0))) + '%'; }

  function todayKey(offset) {
    var d = new Date(Date.now() + (offset || 0) * 86400000);
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(d);
    } catch (e) {
      return d.toISOString().slice(0, 10);
    }
  }

  function dateLabel(key) {
    var d = new Date(key + 'T12:00:00+05:30');
    return isNaN(d) ? key : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  async function api(path, options) {
    var init = Object.assign({}, options || {});
    init.headers = Object.assign({ Accept: 'application/json' }, init.headers || {});
    if (init.body && !init.headers['Content-Type']) init.headers['Content-Type'] = 'application/json';
    var res = await fetch(path, init);
    var body = {};
    try { body = await res.json(); } catch (e) {}
    return { ok: res.ok && body.ok !== false, status: res.status, data: body };
  }

  async function loadCommand() {
    var result = await api('/api/growth/command?days=' + state.days);
    if (result.status === 401 || result.status === 503) {
      showLogin();
      return false;
    }
    if (!result.ok) {
      throw new Error(result.data.detail || result.data.error || 'Book Growth could not load.');
    }
    state.command = result.data;
    $('main').hidden = false;
    $('login').hidden = true;
    wireControls();
    renderAll();
    return true;
  }

  async function boot() {
    try { await loadCommand(); }
    catch (error) {
      $('main').hidden = false;
      wireControls();
      showNote('<strong>The command centre could not load its server data.</strong> ' + esc(error.message), true);
    }
  }

  function showLogin() {
    $('main').hidden = true;
    $('login').hidden = false;
    $('loginBtn').onclick = async function () {
      var res = await api('/api/studio/login', {
        method: 'POST', body: JSON.stringify({ password: $('pw').value })
      });
      if (res.ok) {
        $('loginErr').hidden = true;
        await loadCommand();
      } else {
        $('loginErr').hidden = false;
      }
    };
    $('pw').onkeydown = function (event) {
      if (event.key === 'Enter') $('loginBtn').click();
    };
  }

  function wireControls() {
    if (state.wired) return;
    state.wired = true;

    Array.prototype.forEach.call(document.querySelectorAll('#range button'), function (button) {
      button.onclick = async function () {
        state.days = Number(button.getAttribute('data-days')) || 30;
        Array.prototype.forEach.call(document.querySelectorAll('#range button'), function (b) {
          b.classList.toggle('on', b === button);
        });
        try { await loadCommand(); }
        catch (error) { toast(error.message); }
      };
    });

    $('regenerate').onclick = async function () {
      $('regenerate').disabled = true;
      try {
        var result = await api('/api/growth/tasks/regenerate', {
          method: 'POST', body: JSON.stringify({ days: state.days })
        });
        if (!result.ok) throw new Error(result.data.detail || 'Today’s plan could not be regenerated.');
        await loadCommand();
        toast('Today’s plan was regenerated from the latest evidence.');
      } catch (error) {
        toast(error.message);
      } finally {
        $('regenerate').disabled = false;
      }
    };

    $('exportHistory').onclick = exportHistory;
    $('proofForm').addEventListener('submit', function (event) {
      event.preventDefault();
      saveProof();
    });
  }

  function emptySummary() {
    return {
      range: { days: state.days, since: '', until: '' },
      traffic: { views: 0, visitors: 0, sessions: 0, avgSeconds: 0, bounceRate: 0, topPages: [], topReferrers: [], devices: [] },
      events: { total: 0, topClicks: [] },
      acquisition: { topSources: [] },
      audience: { browsers: [] },
      engagement: { leads: 0, recentLeads: [], conversations: 0 },
      behavior: { avgEngaged: 0 },
      people: { known: 0 }
    };
  }

  function summaryParts() {
    var d = state.command && state.command.summary || emptySummary();
    return {
      traffic: d.traffic || emptySummary().traffic,
      events: d.events || emptySummary().events,
      acquisition: d.acquisition || emptySummary().acquisition,
      audience: d.audience || emptySummary().audience,
      engagement: d.engagement || emptySummary().engagement,
      behavior: d.behavior || emptySummary().behavior,
      people: d.people || emptySummary().people,
      range: d.range || { days: state.days, since: '', until: '' }
    };
  }

  function showNote(message, alert) {
    $('note').innerHTML = '<div class="growth-note' + (alert ? ' alert' : '') + '">' + message + '</div>';
  }

  function pathCount(path) {
    var top = summaryParts().traffic.topPages || [];
    var hit = top.find(function (item) { return String(item.key || '').replace(/\/$/, '') === path; });
    return hit ? Number(hit.count) || 0 : 0;
  }

  function bookSignals() {
    var parts = summaryParts();
    var pages = BOOKS.map(function (book) {
      return { name: book.name, path: book.path, keyword: book.keyword, count: pathCount(book.path) };
    }).sort(function (a, b) { return b.count - a.count; });
    var bookViews = pages.reduce(function (sum, item) { return sum + item.count; }, 0);
    var clicks = parts.events.topClicks || [];
    var buyClicks = clicks.filter(function (item) {
      return /amazon|buy|order|kindle|paperback|book/i.test(String(item.key || ''));
    }).reduce(function (sum, item) { return sum + (Number(item.count) || 0); }, 0);
    var sourceSessions = (parts.acquisition.topSources || []).filter(function (item) {
      return String(item.key || '').toLowerCase() !== 'direct';
    }).reduce(function (sum, item) { return sum + (Number(item.count) || 0); }, 0);
    return { pages: pages, bookViews: bookViews, buyClicks: buyClicks, qualifiedSessions: sourceSessions, priority: pages[0] || BOOKS[0] };
  }

  function todayTasks() { return state.command && state.command.tasks || []; }
  function taskHistory() { return state.command && state.command.history || []; }
  function findTask(id) {
    return todayTasks().concat(taskHistory()).find(function (task) { return task.id === id; });
  }

  function statusLabel(status) {
    return ({ assigned: 'Assigned', started: 'Started', proof_submitted: 'Proof submitted', verified: 'Verified' })[status] || 'Assigned';
  }

  function renderAll() {
    var parts = summaryParts();
    var range = parts.range;
    $('rangeSub').textContent = (range.since && range.until ? range.since + ' → ' + range.until + ' · ' : '') + (range.days || state.days) + ' days';

    var sc = state.command && state.command.searchConsole || {};
    if (state.command && state.command.summary && state.command.summary.partial) {
      showNote('<strong>High-volume range:</strong> totals use the analytics event cap and may be understated.', true);
    } else if (sc.configured && !sc.connected) {
      showNote('<strong>Search Console is configured but not connected.</strong> ' + esc(sc.error || 'Check service-account access to the property.'), true);
    } else if (!parts.traffic.views) {
      showNote('<strong>No traffic recorded in this period.</strong> Daily SEO work will continue, but prioritisation will improve as visits accumulate.', false);
    } else {
      $('note').innerHTML = '';
    }

    renderTasks();
    renderScoreboard();
    renderOpportunities();
    renderSeo();
    renderFunnel();
    renderGoodspace();
    renderHistory();
    renderTechnical();
    renderIntegrations();
  }

  function taskMessage(task) {
    var lines = [
      'TODAY’S BOOK GROWTH TASK — ' + task.ownerName.toUpperCase(),
      '', task.title, '', 'Why it matters: ' + task.why, '', 'Instructions:'
    ];
    (task.instructions || []).forEach(function (step, index) { lines.push((index + 1) + '. ' + step); });
    lines.push('', 'Expected time: ' + task.expectedMinutes + ' minutes', 'Due: ' + task.due + ' IST', 'Proof required: ' + task.proofRequirement);
    return lines.join('\n');
  }

  function renderTasks() {
    var tasks = todayTasks();
    $('todayDone').textContent = tasks.filter(function (task) { return task.status === 'verified'; }).length + ' of ' + tasks.length;
    $('todayTasks').innerHTML = tasks.length ? tasks.map(function (task) {
      var proof = task.proofUrl || task.proofNote ? '<div class="task-proof"><strong>Proof submitted:</strong> ' +
        (task.proofUrl ? '<a href="' + esc(task.proofUrl) + '" target="_blank" rel="noopener">Open link ↗</a> ' : '') +
        (task.proofNote ? esc(task.proofNote) : '') + '</div>' : '';
      var primary = '';
      if (task.status === 'assigned') primary = '<button class="growth-button red" data-action="start" data-id="' + esc(task.id) + '">Start task</button>';
      if (task.status === 'started') primary = '<button class="growth-button red" data-action="proof" data-id="' + esc(task.id) + '">Submit proof</button>';
      if (task.status === 'proof_submitted') primary = '<button class="growth-button success" data-action="verify" data-id="' + esc(task.id) + '">Verify completion</button>';
      if (task.status === 'verified') primary = '<button class="growth-button success" disabled>Completed ✓</button>';
      return '<article class="task-card ' + esc(task.owner) + '">' +
        '<div class="task-top"><div class="task-owner"><div class="task-avatar">' + (task.owner === 'vinay' ? 'VP' : 'VS') + '</div><div><span>Today’s task</span><strong>' + esc(task.ownerName) + '</strong></div></div>' +
        '<span class="task-status ' + esc(task.status) + '">' + esc(statusLabel(task.status)) + '</span></div>' +
        '<div class="task-body"><div class="task-category">' + esc(task.category) + '</div><h3>' + esc(task.title) + '</h3><p class="task-why">' + esc(task.why) + '</p>' +
        '<ol class="task-instructions">' + (task.instructions || []).map(function (step) { return '<li>' + esc(step) + '</li>'; }).join('') + '</ol>' +
        '<div class="task-meta"><span>' + esc(task.expectedMinutes) + ' min</span><span>Due ' + esc(task.due) + ' IST</span><span>' + esc(task.source === 'search_console' ? 'Search Console evidence' : 'Website evidence') + '</span></div>' + proof + '</div>' +
        '<div class="task-actions">' + primary + '<button class="growth-button quiet" data-action="notify" data-id="' + esc(task.id) + '">Send reminder</button><button class="growth-button quiet copy-task" title="Copy task" data-action="copy" data-id="' + esc(task.id) + '">⧉</button></div></article>';
    }).join('') : '<div class="empty-state">No tasks were generated for today.</div>';

    Array.prototype.forEach.call(document.querySelectorAll('[data-action]'), function (button) {
      button.onclick = function () { handleTaskAction(button.getAttribute('data-action'), button.getAttribute('data-id'), button); };
    });
  }

  async function patchTask(id, body) {
    var result = await api('/api/growth/tasks/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(body) });
    if (!result.ok) throw new Error(result.data.detail || 'The task could not be updated.');
    await loadCommand();
  }

  async function handleTaskAction(action, id, button) {
    var task = findTask(id);
    if (!task) return;
    if (action === 'proof') {
      openProof(task);
      return;
    }
    if (action === 'copy') {
      copyText(taskMessage(task));
      return;
    }
    button.disabled = true;
    try {
      if (action === 'start') {
        await patchTask(id, { status: 'started' });
        toast(task.ownerName + ' task marked as started.');
      } else if (action === 'verify') {
        await patchTask(id, { status: 'verified' });
        toast('Completion verified.');
      } else if (action === 'notify') {
        var result = await api('/api/growth/tasks/' + encodeURIComponent(id) + '/notify', {
          method: 'POST', body: JSON.stringify({ mode: task.status === 'assigned' ? 'assign' : 'followup' })
        });
        if (!result.ok) throw new Error(result.data.detail || 'The reminder could not be sent.');
        var delivery = result.data.delivery || {};
        if (!delivery.sent) throw new Error('Email and Slack delivery are not configured yet.');
        await loadCommand();
        toast('Reminder sent.');
      }
    } catch (error) {
      toast(error.message);
    } finally {
      button.disabled = false;
    }
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast('Task copied.'); }).catch(function () { fallbackCopy(text); });
    } else fallbackCopy(text);
  }

  function fallbackCopy(text) {
    var area = document.createElement('textarea');
    area.value = text; area.style.position = 'fixed'; area.style.opacity = '0';
    document.body.appendChild(area); area.select();
    try { document.execCommand('copy'); toast('Task copied.'); } catch (e) { toast('Could not copy automatically.'); }
    area.remove();
  }

  function openProof(task) {
    state.activeProofTask = task.id;
    $('proofTitle').textContent = 'Submit proof · ' + task.ownerName;
    $('proofPrompt').textContent = task.proofRequirement;
    $('proofUrl').value = task.proofUrl || '';
    $('proofNote').value = task.proofNote || '';
    $('proofDialog').showModal();
  }

  async function saveProof() {
    var task = findTask(state.activeProofTask);
    if (!task) return;
    var url = $('proofUrl').value.trim();
    var note = $('proofNote').value.trim();
    if (!url && !note) {
      toast('Add a link or completion note as proof.');
      return;
    }
    $('saveProof').disabled = true;
    try {
      await patchTask(task.id, { status: 'proof_submitted', proofUrl: url, proofNote: note });
      $('proofDialog').close();
      state.activeProofTask = null;
      toast('Proof submitted for verification.');
    } catch (error) {
      toast(error.message);
    } finally {
      $('saveProof').disabled = false;
    }
  }

  function isOverdue(task) {
    if (task.status === 'verified') return false;
    var due = new Date(task.date + 'T' + (task.due || '18:00') + ':00+05:30');
    return Date.now() > due.getTime();
  }

  function renderScoreboard() {
    var tasks = taskHistory();
    var sevenDays = [];
    for (var i = 0; i < 7; i++) sevenDays.push(todayKey(-i));
    var recent = tasks.filter(function (task) { return sevenDays.indexOf(task.date) !== -1; });
    var verified = recent.filter(function (task) { return task.status === 'verified'; }).length;
    var vinay = tasks.filter(function (task) { return task.owner === 'vinay'; });
    var vaishnav = tasks.filter(function (task) { return task.owner === 'vaishnav'; });
    $('weekCompletion').textContent = pct(recent.length ? verified / recent.length * 100 : 0);
    $('vinayScore').textContent = vinay.filter(function (task) { return task.status === 'verified'; }).length + ' / ' + vinay.length;
    $('vaishnavScore').textContent = vaishnav.filter(function (task) { return task.status === 'verified'; }).length + ' / ' + vaishnav.length;
    $('overdue').textContent = tasks.filter(isOverdue).length;

    var streak = 0;
    for (var d = 0; d < 365; d++) {
      var key = todayKey(-d);
      var dayTasks = tasks.filter(function (task) { return task.date === key; });
      if (!dayTasks.length) {
        if (d === 0) continue;
        break;
      }
      if (dayTasks.some(function (task) { return task.status === 'verified'; })) streak++;
      else break;
    }
    $('streak').textContent = streak + (streak === 1 ? ' day' : ' days');
  }

  function renderOpportunities() {
    var parts = summaryParts();
    var signals = bookSignals();
    var sessions = Number(parts.traffic.sessions) || 0;
    var bookRate = sessions ? Math.round(signals.bookViews / sessions * 100) : 0;
    var sc = state.command && state.command.searchConsole || {};
    var opp = sc.opportunity;
    var opportunities = [];
    if (opp) {
      opportunities.push({
        title: 'Improve the search opportunity: “' + opp.query + '”',
        reason: num(opp.impressions) + ' impressions · position ' + Number(opp.position).toFixed(1) + ' · ' + (Number(opp.ctr) * 100).toFixed(1) + '% click-through.',
        score: Math.min(99, 82 + Math.round(Math.log10(Math.max(1, opp.impressions)) * 5))
      });
    }
    opportunities = opportunities.concat([
      {
        title: 'Build qualified search entry points for the books',
        reason: signals.bookViews ? num(signals.bookViews) + ' tracked book-page views exist, but durable growth requires more search-led discovery.' : 'Book pages are not yet receiving enough measurable traffic to optimise a sales funnel.',
        score: sessions < state.days ? 94 : 86
      },
      {
        title: signals.buyClicks ? 'Learn which purchase actions are working' : 'Make buying intent measurable',
        reason: signals.buyClicks ? num(signals.buyClicks) + ' buy-intent clicks are visible; separate them by book and retailer before increasing promotion.' : 'No buy-intent clicks are visible in the current top tracked actions. Purchase links need consistent labels and placement.',
        score: signals.buyClicks ? 82 : 91
      },
      {
        title: 'Increase the share of visitors reaching a book page',
        reason: 'Observed book-page reach is approximately ' + bookRate + '% of sessions using the pages visible in the summary.',
        score: bookRate < 20 ? 88 : 74
      },
      {
        title: sc.connected ? 'Use Search Console evidence every day' : 'Connect Search Console before spending on advertising',
        reason: sc.connected ? 'The daily plan can now use real queries, impressions, rankings and click-through rates.' : 'Real search queries and positions are required to choose content and paid keywords intelligently.',
        score: sc.connected ? 78 : 80
      }
    ]).sort(function (a, b) { return b.score - a.score; }).slice(0, 5);

    $('opportunities').innerHTML = opportunities.map(function (item, index) {
      return '<article class="opportunity"><div class="opportunity-rank">0' + (index + 1) + '</div><div><h3>' + esc(item.title) + '</h3><p>' + esc(item.reason) + '</p></div><div class="opportunity-score"><strong>' + item.score + '</strong><span>priority score</span></div></article>';
    }).join('');
  }

  function bookFromPage(page) {
    var path = String(page || '').replace(/^https?:\/\/[^/]+/i, '').split('?')[0].replace(/\/$/, '');
    return BOOKS.find(function (book) { return path === book.path || path.indexOf(book.path + '/') === 0; });
  }

  function renderSeo() {
    var signals = bookSignals();
    var sc = state.command && state.command.searchConsole || {};
    var opp = sc.opportunity;
    var priorityBook = opp && bookFromPage(opp.page) || signals.priority || BOOKS[0];
    $('priorityBookPage').textContent = priorityBook.name;
    $('priorityBookReason').textContent = opp
      ? 'Search opportunity: “' + opp.query + '” · ' + num(opp.impressions) + ' impressions · position ' + Number(opp.position).toFixed(1) + '.'
      : priorityBook.count ? 'Highest observed book-page traffic in this period: ' + num(priorityBook.count) + ' views.' : 'Selected for today’s content-and-SEO work while traffic evidence is limited.';
    $('bookViews').textContent = num(signals.bookViews);
    $('buyClicks').textContent = num(signals.buyClicks);
    $('qualifiedSessions').textContent = num(signals.qualifiedSessions);

    var status = $('searchConsoleStatus');
    status.className = 'integration-pill ' + (sc.connected ? 'connected' : 'pending');
    status.textContent = sc.connected ? 'Search Console connected' : sc.configured ? 'Search Console needs attention' : 'Search Console not connected';

    if (sc.connected && sc.rows && sc.rows.length) {
      $('bookPages').innerHTML = sc.rows.slice(0, 10).map(function (row) {
        return '<div class="rank-row"><span class="label" title="' + esc(row.page) + '">' + esc(row.query) + '</span><span class="value">' + num(row.impressions) + ' imp · #' + Number(row.position).toFixed(1) + '</span></div>';
      }).join('');
    } else {
      var visible = signals.pages.filter(function (item) { return item.count > 0; });
      $('bookPages').innerHTML = (visible.length ? visible : signals.pages.slice(0, 6)).map(function (item) {
        return '<div class="rank-row"><span class="label" title="' + esc(item.path) + '">' + esc(item.name) + '</span><span class="value">' + num(item.count) + ' views</span></div>';
      }).join('');
    }

    var actions = [
      { title: sc.connected ? 'Work the highest-opportunity query' : 'Connect Google Search Console', copy: sc.connected && opp ? 'Today’s strongest observed query is “' + opp.query + '”.' : 'Unlock actual queries, impressions, positions and click-through opportunities.' },
      { title: 'Optimise one book page per day', copy: 'Title, description, answer section, internal links, schema and purchase action.' },
      { title: 'Publish one original answer per day', copy: 'Vinay creates the insight; Vaishnav packages it into a searchable and measurable page.' },
      { title: 'Track every purchase action consistently', copy: 'Use book name, retailer and button position in each event label.' }
    ];
    $('seoActions').innerHTML = actions.map(function (item, index) {
      return '<div class="action-item"><span class="marker">' + (index + 1) + '</span><div><strong>' + esc(item.title) + '</strong><p>' + esc(item.copy) + '</p></div></div>';
    }).join('');
  }

  function renderFunnel() {
    var parts = summaryParts();
    var signals = bookSignals();
    var steps = [
      { label: 'Discovered', value: Number(parts.traffic.visitors) || 0, copy: 'Unique browser profiles observed.' },
      { label: 'Visited', value: Number(parts.traffic.sessions) || 0, copy: 'Tracked website sessions.' },
      { label: 'Viewed a book', value: signals.bookViews, copy: 'Views across known book pages visible in the summary.' },
      { label: 'Clicked to buy', value: signals.buyClicks, copy: 'Tracked actions suggesting purchase intent.' },
      { label: 'Purchased', value: 'Not connected', copy: 'Requires Amazon or website order confirmation.', unavailable: true }
    ];
    $('bookFunnel').innerHTML = steps.map(function (step, index) {
      return '<article class="funnel-step' + (step.unavailable ? ' unavailable' : '') + '"><span>0' + (index + 1) + ' · ' + esc(step.label) + '</span><strong>' + (typeof step.value === 'number' ? num(step.value) : esc(step.value)) + '</strong><p>' + esc(step.copy) + '</p></article>';
    }).join('');
  }

  function renderGoodspace() {
    var parts = summaryParts();
    var pages = parts.traffic.topPages || [];
    var gsViews = pages.filter(function (item) {
      return /goodspace|recruit|hire|hiring|talent/i.test(String(item.key || ''));
    }).reduce(function (sum, item) { return sum + (Number(item.count) || 0); }, 0);
    var leads = parts.engagement.recentLeads || [];
    var highIntent = leads.filter(function (lead) {
      return /goodspace|recruit|hire|talent|employer|business/i.test([lead.source, lead.name, lead.email].join(' '));
    });
    $('goodspaceViews').textContent = num(gsViews);
    $('leadCount').textContent = num(parts.engagement.leads || 0);
    $('followups').textContent = num(highIntent.length);
    $('recentLeads').innerHTML = highIntent.length ? highIntent.slice(0, 6).map(function (lead) {
      return '<div class="lead-row"><div><strong>' + esc(lead.name || lead.email || 'Unnamed lead') + '</strong><span>' + esc(lead.email || '') + '</span></div><em>' + esc(lead.source || 'unknown source') + '</em></div>';
    }).join('') : '<div class="empty-state">No clearly qualified recruitment enquiry is visible in the current lead summary.</div>';
  }

  function renderHistory() {
    var tasks = taskHistory();
    $('taskHistory').innerHTML = tasks.length ? tasks.slice(0, 60).map(function (task) {
      return '<div class="history-row"><span class="date">' + esc(dateLabel(task.date)) + '</span><span class="owner">' + esc(task.ownerName) + '</span><span class="title">' + esc(task.title) + '</span><span class="status ' + esc(task.status) + '">' + esc(statusLabel(task.status)) + '</span></div>';
    }).join('') : '<div class="empty-state">Task history will appear after the first daily plan is created.</div>';
  }

  function rankRows(items, formatter) {
    items = items || [];
    return items.length ? items.map(function (item) {
      return '<div class="rank-row"><span class="label">' + esc(formatter ? formatter(item.key) : item.key) + '</span><span class="value">' + num(item.count) + '</span></div>';
    }).join('') : '<div class="empty-state">No data yet.</div>';
  }

  function renderTechnical() {
    var parts = summaryParts();
    var metrics = [
      ['Page views', parts.traffic.views], ['Visitors', parts.traffic.visitors], ['Sessions', parts.traffic.sessions],
      ['Single-page rate', (parts.traffic.bounceRate || 0) + '%'], ['Tracked events', parts.events.total], ['Known people', parts.people.known]
    ];
    $('technicalKpis').innerHTML = metrics.map(function (metric) {
      return '<div class="score-card"><span>' + esc(metric[0]) + '</span><strong>' + (typeof metric[1] === 'number' ? num(metric[1]) : esc(metric[1])) + '</strong><small>Selected analytics range</small></div>';
    }).join('');
    $('technicalPages').innerHTML = rankRows(parts.traffic.topPages || []);
    $('technicalRefs').innerHTML = rankRows(parts.traffic.topReferrers || [], function (key) { return key === 'direct' ? 'Direct / none' : key; });
    $('technicalDevices').innerHTML = rankRows(parts.traffic.devices || []);
    $('technicalBrowsers').innerHTML = rankRows(parts.audience.browsers || []);
  }

  function renderIntegrations() {
    var integrations = state.command && state.command.integrations || {};
    var cards = document.querySelectorAll('.integration-grid article');
    var values = [integrations.searchConsole, integrations.email, integrations.slack, integrations.amazon];
    Array.prototype.forEach.call(cards, function (card, index) {
      var dot = card.querySelector('.status-dot');
      if (dot) dot.className = 'status-dot ' + (values[index] ? 'connected' : 'pending');
      if (values[index]) {
        var strong = card.querySelector('strong');
        if (strong && strong.textContent.indexOf('Connected') === -1) strong.textContent += ' · Connected';
      }
    });
  }

  function exportHistory() {
    var rows = [['Date', 'Owner', 'Status', 'Task', 'Proof URL', 'Proof note', 'Verified at', 'Evidence source']];
    taskHistory().forEach(function (task) {
      rows.push([task.date, task.ownerName, statusLabel(task.status), task.title, task.proofUrl || '', task.proofNote || '', task.verifiedAt || '', task.source || '']);
    });
    var csv = rows.map(function (row) {
      return row.map(function (cell) { return '"' + String(cell == null ? '' : cell).replace(/"/g, '""') + '"'; }).join(',');
    }).join('\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url; link.download = 'book-growth-task-history-' + todayKey() + '.csv';
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast('Task history exported.');
  }

  boot();
}());
