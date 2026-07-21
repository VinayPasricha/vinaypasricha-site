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

function browserFromUA(ua) {
  const s = str(ua, 400).toLowerCase();
  if (!s) return 'unknown';
  if (/edg\//.test(s)) return 'Edge';
  if (/opr\/|opera/.test(s)) return 'Opera';
  if (/samsungbrowser/.test(s)) return 'Samsung Internet';
  if (/firefox|fxios/.test(s)) return 'Firefox';
  if (/chrome|crios/.test(s)) return 'Chrome';
  if (/safari/.test(s)) return 'Safari';
  if (/msie|trident/.test(s)) return 'Internet Explorer';
  return 'Other';
}
function osFromUA(ua) {
  const s = str(ua, 400).toLowerCase();
  if (!s) return 'unknown';
  if (/windows nt/.test(s)) return 'Windows';
  if (/android/.test(s)) return 'Android';
  if (/iphone|ipad|ipod/.test(s)) return 'iOS';
  if (/mac os x|macintosh/.test(s)) return 'macOS';
  if (/cros/.test(s)) return 'ChromeOS';
  if (/linux/.test(s)) return 'Linux';
  return 'Other';
}

// Timezone -> country (privacy-friendly geo; we never do IP geolocation). Common
// zones are mapped explicitly; anything else falls back to the zone's city.
const TZ_COUNTRY = {
  'Asia/Kolkata': 'India', 'Asia/Calcutta': 'India',
  'America/New_York': 'United States', 'America/Chicago': 'United States', 'America/Los_Angeles': 'United States', 'America/Denver': 'United States', 'America/Phoenix': 'United States',
  'Europe/London': 'United Kingdom', 'Europe/Paris': 'France', 'Europe/Berlin': 'Germany', 'Europe/Madrid': 'Spain', 'Europe/Rome': 'Italy', 'Europe/Amsterdam': 'Netherlands', 'Europe/Dublin': 'Ireland',
  'Asia/Dubai': 'United Arab Emirates', 'Asia/Singapore': 'Singapore', 'Asia/Tokyo': 'Japan', 'Asia/Shanghai': 'China', 'Asia/Hong_Kong': 'Hong Kong', 'Asia/Karachi': 'Pakistan', 'Asia/Dhaka': 'Bangladesh', 'Asia/Colombo': 'Sri Lanka',
  'Australia/Sydney': 'Australia', 'Australia/Melbourne': 'Australia', 'Pacific/Auckland': 'New Zealand',
  'America/Toronto': 'Canada', 'America/Vancouver': 'Canada', 'America/Sao_Paulo': 'Brazil', 'America/Mexico_City': 'Mexico',
  'Africa/Johannesburg': 'South Africa', 'Africa/Lagos': 'Nigeria', 'Africa/Cairo': 'Egypt', 'Africa/Nairobi': 'Kenya',
  'Asia/Jakarta': 'Indonesia', 'Asia/Manila': 'Philippines', 'Asia/Riyadh': 'Saudi Arabia', 'Asia/Bangkok': 'Thailand', 'Asia/Kuala_Lumpur': 'Malaysia',
  'Europe/Moscow': 'Russia', 'Europe/Istanbul': 'Turkey', 'Europe/Zurich': 'Switzerland', 'Europe/Stockholm': 'Sweden', 'Europe/Warsaw': 'Poland',
};
function countryFromTz(tz) {
  if (!tz) return '';
  if (TZ_COUNTRY[tz]) return TZ_COUNTRY[tz];
  const parts = String(tz).split('/');
  return parts.length > 1 ? parts[parts.length - 1].replace(/_/g, ' ') : tz;
}

function cleanUtm(u) {
  if (!u || typeof u !== 'object') return null;
  const out = {};
  ['source', 'medium', 'campaign', 'term', 'content'].forEach((k) => { const v = str(u[k], 120); if (v) out[k] = v; });
  return Object.keys(out).length ? out : null;
}
function cleanFt(f) {
  if (!f || typeof f !== 'object') return null;
  const out = {};
  if (str(f.s, 120)) out.s = str(f.s, 120);
  if (str(f.m, 120)) out.m = str(f.m, 120);
  if (str(f.c, 120)) out.c = str(f.c, 120);
  if (str(f.ref, 200)) out.ref = str(f.ref, 200);
  return Object.keys(out).length ? out : null;
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
async function upsertPerson({ pkey, email, name, vid, source, traits, ft, country, now }) {
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
  if (country) data.country = country;
  if (traits) {
    if (traits.company) data.company = traits.company;
    if (traits.phone) data.phone = traits.phone;
    if (traits.role) data.role = traits.role;
  }
  if (!snap.exists) {
    data.firstSeen = now;
    data.createdAt = now;
    if (ft) data.firstTouch = ft; // acquisition source captured at first sight only
  }
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

    const tz = str(evt && evt.tz, 48);
    const utm = cleanUtm(evt && evt.utm);
    const ft = cleanFt((evt && evt.ft) || (traits && traits.ft));
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
      browser: browserFromUA(meta.ua),
      os: osFromUA(meta.ua),
      tz,
      country: countryFromTz(tz),
      newVisitor: !!(evt && evt.newVisitor),
      landing: (evt && evt.landing) ? cleanPath(evt.landing) : '',
      utm,
      ft,
      seconds: type === 'duration' ? Math.max(0, Math.min(86400, parseInt(evt && evt.seconds, 10) || 0)) : null,
      engaged: type === 'duration' ? Math.max(0, Math.min(86400, parseInt(evt && evt.engaged, 10) || 0)) : null,
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
        await upsertPerson({ pkey, email, name: pname, vid: doc.visitorId, source: traits && traits.source, traits, ft, country: doc.country, now });
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
  const eventByType = {}, eventByName = {}, clickTargets = {};
  for (const e of interactions) {
    eventByType[e.type] = (eventByType[e.type] || 0) + 1;
    const label = e.name || e.type;
    eventByName[label] = (eventByName[label] || 0) + 1;
    // "Which buttons/links" — group clicks by their visible label (or href/name).
    if (e.type === 'click' || (e.type === 'event' && e.name && e.name !== 'rage_click')) {
      const p = e.props || {};
      const kind = e.name === 'button' ? '🔘 ' : (e.name === 'outbound_link' || e.name === 'link') ? '🔗 ' : (e.name === 'contact_link' ? '✉ ' : '• ');
      const target = String(p.text || p.href || e.name || '').trim().slice(0, 80);
      if (target) { const key = kind + target; clickTargets[key] = (clickTargets[key] || 0) + 1; }
    }
  }
  const identifiedInRange = new Set(events.filter((e) => e.personId).map((e) => e.personId)).size;

  // ---- Per-session rollups: acquisition, entry/exit, funnel ----
  const tsMs = (v) => (v && v._seconds != null ? v._seconds * 1000 : (v ? new Date(v).getTime() : 0));
  const sess = {};
  for (const e of events) {
    const sid = e.sessionId; if (!sid) continue;
    const s = sess[sid] || (sess[sid] = { firstAt: Infinity, lastAt: -1, entry: '', exit: '', landing: '', source: '', medium: '', campaign: '', pv: 0, scroll: 0, dur: 0, interact: false, ident: false });
    const at = tsMs(e.createdAt) || 0;
    if (e.type === 'pageview') {
      s.pv++;
      if (at <= s.firstAt) {
        s.firstAt = at; s.entry = e.path; s.landing = e.landing || e.path;
        const u = e.utm || {};
        s.source = u.source || (e.ref && e.ref !== 'direct' ? e.ref : '') || 'direct';
        s.medium = u.medium || (u.source ? 'campaign' : (e.ref && e.ref !== 'direct' ? 'referral' : 'direct'));
        s.campaign = u.campaign || '';
      }
      if (at >= s.lastAt) { s.lastAt = at; s.exit = e.path; }
    }
    if (e.type === 'scroll' && e.props && e.props.depth) s.scroll = Math.max(s.scroll, e.props.depth);
    if (e.type === 'duration') s.dur = Math.max(s.dur, e.seconds || 0);
    if (['click', 'form_submit', 'event'].includes(e.type)) s.interact = true;
    if (e.personId) s.ident = true;
  }
  const sessArr = Object.values(sess).filter((s) => s.pv > 0);

  const srcCounts = {}, medCounts = {}, campCounts = {}, landingCounts = {}, entryCounts = {}, exitCounts = {};
  for (const s of sessArr) {
    srcCounts[s.source || 'direct'] = (srcCounts[s.source || 'direct'] || 0) + 1;
    if (s.medium) medCounts[s.medium] = (medCounts[s.medium] || 0) + 1;
    if (s.campaign) campCounts[s.campaign] = (campCounts[s.campaign] || 0) + 1;
    const land = s.landing || s.entry; if (land) landingCounts[land] = (landingCounts[land] || 0) + 1;
    if (s.entry) entryCounts[s.entry] = (entryCounts[s.entry] || 0) + 1;
    if (s.exit) exitCounts[s.exit] = (exitCounts[s.exit] || 0) + 1;
  }

  const fVisited = sessArr.length;
  let fEngaged = 0, fInteract = 0, fIdent = 0;
  for (const s of sessArr) {
    if (s.scroll >= 50 || s.pv >= 2 || s.dur >= 30) fEngaged++;
    if (s.interact) fInteract++;
    if (s.ident) fIdent++;
  }
  const fpct = (n) => (fVisited ? Math.round((n / fVisited) * 100) : 0);
  const funnelSteps = [
    { step: 'Visited', count: fVisited, pct: 100 },
    { step: 'Engaged', count: fEngaged, pct: fpct(fEngaged) },
    { step: 'Interacted', count: fInteract, pct: fpct(fInteract) },
    { step: 'Identified', count: fIdent, pct: fpct(fIdent) },
  ];

  // ---- Audience by unique visitor: country / browser / OS / new-vs-returning ----
  const vmap = {};
  for (const e of views) {
    const v = e.visitorId; if (!v) continue;
    const m = vmap[v] || (vmap[v] = { country: '', browser: '', os: '', isNew: false });
    if (e.country && !m.country) m.country = e.country;
    if (e.browser && !m.browser) m.browser = e.browser;
    if (e.os && !m.os) m.os = e.os;
    if (e.newVisitor) m.isNew = true;
  }
  const countryCounts = {}, browserCounts = {}, osCounts = {};
  let newV = 0, retV = 0;
  for (const v of Object.values(vmap)) {
    if (v.country) countryCounts[v.country] = (countryCounts[v.country] || 0) + 1;
    if (v.browser) browserCounts[v.browser] = (browserCounts[v.browser] || 0) + 1;
    if (v.os) osCounts[v.os] = (osCounts[v.os] || 0) + 1;
    if (v.isNew) newV++; else retV++;
  }

  // ---- Behavior extras ----
  const rageClicks = interactions.filter((e) => e.name === 'rage_click').length;
  const engagedDur = durations.filter((e) => e.engaged != null);
  const avgEngaged = engagedDur.length ? Math.round(engagedDur.reduce((s, d) => s + (d.engaged || 0), 0) / engagedDur.length) : 0;

  // ---- Engagement (existing domain data) + AI-conversation depth ----
  const engagement = { conversations: 0, byRuntime: [], leads: 0, recentLeads: [], avgMessages: 0, completionRate: 0 };
  try {
    const convos = await listConversations({ limit: 500 });
    engagement.conversations = convos.length;
    const rt = {};
    let totMsgs = 0, completed = 0;
    for (const c of convos) {
      rt[c.runtime || 'unknown'] = (rt[c.runtime || 'unknown'] || 0) + 1;
      const n = Array.isArray(c.messages) ? c.messages.length : 0;
      totMsgs += n;
      if (c.artefact || c.status === 'completed' || c.status === 'complete' || c.status === 'done') completed++;
    }
    engagement.byRuntime = topN(rt, 12);
    engagement.avgMessages = convos.length ? Math.round((totMsgs / convos.length) * 10) / 10 : 0;
    engagement.completionRate = convos.length ? Math.round((completed / convos.length) * 100) : 0;
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
      topClicks: topN(clickTargets, 20),
      identifiedInRange,
    },
    acquisition: {
      topSources: topN(srcCounts, 10),
      topMediums: topN(medCounts, 8),
      topCampaigns: topN(campCounts, 10),
      landingPages: topN(landingCounts, 12),
      entryPages: topN(entryCounts, 10),
      exitPages: topN(exitCounts, 10),
    },
    audience: {
      countries: topN(countryCounts, 12),
      browsers: topN(browserCounts, 8),
      os: topN(osCounts, 8),
      newVisitors: newV,
      returningVisitors: retV,
    },
    funnelSteps,
    behavior: { rageClicks, avgEngaged },
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
    const ec = p.eventCount || 0;
    const ft = p.firstTouch || null;
    return {
      id: d.id,
      email: p.email || '',
      name: p.name || '',
      company: p.company || '',
      phone: p.phone || '',
      role: p.role || '',
      source: p.source || '',
      country: p.country || '',
      firstTouch: ft ? [ft.s, ft.m, ft.c].filter(Boolean).join(' / ') : '',
      score: Math.min(100, Math.round(ec * 3 + (p.email ? 10 : 0) + ((p.visitorIds || []).length - 1) * 5)),
      eventCount: ec,
      devices: (p.visitorIds || []).length,
      firstSeen: p.firstSeen || p.createdAt || null,
      lastSeen: p.lastSeen || null,
    };
  });
}

