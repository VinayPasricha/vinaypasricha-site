import { handler, ok, fail, readJson } from "@/lib/abl/http";
import * as repo from "@/lib/abl/repo";

type Ctx = { params: Promise<{ slug: string }> };

// Participant reviews the "Summary to be shared with Vinay": approve as-is, edit,
// remove sensitive points, and/or add a note. Saved as the reviewed version.
export const POST = handler(async (req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const body = await readJson<{ reviewed_markdown?: string; approved?: boolean; note?: string }>(req);
  const p = await repo.getParticipantBySlug(slug);
  if (!p) return fail("Session not found", 404);
  if (!p.link_approved) return fail("This session is not active yet.", 403);

  const share = await repo.getLatestOutput(p.id, "share_summary");
  if (!share) return fail("No summary to review yet.", 400);

  const base = body.reviewed_markdown ?? share.reviewed_content_markdown ?? share.content_markdown ?? "";
  const finalMd = body.note?.trim() ? `${base}\n\n---\n\n**Note to Vinay:** ${body.note.trim()}` : base;
  await repo.reviewShareSummary(share.id, finalMd, !!body.approved);

  const session = await repo.getOrCreateSession(p.id, "participant");
  await repo.updateSession(session.id, { summary_reviewed: true });
  if (body.approved) {
    await repo.updateParticipant(p.id, { current_stage: "done", status: "completed" });
  }
  return ok({ approved: !!body.approved });
});
