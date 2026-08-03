(function () {
  'use strict';
  var KEY = 'abl_participant_access_v1';

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); }
    catch (e) { return null; }
  }

  function token() {
    var value = read();
    return value && value.token ? value.token : '';
  }

  function headers(base) {
    var out = Object.assign({}, base || {});
    if (token()) out.Authorization = 'Bearer ' + token();
    return out;
  }

  function login() {
    var next = location.pathname + location.search;
    location.replace('/ai-business-leaders/login?next=' + encodeURIComponent(next));
  }

  function clear() {
    localStorage.removeItem(KEY);
  }

  function isProtectedCourseRequest(input) {
    try {
      var raw = typeof input === 'string' ? input : (input && input.url) || '';
      var url = new URL(raw, location.origin);
      if (url.origin !== location.origin) return false;
      var path = url.pathname;
      if (path.indexOf('/api/abl/auth/') === 0) return false;
      if (path.indexOf('/api/abl/workspace/admin/') === 0) return false;
      return /^\/api\/abl\/(session|course|workspace)\//.test(path);
    } catch (e) {
      return false;
    }
  }

  // Older course pages use their own fetch helpers. Wrapping same-origin private
  // course requests here means every one of them now carries the verified token
  // without duplicating security code in each page.
  var nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var options = Object.assign({}, init || {});
    var protectedRequest = isProtectedCourseRequest(input);
    if (protectedRequest) {
      var h = new Headers(options.headers || {});
      if (token()) h.set('Authorization', 'Bearer ' + token());
      options.headers = h;
    }
    return nativeFetch(input, options).then(function (response) {
      if (protectedRequest && response.status === 401) {
        clear();
        setTimeout(login, 0);
      }
      return response;
    });
  };

  // Mobile workspace shell. The desktop layout previously hid the sidebar below
  // 900px, leaving participants with no navigation. This converts it into an
  // accessible drawer and also makes cards, forms, tables and actions phone-safe.
  function installMobileWorkspace() {
    var layout = document.querySelector('.layout');
    var sidebar = layout && layout.querySelector('aside');
    var topbar = document.querySelector('.top');
    if (!layout || !sidebar || !topbar || document.getElementById('ablMobileMenu')) return;

    var style = document.createElement('style');
    style.textContent = [
      '.abl-mobile-menu,.abl-mobile-overlay{display:none}',
      '@media(max-width:900px){',
      'html,body{max-width:100%;overflow-x:hidden}',
      'body.abl-menu-open{overflow:hidden}',
      '.top{height:auto;min-height:64px;padding:9px 12px;gap:10px;align-items:center}',
      '.top .brand{min-width:0;display:flex;align-items:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.top .switch{margin-left:auto;display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}',
      '.top .switch button{min-height:42px;padding:9px 10px}',
      '.abl-mobile-menu{display:inline-flex;flex:0 0 44px;width:44px;height:44px;align-items:center;justify-content:center;border:1px solid var(--rule);border-radius:6px;background:var(--paper2);color:var(--ink);font:20px/1 Arial,sans-serif;cursor:pointer}',
      '.layout{display:block;min-height:calc(100vh - 64px)}',
      '.layout>aside{display:block!important;position:fixed;left:0;top:var(--abl-mobile-top,64px);z-index:80;width:min(86vw,330px);height:calc(100dvh - var(--abl-mobile-top,64px));overflow-y:auto;overscroll-behavior:contain;background:var(--paper2);box-shadow:18px 0 48px rgba(29,26,23,.22);transform:translateX(-105%);transition:transform .22s ease;padding-bottom:max(24px,env(safe-area-inset-bottom))}',
      'body.abl-menu-open .layout>aside{transform:translateX(0)}',
      '.abl-mobile-overlay{display:block;position:fixed;inset:var(--abl-mobile-top,64px) 0 0 0;z-index:70;border:0;background:rgba(29,26,23,.42);opacity:0;pointer-events:none;transition:opacity .2s}',
      'body.abl-menu-open .abl-mobile-overlay{opacity:1;pointer-events:auto}',
      'main{width:100%;max-width:none;padding:24px 16px calc(70px + env(safe-area-inset-bottom))}',
      'h1{font-size:clamp(36px,11vw,48px);line-height:1.02;overflow-wrap:anywhere}',
      'h2{font-size:clamp(25px,8vw,32px)}',
      '.lede{font-size:17px}',
      '.panel,.card{padding:18px}',
      '.hero,.two{grid-template-columns:1fr!important;gap:18px}',
      '.id{border-left:0!important;border-top:1px solid var(--rule);padding:17px 0 0!important}',
      '.next{grid-template-columns:6px minmax(0,1fr)!important;gap:14px;padding:18px 15px}',
      '.next .cta{grid-column:2;text-align:left}',
      '.cards{grid-template-columns:1fr!important}',
      '.journey{display:flex!important;overflow-x:auto;scroll-snap-type:x mandatory;gap:10px;padding-bottom:10px;-webkit-overflow-scrolling:touch}',
      '.journey .step{flex:0 0 min(78vw,260px);scroll-snap-align:start;min-height:118px}',
      '.item{align-items:flex-start;flex-direction:column}',
      '.item>.btn,.item>.actions{width:100%}',
      '.actions{gap:8px}',
      '.actions .btn,.actions button,.actions a{min-height:44px}',
      '.field input,.field select,.field textarea{font-size:16px;min-height:44px}',
      '.table{width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}',
      '.table table{min-width:700px}',
      '.sec{display:block;margin:28px 0 13px}',
      '.sec p{text-align:left!important;margin-top:7px}',
      '.status{line-height:1.25}',
      '.toast{left:14px;right:14px;bottom:max(14px,env(safe-area-inset-bottom));text-align:center}',
      '}',
      '@media(max-width:430px){',
      '.top .brand small{display:none}',
      '.top .brand{font-size:18px}',
      '.top .switch button{font-size:8px;padding:8px}',
      'main{padding-left:13px;padding-right:13px}',
      '.panel,.card{padding:16px}',
      '.btn{white-space:normal;text-align:center;line-height:1.25}',
      '}'
    ].join('');
    document.head.appendChild(style);

    var button = document.createElement('button');
    button.id = 'ablMobileMenu';
    button.className = 'abl-mobile-menu';
    button.type = 'button';
    button.setAttribute('aria-label', 'Open workspace menu');
    button.setAttribute('aria-controls', 'ablWorkspaceSidebar');
    button.setAttribute('aria-expanded', 'false');
    button.textContent = '☰';
    sidebar.id = sidebar.id || 'ablWorkspaceSidebar';
    topbar.insertBefore(button, topbar.firstChild);

    var overlay = document.createElement('button');
    overlay.className = 'abl-mobile-overlay';
    overlay.type = 'button';
    overlay.setAttribute('aria-label', 'Close workspace menu');
    document.body.appendChild(overlay);

    function setTop() {
      var bottom = Math.max(0, Math.round(topbar.getBoundingClientRect().bottom));
      document.documentElement.style.setProperty('--abl-mobile-top', bottom + 'px');
    }
    function openMenu() {
      setTop();
      document.body.classList.add('abl-menu-open');
      button.setAttribute('aria-expanded', 'true');
      button.textContent = '×';
    }
    function closeMenu() {
      document.body.classList.remove('abl-menu-open');
      button.setAttribute('aria-expanded', 'false');
      button.textContent = '☰';
    }

    button.addEventListener('click', function () {
      if (document.body.classList.contains('abl-menu-open')) closeMenu(); else openMenu();
    });
    overlay.addEventListener('click', closeMenu);
    sidebar.addEventListener('click', function (event) {
      if (event.target.closest('button,a')) closeMenu();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeMenu();
    });
    window.addEventListener('resize', function () {
      setTop();
      if (window.innerWidth > 900) closeMenu();
    });
    window.addEventListener('scroll', setTop, { passive: true });
    setTop();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installMobileWorkspace);
  else installMobileWorkspace();

  // Uploaded course-material PDFs are served from the participant API, which a
  // plain link navigation cannot authenticate. Intercept any click heading to a
  // material file endpoint — whatever screen rendered it — fetch it with the
  // sign-in token, and show the PDF from a blob. A blank tab is opened inside
  // the click so the later navigation is not treated as a blocked pop-up.
  var FILE_ENDPOINT = /\/api\/abl\/workspace\/[^/]+\/materials\/[^/]+\/file(\?|$)/;
  async function openGatedFile(url, win) {
    try {
      var res = await fetch(url, { headers: headers({}) });
      if (res.status === 401) { if (win && !win.closed) win.close(); clear(); login(); return; }
      if (!res.ok) throw new Error('unavailable');
      var blobUrl = URL.createObjectURL(await res.blob());
      if (win && !win.closed) win.location = blobUrl; else window.open(blobUrl, '_blank', 'noopener');
      setTimeout(function () { URL.revokeObjectURL(blobUrl); }, 120000);
    } catch (e) {
      if (win && !win.closed) win.close();
      try { window.alert('This file could not be opened. Please make sure you are still signed in and try again.'); } catch (e2) {}
    }
  }
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('a[href], [data-file-url]') : null;
    if (!el) return;
    var url = el.getAttribute('data-file-url') || el.getAttribute('href') || '';
    if (!FILE_ENDPOINT.test(url)) return;
    if (/[?&]token=/.test(url)) return; // token in URL — let the plain link navigate
    e.preventDefault();
    e.stopPropagation();
    openGatedFile(url, window.open('', '_blank'));
  }, true);

  window.AblAuth = { key: KEY, read: read, token: token, headers: headers, login: login, clear: clear, openGatedFile: openGatedFile };
}());