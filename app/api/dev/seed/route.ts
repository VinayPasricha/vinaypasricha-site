// DEV-ONLY seed. Simulates a participant who ALREADY filled the live ABL runtime:
// research + an approved link + a prior "My AI Journey" conversation + a running
// summary — all written to the SHARED abl_* collections. Opening the workspace
// should then resume that exact context (proving the pickup). Idempotent.
// Disabled in production. Safe to delete.
import { handler, ok, fail } from "@/lib/abl/http";
import * as repo from "@/lib/abl/repo";

const PRIOR_TURNS: { role: "user" | "assistant"; content: string }[] = [
  { role: "assistant", content: "Welcome, Rajesh. Before the course, I'd like to understand where Northwind Logistics is today. In your own words, what does Northwind do, and what keeps you up at night?" },
  { role: "user", content: "We're a mid-sized 3PL across western India — about 400 people, 11 warehouses. Planning is the pain: demand forecasting and fleet allocation are all manual spreadsheets, so when a big client shifts volume we scramble for days." },
  { role: "assistant", content: "Understood. So the constraint isn't data, it's that planning is manual and reactive. When a client shifts volume, who notices first, and how does that reach the people who reallocate trucks?" },
  { role: "user", content: "The branch manager notices when the dock congests — we're already behind. It travels by WhatsApp up to the regional head and back down. We lose a day of throughput each time." },
];

export const GET = handler(async () => {
  if (process.env.NODE_ENV === "production") return fail("Disabled in production", 403);

  let p = await repo.getParticipantBySlug("demo");
  if (!p) {
    const created = await repo.createParticipant({
      name: "Rajesh Menon", company_name: "Northwind Logistics",
      email: "rajesh@northwind.example", role_title: "Chief Executive Officer",
      industry: "Third-party logistics (3PL)", geography: "Western India",
      business_model: "B2B logistics services",
    });
    p = created;
  }
  // approved, active link
  p = await repo.updateParticipant(p.id, {
    slug: "demo", link_approved: true, status: "active",
    approved_at: new Date().toISOString(),
  });

  // research (what the ABL runtime captured about them)
  await repo.upsertResearch(p.id, {
    structured_context: {
      customers: "Manufacturers and distributors shipping freight across western India.",
      products: "Warehousing, fleet management and last-mile 3PL services across 11 warehouses.",
      competitors: "Regional 3PLs and clients' in-house logistics teams.",
      pressures: "Volume volatility from large clients; manual planning; thin operating margins.",
      ai_relevance: "Demand forecasting, dynamic fleet allocation, customer-query automation.",
      ai_exposure: "No public evidence of AI deployment yet; planning is spreadsheet-based.",
    },
    research_dossier:
      "Mid-sized 3PL, ~400 staff, 11 warehouses across western India. Planning is manual " +
      "(spreadsheets + WhatsApp/phone). Reacting to a client volume shift takes days and costs a " +
      "day of throughput. The CEO wants a first AI project that is feasible and low-risk.",
  });

  // a prior "My AI Journey" conversation (participant mode) — as if done already
  const session = await repo.getOrCreateSession(p.id, "participant");
  const existing = await repo.listMessages(session.id);
  if (existing.length === 0) {
    await repo.updateSession(session.id, {
      consent_given: true, selected_depth: "30", current_stage: "use_case",
      running_summary:
        "Rajesh Menon, CEO of Northwind Logistics (mid-sized 3PL, western India, ~400 staff, 11 " +
        "warehouses). Core constraint: demand forecasting and fleet allocation are manual and " +
        "reactive; volume shifts cost a day of throughput. Exploring AI use-cases; wants a feasible, " +
        "low-risk first project. Data is cleanest for demand forecasting.",
    });
    for (const t of PRIOR_TURNS) {
      await repo.addMessage({ session_id: session.id, participant_id: p.id, role: t.role, content: t.content });
    }
  }

  const msgs = await repo.listMessages(session.id);
  return ok({ slug: p.slug, id: p.id, prior_journey_messages: msgs.length, link: "/workspace/s/demo" });
});
