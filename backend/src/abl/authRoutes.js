// Passwordless participant sign-in for AI for Business Leaders.
//
// The flow is deliberately small: a participant types the email Vinay already
// preloaded, receives a six-digit code, and exchanges it for a 30-day token.
// Presence in the participant list IS the access decision — there is no
// separate password or invite state to keep in sync.
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as repo from './store.js';
import {
  normalizeEmail, validEmail, createLoginCode, hashLoginCode, verifyLoginCode, codeExpiry,
  createParticipantToken, createOpaqueParticipantToken, hashParticipantToken,
  participantTokenExpiry, verifyParticipantToken, bearerToken, isLocalEnvironment,
  deliverLoginCode,
} from './auth.js';

const SITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ok = (res, data, code = 200) => res.status(code).json({ ok: true, data });
const fail = (res, error, code = 400) => res.status(code).json({ ok: false, error });

// Resolve the signed-in participant from the Authorization header. Signed
// tokens verify locally; opaque tokens (no signing secret configured) are
// looked up in the session collection.
async function participantPayload(req) {
  const token = bearerToken(req);
  if (!token) return null;
  const signed = verifyParticipantToken(token);
  if (signed) return signed;
  const session = await repo.getParticipantSession(hashParticipantToken(token));
  if (!session) return null;
  if (Number.isNaN(Date.parse(session.expires_at)) || Date.parse(session.expires_at) <= Date.now()) return null;
  return { sub: session.participant_id, slug: session.slug };
}

export function registerAuthRoutes(app, { rateLimit }) {
  const requestLimit = rateLimit({ windowMs: 60000, max: 6 });
  const verifyLimit = rateLimit({ windowMs: 60000, max: 12 });

  // Step 1 — the participant types their course email; we email a code.
  app.post('/api/abl/auth/request', requestLimit, async (req, res) => {
    try {
      const email = normalizeEmail(req.body && req.body.email);
      if (!validEmail(email)) return fail(res, 'Enter a valid email address.');
      const p = await repo.getParticipantByEmail(email);
      if (!p || p.login_enabled === false) {
        return fail(res, 'This email is not registered for the course. Please contact Vinay at Vinay@goodspace.ai to get access.', 403);
      }
      const code = createLoginCode();
      await repo.saveAuthCode(email, {
        participant_id: p.id,
        code_hash: hashLoginCode(email, code),
        expires_at: codeExpiry(),
      });
      const delivery = await deliverLoginCode({ email, code, name: p.name });
      return ok(res, {
        message: 'Your sign-in code is on its way.',
        // On a developer machine with no mail provider the code is returned so
        // the flow stays testable. Never on a deployed service — there a
        // missing RESEND_API_KEY fails loudly instead of exposing the code.
        preview_code: delivery.preview && isLocalEnvironment() ? code : undefined,
      });
    } catch (e) {
      console.error('[abl-auth] request error:', e.message);
      return fail(res, 'The sign-in code could not be sent. Please try again shortly.', 503);
    }
  });

  // Step 2 — exchange the code for a participant token and workspace URL.
  app.post('/api/abl/auth/verify', verifyLimit, async (req, res) => {
    try {
      const email = normalizeEmail(req.body && req.body.email);
      const code = String((req.body && req.body.code) || '').replace(/\s/g, '');
      if (!validEmail(email) || !/^\d{6}$/.test(code)) return fail(res, 'Enter the six-digit code from your email.');
      const saved = await repo.getAuthCode(email);
      const expired = !saved || Number.isNaN(Date.parse(saved.expires_at)) || Date.parse(saved.expires_at) <= Date.now();
      const exhausted = saved && Number(saved.attempts || 0) >= 5;
      if (expired || exhausted || !verifyLoginCode(email, code, saved && saved.code_hash)) {
        if (saved) await repo.incrementAuthAttempts(email);
        return fail(res, 'That code is incorrect or has expired.', 401);
      }
      let p = await repo.getParticipant(saved.participant_id);
      if (!p || p.login_enabled === false || normalizeEmail(p.email) !== email) {
        return fail(res, 'This course access is not active.', 403);
      }
      // Presence in the preloaded participant list is the access decision.
      // Verified email ownership activates older draft records automatically.
      if (!p.link_approved) {
        p = await repo.updateParticipant(p.id, {
          link_approved: true, status: 'link_ready', approved_at: new Date().toISOString(),
        });
      }
      let token = createParticipantToken(p);
      if (!token) {
        token = createOpaqueParticipantToken();
        await repo.saveParticipantSession(hashParticipantToken(token), {
          participant_id: p.id, slug: p.slug, expires_at: participantTokenExpiry(),
        });
      }
      await repo.consumeAuthCode(email);
      await repo.touchActivity(p.id);
      return ok(res, {
        token,
        participant: { name: p.name, company_name: p.company_name, email: p.email },
        workspace: `/ai-business-leaders/workspace/${encodeURIComponent(p.slug)}`,
        expires_in_days: 30,
      });
    } catch (e) {
      console.error('[abl-auth] verify error:', e.message);
      return fail(res, 'Server error', 500);
    }
  });

  // Does this device still hold a valid session? Used by the workspace shell.
  app.get('/api/abl/auth/status', async (req, res) => {
    try {
      const payload = await participantPayload(req);
      if (!payload) return fail(res, 'Sign-in required.', 401);
      const p = await repo.getParticipant(payload.sub);
      if (!p || p.slug !== payload.slug || p.login_enabled === false || !p.link_approved) {
        return fail(res, 'Sign-in required.', 401);
      }
      return ok(res, {
        participant: { name: p.name, company_name: p.company_name, email: p.email },
        workspace: `/ai-business-leaders/workspace/${encodeURIComponent(p.slug)}`,
      });
    } catch (e) {
      return fail(res, 'Server error', 500);
    }
  });

  // The sign-in page itself (clean URL, no .html).
  let loginShell = null;
  app.get('/ai-business-leaders/login', (req, res, next) => {
    try {
      if (loginShell == null) loginShell = readFileSync(path.join(SITE_ROOT, 'ai-business-leaders', 'login.html'), 'utf8');
      res.set('Content-Type', 'text/html; charset=utf-8');
      return res.send(loginShell);
    } catch (e) { return next(); }
  });
}
