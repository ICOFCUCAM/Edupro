-- ============================================================
-- EduPro — African Curriculum Translation Layer
-- Tables: curriculum_crosswalk, class_level_equivalency,
--         subject_equivalency, curriculum_similarity_index
-- Adds:   embedding column to curriculum_objectives
-- ============================================================

-- ── 1. Embedding column on curriculum_objectives ─────────────
alter table public.curriculum_objectives
  add column if not exists embedding vector(768);

create index if not exists idx_curriculum_objectives_embedding
  on public.curriculum_objectives using hnsw (embedding vector_cosine_ops);

-- ── 2. Curriculum crosswalk ───────────────────────────────────
-- Stores objective-to-objective mappings between countries
create table if not exists public.curriculum_crosswalk (
  id                  uuid primary key default gen_random_uuid(),
  source_country      text not null,
  target_country      text not null,
  source_objective_id uuid references public.curriculum_objectives(id) on delete cascade,
  target_objective_id uuid references public.curriculum_objectives(id) on delete cascade,
  similarity_score    integer not null default 0 check (similarity_score between 0 and 100),
  notes               text,
  created_at          timestamptz not null default now(),
  unique (source_objective_id, target_objective_id)
);

create index if not exists idx_crosswalk_countries
  on public.curriculum_crosswalk (source_country, target_country, similarity_score desc);

alter table public.curriculum_crosswalk enable row level security;
drop policy if exists "crosswalk_auth" on public.curriculum_crosswalk;
create policy "crosswalk_auth" on public.curriculum_crosswalk
  for all to authenticated using (true);

-- ── 3. Class level equivalency ────────────────────────────────
-- Maps grade/class systems between countries
-- e.g. Nigeria Primary 4 = Kenya Grade 4 = Cameroon CM1
create table if not exists public.class_level_equivalency (
  id                uuid primary key default gen_random_uuid(),
  country_a         text not null,
  class_level_a     text not null,
  country_b         text not null,
  class_level_b     text not null,
  equivalency_score integer not null default 0 check (equivalency_score between 0 and 100),
  created_at        timestamptz not null default now(),
  unique (country_a, class_level_a, country_b, class_level_b)
);

alter table public.class_level_equivalency enable row level security;
drop policy if exists "class_equiv_auth" on public.class_level_equivalency;
create policy "class_equiv_auth" on public.class_level_equivalency
  for all to authenticated using (true);

-- ── 4. Subject equivalency ────────────────────────────────────
-- Maps merged/split subjects across countries
-- e.g. Nigeria "Basic Science" ≈ Kenya "Integrated Science"
create table if not exists public.subject_equivalency (
  id               uuid primary key default gen_random_uuid(),
  country_a        text not null,
  subject_a        text not null,
  country_b        text not null,
  subject_b        text not null,
  similarity_score integer not null default 0 check (similarity_score between 0 and 100),
  created_at       timestamptz not null default now(),
  unique (country_a, subject_a, country_b, subject_b)
);

alter table public.subject_equivalency enable row level security;
drop policy if exists "subject_equiv_auth" on public.subject_equivalency;
create policy "subject_equiv_auth" on public.subject_equivalency
  for all to authenticated using (true);

-- ── 5. Similarity index (cached country-pair aggregates) ──────
-- subject = '' means aggregated across all subjects
create table if not exists public.curriculum_similarity_index (
  id                      uuid primary key default gen_random_uuid(),
  country_a               text not null,
  country_b               text not null,
  subject                 text not null default '',
  similarity_score        integer not null default 0,
  matched_objectives      integer not null default 0,
  total_source_objectives integer not null default 0,
  computed_at             timestamptz not null default now(),
  unique (country_a, country_b, subject)
);

alter table public.curriculum_similarity_index enable row level security;
drop policy if exists "similarity_index_auth" on public.curriculum_similarity_index;
create policy "similarity_index_auth" on public.curriculum_similarity_index
  for all to authenticated using (true);

-- ── 6. Cross-country objective matching function ──────────────
-- Uses vector cosine similarity to find equivalent objectives
-- between two countries' curricula.
create or replace function public.match_cross_country_objectives(
  p_source_country text,
  p_target_country text,
  p_subject        text    default null,
  p_threshold      float   default 0.65,
  p_top_k          integer default 3
)
returns table (
  source_id         uuid,
  source_text       text,
  source_topic      text,
  source_class_level text,
  target_id         uuid,
  target_text       text,
  target_topic      text,
  target_class_level text,
  similarity        float
)
language sql stable
as $$
  select
    s.id                    as source_id,
    s.learning_objective    as source_text,
    s.topic                 as source_topic,
    s.class_level           as source_class_level,
    t.id                    as target_id,
    t.learning_objective    as target_text,
    t.topic                 as target_topic,
    t.class_level           as target_class_level,
    1 - (s.embedding <=> t.embedding) as similarity
  from public.curriculum_objectives s
  cross join lateral (
    select id, learning_objective, topic, class_level, embedding
    from public.curriculum_objectives
    where country = p_target_country
      and embedding is not null
      and (p_subject is null or subject = p_subject)
    order by s.embedding <=> embedding
    limit p_top_k
  ) t
  where s.country = p_source_country
    and s.embedding is not null
    and (p_subject is null or s.subject = p_subject)
    and 1 - (s.embedding <=> t.embedding) >= p_threshold
  order by similarity desc;
$$;
