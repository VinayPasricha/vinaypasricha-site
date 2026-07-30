/* Participant-facing workspace chrome. Vinay Studio is private and never appears here. */
(function () {
  'use strict';

  function applyParticipantOnlyChrome() {
    // In the real signed-in workspace, bootLive replaces this area with Sign out.
    // Do not interfere with that asynchronous authentication flow.
    if (typeof ABL_SLUG !== 'undefined' && ABL_SLUG) return;

    if (typeof S !== 'undefined') {
      S.mode = 'participant';
      if (!S.page) S.page = 'home';
    }

    var switcher = document.querySelector('.switch');
    if (switcher) {
      switcher.innerHTML = '<span class="participant-only-mark">Participant Workspace</span>';
    }

    if (!document.getElementById('participantOnlyStyles')) {
      var style = document.createElement('style');
      style.id = 'participantOnlyStyles';
      style.textContent =
        '.participant-only-mark{display:inline-flex;align-items:center;min-height:38px;padding:0 12px;border:1px solid var(--rule);border-radius:999px;color:var(--muted);font:500 9px/1 var(--mono);letter-spacing:.09em;text-transform:uppercase;background:rgba(251,248,241,.72)}' +
        '@media(max-width:600px){.participant-only-mark{min-height:34px;padding:0 9px;font-size:8px}}';
      document.head.appendChild(style);
    }

    if (typeof render === 'function' && typeof S !== 'undefined') render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyParticipantOnlyChrome);
  } else {
    applyParticipantOnlyChrome();
  }
}());
