/* Cross-participant private intelligence page inside the unified Studio. */
(function () {
  'use strict';
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  async function api(path, init) {
    var response = await fetch(path, Object.assign({ headers:{ 'Content-Type':'application/json', Accept:'application/json' } }, init || {}));
    var body = await response.json().catch(function(){ return {}; });
    if (response.status === 401) { location.replace('/studio/login'); throw new Error('Studio login required'); }
    if (!response.ok || body.ok === false) throw new Error(body.error || 'Request failed');
    return body.data || {};
  }
  function showPage(name) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-page-view]'), function(page){ page.hidden = page.getAttribute('data-page-view') !== name; });
    Array.prototype.forEach.call(document.querySelectorAll('.studio-nav [data-page]'), function(button){ button.classList.toggle('active', button.getAttribute('data-page') === name); });
    document.body.classList.remove('menu-open');
    window.scrollTo({ top:0, behavior:'smooth' });
  }
  function renderMatches(matches) {
    var target = document.getElementById('courseIntelMatches');
    if (!target) return;
    target.innerHTML = (matches || []).length ? '<h3>Records considered</h3>' + matches.map(function(match){
      return '<a class="intel-match" href="/studio/ai-business-leaders?participant=' + encodeURIComponent(match.id) + '"><strong>' + esc(match.name || 'Participant') + ' · ' + esc(match.company || '') + '</strong><span>' + esc(match.reason || 'Relevant private evidence found') + '</span></a>';
    }).join('') : '<h3>Records considered</h3><p class="empty">No participant records matched this question strongly enough.</p>';
  }
  function renderHistory(messages) {
    var target = document.getElementById('courseIntelHistory');
    if (!target) return;
    var pairs = [];
    var pending = null;
    (messages || []).forEach(function(message){
      if (message.role === 'admin') pending = message;
      if (message.role === 'assistant') { pairs.push({ question:pending && pending.content, answer:message.content, matches:message.matches || [] }); pending = null; }
    });
    target.innerHTML = pairs.length ? '<div class="intel-history"><h3>Earlier questions</h3>' + pairs.slice(-8).reverse().map(function(pair){
      return '<details><summary>' + esc(pair.question || 'Course intelligence question') + '</summary><pre>' + esc(pair.answer || '') + '</pre></details>';
    }).join('') + '</div>' : '';
  }
  function addPage() {
    var main = document.querySelector('.studio-main');
    if (!main || document.querySelector('[data-page-view="course-intelligence"]')) return;
    var section = document.createElement('section');
    section.className = 'studio-page intel-page';
    section.setAttribute('data-page-view','course-intelligence');
    section.hidden = true;
    section.innerHTML = '<div class="intel-page-head"><div><small>Private cross-participant analysis</small><h1>Course Intelligence</h1></div><p>Ask across participant profiles, company research, meeting notes, uploaded references, conversations and course outputs. The agent separates confirmed evidence from likely commercial interest.</p></div>' +
      '<div class="panel"><div class="intel-toolbar"><div class="field"><label>Scope</label><select id="courseIntelCohort"><option value="">All cohorts</option></select></div><div><textarea id="courseIntelQuestion" placeholder="For example: How many participants in Gurugram may need recruitment help, and what evidence supports that?"></textarea><div class="intel-suggestions"><button class="intel-suggestion" type="button">Which Gurugram participants may need recruitment help?</button><button class="intel-suggestion" type="button">Who has a recurring hiring or talent problem?</button><button class="intel-suggestion" type="button">Which companies have wedding, event or hospitality businesses?</button></div><div class="intel-actions"><button class="btn accent" id="courseIntelAsk" type="button">Ask Course Intelligence</button><span class="form-status" id="courseIntelStatus"></span></div></div></div></div>' +
      '<div class="intel-results"><div><div class="intel-answer" id="courseIntelAnswer">Ask a question to analyse the private participant directory.</div><div id="courseIntelHistory"></div></div><aside class="intel-matches" id="courseIntelMatches"><h3>Records considered</h3><p class="empty">Matches will appear here with direct links to the underlying participant profile.</p></aside></div>';
    main.appendChild(section);
  }
  function addNavigation() {
    var nav = document.querySelector('.studio-nav');
    if (!nav || nav.querySelector('[data-page="course-intelligence"]')) return;
    var prep = nav.querySelector('[data-page="preparation"]');
    var button = document.createElement('button');
    button.setAttribute('data-page','course-intelligence');
    button.innerHTML = '<b>AI</b>Course Intelligence';
    button.onclick = function(){ showPage('course-intelligence'); loadThread(); };
    if (prep) prep.insertAdjacentElement('afterend',button); else nav.appendChild(button);
  }
  function addHomeCard() {
    var quick = document.querySelector('.quick-grid');
    if (!quick || quick.querySelector('[data-page="course-intelligence"]')) return;
    var card = document.createElement('button');
    card.className = 'quick-card'; card.setAttribute('data-page','course-intelligence');
    card.innerHTML = '<b>AI</b><strong>Course Intelligence</strong><span>Ask across every participant, cohort and private evidence stream.</span>';
    card.onclick = function(){ showPage('course-intelligence'); loadThread(); };
    quick.appendChild(card);
  }
  async function loadCohorts() {
    try {
      var dashboard = await api('/api/abl/workspace/admin/dashboard');
      var select = document.getElementById('courseIntelCohort');
      (dashboard.cohorts || []).forEach(function(cohort){
        var option = document.createElement('option'); option.value = cohort.id; option.textContent = cohort.name; select.appendChild(option);
      });
    } catch (error) { console.error('[course-intelligence cohorts]', error); }
  }
  async function loadThread() {
    try {
      var thread = await api('/api/abl/intelligence/cohort/thread');
      renderHistory(thread.messages || []);
      var last = (thread.messages || []).filter(function(message){ return message.role === 'assistant'; }).slice(-1)[0];
      if (last && document.getElementById('courseIntelAnswer').textContent.indexOf('Ask a question') === 0) {
        document.getElementById('courseIntelAnswer').textContent = last.content;
        renderMatches(last.matches || []);
      }
    } catch (error) { console.error('[course-intelligence thread]', error); }
  }
  function wire() {
    var ask = document.getElementById('courseIntelAsk');
    var question = document.getElementById('courseIntelQuestion');
    var status = document.getElementById('courseIntelStatus');
    Array.prototype.forEach.call(document.querySelectorAll('[data-page-view="course-intelligence"] .intel-suggestion'), function(button){ button.onclick = function(){ question.value = button.textContent; question.focus(); }; });
    ask.onclick = async function(){
      var value = question.value.trim();
      if (!value) { status.textContent = 'Ask a question first.'; return; }
      ask.disabled = true; ask.textContent = 'Analysing…'; status.textContent = 'Selecting relevant records, then checking their underlying evidence…';
      try {
        var result = await api('/api/abl/intelligence/cohort/ask', { method:'POST', body:JSON.stringify({ question:value, cohort_id:document.getElementById('courseIntelCohort').value || null }) });
        document.getElementById('courseIntelAnswer').textContent = result.answer || 'No answer returned.';
        renderMatches(result.matches || []); renderHistory(result.messages || []); question.value = '';
        status.textContent = 'Analysis complete. Review the evidence classification before acting.';
      } catch (error) { status.textContent = error.message || 'Could not complete the analysis.'; }
      ask.disabled = false; ask.textContent = 'Ask Course Intelligence';
    };
    question.addEventListener('keydown',function(event){ if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') ask.click(); });
  }
  function init() {
    addPage(); addNavigation(); addHomeCard(); wire(); loadCohorts();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(init,0); });
  else setTimeout(init,0);
})();
