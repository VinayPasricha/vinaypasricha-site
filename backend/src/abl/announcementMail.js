// Emailing an announcement to the participants it was published to.
//
// Uses the same Resend credential as the sign-in code, so nothing new has to be
// configured. Delivery is best-effort per recipient: one bad address must not
// stop the rest, and it must never stop the announcement itself from publishing.
import { config } from '../config.js';
import { COLLECTIONS } from '../firestore.js';
import * as repo from './store.js';

const FROM_NAME = 'AI for Business Leaders';
// Resend accepts more, but small batches keep one rejected address from taking
// a whole cohort's mail down with it.
const CONCURRENCY = 2;

export function emailConfigured() {
  return !!config.resendApiKey;
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Announcements are written as plain text in Studio. Preserve the author's
// paragraph breaks and nothing else — no markdown, no raw HTML passthrough.
function paragraphs(message) {
  return String(message || '').split(/\n{2,}/).map((block) => block.trim()).filter(Boolean)
    .map((block) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#2b2620">${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function announcementHtml({ title, message, linkUrl, workspaceUrl, firstName }) {
  const greeting = firstName ? `${escapeHtml(firstName)},` : 'Hello,';
  const cta = linkUrl
    ? `<p style="margin:24px 0 0"><a href="${escapeHtml(linkUrl)}" style="display:inline-block;background:#b4472d;color:#fff;text-decoration:none;padding:12px 18px;border-radius:6px;font-size:14px">Open the link</a></p>`
    : '';
  const workspace = workspaceUrl
    ? `<p style="margin:28px 0 0;font-size:13px;color:#6d6a64">Everything for the course lives in your workspace: <a href="${escapeHtml(workspaceUrl)}" style="color:#b4472d">${escapeHtml(workspaceUrl)}</a></p>`
    : '';
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;padding:32px">
  <p style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#b4472d;margin:0 0 18px">${FROM_NAME}</p>
  <h1 style="font-family:Georgia,serif;font-weight:400;font-size:26px;line-height:1.2;color:#1d1a17;margin:0 0 18px">${escapeHtml(title)}</h1>
  <p style="margin:0 0 16px;font-size:15px;color:#2b2620">${greeting}</p>
  ${paragraphs(message)}
  ${cta}
  ${workspace}
</div>`;
}

async function sendOne({ to, subject, html }, attempt = 0) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: config.ablFromEmail, to: [to], subject, html, reply_to: config.ablReplyTo }),
  });
  if (response.ok) return;
  // Rate limits (429) and transient server errors are retried with backoff,
  // honouring Retry-After — this is what turned a burst into 'failed' before.
  if ((response.status === 429 || response.status >= 500) && attempt < 5) {
    const retryAfter = Number(response.headers.get('retry-after')) || 0;
    const wait = retryAfter > 0 ? retryAfter * 1000 : Math.min(10000, 600 * Math.pow(2, attempt));
    await new Promise((r) => setTimeout(r, wait));
    return sendOne({ to, subject, html }, attempt + 1);
  }
  let detail = '';
  try { detail = JSON.stringify(await response.json()); } catch (e) { detail = `HTTP ${response.status}`; }
  throw new Error(detail);
}

// Who an announcement reaches, using the same audience rules the workspace API
// applies when deciding what a participant may see.
export async function announcementRecipients(announcement, db) {
  const all = await repo.listParticipants();
  const reachable = all.filter((p) => {
    if (p.login_enabled === false) return false;
    const email = String(p.email || '').trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  });
  const audience = announcement.audience || 'all';
  if (audience === 'cohorts') {
    const wanted = (announcement.cohort_ids || []).map(String);
    return reachable.filter((p) => wanted.includes(String(p.cohort_id || '')));
  }
  if (audience === 'participants') {
    const wanted = (announcement.participant_ids || []).map(String);
    return reachable.filter((p) => wanted.includes(String(p.id)));
  }
  return reachable;
}

// Send to every recipient, returning what happened rather than throwing: the
// announcement is already published, and the operator needs to see the outcome.
export async function sendAnnouncementEmails(announcement, { origin, onlyIds } = {}) {
  if (!emailConfigured()) {
    return { attempted: 0, sent: 0, failed: 0, skipped: 'email_not_configured' };
  }
  let recipients = await announcementRecipients(announcement);
  // A resend targets only specific participants (the ones a prior send missed).
  if (onlyIds && onlyIds.length) {
    const wanted = new Set(onlyIds.map(String));
    recipients = recipients.filter((p) => wanted.has(String(p.id)));
  }
  const subject = String(announcement.title || 'Course announcement').slice(0, 180);
  const failures = [];
  let sent = 0;

  const queue = recipients.slice();
  async function worker() {
    while (queue.length) {
      const p = queue.shift();
      const firstName = String(p.name || '').trim().split(/\s+/)[0] || '';
      const workspaceUrl = origin && p.slug ? `${origin}/ai-business-leaders/workspace/${encodeURIComponent(p.slug)}` : '';
      try {
        await sendOne({
          to: p.email,
          subject,
          html: announcementHtml({
            title: announcement.title,
            message: announcement.message,
            linkUrl: announcement.link_url,
            workspaceUrl,
            firstName,
          }),
        });
        sent += 1;
      } catch (e) {
        failures.push({ id: p.id, email: p.email, error: e.message });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));

  if (failures.length) {
    console.error('[abl-announcement] delivery failures:', failures.slice(0, 5));
  }
  return { attempted: recipients.length, sent, failed: failures.length, failures: failures.slice(0, 10), failedIds: failures.map((f) => f.id).filter(Boolean) };
}

export const ANNOUNCEMENT_COLLECTION = COLLECTIONS.ablAnnouncements;
