// Shared types for the AI-for-Business-Leaders module (safe to import anywhere).

export type ParticipantStatus =
  | "draft" | "research_added" | "qa_pending" | "qa_approved"
  | "link_ready" | "active" | "completed";

export type QaStatus = "not_started" | "in_progress" | "passed" | "failed";

export type Depth = "15" | "30" | "45";

export type Stage =
  | "personalisation" | "use_case" | "strategy"
  | "reward" | "summary_review" | "done";

export type OutputType =
  | "course_preparation_brief" | "use_case_map" | "strategy_note"
  | "vinay_meeting_brief" | "share_summary" | "siv_report" | "ved_report";

export interface Participant {
  id: string;
  slug: string;
  name: string;
  email: string | null;
  company_name: string;
  role_title: string | null;
  company_website: string | null;
  industry: string | null;
  geography: string | null;
  business_model: string | null;
  status: ParticipantStatus;
  qa_status: QaStatus;
  link_approved: boolean;
  current_stage: Stage | null;
  max_messages: number;
  message_count: number;
  access_paused: boolean;
  daily_limit: number;
  daily_count: number;
  daily_date: string | null;
  token_budget: number | null;
  token_estimate: number;
  vinay_brief_status: "none" | "generated";
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
}

// Free-form structured research the admin enters (stored in participant_research.structured_context)
export interface StructuredContext {
  customers?: string;
  products?: string;
  competitors?: string;
  pressures?: string;       // current business pressures
  ai_relevance?: string;    // likely AI relevance
  ai_exposure?: string;     // current known AI exposure
  [k: string]: string | undefined;
}

export interface ParticipantResearch {
  id: string;
  participant_id: string;
  structured_context: StructuredContext;
  research_dossier: string | null;
  sources_notes: string | null;
}

export type SessionMode = "participant" | "qa" | "siv" | "ved";

export interface ChatSession {
  id: string;
  participant_id: string;
  mode: SessionMode;
  selected_depth: string | null;   // "15|30|45" for participant/qa; "fast|standard|deep" for siv
  current_stage: Stage | null;
  status: "open" | "completed";
  consent_given: boolean;
  summary_reviewed: boolean;
  running_summary: string | null;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  participant_id: string;
  role: "system" | "user" | "assistant" | "admin";
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface GeneratedOutput {
  id: string;
  participant_id: string;
  session_id: string | null;
  output_type: OutputType;
  content_markdown: string | null;
  content_json: unknown;
  reviewed_content_markdown: string | null;
  participant_approved: boolean;
  created_at: string;
  updated_at: string;
}

// QA checklist definition (single source of truth for the checklist UI + gating)
export const QA_ITEMS: { key: string; label: string }[] = [
  { key: "name_correct", label: "Participant name is correct" },
  { key: "company_correct", label: "Company name is correct" },
  { key: "role_correct", label: "Role / context is correct" },
  { key: "research_fields", label: "Research fields are loaded" },
  { key: "research_dossier", label: "Research dossier is loaded" },
  { key: "greets", label: "Agent greets correctly" },
  { key: "offers_journeys", label: "Agent offers 15 / 30 / 45 minute journey" },
  { key: "no_readiness_assumption", label: "Agent does not assume AI implementation readiness" },
  { key: "intelligent_questions", label: "Agent asks intelligent questions" },
  { key: "uses_framework", label: "Agent uses the course / book framework appropriately" },
  { key: "humble_research", label: "Agent is humble about research and asks participant to correct it" },
  { key: "privacy_notice", label: "Privacy / sharing notice appears" },
  { key: "reward_works", label: "Reward generation works" },
  { key: "vinay_brief_works", label: "Vinay brief generation works" },
];

export type QaChecklist = Record<string, { pass: boolean | null; note?: string }>;

export const DEPTHS: { id: Depth; minutes: string; title: string; blurb: string; reward: string }[] = [
  { id: "15", minutes: "15 minutes", title: "Course Personalisation Interview",
    blurb: "Best if you want to quickly help Vinay understand your company, role, current AI exposure, learning goals, and what you want from the course.",
    reward: "Course Preparation Brief" },
  { id: "30", minutes: "30 minutes", title: "AI Use-Case Discovery",
    blurb: "Best if you want to explore where AI may or may not be relevant in your company.",
    reward: "AI Opportunity & Use-Case Map" },
  { id: "45", minutes: "45 minutes", title: "AI Strategy Session",
    blurb: "Best if you want a deeper first draft of possible AI priorities, risks, readiness gaps, and a sensible 90-day direction.",
    reward: "Personalised AI Strategy Note + 90-Day Direction" },
];
