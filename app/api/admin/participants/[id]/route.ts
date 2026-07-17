import { handler, ok, fail, readJson } from "@/lib/abl/http";
import { requireAdmin } from "@/lib/abl/auth";
import * as repo from "@/lib/abl/repo";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: Request, { params }: Ctx) => {
  await requireAdmin();
  const { id } = await params;
  const participant = await repo.getParticipant(id);
  if (!participant) return fail("Not found", 404);
  const [research, qa, outputs] = await Promise.all([
    repo.getResearch(id), repo.getQa(id), repo.getOutputs(id),
  ]);
  return ok({ participant, research, qa, outputs });
});

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  await requireAdmin();
  const { id } = await params;
  const b = await readJson<Record<string, unknown>>(req);
  const allowed = ["name", "email", "company_name", "role_title", "company_website", "industry", "geography", "business_model",
    "max_messages", "access_paused", "daily_limit", "token_budget"];
  const patch: Record<string, unknown> = {};
  for (const k of allowed) if (k in b) patch[k] = b[k];
  const p = await repo.updateParticipant(id, patch);
  return ok(p);
});
