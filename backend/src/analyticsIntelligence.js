import { db, COLLECTIONS } from './firestore.js';
import { listConversations, listLeads } from './services/store.js';

const MAX_EVENTS = Math.max(5000, Math.min(50000, parseInt(process.env.ANALYTICS_INTELLIGENCE_EVENT_CAP || '30000', 10)));
const INTERNAL_EMAILS = new Set(
  String(process.env.ANALYTICS_INTERNAL_EMAILS || 'vinay@goodspace.ai,vaishnav@goodspace.ai')
    .split(',').map((v) => v.trim().toLowerCase()).filter(Boolean),
);
const INTERNAL_VISITOR_IDS = new Set(
  String(process.env.ANALYTICS_INTERNAL_VISITOR_IDS || '')
    .split(',').map((v) => v.trim()).filter(Boolean),
);

function safeDate(value) {
  const s = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}
function dayStart(day) { return new Date(`${day}T00:00:00+05:30`); }
function dayEnd(day) { return new Date(`${day}T23:59:59.999+05:30`); }
function toMs(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value._seconds != null) return Number(value._seconds) * 1000;
  if (value.seconds != null && value.nanoseconds != null) return Number(value.seconds) * 1000;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}
function dayOf(value) {
  const ms = toMs(value);
  if (!ms) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}
function clamp(n, min, max) { return Math.max(min, Math.min(max, Number(n) || 0)); }
function topN(map, n = 12) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([key, count]) => ({ key, count }));
}
function inc(map, key, n = 1) {
  const k = String(key || 'Unknown');
  map.set(k, (map.get(k) || 0) + n);
}
function cleanPath(path) {
  const p = String(path || '/').split('?')[0].split('#')[0] || '/';
  return p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p;
}
function friendlyPage(path) {
  const p = cleanPath(path);
  const known = {
    '/': 'Homepage',
    '/paths/ai-for-business': 'AI for Business Leaders',
    '/paths/decisions': 'The SIV Method',
    '/paths/execute': 'The Execution Doctrine',
    '/paths/hire': 'Organizational Frequency',
    '/paths/evolve': 'The Signal',
    '/paths/civilization': 'Civilization',
  };
  if (known[p]) return known[p];
  const part = p.split('/').filter(Boolean).pop() || 'Homepage';
  return part.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
function sourceLabel(event) {
  const utm = event.utm || {};
  const source = String(utm.source || event.source || '').toLowerCase();
  const medium = String(utm.medium || event.medium || '').toLowerCase();
  const ref = String(event.ref || '').toLowerCase();
  const paid = /(cpc|ppc|paid|sem|display|ads?)/.test(medium) || /(googleads|facebookads|metaads)/.test(source);
  if (/google/.test(source) || /google\./.test(ref)) return paid ? 'Google ads' : 'Google search';
  if (/instagram/.test(source) || /instagram/.test(ref)) return paid ? 'Instagram ads' : 'Instagram';
  if (/facebook|fb\b|meta/.test(source) || /facebook/.test(ref)) return paid ? 'Facebook ads' : 'Facebook';
  if (/youtube|youtu\.be/.test(source) || /youtube|youtu\.be/.test(ref)) return 'YouTube';
  if (/linkedin/.test(source) || /linkedin/.test(ref)) return 'LinkedIn';
  if (/amazon/.test(source) || /amazon/.test(ref)) return 'Amazon';
  if (source && !['direct', '(direct)', 'none', '(none)'].includes(source)) return source.replace(/\b\w/g, (c) => c.toUpperCase());
  if (ref && !['direct', 'none'].includes(ref)) return ref.replace(/^www\./, '');
  return 'Direct or unknown';
}
function outcomeType(event) {
  const name = String(event.name || event.type || '').toLowerCase();
  const props = event.props || {};
  const hay = `${name} ${props.text || ''} ${props.href || ''} ${props.label || ''}`.toLowerCase();
  if (event.type === 'form_submit' || /form submitted|enquiry|inquiry|contact submit|lead/.test(hay)) return 'Enquiry';
  if (/amazon|buy now|buy book|order book|kindle|paperback|purchase/.test(hay)) return 'Book-buying click';
  if (/course registration|register course|course signup/.test(hay)) return 'Course registration';
  return '';
}
function timeBand(seconds) {
  const s = Number(seconds) || 0;
  if (s < 60) return 'Quick exit';
  if (s < 180) return 'Brief visit';
  if (s < 600) return 'Interested';
  if (s < 1800) return 'Highly engaged';
  return 'Deep engagement';
}
function isInternalEvent(event) {
  const email = String(event.email || '').toLowerCase();
  const name = String(event.pname || (event.traits && event.traits.name) || '').toLowerCase();
  const ua = String(event.ua || '').toLowerCase();
  const path = cleanPath(event.path || '/');
  if (INTERNAL_EMAILS.has(email)) return true;
  if (/\bvinay\b|\bvaishnav\b/.test(name)) return true;
  if (INTERNAL_VISITOR_IDS.has(String(event.visitorId || ''))) return true;
  if (event.device === 'bot' || /bot|crawler|spider|headless|playwright|puppeteer|lighthouse|pagespeed/.test(ua)) return true;
  if (path === '/studio' || path.startsWith('/studio/')) return true;
  return false;
}
function rangeDays(start, end) {
  return Math.max(1, Math.round((dayEnd(end).getTime() - dayStart(start).getTime()) / 86400000) + 1);
}
function previousRange(start, end) {
  const days = rangeDays(start, end);
  const prevEnd = new Date(dayStart(start).getTime() - 86400000);
  const prevStart = new Date(prevEnd.getTime() - (days - 1) * 86400000);
  const fmt = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  return { start: fmt(prevStart), end: fmt(prevEnd) };
}
function resolveRange(query = {}, lastChecked = null) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const mode = String(query.mode || 'week');
  let start = safeDate(query.start);
  let end = safeDate(query.end) || today;
  if (mode === 'since-last') {
    start = lastChecked ? dayOf(lastChecked) : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() - 7 * 86400000));
  } else if (mode === 'week') {
    start = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() - 6 * 86400000));
  } else if (mode === 'month') {
    const d = new Date(); d.setDate(1); start = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  } else if (mode === 'year') {
    start = `${today.slice(0, 4)}-01-01`;
  } else if (mode === 'custom') {
    if (!start) start = today;
  }
  if (!start) start = today;
  if (start > end) [start, end] = [end, start];
  return { mode, start, end, days: rangeDays(start, end), lastChecked: lastChecked || null };
}

