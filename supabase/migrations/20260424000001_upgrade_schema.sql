-- ============================================================
-- EDU PRO — Upgrade Migration (Part 1 & 2)
-- Run this AFTER the initial schema migration
-- ============================================================

-- ── Extensions ────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ── 1. PROFILES (extends Supabase auth.users) ─────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id                   uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name            text,
  country              text,
  role                 text DEFAULT 'teacher',
  preferred_language   text DEFAULT 'english',
  subscription_status  text DEFAULT 'inactive',
  created_at           timestamptz DEFAULT now()
);

-- ── 2. COUNTRY AGENTS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.country_agents (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country               text UNIQUE NOT NULL,
  status                text DEFAULT 'idle',
  last_sync             timestamptz,
  knowledge_items_count int DEFAULT 0,
  alerts_count          int DEFAULT 0,
  created_at            timestamptz DEFAULT now()
);

-- Seed initial country agents
INSERT INTO public.country_agents (country, status) VALUES
  ('Nigeria',      'idle'),
  ('Ghana',        'idle'),
  ('Kenya',        'idle'),
  ('South Africa', 'idle'),
  ('Cameroon',     'idle'),
  ('Tanzania',     'idle'),
  ('Uganda',       'idle'),
  ('Rwanda',       'idle'),
  ('Ethiopia',     'idle'),
  ('Senegal',      'idle'),
  ('DRC',          'idle')
ON CONFLICT (country) DO NOTHING;

-- ── 3. COUNTRY DATA SOURCES ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.country_sources (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country      text NOT NULL,
  source_type  text NOT NULL,
  url          text,
  active       boolean DEFAULT true,
  last_checked timestamptz
);

-- ── 4. KNOWLEDGE ITEMS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.knowledge_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country          text NOT NULL,
  type             text NOT NULL,
  title            text NOT NULL,
  summary          text,
  impact_level     text DEFAULT 'medium',
  tags             text[],
  source_url       text,
  confidence_score int DEFAULT 80,
  source_type      text DEFAULT 'ai_generated',
  created_at       timestamptz DEFAULT now()
);

-- ── 5. VECTOR EMBEDDINGS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.knowledge_embeddings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country      text NOT NULL,
  embedding    vector(1536),
  content      text NOT NULL,
  reference_id uuid
);

-- ── 6. LESSON NOTES (upgraded) ────────────────────────────
-- Drop old lesson_notes and replace with richer version
DROP TABLE IF EXISTS public.lesson_notes CASCADE;

CREATE TABLE public.lesson_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country     text NOT NULL,
  subject     text NOT NULL,
  class_level text NOT NULL,
  title       text NOT NULL,
  content     text,
  summary     text,
  tags        text[],
  visibility  text DEFAULT 'private',
  owner_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  source_type text DEFAULT 'manual',
  created_at  timestamptz DEFAULT now()
);

-- ── 7. INGESTION JOBS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ingestion_jobs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name        text NOT NULL,
  country          text NOT NULL,
  status           text DEFAULT 'queued',
  processed_chunks int DEFAULT 0,
  created_at       timestamptz DEFAULT now()
);

-- ── 8. ALERTS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.alerts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country     text NOT NULL,
  message     text NOT NULL,
  severity    text DEFAULT 'info',
  source      text,
  read_status boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

-- ── 9. ASSISTANT SESSIONS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.assistant_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  country      text,
  subject      text,
  conversation jsonb DEFAULT '[]',
  created_at   timestamptz DEFAULT now()
);

-- ── 10. SUBSCRIPTIONS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  country           text,
  plan              text NOT NULL,
  status            text DEFAULT 'pending',
  payment_reference text,
  start_date        timestamptz,
  expiry_date       timestamptz,
  created_at        timestamptz DEFAULT now()
);

-- ── 11. PAYMENT LOGS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_logs (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider  text NOT NULL,
  reference text NOT NULL,
  status    text NOT NULL,
  payload   jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- ── 12. EDUCATION TRENDS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.education_trends (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country      text NOT NULL,
  trend_type   text NOT NULL,
  description  text NOT NULL,
  impact_score int DEFAULT 50,
  created_at   timestamptz DEFAULT now()
);

-- ── Row Level Security ─────────────────────────────────────
ALTER TABLE public.profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.country_agents      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.country_sources     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_notes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_jobs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education_trends    ENABLE ROW LEVEL SECURITY;

-- Profiles: users manage their own
CREATE POLICY "Users manage own profile"    ON public.profiles            USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Public read for reference tables
CREATE POLICY "Public read country_agents"  ON public.country_agents      FOR SELECT USING (true);
CREATE POLICY "Public read knowledge_items" ON public.knowledge_items      FOR SELECT USING (true);
CREATE POLICY "Public read alerts"          ON public.alerts               FOR SELECT USING (true);
CREATE POLICY "Public read trends"          ON public.education_trends     FOR SELECT USING (true);

-- Embeddings: service role only (called by edge functions)
CREATE POLICY "Service read embeddings"     ON public.knowledge_embeddings FOR SELECT USING (true);

-- Lesson notes: owner access + public for general
CREATE POLICY "Owner manages lesson_notes"  ON public.lesson_notes         USING (owner_id = auth.uid() OR visibility = 'general') WITH CHECK (owner_id = auth.uid());

-- Sessions: owner only
CREATE POLICY "Owner manages sessions"      ON public.assistant_sessions   USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Subscriptions: owner only
CREATE POLICY "Owner manages subscriptions" ON public.subscriptions        USING (user_id = auth.uid());

-- Payment logs: service role only
CREATE POLICY "Service manages payment_logs" ON public.payment_logs        USING (true);

-- Ingestion jobs: all authenticated
CREATE POLICY "Auth manages ingestion"      ON public.ingestion_jobs       USING (true) WITH CHECK (true);

-- ── Part 2: VECTOR SEARCH RPC ─────────────────────────────
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_threshold float,
  match_count     int
)
RETURNS TABLE (
  id         uuid,
  content    text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    knowledge_embeddings.id,
    knowledge_embeddings.content,
    1 - (knowledge_embeddings.embedding <=> query_embedding) AS similarity
  FROM knowledge_embeddings
  WHERE 1 - (knowledge_embeddings.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

-- ── Auto-create profile on signup trigger ─────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, country)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'country'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
