-- ============================================================
-- EduPro — Curriculum Alignment Detection
-- Stores national curriculum objectives and per-lesson scores.
-- ============================================================

-- ── Curriculum Objectives ─────────────────────────────────
create table if not exists public.curriculum_objectives (
  id               uuid primary key default gen_random_uuid(),
  country          text not null,
  subject          text not null,
  class_level      text not null,
  topic            text not null,
  learning_objective text not null,
  term             text,
  week             integer,
  strand           text,
  source_label     text,  -- e.g. "NCC 2023", "CBC 2019"
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create index if not exists idx_curriculum_objectives_lookup
  on public.curriculum_objectives (country, subject, class_level);

-- ── Lesson Alignment Scores ───────────────────────────────
create table if not exists public.lesson_alignment_scores (
  id                   uuid primary key default gen_random_uuid(),
  lesson_id            uuid not null references public.lesson_notes(id) on delete cascade,
  country              text not null,
  subject              text not null,
  class_level          text not null,
  alignment_score      integer not null check (alignment_score between 0 and 100),
  confidence_score     integer not null check (confidence_score between 0 and 100),
  matched_objectives   text[] default '{}',
  missing_objectives   text[] default '{}',
  recommendations      text[] default '{}',
  alignment_level      text not null check (alignment_level in ('full', 'partial', 'needs_improvement')),
  checked_at           timestamptz default now(),
  unique (lesson_id)
);

create index if not exists idx_alignment_lesson_id
  on public.lesson_alignment_scores (lesson_id);

create index if not exists idx_alignment_country_subject
  on public.lesson_alignment_scores (country, subject, class_level);

-- ── RLS ───────────────────────────────────────────────────

alter table public.curriculum_objectives enable row level security;
alter table public.lesson_alignment_scores enable row level security;

-- Objectives: readable by all authenticated users
create policy "curriculum_objectives_select"
  on public.curriculum_objectives for select
  to authenticated using (true);

-- Alignment scores: teachers see their own lessons' scores
create policy "alignment_scores_select"
  on public.lesson_alignment_scores for select
  to authenticated using (
    lesson_id in (
      select id from public.lesson_notes
      where teacher_id = (select id from public.teachers where auth_id = auth.uid() limit 1)
    )
  );

create policy "alignment_scores_insert"
  on public.lesson_alignment_scores for insert
  to authenticated with check (
    lesson_id in (
      select id from public.lesson_notes
      where teacher_id = (select id from public.teachers where auth_id = auth.uid() limit 1)
    )
  );

create policy "alignment_scores_update"
  on public.lesson_alignment_scores for update
  to authenticated using (
    lesson_id in (
      select id from public.lesson_notes
      where teacher_id = (select id from public.teachers where auth_id = auth.uid() limit 1)
    )
  );

-- Ministry/district admins can view all alignment scores in their country
create policy "alignment_scores_admin_select"
  on public.lesson_alignment_scores for select
  to authenticated using (
    exists (
      select 1 from public.organization_members om
      join public.organizations o on o.id = om.organization_id
      where om.user_id = (select id from public.teachers where auth_id = auth.uid() limit 1)
        and om.role in ('district_admin', 'ministry_admin')
    )
  );

-- ── Seed Data: Nigeria Primary Curriculum Objectives ──────
insert into public.curriculum_objectives
  (country, subject, class_level, topic, learning_objective, term, week, strand, source_label)
values
  -- Mathematics P3
  ('Nigeria', 'Mathematics', 'Primary 3', 'Addition and Subtraction', 'Add two-digit numbers without regrouping', 'Term 1', 1, 'Number Operations', 'NCC 2023'),
  ('Nigeria', 'Mathematics', 'Primary 3', 'Addition and Subtraction', 'Add two-digit numbers with regrouping', 'Term 1', 2, 'Number Operations', 'NCC 2023'),
  ('Nigeria', 'Mathematics', 'Primary 3', 'Addition and Subtraction', 'Subtract two-digit numbers without borrowing', 'Term 1', 3, 'Number Operations', 'NCC 2023'),
  ('Nigeria', 'Mathematics', 'Primary 3', 'Multiplication', 'Recite multiplication tables for 2, 3, 4, 5', 'Term 1', 4, 'Number Operations', 'NCC 2023'),
  ('Nigeria', 'Mathematics', 'Primary 3', 'Multiplication', 'Multiply a two-digit number by a one-digit number', 'Term 1', 5, 'Number Operations', 'NCC 2023'),
  ('Nigeria', 'Mathematics', 'Primary 3', 'Fractions', 'Identify halves and quarters of shapes and sets', 'Term 2', 1, 'Fractions', 'NCC 2023'),
  ('Nigeria', 'Mathematics', 'Primary 3', 'Measurement', 'Measure length using standard and non-standard units', 'Term 2', 3, 'Measurement', 'NCC 2023'),
  ('Nigeria', 'Mathematics', 'Primary 3', 'Geometry', 'Identify and name 2D shapes: circle, square, triangle, rectangle', 'Term 2', 5, 'Geometry', 'NCC 2023'),
  -- Mathematics P4
  ('Nigeria', 'Mathematics', 'Primary 4', 'Addition and Subtraction', 'Add and subtract three-digit numbers with regrouping', 'Term 1', 1, 'Number Operations', 'NCC 2023'),
  ('Nigeria', 'Mathematics', 'Primary 4', 'Multiplication', 'Multiply three-digit numbers by single-digit numbers', 'Term 1', 3, 'Number Operations', 'NCC 2023'),
  ('Nigeria', 'Mathematics', 'Primary 4', 'Division', 'Divide two-digit numbers by single-digit numbers', 'Term 1', 5, 'Number Operations', 'NCC 2023'),
  ('Nigeria', 'Mathematics', 'Primary 4', 'Fractions', 'Compare and order simple fractions', 'Term 2', 1, 'Fractions', 'NCC 2023'),
  ('Nigeria', 'Mathematics', 'Primary 4', 'Decimals', 'Identify tenths and hundredths on a number line', 'Term 2', 4, 'Decimals', 'NCC 2023'),
  -- English P3
  ('Nigeria', 'English Language', 'Primary 3', 'Reading Comprehension', 'Read and understand simple passages of 100–150 words', 'Term 1', 1, 'Reading', 'NCC 2023'),
  ('Nigeria', 'English Language', 'Primary 3', 'Vocabulary', 'Use context clues to determine the meaning of unknown words', 'Term 1', 2, 'Vocabulary', 'NCC 2023'),
  ('Nigeria', 'English Language', 'Primary 3', 'Writing', 'Write simple sentences with correct punctuation', 'Term 1', 3, 'Writing', 'NCC 2023'),
  ('Nigeria', 'English Language', 'Primary 3', 'Grammar', 'Identify nouns, verbs, and adjectives in sentences', 'Term 1', 4, 'Grammar', 'NCC 2023'),
  ('Nigeria', 'English Language', 'Primary 3', 'Phonics', 'Blend consonant clusters to decode words', 'Term 1', 5, 'Phonics', 'NCC 2023'),
  -- English P4
  ('Nigeria', 'English Language', 'Primary 4', 'Reading Comprehension', 'Identify the main idea and supporting details in a passage', 'Term 1', 1, 'Reading', 'NCC 2023'),
  ('Nigeria', 'English Language', 'Primary 4', 'Writing', 'Write a short narrative essay with introduction and conclusion', 'Term 2', 1, 'Writing', 'NCC 2023'),
  -- Science P3
  ('Nigeria', 'Basic Science', 'Primary 3', 'Living Things', 'Classify living and non-living things in the environment', 'Term 1', 1, 'Life Science', 'NCC 2023'),
  ('Nigeria', 'Basic Science', 'Primary 3', 'Plants', 'Identify parts of a plant and their functions', 'Term 1', 2, 'Life Science', 'NCC 2023'),
  ('Nigeria', 'Basic Science', 'Primary 3', 'Animals', 'Group animals by their characteristics and habitats', 'Term 1', 3, 'Life Science', 'NCC 2023'),
  ('Nigeria', 'Basic Science', 'Primary 3', 'Water', 'Describe the uses and states of water', 'Term 2', 1, 'Physical Science', 'NCC 2023'),
  ('Nigeria', 'Basic Science', 'Primary 4', 'Human Body', 'Identify the major organs and their functions in the human body', 'Term 1', 1, 'Life Science', 'NCC 2023'),
  ('Nigeria', 'Basic Science', 'Primary 4', 'Food and Nutrition', 'Classify foods into the six food groups and their functions', 'Term 1', 3, 'Life Science', 'NCC 2023'),
  -- Ghana Primary Curriculum (CBC)
  ('Ghana', 'Mathematics', 'Primary 3', 'Number Sense', 'Read, write and count numbers up to 1000', 'Term 1', 1, 'Number', 'CBC 2019'),
  ('Ghana', 'Mathematics', 'Primary 3', 'Addition', 'Add numbers up to three digits with and without regrouping', 'Term 1', 2, 'Number', 'CBC 2019'),
  ('Ghana', 'Mathematics', 'Primary 4', 'Multiplication', 'Multiply 2-digit by 1-digit numbers using various strategies', 'Term 1', 1, 'Number', 'CBC 2019'),
  ('Ghana', 'English Language', 'Primary 3', 'Oral Language', 'Listen and respond to simple instructions and questions', 'Term 1', 1, 'Listening & Speaking', 'CBC 2019'),
  ('Ghana', 'English Language', 'Primary 4', 'Reading', 'Read grade-level texts fluently and with expression', 'Term 1', 1, 'Reading', 'CBC 2019'),
  -- Kenya CBC
  ('Kenya', 'Mathematics', 'Grade 4', 'Numbers', 'Read and write whole numbers up to 10,000', 'Term 1', 1, 'Numbers', 'Kenya CBC 2017'),
  ('Kenya', 'Mathematics', 'Grade 4', 'Addition', 'Add numbers with up to 4 digits', 'Term 1', 2, 'Numbers', 'Kenya CBC 2017'),
  ('Kenya', 'Mathematics', 'Grade 5', 'Fractions', 'Add and subtract fractions with the same denominator', 'Term 1', 3, 'Numbers', 'Kenya CBC 2017'),
  ('Kenya', 'English', 'Grade 4', 'Reading', 'Read and comprehend grade-appropriate texts', 'Term 1', 1, 'Reading', 'Kenya CBC 2017'),
  ('Kenya', 'Science and Technology', 'Grade 4', 'Living Things', 'Identify characteristics of living things', 'Term 1', 1, 'Biology', 'Kenya CBC 2017'),
  -- Cameroon
  ('Cameroon', 'Mathematics', 'CM1', 'Arithmetic', 'Perform addition and subtraction with 4-digit numbers', 'Term 1', 1, 'Numbers', 'MINEDUB 2020'),
  ('Cameroon', 'Mathematics', 'CM2', 'Fractions', 'Add and subtract fractions with the same denominator', 'Term 1', 2, 'Numbers', 'MINEDUB 2020'),
  ('Cameroon', 'French', 'CM1', 'Lecture', 'Lire et comprendre un texte court de 100 à 150 mots', 'Term 1', 1, 'Lecture', 'MINEDUB 2020')
on conflict do nothing;
