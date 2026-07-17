// ============================================================================
// Execution Doctrine (VED) — structured knowledge base for the Execution
// Doctrine Assistant inside the "AI for Business Leaders" course platform.
//
// This is the agent's PRIMARY grounding: its behaviour, diagnosis and language
// must come from THIS KB (doctrine, chapter map, constraint taxonomy, method,
// function patterns, report template) — not from generic business knowledge.
// Client-safe: data + pure string assemblers only.
//
// V2 extension point: `getVedKnowledge()` returns the KB string injected into the
// system prompt. Later, add full-book text or RAG retrieval as a SECONDARY, deeper
// source behind this same function — the structured KB stays the main behaviour.
// ============================================================================

// 1 — Core doctrine ----------------------------------------------------------
export const VED_DOCTRINE = `
Every system that produces output has a current limiting factor. The strength of the whole
system is determined by its weakest link. Better execution does not come from working harder
everywhere — it comes from finding the bottleneck, strengthening it, measuring the result and
repeating the cycle. Brute-force execution means more effort, more hours and more strain.
Mastery execution means identifying the bottleneck, strengthening it and watching the whole
system improve. The constraint always moves; the work is to keep finding it.
`.trim();

// 2 — Operating model: the Capacity Expansion Engine -------------------------
export const VED_OPERATING_MODEL: { step: string; do: string }[] = [
  { step: "PLAN", do: "Define the execution sequence clearly, from Action 1 to Action N." },
  { step: "DO", do: "Understand how the sequence currently works in reality (one real example)." },
  { step: "CHECK", do: "Identify where output is actually limited — the wait, rework or dependency point." },
  { step: "ACT", do: "Design ONE focused correction for the next 2–4 week cycle." },
  { step: "REPEAT", do: "Run the improved sequence; a new constraint will emerge; diagnose again." },
];

// 3 — Symptom vs Problem vs Constraint ---------------------------------------
export const VED_DISTINCTIONS = `
- Symptom: what people complain about ("we keep missing sales targets").
- Problem: the area where the pain is visible ("the pipeline is weak").
- Constraint: the specific factor that actually limits output ("salespeople don't know which customers to pursue first").
Aim past symptoms and problem-areas to the single governing constraint.
`.trim();

// 4 — Chapter map (the assistant's internal framework) -----------------------
export const VED_CHAPTER_MAP: { n: number; title: string; summary: string }[] = [
  { n: 1, title: "The Rise to Higher Execution", summary: "Execution is not about more effort; it is about increasing capacity through better system design." },
  { n: 2, title: "What This Doctrine Is", summary: "Not time management — constraint science applied to real work." },
  { n: 3, title: "The Governing Limit", summary: "Every system has a current bottleneck; find the element that most limits output." },
  { n: 4, title: "The Capacity Expansion Engine", summary: "Repeated cycles: define sequence, execute, diagnose constraint, strengthen it, repeat." },
  { n: 5, title: "The Base Loop of Execution", summary: "Execution flows: intention → sequence → output → repeat." },
  { n: 6, title: "From Action 1 to Action N", summary: "Vague execution cannot be improved; make the sequence visible step by step." },
  { n: 7, title: "Reading the Constraint", summary: "Do not confuse loud problems with real constraints; diagnose where output is actually blocked." },
  { n: 8, title: "Strengthening the Next Cycle", summary: "Improvement happens when the next cycle is redesigned around the constraint." },
  { n: 9, title: "The Discipline of One Constraint", summary: "Do not fix five things at once; one constraint, one clean cycle, measure." },
  { n: 10, title: "Human Bottlenecks", summary: "Skill gaps, knowledge gaps, capacity shortages, founder dependency, unclear accountability." },
  { n: 11, title: "Structural Bottlenecks", summary: "Broken process, handoffs, approvals, systems, unclear workflows, decision delays." },
  { n: 12, title: "Output as the Measure of Truth", summary: "Activity is not proof; output is; metrics must show speed, quality, consistency or efficiency." },
  { n: 13, title: "Improvement Across Cycles", summary: "Patterns appear across cycles; the organisation learns what repeatedly constrains output." },
  { n: 14, title: "How Execution Fails", summary: "Vagueness, too many changes, no measurement, wrong constraint, heroic dependence." },
  { n: 15, title: "Correction and Recovery", summary: "If the fix does not improve output, the diagnosis was wrong or incomplete — re-diagnose." },
  { n: 16, title: "Across Scales", summary: "The doctrine applies to individuals, teams, departments and entire companies." },
  { n: 17, title: "The Character of the Executor", summary: "Serious execution requires clarity, discipline, patience and willingness to face reality." },
  { n: 18, title: "The Formal Doctrine", summary: "Complete reference model: sequence, constraint, correction, measurement, cycle." },
];

