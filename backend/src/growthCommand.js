// Book Growth Command Centre
//
// Converts first-party website analytics and (when connected) Google Search
// Console data into one detailed daily task for Vinay and one for Vaishnav.
// Tasks, proof, verification and notification state live in Firestore so the
// accountability system works across devices. Email uses the existing Resend
// account; Slack uses an incoming-webhook URL. Scheduled calls are protected by
// GROWTH_CRON_SECRET.
import crypto from 'node:crypto';
import { db, COLLECTIONS } from './firestore.js';
import { config } from './config.js';
import { analyticsSummary } from './services/analytics.js';

const BOOKS = [
  { name: 'AI for Business Leaders', path: '/paths/ai-for-business', keyword: 'AI for business leaders' },
  { name: 'The SIV Method', path: '/paths/decisions', keyword: 'decision making framework for leaders' },
  { name: 'The Execution Doctrine', path: '/paths/execute', keyword: 'business execution system' },
  { name: 'Organizational Frequency', path: '/paths/hire', keyword: 'organizational alignment and hiring' },
  { name: 'The Signal', path: '/paths/evolve', keyword: 'AI and human evolution' },
  { name: 'Civilization', path: '/paths/civilization', keyword: 'future of civilization and AI' },
];

const STATUS = new Set(['assigned', 'started', 'proof_submitted', 'verified']);
const OWNER = new Set(['vinay', 'vaishnav']);

function str(value, max = 8000) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function arr(value, maxItems = 12, maxText = 1200) {
  return Array.isArray(value) ? value.slice(0, maxItems).map((item) => str(item, maxText)).filter(Boolean) : [];
}
function nowIso() { return new Date().toISOString(); }
function dateInZone(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 86400000);
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: config.growthTimezone || 'Asia/Kolkata',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(date);
  } catch (e) {
    return date.toISOString().slice(0, 10);
  }
}
function dayIndex() {
  const start = new Date(new Date().getFullYear(), 0, 0);
  return Math.floor((Date.now() - start.getTime()) / 86400000);
}
function safeId(value) { return str(value, 140).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, ''); }
function taskId(date, owner) { return `${date}-${owner}`; }
function taskRef(id) { return db.collection(COLLECTIONS.growthTasks).doc(id); }
function runRef(id) { return db.collection(COLLECTIONS.growthRuns).doc(id); }

function plainTask(id, data) {
  const task = data || {};
  return {
    id,
    date: task.date || '',
    owner: task.owner || '',
    ownerName: task.ownerName || '',
    category: task.category || '',
    title: task.title || '',
    why: task.why || '',
    instructions: Array.isArray(task.instructions) ? task.instructions : [],
    proofRequirement: task.proofRequirement || '',
    expectedMinutes: Number(task.expectedMinutes) || 0,
    due: task.due || '18:00',
    status: STATUS.has(task.status) ? task.status : 'assigned',
    source: task.source || 'first_party_analytics',
    evidence: task.evidence || {},
    createdAt: task.createdAt || '',
    updatedAt: task.updatedAt || '',
    startedAt: task.startedAt || '',
    proofAt: task.proofAt || '',
    verifiedAt: task.verifiedAt || '',
    proofUrl: task.proofUrl || '',
    proofNote: task.proofNote || '',
    notificationAssignAt: task.notificationAssignAt || '',
    notificationFollowupAt: task.notificationFollowupAt || '',
    notificationCloseAt: task.notificationCloseAt || '',
    notificationError: task.notificationError || '',
  };
}

async function getTask(id) {
  const snap = await taskRef(id).get();
  return snap.exists ? plainTask(snap.id, snap.data()) : null;
}

async function listTasks({ limit = 100 } = {}) {
  const lim = Math.max(1, Math.min(500, parseInt(limit, 10) || 100));
  let snap;
  try {
    snap = await db.collection(COLLECTIONS.growthTasks).orderBy('date', 'desc').limit(lim).get();
  } catch (e) {
    snap = await db.collection(COLLECTIONS.growthTasks).limit(lim).get();
  }
  return snap.docs.map((doc) => plainTask(doc.id, doc.data())).sort((a, b) => (b.date + b.owner).localeCompare(a.date + a.owner));
}

