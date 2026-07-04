/* AI for Business Leaders — participant experience (vanilla JS).
   Talks to /api/abl/session/:slug on the site's Express backend (Gemini + Firestore). */
(function () {
  'use strict';

  var parts = location.pathname.split('/').filter(Boolean);
  var SLUG = decodeURIComponent(parts[parts.length - 1] || '');
  var app = document.getElementById('app');

  var OPENING_COPY =
    'Welcome to your AI for Business Leaders preparation session.\n\n' +
    'This conversation is designed to help personalise your course experience and prepare Vinay for your one-on-one meeting.\n\n' +
    'I have some preliminary research about your company, but please correct me wherever I am wrong.\n\n' +
    'At the end, I will show you the summary that will be shared with Vinay. You can edit or remove anything sensitive before it is saved for Vinay.\n\n' +
    'You do not need to finish this in one sitting. Your session will be saved. You can leave and come back later using the same link.';
  var PRIVACY_NOTICE =
    "This is a private preparation session for Vinay Pasricha's course, AI for Business Leaders. Your conversation is stored securely and used only to help personalise the course and prepare for your one-on-one with Vinay. Before anything is shared with Vinay, you will see the summary and can edit or remove anything sensitive. Please share only what you are comfortable sharing.";
  var DEPTHS = [
    { id: '15', m: '15 minutes', t: 'Course Personalisation Interview', b: 'Best if you want to quickly help Vinay understand your company, role, current AI exposure, learning goals, and what you want from the course.', r: 'Course Preparation Brief' },
    { id: '30', m: '30 minutes', t: 'AI Use-Case Discovery', b: 'Best if you want to explore where AI may or may not be relevant in your company.', r: 'AI Opportunity & Use-Case Map' },
    { id: '45', m: '45 minutes', t: 'AI Strategy Session', b: 'Best if you want a deeper first draft of possible AI priorities, risks, readiness gaps, and a sensible 90-day direction.', r: 'Personalised AI Strategy Note + 90-Day Direction' },
  ];
  var STEPS = ['Course Personalisation', 'Use-Case Discovery', 'Strategy Session', 'You Will Get', 'Summary Review'];
  var REWARD_TITLES = { course_preparation_brief: 'Course Preparation Brief', use_case_map: 'AI Opportunity & Use-Case Map', strategy_note: 'Personalised AI Strategy Note + 90-Day Direction' };

  // ---- state ----
  var S = { view: 'loading', err: '', genErr: '', chatErr: '', pendingText: '', consent: false, data: null, messages: [], input: '', busy: false,
    count: 0, max: 200, reward: null, shareId: null, shareText: '', note: '', scrollToEnd: false,
    resumed: false, fbRating: 0, fbComment: '', fbDone: false };

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function md(src) {
    var lines = String(src || '').replace(/\r/g, '').split('\n'), out = '', inList = false, tbuf = [];
    function inl(t) { return esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/`(.+?)`/g, '<code>$1</code>'); }
    function close() { if (inList) { out += '</ul>'; inList = false; } }
    function isRow(l) { return /^\s*\|.*\|\s*$/.test(l); }
    function isSep(l) { return /^\s*\|[\s:|-]+\|\s*$/.test(l); }
    function cells(l) { return l.trim().replace(/^\||\|$/g, '').split('|').map(function (c) { return c.trim(); }); }
    function flushTable() {
      if (!tbuf.length) return;
      if (tbuf.length >= 2 && isSep(tbuf[1])) {
        out += '<table class="mdt"><thead><tr>' + cells(tbuf[0]).map(function (h) { return '<th>' + inl(h) + '</th>'; }).join('') + '</tr></thead><tbody>';
        tbuf.slice(2).forEach(function (r) { out += '<tr>' + cells(r).map(function (c) { return '<td>' + inl(c) + '</td>'; }).join('') + '</tr>'; });
        out += '</tbody></table>';
      } else { tbuf.forEach(function (r) { out += '<p>' + inl(r) + '</p>'; }); }
      tbuf = [];
    }
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i].replace(/\s+$/, ''), m2;
      if (isRow(l)) { close(); tbuf.push(l); continue; }
      flushTable();
      if ((m2 = l.match(/^###\s+(.*)/))) { close(); out += '<h3>' + inl(m2[1]) + '</h3>'; }
      else if ((m2 = l.match(/^##\s+(.*)/))) { close(); out += '<h2>' + inl(m2[1]) + '</h2>'; }
      else if ((m2 = l.match(/^#\s+(.*)/))) { close(); out += '<h1>' + inl(m2[1]) + '</h1>'; }
      else if (/^(-{3,}|_{3,})$/.test(l)) { close(); out += '<hr>'; }
      else if ((m2 = l.match(/^\s*[-*]\s+(.*)/))) { if (!inList) { out += '<ul>'; inList = true; } out += '<li>' + inl(m2[1]) + '</li>'; }
      else if (!l.trim()) { close(); }
      else { close(); out += '<p>' + inl(l) + '</p>'; }
    }
    flushTable(); close(); return out;
  }

  async function apiFetch(path, init) {
    try {
      var res = await fetch('/api/abl' + path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, init || {}));
      var body = {}; try { body = await res.json(); } catch (e) {}
      return { ok: res.ok && body.ok !== false, data: body.data, error: body.error, status: res.status };
    } catch (e) {
      // Network blip — return a soft failure so the UI recovers instead of hanging.
      return { ok: false, error: 'Network error — please check your connection and try again.', status: 0 };
    }
  }

  // ---- load ----
  async function load() {
    var r = await apiFetch('/session/' + encodeURIComponent(SLUG));
    if (!r.ok || !r.data) { S.err = r.error || 'This session could not be found.'; S.view = 'error'; return render(); }
    var d = r.data;
    S.data = d; S.consent = d.session.consent_given;
    S.messages = d.messages.map(function (m) { return { role: m.role, content: m.content, options: m.options || [] }; });
    S.count = d.participant.message_count; S.max = d.participant.max_messages;
    S.reward = d.reward; S.shareId = d.share && d.share.id; S.shareText = (d.share && d.share.markdown) || '';
    if (d.share && d.share.approved) S.view = 'done';
    else if (d.reward && d.share) S.view = 'review';
    else if (d.session.selected_depth) S.view = 'chat';
    else S.view = 'welcome';
    S.busy = false;
    // Returning to a session with prior answers → welcome them back.
    if (S.view === 'chat' && d.messages.filter(function (m) { return m.role === 'user'; }).length > 0) S.resumed = true;
    if (S.view === 'chat') S.scrollToEnd = true; // land on the newest message when the chat loads
    render();
  }

  // ---- actions ----
  async function start(depth) {
    if (!S.consent) return;
    S.busy = true; render();
    var r = await apiFetch('/session/' + encodeURIComponent(SLUG), { method: 'POST', body: JSON.stringify({ depth: depth, consent: true }) });
    if (r.ok) { await load(); }  // re-load so the agent's opening greeting is fetched
    else { S.busy = false; S.err = r.error || 'Could not start.'; render(); }
  }
  // send(); pass a string to send that text (option click); pass nothing to send the textarea.
  // isRetry re-sends S.pendingText without re-adding the user bubble.
  async function send(textArg, isRetry) {
    var msg = String(textArg != null ? textArg : S.input).trim();
    if (!msg || S.busy) return;
    if (!isRetry) { if (textArg == null) S.input = ''; S.messages.push({ role: 'user', content: msg }); }
    S.pendingText = msg; S.chatErr = ''; S.busy = true; S.scrollToEnd = true; render();
    var r = await apiFetch('/session/' + encodeURIComponent(SLUG) + '/message', { method: 'POST', body: JSON.stringify({ message: msg }) });
    S.busy = false;
    if (r.ok && r.data) {
      S.messages.push({ role: 'assistant', content: r.data.reply, options: r.data.options || [] });
      S.count = r.data.message_count; S.max = r.data.max_messages; S.pendingText = ''; S.scrollToEnd = true;
    } else {
      // Keep the message; show a rerun button so a network blip/timeout is recoverable.
      S.chatErr = r.error || 'That didn’t go through. Please try again.';
    }
    render();
  }
  async function finish() {
    S.view = 'generating'; S.busy = true; S.genErr = ''; render();
    var r = await apiFetch('/session/' + encodeURIComponent(SLUG) + '/reward', { method: 'POST' });
    S.busy = false;
    if (r.ok && r.data) { S.reward = r.data.reward; S.shareId = r.data.share.id; S.shareText = r.data.share.markdown; S.view = 'review'; }
    else { S.genErr = r.error || 'Could not prepare your summary. Please try again.'; S.view = 'chat'; }
    render();
  }
  async function review(approved) {
    S.busy = true; render();
    var r = await apiFetch('/session/' + encodeURIComponent(SLUG) + '/review', { method: 'POST', body: JSON.stringify({ reviewed_markdown: S.shareText, approved: approved, note: S.note }) });
    S.busy = false;
    if (r.ok && approved) S.view = 'done';
    render();
  }
  async function submitFeedback() {
    if (!S.fbRating || S.busy) return;
    S.busy = true; render();
    var r = await apiFetch('/session/' + encodeURIComponent(SLUG) + '/feedback', { method: 'POST', body: JSON.stringify({ rating: S.fbRating, comment: S.fbComment }) });
    S.busy = false;
    if (r.ok) S.fbDone = true;
    render();
  }

  // ---- render ----
  function stepIndex() {
    if (S.view === 'done') return 5; if (S.view === 'review') return 4;
    if (S.view === 'chat') { var d = S.data.session.selected_depth; return d === '45' ? 2 : d === '30' ? 1 : 0; }
    return -1;
  }
  function progressPct() {
    if (S.view === 'done') return 100;
    if (S.view === 'review' || S.view === 'generating') return 85;
    if (S.view === 'chat') {
      var u = S.messages.filter(function (m) { return m.role === 'user'; }).length;
      return Math.min(65, 20 + Math.round(Math.min(u, 5) / 5 * 45));
    }
    return 5;
  }
  function headerHTML(showSteps) {
    var p = S.data.participant;
    var pct = progressPct();
    var steps = showSteps ? '<div class="abl-steps">' + STEPS.map(function (s, i) {
      return '<span class="step ' + (i <= stepIndex() ? 'on' : '') + '">' + (i <= stepIndex() ? '●' : '○') + ' ' + esc(s) + '</span>';
    }).join('') + '</div>' +
      '<div class="abl-prog"><div class="abl-prog-bar" style="width:' + pct + '%"></div></div>' +
      '<div class="abl-prog-t">' + pct + '% complete</div>' : '';
    return '<div class="abl-head"><div class="abl-kicker">AI for Business Leaders · Preparation</div>' +
      '<div class="abl-title">' + esc(p.name) + (p.company_name ? ' · ' + esc(p.company_name) : '') + '</div></div>' + steps;
  }

  // Invitations back into the main site so the participant can keep exploring.
  function exploreHTML() {
    var links = [
      ['/books', 'The Books', 'Vinay’s books on business, AI, and life'],
      ['/paths/essay', 'Essays', 'Writing on decisions, strategy, and thought'],
      ['/paths/watch', 'Watch', 'Talks, films, and conversations'],
      ['/', 'Explore the site', 'Everything Vinay is building']
    ];
    return '<div class="explore"><div class="explore-h">While you’re here — explore more from Vinay</div>' +
      '<div class="explore-grid">' + links.map(function (l) {
        return '<a class="ex-card" href="' + l[0] + '"><div class="ex-t">' + esc(l[1]) + ' →</div><div class="ex-d">' + esc(l[2]) + '</div></a>';
      }).join('') + '</div></div>';
  }

  function feedbackHTML() {
    if (S.fbDone || (S.data.participant && S.data.participant.feedback_rating > 0)) {
      return '<div class="fb"><div class="fb-h">Thanks for the feedback. 🙏</div></div>';
    }
    var stars = '';
    for (var i = 1; i <= 5; i++) stars += '<button type="button" class="star' + (i <= S.fbRating ? ' on' : '') + '" data-star="' + i + '">★</button>';
    return '<div class="fb"><div class="fb-h">How useful was this session?</div>' +
      '<div class="fb-stars">' + stars + '</div>' +
      '<input class="fb-comment" id="fbComment" placeholder="One line (optional) — what worked, what didn’t?" value="' + esc(S.fbComment) + '">' +
      '<button class="btn accent" id="fbSubmit"' + (S.fbRating ? '' : ' disabled') + ' style="margin-top:10px">Send feedback</button></div>';
  }

  function contactHTML() {
    return '<div class="contact">Questions? Email <a href="mailto:vinay@goodspace.ai">vinay@goodspace.ai</a></div>';
  }

  function render() {
    if (S.view === 'loading') { app.innerHTML = '<p class="muted" style="font-family:var(--mono)">Loading your session…</p>'; return; }
    if (S.view === 'error') { app.innerHTML = '<h1 class="abl-title">Session unavailable</h1><p class="muted" style="margin-top:8px">' + esc(S.err) + '</p>'; return; }

    var html = headerHTML(S.view !== 'welcome');

    if (S.view === 'welcome') {
      html += '<div class="abl-copy">' + esc(OPENING_COPY) + '</div>' +
        '<div class="abl-privacy"><div class="lbl">Privacy &amp; sharing</div>' + esc(PRIVACY_NOTICE) +
        '<label class="abl-consent"><input type="checkbox" id="consent"' + (S.consent ? ' checked' : '') + '>' +
        '<span>I understand, and I’m happy to begin. I can review what’s shared with Vinay before anything is saved.</span></label></div>' +
        '<h2 class="abl-h2">Choose how deep you’d like to go</h2><div class="depths">' +
        DEPTHS.map(function (d) {
          return '<button class="depth" data-depth="' + d.id + '"' + (S.consent && !S.busy ? '' : ' disabled') + '>' +
            '<div class="m">' + d.m + '</div><div class="t">' + esc(d.t) + '</div><div class="b">' + esc(d.b) + '</div>' +
            '<div class="r">You will get · ' + esc(d.r) + '</div></button>';
        }).join('') + '</div>' +
        (S.consent ? '' : '<p class="count" style="margin-top:12px">Please accept the privacy notice above to choose a journey.</p>') +
        contactHTML();
    }

    if (S.view === 'generating') {
      var d = S.data.session.selected_depth;
      var rname = d === '45' ? 'AI Strategy Note' : d === '30' ? 'AI Opportunity & Use-Case Map' : 'Course Preparation Brief';
      html += '<div style="margin-top:64px;text-align:center">' +
        '<div class="thinking" style="font-size:16px;color:var(--ink-2)">Preparing your <em>' + esc(rname) + '</em> and summary…</div>' +
        '<p class="count" style="margin-top:12px;max-width:440px;margin-left:auto;margin-right:auto;line-height:1.6">This usually takes 20–40 seconds — the runtime is writing your document from the whole conversation. Please keep this tab open.</p>' +
        '<div style="margin-top:18px;font-family:var(--mono);letter-spacing:.3em;color:var(--accent)">● ● ●</div></div>';
    }

    if (S.view === 'chat') {
      if (S.resumed) html += '<div class="resumed"><span>👋 Welcome back' + (S.data.participant.name ? ', ' + esc(S.data.participant.name.split(' ')[0]) : '') + ' — we saved your progress. Pick up right where you left off.</span> <button class="link-btn" id="dismissResumed">Dismiss</button></div>';
      if (S.genErr) html += '<div class="warn" style="border:1px solid var(--accent);border-radius:6px;padding:10px 12px;margin-top:16px">' + esc(S.genErr) + ' <button class="link-btn" id="retryFinish" style="margin-left:6px">Try again →</button></div>';
      html += '<div class="msgs">' + S.messages.map(function (m) {
        var them = m.role !== 'user';
        return '<div class="row ' + (them ? 'them' : 'me') + '"><div class="bubble">' + (them ? md(m.content) : esc(m.content)) + '</div></div>';
      }).join('') + (S.busy ? '<div class="thinking">the agent is thinking…</div>' : '') + '<div id="end"></div></div>';

      // Rerun banner if the last turn failed (network / timeout / server).
      if (S.chatErr) html += '<div class="warn" style="border:1px solid var(--accent);border-radius:6px;padding:10px 12px;margin-top:12px">' + esc(S.chatErr) + ' <button class="link-btn" id="rerun" style="margin-left:6px">Rerun →</button></div>';

      // Suggested answers for the latest agent question: 3 tailored options + a custom box.
      var last = S.messages.length ? S.messages[S.messages.length - 1] : null;
      var opts = (last && last.role !== 'user' && Array.isArray(last.options)) ? last.options : [];
      S.currentOptions = opts;
      if (!S.busy && !S.chatErr && opts.length) {
        html += '<div class="opts">' + opts.map(function (o, i) {
          return '<button class="opt" data-opt="' + i + '"><span class="opt-i">' + (i + 1) + '</span>' + esc(o) + '</button>';
        }).join('') + '</div><div class="opt-or">— or write your own —</div>';
      }

      var userMsgs = S.messages.filter(function (m) { return m.role === 'user'; }).length;
      html += (S.count >= 180 && S.count < S.max ? '<p class="warn">You’re nearing this session’s message limit (' + S.count + '/' + S.max + '). You can finish and generate your summary at any time.</p>' : '') +
        '<div class="composer"><textarea id="input" rows="3" placeholder="Type your own reply…  (Enter to send, Shift+Enter for a new line)"' + (S.busy || S.count >= S.max ? ' disabled' : '') + '>' + esc(S.input) + '</textarea>' +
        '<div class="composer-row"><button class="link-btn" id="finish"' + (S.busy || userMsgs < 5 ? ' disabled' : '') + ' title="' + (userMsgs < 5 ? 'Answer a few more questions first (' + userMsgs + '/5)' : '') + '">I’m ready — prepare my summary &amp; what I’ll get →</button>' +
        '<button class="btn" id="sendBtn"' + (S.busy || S.count >= S.max ? ' disabled' : '') + '>Send</button></div>' +
        '<div class="count">' + S.count + '/' + S.max + ' messages' + (userMsgs < 5 ? ' · answer ' + (5 - userMsgs) + ' more to finish' : '') + '</div></div>';
    }

    if (S.view === 'review' && S.reward) {
      var title = REWARD_TITLES[S.reward.type] || 'Your Brief';
      html += '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:26px">' +
        '<h2 class="abl-h2" style="margin:0">' + esc(title) + '</h2>' +
        '<a class="link-btn" style="text-decoration:none" href="/ai-business-leaders/pdf/' + encodeURIComponent(S.reward.id) + '" target="_blank" rel="noopener">Download PDF ↓</a></div>' +
        '<div class="doc">' + md(S.reward.markdown) + '</div>' +
        '<h2 class="abl-h2">Summary to be shared with Vinay</h2>' +
        '<p class="count">Please review. You can edit the text or remove anything sensitive before it’s saved for Vinay.</p>' +
        '<textarea class="review-ta" id="shareText">' + esc(S.shareText) + '</textarea>' +
        '<input class="review-note" id="note" placeholder="Optional: add a note to Vinay" value="' + esc(S.note) + '">' +
        '<div style="display:flex;gap:14px;align-items:center;margin-top:16px">' +
        '<button class="link-btn" id="backToChat">← Back to the conversation</button>' +
        '<button class="link-btn" id="saveEdits"' + (S.busy ? ' disabled' : '') + '>Save edits</button>' +
        '<button class="btn accent" id="approve"' + (S.busy ? ' disabled' : '') + '>Approve &amp; send to Vinay</button></div>';
    }

    if (S.view === 'done') {
      html += '<h1 class="abl-title" style="margin-top:28px">Thank you.</h1>' +
        '<p class="abl-copy">Your summary has been shared with Vinay, and your session is saved. He’ll use it to make your one-on-one as useful as possible.</p>' +
        (S.reward ? '<a class="link-btn" style="display:inline-block;margin-top:16px;text-decoration:none" href="/ai-business-leaders/pdf/' + encodeURIComponent(S.reward.id) + '" target="_blank" rel="noopener">Download your ' + esc(REWARD_TITLES[S.reward.type] || 'document') + ' (PDF) ↓</a>' : '') +
        feedbackHTML() +
        exploreHTML() +
        '<div style="margin-top:22px;border-top:1px solid var(--rule);padding-top:16px">' +
        '<button class="link-btn" id="backToChat">← Changed your mind? Go back and add or edit anything</button></div>' +
        contactHTML();
    }

    // Preserve the scroll position across re-renders so pressing a button never
    // jumps the page to the top. Only the chat scrolls — and only to the newest
    // message, and only when one was just added (S.scrollToEnd).
    var prevY = window.pageYOffset;
    app.innerHTML = html;
    wire();
    if (S.scrollToEnd) {
      S.scrollToEnd = false;
      // Jump to the very bottom so the newest reply, its options, and the input
      // box are all in view. rAF twice so it runs after layout (incl. options).
      requestAnimationFrame(function () {
        window.scrollTo(0, document.documentElement.scrollHeight);
        requestAnimationFrame(function () { window.scrollTo(0, document.documentElement.scrollHeight); });
      });
    } else {
      window.scrollTo(0, prevY);
    }
  }

  function wire() {
    var c = document.getElementById('consent');
    if (c) c.onchange = function () { S.consent = c.checked; render(); };
    Array.prototype.forEach.call(document.querySelectorAll('.depth'), function (b) {
      b.onclick = function () { start(b.getAttribute('data-depth')); };
    });
    var ta = document.getElementById('input');
    if (ta) {
      ta.oninput = function () { S.input = ta.value; };
      ta.onkeydown = function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
      try { ta.focus({ preventScroll: true }); } catch (e) { ta.focus(); }
      ta.selectionStart = ta.value.length;
    }
    var sb = document.getElementById('sendBtn'); if (sb) sb.onclick = function () { send(); };
    var fn = document.getElementById('finish'); if (fn) fn.onclick = finish;
    var rf = document.getElementById('retryFinish'); if (rf) rf.onclick = finish;
    var rr = document.getElementById('rerun'); if (rr) rr.onclick = function () { send(S.pendingText, true); };
    Array.prototype.forEach.call(document.querySelectorAll('.opt'), function (b) {
      b.onclick = function () { var i = parseInt(b.getAttribute('data-opt'), 10); if (S.currentOptions && S.currentOptions[i]) send(S.currentOptions[i]); };
    });
    Array.prototype.forEach.call(document.querySelectorAll('#backToChat'), function (b) {
      b.onclick = function () { S.view = 'chat'; S.chatErr = ''; S.scrollToEnd = true; render(); };
    });
    var dr = document.getElementById('dismissResumed'); if (dr) dr.onclick = function () { S.resumed = false; render(); };
    Array.prototype.forEach.call(document.querySelectorAll('.star'), function (b) {
      b.onclick = function () { S.fbRating = parseInt(b.getAttribute('data-star'), 10); render(); };
    });
    var fc = document.getElementById('fbComment'); if (fc) fc.oninput = function () { S.fbComment = fc.value; };
    var fs = document.getElementById('fbSubmit'); if (fs) fs.onclick = submitFeedback;
    var st = document.getElementById('shareText'); if (st) st.oninput = function () { S.shareText = st.value; };
    var nt = document.getElementById('note'); if (nt) nt.oninput = function () { S.note = nt.value; };
    var se = document.getElementById('saveEdits'); if (se) se.onclick = function () { review(false); };
    var ap = document.getElementById('approve'); if (ap) ap.onclick = function () { review(true); };
  }

  load();
})();
