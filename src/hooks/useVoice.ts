import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getTeacherCoachingData } from '@/services/performanceService';
import { saveVoiceSession } from '@/services/voiceService';
import { saveVoiceDraftOffline } from '@/lib/offlineDB';
import { loadVoiceContext, type VoiceContext } from '@/services/voiceContextService';

export type VoiceStatus = 'idle' | 'listening' | 'processing' | 'responding' | 'error' | 'unsupported';
export type TranscribeMode = 'webspeech' | 'whisper';

export interface VoiceEntities {
  country?:          string;
  subject?:          string;
  class_level?:      string;
  topic?:            string;
  assessment_type?:  string;
  difficulty?:       string;
  question_count?:   string;
  target_language?:  string;
}

export interface VoiceResult {
  intent:           string;
  entities:         VoiceEntities;
  spoken_response:  string;
  confidence:       number;
  action_taken?:    string;
  generated_title?: string;
  alignment_score?: number;
  error?:           string;
}

export interface UseVoiceOptions {
  teacherId?:         string;
  teacherCountry?:    string;
  teacherName?:       string;
  teacherSubject?:    string;
  teacherClassLevel?: string;
  preferredLanguage?: string;
  isOnline?:          boolean;
  onNavigate?:        (page: string) => void;
}

// ── Language maps ────────────────────────────────────────────────────────────

export const LANG_OPTIONS = [
  { code: 'en',  label: 'English',    bcp47: 'en-US', whisperCode: 'en' },
  { code: 'fr',  label: 'Français',   bcp47: 'fr-FR', whisperCode: 'fr' },
  { code: 'ar',  label: 'العربية',    bcp47: 'ar-SA', whisperCode: 'ar' },
  { code: 'sw',  label: 'Kiswahili',  bcp47: 'sw-TZ', whisperCode: 'sw' },
  { code: 'pt',  label: 'Português',  bcp47: 'pt-PT', whisperCode: 'pt' },
  { code: 'pcm', label: 'Pidgin',     bcp47: 'en-NG', whisperCode: 'en' },
] as const;

const LANG_TO_BCP47: Record<string, string> = {
  en: 'en-US', fr: 'fr-FR', ar: 'ar-SA', sw: 'sw-TZ', pt: 'pt-PT',
  ha: 'en-NG', pcm: 'en-NG',
};

