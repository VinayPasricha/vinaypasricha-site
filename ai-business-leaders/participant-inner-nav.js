/* Persistent navigation from participant tools back to the private workspace. */
(function () {
  'use strict';

  function workspaceUrl() {
    var parts = location.pathname.split('/').filter(Boolean);
    var slug = '';
    if (parts[0] === 'ai-business-leaders' && (parts[1] === 's' || parts[1] === 'course')) slug = parts[2] || '';
    if (!slug) return '/ai-business-leaders/login';
    return '/ai-business-leaders/workspace/' + encodeURIComponent(decodeURIComponent(slug));
  }

  function install() {
    if (document.getElementById('ablWorkspaceHomeLink')) return;
    var link = document.createElement('a');
    link.id = 'ablWorkspaceHomeLink';
    link.href = workspaceUrl();
    link.textContent = '← Workspace Home';
    link.setAttribute('aria-label', 'Return to AI Leadership Workspace home');

    var style = document.createElement('style');
    style.textContent = '#ablWorkspaceHomeLink{position:fixed;top:14px;left:14px;z-index:1000;display:inline-flex;align-items:center;min-height:42px;padding:0 14px;border:1px solid rgba(48,42,35,.18);border-radius:999px;background:rgba(251,248,241,.96);color:#1d1a17;text-decoration:none;font:600 10px/1 ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;box-shadow:0 8px 24px rgba(54,43,31,.1);backdrop-filter:blur(10px)}#ablWorkspaceHomeLink:hover{border-color:#b4472d;color:#b4472d}@media(max-width:600px){#ablWorkspaceHomeLink{top:10px;left:10px;min-height:40px;padding:0 12px;font-size:9px}}';
    document.head.appendChild(style);
    document.body.appendChild(link);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
}());
