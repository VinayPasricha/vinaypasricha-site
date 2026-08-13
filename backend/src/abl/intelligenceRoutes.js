// Private AI research for Vinay Studio: one agent per participant and one across the course directory.
import { completeGrounded, completeModel } from '../services/ai.js';
import { extractJson } from './json.js';
import * as repo from './store.js';
import { db, COLLECTIONS } from '../firestore.js';

// Resolve cohort UUIDs to their human names so the agent can reason about
// "Cohort 1", counts per batch, etc. instead of opaque ids.
async function cohortNameMap() {
  try {
    const snap = await db.collection(COLLECTIONS.ablCohorts).get();
    const map = {};
    snap.forEach((d) => { map[d.id] = (d.data() || {}).name || d.id; });
    return map;
  } catch (e) { return {}; }
}

const MODEL = process.env.ABL_CHAT_MODEL || process.env.VERTEX_MODEL || 'gemini-2.5-flash';
// Flash shares its internal "thinking" budget with maxOutputTokens, so an
// undisabled thinking pass can consume the whole budget and truncate the answer
// mid-sentence. Turn it off for Flash the same way service.js does.
const NO_THINK = /flash/i.test(MODEL) ? { thinkingConfig: { thinkingBudget: 0 } } : {};
const GLOBAL_ID = '__abl_course_intelligence__';
const nowISO = () => new Date().toISOString();
const clean = (value, max = 12000) => String(value == null ? '' : value).trim().slice(0, max);
const ok = (res, data, code = 200) => res.status(code).json({ ok: true, data });
const fail = (res, error, code = 400) => res.status(code).json({ ok: false, error });

