// AI for Business Leaders — lifelong participant workspace + simple Studio API.
// Course materials, cohorts and assignments remain optional and never gate attendance.
import crypto from 'node:crypto';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { db, COLLECTIONS } from '../firestore.js';
import * as ablRepo from './store.js';
import { sendAnnouncementEmails } from './announcementMail.js';

const SITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const nowISO = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();
const col = (name) => db.collection(name);
const docData = (doc) => (doc.exists ? { id: doc.id, ...doc.data() } : null);
const ok = (res, data, code = 200) => res.status(code).json({ ok: true, data });
const fail = (res, error, code = 400) => res.status(code).json({ ok: false, error });
const cleanText = (value, max = 12000) => String(value == null ? '' : value).trim().slice(0, max);
const cleanArray = (value, max = 100) => Array.isArray(value) ? value.filter(Boolean).map(String).slice(0, max) : [];

function parseCookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach((part) => {
    const index = part.indexOf('=');
    if (index > -1) out[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
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
  const snapshot = await col(name).limit(limit).get();
  const rows = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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
function hasEntitlement(item, participant, field) {
  if (!field || !item || !item.id) return false;
  return cleanArray(participant && participant[field], 1000).includes(String(item.id));
}
function visibleTo(item, participant, entitlementField = null) {
  if (!publishIsLive(item)) return false;
  const audience = item.audience || 'all';
  if (audience === 'all') return true;
  if (audience === 'cohorts') {
    const currentCohort = String(participant.cohort_id || '');
    return cleanArray(item.cohort_ids).includes(currentCohort) || hasEntitlement(item, participant, entitlementField);
  }
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
function sanitiseMaterial(body) {
  return {
    title: cleanText(body.title, 180), description: cleanText(body.description, 2000),
    type: cleanText(body.type || 'resource', 40), phase: cleanText(body.phase || 'before', 30),
    session_number: Math.max(0, Math.min(5, parseInt(body.session_number, 10) || 0)),
    source_url: cleanText(body.source_url, 3000), file_name: cleanText(body.file_name, 260),
    audience: ['all', 'cohorts', 'participants'].includes(body.audience) ? body.audience : 'all',
    cohort_ids: cleanArray(body.cohort_ids), participant_ids: cleanArray(body.participant_ids),
    status: ['draft', 'published', 'scheduled', 'hidden'].includes(body.status) ? body.status : 'draft',
    publish_at: body.publish_at || null,
  };
}
function sanitiseAssignment(body) {
  return {
    title: cleanText(body.title, 180), instructions: cleanText(body.instructions, 12000),
    session_number: Math.max(1, Math.min(5, parseInt(body.session_number, 10) || 1)),
    due_at: body.due_at || null,
    audience: ['all', 'cohorts', 'participants'].includes(body.audience) ? body.audience : 'cohorts',
    cohort_ids: cleanArray(body.cohort_ids), participant_ids: cleanArray(body.participant_ids),
    status: ['draft', 'published', 'scheduled', 'hidden'].includes(body.status) ? body.status : 'draft',
    publish_at: body.publish_at || null,
  };
}
function sanitiseAnnouncement(body) {
  return {
    title: cleanText(body.title, 180), message: cleanText(body.message, 5000), link_url: cleanText(body.link_url, 3000),
    audience: ['all', 'cohorts', 'participants'].includes(body.audience) ? body.audience : 'all',
    cohort_ids: cleanArray(body.cohort_ids), participant_ids: cleanArray(body.participant_ids),
    status: ['draft', 'published', 'scheduled', 'hidden'].includes(body.status) ? body.status : 'draft',
    publish_at: body.publish_at || null,
  };
}

export function registerWorkspaceRoutes(app) {
  let workspaceShell = null;
  app.get('/ai-business-leaders/workspace/:slug', (req, res, next) => {
    try {
      if (workspaceShell == null) workspaceShell = readFileSync(path.join(SITE_ROOT, 'ai-business-leaders', 'workspace-preview.html'), 'utf8');
      res.set('Content-Type', 'text/html; charset=utf-8');
      return res.send(workspaceShell);
    } catch (error) { return next(); }
  });

  app.get('/api/abl/workspace/:slug', async (req, res) => {
    try {
      const participant = await ablRepo.getParticipantBySlug(req.params.slug);
      if (!participant) return fail(res, 'Workspace not found', 404);
      if (!participant.link_approved) return fail(res, 'This workspace is not active yet.', 403);
      const [cohort, materials, assignments, announcements, builder, outputs, submissionSnap] = await Promise.all([
        participant.cohort_id ? docData(await col(COLLECTIONS.ablCohorts).doc(String(participant.cohort_id)).get()) : null,
        listCollection(COLLECTIONS.ablMaterials),
        listCollection(COLLECTIONS.ablAssignments),
        listCollection(COLLECTIONS.ablAnnouncements),
        ablRepo.getBuilder(participant.id),
        ablRepo.getOutputs(participant.id),
        col(COLLECTIONS.ablSubmissions).where('participant_id', '==', participant.id).get(),
      ]);
      const submissions = submissionSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const byAssignment = Object.fromEntries(submissions.map((submission) => [submission.assignment_id, submission]));
      const visibleAssignments = assignments.filter((assignment) => visibleTo(assignment, participant, 'assignment_entitlements') || Boolean(byAssignment[assignment.id]));
      const initiative = outputs.find((output) => output.output_type === 'ai_leadership_initiative') || null;
      const journeyStarted = !!(participant.last_activity_at || participant.message_count || participant.course_last_activity_at || (builder && builder.completion_percent));
      if (participant.invite_status !== 'active') ablRepo.updateParticipant(participant.id, { invite_status: 'active' }).catch(() => {});
      return ok(res, {
        participant: {
          id: participant.id, slug: participant.slug, name: participant.name,
          first_name: String(participant.name || '').trim().split(/\s+/)[0] || 'My',
          company_name: participant.company_name, role_title: participant.role_title,
          cohort_id: participant.cohort_id || null,
          invite_status: participant.invite_status || (journeyStarted ? 'active' : 'invited'),
          journey_started: journeyStarted,
          last_activity_at: participant.course_last_activity_at || participant.last_activity_at || null,
        },
        cohort: participantCohort(cohort),
        materials: materials.filter((material) => visibleTo(material, participant, 'material_entitlements')),
        assignments: visibleAssignments.map((assignment) => ({ ...assignment, submission: byAssignment[assignment.id] || null })),
        announcements: announcements.filter((announcement) => visibleTo(announcement, participant)),
        builder: builder || { sessions: {}, current_session: 1, completed_sessions: [], completion_percent: 0 },
        initiative: initiative ? { id: initiative.id, updated_at: initiative.updated_at || initiative.created_at } : null,
      });
    } catch (error) {
      console.error('[abl-workspace] participant load', error);
      return fail(res, 'Server error', 500);
    }
  });

  app.patch('/api/abl/workspace/:slug/submissions/:assignmentId', async (req, res) => {
    try {
      const participant = await ablRepo.getParticipantBySlug(req.params.slug);
      if (!participant || !participant.link_approved) return fail(res, 'Workspace not found', 404);
      const assignment = docData(await col(COLLECTIONS.ablAssignments).doc(req.params.assignmentId).get());
      const id = `${req.params.assignmentId}_${participant.id}`;
      const existingSubmission = docData(await col(COLLECTIONS.ablSubmissions).doc(id).get());
      const assignmentAvailable = assignment && (visibleTo(assignment, participant, 'assignment_entitlements') || Boolean(existingSubmission));
      if (!assignmentAvailable) return fail(res, 'Assignment not available', 404);
      const status = req.body && req.body.status === 'submitted' ? 'submitted' : 'draft';
      const saved = await saveDoc(COLLECTIONS.ablSubmissions, id, {
        assignment_id: req.params.assignmentId, participant_id: participant.id,
        response_text: cleanText(req.body && req.body.response_text, 30000),
        file_url: cleanText(req.body && req.body.file_url, 3000),
        status, submitted_at: status === 'submitted' ? nowISO() : null,
      });
      await ablRepo.updateParticipant(participant.id, { course_last_activity_at: nowISO() });
      return ok(res, saved);
    } catch (error) {
      console.error('[abl-workspace] submission', error);
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
    } catch (error) {
      console.error('[abl-workspace] dashboard', error);
      return fail(res, 'Server error', 500);
    }
  });

  app.post('/api/abl/workspace/admin/participants/bulk', requireStudio, async (req, res) => {
    try {
      const rows = Array.isArray(req.body && req.body.participants) ? req.body.participants.slice(0, 300) : [];
      const cohortId = cleanText(req.body && req.body.cohort_id, 120) || null;
      const created = [], skipped = [];
      for (const row of rows) {
        const name = cleanText(row.name, 160);
        const email = cleanText(row.email, 320).toLowerCase();
        const phone = cleanText(row.phone, 50);
        if (!name || !email) { skipped.push({ name, email, reason: 'Name and email required' }); continue; }
        const existing = await ablRepo.getParticipantByEmail(email);
        if (existing) { skipped.push({ name, email, reason: 'Email already exists' }); continue; }
        const participant = await ablRepo.createParticipant({
          name, company_name: cleanText(row.company_name, 180) || 'To be added',
          email, role_title: cleanText(row.role_title, 180) || null,
        });
        const saved = await ablRepo.updateParticipant(participant.id, {
          phone: phone || null,
          cohort_id: cohortId,
          cohort_history: cohortId ? [{ from_cohort_id: null, to_cohort_id: cohortId, changed_at: nowISO() }] : [],
          material_entitlements: [], assignment_entitlements: [],
          invite_status: 'not_invited',
        });
        created.push(saved);
      }
      return ok(res, { created, skipped }, 201);
    } catch (error) {
      console.error('[abl-workspace] bulk participants', error);
      return fail(res, 'Server error', 500);
    }
  });

  app.patch('/api/abl/workspace/admin/participants/:id', requireStudio, async (req, res) => {
    try {
      const current = await ablRepo.getParticipant(req.params.id);
      if (!current) return fail(res, 'Participant not found', 404);
      const body = req.body || {};
      const patch = {};
      ['name', 'email', 'phone', 'company_name', 'role_title', 'cohort_id', 'invite_status'].forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(body, key)) patch[key] = body[key] == null ? null : cleanText(body[key], key === 'email' ? 320 : 240);
      });
      if (patch.email) {
        patch.email = patch.email.toLowerCase();
        if (patch.email !== String(current.email || '').toLowerCase()) {
          const duplicate = await ablRepo.getParticipantByEmail(patch.email);
          if (duplicate && duplicate.id !== current.id) return fail(res, 'Email already exists', 409);
        }
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'cohort_id')) {
        const previousCohortId = cleanText(current.cohort_id, 120) || null;
        const nextCohortId = cleanText(patch.cohort_id, 120) || null;
        patch.cohort_id = nextCohortId;
        if (previousCohortId !== nextCohortId) {
          const [materials, assignments] = await Promise.all([
            listCollection(COLLECTIONS.ablMaterials), listCollection(COLLECTIONS.ablAssignments),
          ]);
          const materialEntitlements = new Set(cleanArray(current.material_entitlements, 1000));
          const assignmentEntitlements = new Set(cleanArray(current.assignment_entitlements, 1000));
          materials.filter((material) => visibleTo(material, current, 'material_entitlements')).forEach((material) => materialEntitlements.add(String(material.id)));
          assignments.filter((assignment) => visibleTo(assignment, current, 'assignment_entitlements')).forEach((assignment) => assignmentEntitlements.add(String(assignment.id)));
          patch.material_entitlements = [...materialEntitlements].slice(-1000);
          patch.assignment_entitlements = [...assignmentEntitlements].slice(-1000);
          patch.cohort_history = [
            ...(Array.isArray(current.cohort_history) ? current.cohort_history.slice(-99) : []),
            { from_cohort_id: previousCohortId, to_cohort_id: nextCohortId, changed_at: nowISO() },
          ];
        }
      }
      return ok(res, await ablRepo.updateParticipant(req.params.id, patch));
    } catch (error) {
      console.error('[abl-workspace] participant update', error);
      return fail(res, 'Server error', 500);
    }
  });

  app.post('/api/abl/workspace/admin/participants/:id/invite', requireStudio, async (req, res) => {
    try {
      const participant = await ablRepo.getParticipant(req.params.id);
      if (!participant) return fail(res, 'Participant not found', 404);
      if (!cleanText(participant.email, 320)) return fail(res, 'Add the participant email before inviting them.');
      const saved = await ablRepo.updateParticipant(participant.id, { invite_status: 'invited', link_approved: true, approved_at: nowISO() });
      const loginUrl = `${req.protocol}://${req.get('host')}/ai-business-leaders/login`;
      return ok(res, { participant: saved, activation_url: loginUrl, login_url: loginUrl });
    } catch (error) { return fail(res, 'Server error', 500); }
  });

  app.get('/api/abl/workspace/admin/cohorts', requireStudio, async (req, res) => ok(res, await listCollection(COLLECTIONS.ablCohorts)));
  app.post('/api/abl/workspace/admin/cohorts', requireStudio, async (req, res) => {
    const body = req.body || {};
    if (!cleanText(body.name, 160)) return fail(res, 'Cohort name is required');
    return ok(res, await saveDoc(COLLECTIONS.ablCohorts, null, {
      name: cleanText(body.name, 160), description: cleanText(body.description, 1000), status: body.status || 'active',
      timezone: cleanText(body.timezone, 80) || 'Asia/Kolkata',
      sessions: body.sessions && typeof body.sessions === 'object' ? body.sessions : {},
      current_session: Math.max(1, Math.min(5, parseInt(body.current_session, 10) || 1)),
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
  async function deliver(res, saved, req) {
    if (!publishIsLive(saved) || saved.email_sent_at) return ok(res, saved);
    const origin = `${req.protocol}://${req.get('host')}`;
    const result = await sendAnnouncementEmails(saved, { origin });
    const stamped = result.sent > 0
      ? await saveDoc(COLLECTIONS.ablAnnouncements, saved.id, {
        email_sent_at: nowISO(), email_sent_count: result.sent, email_failed_count: result.failed,
      })
      : saved;
    return ok(res, { ...stamped, email: result });
  }
  app.post('/api/abl/workspace/admin/announcements', requireStudio, async (req, res) => {
    const row = sanitiseAnnouncement(req.body || {});
    if (!row.title || !row.message) return fail(res, 'Title and message are required');
    const saved = await saveDoc(COLLECTIONS.ablAnnouncements, null, row);
    return deliver(res, saved, req);
  });
  app.patch('/api/abl/workspace/admin/announcements/:id', requireStudio, async (req, res) => {
    const saved = await saveDoc(COLLECTIONS.ablAnnouncements, req.params.id, sanitiseAnnouncement(req.body || {}));
    return deliver(res, saved, req);
  });
  app.delete('/api/abl/workspace/admin/announcements/:id', requireStudio, async (req, res) => ok(res, await deleteDoc(COLLECTIONS.ablAnnouncements, req.params.id)));
}
