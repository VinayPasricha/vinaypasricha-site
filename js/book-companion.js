(function(){
  'use strict';
  var root=document.querySelector('[data-book-companion]'); if(!root)return;
  var modal=root.querySelector('[role=dialog]'),backdrop=root.querySelector('[data-book-chat-backdrop]'),openButton=root.querySelector('[data-open-book-chat]'),closeButton=root.querySelector('[data-close-book-chat]');
  var form=root.querySelector('form'),input=root.querySelector('textarea'),send=root.querySelector('[type=submit]'),messages=root.querySelector('[data-messages]'),suggestions=root.querySelector('[data-suggestions]'),meter=root.querySelector('[data-meter]');
  var history=[];
  function sessionId(){var key='book.companion.session.v2',id='';try{id=localStorage.getItem(key)||'';if(!id){id='book_'+Date.now().toString(36)+'_'+Array.from(crypto.getRandomValues(new Uint8Array(12))).map(function(v){return v.toString(16).padStart(2,'0')}).join('');localStorage.setItem(key,id)}}catch(_){id='book_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2)}return id}
  var conversationId=sessionId();
  function open(){modal.hidden=false;backdrop.hidden=false;document.body.classList.add('book-chat-open');setTimeout(function(){input.focus()},30)}
  function close(){modal.hidden=true;backdrop.hidden=true;document.body.classList.remove('book-chat-open');openButton.focus()}
  function add(role,text){var el=document.createElement('div');el.className='book-chat-message '+role;el.textContent=text;messages.appendChild(el);messages.scrollTop=messages.scrollHeight;return el}
  function renderSuggestions(items){suggestions.innerHTML='';(items||[]).slice(0,5).forEach(function(text){var button=document.createElement('button');button.type='button';button.textContent=text;suggestions.appendChild(button)});suggestions.hidden=!suggestions.children.length}
  function showLimit(url){messages.innerHTML='';suggestions.hidden=true;form.hidden=true;meter.textContent='Free conversation complete';var box=document.createElement('div');box.className='book-chat-limit';box.innerHTML='<h3>Continue with the complete book.</h3><p>You have reached this conversation’s limit of 20 questions or 10,000 total tokens.</p><a class="book-chat-buy" target="_blank" rel="noopener">Buy the book on Amazon ↗</a>';box.querySelector('a').href=url||'https://www.amazon.in/dp/B0GFXXPGP7';messages.appendChild(box)}
  function updateMeter(limits){if(!limits)return;var remaining=Math.max(0,limits.questionsMax-limits.questionsUsed);meter.textContent=remaining+' question'+(remaining===1?'':'s')+' remaining · '+limits.tokensUsed.toLocaleString()+' of '+limits.tokensMax.toLocaleString()+' tokens used';if(limits.locked)showLimit(limits.purchaseUrl)}
  function ask(question){question=String(question||'').trim();if(!question||send.disabled)return;add('user',question);history.push({role:'user',content:question});input.value='';send.disabled=true;suggestions.hidden=true;var pending=add('agent','Reading the relevant passages…');
    fetch('/api/books/ai-for-business-leaders/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:conversationId,question:question,history:history.slice(-4)})})
      .then(function(r){return r.json().then(function(data){if(!r.ok){var err=new Error(data.detail||'Request failed');err.data=data;throw err}return data})})
      .then(function(data){pending.textContent=data.answer;history.push({role:'assistant',content:data.answer});renderSuggestions(data.suggestions);updateMeter(data.limits)})
      .catch(function(err){if(err.data&&err.data.limitReached){showLimit(err.data.purchaseUrl);return}pending.textContent=err.message||'I could not reach the book just now. Please try again in a moment.';suggestions.hidden=false})
      .finally(function(){send.disabled=false;if(!form.hidden)input.focus();messages.scrollTop=messages.scrollHeight})
  }
  openButton.addEventListener('click',open);closeButton.addEventListener('click',close);backdrop.addEventListener('click',close);
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!modal.hidden)close()});
  form.addEventListener('submit',function(e){e.preventDefault();ask(input.value)});
  input.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();ask(input.value)}});
  suggestions.addEventListener('click',function(e){if(e.target.tagName==='BUTTON')ask(e.target.textContent)});
})();
