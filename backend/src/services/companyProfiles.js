// Company Frequency profiles — genuine LIVE research → persisted shareable page.
//
// Flow:
//   1. runResearch(name, url)   → Gemini with live Google Search grounding writes
//      a full, grounded 12-dimension profile (the "detailed research prompt").
//   2. buildStore(...)          → shapes it into the of.runtime.v1 store that
//      frequency/company.js renders.
//   3. saveCompanyProfile(...)  → upsert into Firestore, keyed by slug.
//   4. renderCompanyPage(...)   → inject the data into company.html and serve it
//      at /frequency/company/<slug>.
import { db, COLLECTIONS } from '../firestore.js';
import { completeGrounded } from './ai.js';

// The 12 frequency dimensions (key → display label). Source of truth shared with
// the front-end (frequency/company.js DIM_LABELS).
export const DIMS = [
  ['leadership_style', 'Leadership Style'],
  ['decision_making', 'Decision-Making'],
  ['communication_culture', 'Communication Culture'],
  ['execution_style', 'Execution Style'],
  ['pressure_environment', 'Pressure Environment'],
  ['autonomy_level', 'Autonomy Level'],
  ['collaboration_style', 'Collaboration Style'],
  ['talent_philosophy', 'Talent Philosophy'],
  ['growth_orientation', 'Growth Orientation'],
  ['stability_vs_chaos', 'Stability vs. Chaos'],
  ['innovation_orientation', 'Innovation Orientation'],
  ['employee_flourishing', 'Employee Flourishing'],
];
const DIM_KEYS = DIMS.map(([k]) => k);

export const STAGE_LABELS = ['Outside-in', 'Mission captured', 'Tier-0 research', 'Deep discovery', 'Validated'];

// Mirror frequency/company.js so the reveal card shows the same % the page does.
export function profileAccuracy(store, stage) {
  const ACC = [18, 33, 54, 75, 92];
  const bn = { high: 0.85, medium: 0.62, low: 0.38, none: 0.12 };
  const est = (store.pub_estimates && store.pub_estimates[0]) || {};
  const dims = est.dimensions || {};
  const contested = new Set((store.pub_contradictions || []).map((c) => c.dimension));
  const keys = Object.keys(dims);
  const vals = keys.map((k) => {
    const d = dims[k];
    let c = bn[d.confidence] != null ? bn[d.confidence] : 0.3;
    const validated = stage >= 4 && !contested.has(k) && d.confidence !== 'none';
    if (validated) c = Math.max(c, 0.85);
    else if (stage >= 2 && d.confidence === 'medium') c = Math.max(c, 0.66);
    return c;
  });
  const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0.3;
  const s = Math.max(0, Math.min(4, stage));
  return Math.max(ACC[s] - 6, Math.round(mean * 100));
}

export function slugify(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function host(u) {
  return String(u || '').replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '');
}

// Strip HTML and cap length on every string in an object tree — the data is
// rendered into a public page, so never let markup or runaway text through.
function clean(v, max = 1200) {
  if (typeof v === 'string') return v.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
  if (Array.isArray(v)) return v.map((x) => clean(x, max));
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v)) o[k] = clean(v[k], max);
    return o;
  }
  return v;
}

function parseJson(text) {
  const m = String(text || '').match(/\{[\s\S]*\}/);
  if (!m) throw new Error('no JSON in model output');
  return JSON.parse(m[0]);
}

