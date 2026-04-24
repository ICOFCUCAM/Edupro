-- ============================================================
-- EduPro — Textbook Intelligence Engine
-- Tables: textbooks, textbook_chapters, textbook_alignment,
--         textbook_coverage_summary
-- Storage bucket: textbooks
-- ============================================================

-- ── 1. textbooks ─────────────────────────────────────────────
create table if not exists public.textbooks (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  country         text,
  subject         text,
  class_level     text,
  uploaded_by     uuid references public.teachers(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete cascade,
  file_url        text,
  file_name       text,
  file_size_bytes bigint,
  -- pipeline status
  status          text not null default 'processing'
                  check (status in ('processing','chapters_extracted','aligned','ready','failed')),
  mode            text not null default 'school'
                  check (mode in ('school','ministry','publisher')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_textbooks_org
  on public.textbooks (organization_id, created_at desc);
create index if not exists idx_textbooks_country
  on public.textbooks (country, subject, class_level);

alter table public.textbooks enable row level security;
drop policy if exists "textbooks_auth" on public.textbooks;
create policy "textbooks_auth" on public.textbooks
  for all to authenticated using (true);

-- ── 2. textbook_chapters ──────────────────────────────────────
create table if not exists public.textbook_chapters (
  id             uuid primary key default gen_random_uuid(),
  textbook_id    uuid not null references public.textbooks(id) on delete cascade,
  chapter_number text,
  chapter_title  text not null,
  content        text not null default '',   -- first ~3 000 chars for AI context
  word_count     integer,
  -- generated content ids (nullable until generated)
  lesson_note_id uuid,
  assessment_id  uuid,
  created_at     timestamptz not null default now()
);

create index if not exists idx_textbook_chapters_book
  on public.textbook_chapters (textbook_id, chapter_number);

alter table public.textbook_chapters enable row level security;
drop policy if exists "textbook_chapters_auth" on public.textbook_chapters;
create policy "textbook_chapters_auth" on public.textbook_chapters
  for all to authenticated using (true);

-- ── 3. textbook_alignment ────────────────────────────────────
create table if not exists public.textbook_alignment (
  id               uuid primary key default gen_random_uuid(),
  textbook_id      uuid not null references public.textbooks(id) on delete cascade,
  chapter_id       uuid references public.textbook_chapters(id) on delete cascade,
  objective_id     uuid references public.curriculum_objectives(id) on delete cascade,
  alignment_score  integer not null default 0 check (alignment_score between 0 and 100),
  coverage_notes   text,
  created_at       timestamptz not null default now(),
  unique (textbook_id, chapter_id, objective_id)
);

create index if not exists idx_textbook_alignment_book
  on public.textbook_alignment (textbook_id, objective_id);

alter table public.textbook_alignment enable row level security;
drop policy if exists "textbook_alignment_auth" on public.textbook_alignment;
create policy "textbook_alignment_auth" on public.textbook_alignment
  for all to authenticated using (true);

-- ── 4. textbook_coverage_summary ─────────────────────────────
create table if not exists public.textbook_coverage_summary (
  id                   uuid primary key default gen_random_uuid(),
  textbook_id          uuid not null unique references public.textbooks(id) on delete cascade,
  coverage_percentage  integer not null default 0,
  total_objectives     integer not null default 0,
  covered_objectives   integer not null default 0,
  missing_objectives   text[]  not null default '{}',
  extra_topics         text[]  not null default '{}',
  chapter_count        integer not null default 0,
  generated_lessons    integer not null default 0,
  generated_assessments integer not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.textbook_coverage_summary enable row level security;
drop policy if exists "textbook_coverage_summary_auth" on public.textbook_coverage_summary;
create policy "textbook_coverage_summary_auth" on public.textbook_coverage_summary
  for all to authenticated using (true);

-- ── 5. Supabase Storage bucket ────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'textbooks', 'textbooks', false, 52428800,
  array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain','text/markdown']
)
on conflict (id) do nothing;

drop policy if exists "textbooks_upload"  on storage.objects;
drop policy if exists "textbooks_select"  on storage.objects;
drop policy if exists "textbooks_delete"  on storage.objects;

create policy "textbooks_upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'textbooks');

create policy "textbooks_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'textbooks');

create policy "textbooks_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'textbooks');
