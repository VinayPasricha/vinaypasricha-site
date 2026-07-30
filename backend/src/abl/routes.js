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
  generateAdminSnapshot,
  rewardTypeForDepth,
  researchCompany,
  openingTurn,
  generateRewardBundle,
  generateSivReport,
  generateVedReport,
  generateLeadershipBlueprint,
  runtimeOpeningTurn,
  RUNTIME_OPENING_VERSION,
  usableOptions,
} from './service.js';
import { REWARD_TITLES, SOFT_WARN_AT } from './copy.js';
import { COURSE_RUNTIME_MODES } from './course-runtimes.js';
import { buildCourseMemory } from './memory.js';
import { analyseTranscript, extractTranscript, transcriptSummaryMarkdown } from './transcripts.js';
import {
  decodeParticipantAsset,
  extractParticipantAssetText,
  participantAssetMime,
  supportedParticipantAsset,
} from './assets.js';
import {
  bearerToken,
  codeExpiry,
  createLoginCode,
  createOpaqueParticipantToken,
  createParticipantToken,
  deliverLoginCode,
  hashLoginCode,
  hashParticipantToken,
  isPreviewEnvironment,
  isLocalEnvironment,
  normalizeEmail,
  participantTokenExpiry,
  validEmail,
  verifyLoginCode,
  verifyParticipantToken,
} from './auth.js';

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

