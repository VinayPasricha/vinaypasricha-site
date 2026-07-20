// First-party website analytics — event-level + person-level.
//
// The whole site posts anonymous events to /api/track (see js/track.js). Each
// event is one document in `analytics_events`. When a visitor becomes a known
// person (lead form, portal login, ABL session, AI chat), an `identify` event
// stitches their device to a record in `analytics_people`; their whole timeline
// (past anonymous activity included) is then resolvable by their device ids.
//
// Privacy by design: no raw IP (only a salted hash, then discarded), no cookies.
// Form submissions record the field COUNT only, never values. Do-Not-Track and a
// per-visitor opt-out are honored client-side, so opted-out visitors never post.
import crypto from 'node:crypto';
import { FieldValue } from '@google-cloud/firestore';
import { db, COLLECTIONS } from '../firestore.js';
import { config } from '../config.js';
import { listConversations, listLeads } from './store.js';
import * as ablRepo from '../abl/store.js';

const ANALYTICS_TTL_DAYS = parseInt(process.env.ANALYTICS_TTL_DAYS || '365', 10);
// People records outlive raw events — the profile is the durable asset.
const PEOPLE_TTL_DAYS = parseInt(process.env.ANALYTICS_PEOPLE_TTL_DAYS || '1095', 10);

const EVENT_TYPES = ['pageview', 'duration', 'event', 'click', 'form_submit', 'scroll', 'identify'];

// Coerce to a safe string: drop control chars, collapse whitespace, cap length.
function str(v, max) {
  if (v == null) return '';
  const s = String(v);
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    out += (c < 32 || c === 127) ? ' ' : s[i];
  }
  return out.replace(/\s+/g, ' ').trim().slice(0, max || 300);
}

function ipHash(ip) {
  if (!ip) return '';
  const salt = config.adminToken || 'vp-analytics';
  return crypto.createHash('sha256').update(salt + ':' + ip).digest('hex').slice(0, 16);
}
function sha(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }

// Stable person key: prefer the email; else the client-supplied id (e.g. an ABL
// slug). Emails are hashed so the doc id never exposes an address.
function personKey(email, clientId) {
  if (email) return 'e_' + sha(email).slice(0, 32);
  if (clientId) return 'i_' + str(clientId, 60).toLowerCase().replace(/[^a-z0-9:_-]+/g, '-');
  return '';
}

function cleanPath(p) {
  let s = str(p, 300) || '/';
  s = s.split('#')[0].split('?')[0];
  if (!s.startsWith('/')) s = '/' + s;
  if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1);
  return s || '/';
}
function refHost(ref) {
  const r = str(ref, 500);
  if (!r) return 'direct';
  try { const h = new URL(r).hostname.replace(/^www\./, ''); return h || 'direct'; } catch (e) { return 'direct'; }
}
function deviceFromUA(ua) {
  const s = str(ua, 400).toLowerCase();
  if (!s) return 'unknown';
  if (/bot|crawler|spider|crawling|headless|slurp|bingpreview/.test(s)) return 'bot';
  if (/ipad|tablet/.test(s)) return 'tablet';
  if (/mobile|iphone|android|ipod/.test(s)) return 'mobile';
  return 'desktop';
}

// Sanitise a small properties bag (click/form/custom event details). Caps keys
// and value sizes; never stores anything that looks like a raw form value.
function cleanProps(props) {
  if (!props || typeof props !== 'object') return null;
  const out = {};
  let n = 0;
  for (const k of Object.keys(props)) {
    if (n++ >= 12) break;
    const key = str(k, 40);
    if (!key) continue;
    const v = props[k];
    if (typeof v === 'boolean' || typeof v === 'number') out[key] = v;
    else out[key] = str(v, 300);
  }
  return Object.keys(out).length ? out : null;
}

