// Serves the established preparation and Initiative Builder shells with the
// shared participant-auth client inserted before their existing page scripts.
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

function authenticatedShell(file, appScript) {
  const source = readFileSync(path.join(SITE_ROOT, 'ai-business-leaders', file), 'utf8');
  if (source.includes('/ai-business-leaders/auth-client.js')) return source;
  const target = `<script src="/ai-business-leaders/${appScript}"></script>`;
  const auth = '<script src="/ai-business-leaders/auth-client.js"></script>\n  ';
  return source.replace(target, auth + target);
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
