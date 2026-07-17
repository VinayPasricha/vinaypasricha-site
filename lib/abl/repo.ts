// Data-access layer over the main site's Firestore (server-only).
//
// Reimplements the exact same interface the app was built against (the former
// Supabase repo) so every route/service is untouched. Design notes:
//   • participants/outputs/messages use auto-ids; the doc id is exposed as `id`.
//   • a session is one doc per (participant, mode): id = `${participantId}_${mode}`,
//     so getOrCreateSession is a single keyed read (no query, no index).
//   • research/qa are one doc per participant: id = participantId.
//   • all filtering beyond a single equality is done in JS, so NO composite
//     Firestore indexes are required.
import "server-only";
import { fs, COL, nowIso, withId } from "./firestore";
import { makeSlug, sha256 } from "./slug";
import type {
  Participant, ParticipantResearch, ChatSession, ChatMessage,
  GeneratedOutput, OutputType, StructuredContext, ParticipantStatus, SessionMode,
} from "./types";

// ---- participants ----------------------------------------------------------
export async function listParticipants(): Promise<Participant[]> {
  const snap = await fs().collection(COL.participants).orderBy("updated_at", "desc").get();
  return snap.docs.map((d) => withId<Participant>(d));
}
export async function getParticipant(id: string): Promise<Participant | null> {
  const doc = await fs().collection(COL.participants).doc(id).get();
  return doc.exists ? withId<Participant>(doc) : null;
}
export async function getParticipantBySlug(slug: string): Promise<Participant | null> {
  const snap = await fs().collection(COL.participants).where("slug", "==", slug).limit(1).get();
  return snap.empty ? null : withId<Participant>(snap.docs[0]);
}
export async function createParticipant(input: {
  name: string; company_name: string; email?: string; role_title?: string;
  company_website?: string; industry?: string; geography?: string; business_model?: string;
}): Promise<Participant> {
  const now = nowIso();
  for (let attempt = 0; attempt < 6; attempt++) {
    const { slug, code } = makeSlug(input.name);
    if (await getParticipantBySlug(slug)) continue; // collision — try again
    const row = {
      slug, access_code_hash: sha256(code), status: "draft" as ParticipantStatus,
      qa_status: "not_started", link_approved: false, current_stage: null,
      name: input.name, company_name: input.company_name,
      email: input.email || null, role_title: input.role_title || null,
      company_website: input.company_website || null, industry: input.industry || null,
      geography: input.geography || null, business_model: input.business_model || null,
      max_messages: 200, message_count: 0, access_paused: false,
      daily_limit: 0, daily_count: 0, daily_date: null,
      token_budget: null, token_estimate: 0, vinay_brief_status: "none",
      last_activity_at: null, approved_at: null, created_at: now, updated_at: now,
    };
    const ref = await fs().collection(COL.participants).add(row);
    return { id: ref.id, ...row } as unknown as Participant;
  }
  throw new Error("Could not allocate a unique slug");
}
export async function updateParticipant(id: string, patch: Partial<Participant>): Promise<Participant> {
  await fs().collection(COL.participants).doc(id).update({ ...patch, updated_at: nowIso() });
  return (await getParticipant(id))!;
}
export async function setStatus(id: string, status: ParticipantStatus) {
  await updateParticipant(id, { status });
}
export async function touchActivity(id: string) {
  await fs().collection(COL.participants).doc(id).update({ last_activity_at: nowIso() });
}
export async function incMessageCount(id: string): Promise<number> {
  const p = await getParticipant(id);
  const next = (p?.message_count ?? 0) + 1;
  await fs().collection(COL.participants).doc(id).update({ message_count: next, last_activity_at: nowIso() });
  return next;
}
// Record one AI interaction: bump total + today's count (reset on a new day) + rough tokens.
export async function recordInteraction(id: string, tokens: number): Promise<{ message_count: number; daily_count: number; token_estimate: number }> {
  const p = await getParticipant(id);
  const today = nowIso().slice(0, 10);
  const message_count = (p?.message_count ?? 0) + 1;
  const daily_count = (p?.daily_date === today ? (p?.daily_count ?? 0) : 0) + 1;
  const token_estimate = (p?.token_estimate ?? 0) + Math.max(0, Math.round(tokens || 0));
  await fs().collection(COL.participants).doc(id).update({
    message_count, daily_count, daily_date: today, token_estimate, last_activity_at: nowIso(),
  });
  return { message_count, daily_count, token_estimate };
}
// Reset one conversation (mode): clear its messages and session state so the participant can restart it.
export async function resetConversation(participantId: string, mode: SessionMode): Promise<void> {
  const session = await getOrCreateSession(participantId, mode);
  const msgs = await fs().collection(COL.messages).where("session_id", "==", session.id).get();
  const batch = fs().batch();
  msgs.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  await fs().collection(COL.sessions).doc(session.id).update({
    consent_given: false, selected_depth: null, running_summary: null, current_stage: null, status: "open",
  });
}

// ---- research --------------------------------------------------------------
export async function getResearch(participantId: string): Promise<ParticipantResearch | null> {
  const doc = await fs().collection(COL.research).doc(participantId).get();
  return doc.exists ? withId<ParticipantResearch>(doc) : null;
}
export async function upsertResearch(participantId: string, input: {
  structured_context: StructuredContext; research_dossier?: string; sources_notes?: string;
}): Promise<ParticipantResearch> {
  const row = {
    participant_id: participantId,
    structured_context: input.structured_context ?? {},
    research_dossier: input.research_dossier || null,
    sources_notes: input.sources_notes || null,
    updated_at: nowIso(),
  };
  await fs().collection(COL.research).doc(participantId).set(row, { merge: true });
  return (await getResearch(participantId))!;
}

