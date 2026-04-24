-- ============================================================
-- EduPro — AI Assessment Generation Engine
-- assessment_packages: stores full AI-generated assessments
-- objective_question_links: tracks which objectives are covered
-- ============================================================

-- ── Assessment Packages ───────────────────────────────────
create table if not exists public.assessment_packages (
  id                uuid primary key default gen_random_uuid(),
  teacher_id        uuid references public.teachers(id) on delete cascade,
  organization_id   uuid references public.organizations(id) on delete set null,
  country           text not null,
  subject           text not null,
  class_level       text not null,
  topic             text not null,
  package_type      text not null check (package_type in (
                      'class_exercise', 'homework', 'quiz', 'test', 'exam', 'competency_check'
                    )),
  difficulty        text not null check (difficulty in ('easy', 'standard', 'advanced', 'mixed')),
  language          text not null default 'en',
  question_count    integer not null default 10,
  term              text,
  week              integer,
  title             text,
  instructions      text,
  duration_minutes  integer,
  total_marks       integer,
  content           jsonb not null default '{}',
  marking_scheme    jsonb not null default '{}',
  variants          jsonb,         -- {easy: {...}, standard: {...}, advanced: {...}}
  is_differentiated boolean not null default false,
  generated_by      uuid references auth.users(id),
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create index if not exists idx_assessment_teacher
  on public.assessment_packages (teacher_id);
create index if not exists idx_assessment_org
  on public.assessment_packages (organization_id);
create index if not exists idx_assessment_scope
  on public.assessment_packages (country, subject, class_level);
create index if not exists idx_assessment_type
  on public.assessment_packages (package_type, difficulty);

-- ── Objective–Question Links ──────────────────────────────
create table if not exists public.objective_question_links (
  id                    uuid primary key default gen_random_uuid(),
  objective_id          uuid not null references public.curriculum_objectives(id) on delete cascade,
  assessment_package_id uuid not null references public.assessment_packages(id) on delete cascade,
  created_at            timestamptz default now(),
  unique (objective_id, assessment_package_id)
);

create index if not exists idx_obj_link_objective
  on public.objective_question_links (objective_id);
create index if not exists idx_obj_link_assessment
  on public.objective_question_links (assessment_package_id);

-- ── RLS ───────────────────────────────────────────────────
alter table public.assessment_packages enable row level security;
alter table public.objective_question_links enable row level security;

create policy "assessment_packages_select"
  on public.assessment_packages for select
  to authenticated using (true);

create policy "assessment_packages_insert"
  on public.assessment_packages for insert
  to authenticated with check (true);

create policy "assessment_packages_update"
  on public.assessment_packages for update
  to authenticated using (true);

create policy "assessment_packages_delete"
  on public.assessment_packages for delete
  to authenticated using (true);

create policy "objective_links_select"
  on public.objective_question_links for select
  to authenticated using (true);

create policy "objective_links_insert"
  on public.objective_question_links for insert
  to authenticated with check (true);

create policy "objective_links_delete"
  on public.objective_question_links for delete
  to authenticated using (true);
