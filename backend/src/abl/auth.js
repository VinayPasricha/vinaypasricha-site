import crypto from 'node:crypto';
import { config } from '../config.js';

const TOKEN_DAYS = 30;
const CODE_MINUTES = 10;

function secret() {
  return String(config.ablAuthSecret || '');
}

function b64(value) {
  return Buffer.from(value).toString('base64url');
}

function sign(value) {
  if (!secret()) return '';
  return crypto.createHmac('sha256', secret()).update(value).digest('base64url');
}

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

export function createLoginCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

export function hashLoginCode(email, code) {
  const value = `code:${normalizeEmail(email)}:${String(code || '').trim()}`;
  // Preview deployments may not have their long-lived signing secret yet.
  // A deterministic one-way digest still lets the short-lived code be checked
  // correctly instead of treating every code as the same empty signature.
  return secret()
    ? sign(value)
    : crypto.createHash('sha256').update(value).digest('base64url');
}

export function verifyLoginCode(email, code, expectedHash) {
  return safeEqual(hashLoginCode(email, code), expectedHash);
}

export function codeExpiry() {
  return new Date(Date.now() + CODE_MINUTES * 60 * 1000).toISOString();
}

export function createParticipantToken(participant) {
  if (!participant || !participant.id || !secret()) return '';
  const payload = b64(JSON.stringify({
    sub: participant.id,
    slug: participant.slug,
    exp: Date.now() + TOKEN_DAYS * 24 * 60 * 60 * 1000,
  }));
  return `abl.${payload}.${sign(`token:${payload}`)}`;
}

// When a deployment has not yet been given a signing secret, use a random
// opaque token whose hash is stored server-side. This remains secure across
// instances and avoids ever storing the bearer token itself.
export function createOpaqueParticipantToken() {
  return `ablr.${crypto.randomBytes(32).toString('base64url')}`;
}

export function hashParticipantToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

export function participantTokenExpiry() {
  return new Date(Date.now() + TOKEN_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export function verifyParticipantToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3 || parts[0] !== 'abl' || !secret()) return null;
  if (!safeEqual(parts[2], sign(`token:${parts[1]}`))) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (!payload.sub || !payload.slug || Number(payload.exp) <= Date.now()) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

export function bearerToken(req) {
  const header = String(req.get('authorization') || '');
  return /^Bearer\s+/i.test(header) ? header.replace(/^Bearer\s+/i, '').trim() : '';
}

export function isPreviewEnvironment() {
  return !process.env.K_SERVICE || /staging/i.test(process.env.K_SERVICE || '');
}

// Strictly a developer machine: Cloud Run always sets K_SERVICE, so this is
// false on every deployment including staging. Returning a sign-in code in the
// API response is safe here and nowhere else — on a deployed service it would
// let anyone who knows a participant's email sign in as them.
export function isLocalEnvironment() {
  return !process.env.K_SERVICE;
}

export async function deliverLoginCode({ email, code, name }) {
  if (!config.resendApiKey) {
    if (isLocalEnvironment()) return { delivered: false, preview: true };
    throw new Error('Participant email delivery is not configured.');
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.ablFromEmail,
      to: [email],
      subject: `${code} is your AI for Business Leaders sign-in code`,
      html: `<div style="font-family:Arial,sans-serif;color:#19243a;max-width:520px;margin:auto;padding:32px"><p style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#8d2f3c">AI for Business Leaders</p><h1 style="font-family:Georgia,serif;font-weight:400">Welcome${name ? `, ${String(name).replace(/[<>&\"]/g, '')}` : ''}</h1><p>Use this code to enter your private course workspace:</p><p style="font-size:32px;font-weight:700;letter-spacing:.18em">${code}</p><p style="color:#6d6a64">The code expires in ${CODE_MINUTES} minutes. If you did not request it, you can ignore this email.</p></div>`,
    }),
  });
  if (!response.ok) throw new Error('The sign-in email could not be sent.');
  return { delivered: true, preview: false };
}