function bookSignals(summary) {
  const traffic = summary.traffic || {};
  const events = summary.events || {};
  const acquisition = summary.acquisition || {};
  const topPages = traffic.topPages || [];
  const pageCount = (path) => {
    const target = String(path).replace(/\/$/, '');
    const hit = topPages.find((item) => String(item.key || '').replace(/\/$/, '') === target);
    return hit ? Number(hit.count) || 0 : 0;
  };
  const pages = BOOKS.map((book) => ({ ...book, count: pageCount(book.path) })).sort((a, b) => b.count - a.count);
  const bookViews = pages.reduce((sum, item) => sum + item.count, 0);
  const buyClicks = (events.topClicks || []).filter((item) => /amazon|buy|order|kindle|paperback|book/i.test(String(item.key || '')))
    .reduce((sum, item) => sum + (Number(item.count) || 0), 0);
  const qualifiedSessions = (acquisition.topSources || []).filter((item) => String(item.key || '').toLowerCase() !== 'direct')
    .reduce((sum, item) => sum + (Number(item.count) || 0), 0);
  const priority = pages.find((item) => item.count > 0) || BOOKS[dayIndex() % BOOKS.length];
  return { pages, bookViews, buyClicks, qualifiedSessions, priority };
}

async function metadataAccessToken() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', {
      headers: { 'Metadata-Flavor': 'Google' }, signal: controller.signal,
    });
    if (!response.ok) throw new Error(`metadata token ${response.status}`);
    const body = await response.json();
    if (!body.access_token) throw new Error('metadata token missing');
    return body.access_token;
  } finally {
    clearTimeout(timer);
  }
}

function isoDay(date) { return date.toISOString().slice(0, 10); }

async function searchConsoleSnapshot({ days = 28 } = {}) {
  const site = config.growthSearchConsoleSite;
  if (!site) return { configured: false, connected: false, rows: [], opportunity: null, error: '' };
  try {
    const end = new Date(Date.now() - 3 * 86400000);
    const start = new Date(end.getTime() - Math.max(7, Math.min(90, days)) * 86400000);
    const token = await metadataAccessToken();
    const endpoint = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startDate: isoDay(start), endDate: isoDay(end),
        dimensions: ['query', 'page'], rowLimit: 500,
        dataState: 'final',
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(str(body.error && body.error.message || `Search Console ${response.status}`, 300));
    const rows = (body.rows || []).map((row) => ({
      query: str(row.keys && row.keys[0], 220),
      page: str(row.keys && row.keys[1], 500),
      clicks: Number(row.clicks) || 0,
      impressions: Number(row.impressions) || 0,
      ctr: Number(row.ctr) || 0,
      position: Number(row.position) || 0,
    }));
    const ranked = rows.filter((row) => row.impressions >= 3 && row.position > 1 && row.position <= 40)
      .map((row) => ({
        ...row,
        opportunityScore: Math.round(row.impressions * Math.max(.08, 1 - row.ctr) * (row.position <= 12 ? 1.45 : row.position <= 25 ? 1.15 : .8)),
      }))
      .sort((a, b) => b.opportunityScore - a.opportunityScore);
    return { configured: true, connected: true, rows: rows.slice(0, 100), opportunity: ranked[0] || null, error: '', range: { start: isoDay(start), end: isoDay(end) } };
  } catch (error) {
    return { configured: true, connected: false, rows: [], opportunity: null, error: str(error.message, 300) };
  }
}

function selectBookFromPage(page, fallback) {
  const path = String(page || '').replace(/^https?:\/\/[^/]+/i, '').split('?')[0].replace(/\/$/, '');
  return BOOKS.find((book) => path === book.path || path.startsWith(book.path + '/')) || fallback || BOOKS[0];
}

function makeTask(date, owner, plan, context) {
  const timestamp = nowIso();
  return {
    date,
    owner,
    ownerName: owner === 'vinay' ? 'Vinay' : 'Vaishnav',
    category: plan.category,
    title: plan.title,
    why: plan.why,
    instructions: plan.instructions,
    proofRequirement: plan.proof,
    expectedMinutes: plan.minutes,
    due: plan.due || '18:00',
    status: 'assigned',
    source: context.source,
    evidence: context.evidence,
    createdAt: timestamp,
    updatedAt: timestamp,
    startedAt: '', proofAt: '', verifiedAt: '', proofUrl: '', proofNote: '',
    notificationAssignAt: '', notificationFollowupAt: '', notificationCloseAt: '', notificationError: '',
  };
}

