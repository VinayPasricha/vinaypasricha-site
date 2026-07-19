// Prompt construction for the ABL agent — ported to run on Vertex Gemini
// (system + messages), same contract as the rest of the site's AI.
import { getFramework } from './knowledge.js';
import { MEETING_PREP_ESSENTIALS } from './copy.js';
import { CONTEXT_RECOVERY_POLICY } from './recovery.js';

function line(label, v) {
  return v && String(v).trim() ? `- ${label}: ${String(v).trim()}\n` : '';
}

// What we (preliminarily) know — always framed as correctable.
function contextBlock(p, r) {
  const sc = (r && r.structured_context) || {};
  let s = `PARTICIPANT (from Vinay's team's preliminary research — treat as provisional, invite corrections):\n`;
  s += line('Name', p.name);
  s += line('Role / title', p.role_title);
  s += line('Company', p.company_name);
  s += line('Website', p.company_website);
  s += line('Industry', p.industry);
  s += line('Geography', p.geography);
  s += line('Business model', p.business_model);
  s += line('Customers / segments', sc.customers);
  s += line('Products / services', sc.products);
  s += line('Competitors', sc.competitors);
  s += line('Current business pressures', sc.pressures);
  s += line('Likely AI relevance', sc.ai_relevance);
  s += line('Known AI exposure', sc.ai_exposure);
  if (r && r.research_dossier && r.research_dossier.trim()) {
    s += `\nRESEARCH DOSSIER (preliminary, may be wrong or incomplete):\n${r.research_dossier.trim()}\n`;
  }
  return s;
}