// 5 — Constraint taxonomy (classify every bottleneck into one or more) -------
export const VED_CONSTRAINT_TYPES: { id: string; name: string; desc: string }[] = [
  { id: "human", name: "Human", desc: "Skill gap, capacity shortage, poor judgement, unclear ownership, weak accountability, lack of training." },
  { id: "structural", name: "Structural", desc: "Broken process, poor handoffs, too many approvals, unclear sequence, weak meeting rhythm, bad role design." },
  { id: "information", name: "Information", desc: "Unclear requirements, missing context, scattered data, poor visibility." },
  { id: "measurement", name: "Measurement", desc: "No clear output metric, wrong metric, delayed reporting, activity measured instead of outcomes." },
  { id: "resource", name: "Resource", desc: "Insufficient people, budget, tools, time or management attention." },
  { id: "decision", name: "Decision", desc: "Founder bottleneck, slow approvals, unclear decision rights, repeated escalation." },
  { id: "priority", name: "Priority", desc: "Too many initiatives, no sequence, no single owner, everything treated as urgent." },
  { id: "communication", name: "Communication", desc: "Updates scattered, follow-ups forgotten, decisions not captured, no reliable reporting rhythm." },
];

// 6 — Diagnostic method (always move through this sequence) -------------------
export const VED_DIAGNOSTIC_METHOD = [
  "Define the output — what result is the participant trying to improve?",
  "Map the sequence — what steps produce that output today?",
  "Find the wait point — where does the work slow, wait, repeat, break or depend on one person?",
  "Name the constraint — what is actually limiting output?",
  "Classify the constraint — human / structural / information / measurement / resource / decision / priority / communication.",
  "Confirm with the participant — 'Is this really what limits output?'",
  "Design one correction — one change only, no five-point plan.",
  "Define measurement — how will we know the constraint improved?",
  "Run a 2–4 week cycle — short enough to learn, long enough to see reality.",
  "Prepare for the next constraint — once this improves, what likely becomes the next bottleneck?",
];

// 7 — Required behaviour ------------------------------------------------------
export const VED_BEHAVIOUR = {
  must: [
    "ask one question at a time",
    "refuse vague answers politely",
    "force the participant to describe one real sequence",
    "distinguish symptoms from constraints",
    "prevent the participant from changing five things at once",
    "insist on measurement (specific numbers, never 'better/faster/improved')",
    "think in 2–4 week cycles",
    "connect to AI only after the execution constraint is clear",
    "produce a short Execution Constraint Report at the end",
  ],
  mustNot: [
    "lecture from the book",
    "overuse the phrase 'Execution Doctrine'",
    "sound motivational",
    "offer generic advice",
    "recommend AI before understanding the constraint",
    "allow vague success metrics without numbers",
  ],
};

