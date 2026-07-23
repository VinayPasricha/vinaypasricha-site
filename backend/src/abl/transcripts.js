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

export function normaliseTranscriptAnalysis(input = {}) {
  return {
    overview: String(input.overview || '').trim().slice(0, 1800),
    company_context: list(input.company_context),
    business_challenges: list(input.business_challenges),
    course_objectives: list(input.course_objectives),
    ai_opportunities: list(input.ai_opportunities),
    decisions: list(input.decisions),
    concerns_constraints: list(input.concerns_constraints),
    commitments: list(input.commitments),
    next_actions: list(input.next_actions),
  };
}

export function transcriptSummaryMarkdown(analysis = {}) {
  const a = normaliseTranscriptAnalysis(analysis);
  const sections = [
    ['Company context and corrections', a.company_context],
    ['Main business challenges', a.business_challenges],
    ['Course objectives', a.course_objectives],
    ['Possible AI opportunities', a.ai_opportunities],
    ['Decisions made', a.decisions],
    ['Concerns and constraints', a.concerns_constraints],
    ['Commitments', a.commitments],
    ['Next actions', a.next_actions],
  ];
  const lines = ['## Meeting overview', a.overview || 'No concise overview was established.'];
  for (const [title, values] of sections) {
    lines.push('', `## ${title}`);
    lines.push(...(values.length ? values.map((value) => `- ${value}`) : ['- Not established in this meeting.']));
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
    system: `You turn a private one-on-one meeting transcript into factual course context for AI for Business Leaders.
Use only statements grounded in the transcript. Do not infer missing facts or turn suggestions into decisions.
Distinguish what was discussed from what was actually agreed. Keep every item concise and useful in later participant conversations.
Return strict JSON only with these keys:
{"overview":"short factual summary","company_context":["..."],"business_challenges":["..."],"course_objectives":["..."],"ai_opportunities":["..."],"decisions":["..."],"concerns_constraints":["..."],"commitments":["..."],"next_actions":["..."]}`,
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