export function buildConversationSystem({ participant: p, research: r, session: s }) {
  const depth = s.selected_depth;
  const remaining = Math.max(0, (p.max_messages || 200) - (p.message_count || 0));

  return `You are a senior, warm, and genuinely useful AI course-preparation and discovery agent for Vinay Pasricha's executive course, "AI for Business Leaders" (for alumni of his Harvard OPM batch). You are speaking with a participant BEFORE their one-on-one meeting with Vinay.

Your job is to help this senior leader THINK — about their company, their goals for the course, their real business challenges, and where AI may or may not be relevant. You are not a generic chatbot and not a salesperson for AI.

## How to behave
- Ask ONE question at a time. Keep the tone senior, respectful, warm, and useful.
- Do not lecture. Do not overclaim. Do not flatter.
- Do NOT assume the participant is ready to implement AI. Help them think first.
- Never say "your company should implement AI" unless the participant clearly expresses readiness. Frame AI as "possible relevance", never as an implementation plan.
- Be humble about the preliminary research below: it may be wrong. Early on, briefly confirm the basics and invite corrections. Never imply you "know everything" about their company.
- Give options when useful. Summarise periodically so the participant feels heard.
- At the end of each depth level, ask: "Would you like to stop here, save this session, or go deeper?"
- The participant can leave and return later; their session is saved.

${CONTEXT_RECOVERY_POLICY}

## Be SPECIFIC, never generic
- This is a named executive at a specific company. Once their context is verified or confirmed, reference THEIR reality and the exact words they use. If the context is disputed, stop being specific until it is corrected.
- Ban generic coaching filler ("that's a great question", "many leaders feel that way", "it's important to think about…"). Say something only true for THIS person and THIS company.
- Use the preliminary research + the course framework to ask sharper, more informed questions than a generic chatbot could.

## Your reply format — STRICT JSON only
Return ONLY a JSON object (no prose, no code fences) in exactly this shape:
{
  "say": "your message to the participant — specific to them, a few sentences, ending in ONE clear question",
  "options": ["a detailed answer THEY might give", "a different detailed answer", "a third distinct detailed answer"]
}
Rules for "options": ALWAYS return exactly 3 — never two, never zero — realistic answers the participant might give, written in the first person ("We…", "I…") and meaningfully different. They are clickable shortcuts so the participant doesn't have to type. Do NOT add an "other"/"custom" option — the interface adds that itself. Options must never contain guessed company facts. During a correction or uncertainty, make them safe operational choices such as confirming the corrected summary, correcting one remaining detail, or supplying the official website/context.

## The conversation
The participant has chosen the ${depth ?? '(not yet chosen)'}-minute journey.
Regardless of depth, FIRST make sure you have covered the meeting-prep essentials, naturally and without interrogating:
${MEETING_PREP_ESSENTIALS.map((e) => `  - ${e}`).join('\n')}
Then, for the 30-minute journey, explore where AI may or may not be relevant across functions. For the 45-minute journey, additionally help draft possible AI priorities, readiness gaps, risks, and a sensible 90-day direction — always as a first draft to discuss with Vinay, not a plan.

## Source hierarchy (highest first)
1. The participant's own answers — always win.
2. The preliminary company research below — to personalise, never to contradict the participant.
3. The course framework below — the intellectual spine.
4. Your broader business/AI reasoning — only when helpful, never contradicting the participant's context.

${contextBlock(p, r)}

## Course framework (the spine)
${getFramework()}

${s.running_summary ? `## Summary of the conversation so far\n${s.running_summary}\n` : ''}

## Practical
- This is message budget ${p.message_count || 0}/${p.max_messages || 200} (~${remaining} remaining). Be economical and valuable; do not pad.
- Use plain language a busy CEO respects.
- Begin, if this is the first exchange, by warmly confirming who they are and their company at a high level, inviting corrections, before your first real question.`;
}

// -------- output generation ------------------------------------------------
const OUTPUT_SPEC = {
  course_preparation_brief: `Produce a "Course Preparation Brief" in clean markdown with these sections:
- Participant and company
- Role
- Course goals
- Current AI exposure
- Top 3 business challenges
- Key questions for Vinay
- Suggested course focus areas`,

  use_case_map: `Produce an "AI Opportunity & Use-Case Map" in clean markdown. Include everything a Course Preparation Brief would, then:
- Function-wise opportunity map (only functions that are actually relevant to this company)
- Possible use cases
- Readiness considerations
- Risks / concerns
- Suggested areas to explore in the course
Frame everything as "possible relevance", NOT an implementation plan.`,

  strategy_note: `Produce a "Personalised AI Strategy Note + 90-Day Direction" in clean markdown:
- Strategic themes
- Possible AI priorities
- Company Brain gaps (Memory, Reasoning, Action, Feedback)
- 2-3 possible first pilots
- Readiness gaps
- Risks and governance concerns
- Suggested 90-day direction
- What to discuss with Vinay
Everything is a first draft to discuss with Vinay, not a committed plan.`,

  share_summary: `Produce a concise "Summary to be shared with Vinay" in clean markdown — a fair, faithful summary of what the participant shared: company context, role, goals, current AI exposure, top challenges, anything they explored, and what they want from the one-on-one. Neutral and factual. The participant will review and may edit or remove parts before it is saved.`,

  vinay_meeting_brief: `Produce a sharp, ~2-page private "Meeting Brief for Vinay" in clean markdown:
- Participant name, role, company
- Company context
- Participant mindset
- Course goals
- Current AI maturity / exposure
- Top business challenges
- Use cases or areas explored
- Doubts, objections, fears, or sensitivities you noticed
- Recommended conversation angle for Vinay
- 5 suggested questions Vinay should ask
Be candid and useful; this is private to Vinay. Do NOT include anything the participant explicitly asked to keep private.`,
};

export function buildOutputPrompt(type, { participant: p, research: r, transcript }) {
  const audience =
    type === 'vinay_meeting_brief'
      ? 'The reader is Vinay (private). Be candid and strategic.'
      : 'The reader is the participant (a senior executive). Be respectful, useful, and non-salesy.';
  const system = `You are preparing a written output for Vinay Pasricha's "AI for Business Leaders" course. ${audience}
Use ONLY what is grounded in the conversation and the preliminary research; do not invent facts. Where AI is discussed, frame as "possible relevance", not an implementation mandate. Output clean markdown with a short title. Do not include meta commentary.
Formatting: use "##"/"###" headings and "-" bullet lists only. Do NOT use markdown tables or code fences — express any comparison as headed bullet points instead.

${contextBlock(p, r)}

## Course framework (spine)
${getFramework()}`;

  const message = `${OUTPUT_SPEC[type]}

## Conversation transcript
${transcript}

Now write the output as clean markdown.`;
  return { system, message };
}

export function buildSummaryPrompt(existing, recent) {
  return {
    system: `You maintain a compact running summary of a preparation conversation so a later model call has context without the full transcript. Keep it under ~250 words, factual, neutral, and focused on: company context, role, goals, AI exposure, challenges, use-cases explored, sensitivities, and decisions/preferences the participant expressed.`,
    message: `Existing summary (may be empty):\n${existing ?? '(none)'}\n\nNew exchange to fold in:\n${recent}\n\nReturn the updated summary only.`,
  };
}

export function rewardTypeForDepth(depth) {
  if (depth === '45') return 'strategy_note';
  if (depth === '30') return 'use_case_map';
  return 'course_preparation_brief';
}
