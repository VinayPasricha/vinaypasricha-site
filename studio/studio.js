/* =============================================================
   studio.js — shared helpers
   =============================================================
   Access is controlled by the server-side studio gate (admin login
   → httpOnly cookie). This file reveals the operator UI after that
   gate has already let the request through, and fires studio:authed
   so admin pages can boot. There is no client-side passphrase.
   ============================================================= */

const AUTH_KEY = 'studio.authed';
const AUTH_TTL = 12 * 60 * 60 * 1000; // 12 hours

function isAuthed() {
  try {
    const v = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');
    return v && (Date.now() - v.at) < AUTH_TTL;
  } catch (e) { return false; }
}
function setAuthed() {
  localStorage.setItem(AUTH_KEY, JSON.stringify({ at: Date.now() }));
}
function clearAuthed() {
  localStorage.removeItem(AUTH_KEY);
}

function showStudio() {
  const auth = document.getElementById('studio-auth');
  const main = document.getElementById('studio-main');
  const signout = document.getElementById('studio-signout');
  if (auth) auth.style.display = 'none';
  if (main) main.style.display = '';
  if (signout) signout.style.display = '';
  document.dispatchEvent(new CustomEvent('studio:authed'));
}

function showAuth() {
  const auth = document.getElementById('studio-auth');
  const main = document.getElementById('studio-main');
  const signout = document.getElementById('studio-signout');
  if (auth) auth.style.display = '';
  if (main) main.style.display = 'none';
  if (signout) signout.style.display = 'none';
}

(function initAuth() {
  // Access is now controlled by the SERVER-side studio gate (admin login → secure
  // cookie). The legacy client-side passphrase is redundant, so reveal the studio
  // directly. The login page (and the inner #auth form) are no longer used.
  setAuthed();
  const reveal = () => showStudio();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', reveal);
  else reveal();

  const wire = () => {
    const signout = document.getElementById('studio-signout');
    if (signout) {
      signout.addEventListener('click', () => {
        clearAuthed();
        // Clear the server gate cookie, then return to the login page.
        fetch('/api/studio/logout', { method: 'POST' })
          .catch(() => {})
          .then(() => { window.location.href = '/studio/login'; });
      });
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();

// Expose for sub-pages
window.studioAuth = { isAuthed, setAuthed, clearAuthed, showStudio, showAuth };