function buildPlans(summary, searchConsole) {
  const signals = bookSignals(summary);
  const searchOpportunity = searchConsole && searchConsole.opportunity;
  const book = selectBookFromPage(searchOpportunity && searchOpportunity.page, signals.priority);
  const query = searchOpportunity && searchOpportunity.query ? searchOpportunity.query : book.keyword;
  const source = searchOpportunity ? 'search_console' : 'first_party_analytics';
  const evidence = searchOpportunity ? {
    query, page: searchOpportunity.page, clicks: searchOpportunity.clicks,
    impressions: searchOpportunity.impressions,
    ctr: Math.round(searchOpportunity.ctr * 1000) / 10,
    position: Math.round(searchOpportunity.position * 10) / 10,
  } : {
    page: book.path, pageViews: book.count || 0,
    bookViews: signals.bookViews, buyClicks: signals.buyClicks,
    sessions: Number(summary.traffic && summary.traffic.sessions) || 0,
  };

  const variant = dayIndex() % 5;
  const vinayPlans = [
    {
      category: 'SEO content · reader question',
      title: `Record the clearest 60-second answer to “${query}”`,
      why: searchOpportunity
        ? `This query has ${searchOpportunity.impressions} impressions, an average position of ${searchOpportunity.position.toFixed(1)} and ${(searchOpportunity.ctr * 100).toFixed(1)}% click-through. A sharper original answer can improve both authority and response.`
        : `The website needs a steady stream of original answers that attract the right reader and lead naturally to ${book.name}.`,
      instructions: [
        `Open by repeating the reader’s real question: “${query}”.`,
        `Give one counter-intuitive answer drawn from ${book.name}; do not begin by promoting the book.`,
        'Use one real business example and finish with one action the viewer can take today.',
        `Publish on LinkedIn and YouTube Shorts, using ${book.path} as the destination link.`,
        'Submit both published URLs as proof.',
      ],
      proof: 'Published LinkedIn and YouTube URLs.', minutes: 45,
    },
    {
      category: 'SEO authority · original answer',
      title: `Write the definitive answer to “${query}”`,
      why: `A focused, first-hand answer gives Vaishnav a page that can rank and gives readers a reason to trust the argument behind ${book.name}.`,
      instructions: [
        `Write 400–600 words answering “${query}”.`,
        `State the common but incomplete answer, then explain what leaders usually miss.`,
        'Use one specific example from GoodSpace, WLC or your earlier operating experience.',
        `End with a three-step action and a natural bridge to ${book.name}.`,
        'Share the final document link with Vaishnav and submit it as proof.',
      ],
      proof: 'A completed document link containing the 400–600 word answer.', minutes: 55,
    },
    {
      category: 'Social discovery · saveable idea',
      title: `Turn one idea from ${book.name} into a five-slide carousel`,
      why: 'Saved and shared ideas create qualified discovery before paid advertising is introduced.',
      instructions: [
        'Slide 1: state one surprising claim in no more than 12 words.',
        'Slides 2–4: explain the problem, one example and the leadership implication.',
        `Slide 5: one action plus “Read the full argument” linking to ${book.path}.`,
        'Publish on LinkedIn and Instagram using channel-specific captions.',
        'Submit the two live post URLs as proof.',
      ],
      proof: 'Live LinkedIn and Instagram carousel URLs.', minutes: 50,
    },
    {
      category: 'Founder evidence · trust',
      title: `Tell one real story that proves the argument behind ${book.name}`,
      why: 'First-hand operating evidence is difficult to imitate and gives senior readers a reason to continue into the book.',
      instructions: [
        'Choose one real decision where the obvious answer was wrong or incomplete.',
        'Describe the situation, the initial assumption, the evidence and the decision made.',
        `Connect the lesson to one principle in ${book.name}.`,
        'Record a 90-second video or write 450 words.',
        `Publish with a contextual link to ${book.path} and submit the URL.`,
      ],
      proof: 'Published article or video URL.', minutes: 55,
    },
    {
      category: 'Audience learning · objection discovery',
      title: `Ask readers what stops them acting on “${query}”`,
      why: 'Before spending on advertising, direct evidence about objections and desired outcomes should shape the message.',
      instructions: [
        `Create a LinkedIn poll framed around “${query}”.`,
        'Use four answer options representing different business problems, not product features.',
        'Reply personally to the first five substantive comments.',
        `Place the ${book.path} link only in the first comment.`,
        'Submit the poll URL and a short note on the strongest response.',
      ],
      proof: 'Poll URL plus a note or screenshot summarising the responses.', minutes: 35,
    },
  ];

  const vaishnavPlans = [
    {
      category: 'Technical SEO · search opportunity',
      title: `Optimise the page for “${query}”`,
      why: searchOpportunity
        ? `Google is already showing this page for the query, but position ${searchOpportunity.position.toFixed(1)} and ${(searchOpportunity.ctr * 100).toFixed(1)}% click-through leave measurable room to improve.`
        : `The priority page must answer its core search intent clearly before additional promotion can convert into book interest.`,
      instructions: [
        `Audit ${book.path} against the primary phrase “${query}”.`,
        'Rewrite the title tag and meta description so the reader benefit is specific and credible.',
        'Add a 180–250 word answer section near the top, using the phrase naturally.',
        'Add two contextual internal links from relevant existing pages.',
        'Check desktop and mobile rendering, then submit the page URL and before/after screenshots.',
      ],
      proof: 'Updated page URL and before/after screenshots.', minutes: 65,
    },
    {
      category: 'Internal linking · discovery',
      title: `Create three strong paths into ${book.name}`,
      why: 'Internal links help readers discover the relevant book and help search engines recognise its importance.',
      instructions: [
        `Find three existing pages closely related to “${query}”.`,
        `Add one contextual link from each page to ${book.path}.`,
        'Use descriptive anchor text; never use “click here”.',
        'Confirm every link works and is easy to use on mobile.',
        'Submit all three source URLs and the destination URL as proof.',
      ],
      proof: 'Three source URLs plus the destination book-page URL.', minutes: 45,
    },
    {
      category: 'Conversion · purchase path',
      title: `Make the path from ${book.name} interest to purchase unmistakable`,
      why: signals.bookViews > 0 && signals.buyClicks === 0
        ? `${signals.bookViews} observed book-page views produced no visible buy-intent click in the current summary. The next action and its tracking need attention.`
        : 'Book interest becomes commercially useful only when the next action is clear, trustworthy and measurable.',
      instructions: [
        `Review every purchase link on ${book.path}.`,
        'Place one clear purchase action above the first major scroll break and one after the strongest proof.',
        'Add unique data-track labels including book name, retailer and button position.',
        'Test all links on desktop and mobile.',
        'Submit screenshots, the live page URL and the event labels used.',
      ],
      proof: 'Page URL, screenshots and the tracking-label map.', minutes: 60,
    },
    {
      category: 'Structured data · search appearance',
      title: `Add or validate Book schema for ${book.name}`,
      why: 'Clean structured data removes technical ambiguity and helps search engines understand the page and its relationship to the author and purchase destination.',
      instructions: [
        `Inspect structured data on ${book.path}.`,
        'Add or correct Book, Person and BreadcrumbList schema where appropriate.',
        'Use the real title, author, cover image, language, publication information and purchase URL.',
        'Validate with Google Rich Results Test or Schema.org validator.',
        'Submit the validation result and the updated page URL.',
      ],
      proof: 'Validation result plus updated page URL.', minutes: 55,
    },
    {
      category: 'Measurement · reliable funnel',
      title: 'Make every book action measurable by book and retailer',
      why: 'The dashboard cannot distinguish interest, purchase intent and sales until events are labelled consistently.',
      instructions: [
        'Inventory every book page and every purchase link.',
        'Use consistent labels for book_view, buy_click, book name, retailer and button position.',
        'Test one view and one buy click for each live book page.',
        'Confirm the events appear in the analytics dashboard.',
        'Submit the event map and screenshots of successful tests.',
      ],
      proof: 'Event map plus screenshots of successful analytics events.', minutes: 70,
    },
  ];

  return {
    context: { source, evidence, book, query, signals },
    vinay: vinayPlans[variant],
    vaishnav: vaishnavPlans[variant],
  };
}

