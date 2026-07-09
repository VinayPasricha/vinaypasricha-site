// The one auth cookie.
//
// Firebase Hosting forwards ONLY a cookie named "__session" to Cloud Run (it
// strips every other cookie). So BOTH the studio (admin) session and the
// participant (portal) session must ride inside it. This module owns "__session"
// as a single signed JSON payload with two independent claims:
//   sh = the studio passphrase hash (admin gate)   — set by studio login
//   p  = the participant's account email (portal)   — set by OTP verify
// Each writer preserves the other's claim, so an admin and a participant session
// can coexist in the same browser.
import crypto from 'node:crypto';
import { config } from '../config.js';

const COOKIE = '__session';
const PORTAL_MS = 30 * 86400000; // portal session lifetime
const MAXAGE = 30 * 86400;       // cookie max-age (seconds)

function secret() { return config.otpSecret || 'dev-secret-change-me'; }
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
const mac = (body) => crypto.createHmac('sha256', secret()).update(body).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function cookiesOf(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > -1) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

// Verify the signature and return the claims. Never throws.
export function read(req) {
  const empty = { studioHash: '', portalEmail: '', portalTs: 0 };
  const raw = cookiesOf(req)[COOKIE];
  if (!raw) return empty;
  const dot = raw.lastIndexOf('.');
  if (dot < 1) return empty;
  const body = raw.slice(0, dot);
  if (mac(body) !== raw.slice(dot + 1)) return empty;
  try {
    const o = JSON.parse(unb64(body));
    return { studioHash: o.sh || '', portalEmail: o.p || '', portalTs: o.pt || 0 };
  } catch (e) { return empty; }
}

function build(claims) {
  const empty = !claims.studioHash && !claims.portalEmail;
  const body = b64(JSON.stringify({ sh: claims.studioHash || '', p: claims.portalEmail || '', pt: claims.portalTs || 0 }));
  const secure = process.env.K_SERVICE ? '; Secure' : '';
  return COOKIE + '=' + encodeURIComponent(body + '.' + mac(body))
    + '; HttpOnly; SameSite=Lax; Path=/; Max-Age=' + (empty ? 0 : MAXAGE) + secure;
}

// Set/clear the studio claim, preserving the portal claim (and vice-versa).
export function setStudio(req, studioHash) {
  const cur = read(req);
  return build({ studioHash: studioHash || '', portalEmail: cur.portalEmail, portalTs: cur.portalTs });
}
export function setPortal(req, email) {
  const cur = read(req);
  return build({ studioHash: cur.studioHash, portalEmail: email || '', portalTs: email ? Date.now() : 0 });
}

export function studioAuthed(req, expectedHash) {
  return !!expectedHash && read(req).studioHash === expectedHash;
}
export function portalEmail(req) {
  const s = read(req);
  if (!s.portalEmail) return null;
  if (Date.now() - (s.portalTs || 0) > PORTAL_MS) return null;
  return String(s.portalEmail).toLowerCase();
}
