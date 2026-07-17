import { handler, ok, fail } from "@/lib/abl/http";
import * as repo from "@/lib/abl/repo";

type Ctx = { params: Promise<{ slug: string }> };

// Load the Execution Doctrine (VED) assistant state for a participant.
export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const p = await repo.getParticipantBySlug(slug);
  if (!p) return fail("Session not found", 404);
  if (!p.link_approved) return fail("This session is not active yet.", 403);

  const session = await repo.getOrCreateSession(p.id, "ved");
  const messages = (await repo.listMessages(session.id))
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: m.content }));
  const report = await repo.getLatestOutput(p.id, "ved_report");

  return ok({
    started: !!session.consent_given,
    message_count: p.message_count,
    max_messages: p.max_messages,
    messages,
    report: report ? { id: report.id, markdown: report.content_markdown } : null,
  });
});

// Start the VED diagnostic (single guided flow — no depth choice).
export const POST = handler(async (_req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const p = await repo.getParticipantBySlug(slug);
  if (!p) return fail("Session not found", 404);
  if (!p.link_approved) return fail("This session is not active yet.", 403);

  const session = await repo.getOrCreateSession(p.id, "ved");
  await repo.updateSession(session.id, { consent_given: true });
  return ok({ started: true });
});
