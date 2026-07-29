(function () {
  'use strict';
  var email = '';
  var emailStep = document.getElementById('emailStep');
  var codeStep = document.getElementById('codeStep');
  var status = document.getElementById('formStatus');
  var emailInput = document.getElementById('email');
  var codeInput = document.getElementById('code');
  var welcome = document.getElementById('loginWelcome');
  var RETURNING_KEY = 'abl_has_signed_in_v1';

  function returningParticipant() {
    try { return localStorage.getItem(RETURNING_KEY) === 'true'; }
    catch (e) { return false; }
  }

  function rememberParticipant() {
    try { localStorage.setItem(RETURNING_KEY, 'true'); }
    catch (e) {}
  }

  if (welcome && returningParticipant()) {
    welcome.innerHTML = 'Welcome back to your <em>AI leadership journey.</em>';
  }

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

  async function verifyAndEnter(code, form) {
    busy(form, true);
    var result = await json('/auth/verify', { method: 'POST', body: JSON.stringify({ email: email, code: code }) });
    if (!result.ok) {
      busy(form, false);
      message(result.error || 'That code could not be verified.', true);
      return false;
    }
    localStorage.setItem(window.AblAuth.key, JSON.stringify({
      token: result.data.token,
      email: email,
      workspace: result.data.workspace,
      participant: result.data.participant,
      saved_at: new Date().toISOString()
    }));
    rememberParticipant();
    location.replace(result.data.workspace);
    return true;
  }

  document.getElementById('emailForm').onsubmit = async function (event) {
    event.preventDefault();
    email = emailInput.value.trim().toLowerCase();
    var emailForm = event.currentTarget;
    message(''); busy(emailForm, true);
    var result = await json('/auth/request', { method: 'POST', body: JSON.stringify({ email: email }) });
    if (!result.ok) {
      busy(emailForm, false);
      message(result.error || 'We could not send the code. Please try again.', true);
      return;
    }
    document.getElementById('emailEcho').textContent = email;
    // Locally there is no mail provider, so the code comes back in the response
    // and is shown on the card. The participant still types it, so the code
    // step behaves exactly as it will once real email delivery is configured.
    busy(emailForm, false);
    emailStep.hidden = true; codeStep.hidden = false;
    var preview = document.getElementById('previewCode');
    if (result.data.preview_code) {
      preview.hidden = false;
      preview.textContent = 'Staging preview code: ' + result.data.preview_code;
    } else {
      preview.hidden = true;
      preview.textContent = '';
    }
    message(result.data.message || 'Enter the code to continue.');
    codeInput.focus();
  };

  document.getElementById('codeForm').onsubmit = async function (event) {
    event.preventDefault();
    message('');
    await verifyAndEnter(codeInput.value, event.currentTarget);
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
