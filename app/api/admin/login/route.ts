import { handler, ok, fail, readJson } from "@/lib/abl/http";
import { checkPassword, startAdminSession, endAdminSession } from "@/lib/abl/auth";

export const POST = handler(async (req: Request) => {
  const { password } = await readJson<{ password?: string }>(req);
  if (!checkPassword(password || "")) return fail("Incorrect password", 401);
  await startAdminSession();
  return ok({ authenticated: true });
});

export const DELETE = handler(async () => {
  await endAdminSession();
  return ok({ authenticated: false });
});
