// ABL conversation + output engine, running on Vertex Gemini (the same AI the
// rest of vinaypasricha.com uses). Fast model for chat, Pro model for the long
// written documents.
import { completeModel, completeGrounded } from '../services/ai.js';
import { buildConversationSystem, buildOutputPrompt, buildSummaryPrompt, rewardTypeForDepth } from './prompts.js';
import * as repo from './store.js';

const CHAT_MODEL = process.env.ABL_CHAT_MODEL || process.env.VERTEX_MODEL || 'gemini-2.5-flash';
const DOC_MODEL = process.env.ABL_DOC_MODEL || process.env.VERTEX_RESEARCH_MODEL || 'gemini-2.5-pro';
const HISTORY_WINDOW = 16; // recent turns sent verbatim; older folded into running_summary

// Gemini 2.5 Flash can disable its internal "thinking" (thinkingBudget 0) for
// speed + no mid-reply truncation; Pro does NOT allow 0, so we only turn it off
// for Flash and leave Pro to think normally.
function gcfg(model, base) {
  return /flash/i.test(model || '') ? { ...base, thinkingConfig: { thinkingBudget: 0 } } : base;
}

// One conversational turn: the model returns JSON { say, options }. `say` is the
// message shown to the participant; `options` are up to 3 detailed, tailored
// answers they can click instead of typing. Falls back gracefully to plain text.
async function converse(system, messages) {
  const parse = (raw) => {
    const j = extractJson(raw) || {};
    const say = (typeof j.say === 'string' ? j.say : '').trim();
    const options = Array.isArray(j.options)
      ? j.options.filter((o) => typeof o === 'string' && o.trim()).map((o) => o.trim()).slice(0, 3)
      : [];
    return { say, options, raw };
  };
  const call = (msgs) => completeModel({
    system, messages: msgs, model: CHAT_MODEL,
    // Headroom so a longer reply + 3 detailed options can't truncate the JSON
    // mid-array (which would drop the options entirely).
    generationConfig: gcfg(CHAT_MODEL, { maxOutputTokens: 2000, temperature: 0.6 }),
  });

  let out = parse(await call(messages));

  // The participant UI always shows three clickable options. Retry once whenever
  // the first pass yielded fewer than 3 — this covers BOTH "valid JSON but a short
  // options array" AND "the model slipped into plain prose with no options at all"
  // (in which case `say` parsed empty). Bounded to a single retry so a stubborn
  // turn can't stall the conversation.
  if (out.options.length < 3) {
    const nudge = messages.concat([{
      role: 'user',
      content: 'Reply again as STRICT JSON only — {"say":"...","options":["...","...","..."]} — with no prose outside the JSON and no code fences. Keep the same message in "say". "options" MUST contain exactly 3 distinct, first-person answers this participant might click, even for a confirmation question (e.g. an affirmation, a partial correction, and a fuller correction).',
    }]);
    const retry = parse(await call(nudge));
    if (retry.options.length > out.options.length || (!out.say && retry.say)) {
      out = { say: retry.say || out.say, options: retry.options.length ? retry.options : out.options, raw: retry.raw };
    }
  }

  // Last-resort: if we still never got a JSON `say`, show the raw prose reply
  // rather than nothing — with whatever options (if any) we recovered.
  const say = out.say || String(out.raw || '').replace(/```json|```/g, '').trim();
  return { say, options: out.options };
}

export { rewardTypeForDepth };

