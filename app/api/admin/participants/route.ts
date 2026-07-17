import { handler, ok, fail, readJson } from "@/lib/abl/http";
import { requireAdmin } from "@/lib/abl/auth";
import * as repo from "@/lib/abl/repo";

export const GET = handler(async () => {
  await requireAdmin();
  return ok(await repo.listParticipants());
});

export const POST = handler(async (req: Request) => {
  await requireAdmin();
  const b = await readJson<Record<string, string>>(req);
  if (!b.name?.trim()) return fail("Participant name is required");
  if (!b.company_name?.trim()) return fail("Company name is required");
  const p = await repo.createParticipant({
    name: b.name.trim(), company_name: b.company_name.trim(),
    email: b.email, role_title: b.role_title, company_website: b.company_website,
    industry: b.industry, geography: b.geography, business_model: b.business_model,
  });
  return ok(p, 201);
});
