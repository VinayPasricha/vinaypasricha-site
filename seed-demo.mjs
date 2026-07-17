// One-off: seed a 'demo' participant (Rajesh Menon / Northwind Logistics) with
// research + a prior "My AI Journey" conversation into the shared abl_* Firestore
// collections, so /workspace/s/demo is a live, approved, context-rich session.
// Run: node seed-demo.mjs
import { Firestore } from "@google-cloud/firestore";
import crypto from "node:crypto";

const db = new Firestore({ projectId: "project-65b6724f-5ba8-4e67-bf3" });
const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();

// clean up any prior demo first (idempotent)
const prior = await db.collection("abl_participants").where("slug", "==", "demo").get();
for (const d of prior.docs) {
  for (const col of ["abl_sessions", "abl_messages", "abl_outputs"]) {
    const s = await db.collection(col).where("participant_id", "==", d.id).get();
    for (const x of s.docs) await x.ref.delete();
  }
  await db.collection("abl_research").doc(d.id).delete().catch(() => {});
  await d.ref.delete();
}

const pid = uuid();
await db.collection("abl_participants").doc(pid).set({
  slug: "demo", access_code_hash: crypto.createHash("sha256").update(uuid()).digest("hex"),
  status: "active", qa_status: "not_started", link_approved: true, current_stage: null,
  name: "Rajesh Menon", company_name: "Northwind Logistics", email: "rajesh@northwind.example",
  role_title: "Chief Executive Officer", company_website: null,
  industry: "Third-party logistics (3PL)", geography: "Western India", business_model: "B2B logistics services",
  max_messages: 200, message_count: 0, vinay_brief_status: "none",
  last_activity_at: null, approved_at: now(), created_at: now(), updated_at: now(),
});

await db.collection("abl_research").doc(pid).set({
  participant_id: pid,
  structured_context: {
    customers: "Manufacturers and distributors shipping freight across western India.",
    products: "Warehousing, fleet management and last-mile 3PL services across 11 warehouses.",
    competitors: "Regional 3PLs and clients' in-house logistics teams.",
    pressures: "Volume volatility from large clients; manual planning; thin operating margins.",
    ai_relevance: "Demand forecasting, dynamic fleet allocation, customer-query automation.",
    ai_exposure: "No public evidence of AI deployment yet; planning is spreadsheet-based.",
  },
  research_dossier: "Mid-sized 3PL, ~400 staff, 11 warehouses across western India. Planning is manual (spreadsheets + WhatsApp/phone). Reacting to a client volume shift takes days and costs a day of throughput. The CEO wants a first AI project that is feasible and low-risk.",
  sources_notes: null, updated_at: now(),
});

const sid = uuid();
await db.collection("abl_sessions").doc(sid).set({
  participant_id: pid, mode: "participant", selected_depth: "30", current_stage: "use_case",
  status: "open", consent_given: true, summary_reviewed: false,
  running_summary: "Rajesh Menon, CEO of Northwind Logistics (mid-sized 3PL, western India, ~400 staff, 11 warehouses). Core constraint: demand forecasting and fleet allocation are manual and reactive; volume shifts cost a day of throughput. Exploring AI use-cases; wants a feasible, low-risk first project.",
  created_at: now(), updated_at: now(),
});

const turns = [
  ["assistant", "Welcome, Rajesh. Before the course, I'd like to understand where Northwind Logistics is today. In your own words, what does Northwind do, and what keeps you up at night?"],
  ["user", "We're a mid-sized 3PL across western India — about 400 people, 11 warehouses. Planning is the pain: demand forecasting and fleet allocation are all manual spreadsheets, so when a big client shifts volume we scramble for days."],
  ["assistant", "Understood. So the constraint isn't data, it's that planning is manual and reactive. When a client shifts volume, who notices first, and how does that reach the people who reallocate trucks?"],
  ["user", "The branch manager notices when the dock congests — we're already behind. It travels by WhatsApp up to the regional head and back down. We lose a day of throughput each time."],
];
let t = Date.parse(now());
for (const [role, content] of turns) {
  await db.collection("abl_messages").doc(uuid()).set({
    session_id: sid, participant_id: pid, role, content, metadata: {}, created_at: new Date(t).toISOString(),
  });
  t += 1000; // 1s apart so ordering is stable
}

console.log(`seeded demo participant ${pid} (slug=demo) + research + ${turns.length} prior journey messages`);
