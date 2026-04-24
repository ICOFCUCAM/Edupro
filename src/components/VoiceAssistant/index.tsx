import React, { useState } from 'react';
import {
  Mic, MicOff, Volume2, Loader2, X, ChevronUp, ChevronDown,
  BookOpen, ClipboardList, BarChart3, Globe2, AlertCircle, CheckCircle2,
  WifiOff, Radio, Settings2,
} from 'lucide-react';
import {
  useVoice, LANG_OPTIONS,
  type UseVoiceOptions, type VoiceStatus, type TranscribeMode,
} from '@/hooks/useVoice';

// ── Icon / label maps ────────────────────────────────────────────────────────

const INTENT_ICONS: Record<string, React.ReactNode> = {
  generate_lesson:     <BookOpen    className="w-4 h-4 text-blue-600" />,
  generate_assessment: <ClipboardList className="w-4 h-4 text-violet-600" />,
  check_mastery:       <BarChart3   className="w-4 h-4 text-emerald-600" />,
  ask_country_agent:   <Globe2      className="w-4 h-4 text-teal-600" />,
  ask_agent:           <Globe2      className="w-4 h-4 text-teal-600" />,
  general_question:    <Globe2      className="w-4 h-4 text-gray-500" />,
  translate_content:   <Globe2      className="w-4 h-4 text-indigo-600" />,
  check_alignment:     <CheckCircle2 className="w-4 h-4 text-amber-600" />,
  dictate_lesson:      <BookOpen    className="w-4 h-4 text-blue-400" />,
  offline_draft:       <WifiOff     className="w-4 h-4 text-gray-400" />,
  error:               <AlertCircle className="w-4 h-4 text-red-500" />,
};

const INTENT_LABEL: Record<string, string> = {
  generate_lesson:     'Lesson Generated',
  generate_assessment: 'Assessment Generated',
  check_mastery:       'Mastery Analysis',
  ask_country_agent:   'Curriculum Agent',
  ask_agent:           'Curriculum Agent',
  general_question:    'Assistant',
  translate_content:   'Translation',
  check_alignment:     'Alignment Check',
  dictate_lesson:      'Lesson Dictated',
  offline_draft:       'Saved Offline',
  error:               'Error',
};

const EXAMPLE_PROMPTS = [
  'Create a Primary 4 Maths lesson on fractions',
  'Generate a quiz on grammar for JSS 2',
  'Which objectives are weak in my class?',
  'What changed in the curriculum?',
  'Is my latest lesson aligned to curriculum?',
  'Translate this lesson to French',
];

// ── Sub-components ────────────────────────────────────────────────────────────

const StatusRing: React.FC<{ status: VoiceStatus; mode: TranscribeMode; seconds: number }> = ({ status, mode, seconds }) => {
  const base = 'w-16 h-16 rounded-full flex items-center justify-center shadow-xl transition-all duration-300';

  if (status === 'listening') {
    const isWhisper = mode === 'whisper';
    return (
      <div className="relative">
        <div className={`absolute inset-0 rounded-full animate-ping opacity-40 ${isWhisper ? 'bg-violet-500' : 'bg-red-500'}`} />
        <div className={`absolute inset-0 rounded-full animate-ping opacity-20 ${isWhisper ? 'bg-violet-400' : 'bg-red-400'}`} style={{ animationDelay: '0.3s' }} />
        <button className={`${base} text-white relative ${isWhisper ? 'bg-violet-600' : 'bg-red-500'}`}>
          {isWhisper
            ? <div className="flex flex-col items-center">
                <Radio className="w-5 h-5" />
                <span className="text-[9px] font-bold mt-0.5">{seconds}s</span>
              </div>
            : <Mic className="w-6 h-6" />}
        </button>
      </div>
    );
  }
  if (status === 'processing') {
    return (
      <button className={`${base} bg-amber-500 text-white`}>
        <Loader2 className="w-6 h-6 animate-spin" />
      </button>
    );
  }
  if (status === 'responding') {
    return (
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-30" />
        <button className={`${base} bg-emerald-500 text-white relative`}>
          <Volume2 className="w-6 h-6" />
        </button>
      </div>
    );
  }
  if (status === 'unsupported') {
    return (
      <button className={`${base} bg-gray-400 text-white cursor-not-allowed`}>
        <MicOff className="w-6 h-6" />
      </button>
    );
  }
  return (
    <div className="relative group">
      <div className="absolute inset-0 rounded-full bg-purple-500 opacity-0 group-hover:opacity-30 transition-opacity" />
      <button className={`${base} bg-gradient-to-br from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500`}>
        <Mic className="w-6 h-6" />
      </button>
    </div>
  );
};

