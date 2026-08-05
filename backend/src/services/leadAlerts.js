// Urgent-lead alerts: when someone submits the high-intent lead form
// (js/lead-form.js), Vinay hears about it immediately — by email (Resend)
// and Slack (bot-token DM preferred, incoming webhook as fallback).
//
// Both sends are best-effort and independent: a Slack outage never blocks
// the email, and neither blocks the form's success response beyond the
// awaited send itself (Cloud Run throttles CPU after the response, so we
// must await rather than fire-and-forget).
import { config } from '../config.js';

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function trim(s, n) {
  const v = String(s || '').trim();
  return v.length > n ? v.slice(0, n - 1) + '…' : v;
}

function emailBody(lead) {
  const row = (label, value) =>
    value
      ? `<tr><td style="padding:6px 14px 6px 0;color:#6b665a;font-size:12px;text-transform:uppercase;letter-spacing:.08em;vertical-align:top;white-space:nowrap">${label}</td><td style="padding:6px 0;color:#1a1814;font-size:15px">${esc(value)}</td></tr>`
      : '';
  return `
  <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:8px 0">
    <p style="font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#8a2510;margin:0 0 6px">Priority lead · ${esc(lead.form)}</p>
    <h2 style="font-weight:400;font-size:22px;margin:0 0 18px;color:#1a1814">${esc(lead.name)} wants to implement AI${lead.company ? ' at ' + esc(lead.company) : ''}.</h2>
    <table style="border-collapse:collapse">
      ${row('Name', lead.name)}
      ${row('Email', lead.email)}
      ${row('Company', lead.company)}
      ${row('Role', lead.role)}
      ${row('From page', lead.path)}
      ${row('Placement', lead.context)}
    </table>
    <div style="margin:18px 0;padding:16px 18px;border-left:2px solid #8a2510;background:#f6f1e4;color:#1a1814;font-size:15px;line-height:1.6">${esc(lead.message)}</div>
    <p style="color:#6b665a;font-size:13px">Reply to this email to reply to ${esc(lead.name)} directly.</p>
  </div>`;
}

function slackText(lead) {
  const lines = [
    `:rotating_light: *Priority lead — ${lead.form}*`,
    `*${trim(lead.name, 80)}*${lead.role ? ' · ' + trim(lead.role, 60) : ''}${lead.company ? ' · ' + trim(lead.company, 80) : ''}`,
    `${trim(lead.email, 120)}`,
    `> ${trim(lead.message, 600)}`,
    `_From ${lead.path || 'the site'}${lead.context ? ' · ' + lead.context : ''}_`,
  ];
  return lines.join('\n');
}

async function sendEmailAlert(lead) {
  if (!config.resendApiKey || !config.leadAlertEmail) return { configured: false, sent: false, error: '' };
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: config.leadFromEmail,
        to: [config.leadAlertEmail],
        reply_to: lead.email,
        subject: `Priority lead: ${trim(lead.name, 60)}${lead.company ? ' — ' + trim(lead.company, 60) : ''}`,
        html: emailBody(lead),
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(String(body.message || body.error || `Resend ${response.status}`).slice(0, 240));
    return { configured: true, sent: true, error: '' };
  } catch (err) {
    console.warn('[leadAlerts] email failed:', err.message);
    return { configured: true, sent: false, error: err.message };
  }
}

async function sendSlackAlert(lead) {
  // Preferred: bot token DM straight to Vinay.
  if (config.growthSlackBotToken && config.growthVinaySlackUserId) {
    try {
      const open = await fetch('https://slack.com/api/conversations.open', {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.growthSlackBotToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: config.growthVinaySlackUserId }),
      }).then((r) => r.json());
      if (!open.ok) throw new Error(`Slack conversations.open: ${open.error}`);
      const post = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.growthSlackBotToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: open.channel.id, text: slackText(lead) }),
      }).then((r) => r.json());
      if (!post.ok) throw new Error(`Slack chat.postMessage: ${post.error}`);
      return { configured: true, sent: true, error: '' };
    } catch (err) {
      console.warn('[leadAlerts] slack failed:', err.message);
      return { configured: true, sent: false, error: err.message };
    }
  }
  // Fallback: incoming webhook (posts wherever the webhook points).
  if (config.growthSlackWebhookUrl) {
    try {
      const response = await fetch(config.growthSlackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: slackText(lead) }),
      });
      if (!response.ok) throw new Error(`Slack webhook ${response.status}`);
      return { configured: true, sent: true, error: '' };
    } catch (err) {
      console.warn('[leadAlerts] slack failed:', err.message);
      return { configured: true, sent: false, error: err.message };
    }
  }
  return { configured: false, sent: false, error: '' };
}

export async function alertPriorityLead(lead) {
  const [email, slack] = await Promise.all([sendEmailAlert(lead), sendSlackAlert(lead)]);
  return { email, slack };
}
