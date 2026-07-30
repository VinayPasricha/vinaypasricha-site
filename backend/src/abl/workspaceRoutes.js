// AI for Business Leaders — lifelong participant workspace + simple Studio API.
// Course materials, cohorts and assignments remain optional and never gate attendance.
import crypto from 'node:crypto';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { db, COLLECTIONS } from '../firestore.js';
import * as ablRepo from './store.js';

const SITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const nowISO = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();
const col = (name) => db.collection(name);
const docData = (d) => (d.exists ? { id: d.id, ...d.data() } : null);
const ok = (res, data, code = 200) => res.status(code).json({ ok: true, data });
const fail = (res, error, code = 400) => res.status(code).json({ ok: false, error });
const cleanText = (v, max = 12000) => String(v == null ? '' : v).trim().slice(0, max);
const cleanArray = (v, max = 100) => Array.isArray(v) ? v.filter(Boolean).map(String).slice(0, max) : [];

function parseCookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}
function studioHash() {
  const passphrase = String(process.env.STUDIO_PASSPHRASE || '').trim();
  if (!passphrase) return '';
  return crypto.createHash('sha256').update('studio:' + passphrase).digest('hex');
}
function requireStudio(req, res, next) {
  const cookie = parseCookies(req).__session;
  const token = req.get('x-admin-token') || (req.query && req.query.token) || '';
  const expectedCookie = studioHash();
  const cookieAllowed = !!expectedCookie && cookie === expectedCookie;
  const tokenAllowed = !!process.env.ADMIN_TOKEN && token === process.env.ADMIN_TOKEN;
  if (cookieAllowed || tokenAllowed) return next();
  return res.status(401).json({ ok: false, error: 'unauthorized' });
}

async function listCollection(name, limit = 500) {
  const snap = await col(name).limit(limit).get();
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  rows.sort((a, b) => String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || '')));
  return rows;
}
async function saveDoc(name, id, input) {
  const ref = col(name).doc(id || uuid());
  const old = await ref.get();
  const row = { ...input, updated_at: nowISO() };
  if (!old.exists) row.created_at = nowISO();
  await ref.set(row, { merge: true });
  return docData(await ref.get());
}
async function deleteDoc(name, id) {
  await col(name).doc(id).delete();
  return { deleted: true };
}
function publishIsLive(item) {
  if (item.status === 'published') return true;
  if (item.status !== 'scheduled' || !item.publish_at) return false;
  return new Date(item.publish_at).getTime() <= Date.now();
}
function visibleTo(item, participant) {
  if (!publishIsLive(item)) return false;
  const audience = item.audience || 'all';
  if (audience === 'all') return true;
  if (audience === 'cohorts') return cleanArray(item.cohort_ids).includes(String(participant.cohort_id || ''));
  if (audience === 'participants') return cleanArray(item.participant_ids).includes(String(participant.id));
  return false;
}
function participantCohort(cohort) {
  if (!cohort) return null;
  const current = Math.max(1, Math.min(5, parseInt(cohort.current_session, 10) || 1));
  const sessions = cohort.sessions && typeof cohort.sessions === 'object' ? cohort.sessions : {};
  const session = sessions[String(current)] || sessions[current] || {};
  return {
    ...cohort,
    current_session: current,
    meeting_url: cleanText(session.meeting_url || cohort.meeting_url, 3000) || null,
    session_date: session.date || null,
  };
}
function sanitiseMaterial(b) {
  return {
    title: cleanText(b.title, 180), description: cleanText(b.description, 2000),
    type: cleanText(b.type || 'resource', 40), phase: cleanText(b.phase || 'before', 30),
    session_number: Math.max(0, Math.min(5, parseInt(b.session_number, 10) || 0)),
    source_url: cleanText(b.source_url, 3000), file_name: cleanText(b.file_name, 260),
    audience: ['all', 'cohorts', 'participants'].includes(b.audience) ? b.audience : 'all',
    cohort_ids: cleanArray(b.cohort_ids), participant_ids: cleanArray(b.participant_ids),
    status: ['draft', 'published', 'scheduled', 'hidden'].includes(b.status) ? b.status : 'draft',
    publish_at: b.publish_at || null,
  };
}
function sanitiseAssignment(b) {
  return {
    title: cleanText(b.title, 180), instructions: cleanText(b.instructions, 12000),
    session_number: Math.max(1, Math.min(5, parseInt(b.session_number, 10) || 1)),
    due_at: b.due_at || null,
    audience: ['all', 'cohorts', 'participants'].includes(b.audience) ? b.audience : 'cohorts',
    cohort_ids: cleanArray(b.cohort_ids), participant_ids: cleanArray(b.participant_ids),
    status: ['draft', 'published', 'scheduled', 'hidden'].includes(b.status) ? b.status : 'draft',
    publish_at: b.publish_at || null,
  };
}
function sanitiseAnnouncement(b) {
  return {
    title: cleanText(b.title, 180), message: cleanText(b.message, 5000), link_url: cleanText(b.link_url, 3000),
    audience: ['all', 'cohorts', 'participants'].includes(b.audience) ? b.audience : 'all',
    cohort_ids: cleanArray(b.cohort_ids), participant_ids: cleanArray(b.participant_ids),
    status: ['draft', 'published', 'scheduled', 'hidden'].includes(b.status) ? b.status : 'draft',
    publish_at: b.publish_at || null,
  };
}