export async function agentTurn({ participant, session, userMessage, mode }) {
  const research = await repo.getResearch(participant.id);

  await repo.addMessage({
    session_id: session.id, participant_id: participant.id,
    role: mode === 'qa' ? 'admin' : 'user', content: userMessage,
  });

  const all = await repo.listMessages(session.id);
  const convo = all.filter((m) => m.role === 'user' || m.role === 'assistant' || m.role === 'admin');
  const recent = convo.slice(-HISTORY_WINDOW).map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }));

  const system = buildConversationSystem({ participant, research, session });
  const { say, options } = await converse(system, recent);
  const reply = say || 'Could you say a little more about that?';

  await repo.addMessage({ session_id: session.id, participant_id: participant.id, role: 'assistant', content: reply, metadata: { options } });

  let count = participant.message_count;
  if (mode === 'participant') {
    count = await repo.incMessageCount(participant.id);
    if (participant.status === 'link_ready' || participant.status === 'qa_approved') {
      await repo.setStatus(participant.id, 'active');
    }
  }

  // keep context small: refresh the running summary every few turns
  if (convo.length > HISTORY_WINDOW && convo.length % 8 === 0) {
    const recentText = convo.slice(-8).map((m) => `${m.role}: ${m.content}`).join('\n');
    const sp = buildSummaryPrompt(session.running_summary, recentText);
    try {
      const summary = await completeModel({
        system: sp.system, messages: [{ role: 'user', content: sp.message }],
        model: CHAT_MODEL, generationConfig: gcfg(CHAT_MODEL, { maxOutputTokens: 1024, temperature: 0.3 }),
      });
      await repo.updateSession(session.id, { running_summary: summary });
    } catch (e) {
      console.error('[abl] summary update failed', e.message);
    }
  }

  return { reply, options, messageCount: count };
}

// ---- auto-research -------------------------------------------------------
// Given just company + domain (+ email/role), run a LIVE web-grounded pass
// (Gemini Pro + Google Search) and return the structured research fields, so the
// admin doesn't have to fill them by hand. Always preliminary and correctable.
function extractJson(text) {
  if (!text) return null;
  let s = String(text).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(s); } catch (e) { /* fall through */ }
  const i = s.indexOf('{'), j = s.lastIndexOf('}');
  if (i >= 0 && j > i) { try { return JSON.parse(s.slice(i, j + 1)); } catch (e) { /* ignore */ } }
  return null;
}

