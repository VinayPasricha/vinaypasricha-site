// Passwordless participant sign-in for AI for Business Leaders.
//
// The participant types the email already held in Studio, receives a six-digit
// code, and exchanges it for a 30-day bearer session. A participant must first
// be invited/approved in Studio; merely existing in the directory grants no
// access and the request endpoint never reveals whether an email is registered.
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
const GENERIC_REQUEST_MESSAGE = 'If this email has active course access, a six-digit sign-in code is on its way.';

function participantCanSignIn(p) {
  if (!p || p.login_enabled === false) return false;
  return !!p.link_approved || p.invite_status === 'invited' || p.invite_status === 'active';
}

// Resolve the signed-in participant from the Authorization header. Signed
// tokens verify locally; opaque tokens are looked up in the session collection.
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

  // Step 1 — request a code. The response is deliberately identical for an
  // unknown, uninvited or active email so the participant directory cannot be
  // discovered by probing this endpoint.
  app.post('/api/abl/auth/request', requestLimit, async (req, res) => {
    try {
      const email = normalizeEmail(req.body && req.body.email);
      if (!validEmail(email)) return fail(res, 'Enter a valid email address.');
      const p = await repo.getParticipantByEmail(email);
      if (!participantCanSignIn(p)) {
        return ok(res, { message: GENERIC_REQUEST_MESSAGE });
      }

      const code = createLoginCode();
      await repo.saveAuthCode(email, {
        participant_id: p.id,
        code_hash: hashLoginCode(email, code),
        expires_at: codeExpiry(),
      });
      const delivery = await deliverLoginCode({ email, code, name: p.name });
      return ok(res, {
        message: GENERIC_REQUEST_MESSAGE,
        // Developer machines can display the code. No deployed service—staging
        // included—ever receives it in the response.
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

      const p = await repo.getParticipant(saved.participant_id);
      if (!participantCanSignIn(p) || normalizeEmail(p.email) !== email) {
        await repo.consumeAuthCode(email);
        return fail(res, 'This course access is not active.', 403);
      }

      let token = createParticipantToken(p);
      if (!token) {
        token = createOpaqueParticipantToken();
        await repo.saveParticipantSession(hashParticipantToken(token), {
          participant_id: p.id, slug: p.slug, expires_at: participantTokenExpiry(),
        });
      }
      await repo.consumeAuthCode(email);
      await repo.updateParticipant(p.id, { invite_status: 'active', last_activity_at: new Date().toISOString() });
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

  // Does this device still hold a valid session? Used by the sign-in page and
  // the homepage banner to resume the correct private workspace.
  app.get('/api/abl/auth/status', async (req, res) => {
    try {
      const payload = await participantPayload(req);
      if (!payload) return fail(res, 'Sign-in required.', 401);
      const p = await repo.getParticipant(payload.sub);
      if (!participantCanSignIn(p) || p.slug !== payload.slug) return fail(res, 'Sign-in required.', 401);
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
      res.set('Cache-Control', 'private, no-store');
      return res.send(loginShell);
    } catch (e) { return next(); }
  });
}