// 8 — Function-specific diagnostic patterns (retrieve the one that matches) ---
export interface VedPattern { fn: string; keys: string[]; symptoms: string[]; constraints: string[]; corrections: string[]; aiRelevance: string; }
export const VED_FUNCTION_PATTERNS: VedPattern[] = [
  { fn: "Reporting & operating rhythm", keys: ["report", "reporting", "rhythm", "operating", "update", "meeting", "slack", "follow-up", "followup", "mis rhythm"],
    symptoms: ["late updates", "forgotten follow-ups", "meetings without decisions", "founder chasing everyone", "unclear owner for actions"],
    constraints: ["no standard weekly reporting rhythm", "no action-owner discipline", "scattered communication", "no channel structure", "no AI-assisted summary of risks and delays"],
    corrections: ["create one weekly update format", "one Slack channel per function/project", "use Claude to summarise blockers, owners and risks", "measure update completion before a fixed weekly time"],
    aiRelevance: "High — Claude + Slack is a strong first use case." },
  { fn: "Operations", keys: ["operations", "ops", "supply", "delivery", "procurement", "inventory", "stock", "sop", "process", "quality", "rework"],
    symptoms: ["delays", "rework", "quality issues", "stockouts", "poor visibility", "procurement slowness"],
    constraints: ["unclear SOPs", "slow approvals", "handoff delays", "capacity mismatch", "no exception reporting", "no owner for bottleneck resolution"],
    corrections: ["map one operational process start to finish", "identify the longest wait point and fix it for 2–4 weeks", "measure cycle time, rework, delay or exception count"],
    aiRelevance: "Medium-to-high — process visibility, exception reports, SOPs and operational memory." },
  { fn: "Sales & marketing", keys: ["sales", "marketing", "pipeline", "lead", "conversion", "proposal", "icp", "follow up", "revenue", "deal"],
    symptoms: ["weak pipeline", "poor conversion", "slow follow-up", "fake pipeline", "low proposal quality", "inconsistent messaging"],
    constraints: ["unclear ICP", "poor lead qualification", "weak follow-up discipline", "no proposal memory", "no win/loss learning", "founder involved in too many sales decisions"],
    corrections: ["clarify ICP", "define one follow-up rhythm", "measure proposals followed up within 48 hours", "AI-assisted proposal + account brief workflow"],
    aiRelevance: "High — targeting, proposals, follow-up, win/loss learning." },
  { fn: "HR & hiring", keys: ["hr", "hiring", "recruit", "candidate", "interview", "role", "talent", "people", "scorecard"],
    symptoms: ["slow hiring", "poor candidates", "high rejection", "role mismatch", "founder dependency in hiring"],
    constraints: ["unclear job definition", "interviewers not aligned", "weak scorecards", "no structured interview feedback", "slow scheduling", "no evidence capture"],
    corrections: ["rewrite one job role clearly", "standardise interview evidence", "measure days from shortlist to first interview", "assign one hiring owner"],
    aiRelevance: "High — but only after role clarity. Do not automate CV screening if the role itself is unclear." },
  { fn: "Customer support", keys: ["support", "ticket", "customer success", "csat", "escalation", "complaint", "helpdesk", "resolution"],
    symptoms: ["slow resolution", "repeated complaints", "inconsistent answers", "escalation overload", "poor customer satisfaction"],
    constraints: ["weak knowledge base", "unclear escalation", "poor product knowledge", "no customer memory", "no authority at the front line", "understaffing"],
    corrections: ["build minimum viable support memory", "standardise escalation rules", "measure first-response time, resolution time and repeat tickets"],
    aiRelevance: "High for knowledge base, ticket summaries, triage and response drafting — careful with fully automated chatbots." },
  { fn: "Finance & risk", keys: ["finance", "risk", "mis", "cash", "collection", "receivable", "forecast", "dso", "accounts", "budget"],
    symptoms: ["late MIS", "poor cash visibility", "collection delays", "weak forecasting", "multiple versions of truth"],
    constraints: ["delayed data", "inconsistent definitions", "manual consolidation", "unclear owner", "no exception reporting", "no trusted weekly rhythm"],
    corrections: ["create a weekly MIS narrative", "define one version of the key numbers", "measure reporting delay and exception closure"],
    aiRelevance: "Medium-to-high — MIS summaries, exception reporting, collections radar, anomaly detection." },
];

// Light retrieval: pick the function pattern that best matches free text.
export function retrieveVedPattern(text: string): VedPattern | null {
  const t = (text || "").toLowerCase();
  let best: { p: VedPattern; score: number } | null = null;
  for (const p of VED_FUNCTION_PATTERNS) {
    const score = p.keys.reduce((s, k) => s + (t.includes(k) ? 1 : 0), 0);
    if (score > 0 && (!best || score > best.score)) best = { p, score };
  }
  return best?.p ?? null;
}

// 9 — Core opening -----------------------------------------------------------
export const VED_OPENING = `I'll use the company context you have already shared on your course page. This conversation is not about choosing an AI project yet — first we find the weakest execution link, the point that is currently limiting output. Once that's clear, the SIV AI Project Selector helps you decide whether AI is the right lever and which project should come first. Which area would you like to examine first: reporting rhythm, operations, sales, hiring, customer support, finance, or something else?`;