// ---- The detailed, genuine research prompt --------------------------------
function researchSystemPrompt() {
  return [
    'You are the senior research analyst for an Organizational Frequency engine.',
    'You have LIVE Google Search — actually search the web before answering. Look up the company\'s own',
    'website and careers page, its LinkedIn, employee reviews (Glassdoor / AmbitionBox), news, funding and',
    'company databases (Tracxn / Crunchbase), founder interviews and podcasts. Use multiple independent sources.',
    '',
    'From that real, corroborated signal, infer the company\'s 12-dimension organizational frequency — an',
    'outside-in, probabilistic read, never a verdict. Tone: calm, precise, honest. Hedge ("Public signals',
    'suggest…", "appears to…"). NEVER invent facts; every claim must trace to something you actually found.',
    'Output STRICT JSON only — no markdown, no prose, no code fences.',
    '',
    'Schema:',
    '{',
    '  "company_name": string,',
    '  "domain": string (bare domain, e.g. "scalex.club"),',
    '  "essence": "1-2 sentences: what this company\'s frequency reads as overall",',
    '  "facts": { "industry": string, "headcount": string, "hq": string, "founded": string, "funding": string },',
    '  "dimensions": {',
    '    "<dim_key>": {',
    '      "level": "3-6 word descriptor",',
    '      "summary": "2-3 sentence read grounded in what you found, hedged",',
    '      "confidence": "low|medium",',
    '      "evidence": "the specific signal you found AND where (e.g. \'Glassdoor reviews: \"not micromanaged\"\')",',
    '      "needs_validation": boolean',
    '    }, ... ALL 12 keys ...',
    '  },',
    '  "needs_validation": ["dim_keys still weakly supported even after research — usually 2-5"],',
    '  "unvalidated_claims": ["2-4 specific inferences that still need confirmation from inside the company"],',
    '  "tensions": [',
    '    { "dimension": "<dim_key>", "claim": "what the company says about itself", "counter_signal": "what other sources suggest",',
    '      "interpretation": "how to read the gap, neutrally", "severity": "minor|moderate|major" }',
    '  ],',
    '  "sources": [ { "type": "company_website|careers_page|linkedin|employee_reviews|news|company_database|press|other", "title": string, "url": string } ],',
    '  "people_metrics": {',
    '    "glassdoor_rating": "e.g. 3.9 — empty string if no public rating", "glassdoor_reviews": "e.g. 212",',
    '    "ambitionbox_rating": "e.g. 4.1 (India) — empty if none",',
    '    "recommend_pct": "e.g. 78 (percent who recommend to a friend)", "ceo_approval_pct": "e.g. 86",',
    '    "headcount": "employee count as a number or band ONLY, e.g. 140 or 51-200 — empty if unknown; NO sentences",',
    '    "headcount_growth": "VERY short, one token: +34% YoY, growing, flat, or shrinking — NO sentences or parentheticals",',
    '    "open_roles": "the NUMBER of current open job postings as digits only, e.g. 12 — empty string if unknown; NEVER words like \'numerous\' and NEVER a list of role titles",',
    '    "attrition_signal": "DIRECTIONAL only, grounded in review wording or headcount trend (e.g. \'elevated — reviews cite high turnover\', \'low\', or \'unclear from public data\')",',
    '    "top_pros": ["2-4 recurring positives quoted/paraphrased from employee reviews"],',
    '    "top_cons": ["2-4 recurring negatives from employee reviews"]',
    '  }',
    '}',
    '',
    'The 12 dim_keys (use EXACTLY these): ' + DIM_KEYS.join(', ') + '.',
    'Rules: confidence is "medium" where MULTIPLE sources agree, "low" where signal is thin — never "high"',
    '(inside validation has not happened). needs_validation true only for genuinely weak dimensions, not all.',
    'Find at least one real "tension" if any exists (e.g. stated culture vs employee reviews). List the actual',
    'sources you used (real URLs). If you truly cannot find a company, return the schema with low confidence',
    'everywhere and say so in essence.',
    'For people_metrics: search Glassdoor, AmbitionBox, Indeed, LinkedIn and job boards. Leave ANY field an empty',
    'string if it is not public. NEVER invent exact attrition or hiring percentages — they are almost never',
    'published; express attrition only as a directional signal from review language or headcount trend. top_pros',
    'and top_cons must be real recurring themes from actual reviews, not guesses.',
  ].join('\n');
}

// Hard ceiling on a single research so a huge/ambiguous query (e.g. "amazon")
// can never hang the request. Gemini 2.5 Pro deep research is slower than Flash,
// so this is generous — but still under Cloud Run's 300s request limit.
const RESEARCH_TIMEOUT_MS = 240000;
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(label || 'timeout')), ms)),
  ]);
}

// Run the live grounded research. Always resolves (never throws) — on failure it
// returns a minimal profile flagged with _error so the caller can refuse to publish.
// `context` is what the visitor typed in the runtime (their mission/goal/
// obstacles) — used as a lead, then corroborated against the live web.
export async function runResearch(name, url, context = '') {
  const userMsg =
    'COMPANY: ' + name + '\n' +
    (url ? 'WEBSITE: ' + url + '\n' : '') +
    (context ? '\nWHAT THE ORGANIZATION TOLD US (a lead — corroborate against the web, do not just repeat it):\n' + context + '\n' : '') +
    '\nResearch this company on the web now, then produce the JSON profile.';
  try {
    const { text, queries, sources } = await withTimeout(completeGrounded({
      system: researchSystemPrompt(),
      messages: [{ role: 'user', content: userMsg }],
    }), RESEARCH_TIMEOUT_MS, 'research_timeout');
    const prof = clean(parseJson(text));
    prof._searchQueries = queries || [];
    prof._groundingSources = sources || [];
    return prof;
  } catch (err) {
    return {
      company_name: name,
      domain: host(url),
      essence: 'A profile could not be assembled from public signal at this time.',
      dimensions: {},
      needs_validation: DIM_KEYS.slice(),
      unvalidated_claims: [],
      tensions: [],
      sources: [],
      _error: String(err.message || err).slice(0, 200),
    };
  }
}

