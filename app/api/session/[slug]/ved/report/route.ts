import { handler, ok, fail } from "@/lib/abl/http";
import * as repo from "@/lib/abl/repo";
import { generateVedReport } from "@/lib/abl/service";

type Ctx = { params: Promise<{ slug: string }> };

// Generate the participant's "Execution Constraint Report".
export const POST = handler(async (_req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const p = await repo.getParticipantBySlug(slug);
  if (!p) return fail("Session not found", 404);
  if (!p.link_approved) return fail("This session is not active yet.", 403);

  const session = await repo.getOrCreateSession(p.id, "ved");
  const messages = await repo.listMessages(session.id);
  const turns = messages.filter((m) => m.role === "user").length;
  if (turns < 2) return fail("Go a little further into the diagnostic before generating your report.", 400);

  const report = await generateVedReport(p);
  return ok({ report });
});
