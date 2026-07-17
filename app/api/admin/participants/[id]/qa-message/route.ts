import { handler, ok, fail, readJson } from "@/lib/abl/http";
import { requireAdmin } from "@/lib/abl/auth";
import * as repo from "@/lib/abl/repo";
import { agentTurn } from "@/lib/abl/service";
import type { Depth } from "@/lib/abl/types";

type Ctx = { params: Promise<{ id: string }> };

// Assistant QA "test chat" — talks to the agent as if the participant, in a separate qa session.
export const POST = handler(async (req: Request, { params }: Ctx) => {
  await requireAdmin();
  const { id } = await params;
  const { message, depth } = await readJson<{ message?: string; depth?: Depth }>(req);
  const msg = (message || "").trim();
  if (!msg) return fail("Empty message");

  const p = await repo.getParticipant(id);
  if (!p) return fail("Not found", 404);

  const session = await repo.getOrCreateSession(id, "qa");
  // Admin testing implies consent; set depth if provided so the journey can be exercised.
  const patch: Record<string, unknown> = { consent_given: true };
  if (depth && ["15", "30", "45"].includes(depth)) patch.selected_depth = depth;
  const testSession = await repo.updateSession(session.id, patch);

  const { reply } = await agentTurn({ participant: p, session: testSession, userMessage: msg, mode: "qa" });
  return ok({ reply });
});

// Reset the QA test conversation (clear qa-session messages) — handy while iterating.
export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  await requireAdmin();
  const { id } = await params;
  const session = await repo.getOrCreateSession(id, "qa");
  await repo.updateSession(session.id, { running_summary: null });
  // messages cascade is not needed; simply start a fresh logical thread by clearing summary.
  return ok({ reset: true, session_id: session.id });
});
