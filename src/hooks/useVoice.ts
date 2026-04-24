import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getTeacherCoachingData } from '@/services/performanceService';
import { saveVoiceSession } from '@/services/voiceService';
import { saveVoiceDraftOffline } from '@/lib/offlineDB';

export type VoiceStatus = 'idle' | 'listening' | 'processing' | 'responding' | 'error' | 'unsupported';

export interface VoiceEntities {
  country?: string;
  subject?: string;
  class_level?: string;
  topic?: string;
  assessment_type?: string;
  difficulty?: string;
  question_count?: string;
  target_language?: string;
}

export interface VoiceResult {
  intent: string;
  entities: VoiceEntities;
  spoken_response: string;
  confidence: number;
  action_taken?: string;
  generated_title?: string;
  error?: string;
}

export interface UseVoiceOptions {
  teacherId?: string;
  teacherCountry?: string;
  teacherName?: string;
  teacherSubject?: string;
  teacherClassLevel?: string;
  preferredLanguage?: string;
  isOnline?: boolean;
  onNavigate?: (page: string) => void;
}

const LANG_TO_BCP47: Record<string, string> = {
  en: 'en-US',
  fr: 'fr-FR',
  ar: 'ar-SA',
  sw: 'sw-TZ',
  pt: 'pt-PT',
  ha: 'en-NG',
};

const COUNTRY_TO_LANG: Record<string, string> = {
  Cameroon: 'fr-FR',
  Senegal: 'fr-FR',
  Rwanda: 'fr-FR',
  'Democratic Republic of Congo': 'fr-FR',
  Nigeria: 'en-NG',
  Ghana: 'en-GH',
  Kenya: 'en-KE',
  Tanzania: 'sw-TZ',
};

