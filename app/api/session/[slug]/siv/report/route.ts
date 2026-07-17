import { handler, ok, fail } from "@/lib/abl/http";
import * as repo from "@/lib/abl/repo";
import { generateSivReport } from "@/lib/abl/service";

type Ctx = { params: Promise<{ slug: string }> };

// Generate the participant's "First AI Project Decision Report".
export const POST = handler(async (_req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const p = await repo.getParticipantBySlug(slug);
  if (!p) return fail("Session not found", 404);
  if (!p.link_approved) return fail("This session is not active yet.", 403);

  const session = await repo.getOrCreateSession(p.id, "siv");
  if (!session.selected_depth) return fail("Start the examination before generating a report.", 400);
  const messages = await repo.listMessages(session.id);
  const turns = messages.filter((m) => m.role === "user").length;
  if (turns < 2) return fail("Go a little further into the examination before generating your report.", 400);

  const report = await generateSivReport(p);
  return ok({ report });
});
