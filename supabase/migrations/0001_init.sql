-- ============================================================================
-- AI for Business Leaders — course-preparation agent  ·  V1 schema
-- ----------------------------------------------------------------------------
-- All application access is server-side using the Supabase SERVICE ROLE key
-- (which bypasses RLS). RLS is enabled with NO public policies, so the anon
-- key can read/write nothing directly. Participant access is authorised in
-- the API layer by matching the unguessable session slug.
-- Run in the Supabase SQL editor (or `supabase db push`).
-- ============================================================================

create extension if not exists "pgcrypto";

-- updated_at helper -----------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- participants ----------------------------------------------------------------
create table if not exists participants (
  id                uuid primary key default gen_random_uuid(),
  slug              text unique not null,          -- e.g. "rajesh-8f3k2" (readable + random)
  access_code_hash  text,                          -- sha256 of the random suffix (future rotation)
  name              text not null,
  email             text,
  company_name      text not null,
  role_title        text,
  company_website   text,
  industry          text,
  geography         text,
  business_model    text,
  status            text not null default 'draft',      -- draft|research_added|qa_pending|qa_approved|link_ready|active|completed
  qa_status         text not null default 'not_started',-- not_started|in_progress|passed|failed
  link_approved     boolean not null default false,
  current_stage     text,                               -- personalisation|use_case|strategy|reward|summary_review|done
  max_messages      integer not null default 200,
  message_count     integer not null default 0,
  vinay_brief_status text not null default 'none',       -- none|generated
  last_activity_at  timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  approved_at       timestamptz
);
create index if not exists idx_participants_status on participants(status);
create index if not exists idx_participants_updated on participants(updated_at desc);
drop trigger if exists trg_participants_updated on participants;
create trigger trg_participants_updated before update on participants
  for each row execute function set_updated_at();

-- participant_research --------------------------------------------------------
create table if not exists participant_research (
  id                 uuid primary key default gen_random_uuid(),
  participant_id     uuid not null references participants(id) on delete cascade,
  structured_context jsonb not null default '{}'::jsonb,  -- customers, products, competitors, pressures, ai_relevance, ai_exposure...
  research_dossier   text,
  sources_notes      text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create unique index if not exists idx_research_participant on participant_research(participant_id);
drop trigger if exists trg_research_updated on participant_research;
create trigger trg_research_updated before update on participant_research
  for each row execute function set_updated_at();

-- chat_sessions ---------------------------------------------------------------
create table if not exists chat_sessions (
  id               uuid primary key default gen_random_uuid(),
  participant_id   uuid not null references participants(id) on delete cascade,
  mode             text not null default 'participant',  -- participant|qa
  selected_depth   text,                                 -- 15|30|45
  current_stage    text,
  status           text not null default 'open',         -- open|completed
  consent_given    boolean not null default false,
  summary_reviewed boolean not null default false,
  running_summary  text,                                 -- compact rolling summary for the model
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_sessions_participant on chat_sessions(participant_id, mode);
drop trigger if exists trg_sessions_updated on chat_sessions;
create trigger trg_sessions_updated before update on chat_sessions
  for each row execute function set_updated_at();

-- chat_messages ---------------------------------------------------------------
create table if not exists chat_messages (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references chat_sessions(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  role           text not null,                          -- system|user|assistant|admin
  content        text not null,
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);
create index if not exists idx_messages_session on chat_messages(session_id, created_at);

-- generated_outputs -----------------------------------------------------------
create table if not exists generated_outputs (
  id                        uuid primary key default gen_random_uuid(),
  participant_id            uuid not null references participants(id) on delete cascade,
  session_id                uuid references chat_sessions(id) on delete set null,
  output_type               text not null,   -- course_preparation_brief|use_case_map|strategy_note|vinay_meeting_brief|share_summary
  content_markdown          text,
  content_json              jsonb,
  reviewed_content_markdown text,             -- participant-edited share summary
  participant_approved      boolean not null default false,
  pdf_storage_path          text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index if not exists idx_outputs_participant on generated_outputs(participant_id, output_type);
drop trigger if exists trg_outputs_updated on generated_outputs;
create trigger trg_outputs_updated before update on generated_outputs
  for each row execute function set_updated_at();

-- qa_checks -------------------------------------------------------------------
create table if not exists qa_checks (
  id             uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id) on delete cascade,
  checklist      jsonb not null default '{}'::jsonb,     -- { key: { pass: bool, note: text } }
  notes          text,
  status         text not null default 'in_progress',    -- in_progress|passed|failed
  tested_by      text,
  approved_by    text,
  created_at     timestamptz not null default now(),
  approved_at    timestamptz
);
create unique index if not exists idx_qa_participant on qa_checks(participant_id);

-- Lock everything down: enable RLS, add no public policies. Service role bypasses.
alter table participants          enable row level security;
alter table participant_research  enable row level security;
alter table chat_sessions         enable row level security;
alter table chat_messages         enable row level security;
alter table generated_outputs     enable row level security;
alter table qa_checks             enable row level security;
