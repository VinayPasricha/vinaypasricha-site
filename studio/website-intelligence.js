(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var state = {
    mode: 'since-last', start: '', end: '', data: null, filters: [],
    initialSince: null, checkinSent: false, focus: '', loading: false
  };
  var COLORS = ['#246bfd','#00a7bd','#7557e8','#ef8b22','#169b62','#d64545','#d89a17','#60708e'];

  function esc(v) {
    return String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }
  function num(v) { return (Number(v) || 0).toLocaleString('en-IN'); }
  function duration(seconds) {
    var s = Math.max(0, Math.round(Number(seconds) || 0));
    if (s < 60) return s + ' sec';
    var m = Math.floor(s / 60), r = s % 60;
    if (m < 60) return m + ' min' + (r ? ' ' + r + ' sec' : '');
    var h = Math.floor(m / 60), mm = m % 60;
    return h + ' hr' + (h !== 1 ? 's' : '') + (mm ? ' ' + mm + ' min' : '');
  }
  function dateLabel(day) {
    var d = new Date(day + 'T12:00:00+05:30');
    return isNaN(d) ? day : d.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
  }
  function today() {
    try { return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }
    catch (e) { return new Date().toISOString().slice(0,10); }
  }
  function toast(message) {
    var el = $('toast'); el.textContent = message; el.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(function(){ el.classList.remove('show'); }, 2200);
  }
  async function api(path, options) {
    var init = Object.assign({}, options || {});
    init.headers = Object.assign({ Accept:'application/json' }, init.headers || {});
    if (init.body && !init.headers['Content-Type']) init.headers['Content-Type'] = 'application/json';
    var res = await fetch(path, init), body = {};
    try { body = await res.json(); } catch (e) {}
    return { ok: res.ok && body.ok !== false, status: res.status, data: body };
  }
  function rangeQuery(extra) {
    var q = new URLSearchParams();
    if (state.mode === 'since-last' && state.initialSince) {
      q.set('mode','custom'); q.set('start',state.initialSince.start); q.set('end',state.initialSince.end);
    } else {
      q.set('mode',state.mode);
      if (state.start) q.set('start',state.start);
      if (state.end) q.set('end',state.end);
    }
    Object.keys(extra || {}).forEach(function(k){ q.set(k, extra[k]); });
    return q.toString();
  }

  async function boot() {
    wire();
    await load();
  }
  function wire() {
    Array.prototype.forEach.call(document.querySelectorAll('#periods button'), function (button) {
      button.addEventListener('click', function () {
        var mode = button.getAttribute('data-mode');
        if (mode === 'custom') { openCustom(); return; }
        selectPeriod(mode); load();
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('.wi-card'), function(card){
      card.addEventListener('click', function(){ openSecondary(card.getAttribute('data-focus')); });
    });
    $('closeSecondary').onclick = function(){ $('secondary').hidden = true; state.focus = ''; };
    $('drillClose').onclick = function(){ $('drillDialog').close(); };
    $('customForm').addEventListener('submit', function(event){
      event.preventDefault();
      var start = $('customStart').value, end = $('customEnd').value;
      if (!start || !end) return;
      state.mode = 'custom'; state.start = start; state.end = end;
      setPeriodButtons('custom'); $('customDialog').close(); load();
    });
  }
  function selectPeriod(mode) {
    state.mode = mode; state.start = ''; state.end = '';
    setPeriodButtons(mode);
  }
  function setPeriodButtons(mode) {
    Array.prototype.forEach.call(document.querySelectorAll('#periods button'), function(b){ b.classList.toggle('on', b.getAttribute('data-mode') === mode); });
  }
  function openCustom() {
    $('customStart').value = state.start || today().slice(0,8) + '01';
    $('customEnd').value = state.end || today();
    $('customDialog').showModal();
  }
  function showLogin() {
    $('main').hidden = true; $('login').hidden = false;
    $('loginBtn').onclick = async function(){
      var result = await api('/api/studio/login',{method:'POST',body:JSON.stringify({password:$('pw').value})});
      if (result.ok) { $('loginErr').hidden = true; $('login').hidden = true; await load(); }
      else $('loginErr').hidden = false;
    };
    $('pw').onkeydown = function(e){ if(e.key === 'Enter') $('loginBtn').click(); };
  }

  async function load() {
    if (state.loading) return;
    state.loading = true;
    try {
      var result = await api('/api/analytics/intelligence?' + rangeQuery());
      if (result.status === 401 || result.status === 503) { showLogin(); return; }
      if (!result.ok) throw new Error(result.data.detail || 'Website intelligence could not load.');
      state.data = result.data;
      if (state.mode === 'since-last' && !state.initialSince) {
        state.initialSince = { start: result.data.range.start, end: result.data.range.end };
      }
      $('main').hidden = false; $('login').hidden = true;
      render();
      loadActions();
      if (!state.checkinSent) {
        state.checkinSent = true;
        setTimeout(function(){ api('/api/analytics/intelligence/checkin',{method:'POST',body:'{}'}); }, 1800);
      }
    } catch (err) {
      $('main').hidden = false;
      $('briefText').textContent = err.message;
      toast(err.message);
    } finally { state.loading = false; }
  }

  function render() {
    var d = state.data, h = d.headline || {}, b = d.brief || {}, c = d.comparison || {};
    $('rangeLabel').textContent = dateLabel(d.range.start) + ' → ' + dateLabel(d.range.end) + ' · ' + d.range.days + ' day' + (d.range.days === 1 ? '' : 's');
    $('briefText').textContent = num(b.visitors) + ' real visitors came to the website. They made ' + num(b.visits) + ' visits, read ' + num(b.pages) + ' pages, spent ' + (b.hours || 0) + ' hours on the site, had ' + num(b.conversations) + ' AI conversations, clicked ' + num(b.buyClicks) + ' book-buying links and submitted ' + num(b.enquiries) + ' enquiries.';
    $('realVisitors').textContent = num(h.realVisitors);
    $('realVisitorsDelta').textContent = deltaText(c.realVisitors, 'versus the previous period');
    $('topSource').textContent = d.sources && d.sources[0] ? d.sources[0].key : 'No source yet';
    $('sourceSub').textContent = d.sources && d.sources[0] ? num(d.sources[0].visitors) + ' visitors · ' + num(d.sources.length) + ' sources' : 'Top source';
    $('avgTime').textContent = duration(h.avgSeconds);
    $('timeSub').textContent = h.avgResultSeconds ? 'Results usually take ' + duration(h.avgResultSeconds) : 'Average per visit';
    $('pagesRead').textContent = num(h.pagesRead);
    $('pagesSub').textContent = (h.avgPages || 0) + ' pages per visit';
    $('usefulOutcomes').textContent = num(h.usefulOutcomes);
    $('outcomeSub').textContent = deltaText(c.usefulOutcomes, 'versus the previous period');
    renderTrend(d.dates || [], d);
    renderJourney(d);
    renderInsights(d.insights || []);
    renderTechnical(d);
    if (state.focus) openSecondary(state.focus, true);
  }
  function deltaText(item, fallback) {
    if (!item) return fallback;
    var p = Number(item.changePct) || 0;
    if (!p) return 'No change ' + fallback;
    return (p > 0 ? '↑ ' : '↓ ') + Math.abs(p) + '% ' + fallback;
  }

  function renderTrend(rows, data) {
    var el = $('trendChart');
    if (!rows.length) { el.innerHTML = '<div class="wi-empty">No external visits were recorded in this period.</div>'; return; }
    var W=900,H=300,L=42,R=18,T=22,B=38;
    var max = Math.max.apply(null, rows.map(function(r){return r.count;} ).concat([1]));
    var outcomeByDate = {};
    rows.forEach(function(r){ outcomeByDate[r.key] = 0; });
    var totalOutcomes = Number(data.headline.usefulOutcomes)||0;
    if (rows.length) outcomeByDate[rows[rows.length-1].key] = totalOutcomes;
    var maxOutcome = Math.max(totalOutcomes,1);
    function x(i){return L+(rows.length===1?(W-L-R)/2:i*(W-L-R)/(rows.length-1));}
    function y(v){return T+(H-T-B)-(v/max)*(H-T-B);}
    function yo(v){return T+(H-T-B)-(v/maxOutcome)*(H-T-B);}
    var pts=rows.map(function(r,i){return x(i).toFixed(1)+','+y(r.count).toFixed(1);}).join(' ');
    var op=rows.map(function(r,i){return x(i).toFixed(1)+','+yo(outcomeByDate[r.key]||0).toFixed(1);}).join(' ');
    var grid=''; [0,.5,1].forEach(function(f){var gy=T+(H-T-B)*(1-f);grid+='<line class="wi-chart-grid" x1="'+L+'" y1="'+gy+'" x2="'+(W-R)+'" y2="'+gy+'"/><text class="wi-chart-label" x="'+(L-8)+'" y="'+(gy+3)+'" text-anchor="end">'+Math.round(max*f)+'</text>';});
    var labels=''; var idx=[0,Math.floor((rows.length-1)/2),rows.length-1]; var seen={}; idx.forEach(function(i){if(i<0||seen[i])return;seen[i]=1;labels+='<text class="wi-chart-label" x="'+x(i)+'" y="'+(H-8)+'" text-anchor="middle">'+esc(shortDate(rows[i].key))+'</text>';});
    var dots=rows.map(function(r,i){return '<circle class="wi-chart-dot" data-date="'+esc(r.key)+'" cx="'+x(i)+'" cy="'+y(r.count)+'" r="5"><title>'+esc(dateLabel(r.key)+': '+r.count+' visits')+'</title></circle>';}).join('');
    el.innerHTML='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none"><defs><linearGradient id="wiArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#246bfd" stop-opacity=".24"/><stop offset="1" stop-color="#246bfd" stop-opacity="0"/></linearGradient></defs>'+grid+'<polygon class="wi-chart-area" points="'+x(0)+','+(H-B)+' '+pts+' '+x(rows.length-1)+','+(H-B)+'"/><polyline class="wi-chart-path" points="'+pts+'"/><polyline class="wi-chart-outcomes" points="'+op+'"/>'+dots+labels+'</svg>';
    Array.prototype.forEach.call(el.querySelectorAll('[data-date]'),function(dot){dot.onclick=function(){openDrill([{field:'date',value:dot.getAttribute('data-date'),label:dateLabel(dot.getAttribute('data-date'))}]);};});
  }
  function shortDate(day){var d=new Date(day+'T12:00:00+05:30');return isNaN(d)?day:d.toLocaleDateString('en-IN',{day:'numeric',month:'short'});}
  function renderJourney(d) {
    var h=d.headline||{}, outcomes=(d.outcomes||[]).reduce(function(n,o){return n+(Number(o.count)||0);},0);
    var engaged=(d.timeBands||[]).filter(function(x){return ['Interested','Highly engaged','Deep engagement'].indexOf(x.key)>=0;}).reduce(function(n,x){return n+(Number(x.count)||0);},0);
    var readers=(d.pages||[]).reduce(function(n,x){return n+(Number(x.count)||0);},0);
    var rows=[{label:'Real visitors',value:h.realVisitors},{label:'Engaged visits',value:engaged},{label:'Post-landing page reads',value:readers},{label:'Useful outcomes',value:outcomes}];
    $('journeyChart').innerHTML=rows.map(function(r){return '<button class="wi-journey-step" data-step="'+esc(r.label)+'"><strong>'+num(r.value)+'</strong><span>'+esc(r.label)+'</span></button>';}).join('');
    Array.prototype.forEach.call($('journeyChart').querySelectorAll('.wi-journey-step'),function(btn){btn.onclick=function(){openDrill([]);};});
  }
  function renderInsights(rows) {
    if (!rows.length) rows=[{tone:'opportunity',title:'The system is ready',text:'As external traffic accumulates, the three most important changes will appear here automatically.'}];
    $('insightCards').innerHTML=rows.map(function(r){return '<article class="wi-insight '+esc(r.tone||'')+'"><strong>'+esc(r.title)+'</strong><p>'+esc(r.text)+'</p></article>';}).join('');
  }
  function renderTechnical(d) {
    var h=d.headline||{};
    var rows=[['Visits',h.visits],['Internal/test excluded',h.internalExcluded],['Total time',duration(h.totalSeconds)],['Sources', (d.sources||[]).length]];
    $('technicalSummary').innerHTML=rows.map(function(r){return '<div class="wi-tech-card"><strong>'+esc(r[1])+'</strong><span>'+esc(r[0])+'</span></div>';}).join('');
  }

  function openSecondary(focus, preserveScroll) {
    state.focus = focus;
    var d=state.data;
    if(!d) return;
    var titles={visitors:'Real visitors',sources:'Where they came from',time:'Time spent',pages:'Pages read',outcomes:'Useful outcomes'};
    $('secondaryTitle').textContent=titles[focus]||'Detail';
    var html='';
    if(focus==='visitors'){
      html=subpanel('Where they came from','Click any source to open dates, pages and visitors.',barList(d.sources||[],'source'))+
        subpanel('How long they stayed','Click a band to see its sources, pages and outcomes.',timeBands(d.timeBands||[]))+
        subpanel('What they read','Top pages after the landing page.',barList((d.pages||[]).slice(0,5),'page'))+
        subpanel('What useful result happened','Confirmed results, strong intent and meaningful engagement.',outcomeList(d.outcomes||[]));
    } else if(focus==='sources') {
      html=subpanel('Source performance','Visitors · average time · pages · outcomes',barList(d.sources||[],'source',true))+
        subpanel('Dates visitors arrived','Click a date to see the exact sessions.',barList(d.dates||[],'date'));
    } else if(focus==='time') {
      html=subpanel('Attention bands','The labels stay simple; exact minutes are retained underneath.',timeBands(d.timeBands||[]))+
        subpanel('Time needed for a result','Average engaged time among visits that produced an outcome.','<div class="wi-empty"><strong style="font-size:32px;color:var(--wi-green)">'+duration(d.headline.avgResultSeconds)+'</strong><br>Click an outcome to see its exact time distribution.</div>')+
        subpanel('Outcomes by type','See which results require the most attention.',outcomeList(d.outcomes||[]));
    } else if(focus==='pages') {
      html=subpanel('Most-read pages','Landing pages are excluded from this ranking.',barList((d.pages||[]).slice(0,5),'page'))+
        subpanel('All page evidence','Continue into source, date, previous page, next page and visitor records.','<button class="wi-btn primary" data-open-all="pages">Open every recorded page →</button>');
    } else if(focus==='outcomes') {
      html=subpanel('Outcome types','Each result is labelled by confidence.',outcomeList(d.outcomes||[]))+
        subpanel('Result journey','Follow any outcome back to its source, page, visitor, session and exact event.','<button class="wi-btn primary" data-open-all="outcomes">Open all outcome evidence →</button>');
    }
    $('secondaryGrid').innerHTML=html;
    $('secondary').hidden=false;
    wireSecondary();
    if(!preserveScroll) $('secondary').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function subpanel(title,desc,body){return '<article class="wi-subpanel"><h3>'+esc(title)+'</h3><p>'+esc(desc)+'</p>'+body+'</article>';}
  function barList(items,field,quality) {
    if(!items.length)return '<div class="wi-empty">No data yet.</div>';
    var max=Math.max.apply(null,items.map(function(x){return Number(x.visitors!=null?x.visitors:x.count)||0;}).concat([1]));
    return '<div class="wi-bar-list">'+items.map(function(item,i){
      var value=Number(item.visitors!=null?item.visitors:item.count)||0;
      var label=item.label||item.key;
      var meta=quality?'<div class="wi-bar-meta">'+duration(item.avgSeconds)+' average · '+num(item.pages)+' pages · '+num(item.outcomes)+' outcomes</div>':'';
      return '<button class="wi-bar" data-field="'+esc(field)+'" data-value="'+esc(item.key)+'" data-label="'+esc(label)+'"><span class="wi-bar-label">'+esc(label)+'</span><span class="wi-bar-track"><span class="wi-bar-fill" style="width:'+Math.max(2,Math.round(value/max*100))+'%;background:'+COLORS[i%COLORS.length]+'"></span></span><strong class="wi-bar-value">'+num(value)+'</strong>'+meta+'</button>';
    }).join('')+'</div>';
  }
  function timeBands(items){return '<div class="wi-time-bands">'+items.map(function(item){return '<button class="wi-time-band" data-field="timeBand" data-value="'+esc(item.key)+'" data-label="'+esc(item.key)+'"><strong>'+num(item.count)+'</strong><span>'+esc(item.key)+'</span></button>';}).join('')+'</div>';}
  function outcomeList(items){return '<div class="wi-outcome-list">'+items.map(function(item){return '<button class="wi-outcome" data-field="outcome" data-value="'+esc(item.key)+'" data-label="'+esc(item.key)+'"><strong>'+num(item.count)+'</strong><span>'+esc(item.key)+'</span><small>'+esc(item.level||'')+'</small></button>';}).join('')+'</div>';}
  function wireSecondary(){
    Array.prototype.forEach.call($('secondaryGrid').querySelectorAll('[data-field]'),function(el){el.onclick=function(){openDrill([{field:el.getAttribute('data-field'),value:el.getAttribute('data-value'),label:el.getAttribute('data-label')}]);};});
    Array.prototype.forEach.call($('secondaryGrid').querySelectorAll('[data-open-all]'),function(el){el.onclick=function(){openDrill([]);};});
  }

  async function openDrill(filters) {
    state.filters = filters || [];
    $('drillDialog').showModal();
    await loadDrill();
  }
  async function loadDrill() {
    $('drillTitle').textContent='Loading the evidence…';
    $('drillCharts').innerHTML='<div class="wi-empty">Building the next visual layer…</div>';
    var result=await api('/api/analytics/intelligence/drill?'+rangeQuery({filters:JSON.stringify(state.filters)}));
    if(!result.ok){toast(result.data.detail||'Drill-down could not load.');return;}
    renderDrill(result.data);
  }
  function renderDrill(d) {
    renderBreadcrumbs();
    $('drillTitle').textContent=state.filters.length?state.filters[state.filters.length-1].label:'All website evidence';
    var h=d.headline||{};
    $('drillSummary').innerHTML=[['Visitors',h.visitors],['Visits',h.sessions],['Pages',h.pages],['Time',duration(h.seconds)],['Outcomes',h.outcomes]].map(function(r){return '<div class="wi-mini-card"><strong>'+esc(r[1])+'</strong><span>'+esc(r[0])+'</span></div>';}).join('');
    var used={}; state.filters.forEach(function(f){used[f.field]=true;});
    var charts='';
    if(!used.source) charts+=subpanel('Sources','Click a source to go one level deeper.',barList(d.sources||[],'source'));
    if(!used.date) charts+=subpanel('Dates','Click a date to isolate the visits that arrived then.',barList(d.dates||[],'date'));
    if(!used.timeBand) charts+=subpanel('Time spent','Click an attention band.',timeBands(d.timeBands||[]));
    if(!used.page) charts+=subpanel('Pages','Click a page to see exactly who read it.',barList(d.pages||[],'page'));
    if(!used.outcome) charts+=subpanel('Useful outcomes','Trace any result back to the exact visitor action.',outcomeList((d.outcomes||[]).map(function(o){return {key:o.key,count:o.count,level:''};})));
    $('drillCharts').innerHTML=charts||'<div class="wi-empty">You have reached the individual record layer.</div>';
    Array.prototype.forEach.call($('drillCharts').querySelectorAll('[data-field]'),function(el){el.onclick=function(){state.filters.push({field:el.getAttribute('data-field'),value:el.getAttribute('data-value'),label:el.getAttribute('data-label')});loadDrill();};});
    renderRecords(d);
  }
  function renderBreadcrumbs() {
    var html='<button class="wi-crumb" data-cut="0">All website evidence</button>';
    state.filters.forEach(function(f,i){html+='<button class="wi-crumb" data-cut="'+(i+1)+'">'+esc(f.label)+'</button>';});
    $('breadcrumbs').innerHTML=html;
    Array.prototype.forEach.call($('breadcrumbs').querySelectorAll('[data-cut]'),function(b){b.onclick=function(){state.filters=state.filters.slice(0,Number(b.getAttribute('data-cut')));loadDrill();};});
  }
  function renderRecords(d) {
    if(d.events && d.events.length){
      $('recordTitle').textContent='Timestamped events — the smallest recorded units';
      $('recordList').innerHTML=d.events.map(function(e){var time=e.at?new Date(e.at).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}):e.day;var detail=e.type==='duration'?duration(e.engaged||e.seconds):((e.name||e.page||e.path));return '<div class="wi-event"><time>'+esc(time)+'</time><span class="wi-event-type">'+esc(e.type)+'</span><span>'+esc(detail)+'</span></div>';}).join('');
      return;
    }
    $('recordTitle').textContent='Visitor sessions';
    var rows=d.sessions||[];
    if(!rows.length){$('recordList').innerHTML='<div class="wi-empty">No sessions match this exact path through the data.</div>';return;}
    $('recordList').innerHTML=rows.map(function(s){
      var id=s.name||s.email||('Anonymous '+String(s.visitorId||s.id).slice(-6));
      var pages=(s.pages||[]).map(function(p){return p.label;}).slice(0,4).join(' → ');
      var outcome=s.outcomes&&s.outcomes.length?' · '+s.outcomes.join(', '):'';
      return '<button class="wi-session" data-session="'+esc(s.id)+'" data-label="'+esc(id)+'"><span class="wi-session-source">'+esc(s.source)+'</span><span class="wi-session-main"><strong>'+esc(id)+'</strong><small>'+esc(dateLabel(s.date)+' · '+pages+outcome)+'</small></span><span class="wi-session-metrics">'+duration(s.seconds)+' · '+num(s.pageCount)+' pages</span></button>';
    }).join('');
    Array.prototype.forEach.call($('recordList').querySelectorAll('[data-session]'),function(btn){btn.onclick=function(){state.filters.push({field:'session',value:btn.getAttribute('data-session'),label:btn.getAttribute('data-label')});loadDrill();};});
  }

  async function loadActions() {
    var result=await api('/api/growth/command?days=30');
    if(!result.ok){$('actionCards').innerHTML='<div class="wi-empty">Today’s actions will appear when the growth task service is available.</div>';return;}
    var tasks=result.data.tasks||[];
    $('actionCards').innerHTML=tasks.length?tasks.map(function(t){return '<article class="wi-action '+esc(t.owner)+'"><div class="wi-action-owner"><strong>'+esc(t.ownerName)+'</strong><span class="wi-status">'+esc(String(t.status||'assigned').replace(/_/g,' '))+'</span></div><h3>'+esc(t.title)+'</h3><p>'+esc(t.why)+'</p><ol>'+((t.instructions||[]).slice(0,3).map(function(x){return '<li>'+esc(x)+'</li>';}).join(''))+'</ol><div class="wi-action-tools"><button class="wi-btn quiet" data-copy="'+esc(t.id)+'">Copy task</button></div></article>';}).join(''):'<div class="wi-empty">No tasks were generated today.</div>';
    Array.prototype.forEach.call($('actionCards').querySelectorAll('[data-copy]'),function(btn){btn.onclick=function(){var t=tasks.find(function(x){return x.id===btn.getAttribute('data-copy');});if(!t)return;var text=t.ownerName+' — '+t.title+'\n\n'+t.why+'\n\n'+(t.instructions||[]).map(function(x,i){return (i+1)+'. '+x;}).join('\n');navigator.clipboard.writeText(text).then(function(){toast('Task copied.');});};});
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
