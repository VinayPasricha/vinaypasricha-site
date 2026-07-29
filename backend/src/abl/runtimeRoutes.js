// The three guided course runtimes — VED, SIV and the continuing check-in.
//
// Kept in its own module (like the workspace routes) so the runtimes can be
// registered alongside this branch's Initiative Builder without either one
// having to know about the other. The conversation engine itself lives in
// service.js + course-runtimes.js, both carried over from main.
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as repo from './store.js';
import {
  agentTurn, runtimeOpeningTurn, generateSivReport, generateVedReport,
  generateLeadershipBlueprint, RUNTIME_OPENING_VERSION, usableOptions,
} from './service.js';
import { COURSE_RUNTIME_MODES } from './course-runtimes.js';
import { buildCourseMemory } from './memory.js';
import { SOFT_WARN_AT } from './copy.js';

const SITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ok = (res, data, code = 200) => res.status(code).json({ ok: true, data });
const fail = (res, error, code = 400) => res.status(code).json({ ok: false, error });
const oops = (res, e) => {
  console.error('[abl-runtime]', e.message);
  return res.status(500).json({ ok: false, error: 'Something went wrong. Please try again.' });
};
const runtimeMode = (v) => (v === 'siv' || v === 'ved' || v === 'continuing' ? v : null);

// Every participant endpoint resolves the same way: known slug, approved link.
async function participantFor(req, res) {
  const p = await repo.getParticipantBySlug(req.params.slug);
  if (!p) { fail(res, 'Session not found', 404); return null; }
  if (!p.link_approved) { fail(res, 'This session is not active yet.', 403); return null; }
  return p;
}