const COUNTRY_TO_LANG: Record<string, string> = {
  Cameroon: 'fr-FR', Senegal: 'fr-FR', Rwanda: 'fr-FR',
  'Democratic Republic of Congo': 'fr-FR',
  Nigeria: 'en-NG', Ghana: 'en-GH', Kenya: 'en-KE', Tanzania: 'sw-TZ',
};

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useVoice(options: UseVoiceOptions) {
  const {
    teacherId, teacherCountry = 'Nigeria', teacherName, teacherSubject,
    teacherClassLevel, preferredLanguage = 'en', isOnline = true, onNavigate,
  } = options;

  const [status,           setStatus]           = useState<VoiceStatus>('idle');
  const [transcript,       setTranscript]       = useState('');
  const [interimTranscript,setInterimTranscript] = useState('');
  const [result,           setResult]           = useState<VoiceResult | null>(null);
  const [history,          setHistory]          = useState<VoiceResult[]>([]);
  const [transcribeMode,   setTranscribeMode]   = useState<TranscribeMode>('webspeech');
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const recognitionRef    = useRef<any>(null);
  const synthRef          = useRef<SpeechSynthesisUtterance | null>(null);
  const performanceRef    = useRef<any[]>([]);
  const voiceContextRef   = useRef<VoiceContext>({ curriculumObjectives: '', knowledgeSnippets: [], objectiveCount: 0 });
  const mediaRecorderRef  = useRef<MediaRecorder | null>(null);
  const audioChunksRef    = useRef<Blob[]>([]);
  const timerRef          = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioStartRef     = useRef<number>(0);

  const supported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const mediaSupported = typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia;

  // BCP47 from current language pref
  const langCode = useCallback((): string =>
    LANG_TO_BCP47[preferredLanguage] ?? COUNTRY_TO_LANG[teacherCountry] ?? 'en-US',
  [preferredLanguage, teacherCountry]);

  // ── Load performance + curriculum context on mount ────────────────────────
  useEffect(() => {
    if (teacherId) {
      getTeacherCoachingData(teacherId)
        .then(d => { performanceRef.current = d; })
        .catch(() => {});
    }
  }, [teacherId]);

  useEffect(() => {
    if (isOnline && teacherCountry && teacherSubject) {
      loadVoiceContext(teacherCountry, teacherSubject, teacherClassLevel ?? '')
        .then(ctx => { voiceContextRef.current = ctx; })
        .catch(() => {});
    }
  }, [isOnline, teacherCountry, teacherSubject, teacherClassLevel]);

  // ── TTS ──────────────────────────────────────────────────────────────────
  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (!('speechSynthesis' in window)) { onEnd?.(); return; }
    window.speechSynthesis.cancel();
    const utterance     = new SpeechSynthesisUtterance(text);
    utterance.lang      = langCode();
    utterance.rate      = 0.92;
    utterance.pitch     = 1.05;
    utterance.onend     = () => { setStatus('idle'); onEnd?.(); };
    utterance.onerror   = () => { setStatus('idle'); onEnd?.(); };
    synthRef.current    = utterance;
    setStatus('responding');
    window.speechSynthesis.speak(utterance);
  }, [langCode]);

  const stopSpeaking = useCallback(() => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setStatus('idle');
  }, []);

  // ── Main transcript processing pipeline ──────────────────────────────────
  const processTranscript = useCallback(async (
    text: string,
    audioDuration?: number,
    transcriptionMethod: TranscribeMode = 'webspeech',
  ) => {
    if (!text.trim()) { setStatus('idle'); return; }
    setStatus('processing');
    setTranscript(text);

    // Offline fallback
    if (!isOnline) {
      await saveVoiceDraftOffline({
        id:         crypto.randomUUID(),
        transcript: text,
        teacher_id: teacherId ?? '',
        created_at: new Date().toISOString(),
        synced:     false,
      }).catch(() => {});
      const msg = 'Voice draft saved. It will be processed when you reconnect.';
      setResult({ intent: 'offline_draft', entities: {}, spoken_response: msg, confidence: 1 });
      speak(msg);
      return;
    }

    try {
      const ctx = voiceContextRef.current;

      // Step 1: intent detection with full context
      const intentRes = await supabase.functions.invoke('voice-intent', {
        body: {
          transcript,
          teacherCountry,
          teacherSubject,
          teacherClassLevel,
          teacherName,
          performanceData:      performanceRef.current,
          language:             preferredLanguage,
          curriculumObjectives: ctx.curriculumObjectives,
          knowledgeSnippets:    ctx.knowledgeSnippets,
        },
      });

      if (intentRes.error || !intentRes.data?.success) throw new Error('Intent detection failed');

      const { intent, entities, spoken_response, confidence } = intentRes.data;
      let finalResponse  = spoken_response ?? '';
      let actionTaken    = '';
      let generatedTitle = '';
      let alignmentScore: number | undefined;

      // Step 2: dispatch by intent
      switch (intent) {

        // ── Generate lesson ──────────────────────────────────────────────
        case 'generate_lesson': {
          speak(`Generating your ${entities.subject || ''} lesson on ${entities.topic || 'the topic'}, one moment…`);
          const lessonRes = await supabase.functions.invoke('generate-lesson-note', {
            body: {
              country:    entities.country,
              subject:    entities.subject,
              class_level:entities.class_level,
              topic:      entities.topic || 'as specified',
              language:   entities.target_language || preferredLanguage,
              teacher_id: teacherId,
            },
          });
          if (lessonRes.data?.lesson) {
            const lesson = lessonRes.data.lesson;
            generatedTitle = lesson.title ?? `${entities.subject} — ${entities.topic}`;
            finalResponse  = `Lesson ready: ${generatedTitle}. It has ${lesson.objectives?.length ?? 0} objectives and includes activities. Saved to your library.`;
            actionTaken    = 'lesson_generated';
            if (teacherId) {
              await supabase.from('lesson_notes').insert({
                teacher_id:  teacherId,
                country:     entities.country,
                subject:     entities.subject,
                class_level: entities.class_level,
                title:       generatedTitle,
                topic:       entities.topic,
                content:     lesson,
                visibility:  'private',
                status:      'draft',
              });
            }
          } else {
            finalResponse = 'I could not generate the lesson. Please try the Lesson Generator.';
          }
          break;
        }

        // ── Generate assessment ──────────────────────────────────────────
        case 'generate_assessment': {
          speak(`Generating your ${entities.assessment_type || 'assessment'} on ${entities.topic || 'the topic'}…`);
          const assessRes = await supabase.functions.invoke('generate-assessment', {
            body: {
              country:       entities.country,
              subject:       entities.subject,
              class_level:   entities.class_level,
              topic:         entities.topic || 'General',
              packageType:   entities.assessment_type || 'quiz',
              difficulty:    entities.difficulty || 'standard',
              questionCount: parseInt(entities.question_count ?? '10'),
              language:      entities.target_language || preferredLanguage,
              teacherId,
              triggerType:   'manual',
            },
          });
          if (assessRes.data?.assessment?.content) {
            const a = assessRes.data.assessment;
            generatedTitle = `${entities.assessment_type ?? 'Quiz'} — ${entities.topic}`;
            finalResponse  = `Assessment ready with ${a.content?.sections?.[0]?.questions?.length ?? 10} questions on ${entities.topic}. Saved to your assessments.`;
            actionTaken    = 'assessment_generated';
          } else {
            finalResponse = 'Assessment could not be generated. Please try the Assessment Generator.';
          }
          break;
        }

        // ── Check mastery ────────────────────────────────────────────────
        case 'check_mastery': {
          if (!finalResponse) {
            const data = performanceRef.current;
            if (!data.length) {
              finalResponse = 'No performance data found yet. Enter student results to unlock mastery analytics.';
            } else {
              const worst = data[0];
              finalResponse = `In ${worst.subject}, ${worst.class_level}, average mastery is ${worst.average_score?.toFixed(0) ?? '?'}%.` +
                (worst.weak_objectives?.length
                  ? ` Students are struggling with: ${worst.weak_objectives.slice(0, 2).join(' and ')}.`
                  : ' No critical weak areas detected.');
            }
          }
          actionTaken = 'mastery_checked';
          break;
        }

        // ── Country agent / curriculum knowledge ─────────────────────────
        case 'ask_country_agent': {
          // Gemini already answered using knowledgeSnippets in the system prompt
          if (!finalResponse) {
            finalResponse = `For ${teacherCountry} curriculum guidance, please check the Knowledge Base section or contact your ministry education office.`;
          }
          actionTaken = 'country_agent_answered';
          break;
        }

        // ── Check alignment ──────────────────────────────────────────────
        case 'check_alignment': {
          if (teacherId) {
            // Fetch most recent lesson note for this teacher
            const { data: latestLesson } = await supabase
              .from('lesson_notes')
              .select('id, title, content, subject, class_level')
              .eq('teacher_id', teacherId)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();

            if (latestLesson) {
              const lessonText = typeof latestLesson.content === 'string'
                ? latestLesson.content
                : JSON.stringify(latestLesson.content ?? '');

              const objectives = ctx.curriculumObjectives ||
                `${latestLesson.subject ?? teacherSubject} ${latestLesson.class_level ?? teacherClassLevel}`;

              const alignRes = await supabase.functions.invoke('check-curriculum-alignment', {
                body: {
                  lessonText:  lessonText.slice(0, 3000),
                  country:     teacherCountry,
                  subject:     latestLesson.subject ?? teacherSubject ?? '',
                  classLevel:  latestLesson.class_level ?? teacherClassLevel ?? '',
                  objectives,
                },
              });

              if (alignRes.data?.result) {
                const r = alignRes.data.result;
                alignmentScore = r.alignmentScore ?? 0;
                const top      = r.recommendations?.[0] ?? 'No specific recommendations.';
                finalResponse  = `Your latest lesson "${latestLesson.title}" scores ${alignmentScore}% curriculum alignment. Top recommendation: ${top}`;
                actionTaken    = 'alignment_checked';
              } else {
                finalResponse = `I checked your latest lesson "${latestLesson.title}" but could not retrieve alignment data. Open it in the Lesson Library and run alignment check manually.`;
              }
            } else {
              finalResponse = 'No lesson notes found. Please create a lesson first, then ask me to check alignment.';
            }
          } else {
            finalResponse = 'Please open a lesson and use the Alignment Check feature in the Lesson Library.';
          }
          actionTaken = actionTaken || 'alignment_info';
          break;
        }

        // ── Dictate lesson ────────────────────────────────────────────────
        case 'dictate_lesson': {
          if (teacherId) {
            // Extract a title from the first 80 chars of transcript
            const firstLine = text.split(/[.\n]/)[0]?.replace(/^lesson\s+(title\s*:?\s*)?/i, '').trim();
            const dTitle    = firstLine ? firstLine.slice(0, 80) : `Dictated Lesson — ${new Date().toLocaleDateString()}`;

            const { data: dictRow } = await supabase.from('lesson_notes').insert({
              teacher_id:  teacherId,
              country:     teacherCountry,
              subject:     teacherSubject ?? '',
              class_level: teacherClassLevel ?? '',
              title:       dTitle,
              content:     { raw_dictation: text, title: dTitle, objectives: [], activities: [] },
              visibility:  'private',
              status:      'draft',
            }).select('id').single();

            if (dictRow?.id) {
              generatedTitle = dTitle;
              finalResponse  = `Lesson draft saved as "${dTitle}". Open your Lesson Library to refine it.`;
              actionTaken    = 'lesson_dictated';
            } else {
              finalResponse = 'Draft could not be saved. Please try the Lesson Generator form.';
            }
          } else {
            finalResponse = 'Please sign in to save dictated lessons.';
          }
          break;
        }

        // ── Translate content ────────────────────────────────────────────
        case 'translate_content': {
          finalResponse = finalResponse || `To translate content, open a lesson and use the language selector in the Lesson Generator. I can generate new content in ${entities.target_language === 'fr' ? 'French' : entities.target_language === 'ar' ? 'Arabic' : entities.target_language === 'sw' ? 'Swahili' : 'your selected language'} directly.`;
          actionTaken   = 'translate_info';
          break;
        }

        // ── General question / ask_agent fallback ────────────────────────
        case 'ask_agent':
        case 'general_question':
        default: {
          if (!finalResponse) {
            finalResponse = 'I heard your question. Please check the Knowledge Base or try rephrasing it.';
          }
          actionTaken = 'question_answered';
          break;
        }
      }

      const voiceResult: VoiceResult = {
        intent: intent, entities, spoken_response: finalResponse, confidence,
        action_taken: actionTaken, generated_title: generatedTitle, alignment_score: alignmentScore,
      };
      setResult(voiceResult);
      setHistory(prev => [voiceResult, ...prev].slice(0, 10));

      // Persist session
      if (teacherId) {
        await saveVoiceSession({
          teacher_id:              teacherId,
          country:                 teacherCountry,
          intent,
          transcript:              text,
          entities,
          response_summary:        finalResponse,
          language:                preferredLanguage,
          transcription_method:    transcriptionMethod,
          audio_duration_seconds:  audioDuration,
          context_used:            { objectiveCount: ctx.objectiveCount, knowledgeCount: ctx.knowledgeSnippets.length },
        }).catch(() => {});
      }

      if (finalResponse) speak(finalResponse);
      else setStatus('idle');

    } catch (err: any) {
      const msg = 'Sorry, I had trouble processing that. Please try again.';
      setResult({ intent: 'error', entities: {}, spoken_response: msg, confidence: 0, error: err.message });
      speak(msg);
    }
  }, [
    isOnline, teacherId, teacherCountry, teacherSubject, teacherClassLevel,
    teacherName, preferredLanguage, speak,
  ]);

  // ── Whisper recording ─────────────────────────────────────────────────────
  const startWhisperRecording = useCallback(async () => {
    if (!mediaSupported) { setStatus('unsupported'); return; }
    try {
      const stream   = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType =
        MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' :
        MediaRecorder.isTypeSupported('audio/webm')             ? 'audio/webm' :
        MediaRecorder.isTypeSupported('audio/mp4')              ? 'audio/mp4'  : '';

      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioChunksRef.current = [];

      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || 'audio/webm' });
        await sendToWhisper(blob, mr.mimeType || 'audio/webm');
      };

      mr.start(100);
      mediaRecorderRef.current = mr;
      audioStartRef.current    = Date.now();
      setStatus('listening');
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
    } catch {
      const msg = 'Microphone access denied. Please allow microphone permissions.';
      setResult({ intent: 'error', entities: {}, spoken_response: msg, confidence: 0 });
      setStatus('error');
    }
  }, [mediaSupported]);

  const stopWhisperRecording = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    mediaRecorderRef.current?.stop();
    setStatus('processing');
  }, []);

  const sendToWhisper = useCallback(async (blob: Blob, mimeType: string) => {
    const duration = Math.round((Date.now() - audioStartRef.current) / 1000);

    // base64 encode in chunks to avoid call stack overflow
    const buffer   = await blob.arrayBuffer();
    const bytes    = new Uint8Array(buffer);
    const CHUNK    = 8192;
    let binary     = '';
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...(bytes.slice(i, i + CHUNK) as any));
    }
    const base64 = btoa(binary);

    const res = await supabase.functions.invoke('whisper-transcribe', {
      body: { audio: base64, mimeType, language: langCode() },
    });

    if (res.error || !res.data?.transcript) {
      const msg = 'Could not transcribe your recording. Please try again or use Live Speech mode.';
      setResult({ intent: 'error', entities: {}, spoken_response: msg, confidence: 0 });
      speak(msg);
      return;
    }

    await processTranscript(res.data.transcript, duration, 'whisper');
  }, [langCode, processTranscript, speak]);

  // ── Web Speech API ────────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!supported) { setStatus('unsupported'); return; }
    if (status === 'listening') return;

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition       = new SR();
    recognition.continuous  = false;
    recognition.interimResults = true;
    recognition.lang        = langCode();
    recognition.maxAlternatives = 1;

    recognition.onstart = () => { setStatus('listening'); setInterimTranscript(''); };

    recognition.onresult = (e: any) => {
      let interim = '';
      let final   = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final   += e.results[i][0].transcript;
        else                       interim += e.results[i][0].transcript;
      }
      setInterimTranscript(interim);
      if (final) processTranscript(final.trim(), undefined, 'webspeech');
    };

    recognition.onerror = (e: any) => {
      if (e.error === 'no-speech') { setStatus('idle'); return; }
      setStatus('idle');
    };

    recognition.onend = () => {
      if (status === 'listening') setStatus('idle');
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [supported, status, langCode, processTranscript]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setInterimTranscript('');
    setStatus('idle');
  }, []);

  // ── Toggle — mode-aware ───────────────────────────────────────────────────
  const toggle = useCallback(() => {
    if (status === 'responding') { stopSpeaking(); return; }
    if (status === 'listening') {
      if (transcribeMode === 'whisper') stopWhisperRecording();
      else stopListening();
      return;
    }
    if (status === 'idle' || status === 'error') {
      if (transcribeMode === 'whisper') startWhisperRecording();
      else startListening();
    }
  }, [status, transcribeMode, startListening, stopListening, startWhisperRecording, stopWhisperRecording, stopSpeaking]);

  return {
    status,
    transcript,
    interimTranscript,
    result,
    history,
    supported,
    mediaSupported,
    transcribeMode,
    setTranscribeMode,
    recordingSeconds,
    toggle,
    startListening,
    stopListening,
    startWhisperRecording,
    stopWhisperRecording,
    stopSpeaking,
    speak,
    processTranscript,
  };
}
