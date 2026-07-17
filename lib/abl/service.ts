import "server-only";
import { generateText } from "./ai";
import { buildConversationSystem, buildOutputPrompt, buildSummaryPrompt, buildSivSystem, buildSivReportPrompt, buildVedSystem, buildVedReportPrompt } from "./prompt";
import * as repo from "./repo";
import type { Participant, ChatSession, OutputType, SessionMode } from "./types";
import type { SivDepth } from "./siv";

const HISTORY_WINDOW = 16; // recent turns sent verbatim; older folded into running_summary

const ALLOWANCE_MSG = "You have used your included course AI allowance. This is not a problem — please message the course admin and we can extend access where needed.";

// Decide whether a participant may take another interaction (paused / total / daily / token budget).
export function usageGate(p: Participant): { ok: boolean; message?: string; status?: number } {
  if (p.access_paused) return { ok: false, status: 403, message: "Your access is paused. Please message the course admin to resume." };
  if (p.message_count >= p.max_messages) return { ok: false, status: 429, message: ALLOWANCE_MSG };
  const today = new Date().toISOString().slice(0, 10);
  const usedToday = p.daily_date === today ? p.daily_count : 0;
  if (p.daily_limit > 0 && usedToday >= p.daily_limit) {
    return { ok: false, status: 429, message: "You have reached today's limit for the course assistants. Please continue tomorrow, or message the course admin to extend access." };
  }
  if (p.token_budget != null && p.token_estimate >= p.token_budget) return { ok: false, status: 429, message: ALLOWANCE_MSG };
  return { ok: true };
}

// Summaries/reports from a participant's OTHER conversations, so VED reads the AI Journey and
// SIV reads the AI Journey + the VED constraint. Keeps the three conversations connected.
async function gatherCrossContext(participantId: string, mode: SessionMode): Promise<string> {
  if (mode !== "ved" && mode !== "siv") return "";
  const parts: string[] = [];
  const journey = await repo.getSessionSummary(participantId, "participant");
  const share = journey ? null : await repo.getLatestOutput(participantId, "share_summary");
  const journeyText = journey || share?.content_markdown;
  if (journeyText) parts.push(`### From the participant's AI Journey conversation\n${journeyText}`);
  if (mode === "siv") {
    const ved = await repo.getLatestOutput(participantId, "ved_report");
    const vedSum = ved ? null : await repo.getSessionSummary(participantId, "ved");
    const vedText = ved?.content_markdown || vedSum;
    if (vedText) parts.push(`### From the Execution Doctrine (VED) diagnostic — the weakest execution link\n${vedText}`);
  }
  return parts.join("\n\n");
}

export async function agentTurn(args: {
  participant: Participant;
  session: ChatSession;
  userMessage: string;
  mode: SessionMode;
}): Promise<{ reply: string; messageCount: number }> {
  const { participant, session, userMessage, mode } = args;
  const research = await repo.getResearch(participant.id);

  await repo.addMessage({
    session_id: session.id, participant_id: participant.id,
    role: mode === "qa" ? "admin" : "user", content: userMessage,
  });

  const all = await repo.listMessages(session.id);
  const convo = all.filter((m) => m.role === "user" || m.role === "assistant" || m.role === "admin");
  const recent = convo.slice(-HISTORY_WINDOW).map((m) => ({
    role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
    content: m.content,
  }));
  // The Anthropic Messages API requires the first message to be role "user"; the window
  // can start on an assistant turn once the conversation exceeds it, so trim any lead assistant.
  while (recent.length && recent[0].role === "assistant") recent.shift();

  const crossContext = await gatherCrossContext(participant.id, mode);
  const system =
    mode === "siv" ? buildSivSystem({ participant, research, session, crossContext })
    : mode === "ved" ? buildVedSystem({ participant, research, session, crossContext })
    : buildConversationSystem({ participant, research, session });
  const reply = await generateText({ system, messages: recent, maxTokens: 900, temperature: 0.6 });

  await repo.addMessage({ session_id: session.id, participant_id: participant.id, role: "assistant", content: reply });

  let count = participant.message_count;
  // count participant + VED + SIV turns against the allowance; QA (admin testing) does not count
  if (mode !== "qa") {
    const inputChars = system.length + recent.reduce((s, m) => s + m.content.length, 0);
    const tokens = Math.ceil((inputChars + reply.length) / 4); // rough estimate for the cost dashboard
    count = (await repo.recordInteraction(participant.id, tokens)).message_count;
    if (participant.status === "link_ready" || participant.status === "qa_approved") {
      await repo.setStatus(participant.id, "active");
    }
  }

  // keep context small: fold messages that have aged out of the verbatim window into the
  // running summary. convo.length is always odd here, so use an odd-friendly cadence (6k+1)
  // rather than "% 8 === 0" (which never fired), and fold the OLDER messages, not the newest.
  const older = convo.slice(0, -HISTORY_WINDOW);
  if (older.length >= 2 && convo.length % 6 === 1) {
    const foldText = older.slice(-12).map((m) => `${m.role}: ${m.content}`).join("\n");
    const sp = buildSummaryPrompt(session.running_summary, foldText);
    try {
      const summary = await generateText({
        system: sp.system, messages: [{ role: "user", content: sp.message }], maxTokens: 500, temperature: 0.3,
      });
      await repo.updateSession(session.id, { running_summary: summary });
    } catch (e) {
      console.error("[abl] summary update failed", e);
    }
  }

  return { reply, messageCount: count };
}

