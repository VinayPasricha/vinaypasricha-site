/* AI for Business Leaders — dedicated SIV and VED participant runtimes. */
(function () {
  'use strict';

  var parts = location.pathname.split('/').filter(Boolean);
  var MODE = parts[parts.length - 1];
  var SLUG = decodeURIComponent(parts[parts.length - 2] || '');
  var app = document.getElementById('courseRuntime');
  var workspacePath = '/ai-business-leaders/workspace/' + encodeURIComponent(SLUG);
  var workspaceLink = document.getElementById('workspaceLink');
  if (workspaceLink) workspaceLink.href = workspacePath;

  var S = {
    view: 'loading',
    data: null,
    messages: [],
    report: null,
    selectedDepth: 'standard',
    input: '',
    busy: false,
    generating: false,
    error: '',
    selectedOptions: {},
    editingReport: false,
  };

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function inline(text) {
    return esc(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>');
  }

  function markdown(source) {
    var lines = String(source || '').replace(/\r/g, '').split('\n');
    var html = '';
    var paragraph = [];
    var listOpen = false;

    function flushParagraph() {
      if (!paragraph.length) return;
      html += '<p>' + inline(paragraph.join(' ')) + '</p>';
      paragraph = [];
    }
    function closeList() {
      if (listOpen) { html += '</ul>'; listOpen = false; }
    }

    lines.forEach(function (raw) {
      var line = raw.trim();
      var match;
      if (!line) { flushParagraph(); closeList(); return; }
      if ((match = line.match(/^###\s+(.+)/))) { flushParagraph(); closeList(); html += '<h3>' + inline(match[1]) + '</h3>'; return; }
      if ((match = line.match(/^##\s+(.+)/))) { flushParagraph(); closeList(); html += '<h2>' + inline(match[1]) + '</h2>'; return; }
      if ((match = line.match(/^#\s+(.+)/))) { flushParagraph(); closeList(); html += '<h1>' + inline(match[1]) + '</h1>'; return; }
      if ((match = line.match(/^[-*]\s+(.+)/))) {
        flushParagraph();
        if (!listOpen) { html += '<ul>'; listOpen = true; }
        html += '<li>' + inline(match[1]) + '</li>';
        return;
      }
      closeList();
      paragraph.push(line);
    });
    flushParagraph();
    closeList();
    return html;
  }

  async function api(path, init) {
    try {
      var response = await fetch('/api/abl' + path, Object.assign({
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      }, init || {}));
      var body = {};
      try { body = await response.json(); } catch (e) {}
      return { ok: response.ok && body.ok !== false, data: body.data, error: body.error, status: response.status };
    } catch (e) {
      return { ok: false, error: 'Network error — please check your connection and try again.', status: 0 };
    }
  }

  function heading() {
    return MODE === 'siv'
      ? 'Choose your first <em>AI project.</em>'
      : MODE === 'ved'
        ? 'Find your weakest <em>execution link.</em>'
        : 'Keep your AI direction <em>alive.</em>';
  }

  function participantBlock() {
    var p = (S.data && S.data.participant) || {};
    return '<aside class="runtime-person">' +
      '<div class="label">Prepared for</div>' +
      '<div class="name">' + esc(p.name || 'Participant') + '</div>' +
      '<div class="company">' + esc([p.role_title, p.company_name].filter(Boolean).join(' · ')) + '</div>' +
      '</aside>';
  }

  function header() {
    var config = S.data.config || {};
    return '<section class="runtime-head">' +
      '<div><p class="eyebrow">' + esc(config.eyebrow || 'AI for Business Leaders') + '</p>' +
      '<h1>' + heading() + '</h1>' +
      '<p class="runtime-tagline">' + esc(config.tagline || '') + '</p></div>' +
      participantBlock() +
      '</section>';
  }

  function depthCards() {
    var depths = (S.data.config && S.data.config.depths) || [];
    return '<div class="depth-grid">' + depths.map(function (depth) {
      return '<button type="button" class="depth-card' + (S.selectedDepth === depth.id ? ' selected' : '') + '" data-depth="' + esc(depth.id) + '">' +
        '<div><span class="depth-time">' + esc(depth.minutes) + '</span>' +
        (depth.recommended ? '<span class="recommended">Recommended</span>' : '') + '</div>' +
        '<div class="depth-title">' + esc(depth.title) + '</div>' +
        '<p class="depth-blurb">' + esc(depth.blurb) + '</p>' +
        '<div class="depth-count">' + esc(depth.lensCount) + ' lenses</div>' +
        '</button>';
    }).join('') + '</div>';
  }

  function introView() {
    var config = S.data.config || {};
    var body = '<div class="runtime-panel"><p class="runtime-intro">' + esc(config.intro || '') + '</p>';
    if (MODE === 'siv') body += '<h2 class="runtime-h2">Choose your depth</h2>' + depthCards();
    else if (MODE === 'ved') body += '<p class="chat-intro" style="margin-top:26px">Begin with the area that feels weakest right now: reporting rhythm, operations, sales, hiring, customer support, finance—or something else.</p>';
    else body += '<p class="chat-intro" style="margin-top:26px">Use this after a meeting, milestone or new development. A short update is enough; the agent will carry your earlier context forward.</p>';
    if (S.error) body += '<div class="runtime-error">' + esc(S.error) + '</div>';
    body += '<button type="button" class="runtime-button" id="startRuntime"' + (S.busy ? ' disabled' : '') + '>' +
      (S.busy ? 'Starting…' : esc(config.button || 'Begin') + ' →') + '</button></div>';
    return body;
  }

  function messageHtml(message, messageIndex, activeOptionMessage) {
    var role = message.role === 'user' ? 'user' : 'assistant';
    var options = role === 'assistant' && messageIndex === activeOptionMessage && !S.busy
      ? (message.options || []) : [];
    var isMulti = message.selection_mode === 'multi';
    var selected = S.selectedOptions[messageIndex] || [];
    var choices = options.length ? '<div class="answer-choice-wrap"><div class="answer-choice-note">' +
      (isMulti ? 'Choose every area that applies, then continue' : 'Choose an answer to continue — or write your own below') + '</div><div class="answer-choices">' +
      options.map(function (option, optionIndex) {
        var chosen = selected.indexOf(optionIndex) >= 0;
        return '<button type="button" class="answer-choice' + (chosen ? ' selected' : '') + '" data-answer-message="' + messageIndex + '" data-answer-option="' + optionIndex + '">' +
          (optionIndex === 0 ? '<span class="answer-recommended">Recommended</span>' : '') +
          (isMulti && optionIndex < options.length - 1 ? '<span class="choice-check">' + (chosen ? '✓' : '') + '</span>' : '') +
          '<span>' + esc(option) + '</span></button>';
      }).join('') + '</div>' +
      (isMulti ? '<button type="button" class="multi-continue" data-multi-continue="' + messageIndex + '"' + (selected.length ? '' : ' disabled') + '>Continue with ' + selected.length + ' selected →</button>' : '') +
      '</div>' : '';
    return '<div class="message ' + role + '"><div class="message-stack"><div class="bubble">' +
      (role === 'assistant' ? markdown(message.content) : esc(message.content).replace(/\n/g, '<br>')) +
      '</div>' + choices + '</div></div>';
  }

  function chatView() {
    var userTurns = S.messages.filter(function (message) { return message.role === 'user'; }).length;
    var prompt = MODE === 'siv'
      ? 'Name two to five areas where you are considering AI—or ask the selector to propose likely areas from your company context and execution constraint.'
      : MODE === 'ved'
        ? 'Tell the assistant which execution area feels weakest right now. It will trace one real sequence before deciding whether AI is the right lever.'
        : 'Share one change, result or obstacle. The check-in will use your Course Memory and agree the next move.';
    var activeOptionMessage = -1;
    for (var i = S.messages.length - 1; i >= 0; i -= 1) {
      if (S.messages[i].role === 'assistant') { activeOptionMessage = i; break; }
      if (S.messages[i].role === 'user') break;
    }
    var html = '<div class="runtime-panel"><p class="chat-intro">' + esc(prompt) + '</p>' +
      '<div class="messages" id="messages">' + S.messages.map(function (message, index) {
        return messageHtml(message, index, activeOptionMessage);
      }).join('') +
      (S.busy ? '<div class="thinking">Examining…</div>' : '') + '<div id="messageEnd"></div></div>';
    if (S.error) html += '<div class="runtime-error">' + esc(S.error) + '</div>';
    html += '<div class="composer"><textarea id="runtimeInput" placeholder="Type your reply…  (Enter to send, Shift+Enter for a new line)"' +
      (S.busy || S.generating ? ' disabled' : '') + '>' + esc(S.input) + '</textarea>' +
      '<div class="composer-row"><span class="composer-note">Your conversation is saved automatically</span>' +
      '<button type="button" class="send-button" id="sendRuntime"' + (S.busy || S.generating ? ' disabled' : '') + '>Send →</button></div></div>' +
      '<div class="actions"><button type="button" class="report-action" id="generateReport"' +
      (S.busy || S.generating || userTurns < 2 ? ' disabled' : '') + '>' +
      (S.generating ? 'Preparing your report…' : esc(S.data.config.reportTitle || 'Generate report') + ' →') + '</button>' +
      '<span class="runtime-meta">' + esc(String(S.data.message_count || 0)) + '/' + esc(String(S.data.max_messages || 200)) + ' course interactions</span>' +
      '<button type="button" class="restart-action" id="restartRuntime">Restart this conversation</button></div>' +
      (userTurns < 2 ? '<p class="runtime-meta" style="margin-top:9px">Continue for at least two turns before generating the report.</p>' : '') +
      '</div>';
    return html;
  }

  function reportView() {
    var next = MODE === 'ved'
      ? '<a class="text-action" href="' + workspacePath + '/siv">Next: choose your first AI project →</a>'
      : MODE === 'siv'
        ? '<a class="text-action" href="' + workspacePath + '">Return to build your 90-day blueprint →</a>'
        : '<a class="text-action" href="' + workspacePath + '">Return to the participant workspace →</a>';
    var documentBody = MODE === 'continuing' && S.editingReport
      ? '<textarea class="blueprint-editor" id="blueprintEditor">' + esc(S.report.markdown) + '</textarea>'
      : '<article class="report-doc">' + markdown(S.report.markdown) + '</article>';
    return '<div class="runtime-panel"><div class="report-head"><h2>' + esc(S.data.config.reportTitle || 'Your report') + '</h2>' +
      '<a class="text-action" href="/ai-business-leaders/pdf/' + encodeURIComponent(S.report.id) + '" target="_blank" rel="noopener">Download PDF ↓</a></div>' +
      documentBody +
      '<div class="actions">' + next +
      (MODE === 'continuing' ? (S.editingReport
        ? '<button type="button" class="text-action" id="saveBlueprint">Save blueprint</button><button type="button" class="text-action" id="cancelBlueprint">Cancel</button>'
        : '<button type="button" class="text-action" id="editBlueprint">Edit blueprint</button>') : '') +
      '<button type="button" class="text-action" id="continueRuntime">← Continue the conversation</button>' +
      '<button type="button" class="text-action" id="regenerateReport"' + (S.generating ? ' disabled' : '') + '>Regenerate report</button></div></div>';
  }

  function render() {
    if (S.view === 'loading') return;
    if (S.view === 'error') {
      app.innerHTML = '<div class="error-state"><div><h1>Conversation unavailable</h1><p>' + esc(S.error || 'This participant conversation could not be found.') + '</p></div></div>';
      return;
    }
    app.innerHTML = header() + (S.view === 'intro' ? introView() : S.view === 'report' ? reportView() : chatView());
    wire();
    if (S.view === 'chat') {
      requestAnimationFrame(function () {
        var end = document.getElementById('messageEnd');
        if (end) end.scrollIntoView({ block: 'nearest' });
      });
    }
  }

  function wire() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-depth]'), function (button) {
      button.onclick = function () { S.selectedDepth = button.getAttribute('data-depth'); render(); };
    });
    var start = document.getElementById('startRuntime');
    if (start) start.onclick = startRuntime;

    Array.prototype.forEach.call(document.querySelectorAll('[data-answer-option]'), function (button) {
      button.onclick = function () {
        var message = S.messages[parseInt(button.getAttribute('data-answer-message'), 10)];
        var option = message && (message.options || [])[parseInt(button.getAttribute('data-answer-option'), 10)];
        if (!option) return;
        var optionIndex = parseInt(button.getAttribute('data-answer-option'), 10);
        if (message.selection_mode === 'multi' && optionIndex < (message.options || []).length - 1) {
          var messageIndex = parseInt(button.getAttribute('data-answer-message'), 10);
          var chosen = (S.selectedOptions[messageIndex] || []).slice();
          var existing = chosen.indexOf(optionIndex);
          if (existing >= 0) chosen.splice(existing, 1); else chosen.push(optionIndex);
          S.selectedOptions[messageIndex] = chosen;
          render();
          return;
        }
        if (optionIndex === (message.options || []).length - 1) {
          S.input = '';
          render();
          var editor = document.getElementById('runtimeInput');
          if (editor) editor.focus();
          return;
        }
        S.input = option;
        send();
      };
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-multi-continue]'), function (button) {
      button.onclick = function () {
        var messageIndex = parseInt(button.getAttribute('data-multi-continue'), 10);
        var message = S.messages[messageIndex];
        var chosen = S.selectedOptions[messageIndex] || [];
        if (!message || !chosen.length) return;
        S.input = chosen.map(function (index) { return (message.options || [])[index]; }).filter(Boolean).join('\n');
        send();
      };
    });

    var input = document.getElementById('runtimeInput');
    if (input) {
      input.oninput = function () { S.input = input.value; };
      input.onkeydown = function (event) {
        if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); }
      };
      try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); }
    }
    var sendButton = document.getElementById('sendRuntime');
    if (sendButton) sendButton.onclick = send;
    var generateButton = document.getElementById('generateReport');
    if (generateButton) generateButton.onclick = generateReport;
    var regenerateButton = document.getElementById('regenerateReport');
    if (regenerateButton) regenerateButton.onclick = generateReport;
    var continueButton = document.getElementById('continueRuntime');
    if (continueButton) continueButton.onclick = function () { S.view = 'chat'; S.error = ''; render(); };
    var restartButton = document.getElementById('restartRuntime');
    if (restartButton) restartButton.onclick = restartRuntime;
    var editBlueprint = document.getElementById('editBlueprint');
    if (editBlueprint) editBlueprint.onclick = function () { S.editingReport = true; render(); };
    var cancelBlueprint = document.getElementById('cancelBlueprint');
    if (cancelBlueprint) cancelBlueprint.onclick = function () { S.editingReport = false; render(); };
    var saveBlueprint = document.getElementById('saveBlueprint');
    if (saveBlueprint) saveBlueprint.onclick = saveBlueprintEdit;
  }

  async function load() {
    if (!SLUG || (MODE !== 'siv' && MODE !== 'ved' && MODE !== 'continuing')) {
      S.view = 'error'; S.error = 'This course conversation link is incomplete.'; return render();
    }
    var result = await api('/session/' + encodeURIComponent(SLUG) + '/runtime/' + MODE);
    if (!result.ok || !result.data) {
      S.view = 'error'; S.error = result.error || 'This course conversation could not be found.'; return render();
    }
    S.data = result.data;
    S.messages = result.data.messages || [];
    S.report = result.data.report || null;
    if (result.data.depth) S.selectedDepth = result.data.depth;
    var showExistingReport = MODE === 'continuing' && new URLSearchParams(location.search).get('report') === '1' && S.report;
    S.view = MODE === 'continuing'
      ? (showExistingReport ? 'report' : (result.data.started ? 'chat' : 'intro'))
      : (S.report ? 'report' : (result.data.started ? 'chat' : 'intro'));
    document.title = (result.data.config.title || 'Guided Conversation') + ' — AI for Business Leaders';
    render();
  }

  async function startRuntime() {
    if (S.busy) return;
    S.busy = true; S.error = ''; render();
    var result = await api('/session/' + encodeURIComponent(SLUG) + '/runtime/' + MODE, {
      method: 'POST',
      body: JSON.stringify(MODE === 'siv' ? { depth: S.selectedDepth } : {}),
    });
    S.busy = false;
    if (!result.ok) { S.error = result.error || 'Could not start this conversation.'; return render(); }
    S.data.started = true;
    if (MODE === 'siv') S.data.depth = S.selectedDepth;
    S.view = 'chat';
    if (result.data && result.data.reply) {
      S.messages.push({ role: 'assistant', content: result.data.reply, options: result.data.options || [], selection_mode: result.data.selection_mode || 'single' });
    }
    render();
  }

  async function send() {
    var message = String(S.input || '').trim();
    if (!message || S.busy) return;
    S.input = '';
    S.error = '';
    S.messages.push({ role: 'user', content: message });
    S.busy = true;
    render();
    var result = await api('/session/' + encodeURIComponent(SLUG) + '/runtime/' + MODE + '/message', {
      method: 'POST', body: JSON.stringify({ message: message }),
    });
    S.busy = false;
    if (result.ok && result.data) {
      S.messages.push({ role: 'assistant', content: result.data.reply, options: result.data.options || [], selection_mode: result.data.selection_mode || 'single', stage: result.data.stage || '' });
      S.data.message_count = result.data.message_count;
      S.data.max_messages = result.data.max_messages;
    } else {
      S.error = result.error || 'That did not go through. Your work is saved—please try again.';
    }
    render();
  }

  async function generateReport() {
    if (S.generating || S.busy) return;
    S.generating = true; S.error = ''; S.view = 'chat'; render();
    var result = await api('/session/' + encodeURIComponent(SLUG) + '/runtime/' + MODE + '/report', { method: 'POST' });
    S.generating = false;
    if (result.ok && result.data && result.data.report) {
      S.report = result.data.report;
      S.view = 'report';
    } else {
      S.error = result.error || 'Could not generate the report. Please try again.';
      S.view = 'chat';
    }
    render();
  }

  async function restartRuntime() {
    if (S.busy || !window.confirm('Restart only this conversation? Its messages and report will be cleared. Your verified company context and other conversations will remain.')) return;
    S.busy = true; S.error = ''; render();
    var result = await api('/session/' + encodeURIComponent(SLUG) + '/runtime/' + MODE + '/restart', { method: 'POST' });
    if (!result.ok) { S.busy = false; S.error = result.error || 'Could not restart this conversation.'; return render(); }
    location.reload();
  }

  async function saveBlueprintEdit() {
    var editor = document.getElementById('blueprintEditor');
    var markdownText = editor ? editor.value.trim() : '';
    if (!markdownText || S.busy) return;
    S.busy = true;
    var result = await api('/session/' + encodeURIComponent(SLUG) + '/blueprint', {
      method: 'PATCH', body: JSON.stringify({ markdown: markdownText }),
    });
    S.busy = false;
    if (!result.ok || !result.data) { S.error = result.error || 'Could not save the blueprint.'; return render(); }
    S.report = result.data;
    S.editingReport = false;
    render();
  }

  load();
})();