async function mapLimit(items, limit, mapper) {
  const rows = Array.isArray(items) ? items : [];
  const output = new Array(rows.length);
  let cursor = 0;
  async function worker() {
    while (cursor < rows.length) {
      const index = cursor++;
      output[index] = await mapper(rows[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), rows.length || 1) }, worker));
  return output;
}
function sourceList(sources) {
  return (Array.isArray(sources) ? sources : []).slice(0, 10).map((s) => ({
    title: clean(s && s.title, 240), uri: clean(s && s.uri, 1200),
  })).filter((s) => s.title || s.uri);
}
function messageView(message) {
  return {
    id: message.id, role: message.role, content: message.content,
    sources: sourceList(message.metadata && message.metadata.sources),
    grounded: !!(message.metadata && message.metadata.grounded),
    matches: (message.metadata && message.metadata.matches) || [],
    created_at: message.created_at,
  };
}
async function thread(participantId, mode) {
  const session = await repo.getOrCreateSession(participantId, mode);
  const messages = (await repo.listMessages(session.id))
    .filter((m) => ['admin', 'assistant'].includes(m.role)).map(messageView);
  return { session, messages };
}
function recentConversation(messages, limit = 8) {
  return (messages || []).slice(-limit).map((message) => ({
    role: message.role === 'assistant' ? 'assistant' : 'user',
    content: clean(message.content, 3500),
  }));
}
function latestOutput(outputs, type) {
  return (outputs || []).filter((o) => o.output_type === type)
    .sort((a, b) => String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || '')))[0] || null;
}
function evidenceText(value, max) {
  if (Array.isArray(value)) return clean(value.join(' · '), max);
  if (value && typeof value === 'object') return clean(JSON.stringify(value), max);
  return clean(value, max);
}
async function compactParticipantEvidence(participant) {
  const [research, memory, notes, outputs] = await Promise.all([
    repo.getResearch(participant.id), repo.getMemory(participant.id),
    repo.listNotes(participant.id), repo.getOutputs(participant.id),
  ]);
  const snapshot = latestOutput(outputs, 'admin_participant_snapshot');
  return [
    `PROFILE: ${participant.name || ''} · ${participant.company_name || ''} · ${participant.role_title || ''} · ${participant.industry || ''} · ${participant.geography || ''} · cohort=${participant.cohort_id || 'unassigned'}`,
    `RESEARCH: ${evidenceText(research && research.structured_context, 1300)} · ${evidenceText(research && research.research_dossier, 1600)}`,
    `COURSE MEMORY: ${evidenceText(memory && memory.fields, 1200)}`,
    snapshot ? `ADMIN SNAPSHOT: ${evidenceText(snapshot.reviewed_content_markdown || snapshot.content_markdown, 2200)}` : '',
    !snapshot && notes.length ? `RECENT NOTES: ${notes.slice(0, 3).map((n) => clean(n.content, 850)).join(' · ')}` : '',
  ].filter(Boolean).join('\n\n');
}
async function participantEvidence(participant) {
  const [research, memory, notes, assets, outputs, sessions] = await Promise.all([
    repo.getResearch(participant.id), repo.getMemory(participant.id), repo.listNotes(participant.id),
    repo.listAssets(participant.id), repo.getOutputs(participant.id), repo.listSessions(participant.id),
  ]);
  const snapshot = latestOutput(outputs, 'admin_participant_snapshot');
  const conversations = await mapLimit(
    sessions.filter((s) => s.mode !== 'admin_research').slice(0, 8),
    4,
    async (session) => {
      const messages = await repo.listMessages(session.id);
      return `[${session.mode}] ` + messages.filter((m) => ['user', 'assistant'].includes(m.role)).slice(-12)
        .map((m) => `${m.role}: ${clean(m.content, 1800)}`).join('\n');
    },
  );
  return [
    `PROFILE: ${participant.name || ''} · ${participant.company_name || ''} · ${participant.role_title || ''} · ${participant.industry || ''} · ${participant.geography || ''} · cohort=${participant.cohort_id || 'unassigned'}`,
    `RESEARCH FIELDS: ${evidenceText(research && research.structured_context, 7000)}`,
    `RESEARCH DOSSIER: ${evidenceText(research && research.research_dossier, 9000)}`,
    `COURSE MEMORY: ${evidenceText(memory && memory.fields, 9000)}`,
    snapshot ? `ADMIN SNAPSHOT: ${evidenceText(snapshot.reviewed_content_markdown || snapshot.content_markdown, 10000)}` : '',
    `MEETING NOTES: ${notes.slice(0, 12).map((n) => `[${n.title || 'Meeting'} | ${n.occurred_at || ''} | ${n.review_status || ''}] ${clean(n.content || n.raw_transcript, 5000)}`).join('\n')}`,
    `UPLOADED REFERENCES: ${assets.slice(0, 12).map((a) => `[${a.title || a.file_name || 'File'}] ${clean(a.extracted_text || a.description, 3500)}`).join('\n')}`,
    `COURSE CONVERSATIONS: ${conversations.join('\n\n')}`,
    `COURSE OUTPUTS: ${outputs.filter((o) => o.output_type !== 'admin_participant_snapshot').slice(0, 10)
      .map((o) => `[${o.output_type}] ${clean(o.reviewed_content_markdown || o.content_markdown, 5000)}`).join('\n')}`,
  ].filter(Boolean).join('\n\n');
}
async function appendResearchFinding(participantId, question, publicText, sources) {
  if (!clean(publicText)) return;
  const current = await repo.getResearch(participantId);
  const stamp = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const links = sourceList(sources).map((s) => s.uri || s.title).filter(Boolean).join(', ');
  const block = `\n\n### Follow-up research · ${stamp}\n**Question:** ${clean(question, 1200)}\n\n${clean(publicText, 7000)}${links ? `\n\n**Sources:** ${links}` : ''}`;
  await repo.upsertResearch(participantId, {
    structured_context: (current && current.structured_context) || {},
    research_dossier: clean(((current && current.research_dossier) || '') + block, 30000),
    sources_notes: clean([current && current.sources_notes, links ? `Follow-up sources (${stamp}): ${links}` : ''].filter(Boolean).join('\n'), 15000),
  });
}
function publicResearchPrompt(participant, question) {
  // Intentionally public-only: no meeting notes, course memory or private thread text
  // is sent to the Google Search-grounded request.
  return `PERSON: ${participant.name || ''}\nROLE: ${participant.role_title || ''}\nCOMPANY: ${participant.company_name || ''}\nOFFICIAL WEBSITE: ${participant.company_website || ''}\nQUESTION: ${question}`;
}
async function askParticipant(participant, question, useWeb, history) {
  let publicResult = { text: '', sources: [], grounded: false };
  if (useWeb) {
    publicResult = await completeGrounded({
      system: `You are a careful corporate researcher. Research only the named person and company in the user message. Resolve identity using the official company/domain. Answer the exact question with current public facts. Do not use private assumptions. Distinguish company-wide facts from facts about subsidiaries, brands or promoters. If turnover or ownership is not publicly available, say so. Be concise and evidence-led.`,
      messages: [{ role: 'user', content: publicResearchPrompt(participant, question) }],
    });
  }
  const internal = await participantEvidence(participant);
  const sources = sourceList(publicResult.sources);
  const answerMessages = recentConversation(history).concat([{
    role: 'user', content: `CURRENT QUESTION\n${question}\n\nPRIVATE COURSE EVIDENCE\n${internal}\n\nPUBLIC WEB RESEARCH\n${clean(publicResult.text, 14000) || '(not requested or unavailable)'}\n\nPUBLIC SOURCES\n${JSON.stringify(sources)}`,
  }]);
  const answer = await completeModel({
    model: MODEL, generationConfig: { maxOutputTokens: 4000, temperature: 0.2, ...NO_THINK },
    system: `You are Vinay Pasricha's private participant research analyst in an ongoing conversation. Answer the latest question using the supplied private course evidence, recent thread context and any separately supplied public web research. Never invent. Use these headings only when relevant: **Answer**, **What the private record says**, **What public research adds**, **What remains unknown**, **Useful next question**. Label any commercial-interest judgement as an inference, not a fact. Do not expose unrelated private details.`,
    messages: answerMessages,
  });
  return { answer, publicText: publicResult.text || '', grounded: !!publicResult.grounded && sources.length > 0, sources };
}

