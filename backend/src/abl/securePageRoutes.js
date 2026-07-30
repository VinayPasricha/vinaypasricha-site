// Serves the established preparation and Initiative Builder shells with the
// shared participant-auth client and persistent Workspace Home navigation.
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

function authenticatedShell(file, appScript) {
  const source = readFileSync(path.join(SITE_ROOT, 'ai-business-leaders', file), 'utf8');
  const target = `<script src="/ai-business-leaders/${appScript}"></script>`;
  const scripts = [
    source.includes('/ai-business-leaders/auth-client.js') ? '' : '<script src="/ai-business-leaders/auth-client.js"></script>',
    source.includes('/ai-business-leaders/participant-inner-nav.js') ? '' : '<script src="/ai-business-leaders/participant-inner-nav.js"></script>',
  ].filter(Boolean).join('\n  ');
  return scripts ? source.replace(target, scripts + '\n  ' + target) : source;
}

export function registerSecureParticipantPages(app) {
  let sessionShell = null;
  let courseShell = null;

  app.get('/ai-business-leaders/s/:slug', (req, res, next) => {
    try {
      if (sessionShell == null) sessionShell = authenticatedShell('session.html', 'session.js');
      res.set('Content-Type', 'text/html; charset=utf-8');
      res.set('Cache-Control', 'private, no-store');
      return res.send(sessionShell);
    } catch (e) { return next(); }
  });

  app.get('/ai-business-leaders/course/:slug', (req, res, next) => {
    try {
      if (courseShell == null) courseShell = authenticatedShell('course.html', 'course.js');
      res.set('Content-Type', 'text/html; charset=utf-8');
      res.set('Cache-Control', 'private, no-store');
      return res.send(courseShell);
    } catch (e) { return next(); }
  });
}
