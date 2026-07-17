import { handler, ok, fail, readJson } from "@/lib/abl/http";
import * as repo from "@/lib/abl/repo";
import type { SivDepth } from "@/lib/abl/siv";

type Ctx = { params: Promise<{ slug: string }> };

// Load the SIV AI Project Selector state for a participant.
export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const p = await repo.getParticipantBySlug(slug);
  if (!p) return fail("Session not found", 404);
  if (!p.link_approved) return fail("This session is not active yet.", 403);

  const session = await repo.getOrCreateSession(p.id, "siv");
  const messages = (await repo.listMessages(session.id))
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: m.content }));
  const report = await repo.getLatestOutput(p.id, "siv_report");

  return ok({
    started: !!session.selected_depth,
    depth: session.selected_depth,
    message_count: p.message_count,
    max_messages: p.max_messages,
    messages,
    report: report ? { id: report.id, markdown: report.content_markdown } : null,
  });
});

// Start / choose depth for the SIV examination.
export const POST = handler(async (req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const body = await readJson<{ depth?: SivDepth }>(req);
  if (!body.depth || !["fast", "standard", "deep"].includes(body.depth)) return fail("Choose a valid depth.");

  const p = await repo.getParticipantBySlug(slug);
  if (!p) return fail("Session not found", 404);
  if (!p.link_approved) return fail("This session is not active yet.", 403);

  const session = await repo.getOrCreateSession(p.id, "siv");
  const updated = await repo.updateSession(session.id, { selected_depth: body.depth, consent_given: true });
  return ok({ started: true, depth: updated.selected_depth });
});