const BUILDER_FIELDS = {
  1: ['candidate_workflow', 'people_systems', 'where_work_breaks', 'business_consequence', 'current_ai_use', 'company_brain_hypothesis'],
  2: ['problem_sentence', 'recurrence', 'value_bucket', 'baseline', 'pilot_tests', 'strategic_value', 'available_data',
    'non_ai_alternative', 'owner_human_line', 'decision', 'evidence_needed'],
  3: ['current_steps', 'exception_path', 'memory', 'reasoning', 'action', 'feedback', 'boundaries',
    'build_buy_partner', 'critical_assumption'],
  4: ['pilot_boundary', 'ownership', 'old_work_removed', 'new_behaviour', 'data_boundary', 'risk_tier',
    'operational_boundary', 'control_recovery', 'evidence', 'economics', 'weekly_question', 'premortem'],
  5: ['pitch_problem', 'pitch_brain', 'pitch_workflow', 'pitch_control', 'pitch_evidence', 'commitment_72h',
    'day30_review_date', 'day30_review_with', 'scale_if', 'fix_if', 'stop_if'],
};
const COMPLETION_KEYS = {
  1: ['candidate_workflow', 'where_work_breaks', 'business_consequence', 'company_brain_hypothesis'],
  2: ['problem_sentence', 'baseline', 'owner_human_line', 'decision'],
  3: ['memory', 'reasoning', 'action', 'feedback', 'boundaries'],
  4: ['pilot_boundary', 'ownership', 'risk_tier', 'operational_boundary', 'evidence'],
  5: ['pitch_problem', 'pitch_workflow', 'pitch_control', 'pitch_evidence', 'commitment_72h'],
};
function cleanBuilderValue(v, depth = 0) {
  if (depth > 4) return null;
  if (typeof v === 'string') return v.trim().slice(0, 12000);
  if (typeof v === 'boolean' || typeof v === 'number') return v;
  if (Array.isArray(v)) return v.slice(0, 30).map((x) => cleanBuilderValue(x, depth + 1));
  if (v && typeof v === 'object') {
    const out = {};
    Object.keys(v).slice(0, 40).forEach((k) => { out[String(k).slice(0, 80)] = cleanBuilderValue(v[k], depth + 1); });
    return out;
  }
  return null;
}
function hasBuilderValue(v) {
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.some(hasBuilderValue);
  if (v && typeof v === 'object') return Object.values(v).some(hasBuilderValue);
  return v === true || (typeof v === 'number' && Number.isFinite(v));
}
function builderText(v, fallback = 'Needs confirmation', max = 720) {
  if (!hasBuilderValue(v)) return fallback;
  let out = '';
  if (Array.isArray(v)) {
    out = v.filter(hasBuilderValue).map((x) => builderText(x, '', max)).filter(Boolean).join(', ');
  } else if (v && typeof v === 'object') {
    out = Object.entries(v).filter(([, value]) => hasBuilderValue(value)).map(([key, value]) => {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      return `${label}: ${builderText(value, '', max)}`;
    }).join(' · ');
  } else {
    out = String(v).trim();
  }
  if (!out) return fallback;
  return out.length > max ? `${out.slice(0, max - 1).trim()}…` : out;
}
function builderProgress(sessions) {
  const completed = [];
  let answered = 0, total = 0;
  for (let n = 1; n <= 5; n++) {
    const data = sessions[String(n)] || {};
    const keys = COMPLETION_KEYS[n];
    const done = keys.filter((k) => hasBuilderValue(data[k])).length;
    answered += done; total += keys.length;
    if (done === keys.length) completed.push(n);
  }
  return { completed, percent: total ? Math.round(answered / total * 100) : 0 };
}
function builderMarkdown(p, sessions) {
  const s1 = sessions['1'] || {}, s2 = sessions['2'] || {}, s3 = sessions['3'] || {};
  const s4 = sessions['4'] || {}, s5 = sessions['5'] || {};
  const txt = (v, fallback = 'Needs confirmation', max = 720) => builderText(v, fallback, max);
  const boundary = s3.boundaries || {}, op = s4.operational_boundary || {}, evidence = s4.evidence || {};
  const initiativeName = txt(s1.candidate_workflow || s2.problem_sentence, 'My First AI Leadership Initiative', 120);
  return `# My First AI Leadership Initiative

**${p.name || 'Participant'}${p.company_name ? ` · ${p.company_name}` : ''}**

## Page 1 · Leadership Case

### Initiative name
${initiativeName}

### Recurring problem, consequence and why now
${txt(s2.problem_sentence || s1.where_work_breaks)}

**Business consequence:** ${txt(s1.business_consequence)}

**Value bucket and baseline:** ${txt(s2.value_bucket)} · ${txt(s2.baseline)}

**Decision and evidence needed:** ${txt(s2.decision)} · ${txt(s2.evidence_needed)}

### Company Brain breakdown and proposed AI role
${txt(s5.pitch_brain || s1.company_brain_hypothesis)}

**Memory:** ${txt(s3.memory)}

**Reasoning:** ${txt(s3.reasoning)}

**Action:** ${txt(s3.action)}

**Feedback:** ${txt(s3.feedback)}

### Workflow change and human boundary
**Current workflow:** ${txt(s3.current_steps)}

**Future workflow:** ${txt(s5.pitch_workflow || `${txt(s3.memory, '', 180)} ${txt(s3.reasoning, '', 180)} ${txt(s3.action, '', 180)} ${txt(s3.feedback, '', 180)}`)}

**Exception path:** ${txt(s3.exception_path)}

**Automate:** ${txt(boundary.automate)}

**Assist:** ${txt(boundary.assist)}

**Escalate:** ${txt(boundary.escalate)}

### Human responsibility and capability retained
**Owner and decision rights:** ${txt(s2.owner_human_line || s4.ownership)}

**Build / Buy / Partner:** ${txt(s3.build_buy_partner)}

**Capability retained:** ${txt(s2.strategic_value || s3.build_buy_partner)}

<!-- pagebreak -->

## Page 2 · 90-Day Pilot Charter

### Pilot scope and users
${txt(s4.pilot_boundary)}

### Build / Buy / Partner and economics
**Route and vendor-exit test:** ${txt(s3.build_buy_partner)}

**Economics:** ${txt(s4.economics)}

### Baseline, Day-30 evidence and Day-90 targets
**Outcome:** ${txt(evidence.outcome)}

**Adoption:** ${txt(evidence.adoption)}

**Safety:** ${txt(evidence.safety)}

### Data, AI / human boundary and controls
**Data:** ${txt(s4.data_boundary || s2.available_data)}

**AI may:** ${txt(op.allowed)}

**AI may not:** ${txt(op.not_allowed)}

**Human approval:** ${txt(op.human_approve)}

**Always escalate:** ${txt(op.escalate)}

### Risk and control
**Risk tier:** ${txt(s4.risk_tier)}

**Control and recovery:** ${txt(s4.control_recovery)}

**Owner and team:** ${txt(s4.ownership)}

### 90-day path and decision rules
**Days 1–15 · Diagnose:** confirm the problem, baseline, data, owner and proceed / investigate / wait decision.

**Days 16–30 · Design:** finalise the workflow, human line, pilot boundary, controls, users and go / no-go evidence.

**Days 31–75 · Build and Run:** configure the contained pilot, review outcome, adoption, safety and economics weekly, and correct exceptions.

**Days 76–90 · Decide:** compare the evidence with the pre-agreed rules and scale, fix or stop.

**Day-30 evidence:** ${txt(s5.pitch_evidence || s4.weekly_question)}

**Scale if:** ${txt(s5.scale_if)}

**Fix if:** ${txt(s5.fix_if)}

**Stop if:** ${txt(s5.stop_if)}

### Dated commitment
**Within 72 hours:** ${txt(s5.commitment_72h)}

**Day-30 sponsor review:** ${txt(s5.day30_review_date)} with ${txt(s5.day30_review_with)}

---

*Working draft generated from the participant's cumulative Initiative Builder. Any “Needs confirmation” item remains an explicit open decision.*`;
}