async function ensureDailyTasks({ force = false, days = 30 } = {}) {
  const date = dateInZone();
  const ids = { vinay: taskId(date, 'vinay'), vaishnav: taskId(date, 'vaishnav') };
  const current = {
    vinay: await getTask(ids.vinay),
    vaishnav: await getTask(ids.vaishnav),
  };
  if (!force && current.vinay && current.vaishnav) return [current.vinay, current.vaishnav];
  if (force && [current.vinay, current.vaishnav].some((task) => task && task.status !== 'assigned')) {
    const error = new Error('Today’s plan cannot be regenerated after work has started or proof has been submitted.');
    error.code = 'task_in_progress';
    throw error;
  }

  const summary = await analyticsSummary({ days });
  const searchConsole = await searchConsoleSnapshot({ days: Math.min(90, Math.max(14, days)) });
  const plans = buildPlans(summary, searchConsole);
  const tasks = [
    makeTask(date, 'vinay', plans.vinay, { source: plans.context.source, evidence: plans.context.evidence }),
    makeTask(date, 'vaishnav', plans.vaishnav, { source: plans.context.source, evidence: plans.context.evidence }),
  ];
  await Promise.all(tasks.map((task) => taskRef(taskId(date, task.owner)).set(task, { merge: false })));
  await runRef(`plan-${date}`).set({
    type: 'daily_plan', date, source: plans.context.source,
    evidence: plans.context.evidence, createdAt: nowIso(),
  }, { merge: true });
  return tasks.map((task) => plainTask(taskId(date, task.owner), task));
}

