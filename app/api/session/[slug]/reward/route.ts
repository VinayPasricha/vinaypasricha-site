import { handler, ok, fail } from "@/lib/abl/http";
import * as repo from "@/lib/abl/repo";
import { generateOutput, rewardTypeForDepth } from "@/lib/abl/service";

type Ctx = { params: Promise<{ slug: string }> };

// Generate the depth-appropriate reward + the participant-reviewable "share summary".
export const POST = handler(async (_req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const p = await repo.getParticipantBySlug(slug);
  if (!p) return fail("Session not found", 404);
  if (!p.link_approved) return fail("This session is not active yet.", 403);

  const session = await repo.getOrCreateSession(p.id, "participant");
  const rewardType = rewardTypeForDepth(session.selected_depth);

  const rewardMd = await generateOutput(p, rewardType);
  const shareMd = await generateOutput(p, "share_summary");

  await repo.updateSession(session.id, { current_stage: "summary_review" });
  await repo.updateParticipant(p.id, { current_stage: "summary_review" });

  const reward = await repo.getLatestOutput(p.id, rewardType);
  const share = await repo.getLatestOutput(p.id, "share_summary");
  return ok({
    reward: { id: reward!.id, type: rewardType, markdown: rewardMd },
    share: { id: share!.id, markdown: shareMd },
  });
});