async function getLastChecked() {
  const snap = await db.collection(COLLECTIONS.growthRuns).doc('website-intelligence-checkin').get();
  return snap.exists ? snap.get('lastChecked') : null;
}
async function setLastChecked() {
  const now = new Date();
  await db.collection(COLLECTIONS.growthRuns).doc('website-intelligence-checkin').set({ lastChecked: now, updatedAt: now }, { merge: true });
  return now;
}
async function fetchEvents(start, end) {
  let snap;
  try {
    snap = await db.collection(COLLECTIONS.analyticsEvents).where('day', '>=', start).orderBy('day', 'desc').limit(MAX_EVENTS).get();
  } catch (err) {
    snap = await db.collection(COLLECTIONS.analyticsEvents).limit(MAX_EVENTS).get();
  }
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).filter((event) => {
    const day = event.day || dayOf(event.createdAt);
    return day >= start && day <= end;
  });
}
function buildSessions(events) {
  const sessions = new Map();
  for (const event of events) {
    const sid = String(event.sessionId || `visitor:${event.visitorId || event.id}`);
    if (!sessions.has(sid)) {
      sessions.set(sid, {
        id: sid,
        visitorId: String(event.visitorId || ''),
        personId: String(event.personId || ''),
        email: String(event.email || ''),
        name: String(event.pname || ''),
        source: '', medium: '', campaign: '', date: event.day || dayOf(event.createdAt),
        startedAt: Infinity, endedAt: 0, seconds: 0, engagedSeconds: 0,
        pages: [], pageSet: new Set(), events: [], outcomes: new Set(), internal: false,
      });
    }
    const session = sessions.get(sid);
    const at = toMs(event.createdAt);
    session.startedAt = Math.min(session.startedAt, at || session.startedAt);
    session.endedAt = Math.max(session.endedAt, at || session.endedAt);
    session.date = session.date || event.day || dayOf(event.createdAt);
    session.internal = session.internal || isInternalEvent(event);
    if (!session.source && event.type === 'pageview') {
      session.source = sourceLabel(event);
      session.medium = String((event.utm && event.utm.medium) || '');
      session.campaign = String((event.utm && event.utm.campaign) || '');
    }
    if (!session.visitorId && event.visitorId) session.visitorId = event.visitorId;
    if (!session.personId && event.personId) session.personId = event.personId;
    if (!session.email && event.email) session.email = event.email;
    if (!session.name && event.pname) session.name = event.pname;
    if (event.type === 'pageview') {
      const page = cleanPath(event.path);
      session.pages.push({ path: page, title: event.title || friendlyPage(page), at });
      session.pageSet.add(page);
    }
    if (event.type === 'duration') {
      session.seconds += clamp(event.seconds, 0, 21600);
      session.engagedSeconds += clamp(event.engaged, 0, 21600);
    }
    const ot = outcomeType(event);
    if (ot) session.outcomes.add(ot);
    session.events.push(event);
  }
  return [...sessions.values()].map((session) => ({
    ...session,
    source: session.source || 'Direct or unknown',
    landing: session.pages[0] ? session.pages[0].path : '',
    exit: session.pages.length ? session.pages[session.pages.length - 1].path : '',
    uniquePages: [...session.pageSet],
    pageCount: session.pages.length,
    outcomes: [...session.outcomes],
    timeBand: timeBand(session.engagedSeconds || session.seconds),
    startedAt: Number.isFinite(session.startedAt) ? session.startedAt : 0,
    internalReason: session.internal ? 'Internal, automated or Studio traffic' : '',
  }));
}
function filterConversations(items, range) {
  return items.filter((item) => {
    const day = dayOf(item.updatedAt || item.createdAt || item.capturedAt || item.expiresAt);
    return !day || (day >= range.start && day <= range.end);
  });
}
function conversationSummary(item) {
  const messages = Array.isArray(item.messages) ? item.messages : [];
  const user = messages.filter((m) => String(m.role || '').toLowerCase() === 'user').map((m) => String(m.content || m.text || '')).filter(Boolean);
  const last = user[user.length - 1] || user[0] || '';
  return last ? last.replace(/\s+/g, ' ').slice(0, 220) : (item.artefact ? 'The visitor completed a result in the runtime.' : 'Conversation recorded; no readable summary is available.');
}
function attachDomainOutcomes(sessions, conversations, leads) {
  const byId = new Map(sessions.map((s) => [s.id, s]));
  for (const c of conversations) {
    const sid = String(c.sessionId || c.id || '');
    const s = byId.get(sid);
    if (!s) continue;
    s.conversations = s.conversations || [];
    s.conversations.push({
      id: sid, runtime: c.runtime || 'AI runtime', messages: Array.isArray(c.messages) ? c.messages.length : 0,
      completed: !!(c.artefact || ['completed', 'complete', 'done'].includes(String(c.status || '').toLowerCase())),
      summary: conversationSummary(c),
    });
    if (s.conversations[s.conversations.length - 1].completed) s.outcomes = [...new Set([...s.outcomes, 'Completed AI conversation'])];
  }
  for (const lead of leads) {
    const sid = String(lead.sessionId || '');
    const s = byId.get(sid);
    if (!s) continue;
    s.leads = s.leads || [];
    s.leads.push({ name: lead.name || '', email: lead.email || '', source: lead.source || '', at: lead.createdAt || lead.capturedAt || null });
    s.outcomes = [...new Set([...s.outcomes, 'Enquiry'])];
  }
}
function summarizeSessions(allSessions, range) {
  const external = allSessions.filter((s) => !s.internal);
  const internal = allSessions.filter((s) => s.internal);
  const visitors = new Set(external.map((s) => s.visitorId || s.personId || s.id));
  const sources = new Map(), dates = new Map(), bands = new Map(), pages = new Map(), outcomes = new Map();
  const sourceQuality = new Map();
  let totalSeconds = 0, totalPages = 0;
  for (const session of external) {
    inc(sources, session.source);
    inc(dates, session.date);
    inc(bands, session.timeBand);
    totalSeconds += session.engagedSeconds || session.seconds;
    totalPages += session.pageCount;
    const beyondLanding = session.uniquePages.slice(1);
    for (const page of beyondLanding) inc(pages, page);
    for (const outcome of session.outcomes) inc(outcomes, outcome);
    const q = sourceQuality.get(session.source) || { visitors: new Set(), sessions: 0, seconds: 0, pages: 0, outcomes: 0 };
    q.visitors.add(session.visitorId || session.personId || session.id); q.sessions++; q.seconds += session.engagedSeconds || session.seconds; q.pages += session.pageCount; q.outcomes += session.outcomes.length;
    sourceQuality.set(session.source, q);
  }
  const sourceRows = [...sourceQuality.entries()].map(([key, q]) => ({ key, visitors: q.visitors.size, sessions: q.sessions, avgSeconds: q.sessions ? Math.round(q.seconds / q.sessions) : 0, pages: q.pages, outcomes: q.outcomes })).sort((a, b) => b.visitors - a.visitors);
  const outcomeTotal = [...outcomes.values()].reduce((a, b) => a + b, 0);
  const resultSessions = external.filter((s) => s.outcomes.length);
  const avgResultSeconds = resultSessions.length ? Math.round(resultSessions.reduce((sum, s) => sum + (s.engagedSeconds || s.seconds), 0) / resultSessions.length) : 0;
  return {
    range,
    headline: {
      realVisitors: visitors.size,
      visits: external.length,
      pagesRead: totalPages,
      avgPages: external.length ? Math.round((totalPages / external.length) * 10) / 10 : 0,
      totalSeconds,
      avgSeconds: external.length ? Math.round(totalSeconds / external.length) : 0,
      usefulOutcomes: outcomeTotal,
      internalExcluded: internal.length,
      avgResultSeconds,
    },
    sources: sourceRows,
    dates: topN(dates, 400).sort((a, b) => a.key.localeCompare(b.key)),
    timeBands: ['Quick exit', 'Brief visit', 'Interested', 'Highly engaged', 'Deep engagement'].map((key) => ({ key, count: bands.get(key) || 0 })),
    pages: topN(pages, 20).map((row) => ({ ...row, label: friendlyPage(row.key) })),
    outcomes: ['Confirmed sale', 'Enquiry', 'Book-buying click', 'Completed AI conversation', 'Course registration', 'High-interest returning visitor'].map((key) => ({ key, count: outcomes.get(key) || 0, level: key === 'Confirmed sale' || key === 'Enquiry' ? 'Confirmed result' : (key === 'Book-buying click' ? 'Strong intent' : 'Meaningful engagement') })),
    sessions: external,
    excluded: internal,
  };
}
function comparison(current, previous) {
  const metrics = ['realVisitors', 'visits', 'pagesRead', 'totalSeconds', 'usefulOutcomes'];
  const out = {};
  for (const key of metrics) {
    const a = Number(current.headline[key]) || 0;
    const b = Number(previous.headline[key]) || 0;
    out[key] = { current: a, previous: b, changePct: b ? Math.round(((a - b) / b) * 100) : (a ? 100 : 0) };
  }
  return out;
}
function insights(summary, previous) {
  const rows = [];
  const comp = comparison(summary, previous);
  const bestSource = summary.sources[0];
  if (bestSource) rows.push({ tone: 'good', title: `${bestSource.key} brought the most visitors`, text: `${bestSource.visitors} real visitors came from this source and produced ${bestSource.outcomes} useful outcomes.` });
  const noOutcomePage = summary.pages.find((p) => {
    const sessions = summary.sessions.filter((s) => s.uniquePages.includes(p.key));
    return p.count >= 2 && !sessions.some((s) => s.outcomes.length);
  });
  if (noOutcomePage) rows.push({ tone: 'opportunity', title: `${noOutcomePage.label} attracts attention but no result`, text: `${noOutcomePage.count} post-landing page visits produced no recorded useful outcome in this period.` });
  const quick = summary.timeBands.find((b) => b.key === 'Quick exit');
  if (quick && quick.count) rows.push({ tone: quick.count > summary.headline.visits / 2 ? 'warning' : 'opportunity', title: `${quick.count} visits ended in under a minute`, text: 'Open this segment to see the sources and landing pages behind the quick exits.' });
  if (comp.realVisitors.changePct) rows.push({ tone: comp.realVisitors.changePct > 0 ? 'good' : 'warning', title: `Real visitors ${comp.realVisitors.changePct > 0 ? 'increased' : 'decreased'} ${Math.abs(comp.realVisitors.changePct)}%`, text: 'Compared with the immediately preceding equivalent period.' });
  return rows.slice(0, 3);
}
function filtersFromQuery(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed.slice(0, 12).filter((f) => f && f.field && f.value != null) : [];
  } catch (e) { return []; }
}
function sessionMatches(session, filter) {
  const value = String(filter.value);
  switch (filter.field) {
    case 'source': return session.source === value;
    case 'date': return session.date === value;
    case 'timeBand': return session.timeBand === value;
    case 'page': return session.uniquePages.includes(value);
    case 'outcome': return session.outcomes.includes(value);
    case 'visitor': return (session.visitorId || session.personId || session.id) === value;
    case 'session': return session.id === value;
    case 'campaign': return session.campaign === value;
    default: return true;
  }
}
function drillSummary(summary, filters) {
  let sessions = summary.sessions;
  for (const filter of filters) sessions = sessions.filter((s) => sessionMatches(s, filter));
  const sources = new Map(), dates = new Map(), bands = new Map(), pages = new Map(), outcomes = new Map(), visitors = new Map();
  for (const s of sessions) {
    inc(sources, s.source); inc(dates, s.date); inc(bands, s.timeBand); inc(visitors, s.visitorId || s.personId || s.id);
    for (const p of s.uniquePages) inc(pages, p);
    for (const o of s.outcomes) inc(outcomes, o);
  }
  const eventRows = sessions.length === 1 ? sessions[0].events.sort((a, b) => toMs(a.createdAt) - toMs(b.createdAt)).map((e) => ({
    id: e.id, at: toMs(e.createdAt), day: e.day || dayOf(e.createdAt), type: e.type || '', name: e.name || '', path: cleanPath(e.path), page: friendlyPage(e.path), seconds: e.seconds || 0, engaged: e.engaged || 0, props: e.props || null,
  })) : [];
  return {
    filters,
    headline: { sessions: sessions.length, visitors: visitors.size, pages: sessions.reduce((n, s) => n + s.pageCount, 0), seconds: sessions.reduce((n, s) => n + (s.engagedSeconds || s.seconds), 0), outcomes: sessions.reduce((n, s) => n + s.outcomes.length, 0) },
    sources: topN(sources, 20), dates: topN(dates, 400).sort((a, b) => a.key.localeCompare(b.key)),
    timeBands: ['Quick exit', 'Brief visit', 'Interested', 'Highly engaged', 'Deep engagement'].map((key) => ({ key, count: bands.get(key) || 0 })),
    pages: topN(pages, 30).map((r) => ({ ...r, label: friendlyPage(r.key) })), outcomes: topN(outcomes, 20),
    sessions: sessions.slice(0, 300).map((s) => ({
      id: s.id, visitorId: s.visitorId || s.personId || s.id, name: s.name, email: s.email, source: s.source, medium: s.medium, campaign: s.campaign, date: s.date,
      seconds: s.engagedSeconds || s.seconds, pageCount: s.pageCount, pages: s.uniquePages.map((p) => ({ path: p, label: friendlyPage(p) })), outcomes: s.outcomes,
      conversations: s.conversations || [], leads: s.leads || [], landing: s.landing, exit: s.exit,
    })),
    events: eventRows,
  };
}
async function loadPeriod(range) {
  const events = await fetchEvents(range.start, range.end);
  const sessions = buildSessions(events);
  const [convosRaw, leadsRaw] = await Promise.all([
    listConversations({ limit: 1000 }).catch(() => []),
    listLeads({ limit: 1000 }).catch(() => []),
  ]);
  const conversations = filterConversations(convosRaw, range);
  const leads = filterConversations(leadsRaw, range);
  attachDomainOutcomes(sessions, conversations, leads);
  const visitorVisitCounts = new Map();
  for (const s of sessions.filter((x) => !x.internal)) inc(visitorVisitCounts, s.visitorId || s.personId || s.id);
  for (const s of sessions) {
    const key = s.visitorId || s.personId || s.id;
    if (!s.internal && (visitorVisitCounts.get(key) || 0) > 1 && ((s.engagedSeconds || s.seconds) >= 600 || s.pageCount >= 4)) {
      s.outcomes = [...new Set([...s.outcomes, 'High-interest returning visitor'])];
    }
  }
  return summarizeSessions(sessions, range);
}