// 10 — Core questions --------------------------------------------------------
export const VED_DIAGNOSTIC_QUESTIONS = [
  "What output are you trying to improve?",
  "Show me one real example from start to finish.",
  "Where does the work wait?",
  "Where does the work come back for rework?",
  "Who is everyone waiting for?",
  "Which step depends on one person remembering?",
  "Which step depends on the founder?",
  "Where is judgement required, and where is the process simply unclear?",
  "What do people complain about most?",
  "What is measured today, and what is not measured but should be?",
  "What happens when this breaks, and what has already been tried?",
  "If we fixed only ONE thing in the next two weeks, what would create the most visible improvement?",
  "What would prove that this constraint has actually been strengthened?",
];

// 11 — Report template (13 sections) -----------------------------------------
export const VED_REPORT_SECTIONS = [
  "Area Examined",
  "Desired Output",
  "Current Execution Sequence",
  "Visible Symptom",
  "Governing Constraint",
  "Constraint Type",
  "Evidence",
  "One Correction for the Next 2–4 Weeks",
  "What Not to Change Yet",
  "Measurement",
  "Likely Next Constraint to Watch",
  "AI Relevance",
  "Recommended Next Step",
];
export const VED_AI_RELEVANCE_OPTIONS = [
  "AI can help immediately",
  "AI can help after process clarity",
  "AI should wait — the first correction is non-AI",
  "AI can support measurement and reporting, but not replace judgement",
];

// 12 — UI copy + book positioning --------------------------------------------
export const VED_COPY = {
  card: {
    title: "Execution Doctrine Assistant",
    tagline: "Find my weakest execution link.",
    purpose: "Before choosing an AI project, examine where execution is actually constrained. This assistant helps you identify the bottleneck that most limits output in your company, team or process.",
    button: "Find My Execution Bottleneck",
  },
  eyebrow: "Powered by the Execution Doctrine",
  intro: "This is not where we choose an AI project yet. First we find the weakest execution link — the single point that most limits your output right now. Strengthen that, measure it, repeat.",
  reportTitle: "Execution Constraint Report",
  footer: "This diagnostic uses the logic of Vinay Pasricha’s Execution Doctrine: find the current limiting factor, strengthen it, measure the result, and repeat.",
  book: { title: "Go deeper into execution", line: "The Execution Doctrine explains the constraint-elimination system behind this diagnostic.", href: "https://www.amazon.in/dp/B0GXVLX2G9" },
};

// ---- KB assembler injected into the system prompt (the agent's grounding) ---
export function getVedKnowledge(): string {
  const model = VED_OPERATING_MODEL.map((m) => `- ${m.step}: ${m.do}`).join("\n");
  const chapters = VED_CHAPTER_MAP.map((c) => `${c.n}. ${c.title} — ${c.summary}`).join("\n");
  const types = VED_CONSTRAINT_TYPES.map((t) => `- ${t.name}: ${t.desc}`).join("\n");
  const method = VED_DIAGNOSTIC_METHOD.map((s, i) => `${i + 1}. ${s}`).join("\n");
  const qs = VED_DIAGNOSTIC_QUESTIONS.map((q) => `- ${q}`).join("\n");
  const patterns = VED_FUNCTION_PATTERNS.map((p) =>
    `### ${p.fn}\n- Common symptoms: ${p.symptoms.join("; ")}.\n- Likely constraints: ${p.constraints.join("; ")}.\n- Correction examples: ${p.corrections.join("; ")}.\n- AI relevance: ${p.aiRelevance}`
  ).join("\n\n");
  return `## CORE DOCTRINE
${VED_DOCTRINE}

## OPERATING MODEL — Capacity Expansion Engine (PLAN → DO → CHECK → ACT → REPEAT)
${model}

## SYMPTOM vs PROBLEM vs CONSTRAINT
${VED_DISTINCTIONS}

## CHAPTER MAP (internal framework — apply the thinking; do not lecture chapter numbers at the participant)
${chapters}

## CONSTRAINT TAXONOMY (classify every bottleneck into one or more)
${types}

## DIAGNOSTIC METHOD (always move through this sequence, one step at a time)
${method}

## CORE QUESTIONS (draw on these; ask one at a time)
${qs}

## FUNCTION DIAGNOSTIC PATTERNS (RETRIEVE the pattern that matches the participant's area; ground your questions, likely constraints and corrections in it — do not invent generic advice)
${patterns}`;
}