function ownerEmail(owner) {
  return owner === 'vinay' ? config.growthVinayEmail : owner === 'vaishnav' ? config.growthVaishnavEmail : '';
}
function html(value) {
  return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
function taskText(task, mode) {
  const heading = mode === 'assign' ? 'TODAY’S BOOK GROWTH TASK'
    : mode === 'followup' ? 'BOOK GROWTH FOLLOW-UP'
      : 'BOOK GROWTH TASK — PROOF DUE';
  const lines = [heading + ' — ' + task.ownerName.toUpperCase(), '', task.title, '', `Why it matters: ${task.why}`, '', 'Instructions:'];
  task.instructions.forEach((step, index) => lines.push(`${index + 1}. ${step}`));
  lines.push('', `Expected time: ${task.expectedMinutes} minutes`, `Due: ${task.due} IST`, `Proof required: ${task.proofRequirement}`, '', 'Open the Book Growth Command Centre to start, submit proof and verify completion.');
  return lines.join('\n');
}
function taskHtml(task, mode) {
  const heading = mode === 'assign' ? 'Today’s Book Growth Task'
    : mode === 'followup' ? 'Your Book Growth Task Is Still Open'
      : 'Proof Is Due Before Today Closes';
  return `<!doctype html><html><body style="margin:0;background:#f5efe5;color:#1b1815;font-family:Arial,sans-serif"><div style="max-width:680px;margin:0 auto;padding:34px 22px"><div style="font:600 10px monospace;letter-spacing:.14em;text-transform:uppercase;color:#b74a2f">Book Growth Command Centre</div><h1 style="font-family:Georgia,serif;font-size:34px;font-weight:400;line-height:1.05;margin:10px 0 6px">${html(heading)}</h1><p style="color:#6d6258;margin:0 0 24px">Assigned to ${html(task.ownerName)} · due ${html(task.due)} IST</p><div style="background:#fffdf8;border:1px solid #d8cbb6;border-radius:10px;padding:24px"><div style="font:600 10px monospace;text-transform:uppercase;letter-spacing:.1em;color:#b74a2f">${html(task.category)}</div><h2 style="font-family:Georgia,serif;font-size:27px;font-weight:400;margin:9px 0">${html(task.title)}</h2><p style="line-height:1.55;color:#6d6258">${html(task.why)}</p><ol style="padding-left:22px;line-height:1.55">${task.instructions.map((step) => `<li style="margin:9px 0">${html(step)}</li>`).join('')}</ol><p style="border-top:1px solid #d8cbb6;padding-top:14px"><strong>Proof required:</strong> ${html(task.proofRequirement)}</p></div><p style="font-size:12px;color:#95897d;margin-top:18px">Open Studio → Book Growth to update status and submit proof.</p></div></body></html>`;
}

async function sendEmail(task, mode) {
  const to = ownerEmail(task.owner);
  if (!config.resendApiKey || !to) return { configured: false, sent: false, error: '' };
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: config.growthFromEmail,
        to: [to],
        subject: `${mode === 'assign' ? 'Today’s' : 'Pending'} Book Growth Task — ${task.ownerName}`,
        html: taskHtml(task, mode),
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(str(body.message || body.error || `Resend ${response.status}`, 240));
    return { configured: true, sent: true, id: body.id || '', error: '' };
  } catch (error) {
    return { configured: true, sent: false, error: str(error.message, 240) };
  }
}