// tiny markdown -> HTML for the printable document view (server-side)

export function registerAbl(app, { requireAdmin, rateLimit, studioAuthed }) {
  // Per-endpoint limiters (fall back to no-op if the host didn't pass a factory).
  const mk = (opts) => (typeof rateLimit === 'function' ? rateLimit(opts) : noLimit);
  const chatLimit = mk({ windowMs: 60000, max: 25 });     // participant chat turns
  const rewardLimit = mk({ windowMs: 60000, max: 6 });    // reward/summary generation
  const researchLimit = mk({ windowMs: 60000, max: 12 }); // grounded auto-research
  const authRequestLimit = mk({ windowMs: 60000, max: 5 });
  const authVerifyLimit = mk({ windowMs: 60000, max: 12 });
  const isAuthed = (req) => (typeof studioAuthed === 'function' ? studioAuthed(req) : false);
  const participantPayload = async (req) => {
    const token = bearerToken(req);
    const signed = verifyParticipantToken(token);
    if (signed) return signed;
    if (!token.startsWith('ablr.')) return null;
    const saved = await repo.getParticipantSession(hashParticipantToken(token));
    if (!saved || Number.isNaN(Date.parse(saved.expires_at)) || Date.parse(saved.expires_at) <= Date.now()) return null;
    return { sub: saved.participant_id, slug: saved.slug };
  };




  // All participant APIs now require the short-lived bearer issued above. The
  // page shells remain reachable so a missing/expired sign-in can redirect to
  // the friendly login screen rather than exposing participant data.
  app.use('/api/abl/session/:slug', async (req, res, next) => {
    try {
      const payload = await participantPayload(req);
      if (!payload || payload.slug !== req.params.slug) return fail(res, 'Sign-in required.', 401);
      const p = await repo.getParticipant(payload.sub);
      if (!p || p.slug !== req.params.slug || p.login_enabled === false || !p.link_approved) return fail(res, 'Sign-in required.', 401);
      req.ablParticipant = p;
      return next();
    } catch (e) { return oops(res, e); }
  });

  // -------------------------------------------------------------------------
  // Participant experience
  // -------------------------------------------------------------------------
  app.get('/api/abl/session/:slug', async (req, res) => {
    try {
      const p = await repo.getParticipantBySlug(req.params.slug);
      if (!p) return fail(res, 'Session not found', 404);
      if (!p.link_approved) return fail(res, 'This session is not active yet.', 403);
      const session = await repo.getOrCreateSession(p.id, 'participant');
      const messages = (await repo.listMessages(session.id))
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content, at: m.created_at, options: usableOptions((m.metadata && m.metadata.options) || []) }));
      // Once a journey is chosen + consent given, open with the agent's greeting
      // so the participant is never staring at an empty box.
      if (!messages.length && session.consent_given && session.selected_depth) {
        const opening = await openingTurn({ participant: p, session });
        if (opening && opening.say) messages.push({ role: 'assistant', content: opening.say, options: opening.options || [], at: new Date().toISOString() });
      }
      const outputs = await repo.getOutputs(p.id);
      const reward = outputs.find((o) => ['course_preparation_brief', 'use_case_map', 'strategy_note'].includes(o.output_type)) || null;
      const share = outputs.find((o) => o.output_type === 'share_summary') || null;
      const [vedSession, sivSession, continuingSession, memory] = await Promise.all([
        repo.getSession(p.id, 'ved'),
        repo.getSession(p.id, 'siv'),
        repo.getSession(p.id, 'continuing'),
        buildCourseMemory(p),
      ]);
      const vedReport = outputs.find((o) => o.output_type === 'ved_report') || null;
      const sivReport = outputs.find((o) => o.output_type === 'siv_report') || null;
      const blueprint = outputs.find((o) => o.output_type === 'leadership_blueprint') || null;
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
          continuing: { started: !!(continuingSession && continuingSession.consent_given), complete: false },
        },
        memory,
        blueprint: blueprint ? { id: blueprint.id, markdown: blueprint.content_markdown } : null,
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
  const runtimeMode = (value) => (value === 'siv' || value === 'ved' || value === 'continuing' ? value : null);

  app.get('/api/abl/session/:slug/runtime/:mode', async (req, res) => {
    try {
      const mode = runtimeMode(req.params.mode);
      if (!mode) return fail(res, 'Unknown course runtime', 404);
      const p = await repo.getParticipantBySlug(req.params.slug);
      if (!p) return fail(res, 'Session not found', 404);
      if (!p.link_approved) return fail(res, 'This session is not active yet.', 403);

      const session = await repo.getOrCreateSession(p.id, mode);
      const started = mode === 'siv' ? !!session.selected_depth : !!session.consent_given;
      let storedMessages = (await repo.listMessages(session.id))
        .filter((m) => m.role === 'user' || m.role === 'assistant');
      const hasUserAnswer = storedMessages.some((m) => m.role === 'user');
      const staleUnansweredOpening = started && storedMessages.length && !hasUserAnswer &&
        storedMessages.every((m) => !m.metadata || m.metadata.runtime_opening_version !== RUNTIME_OPENING_VERSION);
      if (staleUnansweredOpening) {
        await repo.deleteMessages(storedMessages.map((m) => m.id));
        storedMessages = [];
      }
      const messages = storedMessages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content, at: m.created_at,
          options: usableOptions((m.metadata && m.metadata.options) || []),
          selection_mode: (m.metadata && m.metadata.selection_mode) || 'single',
          stage: (m.metadata && m.metadata.stage) || '' }));
      // Self-heal a session that was marked started by an older revision but
      // never received its opening agent turn.
      if (started && !messages.length) {
        const opening = await runtimeOpeningTurn({ participant: p, session, mode });
        if (opening && opening.reply) messages.push({
          role: 'assistant', content: opening.reply, options: opening.options || [],
          selection_mode: opening.selectionMode || 'single', at: new Date().toISOString(),
        });
      }
      const report = await repo.getLatestOutput(p.id, mode === 'continuing' ? 'leadership_blueprint' : mode + '_report');
      return ok(res, {
        mode,
        config: COURSE_RUNTIME_MODES[mode],
        participant: { name: p.name, company_name: p.company_name, role_title: p.role_title },
        started,
        depth: mode === 'siv' ? session.selected_depth : null,
        message_count: p.message_count || 0,
        max_messages: p.max_messages || 200,
        messages,
        report: report ? { id: report.id, markdown: report.content_markdown } : null,
        memory: await buildCourseMemory(p),
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
        const existing = await repo.listMessages(updated.id);
        const opening = existing.length ? null : await runtimeOpeningTurn({ participant: p, session: updated, mode });
        return ok(res, { started: true, depth: updated.selected_depth,
          reply: opening && opening.reply, options: (opening && opening.options) || [],
          selection_mode: (opening && opening.selectionMode) || 'multi' });
      }

      const updated = await repo.updateSession(session.id, { consent_given: true });
      const existing = await repo.listMessages(updated.id);
      const opening = existing.length ? null : await runtimeOpeningTurn({ participant: p, session: updated, mode });
      return ok(res, { started: true, reply: opening && opening.reply,
        options: (opening && opening.options) || [], selection_mode: (opening && opening.selectionMode) || 'single' });
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
        options: turn.options || [],
        selection_mode: turn.selectionMode || 'single',
        stage: turn.stage || '',
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
      if (mode === 'continuing' && !session.consent_given) return fail(res, 'Start a check-in before updating the blueprint.');
      const userTurns = (await repo.listMessages(session.id)).filter((m) => m.role === 'user').length;
      if (userTurns < 2) return fail(res, 'Go a little further into the conversation before generating your report.');

      const report = mode === 'siv' ? await generateSivReport(p)
        : mode === 'ved' ? await generateVedReport(p) : await generateLeadershipBlueprint(p);
      return ok(res, { report });
    } catch (e) { return oops(res, e); }
  });

  app.post('/api/abl/session/:slug/runtime/:mode/restart', async (req, res) => {
    try {
      const mode = runtimeMode(req.params.mode);
      if (!mode) return fail(res, 'Unknown course runtime', 404);
      const p = await repo.getParticipantBySlug(req.params.slug);
      if (!p || !p.link_approved) return fail(res, 'Session not found', 404);
      const session = await repo.getOrCreateSession(p.id, mode);
      const messages = await repo.listMessages(session.id);
      const usedTurns = messages.filter((message) => message.role === 'user').length;
      await repo.deleteMessages(messages.map((message) => message.id));
      await repo.updateSession(session.id, {
        consent_given: false, selected_depth: null, current_stage: null,
        running_summary: null, summary_reviewed: false,
      });
      if (usedTurns) await repo.updateParticipant(p.id, { message_count: Math.max(0, (p.message_count || 0) - usedTurns) });
      if (mode === 'ved') {
        await Promise.all([
          repo.deleteOutput(p.id, 'ved_report'), repo.deleteOutput(p.id, 'leadership_blueprint'),
          repo.upsertMemory(p.id, { fields: { desired_output: '', execution_sequence: '', ved_constraint: '', ved_correction: '', ved_measurement: '' } }),
        ]);
      } else if (mode === 'siv') {
        await Promise.all([
          repo.deleteOutput(p.id, 'siv_report'), repo.deleteOutput(p.id, 'leadership_blueprint'),
          repo.upsertMemory(p.id, { fields: { candidate_projects: '', company_brain: '', selected_project: '', baseline: '', target: '', owner: '', value_case: '', guardrails: '' } }),
        ]);
      }
      return ok(res, { restarted: true, preserved: 'verified company context and other conversations' });
    } catch (e) { return oops(res, e); }
  });

  // Shared participant-visible memory. A concise correction or priority can be
  // added without forcing the participant to restart any conversation.
  app.get('/api/abl/session/:slug/memory', async (req, res) => {
    try {
      const p = await repo.getParticipantBySlug(req.params.slug);
      if (!p || !p.link_approved) return fail(res, 'Session not found', 404);
      return ok(res, await buildCourseMemory(p));
    } catch (e) { return oops(res, e); }
  });

  app.patch('/api/abl/session/:slug/memory', async (req, res) => {
    try {
      const p = await repo.getParticipantBySlug(req.params.slug);
      if (!p || !p.link_approved) return fail(res, 'Session not found', 404);
      const note = String((req.body && req.body.participant_note) || '').trim();
      if (note.length > 6000) return fail(res, 'Please keep this note under 6,000 characters.');
      await repo.upsertMemory(p.id, { participant_note: note });
      return ok(res, await buildCourseMemory(p));
    } catch (e) { return oops(res, e); }
  });

  app.post('/api/abl/session/:slug/blueprint', rewardLimit, async (req, res) => {
    try {
      const p = await repo.getParticipantBySlug(req.params.slug);
      if (!p || !p.link_approved) return fail(res, 'Session not found', 404);
      const [ved, siv] = await Promise.all([
        repo.getLatestOutput(p.id, 'ved_report'), repo.getLatestOutput(p.id, 'siv_report'),
      ]);
      if (!ved || !siv) return fail(res, 'Complete the VED and SIV reports before building the combined blueprint.', 409);
      return ok(res, { report: await generateLeadershipBlueprint(p) });
    } catch (e) { return oops(res, e); }
  });

  app.patch('/api/abl/session/:slug/blueprint', async (req, res) => {
    try {
      const p = await repo.getParticipantBySlug(req.params.slug);
      if (!p || !p.link_approved) return fail(res, 'Session not found', 404);
      const markdown = String((req.body && req.body.markdown) || '').trim();
      if (!markdown || markdown.length > 30000) return fail(res, 'Blueprint text is empty or too long.');
      const existing = await repo.getLatestOutput(p.id, 'leadership_blueprint');
      const saved = await repo.saveOutput({
        participant_id: p.id, session_id: existing && existing.session_id,
        output_type: 'leadership_blueprint', content_markdown: markdown,
      });
      return ok(res, { id: saved.id, markdown: saved.content_markdown });
    } catch (e) { return oops(res, e); }
  });

  // -------------------------------------------------------------------------
  // Admin (studio-gated)
  // -------------------------------------------------------------------------
