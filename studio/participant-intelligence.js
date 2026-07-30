/* Private research conversation on each participant profile in Vinay Studio. */
(function () {
  'use strict';
  var params = new URLSearchParams(location.search);
  var participantId = params.get('participant');
  if (!participantId) return;

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function textHtml(value) {
    return esc(value).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
  }
  async function api(path, init) {
    var response = await fetch(path, Object.assign({ headers: { 'Content-Type':'application/json', Accept:'application/json' } }, init || {}));
    var body = await response.json().catch(function(){ return {}; });
    if (response.status === 401) { location.replace('/studio/login'); throw new Error('Studio login required'); }
    if (!response.ok || body.ok === false) throw new Error(body.error || 'Request failed');
    return body.data || {};
  }
  function sourceMarkup(sources) {
    var valid = (sources || []).filter(function(s){ return /^https?:\/\//i.test(String(s.uri || '')); });
    if (!valid.length) return '';
    return '<div class="intel-sources">' + valid.map(function(s, index){
      return '<a href="' + esc(s.uri) + '" target="_blank" rel="noopener">' + esc(s.title || ('Source ' + (index + 1))) + ' ↗</a>';
    }).join('') + '</div>';
  }
  function renderMessages(messages) {
    var chat = document.getElementById('participantIntelChat');
    if (!chat) return;
    chat.innerHTML = (messages || []).length ? messages.map(function(message){
      var role = message.role === 'assistant' ? 'assistant' : 'admin';
      return '<div class="intel-msg ' + role + '"><span class="intel-meta">' + (role === 'assistant' ? 'Research agent' : 'Vinay') + '</span>' +
        textHtml(message.content) + sourceMarkup(message.sources) + '</div>';
    }).join('') : '<div class="intel-empty">Ask a question about this participant, their company, related businesses, public financials, AI activity or anything already captured in meetings and course evidence.</div>';
    chat.scrollTop = chat.scrollHeight;
  }
  function cardMarkup(name, company) {
    return '<div class="intel-card" id="participantIntelCard"><div class="intel-head"><div><div class="intel-kicker">Private research agent</div>' +
      '<h3>Ask AI about ' + esc(name || 'this participant') + '</h3><p>Combines this private course record with optional fresh public research about ' + esc(company || 'the company') + '.</p></div></div>' +
      '<div class="intel-suggestions"><button class="intel-suggestion" type="button">What other companies or brands are connected to them?</button>' +
      '<button class="intel-suggestion" type="button">What is publicly known about ancillary-business turnover?</button>' +
      '<button class="intel-suggestion" type="button">Where could GoodSpace be commercially relevant?</button></div>' +
      '<div class="intel-chat" id="participantIntelChat"></div>' +
      '<div class="intel-form"><textarea id="participantIntelQuestion" placeholder="Ask a follow-up question about this person or company…"></textarea>' +
      '<div class="intel-controls"><label><input type="checkbox" id="participantIntelWeb" checked> Use fresh public web research</label>' +
      '<label><input type="checkbox" id="participantIntelSave" checked> Save grounded findings to this dossier</label>' +
      '<button class="btn accent" type="button" id="participantIntelAsk">Ask research agent</button></div>' +
      '<div class="intel-status" id="participantIntelStatus"></div></div></div>';
  }
  async function install(snapshot) {
    if (!snapshot || document.getElementById('participantIntelCard')) return;
    var detail = await api('/api/abl/participants/' + encodeURIComponent(participantId));
    var participant = detail.participant || {};
    snapshot.insertAdjacentHTML('afterend', cardMarkup(participant.name, participant.company_name));
    var thread = await api('/api/abl/intelligence/participants/' + encodeURIComponent(participantId) + '/thread');
    renderMessages(thread.messages || []);
    var question = document.getElementById('participantIntelQuestion');
    var status = document.getElementById('participantIntelStatus');
    var ask = document.getElementById('participantIntelAsk');
    Array.prototype.forEach.call(document.querySelectorAll('#participantIntelCard .intel-suggestion'), function(button){
      button.onclick = function(){ question.value = button.textContent; question.focus(); };
    });
    ask.onclick = async function(){
      var value = question.value.trim();
      if (!value) { status.textContent = 'Ask a question first.'; return; }
      ask.disabled = true; ask.textContent = 'Researching…'; status.textContent = 'Reading the private record and checking public sources…';
      try {
        var result = await api('/api/abl/intelligence/participants/' + encodeURIComponent(participantId) + '/ask', {
          method:'POST', body:JSON.stringify({ question:value, use_web:document.getElementById('participantIntelWeb').checked, save_to_dossier:document.getElementById('participantIntelSave').checked })
        });
        renderMessages(result.messages || []);
        question.value = '';
        status.textContent = result.saved_to_dossier ? 'Answered and saved to the participant dossier.' : (result.grounded ? 'Answered from the private record and grounded public sources.' : 'Answered from available evidence; live grounding was unavailable or not requested.');
      } catch (error) { status.textContent = error.message || 'Could not answer that question.'; }
      ask.disabled = false; ask.textContent = 'Ask research agent';
    };
    question.addEventListener('keydown', function(event){ if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') ask.click(); });
  }
  var observer = new MutationObserver(function(){
    var snapshot = document.querySelector('.snapshot-card');
    if (snapshot) install(snapshot).catch(function(error){ console.error('[participant-intelligence]', error); });
  });
  observer.observe(document.documentElement, { childList:true, subtree:true });
  var initial = document.querySelector('.snapshot-card');
  if (initial) install(initial).catch(function(error){ console.error('[participant-intelligence]', error); });
})();
