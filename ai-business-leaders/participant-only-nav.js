/* Participant-facing workspace chrome. Vinay Studio is private and never appears here. */
(function () {
  'use strict';

  function goHome() {
    if (typeof S === 'undefined') return;
    S.mode = 'participant';
    S.page = 'home';
    if (typeof save === 'function') save();
    if (typeof render === 'function') render();
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
      '@media(max-width:600px){.participant-only-mark{min-height:34px;padding:0 9px;font-size:8px}.workspace-home-return{position:sticky;top:78px;z-index:12;width:max-content;min-height:40px;margin-bottom:16px;box-shadow:0 8px 22px rgba(54,43,31,.08)}}';
    document.head.appendChild(style);
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
    enhance();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  } else {
    install();
  }
}());