// ---- Person record --------------------------------------------------------
async function upsertPerson({ pkey, email, name, vid, source, traits, now }) {
  const ref = db.collection(COLLECTIONS.analyticsPeople).doc(pkey);
  const snap = await ref.get();
  const data = {
    email: email || (snap.exists ? snap.get('email') : '') || '',
    lastSeen: now,
    eventCount: FieldValue.increment(1),
    visitorIds: FieldValue.arrayUnion(vid || 'anon'),
    expiresAt: new Date(now.getTime() + PEOPLE_TTL_DAYS * 24 * 60 * 60 * 1000),
  };
  if (name) data.name = name;
  if (source) data.source = source;
  if (traits) {
    if (traits.company) data.company = traits.company;
    if (traits.phone) data.phone = traits.phone;
    if (traits.role) data.role = traits.role;
  }
  if (!snap.exists) { data.firstSeen = now; data.createdAt = now; }
  await ref.set(data, { merge: true });
}

// Persist one event (+ maybe a person upsert). Never throws.
export async function recordEvent(evt, meta = {}) {
  try {
    const type = EVENT_TYPES.includes(evt && evt.type) ? evt.type : 'pageview';
    const now = new Date();
    const email = str(evt && evt.email, 160).toLowerCase();
    const clientId = str(evt && evt.pid, 80);
    const pkey = personKey(email, clientId);
    const traits = (evt && evt.traits && typeof evt.traits === 'object') ? {
      name: str(evt.traits.name, 120),
      company: str(evt.traits.company, 160),
      phone: str(evt.traits.phone, 40),
      role: str(evt.traits.role, 120),
      source: str(evt.traits.source, 60),
    } : null;
    const pname = str((evt && evt.pname) || (traits && traits.name), 120);

    const doc = {
      type,
      name: str(evt && evt.name, 80),
      path: cleanPath(evt && evt.path),
      ref: refHost(evt && evt.ref),
      title: str(evt && evt.title, 200),
      visitorId: str(evt && evt.vid, 64),
      sessionId: str(evt && evt.sid, 64),
      personId: pkey || '',
      email: email || '',
      pname: pname || '',
      props: cleanProps(evt && evt.props),
      traits: type === 'identify' ? traits : null,
      lang: str(evt && evt.lang, 12),
      screen: str(evt && evt.screen, 16),
      device: deviceFromUA(meta.ua),
      seconds: type === 'duration' ? Math.max(0, Math.min(86400, parseInt(evt && evt.seconds, 10) || 0)) : null,
      iph: ipHash(meta.ip),
      ua: str(meta.ua, 300),
      day: now.toISOString().slice(0, 10),
      createdAt: now,
      expiresAt: new Date(now.getTime() + ANALYTICS_TTL_DAYS * 24 * 60 * 60 * 1000),
    };
    if (!doc.visitorId && !doc.sessionId) return { ok: false };
    await db.collection(COLLECTIONS.analyticsEvents).add(doc);

    // Stitch identity: any event that carries a person key updates their record.
    if (pkey) {
      try {
        await upsertPerson({ pkey, email, name: pname, vid: doc.visitorId, source: traits && traits.source, traits, now });
      } catch (e) { /* person upsert is best-effort */ }
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ---- Aggregation ----------------------------------------------------------
async function fetchEvents(sinceDay, cap = 20000) {
  const snap = await db.collection(COLLECTIONS.analyticsEvents)
    .where('day', '>=', sinceDay).orderBy('day', 'desc').limit(cap).get();
  return snap.docs.map((d) => d.data());
}
function dayKeys(days) {
  const out = []; const base = Date.now();
  for (let i = days - 1; i >= 0; i--) out.push(new Date(base - i * 86400000).toISOString().slice(0, 10));
  return out;
}
function topN(counts, n) {
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, n).map(([key, count]) => ({ key, count }));
}

export async function analyticsSummary({ days = 30 } = {}) {
  const span = Math.max(1, Math.min(365, parseInt(days, 10) || 30));
  const keys = dayKeys(span);
  const sinceDay = keys[0];

  const CAP = 20000;
  let events = [];
  let partial = false;
  let indexNeeded = false;
  try {
    events = await fetchEvents(sinceDay, CAP);
    partial = events.length >= CAP;
  } catch (err) {
    events = [];
    indexNeeded = /index/i.test(err.message || '');
  }

  const views = events.filter((e) => e.type === 'pageview');
  const durations = events.filter((e) => e.type === 'duration' && e.seconds != null);
  const interactions = events.filter((e) => ['event', 'click', 'form_submit', 'scroll'].includes(e.type));

  const perDay = Object.fromEntries(keys.map((k) => [k, { views: 0, visitors: new Set(), sessions: new Set() }]));
  const visitors = new Set(), sessions = new Set();
  const pageCounts = {}, refCounts = {}, deviceCounts = {}, langCounts = {};

  for (const e of views) {
    const day = e.day;
    if (perDay[day]) {
      perDay[day].views++;
      if (e.visitorId) perDay[day].visitors.add(e.visitorId);
      if (e.sessionId) perDay[day].sessions.add(e.sessionId);
    }
    if (e.visitorId) visitors.add(e.visitorId);
    if (e.sessionId) sessions.add(e.sessionId);
    if (e.path) pageCounts[e.path] = (pageCounts[e.path] || 0) + 1;
    refCounts[e.ref || 'direct'] = (refCounts[e.ref || 'direct'] || 0) + 1;
    deviceCounts[e.device || 'unknown'] = (deviceCounts[e.device || 'unknown'] || 0) + 1;
    if (e.lang) langCounts[e.lang] = (langCounts[e.lang] || 0) + 1;
  }

  const timeseries = keys.map((k) => ({ day: k, views: perDay[k].views, visitors: perDay[k].visitors.size, sessions: perDay[k].sessions.size }));
  const totalViews = views.length;
  const avgSeconds = durations.length ? Math.round(durations.reduce((s, d) => s + (d.seconds || 0), 0) / durations.length) : 0;
  const viewsPerSession = {};
  for (const e of views) if (e.sessionId) viewsPerSession[e.sessionId] = (viewsPerSession[e.sessionId] || 0) + 1;
  const sessCount = Object.keys(viewsPerSession).length;
  const bounces = Object.values(viewsPerSession).filter((n) => n === 1).length;
  const bounceRate = sessCount ? Math.round((bounces / sessCount) * 100) : 0;

  // Event-level breakdown.
  const eventByType = {}, eventByName = {};
  for (const e of interactions) {
    eventByType[e.type] = (eventByType[e.type] || 0) + 1;
    const label = e.name || e.type;
    eventByName[label] = (eventByName[label] || 0) + 1;
  }
  const identifiedInRange = new Set(events.filter((e) => e.personId).map((e) => e.personId)).size;

  // ---- Engagement (existing domain data) ----
  const engagement = { conversations: 0, byRuntime: [], leads: 0, recentLeads: [] };
  try {
    const convos = await listConversations({ limit: 500 });
    engagement.conversations = convos.length;
    const rt = {};
    for (const c of convos) rt[c.runtime || 'unknown'] = (rt[c.runtime || 'unknown'] || 0) + 1;
    engagement.byRuntime = topN(rt, 12);
  } catch (e) { /* ignore */ }
  try {
    const leads = await listLeads({ limit: 300 });
    engagement.leads = leads.length;
    engagement.recentLeads = leads.slice(0, 8).map((l) => ({ email: l.email || '', name: l.name || '', source: l.source || '', at: l.createdAt || l.capturedAt || null }));
  } catch (e) { /* ignore */ }

  // ---- ABL funnel ----
  const funnel = { total: 0, byStatus: [], avgRating: 0 };
  try {
    const parts = await ablRepo.listParticipants();
    funnel.total = parts.length;
    const order = ['draft', 'research_added', 'link_ready', 'active', 'completed'];
    const by = {};
    for (const p of parts) by[p.status || 'draft'] = (by[p.status || 'draft'] || 0) + 1;
    funnel.byStatus = order.map((s) => ({ status: s, count: by[s] || 0 }));
    const ratings = parts.filter((p) => p.feedback_rating > 0).map((p) => p.feedback_rating);
    funnel.avgRating = ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : 0;
  } catch (e) { /* ignore */ }

  // Total known people (all-time), for the KPI tile.
  let knownPeople = 0;
  try {
    const agg = await db.collection(COLLECTIONS.analyticsPeople).count().get();
    knownPeople = agg.data().count;
  } catch (e) { /* count() may be unavailable; leave 0 */ }

  return {
    range: { days: span, since: sinceDay, until: keys[keys.length - 1] },
    partial, indexNeeded,
    traffic: {
      views: totalViews, visitors: visitors.size, sessions: sessions.size, avgSeconds, bounceRate,
      timeseries, topPages: topN(pageCounts, 15), topReferrers: topN(refCounts, 10),
      devices: topN(deviceCounts, 6), languages: topN(langCounts, 8),
    },
    events: {
      total: interactions.length,
      byType: topN(eventByType, 8),
      topEvents: topN(eventByName, 15),
      identifiedInRange,
    },
    people: { known: knownPeople },
    engagement, funnel,
  };
}

// ---- People directory + per-person timeline -------------------------------
export async function listPeople({ limit = 200 } = {}) {
  const lim = Math.max(1, Math.min(1000, parseInt(limit, 10) || 200));
  let snap;
  try {
    snap = await db.collection(COLLECTIONS.analyticsPeople).orderBy('lastSeen', 'desc').limit(lim).get();
  } catch (e) {
    snap = await db.collection(COLLECTIONS.analyticsPeople).limit(lim).get();
  }
  return snap.docs.map((d) => {
    const p = d.data();
    return {
      id: d.id,
      email: p.email || '',
      name: p.name || '',
      company: p.company || '',
      phone: p.phone || '',
      role: p.role || '',
      source: p.source || '',
      eventCount: p.eventCount || 0,
      devices: (p.visitorIds || []).length,
      firstSeen: p.firstSeen || p.createdAt || null,
      lastSeen: p.lastSeen || null,
    };
  });
}

export async function personTimeline(pkey, { limit = 400 } = {}) {
  const ref = db.collection(COLLECTIONS.analyticsPeople).doc(pkey);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const p = snap.data();
  const vids = (p.visitorIds || []).slice(0, 10); // Firestore "in" caps at 10
  const cap = Math.max(1, Math.min(2000, parseInt(limit, 10) || 400));
  let events = [];
  if (vids.length) {
    try {
      // No orderBy in the query (that would force a composite index) — we fetch by
      // the auto-indexed visitorId and sort newest-first in memory.
      const evs = await db.collection(COLLECTIONS.analyticsEvents)
        .where('visitorId', 'in', vids)
        .limit(cap)
        .get();
      events = evs.docs.map((d) => {
        const e = d.data();
        const ms = e.createdAt && e.createdAt._seconds != null ? e.createdAt._seconds * 1000
          : (e.createdAt ? new Date(e.createdAt).getTime() : 0);
        return {
          type: e.type, name: e.name || '', path: e.path || '', ref: e.ref || '',
          title: e.title || '', props: e.props || null, seconds: e.seconds || null,
          device: e.device || '', at: e.createdAt || null, _ms: ms || 0,
        };
      });
      events.sort((a, b) => b._ms - a._ms);
      events.forEach((e) => { delete e._ms; });
    } catch (e) { events = []; }
  }
  return {
    person: {
      id: pkey, email: p.email || '', name: p.name || '', company: p.company || '',
      phone: p.phone || '', role: p.role || '', source: p.source || '',
      eventCount: p.eventCount || 0, devices: vids.length,
      moreDevices: (p.visitorIds || []).length > vids.length,
      firstSeen: p.firstSeen || p.createdAt || null, lastSeen: p.lastSeen || null,
    },
    events,
  };
}
