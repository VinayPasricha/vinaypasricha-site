import { handler, ok, fail } from "@/lib/abl/http";
import { requireAdmin } from "@/lib/abl/auth";
import * as repo from "@/lib/abl/repo";
import { generateOutput } from "@/lib/abl/service";

type Ctx = { params: Promise<{ id: string }> };

// Generate (or regenerate) Vinay's private meeting brief from the conversation.
export const POST = handler(async (_req: Request, { params }: Ctx) => {
  await requireAdmin();
  const { id } = await params;
  const p = await repo.getParticipant(id);
  if (!p) return fail("Not found", 404);
  const markdown = await generateOutput(p, "vinay_meeting_brief");
  return ok({ markdown });
});