function tokens(query) {
  const aliases = {
    gurugram: ['gurugram','gurgaon'], gurgaon: ['gurugram','gurgaon'],
    recruit: ['recruit','recruitment','hiring','hire','talent','vacancy','workforce'],
    hiring: ['recruit','recruitment','hiring','hire','talent','vacancy','workforce'],
    marriage: ['marriage','wedding','matrimony','event'], wedding: ['marriage','wedding','matrimony','event'],
  };
  const base = clean(query, 2000).toLowerCase().match(/[a-z0-9₹]+/g) || [];
  return Array.from(new Set(base.flatMap((token) => aliases[token] || [token]).filter((token) => token.length > 2)));
}
function lexicalScore(record, queryTokens) {
  const text = record.text.toLowerCase();
  return queryTokens.reduce((score, token) => score + (text.includes(token) ? (token.length > 7 ? 3 : 1) : 0), 0);
}
async function compactDirectory(participants) {
  return mapLimit(participants, 8, async (participant) => ({
    id: participant.id, name: participant.name, company: participant.company_name,
    cohort_id: participant.cohort_id || null, geography: participant.geography || '',
    text: await compactParticipantEvidence(participant),
  }));
}
function chunks(items, size) {
  const out = [];
  for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size));
  return out;
}
async function selectFromBatch(batch, question) {
  const raw = await completeModel({
    model: MODEL, generationConfig: { maxOutputTokens: 1400, temperature: 0.1 },
    system: `Select every participant record in this batch that may be relevant to the administrator's question. Return strict JSON only: {"candidate_ids":["id"],"reason_by_id":{"id":"short evidence-based reason"}}. Do not infer facts not present in a record. For possible commercial interest, include supported records and records needing confirmation, but state which.`,
    messages: [{ role: 'user', content: `QUESTION: ${question}\n\nTHIS DIRECTORY BATCH:\n${JSON.stringify(batch.map((record) => ({ id:record.id,name:record.name,company:record.company,cohort_id:record.cohort_id,geography:record.geography,evidence:clean(record.text,2200) })))}` }],
  });
  const parsed = extractJson(raw) || {};
  const allowed = new Set(batch.map((record) => String(record.id)));
  return {
    ids: (Array.isArray(parsed.candidate_ids) ? parsed.candidate_ids : []).map(String).filter((id) => allowed.has(id)),
    reasons: parsed.reason_by_id || {},
  };
}
async function selectCandidates(records, question) {
  const queryTokens = tokens(question);
  const ranked = records.map((record) => ({ ...record, score: lexicalScore(record, queryTokens) }))
    .sort((a, b) => b.score - a.score);
  // Every record is shown to one selector batch. Lexical ranking improves batch order;
  // it never excludes participants from an all-course count.
  const selections = await mapLimit(chunks(ranked, 28), 2, (batch) => selectFromBatch(batch, question));
  const ids = [];
  const reasons = {};
  selections.forEach((selection) => {
    selection.ids.forEach((id) => { if (!ids.includes(id)) ids.push(id); });
    Object.assign(reasons, selection.reasons || {});
  });
  if (!ids.length) ranked.filter((record) => record.score > 0).slice(0, 20).forEach((record) => ids.push(String(record.id)));
  return { ids: ids.slice(0, 50), reasons };
}
async function askDirectory(participants, question, history) {
  const records = await compactDirectory(participants);
  const cohorts = await cohortNameMap();
  const selected = await selectCandidates(records, question);
  const byId = new Map(participants.map((participant) => [String(participant.id), participant]));
  const selectedParticipants = selected.ids.map((id) => byId.get(id)).filter(Boolean);
  const detail = await mapLimit(selectedParticipants, 6, async (participant) => ({
    id: participant.id, name: participant.name, company: participant.company_name,
    cohort: cohorts[participant.cohort_id] || participant.cohort_id || 'unassigned',
    evidence: await participantEvidence(participant),
    reason: clean(selected.reasons[participant.id], 500),
  }));
  // The full roster of EVERY participant in scope, in compact form. This is the
  // authoritative list for any total, count or breakdown — the relevance-selected
  // detail below is only a subset for depth, and must never be treated as the whole.
  const roster = records.map((record) => {
    const cohort = cohorts[record.cohort_id] || record.cohort_id || 'unassigned';
    return `- ${record.name || '(no name)'} | ${record.company || '(company unknown)'} | cohort: ${cohort} | ${clean(record.text, 560)}`;
  }).join('\n');
  const messages = recentConversation(history, 6).concat([{
    role: 'user', content: `CURRENT QUESTION\n${question}\n\nPARTICIPANTS IN SCOPE (authoritative total): ${participants.length}\n\nFULL ROSTER — every participant in scope. Use THIS list for any count, total, per-cohort or per-industry breakdown. Do not shrink a total to the detailed subset below.\n${roster}\n\nDETAILED EVIDENCE — only the participants most relevant to the question, for depth:\n${JSON.stringify(detail)}`,
  }]);
  const answer = await completeModel({
    model: MODEL, generationConfig: { maxOutputTokens: 6000, temperature: 0.15, ...NO_THINK },
    system: `You are Vinay Pasricha's private course intelligence analyst in an ongoing conversation. Answer the latest cross-participant question only from the supplied private evidence and recent thread context. The FULL ROSTER lists EVERY participant in scope and is authoritative for totals, counts, and per-cohort or per-industry breakdowns — never report a total smaller than the "participants in scope" number unless the question itself narrows the set, and account for every roster entry (note ones with missing data rather than dropping them). Use the DETAILED EVIDENCE only for depth on specific people. Never invent or count an inference as confirmed. Where the question concerns possible commercial interest, classify people as Confirmed, Probable/inferred, or Insufficient evidence, with an exact count for each class, name the participants, and state the evidence type. Mention likely false positives and missing data. End with one practical follow-up action.`,
    messages,
  });
  return {
    answer,
    matches: detail.map((item) => ({
      id:item.id, name:item.name, company:item.company,
      cohort_id:item.cohort_id, reason:item.reason,
    })),
  };
}

