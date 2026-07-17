import { handler, ok, fail, readJson } from "@/lib/abl/http";
import * as repo from "@/lib/abl/repo";
import type { Depth } from "@/lib/abl/types";

type Ctx = { params: Promise<{ slug: string }> };

// Load (or resume) a participant's session: sanitised participant + session + messages + reward.
export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const p = await repo.getParticipantBySlug(slug);
  if (!p) return fail("Session not found", 404);
  if (!p.link_approved) return fail("This session is not active yet.", 403);

  const session = await repo.getOrCreateSession(p.id, "participant");
  const messages = (await repo.listMessages(session.id))
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: m.content, at: m.created_at }));
  const outputs = await repo.getOutputs(p.id);
  const reward = outputs.find((o) => !["vinay_meeting_brief", "share_summary", "siv_report", "ved_report"].includes(o.output_type)) || null;
  const share = outputs.find((o) => o.output_type === "share_summary") || null;

  return ok({
    participant: {
      name: p.name, company_name: p.company_name, role_title: p.role_title,
      status: p.status, current_stage: p.current_stage,
      message_count: p.message_count, max_messages: p.max_messages,
    },
    session: {
      selected_depth: session.selected_depth, consent_given: session.consent_given,
      current_stage: session.current_stage, summary_reviewed: session.summary_reviewed,
    },
    messages,
    reward: reward ? { id: reward.id, type: reward.output_type, markdown: reward.content_markdown } : null,
    share: share ? { id: share.id, markdown: share.reviewed_content_markdown ?? share.content_markdown, approved: share.participant_approved } : null,
  });
});

// Start / set depth + consent.
export const POST = handler(async (req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const body = await readJson<{ depth?: Depth; consent?: boolean }>(req);
  const p = await repo.getParticipantBySlug(slug);
  if (!p) return fail("Session not found", 404);
  if (!p.link_approved) return fail("This session is not active yet.", 403);

  const session = await repo.getOrCreateSession(p.id, "participant");
  const patch: Record<string, unknown> = {};
  if (body.depth && ["15", "30", "45"].includes(body.depth)) {
    patch.selected_depth = body.depth;
    patch.current_stage = "personalisation";
  }
  if (typeof body.consent === "boolean") patch.consent_given = body.consent;
  const updated = await repo.updateSession(session.id, patch);
  if (patch.current_stage) await repo.updateParticipant(p.id, { current_stage: "personalisation" });

  return ok({ session: { selected_depth: updated.selected_depth, consent_given: updated.consent_given, current_stage: updated.current_stage } });
});
