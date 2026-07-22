(function () {
  'use strict';
  var email = '';
  var emailStep = document.getElementById('emailStep');
  var codeStep = document.getElementById('codeStep');
  var status = document.getElementById('formStatus');
  var emailInput = document.getElementById('email');
  var codeInput = document.getElementById('code');

  function message(text, bad) {
    status.textContent = text || '';
    status.style.color = bad ? '#8d2f3c' : '#5d644f';
  }

  async function json(path, init) {
    var res = await fetch('/api/abl' + path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, init || {}));
    var body = {}; try { body = await res.json(); } catch (e) {}
    return { ok: res.ok && body.ok !== false, data: body.data || {}, error: body.error || '', status: res.status };
  }

  function busy(form, yes) {
    var button = form.querySelector('button[type="submit"]');
    button.disabled = yes;
  }

  document.getElementById('emailForm').onsubmit = async function (event) {
    event.preventDefault();
    email = emailInput.value.trim().toLowerCase();
    message(''); busy(event.currentTarget, true);
    var result = await json('/auth/request', { method: 'POST', body: JSON.stringify({ email: email }) });
    busy(event.currentTarget, false);
    if (!result.ok) { message(result.error || 'We could not send the code. Please try again.', true); return; }
    document.getElementById('emailEcho').textContent = email;
    emailStep.hidden = true; codeStep.hidden = false;
    if (result.data.preview_code) {
      var preview = document.getElementById('previewCode');
      preview.hidden = false;
      preview.textContent = 'Staging preview code: ' + result.data.preview_code;
      codeInput.value = result.data.preview_code;
    }
    message(result.data.message || 'Enter the code to continue.');
    codeInput.focus();
  };

  document.getElementById('codeForm').onsubmit = async function (event) {
    event.preventDefault();
    message(''); busy(event.currentTarget, true);
    var result = await json('/auth/verify', { method: 'POST', body: JSON.stringify({ email: email, code: codeInput.value }) });
    busy(event.currentTarget, false);
    if (!result.ok) { message(result.error || 'That code could not be verified.', true); return; }
    localStorage.setItem(window.AblAuth.key, JSON.stringify({
      token: result.data.token,
      email: email,
      workspace: result.data.workspace,
      participant: result.data.participant,
      saved_at: new Date().toISOString()
    }));
    location.replace(result.data.workspace);
  };

  document.getElementById('changeEmail').onclick = function () {
    codeStep.hidden = true; emailStep.hidden = false; codeInput.value = ''; message(''); emailInput.focus();
  };

  async function resume() {
    var saved = window.AblAuth.read();
    if (!saved || !saved.token) return;
    var result = await fetch('/api/abl/auth/status', { headers: window.AblAuth.headers({ Accept: 'application/json' }) });
    if (!result.ok) { window.AblAuth.clear(); return; }
    var body = await result.json();
    if (body && body.data && body.data.workspace) location.replace(body.data.workspace);
  }
  resume();
}());
