// Enforces passwordless participant authentication across every participant API.
// The public slug selects a workspace; it never grants access by itself.
import * as repo from './store.js';
import {
  bearerToken, verifyParticipantToken, hashParticipantToken, normalizeEmail,
} from './auth.js';

function protectedSlug(pathname) {
  const path = String(pathname || '');
  if (path.startsWith('/api/abl/auth/')) return null;
  if (path.startsWith('/api/abl/workspace/admin/')) return null;
  const match = path.match(/^\/api\/abl\/(?:session|course|workspace)\/([^/]+)/);
  if (!match) return null;
  try { return decodeURIComponent(match[1]); }
  catch (e) { return match[1]; }
}

async function payloadFromRequest(req) {
  const token = bearerToken(req);
  if (!token) return null;

  const signed = verifyParticipantToken(token);
  if (signed) return signed;

  const session = await repo.getParticipantSession(hashParticipantToken(token));
  if (!session) return null;
  const expires = Date.parse(session.expires_at || '');
  if (!Number.isFinite(expires) || expires <= Date.now()) return null;
  return { sub: session.participant_id, slug: session.slug };
}

export async function participantApiGuard(req, res, next) {
  const slug = protectedSlug(req.path);
  if (!slug) return next();

  try {
    const payload = await payloadFromRequest(req);
    if (!payload || !payload.sub || !payload.slug) {
      return res.status(401).json({ ok: false, error: 'Sign-in required.' });
    }
    if (String(payload.slug) !== String(slug)) {
      return res.status(403).json({ ok: false, error: 'This sign-in does not have access to that workspace.' });
    }

    const participant = await repo.getParticipant(payload.sub);
    if (!participant || participant.slug !== payload.slug || participant.login_enabled === false || !participant.link_approved) {
      return res.status(401).json({ ok: false, error: 'Sign-in required.' });
    }
    if (payload.email && normalizeEmail(participant.email) !== normalizeEmail(payload.email)) {
      return res.status(401).json({ ok: false, error: 'Sign-in required.' });
    }

    req.ablParticipant = participant;
    return next();
  } catch (e) {
    console.error('[abl-auth] participant guard:', e.message);
    return res.status(401).json({ ok: false, error: 'Sign-in required.' });
  }
}