app.get('/api/abl/course/:slug', async (req, res) => {
    try {
      const p = await repo.getParticipantBySlug(req.params.slug);
      if (!p) return fail(res, 'Course workspace not found', 404);
      if (!p.link_approved) return fail(res, 'This course workspace is not active yet.', 403);
      const builder = await repo.getBuilder(p.id);
      return ok(res, {
        participant: { name: p.name, company_name: p.company_name, role_title: p.role_title, slug: p.slug },
        builder: builder || { sessions: {}, current_session: 1, completed_sessions: [], completion_percent: 0 },
      });
    } catch (e) { return oops(res, e); }
  });

  app.patch('/api/abl/course/:slug', async (req, res) => {
    try {
      const p = await repo.getParticipantBySlug(req.params.slug);
      if (!p) return fail(res, 'Course workspace not found', 404);
      if (!p.link_approved) return fail(res, 'This course workspace is not active yet.', 403);
      const n = Math.max(1, Math.min(5, parseInt(req.body && req.body.session, 10) || 1));
      const incoming = (req.body && req.body.data) || {};
      const current = await repo.getBuilder(p.id);
      const sessions = { ...((current && current.sessions) || {}) };
      const clean = {};
      BUILDER_FIELDS[n].forEach((k) => { if (Object.prototype.hasOwnProperty.call(incoming, k)) clean[k] = cleanBuilderValue(incoming[k]); });
      sessions[String(n)] = { ...(sessions[String(n)] || {}), ...clean, updated_at: new Date().toISOString() };
      const progress = builderProgress(sessions);
      const saved = await repo.upsertBuilder(p.id, {
        sessions, current_session: n, completed_sessions: progress.completed, completion_percent: progress.percent,
      });
      await repo.updateParticipant(p.id, {
        course_current_session: n, course_completion_percent: progress.percent, course_last_activity_at: new Date().toISOString(),
      });
      return ok(res, saved);
    } catch (e) { return oops(res, e); }
  });

  app.post('/api/abl/course/:slug/charter', async (req, res) => {
    try {
      const p = await repo.getParticipantBySlug(req.params.slug);
      if (!p) return fail(res, 'Course workspace not found', 404);
      if (!p.link_approved) return fail(res, 'This course workspace is not active yet.', 403);
      const builder = await repo.getBuilder(p.id);
      const markdown = builderMarkdown(p, (builder && builder.sessions) || {});
      const output = await repo.saveOutput({
        participant_id: p.id, output_type: 'ai_leadership_initiative',
        content_markdown: markdown,
        content_json: {
          builder_updated_at: builder && builder.updated_at,
          sessions: (builder && builder.sessions) || {},
        },
      });
      return ok(res, { id: output.id, markdown });
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
        geography: b.geography, business_model: b.business_model, login_enabled: b.login_enabled,
      });
      return ok(res, p, 201);
    } catch (e) { return oops(res, e); }
  });

  app.post('/api/abl/participants/bulk', requireAdmin, async (req, res) => {
    try {
      const entries = Array.isArray(req.body && req.body.participants) ? req.body.participants.slice(0, 250) : [];
      if (!entries.length) return fail(res, 'Add at least one participant email.');
      const result = { created: 0, updated: 0, skipped: 0, errors: [] };
      const titleCase = (value) => String(value || '').replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
      for (let i = 0; i < entries.length; i += 1) {
        const row = entries[i] || {};
        const email = normalizeEmail(row.email);
        if (!validEmail(email)) { result.errors.push(`Row ${i + 1}: invalid email`); result.skipped += 1; continue; }
        const existing = await repo.getParticipantByEmail(email);
        if (existing) {
          await repo.updateParticipant(existing.id, {
            email,
            email_normalized: email,
            login_enabled: true,
            link_approved: true,
            status: existing.status === 'draft' ? 'link_ready' : existing.status,
            approved_at: existing.approved_at || new Date().toISOString(),
            ...(row.name ? { name: String(row.name).trim() } : {}),
            ...(row.company_name ? { company_name: String(row.company_name).trim() } : {}),
            ...(row.role_title ? { role_title: String(row.role_title).trim() } : {}),
          });
          result.updated += 1;
          continue;
        }
        const local = email.split('@')[0];
        const domain = email.split('@')[1].split('.')[0];
        const p = await repo.createParticipant({
          name: String(row.name || titleCase(local) || 'Course participant').trim(),
          company_name: String(row.company_name || titleCase(domain) || 'To confirm').trim(),
          email,
          role_title: row.role_title ? String(row.role_title).trim() : null,
          login_enabled: true,
        });
        await repo.updateParticipant(p.id, {
          link_approved: true,
          status: 'link_ready',
          approved_at: new Date().toISOString(),
        });
        result.created += 1;
      }
      return ok(res, result, 201);
    } catch (e) { return oops(res, e); }
  });

  app.get('/api/abl/participants/:id', requireAdmin, async (req, res) => {
    try {
      const p = await repo.getParticipant(req.params.id);
      if (!p) return fail(res, 'Not found', 404);
      const [research, qa, outputs, memory, notes, assets, sessions] = await Promise.all([
        repo.getResearch(p.id), repo.getQa(p.id), repo.getOutputs(p.id), buildCourseMemory(p, { includePrivate: true }),
        repo.listNotes(p.id), repo.listAssets(p.id), repo.listSessions(p.id),
      ]);
      const conversations = await Promise.all(sessions.map(async (session) => ({
        ...session,
        messages: (await repo.listMessages(session.id))
          .filter((message) => ['user', 'assistant', 'admin'].includes(message.role)),
      })));
      const snapshot = outputs.find((output) => output.output_type === 'admin_participant_snapshot') || null;
      const evidenceDates = [
        p.updated_at, research && research.updated_at, memory && memory.updated_at,
        ...notes.map((note) => note.updated_at || note.created_at),
        ...assets.map((asset) => asset.updated_at || asset.created_at),
        ...conversations.flatMap((conversation) => [
          conversation.updated_at, ...conversation.messages.map((message) => message.created_at),
        ]),
        ...outputs.filter((output) => output.output_type !== 'admin_participant_snapshot')
          .map((output) => output.updated_at || output.created_at),
      ].filter(Boolean).map((value) => Date.parse(value)).filter(Number.isFinite);
      const evidenceUpdatedAt = evidenceDates.length ? new Date(Math.max(...evidenceDates)).toISOString() : p.updated_at;
      const snapshotTime = snapshot ? Date.parse(snapshot.updated_at || snapshot.created_at) : 0;
      const snapshotStale = !snapshot || (!!evidenceUpdatedAt && snapshotTime < Date.parse(evidenceUpdatedAt));
      return ok(res, {
        participant: p, research, qa, outputs, memory, notes, assets, conversations,
        snapshot_stale: snapshotStale, evidence_updated_at: evidenceUpdatedAt,
      });
    } catch (e) { return oops(res, e); }
  });

  app.patch('/api/abl/participants/:id', requireAdmin, async (req, res) => {
    try {
      const patch = { ...(req.body || {}) };
      if (Object.prototype.hasOwnProperty.call(patch, 'email')) patch.email_normalized = normalizeEmail(patch.email);
      return ok(res, await repo.updateParticipant(req.params.id, patch));
    } catch (e) { return oops(res, e); }
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
      if (!r.grounded) return fail(res, r.error || 'Verified company research was not completed.', 502);
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
      const current = await repo.getParticipant(req.params.id);
      if (!current) return fail(res, 'Not found', 404);
      const research = await repo.getResearch(req.params.id);
      const context = (research && research.structured_context) || {};
      if (!current.company_website || !research || !research.research_dossier || !(context.products || context.customers)) {
        return fail(res, 'Complete verified company research, including the official website, before approving this link.', 409);
      }
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

  app.post('/api/abl/participants/:id/admin-snapshot', requireAdmin, async (req, res) => {
    try {
      const p = await repo.getParticipant(req.params.id);
      if (!p) return fail(res, 'Not found', 404);
      const markdown = await generateAdminSnapshot(p);
      return ok(res, { markdown });
    } catch (e) { return oops(res, e); }
  });

  app.post('/api/abl/participants/:id/notes', requireAdmin, async (req, res) => {
    try {
      const p = await repo.getParticipant(req.params.id);
      if (!p) return fail(res, 'Not found', 404);
      if (!p.link_approved) return fail(res, 'Generate the participant page and link before adding meeting context.', 409);
      const content = String((req.body && req.body.content) || '').trim();
      if (!content) return fail(res, 'Add a meeting or conversation summary first.');
      const note = await repo.addNote(p.id, {
        title: req.body.title, content, source_name: req.body.source_name,
        visibility: req.body.visibility, occurred_at: req.body.occurred_at,
      });
      return ok(res, note, 201);
    } catch (e) { return oops(res, e); }
  });

  app.post('/api/abl/participants/:id/transcripts', requireAdmin, async (req, res) => {
    try {
      const p = await repo.getParticipant(req.params.id);
      if (!p) return fail(res, 'Not found', 404);
      if (!p.link_approved) return fail(res, 'Generate the participant page and link before adding meeting context.', 409);
      const extracted = await extractTranscript(req.body || {});
      const analysis = await analyseTranscript({ participant: p, transcript: extracted.text });
      const note = await repo.addNote(p.id, {
        title: req.body.title || 'One-on-one meeting',
        content: transcriptSummaryMarkdown(analysis),
        raw_transcript: extracted.text,
        source_kind: 'transcript',
        structured_context: analysis,
        transcript_truncated: extracted.truncated,
        source_name: req.body.source_name,
        visibility: 'private',
        review_status: 'draft',
        share_with_participant: false,
        occurred_at: req.body.occurred_at,
        processed_at: new Date().toISOString(),
      });
      return ok(res, note, 201);
    } catch (e) {
      if (/transcript|\.txt|\.md|\.docx|\.pdf|6 MB/i.test(String(e && e.message))) return fail(res, e.message, 400);
      return oops(res, e);
    }
  });

  app.delete('/api/abl/participants/:id/notes/:noteId', requireAdmin, async (req, res) => {
    try {
      const deleted = await repo.deleteNote(req.params.id, req.params.noteId);
      if (!deleted) return fail(res, 'Note not found', 404);
      return ok(res, { deleted: true });
    } catch (e) { return oops(res, e); }
  });

  app.patch('/api/abl/participants/:id/notes/:noteId', requireAdmin, async (req, res) => {
    try {
      const content = String((req.body && req.body.content) || '').trim();
      if (!content) return fail(res, 'The Course Memory summary cannot be empty.');
      const patch = { content };
      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'share_with_participant')) {
        patch.share_with_participant = !!req.body.share_with_participant;
      }
      const note = await repo.updateNote(req.params.id, req.params.noteId, patch);
      if (!note) return fail(res, 'Note not found', 404);
      return ok(res, note);
    } catch (e) { return oops(res, e); }
  });

  app.post('/api/abl/participants/:id/notes/:noteId/approve', requireAdmin, async (req, res) => {
    try {
      const p = await repo.getParticipant(req.params.id);
      if (!p) return fail(res, 'Not found', 404);
      const content = String((req.body && req.body.content) || '').trim();
      if (!content) return fail(res, 'Review the summary before approving it.');
      const note = await repo.updateNote(req.params.id, req.params.noteId, {
        content,
        visibility: 'course_memory',
        review_status: 'approved',
        approved_at: new Date().toISOString(),
        share_with_participant: !!(req.body && req.body.share_with_participant),
      });
      if (!note) return fail(res, 'Meeting record not found', 404);
      return ok(res, note);
    } catch (e) { return oops(res, e); }
  });

  app.post('/api/abl/participants/:id/assets', requireAdmin, async (req, res) => {
    try {
      const p = await repo.getParticipant(req.params.id);
      if (!p) return fail(res, 'Not found', 404);
      if (!p.link_approved) return fail(res, 'Generate the participant page and link before adding files.', 409);
      const fileName = String((req.body && req.body.file_name) || '').trim();
      if (!supportedParticipantAsset(fileName)) {
        return fail(res, 'Upload a PDF, Word, PowerPoint, Excel, text, CSV or image file.');
      }
      const buffer = decodeParticipantAsset(req.body && req.body.file_base64);
      const extracted = await extractParticipantAssetText(fileName, buffer);
      const asset = await repo.addAsset(p.id, {
        title: req.body.title || fileName,
        description: req.body.description,
        file_name: fileName,
        mime_type: participantAssetMime(fileName),
        buffer,
        extracted_text: extracted.text,
        extractable: extracted.extractable,
        extraction_error: extracted.extraction_error,
        context_truncated: extracted.truncated,
      });
      return ok(res, asset, 201);
    } catch (e) {
      if (/uploaded file|Participant files|Upload a PDF/i.test(String(e && e.message))) return fail(res, e.message, 400);
      return oops(res, e);
    }
  });

  app.get('/api/abl/participants/:id/assets/:assetId/download', requireAdmin, async (req, res) => {
    try {
      const result = await repo.getAssetBuffer(req.params.id, req.params.assetId);
      if (!result) return fail(res, 'File not found', 404);
      const safeName = String(result.asset.file_name || 'participant-file').replace(/["\r\n]/g, '_');
      res.setHeader('Content-Type', result.asset.mime_type || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
      res.setHeader('Content-Length', String(result.buffer.length));
      res.setHeader('Cache-Control', 'private, no-store');
      return res.send(result.buffer);
    } catch (e) { return oops(res, e); }
  });

  app.post('/api/abl/participants/:id/assets/:assetId/approve', requireAdmin, async (req, res) => {
    try {
      const current = await repo.getAsset(req.params.id, req.params.assetId);
      if (!current) return fail(res, 'File not found', 404);
      if (!current.extracted_text) return fail(res, 'This file is stored safely, but its text cannot be read by the course AI.', 409);
      const asset = await repo.updateAsset(req.params.id, req.params.assetId, { review_status: 'approved' });
      return ok(res, asset);
    } catch (e) { return oops(res, e); }
  });

  app.delete('/api/abl/participants/:id/assets/:assetId', requireAdmin, async (req, res) => {
    try {
      const deleted = await repo.deleteAsset(req.params.id, req.params.assetId);
      if (!deleted) return fail(res, 'File not found', 404);
      return ok(res, { deleted: true });
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



  // Real, branded, downloadable PDF (generated server-side, no browser).
  app.get('/ai-business-leaders/pdf/:outputId', async (req, res, next) => {
    try {
      const out = await repo.getOutput(req.params.outputId);
      if (!out) return next();
      if (['vinay_meeting_brief', 'admin_participant_snapshot'].includes(out.output_type) && !isAuthed(req)) {
        return res.status(403).send('This document is private.');
      }
      const p = await repo.getParticipant(out.participant_id);
      const title = REWARD_TITLES[out.output_type]
        || (out.output_type === 'vinay_meeting_brief' ? 'Meeting Brief'
          : out.output_type === 'admin_participant_snapshot' ? 'Admin Participant Snapshot' : 'Summary');
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
      if (['vinay_meeting_brief', 'admin_participant_snapshot'].includes(out.output_type) && !isAuthed(req)) {
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
