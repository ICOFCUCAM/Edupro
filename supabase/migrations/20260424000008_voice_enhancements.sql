-- ============================================================
-- EduPro — Voice Session Enhancements
-- Adds transcription method tracking, audio duration, and
-- curriculum/knowledge context metadata to voice_sessions.
-- ============================================================

alter table public.voice_sessions
  add column if not exists transcription_method  text    not null default 'webspeech',
  add column if not exists audio_duration_seconds integer,
  add column if not exists context_used           jsonb;

comment on column public.voice_sessions.transcription_method   is 'webspeech | whisper';
comment on column public.voice_sessions.audio_duration_seconds is 'Recording length in seconds (Whisper mode only)';
comment on column public.voice_sessions.context_used           is 'Snapshot of curriculum/KB context injected into the intent request';