// Per-page drill-down: stats for one path over the last N days. Queried by the
// auto-indexed `path` field (then filtered to the range in memory) so it needs
// no composite index.
export async function pageStats(path, { days = 30 } = {}) {
  const span = Math.max(1, Math.min(365, parseInt(days, 10) || 30));
  const sinceDay = dayKeys(span)[0];
  const clean = cleanPath(path);
  let docs = [];
  try {
    const snap = await db.collection(COLLECTIONS.analyticsEvents).where('path', '==', clean).limit(12000).get();
    docs = snap.docs.map((d) => d.data()).filter((e) => (e.day || '') >= sinceDay);
  } catch (e) { docs = []; }
  const pv = docs.filter((e) => e.type === 'pageview');
  const durs = docs.filter((e) => e.type === 'duration' && e.seconds != null);
  const evs = docs.filter((e) => ['click', 'form_submit', 'event'].includes(e.type));
  const visitors = new Set(pv.map((e) => e.visitorId).filter(Boolean));
  const refC = {}, cC = {}, evC = {}, clkC = {}, scroll = { 25: 0, 50: 0, 75: 0, 100: 0 };
  pv.forEach((e) => { refC[e.ref || 'direct'] = (refC[e.ref || 'direct'] || 0) + 1; if (e.country) cC[e.country] = (cC[e.country] || 0) + 1; });
  evs.forEach((e) => {
    const l = e.name || e.type; evC[l] = (evC[l] || 0) + 1;
    if (e.type === 'click' || (e.type === 'event' && e.name && e.name !== 'rage_click')) {
      const p = e.props || {};
      const kind = e.name === 'button' ? '🔘 ' : (e.name === 'outbound_link' || e.name === 'link') ? '🔗 ' : (e.name === 'contact_link' ? '✉ ' : '• ');
      const t = String(p.text || p.href || e.name || '').trim().slice(0, 80);
      if (t) clkC[kind + t] = (clkC[kind + t] || 0) + 1;
    }
  });
  docs.filter((e) => e.type === 'scroll').forEach((e) => { const dp = e.props && e.props.depth; if (scroll[dp] != null) scroll[dp]++; });
  const engagedDur = durs.filter((d) => d.engaged != null);
  return {
    path: clean,
    range: { days: span, since: sinceDay },
    views: pv.length,
    visitors: visitors.size,
    avgSeconds: durs.length ? Math.round(durs.reduce((s, d) => s + (d.seconds || 0), 0) / durs.length) : 0,
    avgEngaged: engagedDur.length ? Math.round(engagedDur.reduce((s, d) => s + (d.engaged || 0), 0) / engagedDur.length) : 0,
    scroll: [25, 50, 75, 100].map((dp) => ({ depth: dp, count: scroll[dp] })),
    topEvents: topN(evC, 12),
    topClicks: topN(clkC, 15),
    topReferrers: topN(refC, 8),
    topCountries: topN(cC, 8),
  };
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
      phone: p.phone || '', role: p.role || '', source: p.source || '', country: p.country || '',
      firstTouch: p.firstTouch ? [p.firstTouch.s, p.firstTouch.m, p.firstTouch.c].filter(Boolean).join(' / ') : '',
      firstTouchRef: (p.firstTouch && p.firstTouch.ref) || '',
      eventCount: p.eventCount || 0, devices: vids.length,
      moreDevices: (p.visitorIds || []).length > vids.length,
      firstSeen: p.firstSeen || p.createdAt || null, lastSeen: p.lastSeen || null,
    },
    events,
  };
}
