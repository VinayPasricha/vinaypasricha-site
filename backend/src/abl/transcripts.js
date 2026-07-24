import mammoth from 'mammoth';
// Import the parser implementation directly: pdf-parse's package entry point
// runs its bundled demo file when imported outside a production install.
import pdf from 'pdf-parse/lib/pdf-parse.js';
import { completeModel } from '../services/ai.js';
import { extractJson } from './json.js';

const MAX_FILE_BYTES = 6 * 1024 * 1024;
const MAX_TRANSCRIPT_CHARS = 300_000;
const SUMMARY_MODEL = process.env.ABL_CHAT_MODEL || process.env.VERTEX_MODEL || 'gemini-2.5-flash';
const SUPPORTED_EXTENSIONS = ['txt', 'md', 'docx', 'pdf'];

function extension(name) {
  return String(name || '').toLowerCase().split('.').pop();
}

export function supportedTranscriptFile(name) {
  return SUPPORTED_EXTENSIONS.includes(extension(name));
}

function cleanTranscript(value) {
  return String(value || '')
    .replace(/\u0000/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function decodeBase64(value) {
  const source = String(value || '').replace(/^data:[^;]+;base64,/, '');
  if (!source || !/^[A-Za-z0-9+/=\s]+$/.test(source)) throw new Error('The uploaded transcript could not be read.');
  const buffer = Buffer.from(source, 'base64');
  if (!buffer.length || buffer.length > MAX_FILE_BYTES) throw new Error('Transcript files must be smaller than 6 MB.');
  return buffer;
}

export async function extractTranscript(input = {}) {
  let text = cleanTranscript(input.transcript_text);
  const sourceName = String(input.source_name || '').slice(0, 240);

  if (!text && input.file_base64) {
    if (!supportedTranscriptFile(sourceName)) throw new Error('Upload a .txt, .md, .docx or .pdf transcript.');
    const buffer = decodeBase64(input.file_base64);
    const ext = extension(sourceName);
    try {
      if (ext === 'docx') {
        const result = await mammoth.extractRawText({ buffer });
        text = cleanTranscript(result.value);
      } else if (ext === 'pdf') {
        const result = await pdf(buffer);
        text = cleanTranscript(result.text);
      } else {
        text = cleanTranscript(buffer.toString('utf8'));
      }
    } catch (error) {
      throw new Error(`The uploaded .${ext} transcript could not be read. Please check the file and try again.`);
    }
  }

  if (text.length < 40) throw new Error('The transcript appears to be empty or too short to process.');
  return {
    text: text.slice(0, MAX_TRANSCRIPT_CHARS),
    truncated: text.length > MAX_TRANSCRIPT_CHARS,
  };
}

function list(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 10);
  const one = String(value || '').trim();
  return one ? [one] : [];
}

// An action is only useful if it says who does it. Accept a bare string too:
// summaries written before actions carried an owner still have to render.
function action(item) {
  if (typeof item === 'string') {
    const text = item.trim();
    return text ? { owner: '', action: text, due: '' } : null;
  }
  if (!item || typeof item !== 'object') return null;
  const text = String(item.action || item.task || '').trim();
  if (!text) return null;
  return {
    owner: String(item.owner || '').trim().slice(0, 80),
    action: text.slice(0, 400),
    due: String(item.due || item.when || '').trim().slice(0, 80),
  };
}

function actionList(...sources) {
  const seen = new Set();
  const out = [];
  for (const source of sources) {
    for (const item of Array.isArray(source) ? source : []) {
      const parsed = action(item);
      if (!parsed) continue;
      // The same commitment used to appear under decisions, commitments and
      // next actions at once. Keep the first, richest phrasing of each.
      const key = parsed.action.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(parsed);
    }
  }
  return out.slice(0, 15);
}

export function normaliseTranscriptAnalysis(input = {}) {
  return {
    overview: String(input.overview || '').trim().slice(0, 1800),
    // `commitments` and `next_actions` are the pre-owner shape, folded in so
    // summaries stored before this change still render.
    actions: actionList(input.actions, input.commitments, input.next_actions),
    decisions: list(input.decisions),
    open_questions: list(input.open_questions),
    company_context: list(input.company_context),
    business_challenges: list(input.business_challenges),
    course_objectives: list(input.course_objectives),
    ai_opportunities: list(input.ai_opportunities),
    concerns_constraints: list(input.concerns_constraints),
  };
}

export function transcriptSummaryMarkdown(analysis = {}) {
  const a = normaliseTranscriptAnalysis(analysis);
  const lines = ['## Meeting overview', a.overview || 'No concise overview was established.'];

  // Who owes what comes first: this summary is read before the next meeting,
  // and an empty action list is itself worth seeing.
  lines.push('', '## Who does what next');
  lines.push(...(a.actions.length
    ? a.actions.map((item) => '- ' + (item.owner ? `**${item.owner}** — ` : '') + item.action + (item.due ? ` · _${item.due}_` : ''))
    : ['- Nothing was agreed as an action in this meeting.']));

  lines.push('', '## Decisions');
  lines.push(...(a.decisions.length ? a.decisions.map((value) => `- ${value}`) : ['- Nothing was settled in this meeting.']));

  // Context sections only appear when the meeting produced them — a run of
  // "Not established in this meeting" buries the parts that matter.
  const context = [
    ['Open questions', a.open_questions],
    ['Company context', a.company_context],
    ['Business challenges', a.business_challenges],
    ['Course objectives', a.course_objectives],
    ['AI opportunities', a.ai_opportunities],
    ['Concerns and constraints', a.concerns_constraints],
  ];
  for (const [title, values] of context) {
    if (!values.length) continue;
    lines.push('', `## ${title}`);
    lines.push(...values.map((value) => `- ${value}`));
  }
  return lines.join('\n').slice(0, 30_000);
}

export async function analyseTranscript({ participant, transcript }) {
  // Every model call in service.js routes its config through gcfg(), which
  // turns off Flash's internal thinking. This one did not, so the reasoning
  // was drawn from the same maxOutputTokens budget as the answer and a long
  // meeting could exhaust it mid-JSON. A full meeting also needs more room
  // than 3000 tokens across nine keys.
  const thinking = /flash/i.test(SUMMARY_MODEL) ? { thinkingConfig: { thinkingBudget: 0 } } : {};
  const raw = await completeModel({
    model: SUMMARY_MODEL,
    generationConfig: { temperature: 0.1, maxOutputTokens: 8000, ...thinking },
    system: `You turn a private one-on-one meeting transcript into a working brief for AI for Business Leaders. It is read just before the next meeting, so it must say what happens next, not merely record what was said.

Use only what the transcript supports. Never infer a fact, and never promote a suggestion into a decision — "we could look at X" is not a decision, "we will do X" is.

actions: everything someone committed to doing. Give each an owner named in the transcript, the action as a concrete verb phrase, and a due only if one was actually stated. Never invent a deadline. If a commitment names no owner, leave owner empty rather than guessing. Each commitment appears exactly once here — do not repeat it under decisions.
decisions: what was settled, as distinct from what someone will do about it. A decision changes the plan; an action carries it out.
open_questions: what was raised and left unresolved, and anything a decision now depends on.
company_context: durable facts about the business — model, scale, channels, systems, people. This is what later AI conversations rely on, so favour what stays true.
business_challenges: the constraints the leader is actually up against.
course_objectives: what this leader wants out of the course.
ai_opportunities: where AI could realistically help this specific business.
concerns_constraints: reservations, blockers and risks that would derail the above.

Leave an array empty when the meeting produced nothing for it. An empty array is more useful than a filler line. Keep each item to one sentence.

Never record any of the following, even though they appear in the transcript. This brief is fed to an AI that talks to the participant, so anything here can be repeated back to them:
- Family, health, personal life, travel or anything about their spouse, children or home. Where a family member is named as part of the business, record only their business role.
- Offhand opinions about products, vendors or people — especially anything dismissive said by either party. Record a tool only as a fact of what the business uses.
- Small talk, greetings, scheduling chatter and social plans.
- Anything said about a third party who is not in the meeting and not part of the business.
If a detail would embarrass either person when read back aloud in the next meeting, leave it out.

Return strict JSON only:
{"overview":"2-3 sentences: who, the business, and what the meeting concluded","actions":[{"owner":"name","action":"concrete verb phrase","due":"only if stated"}],"decisions":["..."],"open_questions":["..."],"company_context":["..."],"business_challenges":["..."],"course_objectives":["..."],"ai_opportunities":["..."],"concerns_constraints":["..."]}`,
    messages: [{
      role: 'user',
      content: `Participant: ${participant.name || 'Course participant'}\nCompany: ${participant.company_name || 'Not confirmed'}\nRole: ${participant.role_title || 'Not confirmed'}\n\nMEETING TRANSCRIPT\n${transcript}`,
    }],
  });
  const parsed = extractJson(raw);
  if (!parsed || typeof parsed !== 'object') {
    // Log what actually came back: "please try again" alone gives whoever is
    // looking at the server no way to tell a truncation from a refusal.
    console.error('[abl] transcript summary was not JSON —',
      `${raw.length} chars, transcript ${String(transcript || '').length} chars.`,
      'Start:', JSON.stringify(raw.slice(0, 200)),
      'End:', JSON.stringify(raw.slice(-200)));
    throw new Error('The transcript summary could not be generated. Please try again.');
  }
  return normaliseTranscriptAnalysis(parsed);
}

function keywords(value) {
  const stop = new Set(['about', 'after', 'again', 'also', 'and', 'are', 'been', 'before', 'but', 'can', 'could', 'did', 'does', 'for', 'from', 'have', 'into', 'just', 'more', 'not', 'our', 'that', 'the', 'their', 'then', 'they', 'this', 'was', 'were', 'what', 'when', 'where', 'which', 'will', 'with', 'would', 'you', 'your']);
  return new Set(String(value || '').toLowerCase().match(/[a-z0-9]{3,}/g)?.filter((word) => !stop.has(word)) || []);
}

export function relevantTranscriptPassages(notes, query, limit = 3) {
  const terms = keywords(query);
  if (!terms.size) return [];
  const rows = [];
  for (const note of notes || []) {
    if (note.visibility !== 'course_memory' || note.review_status === 'draft' || !note.raw_transcript) continue;
    const passages = String(note.raw_transcript).split(/\n{2,}|(?<=[.!?])\s+(?=[A-Z])/).map((part) => part.trim()).filter((part) => part.length >= 60);
    for (const passage of passages) {
      const words = keywords(passage);
      let score = 0;
      for (const term of terms) if (words.has(term)) score += 1;
      if (score) rows.push({ score, title: note.title || 'Meeting transcript', occurred_at: note.occurred_at, passage: passage.slice(0, 1400) });
    }
  }
  return rows.sort((a, b) => b.score - a.score || b.passage.length - a.passage.length).slice(0, limit);
}

export const transcriptLimits = { maxFileBytes: MAX_FILE_BYTES, maxTranscriptChars: MAX_TRANSCRIPT_CHARS };