export function useVoice(options: UseVoiceOptions) {
  const {
    teacherId, teacherCountry = 'Nigeria', teacherName, teacherSubject,
    teacherClassLevel, preferredLanguage = 'en', isOnline = true, onNavigate,
  } = options;

  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [result, setResult] = useState<VoiceResult | null>(null);
  const [history, setHistory] = useState<VoiceResult[]>([]);

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const performanceDataRef = useRef<any[]>([]);

  // Detect support
  const supported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // Load performance data for coaching context
  useEffect(() => {
    if (teacherId) {
      getTeacherCoachingData(teacherId)
        .then((data) => { performanceDataRef.current = data; })
        .catch(() => {});
    }
  }, [teacherId]);

  const langCode = (): string =>
    LANG_TO_BCP47[preferredLanguage] ??
    COUNTRY_TO_LANG[teacherCountry] ??
    'en-US';

  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode();
    utterance.rate = 0.92;
    utterance.pitch = 1.05;
    utterance.onend = () => onEnd?.();
    synthRef.current = utterance;
    setStatus('responding');
    window.speechSynthesis.speak(utterance);
  }, [preferredLanguage, teacherCountry]);

  const stopSpeaking = useCallback(() => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setStatus('idle');
  }, []);

  // ── Main processing pipeline ─────────────────────────────
  const processTranscript = useCallback(async (text: string) => {
    if (!text.trim()) { setStatus('idle'); return; }
    setStatus('processing');
    setTranscript(text);

    // Offline fallback: save draft and bail
    if (!isOnline) {
      await saveVoiceDraftOffline({
        id: crypto.randomUUID(),
        transcript: text,
        teacher_id: teacherId ?? '',
        created_at: new Date().toISOString(),
        synced: false,
      }).catch(() => {});
      const msg = 'Voice draft saved. It will be processed when you reconnect.';
      setResult({ intent: 'offline_draft', entities: {}, spoken_response: msg, confidence: 1 });
      speak(msg, () => setStatus('idle'));
      return;
    }

    try {
      // Step 1: detect intent
      const intentRes = await supabase.functions.invoke('voice-intent', {
        body: {
          transcript: text,
          teacherCountry,
          teacherSubject,
          teacherClassLevel,
          teacherName,
          performanceData: performanceDataRef.current,
          language: preferredLanguage,
        },
      });

      if (intentRes.error || !intentRes.data?.success) throw new Error('Intent detection failed');

      const { intent, entities, spoken_response, confidence } = intentRes.data;

      // Step 2: handle by intent
      let finalResponse = spoken_response || '';
      let actionTaken = '';
      let generatedTitle = '';

      switch (intent) {
        case 'generate_lesson': {
          speak(`Generating your ${entities.subject || ''} lesson on ${entities.topic || 'the topic'}, please wait…`);
          const lessonRes = await supabase.functions.invoke('generate-lesson-note', {
            body: {
              country: entities.country,
              subject: entities.subject,
              class_level: entities.class_level,
              topic: entities.topic || 'as specified',
              language: entities.target_language || preferredLanguage,
              teacher_id: teacherId,
            },
          });
          if (lessonRes.data?.lesson) {
            const lesson = lessonRes.data.lesson;
            generatedTitle = lesson.title ?? `${entities.subject} — ${entities.topic}`;
            finalResponse = `Lesson ready: ${generatedTitle}. It has ${lesson.objectives?.length ?? 0} objectives and includes activities. Saved to your library.`;
            actionTaken = 'lesson_generated';
            // Save to DB
            if (teacherId) {
              await supabase.from('lesson_notes').insert({
                teacher_id: teacherId,
                country: entities.country,
                subject: entities.subject,
                class_level: entities.class_level,
                title: generatedTitle,
                topic: entities.topic,
                content: lesson,
                visibility: 'private',
                status: 'draft',
              }).select('id').single();
            }
          } else {
            finalResponse = 'I could not generate the lesson. Please try again or use the lesson generator form.';
          }
          break;
        }

        case 'generate_assessment': {
          speak(`Generating your ${entities.assessment_type || 'assessment'} on ${entities.topic || 'the topic'}, please wait…`);
          const assessRes = await supabase.functions.invoke('generate-assessment', {
            body: {
              country: entities.country,
              subject: entities.subject,
              class_level: entities.class_level,
              topic: entities.topic || 'General',
              packageType: entities.assessment_type || 'quiz',
              difficulty: entities.difficulty || 'standard',
              questionCount: parseInt(entities.question_count ?? '10'),
              language: entities.target_language || preferredLanguage,
              teacherId,
              triggerType: 'manual',
            },
          });
          if (assessRes.data?.assessment?.content) {
            const a = assessRes.data.assessment;
            generatedTitle = `${entities.assessment_type ?? 'Quiz'} — ${entities.topic}`;
            finalResponse = `Assessment ready with ${a.content?.sections?.[0]?.questions?.length ?? 10} questions on ${entities.topic}. Saved to your assessments.`;
            actionTaken = 'assessment_generated';
          } else {
            finalResponse = 'Assessment could not be generated. Please try the Assessment Generator.';
          }
          break;
        }

        case 'check_mastery': {
          if (!finalResponse) {
            const data = performanceDataRef.current;
            if (!data.length) {
              finalResponse = 'No performance data found for your classes yet. Enter student results to unlock mastery analytics.';
            } else {
              const worst = data[0];
              finalResponse = `In ${worst.subject}, ${worst.class_level}, average mastery is ${worst.average_score.toFixed(0)}%.` +
                (worst.weak_objectives.length
                  ? ` Students are struggling with: ${worst.weak_objectives.slice(0, 2).join(' and ')}.`
                  : ' No critical weak areas detected.');
            }
          }
          actionTaken = 'mastery_checked';
          break;
        }

        case 'check_alignment': {
          finalResponse = finalResponse || 'Please open a lesson and use the Alignment Check feature. I can check curriculum alignment from the Lesson Library tab.';
          actionTaken = 'alignment_info';
          break;
        }

        case 'ask_agent':
        case 'general_question':
        default: {
          if (!finalResponse) {
            finalResponse = 'I heard your question. Please check the Knowledge Base for curriculum updates or try rephrasing your question.';
          }
          actionTaken = 'question_answered';
          break;
        }
      }

      const voiceResult: VoiceResult = { intent, entities, spoken_response: finalResponse, confidence, action_taken: actionTaken, generated_title: generatedTitle };
      setResult(voiceResult);
      setHistory((prev) => [voiceResult, ...prev].slice(0, 10));

      // Save session
      if (teacherId) {
        await saveVoiceSession({
          teacher_id: teacherId,
          country: teacherCountry,
          intent,
          transcript: text,
          entities,
          response_summary: finalResponse,
          language: preferredLanguage,
        }).catch(() => {});
      }

      // Speak final response
      if (finalResponse) {
        speak(finalResponse, () => setStatus('idle'));
      } else {
        setStatus('idle');
      }

    } catch (err: any) {
      const errorMsg = 'Sorry, I had trouble processing that. Please try again.';
      setResult({ intent: 'error', entities: {}, spoken_response: errorMsg, confidence: 0, error: err.message });
      speak(errorMsg, () => setStatus('idle'));
    }
  }, [teacherId, teacherCountry, teacherSubject, teacherClassLevel, teacherName, preferredLanguage, isOnline, speak]);

  // ── STT ──────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!supported) { setStatus('unsupported'); return; }
    if (status === 'listening') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = langCode();
    recognition.maxAlternatives = 1;

    recognition.onstart = () => { setStatus('listening'); setInterimTranscript(''); };

    recognition.onresult = (e: any) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      setInterimTranscript(interim);
      if (final) processTranscript(final);
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

  const toggle = useCallback(() => {
    if (status === 'listening') stopListening();
    else if (status === 'responding') stopSpeaking();
    else if (status === 'idle') startListening();
  }, [status, startListening, stopListening, stopSpeaking]);

  return {
    status,
    transcript,
    interimTranscript,
    result,
    history,
    supported,
    toggle,
    startListening,
    stopListening,
    stopSpeaking,
    speak,
    processTranscript,
  };
}
