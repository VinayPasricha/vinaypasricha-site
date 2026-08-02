(function(){
  'use strict';
  var root=document.querySelector('[data-book-companion]'); if(!root)return;
  var form=root.querySelector('form'), input=root.querySelector('textarea'), send=root.querySelector('[type=submit]'), messages=root.querySelector('[data-messages]'), suggestions=root.querySelector('[data-suggestions]');
  var history=[];
  function add(role,text){var el=document.createElement('div');el.className='book-chat-message '+role;el.textContent=text;messages.appendChild(el);messages.scrollTop=messages.scrollHeight;return el}
  function ask(question){question=String(question||'').trim();if(!question||send.disabled)return;add('user',question);history.push({role:'user',content:question});input.value='';send.disabled=true;suggestions.hidden=true;var pending=add('agent','Reading the relevant passages…');
    fetch('/api/books/ai-for-business-leaders/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:question,history:history.slice(-6)})})
      .then(function(r){if(!r.ok)throw new Error();return r.json()}).then(function(data){pending.textContent=data.answer;history.push({role:'assistant',content:data.answer})}).catch(function(){pending.textContent='I could not reach the book just now. Please try again in a moment.'}).finally(function(){send.disabled=false;input.focus();messages.scrollTop=messages.scrollHeight})
  }
  form.addEventListener('submit',function(e){e.preventDefault();ask(input.value)});
  input.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();ask(input.value)}});
  suggestions.addEventListener('click',function(e){if(e.target.tagName==='BUTTON')ask(e.target.textContent)});
})();
