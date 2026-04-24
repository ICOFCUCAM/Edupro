-- ============================================================
-- EduPro — Assessment Vector Embeddings + Auto-gen Metadata
-- ============================================================

-- Enable pgvector (no-op if already enabled)
create extension if not exists vector;

-- ── Extend assessment_packages ────────────────────────────
alter table public.assessment_packages
  add column if not exists embedding            vector(768),
  add column if not exists auto_generated       boolean not null default false,
  add column if not exists trigger_type         text check (trigger_type in (
                                                  'lesson_save', 'lesson_upload',
                                                  'objective_select', 'manual', 'curriculum_change'
                                                )),
  add column if not exists source_lesson_id     uuid references public.lesson_notes(id) on delete set null,
  add column if not exists source_objective_id  uuid references public.curriculum_objectives(id) on delete set null;

-- HNSW index for fast cosine similarity (works at any table size)
create index if not exists idx_assessment_embedding
  on public.assessment_packages using hnsw (embedding vector_cosine_ops);

-- Composite index for ministry question bank queries
create index if not exists idx_assessment_country_type
  on public.assessment_packages (country, subject, class_level, package_type);

-- ── Ministry Question Bank view ───────────────────────────
-- Readable by any authenticated user; underlying RLS on
-- assessment_packages still applies (security invoker).
create or replace view public.ministry_question_bank as
select
  ap.id,
  ap.country,
  ap.subject,
  ap.class_level,
  ap.topic,
  ap.package_type,
  ap.difficulty,
  ap.language,
  ap.question_count,
  ap.total_marks,
  ap.duration_minutes,
  ap.term,
  ap.week,
  ap.title,
  ap.content,
  ap.marking_scheme,
  ap.is_differentiated,
  ap.auto_generated,
  ap.trigger_type,
  ap.created_at,
  t.school_name,
  o.name  as organization_name,
  o.org_type
from public.assessment_packages ap
left join public.teachers      t on t.id = ap.teacher_id
left join public.organizations o on o.id = ap.organization_id;

-- ── Extend curriculum_change_log ──────────────────────────
alter table public.curriculum_change_log
  add column if not exists assessments_regenerated       boolean     not null default false,
  add column if not exists assessments_regenerated_count integer     not null default 0,
  add column if not exists assessments_regenerated_at    timestamptz;

-- ── Semantic search helper function ──────────────────────
-- Returns assessment IDs ordered by cosine similarity to a query embedding.
create or replace function public.match_assessments(
  query_embedding vector(768),
  match_country   text,
  match_subject   text    default null,
  match_level     text    default null,
  match_count     integer default 10
)
returns table (
  id       uuid,
  title    text,
  topic    text,
  country  text,
  subject  text,
  class_level text,
  package_type text,
  difficulty   text,
  similarity   float
)
language sql stable
as $$
  select
    ap.id,
    ap.title,
    ap.topic,
    ap.country,
    ap.subject,
    ap.class_level,
    ap.package_type,
    ap.difficulty,
    1 - (ap.embedding <=> query_embedding) as similarity
  from public.assessment_packages ap
  where ap.embedding is not null
    and ap.country = match_country
    and (match_subject is null or ap.subject = match_subject)
    and (match_level   is null or ap.class_level = match_level)
  order by ap.embedding <=> query_embedding
  limit match_count;
$$;
