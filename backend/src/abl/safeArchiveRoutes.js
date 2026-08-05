// Safe removal rules for Vinay Studio.
// Published course content and anything connected to participant work is archived
// instead of being permanently deleted. Only genuinely unused drafts are deleted.
import crypto from 'node:crypto';
import { db, COLLECTIONS } from '../firestore.js';
import * as ablRepo from './store.js';

const nowISO = () => new Date().toISOString();
const col = (name) => db.collection(name);
const docData = (d) => (d.exists ? { id: d.id, ...d.data() } : null);
const cleanArray = (value, max = 1000) => Array.isArray(value)
  ? value.filter(Boolean).map(String).slice(0, max)
  : [];
const ok = (res, data, code = 200) => res.status(code).json({ ok: true, data });
const fail = (res, error, code = 400) => res.status(code).json({ ok: false, error });

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
  const expectedCookie = studioHash();
  const cookieAllowed = !!expectedCookie && parseCookies(req).__session === expectedCookie;
  const token = req.get('x-admin-token') || (req.query && req.query.token) || '';
  const tokenAllowed = !!process.env.ADMIN_TOKEN && token === process.env.ADMIN_TOKEN;
  if (cookieAllowed || tokenAllowed) return next();
  return res.status(401).json({ ok: false, error: 'unauthorized' });
}

async function participantEntitlementExists(field, itemId) {
  const participants = await ablRepo.listParticipants();
  return participants.some((participant) => cleanArray(participant[field]).includes(String(itemId)));
}

async function archiveItem(collectionName, item, reasons) {
  const ref = col(collectionName).doc(item.id);
  const archivedAt = item.archived_at || nowISO();
  await ref.set({
    status: 'hidden',
    archived_at: archivedAt,
    archived_from_status: item.archived_from_status || item.status || 'unknown',
    archived_reason: reasons.join(', '),
    updated_at: nowISO(),
  }, { merge: true });
  return docData(await ref.get());
}

export function registerSafeArchiveRoutes(app) {
  app.delete('/api/abl/workspace/admin/materials/:id', requireStudio, async (req, res) => {
    try {
      const ref = col(COLLECTIONS.ablMaterials).doc(req.params.id);
      const item = docData(await ref.get());
      if (!item) return fail(res, 'Material not found', 404);

      const entitled = await participantEntitlementExists('material_entitlements', item.id);
      const reasons = [];
      // Published/scheduled content is archived (hidden) on first delete. An
      // already-hidden item is deleted for real on the next delete, so an
      // admin can still fully remove a material in two clicks.
      if (item.status !== 'draft' && item.status !== 'hidden') reasons.push('previously published or scheduled');
      if (entitled) reasons.push('participant entitlement exists');

      if (reasons.length) {
        const archived = await archiveItem(COLLECTIONS.ablMaterials, item, reasons);
        return ok(res, { action: 'archived', item: archived, preserved_because: reasons });
      }

      await ref.delete();
      return ok(res, { action: 'deleted', id: item.id, deleted_draft: true });
    } catch (error) {
      console.error('[abl-safe-archive] material', error);
      return fail(res, 'Server error', 500);
    }
  });

  app.delete('/api/abl/workspace/admin/assignments/:id', requireStudio, async (req, res) => {
    try {
      const ref = col(COLLECTIONS.ablAssignments).doc(req.params.id);
      const item = docData(await ref.get());
      if (!item) return fail(res, 'Assignment not found', 404);

      const [submissionSnap, entitled] = await Promise.all([
        col(COLLECTIONS.ablSubmissions).where('assignment_id', '==', item.id).limit(1).get(),
        participantEntitlementExists('assignment_entitlements', item.id),
      ]);

      const reasons = [];
      if (item.status !== 'draft') reasons.push('previously published or scheduled');
      if (!submissionSnap.empty) reasons.push('participant draft or submission exists');
      if (entitled) reasons.push('participant entitlement exists');

      if (reasons.length) {
        const archived = await archiveItem(COLLECTIONS.ablAssignments, item, reasons);
        return ok(res, { action: 'archived', item: archived, preserved_because: reasons });
      }

      await ref.delete();
      return ok(res, { action: 'deleted', id: item.id, deleted_draft: true });
    } catch (error) {
      console.error('[abl-safe-archive] assignment', error);
      return fail(res, 'Server error', 500);
    }
  });
}
