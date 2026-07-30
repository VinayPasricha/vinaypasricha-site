// Serves the participant workspace with the focused adaptive home layered on top.
// The private Studio control is removed in the server-rendered shell, not hidden
// later by JavaScript, so participants never see it even during loading or errors.
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
let shell = null;

function focusedShell() {
  if (shell != null) return shell;
  const base = readFileSync(path.join(SITE_ROOT, 'ai-business-leaders', 'workspace-preview.html'), 'utf8');
  shell = base
    .replace(
      '<button id="studioMode">Vinay Studio</button>',
      '<button id="studioMode" type="button" hidden aria-hidden="true" tabindex="-1">Vinay Studio</button>'
    )
    .replace(
      '</head>',
      '<link rel="stylesheet" href="/ai-business-leaders/assignment-upload.css"></head>'
    )
    .replace(
      '</body>',
      '<script src="/ai-business-leaders/workspace-home-focus.js"></script>' +
      '<script src="/ai-business-leaders/participant-only-nav.js"></script>' +
      '<script src="/ai-business-leaders/assignment-upload-ui.js"></script></body>'
    );
  return shell;
}

export function registerFocusedWorkspaceRoute(app) {
  app.get('/ai-business-leaders/workspace/:slug', (req, res, next) => {
    try {
      res.set('Content-Type', 'text/html; charset=utf-8');
      res.set('Cache-Control', 'private, no-store');
      return res.send(focusedShell());
    } catch (e) {
      return next();
    }
  });

  // A no-login participant-only design route for rapid review on staging.
  app.get('/ai-business-leaders/focused-workspace-preview', (req, res, next) => {
    try {
      res.set('Content-Type', 'text/html; charset=utf-8');
      res.set('Cache-Control', 'no-store');
      return res.send(focusedShell());
    } catch (e) {
      return next();
    }
  });
}
