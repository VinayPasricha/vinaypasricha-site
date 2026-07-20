// First-party website analytics.
//
// The whole site posts anonymous events to /api/track (see js/track.js). Each
// event is one document in the `analytics_events` collection. This module:
//   1. recordEvent(...)      -> validate + persist one event (best-effort).
//   2. analyticsSummary(...) -> aggregate the last N days into the numbers the
//      Studio Analytics dashboard renders (traffic + engagement + ABL funnel).
//
// Privacy by design: we never store the raw IP or any PII. A visitor is a random
// id the browser generates and keeps in localStorage; a session id lives in
// sessionStorage. The IP is only turned into a coarse, salted hash (for a rough
// unique-by-ip fallback) and immediately discarded.
import crypto from 'node:crypto';
import { db, COLLECTIONS } from '../firestore.js';
import { config } from '../config.js';
import { listConversations, listLeads } from './store.js';
import * as ablRepo from '../abl/store.js';

// Analytics is kept longer than chat data -- a year by default so month-over-month
// trends survive. Firestore auto-deletes when a TTL policy is set on expiresAt.
const ANALYTICS_TTL_DAYS = parseInt(process.env.ANALYTICS_TTL_DAYS || '365', 10);

const EVENT_TYPES = ['pageview', 'duration', 'event'];

// Coerce to a safe string: drop control chars (charCode < 32 or 127), collapse
// whitespace, trim, and cap length. Pure-ASCII source (no control-byte regex).
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

// A coarse, salted, one-way hash of the IP -- enough to approximate uniqueness
// without ever storing the address itself. Salt rotates with the deploy secret.
function ipHash(ip) {
  if (!ip) return '';
  const salt = config.adminToken || 'vp-analytics';
  return crypto.createHash('sha256').update(salt + ':' + ip).digest('hex').slice(0, 16);
}

// Normalise a path so "/paths/decisions", "/paths/decisions/" and
// "/paths/decisions?x=1" all bucket together. Query + hash are dropped.
function cleanPath(p) {
  let s = str(p, 300) || '/';
  s = s.split('#')[0].split('?')[0];
  if (!s.startsWith('/')) s = '/' + s;
  if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1);
  return s || '/';
}

// Referrer -> bare host (or 'direct'). Keeps the dashboard's "top sources" tidy
// and avoids storing full referrer URLs with their own query strings.
function refHost(ref) {
  const r = str(ref, 500);
  if (!r) return 'direct';
  try {
    const h = new URL(r).hostname.replace(/^www\./, '');
    return h || 'direct';
  } catch (e) {
    return 'direct';
  }
}

function deviceFromUA(ua) {
  const s = str(ua, 400).toLowerCase();
  if (!s) return 'unknown';
  if (/bot|crawler|spider|crawling|headless|slurp|bingpreview/.test(s)) return 'bot';
  if (/ipad|tablet/.test(s)) return 'tablet';
  if (/mobile|iphone|android|ipod/.test(s)) return 'mobile';
  return 'desktop';
}

// Persist one event. Never throws (analytics must not break page loads); returns
// { ok } so the route can answer quickly.
export async function recordEvent(evt, meta = {}) {
  try {
    const type = EVENT_TYPES.includes(evt && evt.type) ? evt.type : 'pageview';
    const now = new Date();
    const doc = {
      type,
      path: cleanPath(evt && evt.path),
      ref: refHost(evt && evt.ref),
      title: str(evt && evt.title, 200),
      visitorId: str(evt && evt.vid, 64),
      sessionId: str(evt && evt.sid, 64),
      lang: str(evt && evt.lang, 12),
      screen: str(evt && evt.screen, 16),      // e.g. "1440x900"
      device: deviceFromUA(meta.ua),
      // duration events carry how long the visitor stayed on the page (seconds)
      seconds: type === 'duration' ? Math.max(0, Math.min(86400, parseInt(evt && evt.seconds, 10) || 0)) : null,
      // custom events carry a name (e.g. "cta_click")
      name: type === 'event' ? str(evt && evt.name, 80) : null,
      iph: ipHash(meta.ip),
      ua: str(meta.ua, 300),
      day: now.toISOString().slice(0, 10),      // YYYY-MM-DD bucket for fast day grouping
      createdAt: now,
      expiresAt: new Date(now.getTime() + ANALYTICS_TTL_DAYS * 24 * 60 * 60 * 1000),
    };
    if (!doc.visitorId && !doc.sessionId) return { ok: false }; // nothing to attribute
    await db.collection(COLLECTIONS.analyticsEvents).add(doc);
    return { ok: true };
  } catch (err) {
    // Swallow -- a tracking failure must never surface to the visitor.
    return { ok: false, error: err.message };
  }
}

