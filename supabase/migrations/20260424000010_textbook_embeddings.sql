-- ============================================================
-- EduPro — Textbook Chapter Embeddings + Semantic Search
-- ============================================================

-- Add embedding column to textbook_chapters (768-dim, matches
-- existing google/text-embedding-004 used by assessment_packages)
alter table public.textbook_chapters
  add column if not exists embedding vector(768);

-- HNSW index for fast cosine similarity search
create index if not exists idx_textbook_chapters_embedding
  on public.textbook_chapters using hnsw (embedding vector_cosine_ops);

-- ── Semantic search helper ────────────────────────────────────
-- Returns chapters ranked by cosine similarity to a query embedding.
-- Optionally scoped to a single textbook; otherwise searches across
-- all textbooks for a given country + subject.
create or replace function public.match_textbook_chapters(
  query_embedding  vector(768),
  p_textbook_id    uuid    default null,
  p_country        text    default null,
  p_subject        text    default null,
  match_count      integer default 5
)
returns table (
  id              uuid,
  textbook_id     uuid,
  textbook_title  text,
  chapter_number  text,
  chapter_title   text,
  content         text,
  similarity      float
)
language sql stable
as $$
  select
    tc.id,
    tc.textbook_id,
    tb.title           as textbook_title,
    tc.chapter_number,
    tc.chapter_title,
    tc.content,
    1 - (tc.embedding <=> query_embedding) as similarity
  from public.textbook_chapters tc
  join public.textbooks         tb on tb.id = tc.textbook_id
  where tc.embedding is not null
    and (p_textbook_id is null or tc.textbook_id = p_textbook_id)
    and (p_country     is null or tb.country     = p_country)
    and (p_subject     is null or tb.subject     = p_subject)
  order by tc.embedding <=> query_embedding
  limit match_count;
$$;
