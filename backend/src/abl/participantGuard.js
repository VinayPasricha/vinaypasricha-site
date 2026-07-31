// Enforces passwordless participant authentication across every participant API.
// The public slug selects a workspace; it never grants access by itself.
import crypto from 'node:crypto';
import * as repo from './store.js';
import {
  bearerToken, verifyParticipantToken, hashParticipantToken, normalizeEmail,
} from './auth.js';

// An authenticated Studio admin (the __session cookie, matching the same
// passphrase hash the main gate uses, or the ADMIN_TOKEN master key) may open
// any participant's workspace read-only for support and review.
function studioAuthed(req) {
  const passphrase = String(process.env.STUDIO_PASSPHRASE || 'vik123').trim();
  const expected = passphrase ? crypto.createHash('sha256').update('studio:' + passphrase).digest('hex') : '';
  const cookies = {};
  String(req.headers.cookie || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > -1) cookies[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  if (expected && cookies.__session === expected) return true;
  return !!process.env.ADMIN_TOKEN && (req.get('x-admin-token') || '') === process.env.ADMIN_TOKEN;
}

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
    // Studio admins may view any workspace without a participant sign-in.
    if (studioAuthed(req)) {
      const participant = await repo.getParticipantBySlug(slug);
      if (!participant) return res.status(404).json({ ok: false, error: 'Workspace not found.' });
      req.ablParticipant = participant;
      req.ablAdminView = true;
      return next();
    }
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
