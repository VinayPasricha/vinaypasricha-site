import { handler, ok } from "@/lib/abl/http";
import { requireAdmin } from "@/lib/abl/auth";
import * as repo from "@/lib/abl/repo";
import type { StructuredContext } from "@/lib/abl/types";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = handler(async (req: Request, { params }: Ctx) => {
  await requireAdmin();
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const research = await repo.upsertResearch(id, {
    structured_context: (b.structured_context ?? {}) as StructuredContext,
    research_dossier: b.research_dossier,
    sources_notes: b.sources_notes,
  });
  const p = await repo.getParticipant(id);
  if (p && p.status === "draft") await repo.setStatus(id, "research_added");
  return ok(research);
});
