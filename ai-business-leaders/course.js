/* AI for Business Leaders — cumulative Initiative Builder.
   Optional, autosaved, and deliberately free of hard completion gates. */
(function () {
  'use strict';
  var app = document.getElementById('app');
  var parts = location.pathname.split('/').filter(Boolean);
  var SLUG = decodeURIComponent(parts[parts.length - 1] || '');
  var S = { participant:null, builder:null, current:1, saving:false, savePromise:null, pendingSave:false, timer:null, charter:null };

  var SESSION_META = [
    null,
    { title:'Beyond Personal Productivity', move:'See the difference', question:'Which recurring workflow may be stuck at personal productivity?', win:'You have named a candidate workflow.' },
    { title:'Find the Leverage', move:'Choose the problem', question:'Is this the right first problem—and should AI act now or wait?', win:'You have a provisional Leverage Case.' },
    { title:'Redesign the Work', move:'Design the workflow', question:'How will the workflow remember, reason, act and learn?', win:'You have mapped the future workflow.' },
    { title:'Redesign for Reality', move:'De-risk the pilot', question:'Can real users operate this safely, usefully and repeatedly?', win:'You have defined the pilot boundary and controls.' },
    { title:'Defend and Commit', move:'Commit', question:'Can the initiative survive skeptical challenge and produce a dated decision?', win:'You have a peer-tested leadership initiative.' }
  ];
  var FIELDS = {
    1: [
      f('candidate_workflow','Candidate recurring workflow','Name one recurring workflow—not a department, theme or tool.'),
      f('people_systems','People and systems involved','Who participates today, and where does the work currently live?'),
      f('where_work_breaks','Where the work breaks','What gets forgotten, delayed, misunderstood, repeated or left without follow-through?'),
      f('business_consequence','Business consequence','What does this cost in revenue, cash, time, error, risk, customer experience or management attention?'),
      f('current_ai_use','Current AI use','Is anyone already using AI personally inside this work? If yes, how?'),
      f('company_brain_hypothesis','First Company Brain hypothesis','Which appears weakest: Memory, Reasoning, Action or Feedback? Why?')
    ],
    2: [
      f('problem_sentence','Problem in one sentence','In [workflow], we repeatedly experience [specific failure], causing [business consequence].'),
      f('recurrence','Recurrence','How often does it happen? What recent example proves it is real?'),
      checks('value_bucket','Value bucket',['Revenue or conversion','Cost or released capacity','Cash or working capital','Risk, error or compliance','Speed or cycle time','Customer or employee experience']),
      f('baseline','Baseline today','What is the current number, time, rate or observable condition? If unknown, how will Days 1–15 establish it?'),
      matrix('pilot_tests','Four pilot tests',['Painful','Measurable','Data-rich','Contained / winnable']),
      f('strategic_value','Strategic-value tie-breaker','What reusable memory, workflow, trust or learning capability might remain after the pilot?'),
      f('available_data','Available data','Which sources exist, who owns them, and what quality or permission problem must be resolved?'),
      f('non_ai_alternative','Simplest non-AI alternative','Could clearer ownership, a checklist, system rule or process correction solve this adequately?'),
      f('owner_human_line','Owner and human line','Who owns the outcome? What may AI do, what must a human approve, and what should not be automated?'),
      select('decision','Decision',['','Proceed','Investigate before deciding','Wait']),
      f('evidence_needed','Evidence needed next','What one piece of evidence would most strengthen the case—or justify stopping it?')
    ],
    3: [
      f('current_steps','Current workflow','Write the real current process in 5–7 numbered steps. Mark each H, S or AI and include what breaks.',6),
      f('exception_path','Messy exception path','What happens when the standard process fails or the answer lives in someone’s head or chat?'),
      f('memory','Memory','What minimum information must be captured, from which approved sources, by whom, and how is it reused?'),
      f('reasoning','Reasoning','What pattern or recommendation is needed? What evidence and assumptions matter? Which judgment remains human?'),
      f('action','Action','What trigger starts the workflow? Who acts? Where is the system of record? What happens when the normal path fails?'),
      f('feedback','Feedback','What outcome returns? What rule, threshold, template or process may change before the next cycle?'),
      group('boundaries','Automate / Assist / Escalate',[
        ['automate','Automate — low-risk, repetitive, reversible'],
        ['assist','Assist — AI prepares; named human approves'],
        ['escalate','Escalate — high-stakes; human or leadership decides']
      ]),
      f('build_buy_partner','Build / Buy / Partner hypothesis','What can be bought or configured? What company data, rules, workflows and learning must stay inside?'),
      f('critical_assumption','Critical assumption','What assumption in this workflow is most likely to be wrong?')
    ],
    4: [
      f('pilot_boundary','Pilot boundary','One workflow, team/segment/geography, duration, volume and 3–10 real users.'),
      f('ownership','Leadership and operating ownership','Name the sponsor, business owner, workflow owner, data/systems role and build/configuration role.'),
      f('old_work_removed','Old work removed and capacity redeployed','What chasing, copying, drafting or checking disappears? What higher-value work replaces it?'),
      f('new_behaviour','New behaviour required','What must users do differently? Why should they trust and use the new path?'),
      f('data_boundary','Data boundary','List each source, owner, classification and approved system/access rule.',5),
      select('risk_tier','Risk Ladder',['','Tier 1 — Low','Tier 2 — Moderate','Tier 3 — High','Tier 4 — Critical']),
      group('operational_boundary','Operational boundary',[
        ['allowed','AI is allowed to'],['not_allowed','AI is not allowed to'],['human_approve','A human must approve'],['escalate','Always escalate']
      ]),
      f('control_recovery','Control and recovery','Approved-source grounding, audit trail, exception owner, override, incident path, red-button owner and off-switch test.'),
      evidence('evidence','Evidence'),
      f('economics','Economics','Value at stake, internal time, data work, tool/integration cost, supervision, conservative benefit and payback hypothesis.'),
      f('weekly_question','Weekly learning question','What will we review each week, and what decision can that evidence change?'),
      f('premortem','Pre-mortem correction','If the pilot failed by Day 30, what likely caused it? What prevention, detection or recovery change will you make now?')
    ],
    5: [
      f('pitch_problem','0:00–0:20 · Problem and consequence','What repeatedly goes wrong, and what does it cost?'),
      f('pitch_brain','0:20–0:40 · Company Brain breakdown','Where is Memory, Reasoning, Action or Feedback weak?'),
      f('pitch_workflow','0:40–1:10 · Workflow change','What will operate differently, and what exactly will AI do?'),
      f('pitch_control','1:10–1:35 · Ownership and control','Who owns it? What remains human? What are the data and risk boundaries?'),
      f('pitch_evidence','1:35–1:55 · Evidence and decision','What will be known by Day 30? What Day-90 result means scale, fix or stop?'),
      f('commitment_72h','1:55–2:00 · Commitment','What will you do within 72 hours?'),
      f('day30_review_date','Day-30 sponsor review date','',1,'date'),
      f('day30_review_with','Day-30 review with','Name the sponsor or leadership colleague.'),
      f('scale_if','Scale if…','State the evidence that permits scaling.'),
      f('fix_if','Fix if…','State the evidence that requires revision.'),
      f('stop_if','Stop if…','State the evidence that stops the initiative.')
    ]
  };

  function f(key,label,help,rows,type){ return { type:type || 'text', key:key, label:label, help:help, rows:rows || 3 }; }
  function select(key,label,options){ return { type:'select', key:key, label:label, options:options }; }
  function checks(key,label,options){ return { type:'checks', key:key, label:label, options:options }; }
  function matrix(key,label,options){ return { type:'matrix', key:key, label:label, options:options }; }
  function group(key,label,options){ return { type:'group', key:key, label:label, options:options }; }
  function evidence(key,label){ return { type:'evidence', key:key, label:label }; }
  function esc(v){ return String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function val(obj,key){ return obj && obj[key] != null ? obj[key] : ''; }
  function has(v){ if(typeof v==='string')return !!v.trim(); if(Array.isArray(v))return v.some(has); if(v&&typeof v==='object')return Object.keys(v).some(function(k){return has(v[k]);}); return !!v; }
  function getSession(){ return (S.builder.sessions && S.builder.sessions[String(S.current)]) || {}; }
  async function api(path,init){
    try {
      var res=await fetch('/api/abl'+path,Object.assign({headers:{'Content-Type':'application/json'}},init||{}));
      var body={}; try{body=await res.json();}catch(e){}
      return {ok:res.ok&&body.ok!==false,data:body.data,error:body.error};
    } catch(e){ return {ok:false,error:'Network error — your last saved work is still safe.'}; }
  }
  async function load(){
    var r=await api('/course/'+encodeURIComponent(SLUG));
    if(!r.ok){ app.innerHTML='<div class="error">'+esc(r.error||'Course workspace unavailable')+'</div>'; return; }
    S.participant=r.data.participant; S.builder=r.data.builder; S.builder.sessions=S.builder.sessions||{};
    S.current=Math.max(1,Math.min(5,S.builder.current_session||1)); render();
  }
  function inputHTML(field,data){
    var v=val(data,field.key);
    if(field.type==='select') return wrap(field,'<select data-key="'+field.key+'">'+field.options.map(function(o){return '<option'+(v===o?' selected':'')+'>'+esc(o)+'</option>';}).join('')+'</select>');
    if(field.type==='checks'){
      var chosen=Array.isArray(v)?v:[];
      return '<div class="field"><label>'+esc(field.label)+'</label><div class="check-grid">'+field.options.map(function(o){
        return '<label class="check"><input type="checkbox" data-check="'+field.key+'" value="'+esc(o)+'"'+(chosen.indexOf(o)>=0?' checked':'')+'><span>'+esc(o)+'</span></label>';
      }).join('')+'</div></div>';
    }
    if(field.type==='matrix'){
      var mv=v&&typeof v==='object'?v:{};
      return '<div class="field"><label>'+esc(field.label)+'</label>'+field.options.map(function(o){
        var row=mv[o]||{};
        return '<div class="triple" style="margin:8px 0"><div style="font:500 12px/1.4 var(--mono);padding-top:10px">'+esc(o)+'</div>'+
          '<input type="text" data-nested="'+field.key+'" data-child="'+esc(o)+'" data-sub="evidence" placeholder="Evidence" value="'+esc(row.evidence||'')+'">'+
          '<select data-nested="'+field.key+'" data-child="'+esc(o)+'" data-sub="status"><option></option><option'+(row.status==='Pass'?' selected':'')+'>Pass</option><option'+(row.status==='Uncertain'?' selected':'')+'>Uncertain</option><option'+(row.status==='Fail'?' selected':'')+'>Fail</option></select></div>';
      }).join('')+'</div>';
    }
    if(field.type==='group'){
      var gv=v&&typeof v==='object'?v:{};
      return '<div class="field"><label>'+esc(field.label)+'</label>'+field.options.map(function(o){
        return '<div style="margin:10px 0"><div class="help">'+esc(o[1])+'</div><textarea rows="2" data-nested="'+field.key+'" data-child="'+o[0]+'">'+esc(gv[o[0]]||'')+'</textarea></div>';
      }).join('')+'</div>';
    }
    if(field.type==='evidence'){
      var ev=v&&typeof v==='object'?v:{};
      return '<div class="field"><label>'+esc(field.label)+'</label><div class="triple">'+['outcome','adoption','safety'].map(function(k){
        var row=ev[k]||{}; return '<div><div class="help" style="text-transform:capitalize">'+k+'</div>'+
          '<textarea rows="2" data-nested="'+field.key+'" data-child="'+k+'" data-sub="baseline" placeholder="Baseline">'+esc(row.baseline||'')+'</textarea>'+
          '<textarea rows="2" data-nested="'+field.key+'" data-child="'+k+'" data-sub="day30" placeholder="Day-30 evidence">'+esc(row.day30||'')+'</textarea>'+
          '<textarea rows="2" data-nested="'+field.key+'" data-child="'+k+'" data-sub="day90" placeholder="Day-90 target">'+esc(row.day90||'')+'</textarea></div>';
      }).join('')+'</div></div>';
    }
    if(field.type==='date') return wrap(field,'<input type="date" data-key="'+field.key+'" value="'+esc(v)+'">');
    return wrap(field,'<textarea data-key="'+field.key+'" rows="'+field.rows+'">'+esc(v)+'</textarea>');
  }
  function wrap(field,control){ return '<div class="field"><label>'+esc(field.label)+'</label>'+(field.help?'<div class="help">'+esc(field.help)+'</div>':'')+control+'</div>'; }
  function sessionComplete(n){
    var data=(S.builder.sessions||{})[String(n)]||{};
    var required={1:['candidate_workflow','where_work_breaks','business_consequence','company_brain_hypothesis'],2:['problem_sentence','baseline','owner_human_line','decision'],3:['memory','reasoning','action','feedback','boundaries'],4:['pilot_boundary','ownership','risk_tier','operational_boundary','evidence'],5:['pitch_problem','pitch_workflow','pitch_control','pitch_evidence','commitment_72h']}[n];
    return required.every(function(k){return has(data[k]);});
  }
  function render(){
    var p=S.participant,b=S.builder,m=SESSION_META[S.current],data=getSession();
    var completed=b.completed_sessions||[];
    var firstMissing=FIELDS[S.current].filter(function(x){return !has(data[x.key]);})[0];
    app.innerHTML='<header class="course-head"><div><div class="kicker">AI for Business Leaders · Initiative Builder</div>'+
      '<h1>My First AI Leadership Initiative</h1><div class="sub">Beyond Personal Productivity · Building Organisational Capability with AI</div></div>'+
      '<div class="identity"><strong>'+esc(p.name)+'</strong>'+esc(p.company_name||'')+'</div></header>'+
      '<nav class="journey" aria-label="Course sessions">'+[1,2,3,4,5].map(function(n){var x=SESSION_META[n];return '<button type="button" data-session="'+n+'" class="'+(n===S.current?'on ':'')+(completed.indexOf(n)>=0?'done':'')+'"><div class="n">0'+n+'</div><div class="t">'+esc(x.title)+'</div><div class="d">'+esc(x.move)+'</div></button>';}).join('')+'</nav>'+
      '<div class="progress"><div style="width:'+Number(b.completion_percent||0)+'%"></div></div><div class="progress-copy"><span>See → Choose → Design → De-risk → Commit</span><span>'+Number(b.completion_percent||0)+'% complete</span></div>'+
      '<div class="safety"><strong>Data-safety rule:</strong> Do not enter confidential, regulated, employee or customer information into an unapproved AI system. AI may recommend; a named human remains accountable for consequential decisions.</div>'+
      '<div class="layout"><section class="panel"><div class="session-kicker">Session '+S.current+' · '+esc(m.move)+'</div><h2 class="session-title">'+esc(m.title)+'</h2><p class="session-q">'+esc(m.question)+'</p>'+
      FIELDS[S.current].map(function(field){return inputHTML(field,data);}).join('')+
      '<div class="actions"><button class="btn ghost" type="button" id="skip">Continue without completing this</button><span class="save-state" id="saveState">All changes saved</span>'+
      '<button class="btn primary" type="button" id="next">'+(S.current===5?'Create my 90-day charter':'Save & continue →')+'</button></div></section>'+
      '<aside class="side"><div class="side-card win '+(sessionComplete(S.current)?'show':'')+'" id="win"><h3>Small win</h3><strong>'+esc(m.win)+'</strong></div>'+
      '<div class="side-card"><h3>Company Brain</h3><ul><li><strong>Memory</strong> — what must be captured?</li><li><strong>Reasoning</strong> — what decision is supported?</li><li><strong>Action</strong> — what trigger starts work?</li><li><strong>Feedback</strong> — what returns and changes?</li></ul></div>'+
      '<div class="side-card"><h3>Working draft</h3><p>You can move freely between sessions. Nothing here is a condition for attending the live course.</p>'+
      (firstMissing?'<div class="open-decision">Open decision: '+esc(firstMissing.label)+'</div>':'<div class="open-decision">This session has enough information for a working output.</div>')+'</div>'+
      '<div class="side-card charter '+(S.charter?'show':'')+'" id="charter"><h3>Your charter</h3><div class="charter-preview">'+esc(S.charter&&S.charter.markdown||'')+'</div>'+
      (S.charter?'<a class="btn primary" style="display:block;text-decoration:none;text-align:center;margin-top:12px" target="_blank" rel="noopener" href="/ai-business-leaders/pdf/'+esc(S.charter.id)+'">Open printable / PDF ↓</a>':'')+'</div></aside></div>';
    wire();
  }
  function collect(){
    var out=Object.assign({},getSession());
    document.querySelectorAll('[data-key]').forEach(function(el){out[el.getAttribute('data-key')]=el.value;});
    var checkKeys={};
    document.querySelectorAll('[data-check]').forEach(function(el){checkKeys[el.getAttribute('data-check')]=true;});
    Object.keys(checkKeys).forEach(function(k){out[k]=[];});
    document.querySelectorAll('[data-check]').forEach(function(el){var k=el.getAttribute('data-check');if(el.checked)out[k].push(el.value);});
    document.querySelectorAll('[data-nested]').forEach(function(el){
      var k=el.getAttribute('data-nested'),c=el.getAttribute('data-child'),sub=el.getAttribute('data-sub');
      out[k]=out[k]&&typeof out[k]==='object'&&!Array.isArray(out[k])?out[k]:{};
      if(sub){out[k][c]=out[k][c]&&typeof out[k][c]==='object'?out[k][c]:{};out[k][c][sub]=el.value;}else out[k][c]=el.value;
    });
    return out;
  }
  function queueSave(){
    clearTimeout(S.timer); var state=document.getElementById('saveState'); if(state)state.textContent='Saving…';
    S.timer=setTimeout(save,650);
  }
  async function save(){
    clearTimeout(S.timer);
    if(S.saving){
      S.pendingSave=true;
      await S.savePromise;
      if(S.pendingSave){S.pendingSave=false;return save();}
      return;
    }
    S.saving=true; var data=collect(), sessionAtSave=S.current;
    S.savePromise=api('/course/'+encodeURIComponent(SLUG),{method:'PATCH',body:JSON.stringify({session:sessionAtSave,data:data})});
    var r=await S.savePromise;
    S.saving=false; S.savePromise=null;
    var state=document.getElementById('saveState');
    if(r.ok){S.builder=r.data;S.builder.sessions=S.builder.sessions||{};if(state)state.textContent='All changes saved';var win=document.getElementById('win');if(win&&sessionComplete(S.current))win.classList.add('show');}
    else if(state)state.textContent=r.error||'Not saved — retrying';
  }
  async function createCharter(){
    await save();
    var r=await api('/course/'+encodeURIComponent(SLUG)+'/charter',{method:'POST',body:'{}'});
    if(r.ok){S.charter=r.data;render();}else{var state=document.getElementById('saveState');if(state)state.textContent=r.error||'Could not create charter';}
  }
  function wire(){
    document.querySelectorAll('[data-session]').forEach(function(btn){btn.onclick=async function(){await save();S.current=parseInt(btn.getAttribute('data-session'),10);S.charter=null;render();};});
    document.querySelectorAll('textarea,input,select').forEach(function(el){el.addEventListener('input',queueSave);el.addEventListener('change',queueSave);});
    document.getElementById('skip').onclick=async function(){await save();if(S.current<5){S.current++;render();}else createCharter();};
    document.getElementById('next').onclick=async function(){if(S.current===5)return createCharter();await save();S.current++;render();};
  }
  load();
})();