export function rewardTypeForDepth(depth: string | null): OutputType {
  if (depth === "45") return "strategy_note";
  if (depth === "30") return "use_case_map";
  return "course_preparation_brief";
}

// SIV: generate the participant's "First AI Project Decision Report" from the siv session.
export async function generateSivReport(participant: Participant): Promise<{ id: string; markdown: string }> {
  const research = await repo.getResearch(participant.id);
  const session = await repo.getOrCreateSession(participant.id, "siv");
  const depth = (session.selected_depth as SivDepth) || "standard";
  const msgs = await repo.listMessages(session.id);
  const transcript =
    msgs
      .filter((m) => m.role === "user" || m.role === "assistant" || m.role === "admin")
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n") || "(no examination captured yet)";

  const { system, message } = buildSivReportPrompt({ participant, research, transcript, depth });
  const md = await generateText({
    system, messages: [{ role: "user", content: message }], maxTokens: 3200, temperature: 0.4,
  });
  await repo.saveOutput({
    participant_id: participant.id, session_id: session.id,
    output_type: "siv_report", content_markdown: md, content_json: { depth },
  });
  const out = await repo.getLatestOutput(participant.id, "siv_report");
  return { id: out!.id, markdown: md };
}

// VED: generate the participant's "Execution Constraint Report" from the ved session.
export async function generateVedReport(participant: Participant): Promise<{ id: string; markdown: string }> {
  const research = await repo.getResearch(participant.id);
  const session = await repo.getOrCreateSession(participant.id, "ved");
  const crossContext = await gatherCrossContext(participant.id, "ved");
  const msgs = await repo.listMessages(session.id);
  const transcript =
    msgs
      .filter((m) => m.role === "user" || m.role === "assistant" || m.role === "admin")
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n") || "(no diagnostic captured yet)";

  const { system, message } = buildVedReportPrompt({ participant, research, transcript, crossContext });
  const md = await generateText({
    system, messages: [{ role: "user", content: message }], maxTokens: 2600, temperature: 0.4,
  });
  await repo.saveOutput({
    participant_id: participant.id, session_id: session.id, output_type: "ved_report", content_markdown: md,
  });
  const out = await repo.getLatestOutput(participant.id, "ved_report");
  return { id: out!.id, markdown: md };
}

export async function generateOutput(participant: Participant, type: OutputType): Promise<string> {
  const research = await repo.getResearch(participant.id);
  const session = await repo.getOrCreateSession(participant.id, "participant");
  const msgs = await repo.listMessages(session.id);
  const transcript =
    msgs
      .filter((m) => m.role === "user" || m.role === "assistant" || m.role === "admin")
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n") || "(no conversation captured yet)";

  const { system, message } = buildOutputPrompt(type, { participant, research, transcript });
  const md = await generateText({
    system, messages: [{ role: "user", content: message }], maxTokens: 2200, temperature: 0.4,
  });
  await repo.saveOutput({ participant_id: participant.id, session_id: session.id, output_type: type, content_markdown: md });
  if (type === "vinay_meeting_brief") {
    await repo.updateParticipant(participant.id, { vinay_brief_status: "generated" });
  }
  return md;
}
