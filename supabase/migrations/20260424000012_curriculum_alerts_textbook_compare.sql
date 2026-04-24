-- ============================================================
-- EduPro — Curriculum Update Alerts + Cross-Country Textbook Comparison
-- ============================================================

-- ── 1. Curriculum update alerts ──────────────────────────────
-- Created when a country's curriculum changes and similar
-- objectives exist in other countries' curricula.
-- Each row = one alert directed at one target country.
create table if not exists public.curriculum_update_alerts (
  id                   uuid primary key default gen_random_uuid(),
  source_country       text not null,
  target_country       text not null,
  change_type          text not null check (change_type in ('added', 'updated', 'removed')),
  subject              text,
  class_level          text,
  objective_id         uuid references public.curriculum_objectives(id) on delete set null,
  similar_objective_id uuid references public.curriculum_objectives(id) on delete set null,
  similarity_score     integer default 0 check (similarity_score between 0 and 100),
  description          text,
  change_log_id        uuid references public.curriculum_change_log(id) on delete set null,
  -- {teacher_id: iso_timestamp} — tracks per-teacher read receipts
  read_by              jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now()
);

create index if not exists idx_alerts_target_country
  on public.curriculum_update_alerts (target_country, created_at desc);
create index if not exists idx_alerts_source_country
  on public.curriculum_update_alerts (source_country, created_at desc);

alter table public.curriculum_update_alerts enable row level security;
drop policy if exists "alerts_auth" on public.curriculum_update_alerts;
create policy "alerts_auth" on public.curriculum_update_alerts
  for all to authenticated using (true);

-- ── 2. Cross-country textbook comparison ─────────────────────
-- Caches the result of comparing textbook coverage between two
-- countries for a given subject.
-- coverage scores = % of shared crosswalk objectives each
-- country's textbooks actually cover.
create table if not exists public.textbook_cross_country_comparison (
  id                    uuid primary key default gen_random_uuid(),
  country_a             text not null,
  country_b             text not null,
  subject               text not null default '',
  textbook_count_a      integer not null default 0,
  textbook_count_b      integer not null default 0,
  shared_crosswalk_pairs integer not null default 0,
  country_a_coverage    numeric(5,2) not null default 0,
  country_b_coverage    numeric(5,2) not null default 0,
  -- objectives covered in B but not A (A needs to fill this gap)
  gap_count_a           integer not null default 0,
  -- objectives covered in A but not B
  gap_count_b           integer not null default 0,
  top_shared_topics     text[] not null default '{}',
  gap_topics_a          text[] not null default '{}',
  gap_topics_b          text[] not null default '{}',
  computed_at           timestamptz not null default now(),
  unique (country_a, country_b, subject)
);

alter table public.textbook_cross_country_comparison enable row level security;
drop policy if exists "tb_compare_auth" on public.textbook_cross_country_comparison;
create policy "tb_compare_auth" on public.textbook_cross_country_comparison
  for all to authenticated using (true);
