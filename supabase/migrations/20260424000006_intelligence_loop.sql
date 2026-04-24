-- ============================================================
-- EduPro — Intelligence Loop: Student Performance Analytics
-- ============================================================

-- ── Students ─────────────────────────────────────────────
create table if not exists public.students (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  teacher_id          uuid references public.teachers(id) on delete set null,
  first_name          text not null,
  last_name           text not null,
  student_identifier  text,
  class_level         text not null,
  gender              text check (gender in ('male', 'female', 'other')),
  created_at          timestamptz not null default now()
);

create index if not exists idx_students_org       on public.students (organization_id);
create index if not exists idx_students_class     on public.students (organization_id, class_level);
create unique index if not exists idx_students_org_identifier
  on public.students (organization_id, student_identifier)
  where student_identifier is not null;

alter table public.students enable row level security;
create policy "students_auth" on public.students for all to authenticated using (true);

-- ── Student Results ───────────────────────────────────────
create table if not exists public.student_results (
  id                    uuid primary key default gen_random_uuid(),
  student_id            uuid not null references public.students(id) on delete cascade,
  assessment_package_id uuid not null references public.assessment_packages(id) on delete cascade,
  teacher_id            uuid references public.teachers(id) on delete set null,
  organization_id       uuid references public.organizations(id) on delete set null,
  score                 numeric(6,2) not null,
  max_score             numeric(6,2) not null,
  percentage            numeric(5,2) generated always as (
                          case when max_score > 0 then round((score / max_score) * 100, 2) else 0 end
                        ) stored,
  mastery_level         text generated always as (
                          case
                            when (score / max_score) * 100 >= 85 then 'mastered'
                            when (score / max_score) * 100 >= 65 then 'proficient'
                            when (score / max_score) * 100 >= 40 then 'developing'
                            else 'not_started'
                          end
                        ) stored,
  notes                 text,
  created_at            timestamptz not null default now()
);

create index if not exists idx_student_results_student on public.student_results (student_id);
create index if not exists idx_student_results_assessment on public.student_results (assessment_package_id);
create index if not exists idx_student_results_org on public.student_results (organization_id, created_at desc);

alter table public.student_results enable row level security;
create policy "student_results_auth" on public.student_results for all to authenticated using (true);

-- ── Objective Mastery ─────────────────────────────────────
create table if not exists public.objective_mastery (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.students(id) on delete cascade,
  objective_id     uuid not null references public.curriculum_objectives(id) on delete cascade,
  mastery_level    text not null default 'not_started'
                     check (mastery_level in ('not_started', 'developing', 'proficient', 'mastered')),
  confidence_score numeric(5,2) not null default 0 check (confidence_score between 0 and 100),
  attempt_count    integer not null default 0,
  last_updated     timestamptz not null default now(),
  unique (student_id, objective_id)
);

create index if not exists idx_obj_mastery_student   on public.objective_mastery (student_id);
create index if not exists idx_obj_mastery_objective on public.objective_mastery (objective_id);

alter table public.objective_mastery enable row level security;
create policy "obj_mastery_auth" on public.objective_mastery for all to authenticated using (true);

-- ── Class Performance Summary ─────────────────────────────
create table if not exists public.class_performance_summary (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations(id) on delete cascade,
  teacher_id            uuid references public.teachers(id) on delete set null,
  class_level           text not null,
  subject               text not null,
  average_score         numeric(5,2) not null default 0,
  student_count         integer not null default 0,
  weak_objectives       text[] not null default '{}',
  strong_objectives     text[] not null default '{}',
  mastery_distribution  jsonb not null default '{"not_started":0,"developing":0,"proficient":0,"mastered":0}',
  intervention_needed   boolean not null default false,
  last_updated          timestamptz not null default now(),
  unique (organization_id, class_level, subject)
);

create index if not exists idx_class_perf_org on public.class_performance_summary (organization_id);

alter table public.class_performance_summary enable row level security;
create policy "class_perf_auth" on public.class_performance_summary for all to authenticated using (true);

-- ── District Performance Summary ──────────────────────────
create table if not exists public.district_performance_summary (
  id                uuid primary key default gen_random_uuid(),
  district_id       uuid not null references public.organizations(id) on delete cascade,
  subject           text not null,
  class_level       text not null default 'all',
  average_score     numeric(5,2) not null default 0,
  school_count      integer not null default 0,
  student_count     integer not null default 0,
  weak_topics       text[] not null default '{}',
  improvement_trend text not null default 'stable'
                      check (improvement_trend in ('improving', 'stable', 'declining')),
  benchmark_met     boolean not null default false,
  last_updated      timestamptz not null default now(),
  unique (district_id, subject, class_level)
);

create index if not exists idx_district_perf_district on public.district_performance_summary (district_id);

alter table public.district_performance_summary enable row level security;
create policy "district_perf_auth" on public.district_performance_summary for all to authenticated using (true);

-- ── Remediation Packages (assessment_packages extension) ──
-- Reuse assessment_packages table; add remediation_type column
alter table public.assessment_packages
  add column if not exists remediation_for_objective uuid references public.curriculum_objectives(id) on delete set null,
  add column if not exists remediation_level         text check (remediation_level in ('not_started', 'developing'));

create index if not exists idx_assessment_remediation
  on public.assessment_packages (remediation_for_objective)
  where remediation_for_objective is not null;

-- ── Helper: aggregate class mastery ───────────────────────
create or replace function public.get_class_objective_mastery(
  p_organization_id uuid,
  p_class_level     text,
  p_subject         text
)
returns table (
  objective_id       uuid,
  learning_objective text,
  topic              text,
  not_started_count  bigint,
  developing_count   bigint,
  proficient_count   bigint,
  mastered_count     bigint,
  avg_confidence     numeric
)
language sql stable as $$
  select
    co.id,
    co.learning_objective,
    co.topic,
    count(*) filter (where om.mastery_level = 'not_started' or om.mastery_level is null) as not_started_count,
    count(*) filter (where om.mastery_level = 'developing')  as developing_count,
    count(*) filter (where om.mastery_level = 'proficient')  as proficient_count,
    count(*) filter (where om.mastery_level = 'mastered')    as mastered_count,
    round(avg(coalesce(om.confidence_score, 0)), 2)          as avg_confidence
  from public.curriculum_objectives co
  join public.students s
    on s.organization_id = p_organization_id
   and s.class_level     = p_class_level
  left join public.objective_mastery om
    on om.student_id   = s.id
   and om.objective_id = co.id
  where co.subject    = p_subject
    and co.class_level = p_class_level
  group by co.id, co.learning_objective, co.topic
  order by avg_confidence asc;
$$;