async function sendSlack(task, mode) {
  if (!config.growthSlackWebhookUrl) return { configured: false, sent: false, error: '' };
  try {
    const response = await fetch(config.growthSlackWebhookUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: taskText(task, mode),
        blocks: [
          { type: 'header', text: { type: 'plain_text', text: `${mode === 'assign' ? 'Today’s task' : 'Follow-up'} · ${task.ownerName}`.slice(0, 150), emoji: true } },
          { type: 'section', text: { type: 'mrkdwn', text: `*${task.title}*\n${task.why}`.slice(0, 2900) } },
          { type: 'section', text: { type: 'mrkdwn', text: task.instructions.map((step, index) => `${index + 1}. ${step}`).join('\n').slice(0, 2900) } },
          { type: 'context', elements: [{ type: 'mrkdwn', text: `*Due:* ${task.due} IST · *Proof:* ${task.proofRequirement}`.slice(0, 1900) }] },
        ],
      }),
    });
    if (!response.ok) throw new Error(`Slack ${response.status}: ${str(await response.text(), 180)}`);
    return { configured: true, sent: true, error: '' };
  } catch (error) {
    return { configured: true, sent: false, error: str(error.message, 240) };
  }
}

async function notifyTask(task, mode = 'assign') {
  const [email, slack] = await Promise.all([sendEmail(task, mode), sendSlack(task, mode)]);
  const sent = email.sent || slack.sent;
  const errors = [email.error, slack.error].filter(Boolean).join(' · ');
  const field = mode === 'assign' ? 'notificationAssignAt' : mode === 'followup' ? 'notificationFollowupAt' : 'notificationCloseAt';
  const patch = { updatedAt: nowIso(), notificationError: errors };
  if (sent) patch[field] = nowIso();
  await taskRef(task.id).set(patch, { merge: true });
  return { email, slack, sent, errors };
}

async function updateTask(id, body) {
  const current = await getTask(id);
  if (!current) return null;
  const patch = { updatedAt: nowIso() };
  const nextStatus = str(body && body.status, 40);
  if (nextStatus && !STATUS.has(nextStatus)) throw new Error('Invalid task status.');
  if (nextStatus === 'started') {
    patch.status = 'started'; patch.startedAt = current.startedAt || nowIso();
  } else if (nextStatus === 'proof_submitted') {
    const proofUrl = str(body && body.proofUrl, 1200);
    const proofNote = str(body && body.proofNote, 5000);
    if (!proofUrl && !proofNote) throw new Error('Add a proof link or completion note.');
    patch.status = 'proof_submitted'; patch.proofAt = nowIso(); patch.proofUrl = proofUrl; patch.proofNote = proofNote;
  } else if (nextStatus === 'verified') {
    if (current.status !== 'proof_submitted' && current.status !== 'verified') throw new Error('Proof must be submitted before verification.');
    patch.status = 'verified'; patch.verifiedAt = current.verifiedAt || nowIso();
  } else if (nextStatus === 'assigned') {
    patch.status = 'assigned';
  }
  if (Object.prototype.hasOwnProperty.call(body || {}, 'proofUrl')) patch.proofUrl = str(body.proofUrl, 1200);
  if (Object.prototype.hasOwnProperty.call(body || {}, 'proofNote')) patch.proofNote = str(body.proofNote, 5000);
  await taskRef(id).set(patch, { merge: true });
  return getTask(id);
}

async function runCycle(mode) {
  if (!['assign', 'followup', 'close'].includes(mode)) throw new Error('Unknown growth cycle.');
  const tasks = await ensureDailyTasks({ days: 30 });
  const results = [];
  for (const task of tasks) {
    const fresh = await getTask(task.id);
    if (!fresh || fresh.status === 'verified') continue;
    const already = mode === 'assign' ? fresh.notificationAssignAt : mode === 'followup' ? fresh.notificationFollowupAt : fresh.notificationCloseAt;
    if (already) continue;
    const delivery = await notifyTask(fresh, mode);
    results.push({ task: fresh.id, owner: fresh.owner, ...delivery });
  }
  await runRef(`${dateInZone()}-${mode}`).set({ type: mode, ranAt: nowIso(), results }, { merge: true });
  return results;
}