export function registerWorkspaceRoutes(app) {
  // Legacy fallback shell. The focused participant route is registered first and normally wins.
  let workspaceShell = null;
  app.get('/ai-business-leaders/workspace/:slug', (req, res, next) => {
    try {
      if (workspaceShell == null) workspaceShell = readFileSync(path.join(SITE_ROOT, 'ai-business-leaders', 'workspace-preview.html'), 'utf8');
      res.set('Content-Type', 'text/html; charset=utf-8');
      return res.send(workspaceShell);
    } catch (e) { return next(); }
  });

  app.get('/api/abl/workspace/:slug', async (req, res) => {
    try {
      const p = await ablRepo.getParticipantBySlug(req.params.slug);
      if (!p) return fail(res, 'Workspace not found', 404);
      if (!p.link_approved) return fail(res, 'This workspace is not active yet.', 403);
      const [cohort, materials, assignments, announcements, builder, outputs] = await Promise.all([
        p.cohort_id ? docData(await col(COLLECTIONS.ablCohorts).doc(String(p.cohort_id)).get()) : null,
        listCollection(COLLECTIONS.ablMaterials),
        listCollection(COLLECTIONS.ablAssignments),
        listCollection(COLLECTIONS.ablAnnouncements),
        ablRepo.getBuilder(p.id),
        ablRepo.getOutputs(p.id),
      ]);
      const visibleAssignments = assignments.filter((a) => visibleTo(a, p));
      const submissionSnap = await col(COLLECTIONS.ablSubmissions).where('participant_id', '==', p.id).get();
      const submissions = submissionSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const byAssignment = Object.fromEntries(submissions.map((s) => [s.assignment_id, s]));
      const initiative = outputs.find((o) => o.output_type === 'ai_leadership_initiative') || null;
      const journeyStarted = !!(p.last_activity_at || p.message_count || p.course_last_activity_at || (builder && builder.completion_percent));
      if (p.invite_status !== 'active') ablRepo.updateParticipant(p.id, { invite_status: 'active' }).catch(() => {});
      return ok(res, {
        participant: {
          id: p.id, slug: p.slug, name: p.name, first_name: String(p.name || '').trim().split(/\s+/)[0] || 'My',
          company_name: p.company_name, role_title: p.role_title, cohort_id: p.cohort_id || null,
          invite_status: p.invite_status || (journeyStarted ? 'active' : 'invited'), journey_started: journeyStarted,
          last_activity_at: p.course_last_activity_at || p.last_activity_at || null,
        },
        cohort: participantCohort(cohort),
        materials: materials.filter((m) => visibleTo(m, p)),
        assignments: visibleAssignments.map((a) => ({ ...a, submission: byAssignment[a.id] || null })),
        announcements: announcements.filter((a) => visibleTo(a, p)),
        builder: builder || { sessions: {}, current_session: 1, completed_sessions: [], completion_percent: 0 },
        initiative: initiative ? { id: initiative.id, updated_at: initiative.updated_at || initiative.created_at } : null,
      });
    } catch (e) {
      console.error('[abl-workspace] participant load', e);
      return fail(res, 'Server error', 500);
    }
  });

  app.patch('/api/abl/workspace/:slug/submissions/:assignmentId', async (req, res) => {
    try {
      const p = await ablRepo.getParticipantBySlug(req.params.slug);
      if (!p || !p.link_approved) return fail(res, 'Workspace not found', 404);
      const assignment = docData(await col(COLLECTIONS.ablAssignments).doc(req.params.assignmentId).get());
      if (!assignment || !visibleTo(assignment, p)) return fail(res, 'Assignment not available', 404);
      const id = `${req.params.assignmentId}_${p.id}`;
      const status = req.body && req.body.status === 'submitted' ? 'submitted' : 'draft';
      const saved = await saveDoc(COLLECTIONS.ablSubmissions, id, {
        assignment_id: req.params.assignmentId, participant_id: p.id,
        response_text: cleanText(req.body && req.body.response_text, 30000),
        file_url: cleanText(req.body && req.body.file_url, 3000),
        status, submitted_at: status === 'submitted' ? nowISO() : null,
      });
      await ablRepo.updateParticipant(p.id, { course_last_activity_at: nowISO() });
      return ok(res, saved);
    } catch (e) {
      console.error('[abl-workspace] submission', e);
      return fail(res, 'Server error', 500);
    }
  });

  app.get('/api/abl/workspace/admin/dashboard', requireStudio, async (req, res) => {
    try {
      const [participants, cohorts, materials, assignments, announcements, submissions] = await Promise.all([
        ablRepo.listParticipants(), listCollection(COLLECTIONS.ablCohorts), listCollection(COLLECTIONS.ablMaterials),
        listCollection(COLLECTIONS.ablAssignments), listCollection(COLLECTIONS.ablAnnouncements), listCollection(COLLECTIONS.ablSubmissions),
      ]);
      return ok(res, { participants, cohorts, materials, assignments, announcements, submissions });
    } catch (e) { console.error('[abl-workspace] dashboard', e); return fail(res, 'Server error', 500); }
  });

  app.post('/api/abl/workspace/admin/participants/bulk', requireStudio, async (req, res) => {
    try {
      const rows = Array.isArray(req.body && req.body.participants) ? req.body.participants.slice(0, 300) : [];
      const cohortId = cleanText(req.body && req.body.cohort_id, 120) || null;
      const created = [], skipped = [];
      for (const row of rows) {
        const name = cleanText(row.name, 160), email = cleanText(row.email, 320).toLowerCase(), phone = cleanText(row.phone, 50);
        if (!name || !email) { skipped.push({ name, email, reason: 'Name and email required' }); continue; }
        const existing = await ablRepo.getParticipantByEmail(email);
        if (existing) { skipped.push({ name, email, reason: 'Email already exists' }); continue; }
        const p = await ablRepo.createParticipant({ name, company_name: cleanText(row.company_name, 180) || 'To be added', email, role_title: cleanText(row.role_title, 180) || null });
        const saved = await ablRepo.updateParticipant(p.id, { phone: phone || null, cohort_id: cohortId, invite_status: 'not_invited' });
        created.push(saved);
      }
      return ok(res, { created, skipped }, 201);
    } catch (e) { console.error('[abl-workspace] bulk participants', e); return fail(res, 'Server error', 500); }
  });

  app.patch('/api/abl/workspace/admin/participants/:id', requireStudio, async (req, res) => {
    try {
      const b = req.body || {};
      const patch = {};
      ['name', 'email', 'phone', 'company_name', 'role_title', 'cohort_id', 'invite_status'].forEach((k) => {
        if (Object.prototype.hasOwnProperty.call(b, k)) patch[k] = b[k] == null ? null : cleanText(b[k], k === 'email' ? 320 : 240);
      });
      if (patch.email) patch.email = patch.email.toLowerCase();
      return ok(res, await ablRepo.updateParticipant(req.params.id, patch));
    } catch (e) { return fail(res, 'Server error', 500); }
  });

  app.post('/api/abl/workspace/admin/participants/:id/invite', requireStudio, async (req, res) => {
    try {
      const p = await ablRepo.getParticipant(req.params.id);
      if (!p) return fail(res, 'Participant not found', 404);
      if (!cleanText(p.email, 320)) return fail(res, 'Add the participant email before inviting them.');
      const saved = await ablRepo.updateParticipant(p.id, { invite_status: 'invited', link_approved: true, approved_at: nowISO() });
      const loginUrl = `${req.protocol}://${req.get('host')}/ai-business-leaders/login`;
      return ok(res, { participant: saved, activation_url: loginUrl, login_url: loginUrl });
    } catch (e) { return fail(res, 'Server error', 500); }
  });

  app.get('/api/abl/workspace/admin/cohorts', requireStudio, async (req, res) => ok(res, await listCollection(COLLECTIONS.ablCohorts)));
  app.post('/api/abl/workspace/admin/cohorts', requireStudio, async (req, res) => {
    const b = req.body || {};
    if (!cleanText(b.name, 160)) return fail(res, 'Cohort name is required');
    return ok(res, await saveDoc(COLLECTIONS.ablCohorts, null, {
      name: cleanText(b.name, 160), description: cleanText(b.description, 1000), status: b.status || 'active',
      timezone: cleanText(b.timezone, 80) || 'Asia/Kolkata', sessions: b.sessions && typeof b.sessions === 'object' ? b.sessions : {},
      current_session: Math.max(1, Math.min(5, parseInt(b.current_session, 10) || 1)),
    }), 201);
  });
  app.patch('/api/abl/workspace/admin/cohorts/:id', requireStudio, async (req, res) => ok(res, await saveDoc(COLLECTIONS.ablCohorts, req.params.id, req.body || {})));
  app.delete('/api/abl/workspace/admin/cohorts/:id', requireStudio, async (req, res) => ok(res, await deleteDoc(COLLECTIONS.ablCohorts, req.params.id)));

  app.get('/api/abl/workspace/admin/materials', requireStudio, async (req, res) => ok(res, await listCollection(COLLECTIONS.ablMaterials)));
  app.post('/api/abl/workspace/admin/materials', requireStudio, async (req, res) => {
    const row = sanitiseMaterial(req.body || {});
    if (!row.title) return fail(res, 'Material title is required');
    return ok(res, await saveDoc(COLLECTIONS.ablMaterials, null, row), 201);
  });
  app.patch('/api/abl/workspace/admin/materials/:id', requireStudio, async (req, res) => ok(res, await saveDoc(COLLECTIONS.ablMaterials, req.params.id, sanitiseMaterial(req.body || {}))));
  app.delete('/api/abl/workspace/admin/materials/:id', requireStudio, async (req, res) => ok(res, await deleteDoc(COLLECTIONS.ablMaterials, req.params.id)));

  app.get('/api/abl/workspace/admin/assignments', requireStudio, async (req, res) => ok(res, await listCollection(COLLECTIONS.ablAssignments)));
  app.post('/api/abl/workspace/admin/assignments', requireStudio, async (req, res) => {
    const row = sanitiseAssignment(req.body || {});
    if (!row.title) return fail(res, 'Assignment title is required');
    return ok(res, await saveDoc(COLLECTIONS.ablAssignments, null, row), 201);
  });
  app.patch('/api/abl/workspace/admin/assignments/:id', requireStudio, async (req, res) => ok(res, await saveDoc(COLLECTIONS.ablAssignments, req.params.id, sanitiseAssignment(req.body || {}))));
  app.delete('/api/abl/workspace/admin/assignments/:id', requireStudio, async (req, res) => ok(res, await deleteDoc(COLLECTIONS.ablAssignments, req.params.id)));
  app.get('/api/abl/workspace/admin/submissions', requireStudio, async (req, res) => ok(res, await listCollection(COLLECTIONS.ablSubmissions)));
  app.patch('/api/abl/workspace/admin/submissions/:id', requireStudio, async (req, res) => ok(res, await saveDoc(COLLECTIONS.ablSubmissions, req.params.id, { admin_comment: cleanText(req.body && req.body.admin_comment, 5000) })));

  app.get('/api/abl/workspace/admin/announcements', requireStudio, async (req, res) => ok(res, await listCollection(COLLECTIONS.ablAnnouncements)));
  app.post('/api/abl/workspace/admin/announcements', requireStudio, async (req, res) => {
    const row = sanitiseAnnouncement(req.body || {});
    if (!row.title || !row.message) return fail(res, 'Title and message are required');
    return ok(res, await saveDoc(COLLECTIONS.ablAnnouncements, null, row), 201);
  });
  app.patch('/api/abl/workspace/admin/announcements/:id', requireStudio, async (req, res) => ok(res, await saveDoc(COLLECTIONS.ablAnnouncements, req.params.id, sanitiseAnnouncement(req.body || {}))));
  app.delete('/api/abl/workspace/admin/announcements/:id', requireStudio, async (req, res) => ok(res, await deleteDoc(COLLECTIONS.ablAnnouncements, req.params.id)));
}
