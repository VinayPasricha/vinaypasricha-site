// SIV AI Project Selector — knowledge base (client-safe: data + pure helpers only).
// The SIV Method (Socratic Iterative Vinay) adapted for AI project selection: help a
// leader decide where AI should enter their company FIRST by examining candidate
// projects through structured lenses before committing to any of them.

export type SivDepth = "fast" | "standard" | "deep";

export interface SivLens {
  id: string;
  name: string;
  q: string; // the core question this lens forces
}

// The 21 SIV lenses (superset). Depth tiers select from these.
export const SIV_LENSES: SivLens[] = [
  { id: "stated_problem", name: "Stated Problem", q: "What does the participant think the problem is?" },
  { id: "actual_problem", name: "Actual Problem", q: "What may really be happening beneath the stated problem?" },
  { id: "symptom_cause", name: "Symptom vs Cause", q: "Is AI being aimed at a symptom rather than the underlying cause?" },
  { id: "evidence", name: "Evidence", q: "What data or evidence proves this is a real, expensive problem?" },
  { id: "assumption", name: "Assumption", q: "What is being assumed but not verified?" },
  { id: "falsification", name: "Falsification", q: "What evidence would prove this idea wrong?" },
  { id: "workflow_reality", name: "Workflow Reality", q: "How does this work actually happen today, step by step, including the messy exceptions?" },
  { id: "constraint", name: "Constraint", q: "What will block success — data, people, incentives, systems, rules?" },
  { id: "non_ai_alt", name: "Non-AI Alternative", q: "Could a process redesign solve this without AI?" },
  { id: "data_readiness", name: "Data Readiness", q: "Does usable, accessible data actually exist for this?" },
  { id: "human_judgment", name: "Human Judgment", q: "Where must humans remain in control?" },
  { id: "adoption", name: "Adoption", q: "Will people actually use this in their real workday?" },
  { id: "owner", name: "Owner", q: "Who clearly owns the workflow and this outcome?" },
  { id: "metric", name: "Metric", q: "What single number will move if this works?" },
  { id: "roi", name: "ROI", q: "What is the economic logic — the value, honestly estimated?" },
  { id: "risk", name: "Risk", q: "What is the customer, legal, brand, financial and privacy risk?" },
  { id: "sequence", name: "Sequence", q: "What must happen before AI can be applied here?" },
  { id: "feasibility_90", name: "90-Day Feasibility", q: "Can a real pilot be run within 90 days?" },
  { id: "company_brain", name: "Company Brain", q: "Does this strengthen Memory, Reasoning, Action or Feedback?" },
  { id: "leverage", name: "Strategic Leverage", q: "Will this create compounding advantage, not a one-off gain?" },
  { id: "first_bet", name: "First Bet", q: "Is this the right FIRST AI project — not merely a good future one?" },
];

const byId = (ids: string[]) => ids.map((id) => SIV_LENSES.find((l) => l.id === id)!).filter(Boolean);

// Curated lens sets per depth.
const FAST_IDS = ["stated_problem", "symptom_cause", "evidence", "data_readiness", "owner", "metric", "feasibility_90"];
const STANDARD_IDS = [
  "symptom_cause", "evidence", "assumption", "workflow_reality", "data_readiness",
  "human_judgment", "owner", "metric", "risk", "feasibility_90", "roi", "sequence",
];

export const SIV_DEPTHS: { id: SivDepth; lensCount: number; title: string; minutes: string; blurb: string; recommended?: boolean }[] = [
  { id: "fast", lensCount: 7, title: "Fast Scan", minutes: "10–15 minutes",
    blurb: "Seven lenses. For busy leaders who want a quick, disciplined read on where AI should go first." },
  { id: "standard", lensCount: 12, title: "Standard SIV", minutes: "20–30 minutes", recommended: true,
    blurb: "Twelve lenses. The recommended examination — enough rigour to make a real decision you can defend." },
  { id: "deep", lensCount: 21, title: "Deep SIV", minutes: "45–60 minutes",
    blurb: "Twenty-one lenses. A rigorous, founder-level examination for a decision you want fully stress-tested." },
];

export function lensesForDepth(depth: SivDepth): SivLens[] {
  if (depth === "deep") return SIV_LENSES;
  if (depth === "standard") return byId(STANDARD_IDS);
  return byId(FAST_IDS);
}
export function depthMeta(depth: SivDepth | null) {
  return SIV_DEPTHS.find((d) => d.id === depth) ?? null;
}

// The 16 sections of the final report (single source of truth for prompt + any UI).
export const SIV_REPORT_SECTIONS = [
  "Company Context",
  "Projects Considered",
  "SIV Depth Selected",
  "Key Reality Check",
  "Main Assumptions Exposed",
  "Hidden Constraints",
  "Recommended First AI Project",
  "Why This Project Comes First",
  "Why Other Projects Should Wait",
  "Workflow to Change",
  "Owner",
  "Success Metric",
  "Data Needed",
  "Risks and Guardrails",
  "First 30 Days",
  "90-Day Pilot Direction",
];

// UI copy for the participant page block.
export const SIV_COPY = {
  eyebrow: "Powered by the SIV Method",
  title: "Your AI Project Decision System",
  intro:
    "You have already shared context about your company. Now this system will help you decide where AI should be applied first. It will not simply ask what sounds exciting. It will examine your assumptions, your workflow, your data, your people, your risks and your expected ROI — and then recommend the first AI project you should undertake.",
  footer:
    "This decision process uses Vinay Pasricha’s SIV Method — Socratic Iterative Vinay — adapted for AI project selection in the AI for Business Leaders course.",
  reportTitle: "My First AI Project Decision Report",
  card: {
    title: "SIV AI Project Selector",
    tagline: "Choose my first AI project.",
    purpose: "Once you understand your company context and weakest execution link, this assistant helps you examine possible AI projects rigorously and decide which one should come first.",
    button: "Choose My First AI Project",
  },
  book: { title: "Go deeper into decision-making", line: "The SIV Method explains the thinking discipline behind the AI Project Selector.", href: "https://www.amazon.in/dp/B0GX27LGJX" },
};
