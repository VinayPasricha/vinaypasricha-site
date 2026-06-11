/* =============================================================
   civilization-chat.js — UI controller for the Civilization v1.5
   runtime. Three modes, all riding the SAME retrieval layer:
     • Ask     — free questions answered from the manuscript.
     • Explore — guided entry points (curated questions).
     • Apply   — apply the framework to a subject the reader names,
                 with BOOK CONTENT and FRAMEWORK APPLICATION kept
                 clearly separate.
   Plain DOM, no framework.
   ============================================================= */
(function () {
  'use strict';

  var STARTERS = [
    'What is the central argument of Civilization?',
    'What are the eight directions?',
    'Why does the book begin with Continuity?',
    'What does Rome reveal?',
    'Why did China survive?',
    'What is Modernity preserving?',
    'Why is AI the hardest case?',
    'What does the book mean by possibility space?'
  ];

  // Guided Exploration — structured entry points.
  var EXPLORE = [
    { head: 'Start here', items: [
      { label: 'What is Civilization?', q: 'What is the book Civilization about — its central argument?' },
      { label: 'The Eight Directions', q: 'What are the eight directions and how do they work together?' },
      { label: 'Key Concepts', q: 'Explain the key concepts of the framework: the compass, the landscape, the possibility space, the foundations and frontiers, and alignment.' }
    ]},
    { head: 'The case studies', items: [
      { label: 'Rome', q: 'What does the framework reveal about Rome?' },
      { label: 'China', q: 'What does the framework reveal about China, and why did it survive?' },
      { label: 'Modernity', q: 'How does the framework read Modernity, and what is it preserving?' },
      { label: 'AI', q: 'How does the framework read Artificial Intelligence, and why is it the hardest case?' },
      { label: 'Possible Futures', q: 'What does the book say about possible futures?' }
    ]},
    { head: 'Frequently asked', items: [
      { label: 'Is this a prediction of the future?', q: 'Is the book a prediction of the future?' },
      { label: 'Is “alignment” a moral claim?', q: 'What does the book mean by alignment — is it a moral claim?' },
      { label: 'What would prove the framework wrong?', q: 'What would invalidate or falsify the framework?' },
      { label: 'Is the framework political?', q: 'Is the framework a political, cultural, or religious claim?' }
    ]}
  ];

  // Apply mode — example subjects.
  var APPLY_EXAMPLES = ['the United States', 'a startup', 'the Roman Republic', 'the printing press', 'the European Enlightenment', 'the internet'];

  function init() {
    var thread = document.getElementById('civ-thread');
    var input = document.getElementById('civ-input');
    var send = document.getElementById('civ-send');
    var panel = document.getElementById('civ-starters');
    var modes = document.getElementById('civ-modes');
    if (!thread || !input || !send || !panel) return;
    if (!window.civilizationRuntime) return;

    var busy = false;
    var mode = 'ask';

    function esc(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function paragraphs(text) {
      return String(text || '').trim().split(/\n{2,}/)
        .map(function (p) { return '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>'; }).join('');
    }
    function clearEmpty() { var e = thread.querySelector('.civ-empty'); if (e) e.remove(); }
    function scrollToEnd() { try { thread.scrollTop = thread.scrollHeight; } catch (e) {} }

    function sourcesHTML(sources, head) {
      if (!sources || !sources.length) return '';
      var items = sources.map(function (s) {
        var ref = esc(s.chapter || '');
        if (s.section && s.section !== s.chapter) ref += ' &middot; ' + esc(s.section);
        var quote = s.quote ? '<div class="src-quote">&ldquo;' + esc(s.quote) + '&rdquo;</div>' : '';
        return '<div class="civ-source"><div class="src-ref">' + ref + '</div>' + quote + '</div>';
      }).join('');
      return '<div class="civ-sources"><div class="src-head">' + esc(head || 'From the book') + '</div>' + items + '</div>';
    }

    function addUser(label) {
      clearEmpty();
      var m = document.createElement('div');
      m.className = 'civ-msg user';
      m.innerHTML = '<div class="who">You</div><div class="bubble">' + esc(label) + '</div>';
      thread.appendChild(m); scrollToEnd();
    }
    function addThinking() {
      var m = document.createElement('div');
      m.className = 'civ-msg assistant';
      m.innerHTML = '<div class="who">The Civilization Companion</div>' +
        '<div class="body"><span class="civ-thinking" aria-label="Thinking"><span></span><span></span><span></span></span></div>';
      thread.appendChild(m); scrollToEnd();
      return m;
    }

    function fillAnswer(node, res) {
      node.className = 'civ-msg assistant' + (res.grounded === false ? ' civ-ungrounded' : '');
      var flag = res.grounded === false ? '<div class="flag">Not found in the manuscript</div>' : '';
      node.innerHTML = '<div class="who">The Civilization Companion</div>' +
        '<div class="body">' + flag + paragraphs(res.answer) + '</div>' +
        sourcesHTML(res.sources);
      scrollToEnd();
    }

    // Framework Application — BOOK vs APPLICATION, clearly separated.
    function fillApply(node, res) {
      node.className = 'civ-msg assistant civ-apply' + (res.grounded === false ? ' civ-ungrounded' : '');
      var html = '<div class="who">The Civilization Companion</div>';
      html += '<div class="civ-apply-badge">Framework application' +
        '<span>An interpretation using the book\u2019s framework — not the book\u2019s own text.</span></div>';
      if (res.book) {
        html += '<div class="civ-block civ-block-book">' +
          '<div class="blabel">From the book — the framework</div>' +
          '<div class="body">' + paragraphs(res.book) + '</div>' +
          sourcesHTML(res.sources, 'From the book') + '</div>';
      } else if (res.sources && res.sources.length) {
        html += sourcesHTML(res.sources, 'From the book');
      }
      if (res.application) {
        html += '<div class="civ-block civ-block-apply">' +
          '<div class="blabel">Applying the framework to &ldquo;' + esc(res.target) + '&rdquo; — interpretation</div>' +
          '<div class="body">' + paragraphs(res.application) + '</div></div>';
      }
      node.innerHTML = html;
      scrollToEnd();
    }

    function run(promise, render, node) {
      busy = true; send.disabled = true;
      promise.then(function (res) { render(node, res); })
        .catch(function () { fillAnswer(node, { grounded: false, answer: 'Something went wrong. Please try again.', sources: [] }); })
        .then(function () { busy = false; send.disabled = false; input.focus(); });
    }

    function askQ(q) {
      q = (q || '').trim(); if (!q || busy) return;
      addUser(q);
      run(window.civilizationRuntime.ask(q), fillAnswer, addThinking());
    }
    function applyT(target) {
      target = (target || '').trim(); if (!target || busy) return;
      addUser('Apply the framework to: ' + target);
      run(window.civilizationRuntime.applyFramework(target), fillApply, addThinking());
    }
    function submitInput() {
      var v = input.value.trim(); if (!v) return;
      input.value = ''; auto();
      if (mode === 'apply') applyT(v); else askQ(v);
    }

    // ---- panels per mode ----
    function chip(label, onClick, cls) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = cls || 'civ-starter'; b.textContent = label;
      b.addEventListener('click', onClick);
      return b;
    }
    function renderPanel() {
      panel.innerHTML = '';
      if (mode === 'ask') {
        STARTERS.forEach(function (q) { panel.appendChild(chip(q, function () { askQ(q); })); });
      } else if (mode === 'explore') {
        EXPLORE.forEach(function (g) {
          var wrap = document.createElement('div'); wrap.className = 'civ-group';
          var h = document.createElement('div'); h.className = 'civ-group-head'; h.textContent = g.head;
          wrap.appendChild(h);
          var row = document.createElement('div'); row.className = 'civ-group-row';
          g.items.forEach(function (it) { row.appendChild(chip(it.label, function () { askQ(it.q); })); });
          wrap.appendChild(row); panel.appendChild(wrap);
        });
      } else if (mode === 'apply') {
        var note = document.createElement('div'); note.className = 'civ-apply-note';
        note.innerHTML = 'Name a <strong>country, company, institution, technology, or historical period</strong> and the companion will read it across the eight directions — clearly marking what comes from the book and what is interpretation.';
        panel.appendChild(note);
        var row = document.createElement('div'); row.className = 'civ-group-row';
        APPLY_EXAMPLES.forEach(function (t) { row.appendChild(chip(t, function () { applyT(t); })); });
        panel.appendChild(row);
      }
    }

    function setMode(m) {
      mode = m;
      Array.prototype.forEach.call(modes.querySelectorAll('.civ-mode'), function (b) {
        var on = b.getAttribute('data-mode') === m;
        b.classList.toggle('active', on); b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      input.placeholder = (m === 'apply')
        ? 'Name a country, company, institution, technology, or era…'
        : 'Ask a question about Civilization…';
      send.textContent = (m === 'apply') ? 'Apply' : 'Ask';
      renderPanel();
      window.civilizationRuntime.preload();
    }

    // ---- build mode tabs ----
    if (modes) {
      [['ask', 'Ask'], ['explore', 'Explore'], ['apply', 'Apply the framework']].forEach(function (pair) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'civ-mode'; b.setAttribute('role', 'tab');
        b.setAttribute('data-mode', pair[0]); b.textContent = pair[1];
        b.addEventListener('click', function () { setMode(pair[0]); });
        modes.appendChild(b);
      });
    }

    // ---- input behaviour ----
    function auto() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 160) + 'px'; }
    input.addEventListener('input', auto);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitInput(); }
    });
    send.addEventListener('click', submitInput);
    input.addEventListener('focus', function () { window.civilizationRuntime.preload(); }, { once: true });

    setMode('ask');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
