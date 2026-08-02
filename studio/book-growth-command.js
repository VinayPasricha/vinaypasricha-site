/* Book Growth Command Centre
   Turns first-party analytics into one daily task for Vinay and one for Vaishnav.
   Task state and proof are retained in this browser until the server-side growth
   task store and notification delivery are connected. */
(function () {
  'use strict';

  var STORE_KEY = 'vp_book_growth_command_v1';
  var $ = function (id) { return document.getElementById(id); };
  var state = { days: 30, summary: null, store: loadStore(), activeProofTask: null };

  var BOOKS = [
    { name: 'AI for Business Leaders', path: '/paths/ai-for-business', keyword: 'AI for business leaders' },
    { name: 'The SIV Method', path: '/paths/decisions', keyword: 'decision making framework for leaders' },
    { name: 'The Execution Doctrine', path: '/paths/execute', keyword: 'business execution system' },
    { name: 'Organizational Frequency', path: '/paths/hire', keyword: 'organizational alignment and hiring' },
    { name: 'The Signal', path: '/paths/evolve', keyword: 'AI and human evolution' },
    { name: 'Civilization', path: '/paths/civilization', keyword: 'future of civilization and AI' }
  ];

  function loadStore() {
    try {
      var parsed = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      return {
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
        settings: parsed.settings || {},
        version: 1
      };
    } catch (e) {
      return { tasks: [], settings: {}, version: 1 };
    }
  }

  function saveStore() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state.store)); } catch (e) {}
  }

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

  function dayIndex() {
    var start = new Date(new Date().getFullYear(), 0, 0);
    return Math.floor((Date.now() - start.getTime()) / 86400000);
  }

  function api(path, options) {
    return fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, options || {}))
      .then(async function (res) {
        var body = {};
        try { body = await res.json(); } catch (e) {}
        return { ok: res.ok && body.ok !== false, status: res.status, data: body };
      });
  }

  async function boot() {
    var result = await api('/api/analytics/summary?days=' + state.days);
    if (result.status === 401 || result.status === 503) {
      showLogin();
      return;
    }
    $('main').hidden = false;
    wireControls();
    if (!result.ok) {
      showNote('The command centre loaded, but live analytics could not be read. Today’s tasks will use the fallback growth plan.', true);
      state.summary = emptySummary();
    } else {
      state.summary = result.data;
    }
    ensureTodayTasks();
    renderAll();
  }

  function showLogin() {
    $('login').hidden = false;
    $('loginBtn').onclick = async function () {
      var res = await api('/api/studio/login', {
        method: 'POST', body: JSON.stringify({ password: $('pw').value })
      });
      if (res.ok) {
        $('login').hidden = true;
        boot();
      } else {
        $('loginErr').hidden = false;
      }
    };
    $('pw').onkeydown = function (event) {
      if (event.key === 'Enter') $('loginBtn').click();
    };
  }

  function wireControls() {
    if (wireControls.done) return;
    wireControls.done = true;

    Array.prototype.forEach.call(document.querySelectorAll('#range button'), function (button) {
      button.onclick = async function () {
        state.days = Number(button.getAttribute('data-days')) || 30;
        Array.prototype.forEach.call(document.querySelectorAll('#range button'), function (b) {
          b.classList.toggle('on', b === button);
        });
        var result = await api('/api/analytics/summary?days=' + state.days);
        if (result.ok) {
          state.summary = result.data;
          renderAll();
        } else {
          toast('Live analytics could not be refreshed.');
        }
      };
    });

    $('regenerate').onclick = function () {
      var today = todayKey();
      state.store.tasks = state.store.tasks.filter(function (task) { return task.date !== today; });
      ensureTodayTasks(true);
      renderAll();
      toast('Today’s plan was regenerated from the latest signals.');
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

  function showNote(message, alert) {
    $('note').innerHTML = '<div class="growth-note' + (alert ? ' alert' : '') + '">' + message + '</div>';
  }

  function summaryParts() {
    var d = state.summary || emptySummary();
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
      var key = String(item.key || '').toLowerCase();
      return /amazon|buy|order|kindle|paperback|book/.test(key);
    }).reduce(function (sum, item) { return sum + (Number(item.count) || 0); }, 0);
    var sourceSessions = (parts.acquisition.topSources || []).filter(function (item) {
      return String(item.key || '').toLowerCase() !== 'direct';
    }).reduce(function (sum, item) { return sum + (Number(item.count) || 0); }, 0);
    var priority = pages[0] && pages[0].count ? pages[0] : BOOKS[dayIndex() % BOOKS.length];
    return {
      pages: pages,
      bookViews: bookViews,
      buyClicks: buyClicks,
      qualifiedSessions: sourceSessions,
      priority: priority
    };
  }

  function ensureTodayTasks(force) {
    var today = todayKey();
    var existing = state.store.tasks.filter(function (task) { return task.date === today; });
    if (!force && existing.length >= 2) return;
    var signals = bookSignals();
    var tasks = buildDailyTasks(signals);
    state.store.tasks = state.store.tasks.filter(function (task) { return task.date !== today; }).concat(tasks);
    saveStore();
  }

  function buildDailyTasks(signals) {
    var today = todayKey();
    var book = signals.priority || BOOKS[0];
    var index = dayIndex() % 7;
    var trafficLow = summaryParts().traffic.sessions < Math.max(10, state.days);
    var conversionWeak = signals.bookViews > 0 && signals.buyClicks === 0;

    var vinayVariants = [
      {
        category: 'SEO content · reader question',
        title: 'Record a 60-second answer that earns the right reader',
        why: 'The site needs a steady stream of useful, searchable answers that lead naturally to ' + book.name + '.',
        instructions: [
          'Open with: “Most leaders make one mistake when they think about ' + book.keyword + '.”',
          'Explain one counter-intuitive idea from the book in two clear points.',
          'Close with one practical question the viewer can use today.',
          'Post the video on LinkedIn and YouTube Shorts, and link to ' + book.path + '.',
          'Send the published links as proof.'
        ],
        proof: 'Links to the published LinkedIn and YouTube posts.'
      },
      {
        category: 'SEO authority · original insight',
        title: 'Write one definitive answer for a high-intent search',
        why: 'Search visibility compounds when the website contains your own clear answer—not generic AI summaries.',
        instructions: [
          'Write 350–500 words answering: “What should a business leader do first with AI?”',
          'Use a specific business example and one principle from ' + book.name + '.',
          'Include a three-step action at the end.',
          'Give the draft to Vaishnav for publishing on the relevant book page.',
          'Submit the draft or document link as proof.'
        ],
        proof: 'A document link containing the completed 350–500 word answer.'
      },
      {
        category: 'Social discovery · book idea',
        title: 'Publish one idea people will want to save',
        why: 'Saved and shared ideas create qualified discovery before paid promotion is introduced.',
        instructions: [
          'Choose one sentence from ' + book.name + ' that challenges conventional wisdom.',
          'Turn it into a five-slide carousel: claim, problem, example, implication, action.',
          'Use plain business language and no promotional opening.',
          'Final slide: “Read the full argument” with the website path ' + book.path + '.',
          'Submit the live post link as proof.'
        ],
        proof: 'The live carousel or post URL.'
      },
      {
        category: 'SEO content · founder evidence',
        title: 'Tell one real story that proves the book’s argument',
        why: 'First-hand experience is the strongest differentiator against generic content and improves trust with senior readers.',
        instructions: [
          'Choose one real leadership situation from GoodSpace, WLC or your earlier career.',
          'State the decision, what initially looked obvious and what was actually true.',
          'Connect the lesson to one idea in ' + book.name + '.',
          'Record a 90-second video or write 400 words.',
          'End with a link to ' + book.path + ' and submit the published URL.'
        ],
        proof: 'Published article or video URL.'
      },
      {
        category: 'Search demand · question mining',
        title: 'Answer five questions your ideal reader would type into Google',
        why: 'A question bank gives Vaishnav a pipeline of pages and gives you a repeatable content rhythm.',
        instructions: [
          'Write five exact questions a founder or CEO would search before buying ' + book.name + '.',
          'For each question, write a one-sentence answer in your own voice.',
          'Rank the questions by commercial intent: urgent problem first.',
          'Choose one question for tomorrow’s video.',
          'Submit the completed question bank as proof.'
        ],
        proof: 'A document or note containing five ranked questions and answers.'
      },
      {
        category: 'Book positioning · clarity',
        title: 'Create the strongest 30-second explanation of this book',
        why: 'A clear promise improves every channel: search snippets, social captions, Amazon copy and conversations.',
        instructions: [
          'Complete: “This book is for leaders who…”',
          'Complete: “It helps them move from… to…”',
          'Name one outcome the reader can expect within 30 days.',
          'Record the final explanation in under 30 seconds.',
          'Submit the video or transcript as proof.'
        ],
        proof: 'A video link or final transcript.'
      },
      {
        category: 'Audience learning · direct signal',
        title: 'Ask one question that reveals why readers are not buying',
        why: 'Before spending on ads, we need direct evidence about reader objections and desired outcomes.',
        instructions: [
          'Post a single-question LinkedIn poll related to ' + book.keyword + '.',
          'Use four answer options that represent different reader problems—not product features.',
          'Reply to the first five substantive comments personally.',
          'Link to the relevant book page only in the first comment.',
          'Submit the poll URL and a screenshot of early responses.'
        ],
        proof: 'Poll URL plus a screenshot or note summarising responses.'
      }
    ];

    var vaishnavVariants = [
      {
        category: 'Technical SEO · book page',
        title: 'Strengthen the priority book page for search',
        why: 'The page must clearly answer the search intent before additional promotion can convert into book interest.',
        instructions: [
          'Audit ' + book.path + ' for one primary phrase: “' + book.keyword + '”.',
          'Rewrite the title tag and meta description so the reader benefit is explicit.',
          'Add a 150–250 word answer section near the top using the phrase naturally.',
          'Add at least two internal links from relevant pages on the website.',
          'Check the rendered page on mobile and submit the page URL plus screenshots.'
        ],
        proof: 'Updated page URL and before/after screenshots.'
      },
      {
        category: 'Internal linking · discovery',
        title: 'Create three high-quality paths into the book page',
        why: 'Internal links help both readers and search engines understand which pages matter most.',
        instructions: [
          'Identify three existing pages closely related to ' + book.keyword + '.',
          'Add one contextual link from each page to ' + book.path + '.',
          'Use descriptive anchor text; do not use “click here”.',
          'Confirm every link works and is visible on mobile.',
          'Submit all four URLs as proof.'
        ],
        proof: 'Three source URLs and the destination book-page URL.'
      },
      {
        category: 'Conversion · buy action',
        title: 'Make the path from interest to purchase unmistakable',
        why: 'Book interest is only useful when the page makes the next step clear and trustworthy.',
        instructions: [
          'Review every buy or Amazon link on ' + book.path + '.',
          'Place one clear purchase action above the first major scroll break.',
          'Add a second purchase action after the strongest proof or book description.',
          'Apply a unique data-track label to each purchase button.',
          'Test every link in desktop and mobile view and submit screenshots.'
        ],
        proof: 'Page URL, screenshots and the tracking labels used.'
      },
      {
        category: 'Structured data · search appearance',
        title: 'Add or validate Book schema for the priority title',
        why: 'Clean structured data helps search engines interpret the page and reduces avoidable technical ambiguity.',
        instructions: [
          'Inspect the structured data on ' + book.path + '.',
          'Add or correct Book, Person and BreadcrumbList schema where relevant.',
          'Use the actual title, author, cover image, language and purchase URL.',
          'Run the page through Google’s Rich Results Test or Schema validator.',
          'Submit the validation link or screenshot and the updated page URL.'
        ],
        proof: 'Validation result plus updated page URL.'
      },
      {
        category: 'SEO hygiene · indexability',
        title: 'Verify that the priority page can actually rank',
        why: 'Content work is wasted when canonical, robots, sitemap or rendering problems prevent reliable indexing.',
        instructions: [
          'Check the canonical URL, robots meta tag and HTTP status for ' + book.path + '.',
          'Confirm the page appears in the XML sitemap.',
          'Check that the title, description and main heading are unique.',
          'Inspect mobile rendering and page-load errors.',
          'Record every issue found, fix the safe ones and submit proof.'
        ],
        proof: 'Audit checklist, fixed page URL and screenshots.'
      },
      {
        category: 'Content packaging · reuse',
        title: 'Turn Vinay’s completed idea into a search-ready page',
        why: 'The fastest growth loop is Vinay creating the insight and Vaishnav packaging it for discovery and conversion.',
        instructions: [
          'Take Vinay’s latest completed video, note or article.',
          'Publish a focused page with one search question as the H1.',
          'Add the video or original insight, a concise written answer and a link to ' + book.path + '.',
          'Add title, description, canonical and social sharing image metadata.',
          'Submit the live page URL and indexing request proof.'
        ],
        proof: 'Live page URL and indexing submission confirmation.'
      },
      {
        category: 'Measurement · reliable funnel',
        title: 'Make every book action measurable',
        why: 'We cannot improve the funnel until page interest, buy intent and confirmed sales are separated cleanly.',
        instructions: [
          'Inventory every book page and every purchase link.',
          'Add consistent data-track labels: book_view, buy_click and retailer name.',
          'Test one event from each book page and confirm it appears in analytics.',
          'Document which purchase outcomes are still unavailable without Amazon data.',
          'Submit the event map and test evidence.'
        ],
        proof: 'Event map plus screenshots showing successful test events.'
      }
    ];

    if (conversionWeak) index = 2;
    else if (trafficLow) index = index % 2;

    var vinay = vinayVariants[index];
    var vaishnav = vaishnavVariants[index];
    return [makeTask(today, 'vinay', vinay, 45, '18:00'), makeTask(today, 'vaishnav', vaishnav, 60, '18:00')];
  }

  function makeTask(date, owner, plan, minutes, due) {
    return {
      id: date + '-' + owner,
      date: date,
      owner: owner,
      ownerName: owner === 'vinay' ? 'Vinay' : 'Vaishnav',
      category: plan.category,
      title: plan.title,
      why: plan.why,
      instructions: plan.instructions,
      proofRequirement: plan.proof,
      expectedMinutes: minutes,
      due: due,
      status: 'assigned',
      createdAt: new Date().toISOString(),
      startedAt: '', proofAt: '', verifiedAt: '', proofUrl: '', proofNote: ''
    };
  }

  function renderAll() {
    var parts = summaryParts();
    var range = parts.range;
    $('rangeSub').textContent = (range.since && range.until ? range.since + ' → ' + range.until + ' · ' : '') + (range.days || state.days) + ' days';

    if (state.summary && state.summary.partial) {
      showNote('<strong>High-volume range:</strong> the analytics API is using its 20,000-event cap, so totals may be understated.', true);
    } else if (!parts.traffic.views) {
      showNote('<strong>No traffic recorded in this period.</strong> The command centre will still assign useful SEO work, but evidence-based prioritisation will improve as visits accumulate.', false);
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
  }

  function todayTasks() {
    var today = todayKey();
    return state.store.tasks.filter(function (task) { return task.date === today; })
      .sort(function (a, b) { return a.owner.localeCompare(b.owner); });
  }

  function statusLabel(status) {
    return ({ assigned: 'Assigned', started: 'Started', proof_submitted: 'Proof submitted', verified: 'Verified' })[status] || 'Assigned';
  }

  function taskMessage(task) {
    var lines = [
      'TODAY’S BOOK GROWTH TASK — ' + task.ownerName.toUpperCase(),
      '', task.title, '', 'Why it matters: ' + task.why, '', 'Instructions:'
    ];
    task.instructions.forEach(function (step, index) { lines.push((index + 1) + '. ' + step); });
    lines.push('', 'Expected time: ' + task.expectedMinutes + ' minutes', 'Due: ' + task.due + ' IST', 'Proof required: ' + task.proofRequirement);
    return lines.join('\n');
  }

  function renderTasks() {
    var tasks = todayTasks();
    $('todayDone').textContent = tasks.filter(function (t) { return t.status === 'verified'; }).length + ' of ' + tasks.length;
    $('todayTasks').innerHTML = tasks.map(function (task) {
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
        '<ol class="task-instructions">' + task.instructions.map(function (step) { return '<li>' + esc(step) + '</li>'; }).join('') + '</ol>' +
        '<div class="task-meta"><span>' + esc(task.expectedMinutes) + ' min</span><span>Due ' + esc(task.due) + ' IST</span><span>Proof required</span></div>' + proof + '</div>' +
        '<div class="task-actions">' + primary + '<button class="growth-button quiet copy-task" title="Copy task" data-action="copy" data-id="' + esc(task.id) + '">⧉</button></div></article>';
    }).join('');

    Array.prototype.forEach.call(document.querySelectorAll('[data-action]'), function (button) {
      button.onclick = function () { handleTaskAction(button.getAttribute('data-action'), button.getAttribute('data-id')); };
    });
  }

  function findTask(id) { return state.store.tasks.find(function (task) { return task.id === id; }); }

  function handleTaskAction(action, id) {
    var task = findTask(id);
    if (!task) return;
    if (action === 'start') {
      task.status = 'started'; task.startedAt = new Date().toISOString();
      saveStore(); renderAll(); toast(task.ownerName + ' task marked as started.');
    } else if (action === 'proof') {
      openProof(task);
    } else if (action === 'verify') {
      task.status = 'verified'; task.verifiedAt = new Date().toISOString();
      saveStore(); renderAll(); toast('Completion verified.');
    } else if (action === 'copy') {
      copyText(taskMessage(task));
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

  function saveProof() {
    var task = findTask(state.activeProofTask);
    if (!task) return;
    var url = $('proofUrl').value.trim();
    var note = $('proofNote').value.trim();
    if (!url && !note) {
      toast('Add a link or completion note as proof.');
      return;
    }
    task.proofUrl = url;
    task.proofNote = note;
    task.status = 'proof_submitted';
    task.proofAt = new Date().toISOString();
    saveStore();
    $('proofDialog').close();
    state.activeProofTask = null;
    renderAll();
    toast('Proof submitted for verification.');
  }

  function isOverdue(task) {
    if (task.status === 'verified') return false;
    var due = new Date(task.date + 'T' + (task.due || '18:00') + ':00+05:30');
    return Date.now() > due.getTime();
  }

  function renderScoreboard() {
    var tasks = state.store.tasks;
    var today = todayKey();
    var sevenDays = [];
    for (var i = 0; i < 7; i++) sevenDays.push(todayKey(-i));
    var recent = tasks.filter(function (t) { return sevenDays.indexOf(t.date) !== -1; });
    var verified = recent.filter(function (t) { return t.status === 'verified'; }).length;
    var vinay = tasks.filter(function (t) { return t.owner === 'vinay'; });
    var vaishnav = tasks.filter(function (t) { return t.owner === 'vaishnav'; });
    $('weekCompletion').textContent = pct(recent.length ? verified / recent.length * 100 : 0);
    $('vinayScore').textContent = vinay.filter(function (t) { return t.status === 'verified'; }).length + ' / ' + vinay.length;
    $('vaishnavScore').textContent = vaishnav.filter(function (t) { return t.status === 'verified'; }).length + ' / ' + vaishnav.length;
    $('overdue').textContent = tasks.filter(isOverdue).length;

    var streak = 0;
    for (var d = 0; d < 365; d++) {
      var key = todayKey(-d);
      var dayTasks = tasks.filter(function (t) { return t.date === key; });
      if (!dayTasks.length) {
        if (d === 0) continue;
        break;
      }
      if (dayTasks.some(function (t) { return t.status === 'verified'; })) streak++;
      else break;
    }
    $('streak').textContent = streak + (streak === 1 ? ' day' : ' days');
  }

  function renderOpportunities() {
    var parts = summaryParts();
    var signals = bookSignals();
    var sessions = Number(parts.traffic.sessions) || 0;
    var bookRate = sessions ? Math.round(signals.bookViews / sessions * 100) : 0;
    var opportunities = [
      {
        title: 'Build qualified search entry points for the books',
        reason: signals.bookViews ? num(signals.bookViews) + ' tracked book-page views exist, but durable growth requires more search-led discovery.' : 'Book pages are not yet receiving enough measurable traffic to optimise a sales funnel.',
        score: sessions < state.days ? 94 : 86
      },
      {
        title: 'Strengthen ' + signals.priority.name,
        reason: 'This is the current priority page for today’s content-and-SEO pair. Target phrase: “' + signals.priority.keyword + '”.',
        score: 89
      },
      {
        title: signals.buyClicks ? 'Learn which purchase actions are working' : 'Make buying intent measurable',
        reason: signals.buyClicks ? num(signals.buyClicks) + ' buy-intent clicks are visible; separate them by book and retailer before increasing promotion.' : 'No buy-intent clicks are visible in the current top tracked actions. Purchase links need consistent labels and placement.',
        score: signals.buyClicks ? 82 : 91
      },
      {
        title: 'Increase the share of visitors reaching a book page',
        reason: 'Current observed book-page reach is approximately ' + bookRate + '% of sessions using the pages visible in the analytics summary.',
        score: bookRate < 20 ? 88 : 74
      },
      {
        title: 'Connect Search Console before spending on advertising',
        reason: 'Real search queries, impressions, positions and click-through rates are required to choose paid keywords intelligently.',
        score: 80
      }
    ].sort(function (a, b) { return b.score - a.score; });

    $('opportunities').innerHTML = opportunities.map(function (item, index) {
      return '<article class="opportunity"><div class="opportunity-rank">0' + (index + 1) + '</div><div><h3>' + esc(item.title) + '</h3><p>' + esc(item.reason) + '</p></div><div class="opportunity-score"><strong>' + item.score + '</strong><span>priority score</span></div></article>';
    }).join('');
  }

  function renderSeo() {
    var signals = bookSignals();
    $('priorityBookPage').textContent = signals.priority.name;
    $('priorityBookReason').textContent = signals.priority.count ? 'Highest observed book-page traffic in this period: ' + num(signals.priority.count) + ' views.' : 'Selected for today’s content-and-SEO work while traffic evidence is still limited.';
    $('bookViews').textContent = num(signals.bookViews);
    $('buyClicks').textContent = num(signals.buyClicks);
    $('qualifiedSessions').textContent = num(signals.qualifiedSessions);

    var visible = signals.pages.filter(function (item) { return item.count > 0; });
    $('bookPages').innerHTML = (visible.length ? visible : signals.pages.slice(0, 6)).map(function (item) {
      return '<div class="rank-row"><span class="label" title="' + esc(item.path) + '">' + esc(item.name) + '</span><span class="value">' + num(item.count) + ' views</span></div>';
    }).join('');

    var actions = [
      { title: 'Connect Google Search Console', copy: 'Unlock actual queries, impressions, positions and click-through opportunities.' },
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
    var discovery = Number(parts.traffic.visitors) || 0;
    var website = Number(parts.traffic.sessions) || 0;
    var book = signals.bookViews;
    var buy = signals.buyClicks;
    var steps = [
      { label: 'Discovered', value: discovery, copy: 'Unique browser profiles observed.' },
      { label: 'Visited', value: website, copy: 'Tracked website sessions.' },
      { label: 'Viewed a book', value: book, copy: 'Views across known book pages visible in the summary.' },
      { label: 'Clicked to buy', value: buy, copy: 'Tracked actions suggesting purchase intent.' },
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
    var tasks = state.store.tasks.slice().sort(function (a, b) {
      return (b.date + b.owner).localeCompare(a.date + a.owner);
    });
    $('taskHistory').innerHTML = tasks.length ? tasks.slice(0, 40).map(function (task) {
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

  function exportHistory() {
    var rows = [['Date', 'Owner', 'Status', 'Task', 'Proof URL', 'Proof note', 'Verified at']];
    state.store.tasks.forEach(function (task) {
      rows.push([task.date, task.ownerName, statusLabel(task.status), task.title, task.proofUrl || '', task.proofNote || '', task.verifiedAt || '']);
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
