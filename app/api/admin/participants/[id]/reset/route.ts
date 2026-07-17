import { handler, ok, fail, readJson } from "@/lib/abl/http";
import { requireAdmin } from "@/lib/abl/auth";
import * as repo from "@/lib/abl/repo";
import type { SessionMode } from "@/lib/abl/types";

type Ctx = { params: Promise<{ id: string }> };

// Reset one of a participant's conversations (participant | ved | siv) so they can restart it.
export const POST = handler(async (req: Request, { params }: Ctx) => {
  await requireAdmin();
  const { id } = await params;
  const { mode } = await readJson<{ mode?: SessionMode }>(req);
  if (!mode || !["participant", "ved", "siv"].includes(mode)) return fail("Choose a conversation to reset.");
  const p = await repo.getParticipant(id);
  if (!p) return fail("Not found", 404);
  await repo.resetConversation(id, mode);
  return ok({ reset: mode });
});