export async function intelligenceOverview(query = {}) {
  const lastChecked = await getLastChecked().catch(() => null);
  const range = resolveRange(query, lastChecked);
  const previous = previousRange(range.start, range.end);
  const previousRangeResolved = { mode: 'comparison', start: previous.start, end: previous.end, days: range.days };
  const [currentSummary, previousSummary] = await Promise.all([loadPeriod(range), loadPeriod(previousRangeResolved)]);
  const sessions = currentSummary.sessions;
  const brief = {
    visitors: currentSummary.headline.realVisitors,
    visits: currentSummary.headline.visits,
    pages: currentSummary.headline.pagesRead,
    hours: Math.round((currentSummary.headline.totalSeconds / 3600) * 10) / 10,
    conversations: sessions.reduce((n, s) => n + ((s.conversations || []).length), 0),
    buyClicks: sessions.filter((s) => s.outcomes.includes('Book-buying click')).length,
    enquiries: sessions.filter((s) => s.outcomes.includes('Enquiry')).length,
  };
  return {
    ok: true,
    range,
    brief,
    headline: currentSummary.headline,
    sources: currentSummary.sources,
    dates: currentSummary.dates,
    timeBands: currentSummary.timeBands,
    pages: currentSummary.pages,
    outcomes: currentSummary.outcomes,
    comparison: comparison(currentSummary, previousSummary),
    insights: insights(currentSummary, previousSummary),
    partial: currentSummary.sessions.length >= MAX_EVENTS,
  };
}
export async function intelligenceDrill(query = {}) {
  const lastChecked = await getLastChecked().catch(() => null);
  const range = resolveRange(query, lastChecked);
  const summary = await loadPeriod(range);
  return { ok: true, range, ...drillSummary(summary, filtersFromQuery(query.filters)) };
}

export function registerAnalyticsIntelligenceRoutes(app, { requireAdmin }) {
  app.get('/api/analytics/intelligence', requireAdmin, async (req, res) => {
    try { res.json(await intelligenceOverview(req.query || {})); }
    catch (err) { res.status(500).json({ ok: false, error: 'server_error', detail: err.message }); }
  });
  app.get('/api/analytics/intelligence/drill', requireAdmin, async (req, res) => {
    try { res.json(await intelligenceDrill(req.query || {})); }
    catch (err) { res.status(500).json({ ok: false, error: 'server_error', detail: err.message }); }
  });
  app.post('/api/analytics/intelligence/checkin', requireAdmin, async (req, res) => {
    try { res.json({ ok: true, checkedAt: await setLastChecked() }); }
    catch (err) { res.status(500).json({ ok: false, error: 'server_error', detail: err.message }); }
  });
}
