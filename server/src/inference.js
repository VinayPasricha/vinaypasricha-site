// inference.js — the thin, provider-swappable AI adapter.  *** Stage 1's first AI call. ***
// The reconciliation pass and the sweeper both generate essence from raw turns, which is a
// language-model call. ONE provider behind ONE file (v1 §9). Swap the body of `complete()`
// to change providers; nothing else in the server changes. Expect small model bills here.

const PROVIDER = process.env.INFERENCE_PROVIDER || 'local-stub';

// Replace this with a real call (OpenAI/Anthropic/self-hosted) — keep the signature.
async function callProvider(prompt) {
  if (PROVIDER === 'local-stub') {
    // Deterministic offline stub so acceptance tests run with no vendor/network.
    // Mirrors the lab's deriveSummary so server essence matches client shape.
    return null; // signal: caller uses local heuristic
  }
  // TODO: real provider, e.g.
  //   const r = await fetch(PROVIDER_URL, { method:'POST', headers:{...}, body: JSON.stringify({ prompt }) });
  //   return (await r.json()).text;
  throw new Error('inference provider not configured: ' + PROVIDER);
}

// Generate a conversation_summary `content` object from raw turns.
export async function summariseTurns(turns, endedBy) {
  const userTurns = turns.filter(t => t.role === 'user');
  const ai = await callProvider(buildSummaryPrompt(turns));
  if (ai) {
    return { summary: ai.slice(0, 1200), surprise: userTurns.length >= 4 ? 'high' : userTurns.length >= 2 ? 'low' : 'none',
      open_questions: [], turn_count: turns.length, duration_seconds: 0, ended_by: endedBy || 'explicit' };
  }
  // local heuristic fallback (parity with js/memory.js deriveSummary)
  const joined = userTurns.map(t => t.text).join(' ').replace(/\s+/g, ' ').trim();
  return {
    summary: joined ? ('Conversation covered: ' + joined.slice(0, 360)) : 'Brief session; no substantive content.',
    surprise: userTurns.length >= 4 ? 'high' : userTurns.length >= 2 ? 'low' : 'none',
    open_questions: [], turn_count: turns.length, duration_seconds: 0, ended_by: endedBy || 'explicit'
  };
}

function buildSummaryPrompt(turns) {
  return 'Summarise this conversation into a faithful ~150-word essence. Record only what is new or '
    + 'surprising; do not invent facts.\n\n' + turns.map(t => t.role.toUpperCase() + ': ' + t.text).join('\n');
}
