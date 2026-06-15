/* =============================================================
   Lead gate — collected BEFORE a runtime can be used.
   =============================================================
   Shows a required Name + Email + Phone form the first time a
   visitor opens any runtime in this session. On submit it saves
   the lead to Firestore (/api/leads) and unlocks the page. The
   details are remembered (localStorage) so we don't ask again,
   and exposed as window.OF_LEAD so chats are tagged with them.
   ============================================================= */
(function () {
  'use strict';

  var STORE_KEY = 'site.lead.v1';

  function apiBase() {
    if (typeof window.OF_API_BASE === 'string') return window.OF_API_BASE;
    var devPorts = { '8000': 1, '5500': 1, '3000': 1 };
    if (location.protocol === 'file:' || devPorts[location.port]) return 'http://localhost:8080';
    return '';
  }
  function sid() {
    try {
      var s = sessionStorage.getItem('site.sid');
      if (!s) { s = 's_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8); sessionStorage.setItem('site.sid', s); }
      return s;
    } catch (e) { return 's_' + Date.now().toString(36); }
  }

  // Already captured? Expose and skip.
  try {
    var saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (saved && saved.email) { window.OF_LEAD = saved; return; }
  } catch (e) {}

  function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()); }
  function validPhone(v) { return (v.replace(/[^\d]/g, '').length >= 7); }

  function injectStyles() {
    var css = ''
      + '.lg-overlay{position:fixed;inset:0;z-index:99999;background:rgba(8,9,12,.92);'
      + 'backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:24px;}'
      + '.lg-card{width:100%;max-width:440px;background:#0f1115;border:1px solid #23262d;border-radius:16px;'
      + 'padding:32px 28px;font-family:Inter,system-ui,sans-serif;color:#e7e9ee;box-shadow:0 24px 80px rgba(0,0,0,.6);}'
      + '.lg-eyebrow{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#8a90a0;margin:0 0 10px;}'
      + '.lg-title{font-family:Newsreader,Georgia,serif;font-size:24px;line-height:1.25;margin:0 0 8px;font-weight:400;}'
      + '.lg-sub{font-size:14px;color:#9aa0ad;margin:0 0 22px;line-height:1.5;}'
      + '.lg-field{margin-bottom:14px;}'
      + '.lg-field label{display:block;font-size:12px;color:#9aa0ad;margin-bottom:6px;}'
      + '.lg-field input{width:100%;box-sizing:border-box;background:#15181e;border:1px solid #2a2e37;'
      + 'border-radius:10px;padding:12px 14px;color:#e7e9ee;font-size:15px;outline:none;transition:border-color .15s;}'
      + '.lg-field input:focus{border-color:#5b6cff;}'
      + '.lg-field input.lg-bad{border-color:#e0556b;}'
      + '.lg-btn{width:100%;margin-top:8px;background:#5b6cff;color:#fff;border:0;border-radius:10px;'
      + 'padding:13px;font-size:15px;font-weight:500;cursor:pointer;transition:background .15s;}'
      + '.lg-btn:hover{background:#4a5ae8;} .lg-btn:disabled{opacity:.6;cursor:default;}'
      + '.lg-note{font-size:11px;color:#6b7180;margin-top:14px;text-align:center;line-height:1.5;}'
      + '.lg-err{font-size:12px;color:#e0556b;margin-top:4px;min-height:0;}';
    var s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
  }

  function build() {
    injectStyles();
    var ov = document.createElement('div');
    ov.className = 'lg-overlay';
    ov.innerHTML =
      '<div class="lg-card" role="dialog" aria-modal="true">'
      + '<p class="lg-eyebrow">Before we begin</p>'
      + '<h2 class="lg-title">Tell us where to reach you.</h2>'
      + '<p class="lg-sub">A few details so we can follow up on what you surface here. All fields required.</p>'
      + '<div class="lg-field"><label for="lg-name">Full name</label><input id="lg-name" type="text" autocomplete="name" placeholder="Your name"></div>'
      + '<div class="lg-field"><label for="lg-email">Email</label><input id="lg-email" type="email" autocomplete="email" placeholder="you@example.com"></div>'
      + '<div class="lg-field"><label for="lg-phone">Phone</label><input id="lg-phone" type="tel" autocomplete="tel" placeholder="+91 …"></div>'
      + '<div class="lg-err" id="lg-err"></div>'
      + '<button class="lg-btn" id="lg-go" type="button">Continue</button>'
      + '<p class="lg-note">We use this only to follow up. No spam.</p>'
      + '</div>';
    document.body.appendChild(ov);
    // Prevent scrolling the page behind the gate.
    var prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    var nameEl = ov.querySelector('#lg-name');
    var emailEl = ov.querySelector('#lg-email');
    var phoneEl = ov.querySelector('#lg-phone');
    var errEl = ov.querySelector('#lg-err');
    var btn = ov.querySelector('#lg-go');
    setTimeout(function () { nameEl.focus(); }, 50);

    function submit() {
      var name = nameEl.value.trim(), email = emailEl.value.trim(), phone = phoneEl.value.trim();
      [nameEl, emailEl, phoneEl].forEach(function (el) { el.classList.remove('lg-bad'); });
      if (!name) { nameEl.classList.add('lg-bad'); errEl.textContent = 'Please enter your name.'; nameEl.focus(); return; }
      if (!validEmail(email)) { emailEl.classList.add('lg-bad'); errEl.textContent = 'Please enter a valid email.'; emailEl.focus(); return; }
      if (!validPhone(phone)) { phoneEl.classList.add('lg-bad'); errEl.textContent = 'Please enter a valid phone number.'; phoneEl.focus(); return; }

      errEl.textContent = '';
      btn.disabled = true; btn.textContent = 'Saving…';

      var lead = { name: name, email: email, phone: phone, source: location.pathname, sessionId: sid() };
      // Remember locally + expose immediately (don't trap the user on network issues).
      try { localStorage.setItem(STORE_KEY, JSON.stringify(lead)); } catch (e) {}
      window.OF_LEAD = lead;

      fetch(apiBase() + '/api/leads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lead), keepalive: true,
      }).catch(function () {}).then(function () { close(); });
      // Safety: close even if the request hangs.
      setTimeout(close, 2500);
    }
    var closed = false;
    function close() {
      if (closed) return; closed = true;
      document.body.style.overflow = prevOverflow;
      ov.parentNode && ov.parentNode.removeChild(ov);
    }

    btn.addEventListener('click', submit);
    [nameEl, emailEl, phoneEl].forEach(function (el) {
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
