import { handler, ok } from "@/lib/abl/http";
import { requireAdmin } from "@/lib/abl/auth";
import * as repo from "@/lib/abl/repo";

type Ctx = { params: Promise<{ id: string }> };

// Approve the participant link (enables the copy-able link + activates the session route).
export const POST = handler(async (_req: Request, { params }: Ctx) => {
  await requireAdmin();
  const { id } = await params;
  const p = await repo.updateParticipant(id, {
    link_approved: true,
    status: "link_ready",
    approved_at: new Date().toISOString(),
  });
  return ok(p);
});

// Un-approve (revoke) — disables the link again.
export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  await requireAdmin();
  const { id } = await params;
  const p = await repo.updateParticipant(id, { link_approved: false, status: "qa_approved" });
  return ok(p);
});
