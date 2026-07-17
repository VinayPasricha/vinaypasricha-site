-- ============================================================================
-- AI for Business Leaders — usage management (additive to 0001; safe to re-run)
-- Per-participant allowance, daily cap, token budget, and pause/access controls.
-- Run in the Supabase SQL editor.
-- ============================================================================

alter table participants add column if not exists access_paused  boolean not null default false;
alter table participants add column if not exists daily_limit     integer not null default 30;   -- interactions/day
alter table participants add column if not exists daily_count     integer not null default 0;    -- interactions used today
alter table participants add column if not exists daily_date      date;                          -- the day daily_count refers to
alter table participants add column if not exists token_budget    bigint;                        -- null = unlimited
alter table participants add column if not exists token_estimate  bigint  not null default 0;    -- rough tokens consumed
