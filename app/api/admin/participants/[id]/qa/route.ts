import { handler, ok, readJson } from "@/lib/abl/http";
import { requireAdmin } from "@/lib/abl/auth";
import * as repo from "@/lib/abl/repo";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: Request, { params }: Ctx) => {
  await requireAdmin();
  const { id } = await params;
  return ok(await repo.getQa(id));
});

export const PUT = handler(async (req: Request, { params }: Ctx) => {
  await requireAdmin();
  const { id } = await params;
  const b = await readJson<{ checklist?: Record<string, unknown>; notes?: string; status?: string; tested_by?: string; approved_by?: string }>(req);
  const status = b.status ?? "in_progress";
  const qa = await repo.upsertQa(id, {
    checklist: b.checklist ?? {},
    notes: b.notes,
    status,
    tested_by: b.tested_by,
    approved_by: b.approved_by,
    approved_at: status === "passed" ? new Date().toISOString() : null,
  });
  if (status === "passed") await repo.updateParticipant(id, { qa_status: "passed", status: "qa_approved" });
  else if (status === "failed") await repo.updateParticipant(id, { qa_status: "failed" });
  else await repo.updateParticipant(id, { qa_status: "in_progress", status: "qa_pending" });
  return ok(qa);
});
