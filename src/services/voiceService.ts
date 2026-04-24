import { supabase } from '@/lib/supabase';

export interface VoiceSessionInput {
  teacher_id:              string;
  country?:                string;
  intent:                  string;
  transcript:              string;
  entities:                Record<string, any>;
  response_summary?:       string;
  language?:               string;
  transcription_method?:   'webspeech' | 'whisper';
  audio_duration_seconds?: number;
  context_used?:           Record<string, any>;
}

export interface VoiceSession {
  id:                      string;
  teacher_id:              string;
  country?:                string;
  intent:                  string;
  transcript:              string;
  entities:                Record<string, any>;
  response_summary?:       string;
  language:                string;
  transcription_method:    string;
  audio_duration_seconds?: number;
  created_at:              string;
}

export async function saveVoiceSession(input: VoiceSessionInput): Promise<string | null> {
  const { data, error } = await supabase
    .from('voice_sessions')
    .insert({
      teacher_id:              input.teacher_id,
      country:                 input.country,
      intent:                  input.intent,
      transcript:              input.transcript,
      entities:                input.entities,
      response_summary:        input.response_summary,
      language:                input.language ?? 'en',
      transcription_method:    input.transcription_method ?? 'webspeech',
      audio_duration_seconds:  input.audio_duration_seconds ?? null,
      context_used:            input.context_used ?? null,
    })
    .select('id')
    .single();

  if (error) return null;
  return data?.id ?? null;
}

export async function getVoiceHistory(teacherId: string, limit = 20): Promise<VoiceSession[]> {
  const { data } = await supabase
    .from('voice_sessions')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data || []) as VoiceSession[];
}

export async function getVoiceIntentStats(teacherId: string): Promise<{ intent: string; count: number }[]> {
  const { data } = await supabase
    .from('voice_sessions')
    .select('intent')
    .eq('teacher_id', teacherId);

  const freq: Record<string, number> = {};
  (data || []).forEach((r: any) => { freq[r.intent] = (freq[r.intent] || 0) + 1; });
  return Object.entries(freq)
    .map(([intent, count]) => ({ intent, count }))
    .sort((a, b) => b.count - a.count);
}
