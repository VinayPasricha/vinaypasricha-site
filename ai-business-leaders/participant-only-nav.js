/* Participant-facing workspace chrome. The private administrator area is never exposed here. */
(function () {
  'use strict';

  function menuButton() { return document.getElementById('workspaceMenuToggle'); }

  function closeMenu() {
    document.body.classList.remove('participant-menu-open');
    var button = menuButton();
    if (button) {
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-label', 'Open workspace menu');
      button.textContent = '☰';
    }
  }

  function toggleMenu() {
    var open = !document.body.classList.contains('participant-menu-open');
    document.body.classList.toggle('participant-menu-open', open);
    var button = menuButton();
    if (button) {
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
      button.setAttribute('aria-label', open ? 'Close workspace menu' : 'Open workspace menu');
      button.textContent = open ? '×' : '☰';
    }
  }

  function goHome() {
    closeMenu();
    if (typeof S === 'undefined') return;
    S.mode = 'participant';
    S.page = 'home';
    if (typeof save === 'function') save();
    if (typeof render === 'function') render();
  }

  function setDrawerTop() {
    var topbar = document.querySelector('.top');
    if (!topbar) return;
    document.documentElement.style.setProperty('--participant-drawer-top', Math.max(0, Math.round(topbar.getBoundingClientRect().bottom)) + 'px');
  }

  function addStyles() {
    if (document.getElementById('participantOnlyStyles')) return;
    var style = document.createElement('style');
    style.id = 'participantOnlyStyles';
    style.textContent =
      '.participant-only-mark{display:inline-flex;align-items:center;min-height:38px;padding:0 12px;border:1px solid var(--rule);border-radius:999px;color:var(--muted);font:500 9px/1 var(--mono);letter-spacing:.09em;text-transform:uppercase;background:rgba(251,248,241,.72);cursor:pointer}' +
      '.participant-only-mark:hover{border-color:var(--red);color:var(--red)}' +
      '.workspace-home-return{display:inline-flex;align-items:center;min-height:42px;margin:0 0 20px;padding:0 13px;border:1px solid var(--rule);border-radius:999px;background:var(--paper2);color:var(--ink);font:500 9px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;cursor:pointer}' +
      '.workspace-home-return:hover{border-color:var(--red);color:var(--red)}' +
      '.participant-menu-toggle{display:none;width:44px;height:44px;min-width:44px;padding:0;border:1px solid var(--rule);border-radius:7px;background:var(--paper2);color:var(--ink);font:22px/1 Arial,sans-serif;cursor:pointer}' +
      '.participant-drawer-overlay{display:none}' +
      '@media(max-width:900px){' +
        'body.participant-menu-open{overflow:hidden}' +
        '.top{gap:9px;padding-left:12px;padding-right:12px}' +
        '.participant-menu-toggle{display:inline-flex;align-items:center;justify-content:center}' +
        '.brand{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
        '.layout>aside{display:block;position:fixed;left:0;top:var(--participant-drawer-top,70px);z-index:80;width:min(86vw,330px);height:calc(100dvh - var(--participant-drawer-top,70px));padding-bottom:max(24px,env(safe-area-inset-bottom));overflow-y:auto;background:var(--paper2);box-shadow:18px 0 48px rgba(29,26,23,.24);transform:translateX(-105%);transition:transform .22s ease}' +
        'body.participant-menu-open .layout>aside{transform:translateX(0)}' +
        '.participant-drawer-overlay{display:block;position:fixed;inset:var(--participant-drawer-top,70px) 0 0;z-index:70;border:0;background:rgba(29,26,23,.42);opacity:0;pointer-events:none;transition:opacity .2s ease}' +
        'body.participant-menu-open .participant-drawer-overlay{opacity:1;pointer-events:auto}' +
        '.nav{min-height:44px}' +
      '}' +
      '@media(max-width:600px){' +
        '.participant-only-mark{min-height:34px;padding:0 9px;font-size:8px}' +
        '.workspace-home-return{position:sticky;top:78px;z-index:12;width:max-content;min-height:40px;margin-bottom:16px;box-shadow:0 8px 22px rgba(54,43,31,.08)}' +
        '.top .brand{font-size:18px}' +
        '.top .switch button{padding:8px;font-size:8px}' +
      '}';
    document.head.appendChild(style);
  }

  function addMobileMenu() {
    var topbar = document.querySelector('.top');
    var brand = topbar && topbar.querySelector('.brand');
    if (topbar && brand && !menuButton()) {
      var button = document.createElement('button');
      button.id = 'workspaceMenuToggle';
      button.className = 'participant-menu-toggle';
      button.type = 'button';
      button.textContent = '☰';
      button.setAttribute('aria-label', 'Open workspace menu');
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-controls', 'side');
      button.onclick = toggleMenu;
      topbar.insertBefore(button, brand);
    }

    if (!document.getElementById('participantDrawerOverlay')) {
      var overlay = document.createElement('button');
      overlay.id = 'participantDrawerOverlay';
      overlay.className = 'participant-drawer-overlay';
      overlay.type = 'button';
      overlay.setAttribute('aria-label', 'Close workspace menu');
      overlay.onclick = closeMenu;
      document.body.appendChild(overlay);
    }

    var aside = document.getElementById('side');
    if (aside && !aside.dataset.drawerCloseWired) {
      aside.dataset.drawerCloseWired = 'true';
      aside.addEventListener('click', function (event) {
        if (event.target && event.target.closest && event.target.closest('.nav')) closeMenu();
      });
    }

    setDrawerTop();
  }

  function applyParticipantOnlyTopbar() {
    // In the real signed-in workspace, bootLive replaces this area with Sign out.
    // Keep that private-session control intact.
    if (typeof ABL_SLUG !== 'undefined' && ABL_SLUG) return;

    if (typeof S !== 'undefined') {
      S.mode = 'participant';
      if (!S.page) S.page = 'home';
    }

    var switcher = document.querySelector('.switch');
    if (!switcher) return;
    switcher.innerHTML = '<button class="participant-only-mark" type="button" id="participantHomeMark">Participant Workspace</button>';
    var mark = document.getElementById('participantHomeMark');
    if (mark) mark.onclick = goHome;
  }

  function addReturnControl() {
    var main = document.getElementById('main');
    if (!main || typeof S === 'undefined') return;

    var old = document.getElementById('workspaceHomeReturn');
    if (old) old.remove();

    if (S.mode !== 'participant' || !S.page || S.page === 'home') return;

    var button = document.createElement('button');
    button.id = 'workspaceHomeReturn';
    button.className = 'workspace-home-return';
    button.type = 'button';
    button.textContent = '← Workspace Home';
    button.onclick = goHome;
    main.insertBefore(button, main.firstChild);
  }

  function enhance() {
    addStyles();
    applyParticipantOnlyTopbar();
    addMobileMenu();
    addReturnControl();
  }

  function install() {
    if (typeof render === 'function' && !window.__ablParticipantReturnWrapped) {
      window.__ablParticipantReturnWrapped = true;
      var originalRender = render;
      render = function () {
        var result = originalRender.apply(this, arguments);
        setTimeout(enhance, 0);
        return result;
      };
    }

    if (!window.__ablParticipantDrawerGlobalWired) {
      window.__ablParticipantDrawerGlobalWired = true;
      window.addEventListener('resize', function () {
        setDrawerTop();
        if (window.innerWidth > 900) closeMenu();
      });
      window.addEventListener('orientationchange', function () { setTimeout(setDrawerTop, 120); });
      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') closeMenu();
      });
    }

    enhance();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  } else {
    install();
  }
}());