const StatusLabel: React.FC<{ status: VoiceStatus; interimTranscript: string; mode: TranscribeMode }> = ({ status, interimTranscript, mode }) => {
  const labels: Record<VoiceStatus, string> = {
    idle:        mode === 'whisper' ? 'Tap to record (Whisper)' : 'Speak to EduPro',
    listening:   mode === 'whisper' ? 'Recording… tap to send' : (interimTranscript || 'Listening…'),
    processing:  'Processing…',
    responding:  'Speaking…',
    error:       'Try again',
    unsupported: 'Not supported',
  };
  return (
    <span className="text-xs font-medium text-center leading-tight max-w-[140px] truncate">
      {labels[status]}
    </span>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

interface VoiceAssistantProps extends UseVoiceOptions {
  isOnline?: boolean;
}

const VoiceAssistant: React.FC<VoiceAssistantProps> = (props) => {
  const [panelOpen,    setPanelOpen]    = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeLang,   setActiveLang]   = useState(props.preferredLanguage ?? 'en');

  const voice = useVoice({ ...props, preferredLanguage: activeLang });
  const {
    status, transcript, interimTranscript, result, history,
    supported, mediaSupported, transcribeMode, setTranscribeMode,
    recordingSeconds, toggle, processTranscript, stopSpeaking,
  } = voice;

  const handleToggle = () => {
    if (status === 'responding') { stopSpeaking(); return; }
    if (!panelOpen) setPanelOpen(true);
    toggle();
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Panel */}
      {panelOpen && (
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-[340px] max-h-[560px] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-indigo-50 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
                <Mic className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">EduPro Voice</p>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${props.isOnline ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                  <span className="text-[10px] text-gray-500">
                    {props.isOnline ? (transcribeMode === 'whisper' ? 'Whisper mode' : 'Live mode') : 'Offline — drafts saved'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setShowSettings(!showSettings)}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700" title="Settings">
                <Settings2 className="w-4 h-4" />
              </button>
              <button onClick={() => setShowExamples(!showExamples)}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700" title="Example prompts">
                {showExamples ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
              <button onClick={() => setPanelOpen(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Settings panel */}
          {showSettings && (
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 space-y-3 flex-shrink-0">
              {/* Language selector */}
              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Language</p>
                <div className="flex flex-wrap gap-1.5">
                  {LANG_OPTIONS.map(l => (
                    <button
                      key={l.code}
                      onClick={() => setActiveLang(l.code)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                        activeLang === l.code
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Mode toggle */}
              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Transcription Mode</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTranscribeMode('webspeech')}
                    disabled={!supported}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      transcribeMode === 'webspeech'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 disabled:opacity-40'
                    }`}
                  >
                    Live Speech {!supported && '(unavailable)'}
                  </button>
                  <button
                    onClick={() => setTranscribeMode('whisper')}
                    disabled={!mediaSupported}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      transcribeMode === 'whisper'
                        ? 'bg-violet-600 text-white border-violet-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300 disabled:opacity-40'
                    }`}
                  >
                    Whisper (accurate)
                  </button>
                </div>
                {transcribeMode === 'whisper' && (
                  <p className="text-[10px] text-gray-400 mt-1">Tap mic → speak → tap again to send. Works in all browsers.</p>
                )}
              </div>
            </div>
          )}

          {/* Example prompts */}
          {showExamples && (
            <div className="px-4 py-3 border-b border-gray-100 bg-purple-50/50 flex-shrink-0">
              <p className="text-[10px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">Try saying…</p>
              <div className="space-y-1.5">
                {EXAMPLE_PROMPTS.map(p => (
                  <button key={p}
                    onClick={() => { setShowExamples(false); processTranscript(p); }}
                    className="w-full text-left text-xs text-purple-700 bg-white border border-purple-100 rounded-lg px-3 py-2 hover:bg-purple-50 transition-colors"
                  >
                    "{p}"
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Live transcript preview */}
          {status === 'listening' && interimTranscript && (
            <div className="px-4 py-2 bg-red-50 border-b border-red-100 flex-shrink-0">
              <p className="text-xs text-red-700 italic">{interimTranscript}</p>
            </div>
          )}

          {/* Whisper recording banner */}
          {status === 'listening' && transcribeMode === 'whisper' && (
            <div className="px-4 py-2 bg-violet-50 border-b border-violet-100 flex items-center gap-2 flex-shrink-0">
              <div className="w-2 h-2 bg-violet-500 rounded-full animate-pulse" />
              <p className="text-xs text-violet-700 font-medium">Recording {recordingSeconds}s — tap mic to send</p>
            </div>
          )}

          {/* Current result */}
          {result && (
            <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
              <div className={`rounded-xl p-3 ${
                result.intent === 'error'        ? 'bg-red-50' :
                result.intent === 'offline_draft' ? 'bg-gray-50' :
                'bg-purple-50'
              }`}>
                <div className="flex items-center gap-1.5 mb-2">
                  {INTENT_ICONS[result.intent] ?? <Globe2 className="w-4 h-4 text-gray-400" />}
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    {INTENT_LABEL[result.intent] ?? result.intent}
                  </span>
                  {result.generated_title && (
                    <span className="ml-auto text-[10px] text-emerald-600 font-medium">✓ Saved</span>
                  )}
                  {result.alignment_score !== undefined && (
                    <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      result.alignment_score >= 80 ? 'bg-emerald-100 text-emerald-700' :
                      result.alignment_score >= 60 ? 'bg-blue-100 text-blue-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>{result.alignment_score}% aligned</span>
                  )}
                </div>
                {transcript && (
                  <p className="text-xs text-gray-500 italic mb-1.5">"{transcript}"</p>
                )}
                <p className="text-sm text-gray-800 leading-relaxed">{result.spoken_response}</p>
                {result.entities.topic && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {result.entities.subject     && <span className="text-[10px] bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{result.entities.subject}</span>}
                    {result.entities.class_level && <span className="text-[10px] bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{result.entities.class_level}</span>}
                    {result.entities.topic       && <span className="text-[10px] bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{result.entities.topic}</span>}
                  </div>
                )}
                {result.action_taken === 'lesson_generated' && props.onNavigate && (
                  <button onClick={() => props.onNavigate?.('my-lessons')}
                    className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 font-medium">
                    <BookOpen className="w-3.5 h-3.5" /> View in Lesson Library
                  </button>
                )}
                {result.action_taken === 'assessment_generated' && props.onNavigate && (
                  <button onClick={() => props.onNavigate?.('my-assessments')}
                    className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-xs rounded-lg hover:bg-violet-700 font-medium">
                    <ClipboardList className="w-3.5 h-3.5" /> View Assessment
                  </button>
                )}
                {result.action_taken === 'lesson_dictated' && props.onNavigate && (
                  <button onClick={() => props.onNavigate?.('my-lessons')}
                    className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 font-medium">
                    <BookOpen className="w-3.5 h-3.5" /> Open Lesson Draft
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!result && status === 'idle' && (
            <div className="px-4 py-6 text-center text-gray-400 flex-shrink-0">
              <Mic className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm">Tap the microphone to speak.</p>
              <p className="text-xs mt-1">Generate lessons, check mastery, ask curriculum questions.</p>
            </div>
          )}

          {status === 'processing' && (
            <div className="px-4 py-4 flex items-center justify-center gap-2 text-sm text-amber-600 flex-shrink-0">
              <Loader2 className="w-4 h-4 animate-spin" /> Analysing your request…
            </div>
          )}

          {!supported && transcribeMode === 'webspeech' && (
            <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex-shrink-0">
              <p className="text-xs text-amber-700">Live speech requires Chrome, Edge, or Safari. Switch to <strong>Whisper mode</strong> above to use any browser.</p>
            </div>
          )}

          {/* Recent history */}
          {history.length > 1 && (
            <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Recent</p>
              <div className="space-y-2">
                {history.slice(1, 5).map((h, i) => (
                  <div key={i} className="flex items-start gap-2 py-1.5">
                    <div className="mt-0.5 flex-shrink-0">
                      {INTENT_ICONS[h.intent] ?? <Globe2 className="w-3.5 h-3.5 text-gray-300" />}
                    </div>
                    <p className="text-xs text-gray-500 truncate italic flex-1">"{h.spoken_response?.slice(0, 60)}…"</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating mic button */}
      <div className="flex flex-col items-center gap-1.5" onClick={handleToggle}>
        <StatusRing status={status} mode={transcribeMode} seconds={recordingSeconds} />
        <div className={`px-3 py-1 rounded-full text-xs font-medium shadow-sm border transition-all ${
          status === 'listening'  ? (transcribeMode === 'whisper' ? 'bg-violet-50 text-violet-600 border-violet-200' : 'bg-red-50 text-red-600 border-red-200') :
          status === 'processing' ? 'bg-amber-50 text-amber-700 border-amber-200' :
          status === 'responding' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
          'bg-white text-gray-600 border-gray-200'
        }`}>
          <StatusLabel status={status} interimTranscript={interimTranscript} mode={transcribeMode} />
        </div>
      </div>
    </div>
  );
};

export default VoiceAssistant;
