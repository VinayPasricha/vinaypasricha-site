import { Storage } from '@google-cloud/storage';
import { completeWithinBudget } from './ai.js';
import { db, COLLECTIONS } from '../firestore.js';

const storage = new Storage();
const OBJECT = process.env.ABL_BOOK_OBJECT || 'book-knowledge/ai-for-business-leaders-second-edition.json';
const MAX_QUESTIONS = 20;
const MAX_TOKENS = 10000;
const PURCHASE_URL = 'https://www.amazon.in/dp/B0GFXXPGP7';
let cachedIndex = null;

function bucketName() {
  return String(
    process.env.ABL_BOOK_BUCKET ||
    process.env.MATERIALS_BUCKET ||
    process.env.ABL_UPLOAD_BUCKET ||
    'vinaypasricha-course-materials'
  ).trim();
}

function words(value) {
  return String(value || '').toLowerCase().match(/[a-z0-9][a-z0-9'-]{2,}/g) || [];
}

async function loadIndex() {
  if (cachedIndex) return cachedIndex;
  const bucket = bucketName();
  if (!bucket) throw new Error('Book knowledge is not configured');
  const [buffer] = await storage.bucket(bucket).file(OBJECT).download();
  const parsed = JSON.parse(buffer.toString('utf8'));
  if (!Array.isArray(parsed.chunks) || !parsed.chunks.length) throw new Error('Book knowledge is empty');
  cachedIndex = parsed;
  return parsed;
}

function retrieve(chunks, query, limit = 7) {
  const queryWords = words(query);
  const unique = [...new Set(queryWords)];
  return chunks
    .map((chunk) => {
      const haystack = ` ${String(chunk.heading || '').toLowerCase()} ${String(chunk.text || '').toLowerCase()} `;
      let score = 0;
      unique.forEach((term) => {
        const matches = haystack.split(term).length - 1;
        if (matches) score += Math.min(matches, 6) * (term.length > 7 ? 2 : 1);
        if (String(chunk.heading || '').toLowerCase().includes(term)) score += 5;
      });
      return { chunk, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.chunk);
}

function limitError(message = 'This conversation has reached its free limit.') {
  const err = new Error(message); err.code = 'BOOK_LIMIT'; return err;
}

function validSessionId(value) {
  const id = String(value || '').trim();
  if (!/^[A-Za-z0-9_-]{16,100}$/.test(id)) throw new Error('A valid conversation is required');
  return id;
}

function parseAnswer(raw, question, sources) {
  const marker = /\n\s*<followups>([\s\S]*?)<\/followups>\s*$/i;
  const match = String(raw || '').match(marker);
  let suggestions = [];
  if (match) {
    try { suggestions = JSON.parse(match[1]); } catch (_) {}
  }
  suggestions = suggestions.filter((q) => typeof q === 'string' && q.trim()).slice(0, 5);
  const heading = sources[0]?.heading || 'the Company Brain framework';
  const fallback = [
    `How would ${heading} apply inside my company?`,
    `What would the book caution me against here?`,
    `What is the first practical step after ${question.slice(0, 70)}?`,
    `Which Company Brain component is most relevant to this?`,
    `What evidence would show that this is working?`,
  ];
  while (suggestions.length < 5) suggestions.push(fallback[suggestions.length]);
  return { answer: String(raw || '').replace(marker, '').trim(), suggestions };
}

export async function askBook({ question, history = [], sessionId } = {}) {
  const cleanQuestion = String(question || '').trim().slice(0, 2000);
  if (!cleanQuestion) throw new Error('A question is required');
  const id = validSessionId(sessionId);
  const ref = db.collection(COLLECTIONS.bookCompanionSessions).doc(id);
  const state = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? snap.data() : {};
    const questionCount = Number(current.questionCount || 0);
    const tokenCount = Number(current.tokenCount || 0);
    if (questionCount >= MAX_QUESTIONS || tokenCount >= MAX_TOKENS) throw limitError();
    const lockAge = Date.now() - Number(current.lockedAt || 0);
    if (current.inFlight && lockAge < 120000) throw new Error('Please wait for the current answer');
    tx.set(ref, { questionCount, tokenCount, inFlight: true, lockedAt: Date.now(), updatedAt: new Date().toISOString() }, { merge: true });
    return { questionCount, tokenCount };
  });
  const index = await loadIndex();
  const recent = (Array.isArray(history) ? history : []).slice(-4);
  const contextQuery = recent.map((m) => m?.content || '').join(' ') + ' ' + cleanQuestion;
  const sources = retrieve(index.chunks, contextQuery, 3);
  const evidence = sources.map((s, i) =>
    `[Source ${i + 1} | ${s.heading || 'Book'} | pages ${s.pageStart}-${s.pageEnd}]\n${s.text}`
  ).join('\n\n');
  try {
    const result = await completeWithinBudget({
    tokenBudget: MAX_TOKENS - state.tokenCount,
    maxOutputTokens: 650,
    system: `You are the official reading companion for Vinay Pasricha's book AI for Business Leaders (Second Edition). Answer only from the supplied book excerpts. Explain the argument clearly and practically, but do not pretend to be Vinay. If the excerpts do not support an answer, say: "The book does not establish that clearly." Never invent a quotation, example, statistic, chapter, or page. Quote sparingly. End with "From the book:" and the relevant heading and page range. Then add exactly five brief, context-specific questions the reader could ask next as a JSON array inside <followups>...</followups>. The five questions must respond to the current exchange and must not be generic or repeated.`,
    messages: [
      ...recent.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '').slice(0, 1200) })),
      { role: 'user', content: `BOOK EXCERPTS\n${evidence}\n\nREADER QUESTION\n${cleanQuestion}` },
    ],
  });
    const used = Math.max(1, Number(result.usage?.totalTokens || 0));
    const nextState = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref); const current = snap.data() || {};
      const questionCount = Math.min(MAX_QUESTIONS, Number(current.questionCount || 0) + 1);
      const tokenCount = Math.min(MAX_TOKENS, Number(current.tokenCount || 0) + used);
      tx.set(ref, { questionCount, tokenCount, inFlight: false, updatedAt: new Date().toISOString() }, { merge: true });
      return { questionCount, tokenCount };
    });
    const parsed = parseAnswer(result.text, cleanQuestion, sources);
  return {
    answer: parsed.answer,
    suggestions: parsed.suggestions,
    sources: sources.slice(0, 4).map((s) => ({ heading: s.heading || 'AI for Business Leaders', pageStart: s.pageStart, pageEnd: s.pageEnd })),
    edition: index.edition || 'Second Edition',
    limits: { questionsUsed: nextState.questionCount, questionsMax: MAX_QUESTIONS, tokensUsed: nextState.tokenCount, tokensMax: MAX_TOKENS, locked: nextState.questionCount >= MAX_QUESTIONS || nextState.tokenCount >= MAX_TOKENS, purchaseUrl: PURCHASE_URL },
  };
  } catch (err) {
    await ref.set({ inFlight: false, updatedAt: new Date().toISOString() }, { merge: true }).catch(() => {});
    throw err;
  }
}