// Pull the raw events in the window. Firestore has no GROUP BY, so we read the
// window and fold it in memory. Capped so a burst can't blow up a request; when
// the cap is hit the dashboard notes the sample is partial.
async function fetchEvents(sinceDay, cap = 20000) {
  const snap = await db
    .collection(COLLECTIONS.analyticsEvents)
    .where('day', '>=', sinceDay)
    .orderBy('day', 'desc')
    .limit(cap)
    .get();
  return snap.docs.map((d) => d.data());
}

function dayKeys(days) {
  const out = [];
  const base = Date.now();
  for (let i = days - 1; i >= 0; i--) {
    out.push(new Date(base - i * 86400000).toISOString().slice(0, 10));
  }
  return out;
}

function topN(counts, n) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, count]) => ({ key, count }));
}

// Aggregate everything the dashboard needs for the last `days` days.
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
    // Most likely the composite index isn't built yet -- degrade gracefully and
    // let the dashboard tell the operator a one-time index is needed.
    events = [];
    indexNeeded = /index/i.test(err.message || '');
  }

  const views = events.filter((e) => e.type === 'pageview');
  const durations = events.filter((e) => e.type === 'duration' && e.seconds != null);

  const perDay = Object.fromEntries(keys.map((k) => [k, { views: 0, visitors: new Set(), sessions: new Set() }]));
  const visitors = new Set();
  const sessions = new Set();
  const pageCounts = {};
  const refCounts = {};
  const deviceCounts = {};
  const langCounts = {};

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

  const timeseries = keys.map((k) => ({
    day: k,
    views: perDay[k].views,
    visitors: perDay[k].visitors.size,
    sessions: perDay[k].sessions.size,
  }));

  const totalViews = views.length;
  const avgSeconds = durations.length
    ? Math.round(durations.reduce((s, d) => s + (d.seconds || 0), 0) / durations.length)
    : 0;
  // Single-pageview sessions ~= bounces.
  const viewsPerSession = {};
  for (const e of views) if (e.sessionId) viewsPerSession[e.sessionId] = (viewsPerSession[e.sessionId] || 0) + 1;
  const sessCount = Object.keys(viewsPerSession).length;
  const bounces = Object.values(viewsPerSession).filter((n) => n === 1).length;
  const bounceRate = sessCount ? Math.round((bounces / sessCount) * 100) : 0;

  // ---- Engagement (existing domain data) ------------------------------------
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
    engagement.recentLeads = leads.slice(0, 8).map((l) => ({
      email: l.email || '', name: l.name || '', source: l.source || '', at: l.createdAt || l.capturedAt || null,
    }));
  } catch (e) { /* ignore */ }

  // ---- ABL participant funnel ----------------------------------------------
  const funnel = { total: 0, byStatus: [], avgRating: 0 };
  try {
    const parts = await ablRepo.listParticipants();
    funnel.total = parts.length;
    const order = ['draft', 'research_added', 'link_ready', 'active', 'completed'];
    const by = {};
    for (const p of parts) by[p.status || 'draft'] = (by[p.status || 'draft'] || 0) + 1;
    funnel.byStatus = order.map((s) => ({ status: s, count: by[s] || 0 }));
    const ratings = parts.filter((p) => p.feedback_rating > 0).map((p) => p.feedback_rating);
    funnel.avgRating = ratings.length
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : 0;
  } catch (e) { /* ignore */ }

  return {
    range: { days: span, since: sinceDay, until: keys[keys.length - 1] },
    partial,
    indexNeeded,
    traffic: {
      views: totalViews,
      visitors: visitors.size,
      sessions: sessions.size,
      avgSeconds,
      bounceRate,
      timeseries,
      topPages: topN(pageCounts, 15),
      topReferrers: topN(refCounts, 10),
      devices: topN(deviceCounts, 6),
      languages: topN(langCounts, 8),
    },
    engagement,
    funnel,
  };
}
