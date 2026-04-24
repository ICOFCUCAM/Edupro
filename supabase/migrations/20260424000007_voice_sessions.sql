-- ============================================================
-- EduPro — Voice Assistant Session Tracking
-- ============================================================

create table if not exists public.voice_sessions (
  id               uuid primary key default gen_random_uuid(),
  teacher_id       uuid references public.teachers(id) on delete cascade,
  country          text,
  intent           text,
  transcript       text not null,
  entities         jsonb not null default '{}',
  response_summary text,
  language         text not null default 'en',
  created_at       timestamptz not null default now()
);

create index if not exists idx_voice_sessions_teacher
  on public.voice_sessions (teacher_id, created_at desc);

alter table public.voice_sessions enable row level security;
drop policy if exists "voice_sessions_auth" on public.voice_sessions;
create policy "voice_sessions_auth" on public.voice_sessions
  for all to authenticated using (true);
