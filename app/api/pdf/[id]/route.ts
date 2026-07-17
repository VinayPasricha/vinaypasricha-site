import { handler, fail } from "@/lib/abl/http";
import { isAdmin } from "@/lib/abl/auth";
import * as repo from "@/lib/abl/repo";
import { renderPdf } from "@/lib/abl/pdf";
import type { OutputType } from "@/lib/abl/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const TITLES: Record<OutputType, string> = {
  course_preparation_brief: "Course Preparation Brief",
  use_case_map: "AI Opportunity & Use-Case Map",
  strategy_note: "Personalised AI Strategy Note + 90-Day Direction",
  vinay_meeting_brief: "Private Meeting Brief for Vinay",
  share_summary: "Summary Shared with Vinay",
  siv_report: "My First AI Project Decision Report",
  ved_report: "Execution Constraint Report",
};

export const GET = handler(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const slug = new URL(req.url).searchParams.get("slug");

  // validate the id up front so a malformed value returns a clean 404 (not a leaked DB error)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return fail("Not found", 404);

  const out = await repo.getOutput(id);
  if (!out) return fail("Not found", 404);
  const p = await repo.getParticipant(out.participant_id);
  if (!p) return fail("Not found", 404);

  const admin = await isAdmin();
  if (out.output_type === "vinay_meeting_brief") {
    if (!admin) return fail("Unauthorized", 401);           // Vinay brief is admin-only
  } else if (!admin && (slug !== p.slug || !p.link_approved)) {
    return fail("Unauthorized", 401);                        // participant PDFs: matching, approved link only
  }

  const md = out.reviewed_content_markdown ?? out.content_markdown ?? "";
  const title = TITLES[out.output_type];
  const buf = await renderPdf({
    eyebrow: "AI for Business Leaders",
    title,
    metaLines: [
      `${p.name} · ${p.company_name}`,
      p.role_title || "",
      new Date(out.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    ].filter(Boolean),
    markdown: md,
  });

  const filename = `${title.replace(/[^a-z0-9]+/gi, "-")}-${p.slug}.pdf`;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