export async function researchCompany(participant) {
  const p = participant;
  const emailDomain = p.email && p.email.includes('@') ? p.email.split('@')[1] : '';
  const domain = (p.company_website || emailDomain || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');

  const system = `You are a diligent business researcher preparing a PRELIMINARY brief on a company, to help personalise an executive course ("AI for Business Leaders"). Use live web search to find real, current facts about THIS specific company (match the domain). Be accurate and explicitly preliminary; if you cannot find something, leave that field as an empty string rather than inventing it. Frame any AI relevance as "possible", never as a plan. Output STRICT JSON only — no prose, no code fences.`;

  const user = `Research this company and return the JSON object below.

COMPANY: ${p.company_name || ''}
DOMAIN / WEBSITE: ${domain || '(unknown)'}
KNOWN CONTEXT: role=${p.role_title || '?'}; industry=${p.industry || '?'}; contact=${p.email || '?'}

Return ONLY this JSON shape (all values are short strings; leave "" if genuinely unknown):
{
  "industry": "the company's industry / sector",
  "geography": "where they are based / operate (HQ city + region/country)",
  "business_model": "how they make money (e.g. B2B SaaS, D2C retail, marketplace, consulting)",
  "customers": "who they serve / main customer segments",
  "products": "their main products or services",
  "competitors": "a few notable competitors",
  "pressures": "current business pressures or challenges they likely face",
  "ai_relevance": "where AI could POSSIBLY be relevant for them (not a plan)",
  "ai_exposure": "any KNOWN current AI usage/exposure found in public sources. Do NOT guess. If nothing concrete is discoverable, set this to exactly: No public evidence of current AI adoption found — worth confirming with the participant.",
  "dossier": "a 4-8 sentence narrative brief a course instructor could skim",
  "sources_notes": "one line on what this is based on / confidence"
}`;

  const { text, sources } = await completeGrounded({ system, messages: [{ role: 'user', content: user }] });
  const j = extractJson(text) || {};
  const clean = (s) => String(s || '').replace(/\s*\[[\d,\s]+\]/g, '').replace(/\s{2,}/g, ' ').trim(); // drop inline [2, 7] cite markers
  const structured_context = {
    customers: clean(j.customers), products: clean(j.products), competitors: clean(j.competitors),
    pressures: clean(j.pressures), ai_relevance: clean(j.ai_relevance), ai_exposure: clean(j.ai_exposure),
  };
  let sources_notes = j.sources_notes || 'Preliminary — generated by live web research. Please verify.';
  if (Array.isArray(sources) && sources.length) {
    sources_notes += ' Sources: ' + sources.slice(0, 5).map((s) => s.uri || s.title).filter(Boolean).join(', ');
  }
  const research_dossier = clean(j.dossier);

  await repo.upsertResearch(p.id, { structured_context, research_dossier, sources_notes });
  // Fill the participant-level fields the research surfaced (don't clobber what
  // the admin already typed).
  const fill = {};
  if (clean(j.industry) && !p.industry) fill.industry = clean(j.industry);
  if (clean(j.geography) && !p.geography) fill.geography = clean(j.geography);
  if (clean(j.business_model) && !p.business_model) fill.business_model = clean(j.business_model);
  const patch = Object.assign({}, fill);
  if (p.status === 'draft') patch.status = 'research_added';
  if (Object.keys(patch).length) await repo.updateParticipant(p.id, patch);
  return { structured_context, research_dossier, sources_notes, participant: fill, grounded: !!(sources && sources.length) };
}

// The agent's OPENING message — so the participant never faces a blank box.
// Greets by name, confirms company/role from research (invites correction),
// asks the first question. Stored as the first assistant turn.
export async function openingTurn({ participant, session }) {
  const research = await repo.getResearch(participant.id);
  const system = buildConversationSystem({ participant, research, session });
  const { say, options } = await converse(system, [{ role: 'user', content: 'The participant has just opened the session and will see your reply as the very first message. Greet them warmly by first name, briefly confirm their company and role from the preliminary research and invite corrections, then ask your first question. Provide exactly 3 options they might click to answer that first question — even though it is a confirmation, still give 3 (an affirmation, a partial correction, and a fuller correction).' }]);
  if (say) await repo.addMessage({ session_id: session.id, participant_id: participant.id, role: 'assistant', content: say, metadata: { options } });
  return { say, options };
}

export async function generateOutput(participant, type, modelName) {
  const research = await repo.getResearch(participant.id);
  const session = await repo.getOrCreateSession(participant.id, 'participant');
  const msgs = await repo.listMessages(session.id);
  const transcript =
    msgs
      .filter((m) => m.role === 'user' || m.role === 'assistant' || m.role === 'admin')
      .map((m) => `${String(m.role).toUpperCase()}: ${m.content}`)
      .join('\n\n') || '(no conversation captured yet)';

  const { system, message } = buildOutputPrompt(type, { participant, research, transcript });
  const useModel = modelName || DOC_MODEL;
  const md = await completeModel({
    system, messages: [{ role: 'user', content: message }],
    model: useModel, generationConfig: gcfg(useModel, { maxOutputTokens: 4096, temperature: 0.4 }),
  });
  await repo.saveOutput({ participant_id: participant.id, session_id: session.id, output_type: type, content_markdown: md });
  if (type === 'vinay_meeting_brief') {
    await repo.updateParticipant(participant.id, { vinay_brief_status: 'generated' });
  }
  return md;
}

// The participant's reward + the share-summary, generated IN PARALLEL so the
// "prepare my summary" step is roughly half the wait. The reward uses the Pro
// model (headline deliverable); the share-summary uses the fast model.
export async function generateRewardBundle(participant, selectedDepth) {
  const rewardType = rewardTypeForDepth(selectedDepth);
  // Both on the fast model + in parallel: the participant is waiting live, so
  // responsiveness wins. Vinay's private brief still uses the Pro model.
  const [rewardMd, shareMd] = await Promise.all([
    generateOutput(participant, rewardType, CHAT_MODEL),
    generateOutput(participant, 'share_summary', CHAT_MODEL),
  ]);
  return { rewardType, rewardMd, shareMd };
}
