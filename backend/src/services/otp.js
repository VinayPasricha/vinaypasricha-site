// Email one-time-password for the Participant Room login.
//
// All server-side: the code is generated here, emailed via Resend, and verified
// here. It is stored HASHED in Firestore with a short expiry — the plaintext
// code only ever exists inside the email. Rate-limited per email to blunt abuse.
import crypto from 'node:crypto';
import { db } from '../firestore.js';
import { config } from '../config.js';

const COL = 'otp_codes';
const TTL_MS = 10 * 60 * 1000;          // code lifetime — 10 min
const MAX_ATTEMPTS = 5;                  // wrong tries before the code is burned
const RESEND_COOLDOWN_MS = 30 * 1000;    // min gap between sends to one address
const MAX_SENDS_PER_HOUR = 6;

const normEmail = (e) => String(e || '').trim().toLowerCase();
const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const emailKey = (email) => crypto.createHash('sha256').update(email).digest('hex');
const hashCode = (code, email) =>
  crypto.createHmac('sha256', config.otpSecret).update(code + '|' + email).digest('hex');
const genCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');

function emailHtml(code) {
  return '<div style="background:#f6f1e4;padding:44px 20px;font-family:Georgia,serif">'
    + '<div style="max-width:460px;margin:0 auto;background:#fbf8ef;border:1px solid #d9d1b9;border-radius:4px;padding:38px 40px">'
    + '<p style="font-family:monospace;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#8a2510;margin:0 0 20px">The Participant Room</p>'
    + '<h1 style="font-size:26px;font-weight:400;color:#1a1814;margin:0 0 10px">Your sign-in code</h1>'
    + '<p style="font-size:15px;line-height:1.55;color:#4a463c;margin:0 0 26px">Enter this code to open your room — your runtimes, your saved outputs, and the course.</p>'
    + '<div style="font-family:monospace;font-size:38px;letter-spacing:.32em;color:#1a1814;background:#f6f1e4;border:1px dashed #d9d1b9;border-radius:4px;text-align:center;padding:20px 0;margin:0 0 24px">' + code + '</div>'
    + '<p style="font-size:13px;line-height:1.5;color:#8a8471;margin:0">This code expires in 10 minutes. If you didn\'t request it, you can safely ignore this email.</p>'
    + '<hr style="border:0;border-top:1px solid #e9e1c9;margin:26px 0 16px">'
    + '<p style="font-family:monospace;font-size:10px;letter-spacing:.1em;color:#a89f85;margin:0">vinaypasricha.com</p>'
    + '</div></div>';
}

async function sendEmail(to, code) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + config.resendKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: config.otpFrom,
      to: [to],
      subject: code + ' is your sign-in code',
      text: code + ' is your one-time code for The Participant Room.\n\n'
        + 'It expires in 10 minutes. If you did not request this, ignore this email.\n\n— vinaypasricha.com',
      html: emailHtml(code),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error('resend_' + res.status + ': ' + detail.slice(0, 200));
  }
}

// POST /api/otp/send — generate, store (hashed), email. Never returns the code
// (except a dev echo when OTP_DEV_ECHO=1, for local/automated testing only).
export async function sendOtp({ email, name }) {
  email = normEmail(email);
  if (!isEmail(email)) return { ok: false, error: 'invalid_email' };
  if (!config.resendKey || !config.otpSecret) return { ok: false, error: 'otp_not_configured' };

  const ref = db.collection(COL).doc(emailKey(email));
  const now = Date.now();
  const snap = await ref.get();
  const rec = snap.exists ? snap.data() : null;

  if (rec) {
    if (rec.lastSent && now - rec.lastSent < RESEND_COOLDOWN_MS) {
      return { ok: false, error: 'cooldown', retryInMs: RESEND_COOLDOWN_MS - (now - rec.lastSent) };
    }
    if ((rec.sends || []).filter((t) => now - t < 3600000).length >= MAX_SENDS_PER_HOUR) {
      return { ok: false, error: 'too_many_requests' };
    }
  }

  const code = genCode();
  await ref.set({
    codeHash: hashCode(code, email),
    name: String(name || '').slice(0, 120),
    expires: now + TTL_MS,
    attempts: 0,
    lastSent: now,
    sends: [...((rec && rec.sends) || []).filter((t) => now - t < 3600000), now],
    expireAt: new Date(now + 3600000), // for an optional Firestore TTL policy
  });

  await sendEmail(email, code);
  return config.otpDevEcho ? { ok: true, devCode: code } : { ok: true };
}

// POST /api/otp/verify — check the code, one-time use.
export async function verifyOtp({ email, code }) {
  email = normEmail(email);
  code = String(code || '').trim();
  if (!isEmail(email) || !/^\d{6}$/.test(code)) return { ok: false, error: 'invalid' };

  const ref = db.collection(COL).doc(emailKey(email));
  const snap = await ref.get();
  const rec = snap.exists ? snap.data() : null;
  if (!rec || Date.now() > rec.expires) return { ok: false, error: 'expired' };
  if ((rec.attempts || 0) >= MAX_ATTEMPTS) { await ref.delete(); return { ok: false, error: 'locked' }; }

  const expected = hashCode(code, email);
  const good = rec.codeHash
    && rec.codeHash.length === expected.length
    && crypto.timingSafeEqual(Buffer.from(rec.codeHash), Buffer.from(expected));
  if (!good) {
    const attempts = (rec.attempts || 0) + 1;
    await ref.update({ attempts });
    return { ok: false, error: 'wrong', attemptsLeft: Math.max(0, MAX_ATTEMPTS - attempts) };
  }

  await ref.delete(); // one-time use
  return { ok: true, name: rec.name || null };
}
