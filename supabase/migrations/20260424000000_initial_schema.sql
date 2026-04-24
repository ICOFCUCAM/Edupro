-- ============================================================
-- EDU PRO — Initial Schema Migration
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── Tables ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.teachers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id             uuid UNIQUE,
  email               text UNIQUE NOT NULL,
  full_name           text NOT NULL,
  school_name         text,
  country             text NOT NULL DEFAULT 'Nigeria',
  region              text NOT NULL DEFAULT 'West Africa',
  preferred_language  text DEFAULT 'English',
  subscription_plan   text DEFAULT 'free',
  subscription_status text DEFAULT 'active',
  lesson_count        integer DEFAULT 0,
  last_login          timestamptz,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lesson_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid REFERENCES public.teachers(id) ON DELETE CASCADE,
  title      text NOT NULL,
  subject    text NOT NULL,
  topic      text NOT NULL,
  country    text NOT NULL,
  region     text NOT NULL,
  level      text NOT NULL,
  class_name text NOT NULL,
  language   text DEFAULT 'English',
  content    jsonb NOT NULL DEFAULT '{}',
  status     text DEFAULT 'draft',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.saved_content (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id   uuid REFERENCES public.teachers(id) ON DELETE CASCADE,
  content_type text NOT NULL,
  content_id   uuid,
  title        text NOT NULL,
  metadata     jsonb DEFAULT '{}',
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.school_websites (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id          uuid REFERENCES public.teachers(id) ON DELETE CASCADE,
  school_name         text NOT NULL,
  domain_name         text UNIQUE,
  school_info         jsonb NOT NULL DEFAULT '{}',
  website_content     jsonb DEFAULT '{}',
  is_published        boolean DEFAULT false,
  subscription_status text DEFAULT 'inactive',
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.content_library (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title            text NOT NULL,
  description      text,
  content_type     text NOT NULL,
  category         text NOT NULL,
  level            text NOT NULL,
  language         text DEFAULT 'English',
  url              text,
  thumbnail_url    text,
  duration_seconds integer,
  is_free          boolean DEFAULT true,
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.exam_bank (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country    text NOT NULL,
  exam_type  text NOT NULL,
  subject    text NOT NULL,
  year       integer,
  level      text NOT NULL,
  questions  jsonb NOT NULL DEFAULT '[]',
  answers    jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.knowledge_base (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country        text NOT NULL,
  category       text NOT NULL,
  title          text NOT NULL,
  content        text NOT NULL,
  effective_date date,
  is_active      boolean DEFAULT true,
  created_at     timestamptz DEFAULT now()
);

-- ── Row Level Security ─────────────────────────────────────

ALTER TABLE public.teachers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_notes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_content   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_websites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_bank       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base  ENABLE ROW LEVEL SECURITY;

-- Teachers: full access (auth handled in app)
CREATE POLICY "Allow all teachers"        ON public.teachers        USING (true) WITH CHECK (true);
CREATE POLICY "Allow all lesson_notes"    ON public.lesson_notes    USING (true) WITH CHECK (true);
CREATE POLICY "Allow all saved_content"   ON public.saved_content   USING (true) WITH CHECK (true);
CREATE POLICY "Allow all school_websites" ON public.school_websites USING (true) WITH CHECK (true);

-- Public read-only tables
CREATE POLICY "Public read content_library" ON public.content_library FOR SELECT USING (true);
CREATE POLICY "Public read exam_bank"        ON public.exam_bank        FOR SELECT USING (true);
CREATE POLICY "Public read knowledge_base"   ON public.knowledge_base   FOR SELECT USING (true);

-- ── Seed Data ──────────────────────────────────────────────

INSERT INTO public.content_library (id, title, description, content_type, category, level, language, duration_seconds, is_free) VALUES
  ('e9cf05dc-8502-438d-b54b-3ef5190a68cb', 'ABC Alphabet Song',       'Learn the alphabet with this fun sing-along',        'audio', 'Literacy',            'nursery',   'English', 204,  true),
  ('5467fdde-90e1-49f8-b103-e65fe854e872', 'Counting 1-100',           'Interactive video teaching numbers',                 'video', 'Mathematics',         'nursery',   'English', 495,  true),
  ('93551fe4-1f67-45b1-a71f-dc43d29d1485', 'Shapes & Colors Match',    'Fun matching game for shapes and colors',            'game',  'Mathematics',         'preschool', 'English', 900,  true),
  ('a4438b93-8594-4e5b-bec5-0109667b597c', 'Bible Stories for Kids',   'Animated Bible stories collection',                 'video', 'Christian Education', 'nursery',   'English', 750,  true),
  ('96432e31-170a-46a1-b54e-85c486ac2fd3', 'Basic Science: Plants',    'Learn about plant parts and growth',                'video', 'Science',             'primary',   'English', 645,  true),
  ('f562bf9a-3cec-43fc-b498-f43a7cb636f2', 'French for Beginners',     'Basic French vocabulary and phrases',               'audio', 'French',              'primary',   'French',  900,  false),
  ('4934779f-9191-43d2-a93d-280f1ac371b1', 'Word Puzzle Adventure',    'Spelling and vocabulary game',                      'game',  'English',             'primary',   'English', 1200, true),
  ('706a8138-7c16-4ee8-959b-ddce7cad6b2e', 'The Creation Story',       'Interactive creation story for young learners',     'video', 'Christian Education', 'preschool', 'English', 440,  true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.exam_bank (id, country, exam_type, subject, year, level, questions, answers) VALUES
  ('35b40dce-8f9e-4268-b4b6-1b36a1fbae14', 'Nigeria',      'first_school',    'Mathematics',    2024, 'Primary 6',   '[{"q":"What is 456 + 789?","options":["1245","1235","1345","1145"],"answer":0}]',              '["1245"]'),
  ('e484413b-7f51-4967-ac4b-89b3188e9d5b', 'Nigeria',      'common_entrance', 'English Language',2024,'Primary 5-6', '[{"q":"Choose the correct spelling","options":["Recieve","Receive","Receve","Receeve"],"answer":1}]','["Receive"]'),
  ('a2904567-d5a2-456f-87dc-95314832e09b', 'Ghana',        'first_school',    'Mathematics',    2023, 'Primary 6',   '[{"q":"Simplify 3/4 + 1/2","options":["5/4","1 1/4","4/6","1/2"],"answer":1}]',               '["1 1/4"]'),
  ('89ebbcb4-2010-43e5-a589-ebd6eb9fef83', 'Kenya',        'first_school',    'Science',        2023, 'Grade 6',     '[{"q":"Which planet is closest to the sun?","options":["Venus","Earth","Mercury","Mars"],"answer":2}]','["Mercury"]')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.knowledge_base (id, country, category, title, content, effective_date, is_active) VALUES
  ('a1f7cc37-2701-4373-97f6-e95b76352961', 'Nigeria',       'Curriculum Update', 'NERDC 2025 Revised Primary Curriculum',     'Updated primary curriculum includes digital literacy from Primary 3', '2025-12-15', true),
  ('731eec46-0755-4c8f-ba75-d5bc9e8f34a1', 'Ghana',         'Pedagogy',          'NaCCA Activity-Based Learning',              'New guidelines emphasize 60% student-led activities',                 '2025-11-20', true),
  ('d99c2089-62c0-4f56-b16b-948c8f2703a4', 'Kenya',         'Assessment',        'CBC Formative Assessment Framework',         'Portfolio-based assessment alongside traditional testing',            '2025-10-05', true),
  ('a1f63bf8-ea27-4e30-aaeb-62eca5fc2819', 'South Africa',  'Curriculum Update', 'CAPS Indigenous Knowledge Integration',      'Mandates integration of indigenous knowledge systems',               '2025-09-18', true)
ON CONFLICT (id) DO NOTHING;
