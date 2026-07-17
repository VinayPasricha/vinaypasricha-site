import { handler, ok, fail, readJson } from "@/lib/abl/http";
import * as repo from "@/lib/abl/repo";
import { agentTurn, usageGate } from "@/lib/abl/service";
import { config } from "@/lib/abl/config";

type Ctx = { params: Promise<{ slug: string }> };

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const { message } = await readJson<{ message?: string }>(req);
  const msg = (message || "").trim();
  if (!msg) return fail("Empty message");
  if (msg.length > 6000) return fail("Message too long");

  const p = await repo.getParticipantBySlug(slug);
  if (!p) return fail("Session not found", 404);
  if (!p.link_approved) return fail("This session is not active yet.", 403);
  const gate = usageGate(p);
  if (!gate.ok) return fail(gate.message!, gate.status);

  const session = await repo.getOrCreateSession(p.id, "participant");
  if (!session.consent_given) return fail("Please accept the privacy notice to begin.", 403);

  const { reply, messageCount } = await agentTurn({ participant: p, session, userMessage: msg, mode: "participant" });
  return ok({
    reply,
    message_count: messageCount,
    max_messages: p.max_messages,
    soft_warn: messageCount >= config.softWarnAt,
  });
});