export function registerRuntimeRoutes(app, { rateLimit }) {
  const chatLimit = rateLimit({ windowMs: 60000, max: 30 });
  const reportLimit = rateLimit({ windowMs: 300000, max: 6 });

  // Current state of one runtime: transcript, progress, report, memory.
  app.get('/api/abl/session/:slug/runtime/:mode', async (req, res) => {
    try {
      const mode = runtimeMode(req.params.mode);
      if (!mode) return fail(res, 'Unknown course runtime', 404);
      const p = await participantFor(req, res);
      if (!p) return undefined;

      const session = await repo.getOrCreateSession(p.id, mode);
      const started = mode === 'siv' ? !!session.selected_depth : !!session.consent_given;
      const storedMessages = (await repo.listMessages(session.id))
        .filter((m) => m.role === 'user' || m.role === 'assistant');
      const messages = storedMessages.map((m) => ({
        role: m.role, content: m.content, at: m.created_at,
        // Stored options are filtered on the way out too, so turns saved before
        // the rule existed cannot keep offering unclickable answers.
        options: usableOptions((m.metadata && m.metadata.options) || []),
        selection_mode: (m.metadata && m.metadata.selection_mode) || 'single',
        stage: (m.metadata && m.metadata.stage) || '',
      }));
      // Self-heal a session marked started that never received its opening turn.
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
        opening_version: RUNTIME_OPENING_VERSION,
      });
    } catch (e) { return oops(res, e); }
  });

  // Start a runtime. SIV also picks a depth; the others just consent.
  app.post('/api/abl/session/:slug/runtime/:mode', async (req, res) => {
    try {
      const mode = runtimeMode(req.params.mode);
      if (!mode) return fail(res, 'Unknown course runtime', 404);
      const p = await participantFor(req, res);
      if (!p) return undefined;
      const session = await repo.getOrCreateSession(p.id, mode);

      if (mode === 'siv') {
        const depth = String((req.body && req.body.depth) || '');
        if (!['fast', 'standard', 'deep'].includes(depth)) return fail(res, 'Choose a valid depth.');
        const updated = await repo.updateSession(session.id, { selected_depth: depth, consent_given: true });
        const existing = await repo.listMessages(updated.id);
        const opening = existing.length ? null : await runtimeOpeningTurn({ participant: p, session: updated, mode });
        return ok(res, {
          started: true, depth: updated.selected_depth,
          reply: opening && opening.reply, options: (opening && opening.options) || [],
          selection_mode: (opening && opening.selectionMode) || 'multi',
        });
      }

      const updated = await repo.updateSession(session.id, { consent_given: true });
      const existing = await repo.listMessages(updated.id);
      const opening = existing.length ? null : await runtimeOpeningTurn({ participant: p, session: updated, mode });
      return ok(res, {
        started: true, reply: opening && opening.reply,
        options: (opening && opening.options) || [],
        selection_mode: (opening && opening.selectionMode) || 'single',
      });
    } catch (e) { return oops(res, e); }
  });

  app.post('/api/abl/session/:slug/runtime/:mode/message', chatLimit, async (req, res) => {
    try {
      const mode = runtimeMode(req.params.mode);
      if (!mode) return fail(res, 'Unknown course runtime', 404);
      const msg = String((req.body && req.body.message) || '').trim();
      if (!msg) return fail(res, 'Empty message');
      if (msg.length > 6000) return fail(res, 'Message too long');
      const p = await participantFor(req, res);
      if (!p) return undefined;
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

  app.post('/api/abl/session/:slug/runtime/:mode/report', reportLimit, async (req, res) => {
    try {
      const mode = runtimeMode(req.params.mode);
      if (!mode) return fail(res, 'Unknown course runtime', 404);
      const p = await participantFor(req, res);
      if (!p) return undefined;
      const session = await repo.getOrCreateSession(p.id, mode);
      if (mode === 'siv' && !session.selected_depth) return fail(res, 'Start the examination before generating a report.');
      if (mode !== 'siv' && !session.consent_given) return fail(res, 'Start the conversation before generating a report.');
      const userTurns = (await repo.listMessages(session.id)).filter((m) => m.role === 'user').length;
      if (userTurns < 2) return fail(res, 'Go a little further into the conversation before generating your report.');

      const report = mode === 'siv' ? await generateSivReport(p)
        : mode === 'ved' ? await generateVedReport(p) : await generateLeadershipBlueprint(p);
      return ok(res, { report });
    } catch (e) { return oops(res, e); }
  });

  // Start over without losing verified company context or the other runtimes.
  app.post('/api/abl/session/:slug/runtime/:mode/restart', async (req, res) => {
    try {
      const mode = runtimeMode(req.params.mode);
      if (!mode) return fail(res, 'Unknown course runtime', 404);
      const p = await participantFor(req, res);
      if (!p) return undefined;
      const session = await repo.getOrCreateSession(p.id, mode);
      const messages = await repo.listMessages(session.id);
      const usedTurns = messages.filter((m) => m.role === 'user').length;
      await repo.deleteMessages(messages.map((m) => m.id));
      await repo.updateSession(session.id, {
        consent_given: false, selected_depth: null, current_stage: null,
        running_summary: null, summary_reviewed: false,
      });
      if (usedTurns) await repo.updateParticipant(p.id, { message_count: Math.max(0, (p.message_count || 0) - usedTurns) });
      if (mode === 'ved') {
        await repo.upsertMemory(p.id, { fields: { desired_output: '', execution_sequence: '', ved_constraint: '', ved_correction: '', ved_measurement: '' } });
      } else if (mode === 'siv') {
        await repo.upsertMemory(p.id, { fields: { candidate_projects: '', company_brain: '', selected_project: '', baseline: '', target: '', owner: '', value_case: '', guardrails: '' } });
      }
      return ok(res, { restarted: true, preserved: 'verified company context and other conversations' });
    } catch (e) { return oops(res, e); }
  });

  // The combined blueprint draws on both finished reports.
  app.post('/api/abl/session/:slug/blueprint', reportLimit, async (req, res) => {
    try {
      const p = await participantFor(req, res);
      if (!p) return undefined;
      const [ved, siv] = await Promise.all([
        repo.getLatestOutput(p.id, 'ved_report'), repo.getLatestOutput(p.id, 'siv_report'),
      ]);
      if (!ved || !siv) return fail(res, 'Complete the VED and SIV reports before building the combined blueprint.', 409);
      return ok(res, { report: await generateLeadershipBlueprint(p) });
    } catch (e) { return oops(res, e); }
  });

  // Shared Course Memory, readable and correctable without restarting anything.
  app.get('/api/abl/session/:slug/memory', async (req, res) => {
    try {
      const p = await participantFor(req, res);
      if (!p) return undefined;
      return ok(res, await buildCourseMemory(p));
    } catch (e) { return oops(res, e); }
  });

  // The runtime conversation page itself, served per slug and mode.
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
}