export function registerIntelligenceRoutes(app, { requireAdmin, rateLimit }) {
  const participantLimit = rateLimit ? rateLimit({ windowMs: 60000, max: 20 }) : (req,res,next) => next();
  const cohortLimit = rateLimit ? rateLimit({ windowMs: 60000, max: 8 }) : (req,res,next) => next();

  app.get('/api/abl/intelligence/participants/:id/thread', requireAdmin, async (req, res) => {
    try {
      const participant = await repo.getParticipant(req.params.id);
      if (!participant) return fail(res, 'Participant not found', 404);
      return ok(res, {
        participant: { id:participant.id,name:participant.name,company_name:participant.company_name },
        ...(await thread(participant.id, 'admin_research')),
      });
    } catch (error) {
      console.error('[abl-intelligence] participant thread', error);
      return fail(res, 'Server error', 500);
    }
  });
  app.post('/api/abl/intelligence/participants/:id/ask', requireAdmin, participantLimit, async (req, res) => {
    try {
      const question = clean(req.body && req.body.question, 2400);
      if (!question) return fail(res, 'Ask a question first.');
      const participant = await repo.getParticipant(req.params.id);
      if (!participant) return fail(res, 'Participant not found', 404);
      const currentThread = await thread(participant.id, 'admin_research');
      const priorMessages = currentThread.messages.slice(-8);
      await repo.addMessage({ session_id:currentThread.session.id, participant_id:participant.id, role:'admin', content:question });
      const result = await askParticipant(participant, question, req.body && req.body.use_web !== false, priorMessages);
      await repo.addMessage({
        session_id:currentThread.session.id, participant_id:participant.id, role:'assistant',
        content:result.answer, metadata:{ sources:result.sources, grounded:result.grounded },
      });
      if (req.body && req.body.save_to_dossier && result.grounded) {
        await appendResearchFinding(participant.id, question, result.publicText, result.sources);
      }
      await repo.updateSession(currentThread.session.id, { updated_at: nowISO() });
      return ok(res, {
        answer:result.answer, sources:result.sources, grounded:result.grounded,
        saved_to_dossier:!!(req.body && req.body.save_to_dossier && result.grounded),
        messages:(await thread(participant.id,'admin_research')).messages,
      });
    } catch (error) {
      console.error('[abl-intelligence] participant ask', error);
      return fail(res, 'The participant research agent could not answer that question.', 500);
    }
  });

  app.get('/api/abl/intelligence/cohort/thread', requireAdmin, async (req, res) => {
    try { return ok(res, await thread(GLOBAL_ID, 'cohort_intelligence')); }
    catch (error) {
      console.error('[abl-intelligence] cohort thread', error);
      return fail(res, 'Server error', 500);
    }
  });
  app.post('/api/abl/intelligence/cohort/ask', requireAdmin, cohortLimit, async (req, res) => {
    try {
      const question = clean(req.body && req.body.question, 2400);
      if (!question) return fail(res, 'Ask a question first.');
      let participants = await repo.listParticipants();
      const cohortId = clean(req.body && req.body.cohort_id, 160);
      if (cohortId) participants = participants.filter((participant) => String(participant.cohort_id || '') === cohortId);
      const currentThread = await thread(GLOBAL_ID, 'cohort_intelligence');
      const priorMessages = currentThread.messages.slice(-6);
      await repo.addMessage({
        session_id:currentThread.session.id, participant_id:GLOBAL_ID, role:'admin',
        content:question, metadata:{ cohort_id:cohortId || null },
      });
      const result = await askDirectory(participants, question, priorMessages);
      await repo.addMessage({
        session_id:currentThread.session.id, participant_id:GLOBAL_ID, role:'assistant',
        content:result.answer, metadata:{ matches:result.matches, cohort_id:cohortId || null },
      });
      await repo.updateSession(currentThread.session.id, { updated_at: nowISO() });
      return ok(res, {
        answer:result.answer, matches:result.matches,
        messages:(await thread(GLOBAL_ID,'cohort_intelligence')).messages,
      });
    } catch (error) {
      console.error('[abl-intelligence] cohort ask', error);
      return fail(res, 'The course intelligence agent could not answer that question.', 500);
    }
  });
}
