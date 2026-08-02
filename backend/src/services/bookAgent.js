import { Storage } from '@google-cloud/storage';
import { complete } from './ai.js';

const storage = new Storage();
const OBJECT = process.env.ABL_BOOK_OBJECT || 'book-knowledge/ai-for-business-leaders-second-edition.json';
let cachedIndex = null;

function bucketName() {
  return String(
    process.env.ABL_BOOK_BUCKET ||
    process.env.MATERIALS_BUCKET ||
    process.env.ABL_UPLOAD_BUCKET ||
    ''
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

export async function askBook({ question, history = [] } = {}) {
  const cleanQuestion = String(question || '').trim().slice(0, 2000);
  if (!cleanQuestion) throw new Error('A question is required');
  const index = await loadIndex();
  const recent = (Array.isArray(history) ? history : []).slice(-6);
  const contextQuery = recent.map((m) => m?.content || '').join(' ') + ' ' + cleanQuestion;
  const sources = retrieve(index.chunks, contextQuery);
  const evidence = sources.map((s, i) =>
    `[Source ${i + 1} | ${s.heading || 'Book'} | pages ${s.pageStart}-${s.pageEnd}]\n${s.text}`
  ).join('\n\n');
  const answer = await complete({
    system: `You are the official reading companion for Vinay Pasricha's book AI for Business Leaders (Second Edition). Answer only from the supplied book excerpts. Explain the book's argument clearly and practically, but do not pretend to be Vinay. If the excerpts do not support an answer, say: "The book does not establish that clearly." Never invent a quotation, company example, statistic, chapter, or page. Quote sparingly. End with a short line beginning "From the book:" and cite the relevant heading and page range.`,
    messages: [
      ...recent.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '').slice(0, 3000) })),
      { role: 'user', content: `BOOK EXCERPTS\n${evidence}\n\nREADER QUESTION\n${cleanQuestion}` },
    ],
  });
  return {
    answer,
    sources: sources.slice(0, 4).map((s) => ({ heading: s.heading || 'AI for Business Leaders', pageStart: s.pageStart, pageEnd: s.pageEnd })),
    edition: index.edition || 'Second Edition',
  };
}
