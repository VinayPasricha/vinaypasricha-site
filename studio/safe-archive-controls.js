/* Vinay Studio — safe archive controls for materials and assignments. */
(function () {
  'use strict';

  function showToast(message) {
    var toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(function () { toast.classList.remove('show'); }, 2600);
  }

  async function removeSafely(kind, id) {
    var response = await fetch('/api/abl/workspace/admin/' + kind + '/' + encodeURIComponent(id), {
      method: 'DELETE',
      headers: { Accept: 'application/json' }
    });
    var body = await response.json().catch(function () { return {}; });
    if (response.status === 401) {
      location.replace('/studio/login');
      throw new Error('Studio login required');
    }
    if (!response.ok || body.ok === false) throw new Error(body.error || 'Request failed');
    return body.data || {};
  }

  function itemStatus(card) {
    var pill = card && card.querySelector('.pill');
    return String(pill ? pill.textContent : '').trim().toLowerCase();
  }

  function prepareButtons() {
    document.querySelectorAll('[data-delete-material]').forEach(function (button) {
      var status = itemStatus(button.closest('[data-material]'));
      if (status === 'hidden') {
        button.textContent = 'Archived';
        button.disabled = true;
        button.title = 'This item is preserved in the archive.';
      } else {
        button.textContent = status === 'draft' ? 'Delete unused draft' : 'Archive';
        button.title = status === 'draft'
          ? 'Unused drafts may be permanently deleted. The server will archive anything already received by a participant.'
          : 'Remove from participant view while preserving the record.';
      }
    });

    document.querySelectorAll('[data-delete-assignment]').forEach(function (button) {
      var status = itemStatus(button.closest('[data-assignment]'));
      if (status === 'hidden') {
        button.textContent = 'Archived';
        button.disabled = true;
        button.title = 'This assignment and all participant work are preserved.';
      } else {
        button.textContent = status === 'draft' ? 'Delete unused draft' : 'Archive';
        button.title = status === 'draft'
          ? 'Only a draft with no participant work may be permanently deleted.'
          : 'Hide the assignment while preserving submissions and history.';
      }
    });
  }

  async function handle(button, kind, cardSelector, idAttribute) {
    if (button.disabled) return;
    var card = button.closest(cardSelector);
    if (!card) return;
    var id = card.getAttribute(idAttribute);
    var status = itemStatus(card);
    var draftMessage = kind === 'materials'
      ? 'Permanently delete this unused material draft? If it has ever reached a participant, it will be archived instead.'
      : 'Permanently delete this unused assignment draft? If any participant work exists, it will be archived instead.';
    var archiveMessage = kind === 'materials'
      ? 'Archive this material? Participants will no longer see it as active content, but the record will be preserved.'
      : 'Archive this assignment? Participant work and history will be preserved.';
    if (!confirm(status === 'draft' ? draftMessage : archiveMessage)) return;

    button.disabled = true;
    button.textContent = 'Working…';
    try {
      var result = await removeSafely(kind, id);
      showToast(result.action === 'deleted' ? 'Unused draft deleted' : 'Archived safely');
      setTimeout(function () { location.reload(); }, 500);
    } catch (error) {
      button.disabled = false;
      prepareButtons();
      showToast(error.message);
    }
  }

  document.addEventListener('click', function (event) {
    var materialButton = event.target.closest('[data-delete-material]');
    if (materialButton) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      handle(materialButton, 'materials', '[data-material]', 'data-material');
      return;
    }

    var assignmentButton = event.target.closest('[data-delete-assignment]');
    if (assignmentButton) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      handle(assignmentButton, 'assignments', '[data-assignment]', 'data-assignment');
    }
  }, true);

  var observer = new MutationObserver(prepareButtons);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', prepareButtons);
  else prepareButtons();
}());