// ---- sessions & messages ---------------------------------------------------
// Query by (participant_id, mode) — the exact shape the main site's abl/store.js
// uses — so this app resolves the SAME session a participant already started in
// the live ABL runtime (rather than a fresh, empty one).
export async function getOrCreateSession(participantId: string, mode: SessionMode): Promise<ChatSession> {
  const snap = await fs().collection(COL.sessions)
    .where("participant_id", "==", participantId).where("mode", "==", mode).get();
  if (!snap.empty) {
    const docs = snap.docs.map((d) => withId<ChatSession & { created_at?: string }>(d));
    docs.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
    return docs[0];
  }
  const row = {
    participant_id: participantId, mode, selected_depth: null, current_stage: null,
    status: "open", consent_given: false, summary_reviewed: false, running_summary: null,
    created_at: nowIso(), updated_at: nowIso(),
  };
  const ref = await fs().collection(COL.sessions).add(row);
  return { id: ref.id, ...row } as unknown as ChatSession;
}
export async function updateSession(id: string, patch: Partial<ChatSession>): Promise<ChatSession> {
  await fs().collection(COL.sessions).doc(id).update({ ...patch, updated_at: nowIso() });
  const doc = await fs().collection(COL.sessions).doc(id).get();
  return withId<ChatSession>(doc);
}
// Latest running summary for a participant's session of a given mode (for cross-conversation context).
export async function getSessionSummary(participantId: string, mode: SessionMode): Promise<string | null> {
  const snap = await fs().collection(COL.sessions)
    .where("participant_id", "==", participantId).where("mode", "==", mode).get();
  if (snap.empty) return null;
  const docs = snap.docs.map((d) => d.data() as { created_at?: string; running_summary?: string | null });
  docs.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  return docs[0].running_summary ?? null;
}
export async function listMessages(sessionId: string): Promise<ChatMessage[]> {
  const snap = await fs().collection(COL.messages).where("session_id", "==", sessionId).get();
  return snap.docs
    .map((d) => withId<ChatMessage>(d))
    .sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));
}
export async function addMessage(m: {
  session_id: string; participant_id: string; role: ChatMessage["role"]; content: string; metadata?: Record<string, unknown>;
}): Promise<ChatMessage> {
  const row = { ...m, metadata: m.metadata ?? {}, created_at: nowIso() };
  const ref = await fs().collection(COL.messages).add(row);
  return { id: ref.id, ...row } as unknown as ChatMessage;
}

// ---- outputs ---------------------------------------------------------------
export async function getOutputs(participantId: string): Promise<GeneratedOutput[]> {
  const snap = await fs().collection(COL.outputs).where("participant_id", "==", participantId).get();
  return snap.docs
    .map((d) => withId<GeneratedOutput>(d))
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""))); // newest first
}
export async function getLatestOutput(participantId: string, type: OutputType): Promise<GeneratedOutput | null> {
  const all = await getOutputs(participantId);
  return all.find((o) => o.output_type === type) ?? null;
}
export async function getOutput(id: string): Promise<GeneratedOutput | null> {
  const doc = await fs().collection(COL.outputs).doc(id).get();
  return doc.exists ? withId<GeneratedOutput>(doc) : null;
}
export async function saveOutput(o: {
  participant_id: string; session_id?: string | null; output_type: OutputType;
  content_markdown: string; content_json?: unknown;
}): Promise<GeneratedOutput> {
  const existing = await getLatestOutput(o.participant_id, o.output_type);
  const now = nowIso();
  if (existing) {
    await fs().collection(COL.outputs).doc(existing.id).update({
      session_id: o.session_id ?? null, content_markdown: o.content_markdown,
      content_json: o.content_json ?? null, updated_at: now,
    });
    return (await getOutput(existing.id))!;
  }
  const row = {
    participant_id: o.participant_id, session_id: o.session_id ?? null,
    output_type: o.output_type, content_markdown: o.content_markdown, content_json: o.content_json ?? null,
    reviewed_content_markdown: null, participant_approved: false,
    created_at: now, updated_at: now,
  };
  const ref = await fs().collection(COL.outputs).add(row);
  return { id: ref.id, ...row } as unknown as GeneratedOutput;
}
export async function reviewShareSummary(id: string, reviewed_markdown: string, approved: boolean): Promise<GeneratedOutput> {
  await fs().collection(COL.outputs).doc(id).update({
    reviewed_content_markdown: reviewed_markdown, participant_approved: approved, updated_at: nowIso(),
  });
  return (await getOutput(id))!;
}

// ---- qa --------------------------------------------------------------------
export async function getQa(participantId: string) {
  const doc = await fs().collection(COL.qa).doc(participantId).get();
  return doc.exists ? withId(doc) : null;
}
export async function upsertQa(participantId: string, input: {
  checklist: Record<string, unknown>; notes?: string; status?: string; tested_by?: string; approved_by?: string; approved_at?: string | null;
}) {
  await fs().collection(COL.qa).doc(participantId).set({ participant_id: participantId, ...input, updated_at: nowIso() }, { merge: true });
  return await getQa(participantId);
}