function cronAllowed(req) {
  const expected = config.growthCronSecret;
  const got = str(req.get('x-growth-cron-secret') || req.query && req.query.secret, 500);
  if (!expected || !got || expected.length !== got.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(got)); }
  catch (e) { return false; }
}

async function commandSnapshot(days) {
  const span = Math.max(7, Math.min(90, parseInt(days, 10) || 30));
  const [summary, searchConsole] = await Promise.all([
    analyticsSummary({ days: span }),
    searchConsoleSnapshot({ days: Math.min(90, Math.max(14, span)) }),
  ]);
  await ensureDailyTasks({ days: span });
  const tasks = await listTasks({ limit: 120 });
  const today = dateInZone();
  return {
    range: summary.range,
    summary,
    tasks: tasks.filter((task) => task.date === today),
    history: tasks,
    searchConsole: {
      configured: searchConsole.configured,
      connected: searchConsole.connected,
      error: searchConsole.error,
      range: searchConsole.range || null,
      opportunity: searchConsole.opportunity,
      rows: searchConsole.rows.slice(0, 30),
    },
    integrations: {
      searchConsole: searchConsole.connected,
      email: !!config.resendApiKey && !!config.growthVinayEmail && !!config.growthVaishnavEmail,
      slack: !!config.growthSlackWebhookUrl,
      amazon: false,
    },
  };
}

export function registerGrowthCommandRoutes(app, { requireAdmin, rateLimit } = {}) {
  const admin = requireAdmin || ((req, res, next) => next());
  const limited = rateLimit ? rateLimit({ windowMs: 60000, max: 20 }) : ((req, res, next) => next());

  app.get('/api/growth/command', admin, async (req, res) => {
    try { res.json({ ok: true, ...(await commandSnapshot(req.query.days)) }); }
    catch (error) { console.error('[growth] command:', error); res.status(500).json({ ok: false, error: 'growth_command_failed', detail: error.message }); }
  });

  app.post('/api/growth/tasks/regenerate', admin, limited, async (req, res) => {
    try {
      const tasks = await ensureDailyTasks({ force: true, days: req.body && req.body.days });
      res.json({ ok: true, tasks });
    } catch (error) {
      res.status(error.code === 'task_in_progress' ? 409 : 500).json({ ok: false, error: error.code || 'regenerate_failed', detail: error.message });
    }
  });

  app.patch('/api/growth/tasks/:id', admin, async (req, res) => {
    try {
      const task = await updateTask(safeId(req.params.id), req.body || {});
      if (!task) return res.status(404).json({ ok: false, error: 'not_found' });
      res.json({ ok: true, task });
    } catch (error) {
      res.status(400).json({ ok: false, error: 'task_update_failed', detail: error.message });
    }
  });

  app.post('/api/growth/tasks/:id/notify', admin, limited, async (req, res) => {
    try {
      const task = await getTask(safeId(req.params.id));
      if (!task) return res.status(404).json({ ok: false, error: 'not_found' });
      const mode = ['assign', 'followup', 'close'].includes(req.body && req.body.mode) ? req.body.mode : 'assign';
      res.json({ ok: true, delivery: await notifyTask(task, mode) });
    } catch (error) {
      res.status(500).json({ ok: false, error: 'notification_failed', detail: error.message });
    }
  });

  // Called by GitHub Actions or Cloud Scheduler. The secret is independent of
  // Studio access and must be sent in x-growth-cron-secret.
  app.post('/api/growth/cron/:mode', limited, async (req, res) => {
    if (!cronAllowed(req)) return res.status(config.growthCronSecret ? 401 : 503).json({ ok: false, error: config.growthCronSecret ? 'unauthorized' : 'growth_cron_not_configured' });
    try { res.json({ ok: true, mode: req.params.mode, results: await runCycle(req.params.mode) }); }
    catch (error) { console.error('[growth] cron:', error); res.status(500).json({ ok: false, error: 'growth_cycle_failed', detail: error.message }); }
  });
}
