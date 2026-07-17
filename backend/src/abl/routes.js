// ABL routes, mounted into the site's Express app. Participant endpoints are
// public (guarded by the unguessable slug); admin endpoints reuse the site's
// studio gate via the shared requireAdmin middleware.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import PDFDocument from 'pdfkit';
import * as repo from './store.js';
import {
  agentTurn,
  generateOutput,
  rewardTypeForDepth,
  researchCompany,
  openingTurn,
  generateRewardBundle,
  generateSivReport,
  generateVedReport,
} from './service.js';
import { REWARD_TITLES, SOFT_WARN_AT } from './copy.js';
import { COURSE_RUNTIME_MODES } from './course-runtimes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = path.resolve(__dirname, '..', '..', '..');

const ok = (res, data, code = 200) => res.status(code).json({ ok: true, data });
const fail = (res, error, code = 400) => res.status(code).json({ ok: false, error });
// 500s: log the real error server-side, return a generic message (never leak internals).
function oops(res, e) { console.error('[abl] route error:', (e && e.stack) || e); return res.status(500).json({ ok: false, error: 'Server error' }); }
const noLimit = (req, res, next) => next();

// tiny markdown -> HTML for the printable document view (server-side)
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function mdToHtml(md) {
  const lines = String(md || '').replace(/\r/g, '').split('\n');
  let html = '', inList = false, tbuf = [];
  const inline = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/`(.+?)`/g, '<code>$1</code>');
  const closeList = () => { if (inList) { html += '</ul>'; inList = false; } };
  const isRow = (l) => /^\s*\|.*\|\s*$/.test(l);
  const isSep = (l) => /^\s*\|[\s:|-]+\|\s*$/.test(l);
  const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const flushTable = () => {
    if (!tbuf.length) return;
    if (tbuf.length >= 2 && isSep(tbuf[1])) {
      html += '<table class="mdt"><thead><tr>' + cells(tbuf[0]).map((h) => `<th>${inline(h)}</th>`).join('') + '</tr></thead><tbody>';
      tbuf.slice(2).forEach((r) => { html += '<tr>' + cells(r).map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>'; });
      html += '</tbody></table>';
    } else { tbuf.forEach((r) => { html += `<p>${inline(r)}</p>`; }); }
    tbuf = [];
  };
  for (const raw of lines) {
    const l = raw.trimEnd();
    let m;
    if (isRow(l)) { closeList(); tbuf.push(l); continue; }
    flushTable();
    if ((m = l.match(/^######\s+(.*)/))) { closeList(); html += `<h6>${inline(m[1])}</h6>`; }
    else if ((m = l.match(/^###\s+(.*)/))) { closeList(); html += `<h3>${inline(m[1])}</h3>`; }
    else if ((m = l.match(/^##\s+(.*)/))) { closeList(); html += `<h2>${inline(m[1])}</h2>`; }
    else if ((m = l.match(/^#\s+(.*)/))) { closeList(); html += `<h1>${inline(m[1])}</h1>`; }
    else if (/^(-{3,}|_{3,})$/.test(l)) { closeList(); html += '<hr>'; }
    else if ((m = l.match(/^\s*[-*]\s+(.*)/))) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${inline(m[1])}</li>`; }
    else if (!l.trim()) { closeList(); }
    else { closeList(); html += `<p>${inline(l)}</p>`; }
  }
  flushTable();
  closeList();
  return html;
}

// ---- real branded PDF (pdfkit, no browser) --------------------------------
function mdSegments(text) {
  return String(text).split(/(\*\*[^*]+\*\*)/g).filter((s) => s.length).map((s) =>
    /^\*\*[^*]+\*\*$/.test(s) ? { b: true, t: s.slice(2, -2) } : { b: false, t: s });
}
function pdfPara(doc, text, ink, prefix) {
  doc.fillColor(ink).fontSize(11);
  const segs = mdSegments((prefix || '') + text);
  segs.forEach((seg, i) => doc.font(seg.b ? 'Times-Bold' : 'Times-Roman').text(seg.t, { continued: i < segs.length - 1, lineGap: 2 }));
  doc.moveDown(0.3);
}
function streamPdf(res, { title, who, date, md, filename }) {
  const INK = '#1a1714', MUTED = '#6b6157', ACCENT = '#b5462a', RULE = '#d9d1b9';
  const doc = new PDFDocument({ size: 'A4', margins: { top: 64, bottom: 64, left: 64, right: 64 } });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="' + (filename || 'document') + '.pdf"');
  doc.pipe(res);

  doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(9).text('AI FOR BUSINESS LEADERS', { characterSpacing: 2 });
  doc.moveDown(0.4).fillColor(INK).font('Times-Bold').fontSize(22).text(title || 'Document');
  if (who) doc.moveDown(0.15).fillColor(MUTED).font('Times-Italic').fontSize(12).text(who);
  if (date) doc.moveDown(0.1).fillColor(MUTED).font('Helvetica').fontSize(9).text(date);
  doc.moveDown(0.6);
  const y = doc.y; doc.strokeColor(RULE).lineWidth(1).moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y).stroke();
  doc.moveDown(0.7);

  const lines = String(md || '').replace(/\r/g, '').split('\n');
  for (const raw of lines) {
    const l = raw.replace(/\s+$/, ''); let m;
    if ((m = l.match(/^#\s+(.*)/))) { doc.moveDown(0.4).fillColor(INK).font('Times-Bold').fontSize(17).text(m[1].replace(/\*\*/g, '')); doc.moveDown(0.2); }
    else if ((m = l.match(/^##\s+(.*)/))) { doc.moveDown(0.45).fillColor(ACCENT).font('Helvetica-Bold').fontSize(11).text(m[1].replace(/\*\*/g, '').toUpperCase(), { characterSpacing: 1 }); doc.moveDown(0.2); }
    else if ((m = l.match(/^###\s+(.*)/))) { doc.moveDown(0.3).fillColor(INK).font('Times-Bold').fontSize(12.5).text(m[1].replace(/\*\*/g, '')); doc.moveDown(0.1); }
    else if (/^(-{3,}|_{3,})$/.test(l)) { doc.moveDown(0.3); }
    else if ((m = l.match(/^\s*[-*]\s+(.*)/))) { pdfPara(doc, m[1], INK, '•  '); }
    else if (!l.trim()) { doc.moveDown(0.3); }
    else { pdfPara(doc, l, INK); }
  }
  doc.end();
}

export function registerAbl(app, { requireAdmin, rateLimit, studioAuthed }) {
  // Per-endpoint limiters (fall back to no-op if the host didn't pass a factory).
  const mk = (opts) => (typeof rateLimit === 'function' ? rateLimit(opts) : noLimit);
  const chatLimit = mk({ windowMs: 60000, max: 25 });     // participant chat turns
  const rewardLimit = mk({ windowMs: 60000, max: 6 });    // reward/summary generation
  const researchLimit = mk({ windowMs: 60000, max: 12 }); // grounded auto-research
  const isAuthed = (req) => (typeof studioAuthed === 'function' ? studioAuthed(req) : false);

  // -------------------------------------------------------------------------
  // Participant experience (public — the slug is the key)
  // -------------------------------------------------------------------------
  app.get('/api/abl/session/:slug', async (req, res) => {
    try {
      const p = await repo.getParticipantBySlug(req.params.slug);
      if (!p) return fail(res, 'Session not found', 404);
      if (!p.link_approved) return fail(res, 'This session is not active yet.', 403);
      const session = await repo.getOrCreateSession(p.id, 'participant');
      const messages = (await repo.listMessages(session.id))
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content, at: m.created_at, options: (m.metadata && m.metadata.options) || [] }));
      // Once a journey is chosen + consent given, open with the agent's greeting
      // so the participant is never staring at an empty box.
      if (!messages.length && session.consent_given && session.selected_depth) {
        const opening = await openingTurn({ participant: p, session });
        if (opening && opening.say) messages.push({ role: 'assistant', content: opening.say, options: opening.options || [], at: new Date().toISOString() });
      }
      const outputs = await repo.getOutputs(p.id);
      const reward = outputs.find((o) => ['course_preparation_brief', 'use_case_map', 'strategy_note'].includes(o.output_type)) || null;
      const share = outputs.find((o) => o.output_type === 'share_summary') || null;
      const [vedSession, sivSession] = await Promise.all([
        repo.getSession(p.id, 'ved'),
        repo.getSession(p.id, 'siv'),
      ]);
      const vedReport = outputs.find((o) => o.output_type === 'ved_report') || null;
      const sivReport = outputs.find((o) => o.output_type === 'siv_report') || null;
      return ok(res, {
        participant: { name: p.name, company_name: p.company_name, role_title: p.role_title,
          status: p.status, current_stage: p.current_stage, message_count: p.message_count, max_messages: p.max_messages,
          feedback_rating: p.feedback_rating || 0 },
        session: { selected_depth: session.selected_depth, consent_given: session.consent_given,
          current_stage: session.current_stage, summary_reviewed: session.summary_reviewed },
        messages,
        reward: reward ? { id: reward.id, type: reward.output_type, markdown: reward.content_markdown } : null,
        share: share ? { id: share.id, markdown: share.reviewed_content_markdown ?? share.content_markdown, approved: share.participant_approved } : null,
        runtimes: {
          ved: { started: !!(vedSession && vedSession.consent_given), complete: !!vedReport },
          siv: { started: !!(sivSession && sivSession.selected_depth), complete: !!sivReport },
        },
      });
    } catch (e) { return oops(res, e); }
  });

  app.post('/api/abl/session/:slug', async (req, res) => {
    try {
      const body = req.body || {};
      const p = await repo.getParticipantBySlug(req.params.slug);
      if (!p) return fail(res, 'Session not found', 404);
      if (!p.link_approved) return fail(res, 'This session is not active yet.', 403);
      const session = await repo.getOrCreateSession(p.id, 'participant');
      const patch = {};
      if (body.depth && ['15', '30', '45'].includes(body.depth)) { patch.selected_depth = body.depth; patch.current_stage = 'personalisation'; }
      if (typeof body.consent === 'boolean') patch.consent_given = body.consent;
      const updated = await repo.updateSession(session.id, patch);
      if (patch.current_stage) await repo.updateParticipant(p.id, { current_stage: 'personalisation', selected_depth: updated.selected_depth });
      return ok(res, { session: { selected_depth: updated.selected_depth, consent_given: updated.consent_given, current_stage: updated.current_stage } });
    } catch (e) { return oops(res, e); }
  });

  app.post('/api/abl/session/:slug/message', chatLimit, async (req, res) => {
    try {
      const msg = String((req.body && req.body.message) || '').trim();
      if (!msg) return fail(res, 'Empty message');
      if (msg.length > 6000) return fail(res, 'Message too long');
      const p = await repo.getParticipantBySlug(req.params.slug);
      if (!p) return fail(res, 'Session not found', 404);
      if (!p.link_approved) return fail(res, 'This session is not active yet.', 403);
      if ((p.message_count || 0) >= (p.max_messages || 200)) {
        return fail(res, "You have reached this session's message limit. Your session is saved — please continue in your meeting with Vinay.", 429);
      }
      const session = await repo.getOrCreateSession(p.id, 'participant');
      if (!session.consent_given) return fail(res, 'Please accept the privacy notice to begin.', 403);
      const { reply, options, messageCount } = await agentTurn({ participant: p, session, userMessage: msg, mode: 'participant' });
      return ok(res, { reply, options: options || [], message_count: messageCount, max_messages: p.max_messages, soft_warn: messageCount >= SOFT_WARN_AT });
    } catch (e) { return oops(res, e); }
  });

  app.post('/api/abl/session/:slug/reward', rewardLimit, async (req, res) => {
    try {
      const p = await repo.getParticipantBySlug(req.params.slug);
      if (!p) return fail(res, 'Session not found', 404);
      if (!p.link_approved) return fail(res, 'This session is not active yet.', 403);
      const session = await repo.getOrCreateSession(p.id, 'participant');
      // ONLY the participant's reward + share summary block this response — both run
      // on the fast chat model (~10-15s). Vinay's meeting brief uses the slower Pro
      // model; awaiting it here pushed the total past Firebase Hosting's 60s proxy
      // limit, which killed the request and left the participant stuck on
      // "Preparing…" (the doc only appeared on refresh). So the brief is now fired
      // best-effort in the background — and can always be (re)generated from Studio.
      const { rewardType, rewardMd, shareMd } = await generateRewardBundle(p, session.selected_depth);
      generateOutput(p, 'vinay_meeting_brief').catch((e) => console.error('[abl] auto-brief failed:', e.message));
      await repo.updateSession(session.id, { current_stage: 'summary_review' });
      await repo.updateParticipant(p.id, { current_stage: 'summary_review' });
      const reward = await repo.getLatestOutput(p.id, rewardType);
      const share = await repo.getLatestOutput(p.id, 'share_summary');
      return ok(res, { reward: { id: reward.id, type: rewardType, markdown: rewardMd }, share: { id: share.id, markdown: shareMd } });
    } catch (e) { return oops(res, e); }
  });

  app.post('/api/abl/session/:slug/review', async (req, res) => {
    try {
      const body = req.body || {};
      const p = await repo.getParticipantBySlug(req.params.slug);
      if (!p) return fail(res, 'Session not found', 404);
      if (!p.link_approved) return fail(res, 'This session is not active yet.', 403);
      const share = await repo.getLatestOutput(p.id, 'share_summary');
      if (!share) return fail(res, 'No summary to review yet.', 400);
      const base = body.reviewed_markdown ?? share.reviewed_content_markdown ?? share.content_markdown ?? '';
      const finalMd = body.note && body.note.trim() ? `${base}\n\n---\n\n**Note to Vinay:** ${body.note.trim()}` : base;
      await repo.reviewShareSummary(share.id, finalMd, !!body.approved);
      const session = await repo.getOrCreateSession(p.id, 'participant');
      await repo.updateSession(session.id, { summary_reviewed: true });
      if (body.approved) await repo.updateParticipant(p.id, { current_stage: 'done', status: 'completed', reviewed: false, completed_at: new Date().toISOString() });
      return ok(res, { approved: !!body.approved });
    } catch (e) { return oops(res, e); }
  });

  // Participant feedback: a 1-5 usefulness rating + an optional line.
  app.post('/api/abl/session/:slug/feedback', async (req, res) => {
    try {
      const b = req.body || {};
      const p = await repo.getParticipantBySlug(req.params.slug);
      if (!p) return fail(res, 'Session not found', 404);
      const rating = Math.max(0, Math.min(5, parseInt(b.rating, 10) || 0));
      if (!rating) return fail(res, 'Please pick a rating');
      await repo.updateParticipant(p.id, {
        feedback_rating: rating,
        feedback_comment: String(b.comment || '').slice(0, 1000),
        feedback_at: new Date().toISOString(),
      });
      return ok(res, { ok: true });
    } catch (e) { return oops(res, e); }
  });

  // -------------------------------------------------------------------------
  // Course-specific thinking tools (same participant link, separate sessions)
  // -------------------------------------------------------------------------
  const runtimeMode = (value) => (value === 'siv' || value === 'ved' ? value : null);

  // Temporary staging-only maintenance hook. It is confirmation-gated and
  // intentionally cannot run on a production Cloud Run service.
  app.post('/api/abl/session/:slug/runtime-reset', async (req, res) => {
    try {
      if (process.env.K_SERVICE !== 'vinay-site-staging') return fail(res, 'Not found', 404);
      if (!req.body || req.body.confirm !== 'ERASE COURSE RUNTIME HISTORY') {
        return fail(res, 'Exact reset confirmation required.', 400);
      }
      const p = await repo.getParticipantBySlug(req.params.slug);
      if (!p) return fail(res, 'Session not found', 404);
      if (!p.link_approved) return fail(res, 'This session is not active yet.', 403);
      return ok(res, await repo.resetCourseRuntimes(p.id));
    } catch (e) { return oops(res, e); }
  });

  app.get('/api/abl/session/:slug/runtime/:mode', async (req, res) => {
    try {
      const mode = runtimeMode(req.params.mode);
      if (!mode) return fail(res, 'Unknown course runtime', 404);
      const p = await repo.getParticipantBySlug(req.params.slug);
      if (!p) return fail(res, 'Session not found', 404);
      if (!p.link_approved) return fail(res, 'This session is not active yet.', 403);

      const session = await repo.getOrCreateSession(p.id, mode);
      const messages = (await repo.listMessages(session.id))
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content, at: m.created_at }));
      const report = await repo.getLatestOutput(p.id, mode + '_report');
      return ok(res, {
        mode,
        config: COURSE_RUNTIME_MODES[mode],
        participant: { name: p.name, company_name: p.company_name, role_title: p.role_title },
        started: mode === 'siv' ? !!session.selected_depth : !!session.consent_given,
        depth: mode === 'siv' ? session.selected_depth : null,
        message_count: p.message_count || 0,
        max_messages: p.max_messages || 200,
        messages,
        report: report ? { id: report.id, markdown: report.content_markdown } : null,
      });
    } catch (e) { return oops(res, e); }
  });

  app.post('/api/abl/session/:slug/runtime/:mode', async (req, res) => {
    try {
      const mode = runtimeMode(req.params.mode);
      if (!mode) return fail(res, 'Unknown course runtime', 404);
      const p = await repo.getParticipantBySlug(req.params.slug);
      if (!p) return fail(res, 'Session not found', 404);
      if (!p.link_approved) return fail(res, 'This session is not active yet.', 403);
      const session = await repo.getOrCreateSession(p.id, mode);

      if (mode === 'siv') {
        const depth = String((req.body && req.body.depth) || '');
        if (!['fast', 'standard', 'deep'].includes(depth)) return fail(res, 'Choose a valid depth.');
        const updated = await repo.updateSession(session.id, { selected_depth: depth, consent_given: true });
        return ok(res, { started: true, depth: updated.selected_depth });
      }

      await repo.updateSession(session.id, { consent_given: true });
      return ok(res, { started: true });
    } catch (e) { return oops(res, e); }
  });

  app.post('/api/abl/session/:slug/runtime/:mode/message', chatLimit, async (req, res) => {
    try {
      const mode = runtimeMode(req.params.mode);
      if (!mode) return fail(res, 'Unknown course runtime', 404);
      const msg = String((req.body && req.body.message) || '').trim();
      if (!msg) return fail(res, 'Empty message');
      if (msg.length > 6000) return fail(res, 'Message too long');

      const p = await repo.getParticipantBySlug(req.params.slug);
      if (!p) return fail(res, 'Session not found', 404);
      if (!p.link_approved) return fail(res, 'This session is not active yet.', 403);
      if ((p.message_count || 0) >= (p.max_messages || 200)) {
        return fail(res, 'You have used your included course AI allowance. Please message the course admin if you need it extended.', 429);
      }

      const session = await repo.getOrCreateSession(p.id, mode);
      const started = mode === 'siv' ? !!session.selected_depth : !!session.consent_given;
      if (!started) return fail(res, 'Start this course conversation before sending a message.', 400);
      const turn = await agentTurn({ participant: p, session, userMessage: msg, mode });
      return ok(res, {
        reply: turn.reply,
        message_count: turn.messageCount,
        max_messages: p.max_messages || 200,
        soft_warn: turn.messageCount >= SOFT_WARN_AT,
      });
    } catch (e) { return oops(res, e); }
  });

  app.post('/api/abl/session/:slug/runtime/:mode/report', rewardLimit, async (req, res) => {
    try {
      const mode = runtimeMode(req.params.mode);
      if (!mode) return fail(res, 'Unknown course runtime', 404);
      const p = await repo.getParticipantBySlug(req.params.slug);
      if (!p) return fail(res, 'Session not found', 404);
      if (!p.link_approved) return fail(res, 'This session is not active yet.', 403);
      const session = await repo.getOrCreateSession(p.id, mode);
      if (mode === 'siv' && !session.selected_depth) return fail(res, 'Start the examination before generating a report.');
      if (mode === 'ved' && !session.consent_given) return fail(res, 'Start the diagnostic before generating a report.');
      const userTurns = (await repo.listMessages(session.id)).filter((m) => m.role === 'user').length;
      if (userTurns < 2) return fail(res, 'Go a little further into the conversation before generating your report.');

      const report = mode === 'siv' ? await generateSivReport(p) : await generateVedReport(p);
      return ok(res, { report });
    } catch (e) { return oops(res, e); }
  });

  // -------------------------------------------------------------------------
  // Admin (studio-gated)
  // -------------------------------------------------------------------------
  app.get('/api/abl/participants', requireAdmin, async (req, res) => {
    try { return ok(res, await repo.listParticipants()); } catch (e) { return oops(res, e); }
  });

  app.post('/api/abl/participants', requireAdmin, async (req, res) => {
    try {
      const b = req.body || {};
      if (!b.name || !b.name.trim()) return fail(res, 'Participant name is required');
      if (!b.company_name || !b.company_name.trim()) return fail(res, 'Company name is required');
      const p = await repo.createParticipant({
        name: b.name.trim(), company_name: b.company_name.trim(), email: b.email,
        role_title: b.role_title, company_website: b.company_website, industry: b.industry,
        geography: b.geography, business_model: b.business_model,
      });
      return ok(res, p, 201);
    } catch (e) { return oops(res, e); }
  });

  app.get('/api/abl/participants/:id', requireAdmin, async (req, res) => {
    try {
      const p = await repo.getParticipant(req.params.id);
      if (!p) return fail(res, 'Not found', 404);
      const [research, qa, outputs] = await Promise.all([
        repo.getResearch(p.id), repo.getQa(p.id), repo.getOutputs(p.id),
      ]);
      return ok(res, { participant: p, research, qa, outputs });
    } catch (e) { return oops(res, e); }
  });

  app.patch('/api/abl/participants/:id', requireAdmin, async (req, res) => {
    try { return ok(res, await repo.updateParticipant(req.params.id, req.body || {})); } catch (e) { return oops(res, e); }
  });

  app.delete('/api/abl/participants/:id', requireAdmin, async (req, res) => {
    try { return ok(res, await repo.deleteParticipant(req.params.id)); } catch (e) { return oops(res, e); }
  });

  // Auto-research: live web-grounded pass that fills the research fields.
  app.post('/api/abl/participants/:id/research/auto', requireAdmin, researchLimit, async (req, res) => {
    try {
      const p = await repo.getParticipant(req.params.id);
      if (!p) return fail(res, 'Not found', 404);
      const r = await researchCompany(p);
      return ok(res, r);
    } catch (e) { return oops(res, e); }
  });

  app.post('/api/abl/participants/:id/research', requireAdmin, async (req, res) => {
    try {
      const b = req.body || {};
      const r = await repo.upsertResearch(req.params.id, {
        structured_context: b.structured_context || {}, research_dossier: b.research_dossier, sources_notes: b.sources_notes,
      });
      const p = await repo.getParticipant(req.params.id);
      if (p && p.status === 'draft') await repo.setStatus(p.id, 'research_added');
      return ok(res, r);
    } catch (e) { return oops(res, e); }
  });

  app.post('/api/abl/participants/:id/qa', requireAdmin, async (req, res) => {
    try {
      const b = req.body || {};
      const row = await repo.upsertQa(req.params.id, { checklist: b.checklist || {}, notes: b.notes, status: b.status || 'in_progress' });
      const patch = { qa_status: b.status || 'in_progress' };
      if (b.status === 'passed') { patch.status = 'qa_approved'; }
      else if (b.status === 'in_progress') { patch.status = 'qa_pending'; }
      await repo.updateParticipant(req.params.id, patch);
      return ok(res, row);
    } catch (e) { return oops(res, e); }
  });

  app.post('/api/abl/participants/:id/qa-message', requireAdmin, async (req, res) => {
    try {
      const msg = String((req.body && req.body.message) || '').trim();
      if (!msg) return fail(res, 'Empty message');
      const p = await repo.getParticipant(req.params.id);
      if (!p) return fail(res, 'Not found', 404);
      const session = await repo.getOrCreateSession(p.id, 'qa');
      if (!session.selected_depth) await repo.updateSession(session.id, { selected_depth: '30', consent_given: true });
      const fresh = await repo.getOrCreateSession(p.id, 'qa');
      const { reply } = await agentTurn({ participant: p, session: fresh, userMessage: msg, mode: 'qa' });
      const msgs = (await repo.listMessages(fresh.id)).filter((m) => m.role === 'user' || m.role === 'admin' || m.role === 'assistant')
        .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));
      return ok(res, { reply, messages: msgs });
    } catch (e) { return oops(res, e); }
  });

  app.post('/api/abl/participants/:id/approve', requireAdmin, async (req, res) => {
    try {
      const p = await repo.updateParticipant(req.params.id, { link_approved: true, status: 'link_ready', approved_at: new Date().toISOString() });
      return ok(res, p);
    } catch (e) { return oops(res, e); }
  });

  app.post('/api/abl/participants/:id/brief', requireAdmin, async (req, res) => {
    try {
      const p = await repo.getParticipant(req.params.id);
      if (!p) return fail(res, 'Not found', 404);
      const md = await generateOutput(p, 'vinay_meeting_brief');
      return ok(res, { markdown: md });
    } catch (e) { return oops(res, e); }
  });

  // -------------------------------------------------------------------------
  // Pages (served dynamically so links carry a slug / id)
  // -------------------------------------------------------------------------
  let sessionShell = null;
  let workspaceShell = null;
  let courseRuntimeShell = null;
  app.get('/ai-business-leaders/workspace/:slug/:mode', (req, res, next) => {
    try {
      if (!runtimeMode(req.params.mode)) return next();
      if (courseRuntimeShell == null) courseRuntimeShell = readFileSync(path.join(SITE_ROOT, 'ai-business-leaders', 'course-runtime.html'), 'utf8');
      res.set('Content-Type', 'text/html; charset=utf-8');
      res.set('Cache-Control', 'private, no-store');
      return res.send(courseRuntimeShell);
    } catch (e) { return next(); }
  });

  app.get('/ai-business-leaders/workspace/:slug', (req, res, next) => {
    try {
      if (workspaceShell == null) workspaceShell = readFileSync(path.join(SITE_ROOT, 'ai-business-leaders', 'workspace.html'), 'utf8');
      res.set('Content-Type', 'text/html; charset=utf-8');
      res.set('Cache-Control', 'private, no-store');
      return res.send(workspaceShell);
    } catch (e) { return next(); }
  });

  app.get('/ai-business-leaders/s/:slug', (req, res, next) => {
    try {
      if (sessionShell == null) sessionShell = readFileSync(path.join(SITE_ROOT, 'ai-business-leaders', 'session.html'), 'utf8');
      res.set('Content-Type', 'text/html; charset=utf-8');
      return res.send(sessionShell);
    } catch (e) { return next(); }
  });

  // Real, branded, downloadable PDF (generated server-side, no browser).
  app.get('/ai-business-leaders/pdf/:outputId', async (req, res, next) => {
    try {
      const out = await repo.getOutput(req.params.outputId);
      if (!out) return next();
      if (out.output_type === 'vinay_meeting_brief' && !isAuthed(req)) return res.status(403).send('This document is private.');
      const p = await repo.getParticipant(out.participant_id);
      const title = REWARD_TITLES[out.output_type] || (out.output_type === 'vinay_meeting_brief' ? 'Meeting Brief' : 'Summary');
      const md = out.reviewed_content_markdown || out.content_markdown || '';
      const who = ((p && p.name) || '') + (p && p.company_name ? ' · ' + p.company_name : '');
      let date = '';
      try { date = new Date(out.updated_at || out.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) {}
      const filename = (title + '-' + ((p && p.name) || 'document')).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
      streamPdf(res, { title, who, date, md, filename });
    } catch (e) { return next(); }
  });

  // Printable document view (reward / share summary) for "Download PDF" (print to PDF).
  app.get('/ai-business-leaders/doc/:outputId', async (req, res, next) => {
    try {
      const out = await repo.getOutput(req.params.outputId);
      if (!out) return next();
      // The private meeting brief is Vinay-only — everything else (participant
      // reward + share summary) is fine to view via the unguessable id.
      if (out.output_type === 'vinay_meeting_brief' && !isAuthed(req)) {
        return res.status(403).send('This document is private.');
      }
      const p = await repo.getParticipant(out.participant_id);
      const title = REWARD_TITLES[out.output_type] || 'Document';
      const md = out.reviewed_content_markdown || out.content_markdown || '';
      const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)} — AI for Business Leaders</title>
<meta name="robots" content="noindex,nofollow">
<style>
  :root{--ink:#1a1714;--muted:#6b6157;--vermillion:#b5462a;--rule:#e4ddd2;--paper:#faf7f1}
  *{box-sizing:border-box}
  body{margin:0;background:var(--paper);color:var(--ink);font-family:Georgia,'Times New Roman',serif;line-height:1.6}
  .wrap{max-width:760px;margin:0 auto;padding:56px 28px 80px}
  .kicker{font:600 11px/1 ui-monospace,monospace;letter-spacing:.22em;text-transform:uppercase;color:var(--vermillion)}
  .meta{color:var(--muted);font-size:13px;margin:2px 0 24px}
  h1{font-size:30px;margin:8px 0 2px}h2{font-size:19px;margin:26px 0 6px;border-bottom:1px solid var(--rule);padding-bottom:4px}
  h3{font-size:15px;margin:18px 0 4px}p{margin:8px 0}ul{margin:8px 0 8px 20px}li{margin:3px 0}
  hr{border:0;border-top:1px solid var(--rule);margin:22px 0}code{font-family:ui-monospace,monospace;font-size:.9em}
  table.mdt{border-collapse:collapse;width:100%;margin:14px 0;font-size:14px}.mdt th,.mdt td{border:1px solid var(--rule);padding:7px 10px;text-align:left;vertical-align:top}.mdt th{background:#fff;font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}
  .bar{position:fixed;top:0;left:0;right:0;background:#fff;border-bottom:1px solid var(--rule);padding:10px 16px;display:flex;justify-content:space-between;align-items:center}
  .bar button{font:600 12px/1 ui-monospace,monospace;letter-spacing:.1em;text-transform:uppercase;background:var(--ink);color:var(--paper);border:0;border-radius:3px;padding:9px 16px;cursor:pointer}
  @media print{.bar{display:none}.wrap{padding-top:24px}body{background:#fff}}
</style></head><body>
<div class="bar"><span class="kicker">AI for Business Leaders</span><button onclick="window.print()">Download PDF ↓</button></div>
<div class="wrap" style="padding-top:80px">
  <div class="kicker">AI for Business Leaders</div>
  <h1>${esc(title)}</h1>
  <div class="meta">${esc((p && p.name) || '')}${p && p.company_name ? ' · ' + esc(p.company_name) : ''}</div>
  ${mdToHtml(md)}
</div></body></html>`;
      res.set('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    } catch (e) { return next(); }
  });
}