// Shape a research result into the of.runtime.v1 store the company page reads.
export function buildStore(name, url, prof, stage = 2) {
  const rid = 'pub_' + slugify(name);
  const oid = 'org_' + slugify(name);
  const needs = new Set(prof.needs_validation || []);

  const dims = {};
  for (const [k] of DIMS) {
    const d = (prof.dimensions && prof.dimensions[k]) || {};
    dims[k] = {
      level: d.level || 'unclear from public signal',
      summary: d.summary || 'Public material does not yet speak clearly to this dimension.',
      evidence: d.evidence ? [d.evidence] : [],
      confidence: d.level ? (d.confidence === 'medium' ? 'medium' : 'low') : 'none',
      needs_validation: needs.has(k) || !d.level,
    };
  }

  // Sources: prefer the model's explicit list; fall back to what it grounded on.
  let sources = (prof.sources || [])
    .filter((s) => s && (s.url || s.title))
    .map((s) => ({ source_type: s.type || 'other', source_title: s.title || s.url, source_url: s.url || '' }));
  if (!sources.length && Array.isArray(prof._groundingSources)) {
    sources = prof._groundingSources.map((s) => ({ source_type: 'web', source_title: s.title || s.uri, source_url: s.uri || '' }));
  }
  if (!sources.length) sources = [{ source_type: 'company_website', source_title: name + ' — website', source_url: url }];

  // Tensions → contradictions the page can render.
  const contradictions = (prof.tensions || [])
    .filter((t) => t && (t.claim || t.counter_signal))
    .map((t, i) => ({
      contradiction_id: 'ct_' + slugify(name) + '_' + i,
      research_id: rid,
      dimension: t.dimension || '',
      claim: t.claim || '',
      counter_signal: t.counter_signal || '',
      interpretation: t.interpretation || '',
      severity: ['minor', 'moderate', 'major'].includes(t.severity) ? t.severity : 'moderate',
    }));

  // Map the requested stage onto the org record that frequency/company.js's
  // orgStage() reads: a non-empty preliminary_frequency → Stage 2 (Tier-0); a
  // non-empty living_frequency → Stage 3 (Deep discovery); living dims marked
  // "validated" → Stage 4 (Validated with the organization).
  const organizations = [];
  if (stage >= 2) {
    const org = {
      organization_id: oid,
      organization_name: name,
      preliminary_frequency: { dimensions: DIMS.map(([k, lbl]) => ({ key: k, name: lbl, source: 'tier0_research' })) },
    };
    if (stage >= 3) {
      org.living_frequency = {
        dimensions: DIMS.map(([k, lbl]) => ({ key: k, name: lbl, source: stage >= 4 ? 'validated' : 'discovery' })),
      };
    }
    organizations.push(org);
  }

  return {
    pub_estimates: [{
      estimate_id: 'est_' + slugify(name),
      research_id: rid,
      company_name: name,
      dimensions: dims,
      confidence_reasoning: prof.essence || '',
      needs_validation: prof.needs_validation || [],
      unvalidated_claims: prof.unvalidated_claims || [],
      facts: prof.facts || {},
      people_metrics: prof.people_metrics || null,
      limited_material: false,
    }],
    pub_pages: [{
      page_id: 'pg_' + slugify(name),
      research_id: rid,
      slug: slugify(name) + '-organizational-frequency',
      company_name: name,
      status: 'ready_for_review',
    }],
    pub_research: [{
      research_id: rid,
      company_name: name,
      website_url: url,
      discovered_domain: prof.domain || host(url),
      source_inventory: sources,
    }],
    pub_contradictions: contradictions,
    organizations,
    missions: [],
  };
}

// ---- Firestore persistence ------------------------------------------------
export async function saveCompanyProfile({ slug, name, domain, url, store, stage, sessionId, research }) {
  const id = slug;
  const ref = db.collection(COLLECTIONS.companyProfiles).doc(id);
  const snap = await ref.get();
  const now = new Date();
  const data = {
    slug, name, domain: domain || '', url: url || '',
    store, stage: stage || 2,
    sessionId: sessionId || '',
    research: research || null,
    updatedAt: now,
  };
  if (!snap.exists) data.createdAt = now;
  await ref.set(data, { merge: true });
  return { slug, url: '/frequency/company/' + slug };
}

export async function getCompanyProfile(slug) {
  const snap = await db.collection(COLLECTIONS.companyProfiles).doc(slug).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

export async function listCompanyProfiles(limit = 200) {
  const snap = await db.collection(COLLECTIONS.companyProfiles).orderBy('updatedAt', 'desc').limit(limit).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ---- Render the company.html template with this company's data ------------
// The page is served one level deeper (/frequency/company/<slug>) than the
// template (/frequency/company.html), so inject <base href="/frequency/"> to
// keep every relative asset path (company.js, ../favicon.png, ./) resolving.
export function renderCompanyPage(template, { name, domain, slug }, store) {
  const fileslug = slug;
  let html = template
    .split('Helio&nbsp;Robotics').join(name)
    .split('Helio Robotics').join(name)
    .split('heliorobotics.com').join(domain || host(''))
    .split('https://vinaypasricha.com/frequency/company').join('https://vinaypasricha.com/frequency/company/' + fileslug);

  // <base> so deeper URL keeps relative paths working.
  html = html.replace('<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <base href="/frequency/">');

  // Runtime-generated pages are shareable by link but not search-indexed.
  html = html.replace('<meta name="robots" content="index, follow, max-image-preview:large">',
    '<meta name="robots" content="noindex, nofollow">');

  // Inject the baked data right before company.js loads.
  const inject =
    '  <script>window.__OF_COMPANY_DATA__ = ' + JSON.stringify(JSON.stringify(store)) + ';</script>\n' +
    '  <script src="company.js"></script>';
  html = html.replace('  <script src="company.js"></script>', inject);

  return html;
}
