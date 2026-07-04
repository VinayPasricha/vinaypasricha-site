/* =============================================================
   studio.js — passphrase gate + shared helpers
   =============================================================
   v1: client-side only. The passphrase compares against a hash so
   the source doesn't reveal it. For real security, this should
   move to server-side auth. This is "keep casual visitors out",
   not "stop a determined attacker" — that's what real backend
   auth is for (planned v1.1, see prompt-studio-requirement.md).

   To change the passphrase: open studio/index.html in a fresh
   browser, open devtools console, run:
     await sha256('your-new-passphrase')
   then paste the resulting hex into PASSPHRASE_HASH below.
   ============================================================= */

// SHA-256 of 'vik123' — personal passphrase. Strengthen before public.
const PASSPHRASE_HASH = '536d21660e50d9ab4ca788dea02ff597c43ff1e55622953b8cb833d1039a8f4c';
// Allow simple bypass via the URL: ?key=vik123 (used by the Index menu's Studio link)
const DEV_KEY = 'vik123';

async function sha256(str) {
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function checkPassphrase(input) {
  if (input === DEV_KEY) return true;
  const hash = await sha256(input);
  return hash === PASSPHRASE_HASH;
}

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
