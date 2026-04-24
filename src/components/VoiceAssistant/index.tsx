import React, { useState } from 'react';
import {
  Mic, MicOff, Volume2, Loader2, X, ChevronUp, ChevronDown,
  BookOpen, ClipboardList, BarChart3, Globe2, AlertCircle, CheckCircle2,
  Wifi, WifiOff,
} from 'lucide-react';
import { useVoice, type UseVoiceOptions, type VoiceStatus } from '@/hooks/useVoice';

const INTENT_ICONS: Record<string, React.ReactNode> = {
  generate_lesson: <BookOpen className="w-4 h-4 text-blue-600" />,
  generate_assessment: <ClipboardList className="w-4 h-4 text-violet-600" />,
  check_mastery: <BarChart3 className="w-4 h-4 text-emerald-600" />,
  ask_agent: <Globe2 className="w-4 h-4 text-teal-600" />,
  general_question: <Globe2 className="w-4 h-4 text-gray-500" />,
  translate_content: <Globe2 className="w-4 h-4 text-indigo-600" />,
  check_alignment: <CheckCircle2 className="w-4 h-4 text-amber-600" />,
  offline_draft: <WifiOff className="w-4 h-4 text-gray-400" />,
  error: <AlertCircle className="w-4 h-4 text-red-500" />,
};

const INTENT_LABEL: Record<string, string> = {
  generate_lesson: 'Lesson Generated',
  generate_assessment: 'Assessment Generated',
  check_mastery: 'Mastery Analysis',
  ask_agent: 'Curriculum Agent',
  general_question: 'Assistant',
  translate_content: 'Translation',
  check_alignment: 'Alignment Check',
  offline_draft: 'Saved Offline',
  error: 'Error',
};

const EXAMPLE_PROMPTS = [
  'Create a Primary 4 Maths lesson on fractions',
  'Generate homework on grammar for JSS 2',
  'Which objectives are weak in my class?',
  'What changed in the curriculum?',
  'Translate this lesson to French',
];

interface VoiceAssistantProps extends UseVoiceOptions {
  isOnline?: boolean;
}

const StatusRing: React.FC<{ status: VoiceStatus }> = ({ status }) => {
  const base = 'w-16 h-16 rounded-full flex items-center justify-center shadow-xl transition-all duration-300';
  if (status === 'listening') {
    return (
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-40" />
        <div className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-20" style={{ animationDelay: '0.3s' }} />
        <button className={`${base} bg-red-500 text-white relative`}>
          <Mic className="w-6 h-6" />
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
  // idle
  return (
    <div className="relative group">
      <div className="absolute inset-0 rounded-full bg-purple-500 opacity-0 group-hover:opacity-30 transition-opacity" />
      <button className={`${base} bg-gradient-to-br from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500`}>
        <Mic className="w-6 h-6" />
      </button>
    </div>
  );
};

const StatusLabel: React.FC<{ status: VoiceStatus; interimTranscript: string }> = ({ status, interimTranscript }) => {
  const labels: Record<VoiceStatus, string> = {
    idle: 'Speak to EduPro',
    listening: interimTranscript || 'Listening…',
    processing: 'Processing…',
    responding: 'Speaking…',
    error: 'Try again',
    unsupported: 'Voice not supported',
  };
  return (
    <span className="text-xs font-medium text-center leading-tight max-w-[120px] truncate">
      {labels[status]}
    </span>
  );
};

const VoiceAssistant: React.FC<VoiceAssistantProps> = (props) => {
  const [panelOpen, setPanelOpen] = useState(false);
  const [showExamples, setShowExamples] = useState(false);

  const voice = useVoice(props);
  const { status, transcript, interimTranscript, result, history, supported, toggle, processTranscript, stopSpeaking } = voice;

  const handleToggle = () => {
    if (status === 'responding') { stopSpeaking(); return; }
    if (!panelOpen) setPanelOpen(true);
    toggle();
  };

  if (!supported && status !== 'unsupported') {
    // Still render button but show unsupported tooltip
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Panel */}
      {panelOpen && (
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-[340px] max-h-[520px] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-indigo-50">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
                <Mic className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">EduPro Voice</p>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${props.isOnline ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                  <span className="text-[10px] text-gray-500">{props.isOnline ? 'Online' : 'Offline — drafts saved'}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowExamples(!showExamples)}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700 transition-colors"
                title="Example prompts"
              >
                {showExamples ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setPanelOpen(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Example prompts */}
          {showExamples && (
            <div className="px-4 py-3 border-b border-gray-100 bg-purple-50/50">
              <p className="text-[10px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">Try saying…</p>
              <div className="space-y-1.5">
                {EXAMPLE_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => { setShowExamples(false); processTranscript(p); }}
                    className="w-full text-left text-xs text-purple-700 bg-white border border-purple-100 rounded-lg px-3 py-2 hover:bg-purple-50 transition-colors"
                  >
                    "{p}"
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Transcript live preview */}
          {(status === 'listening' && interimTranscript) && (
            <div className="px-4 py-2 bg-red-50 border-b border-red-100">
              <p className="text-xs text-red-700 italic">{interimTranscript}</p>
            </div>
          )}

          {/* Current result */}
          {result && (
            <div className="px-4 py-3 border-b border-gray-100">
              <div className={`rounded-xl p-3 ${
                result.intent === 'error' ? 'bg-red-50' :
                result.intent === 'offline_draft' ? 'bg-gray-50' :
                'bg-purple-50'
              }`}>
                {/* Intent badge */}
                <div className="flex items-center gap-1.5 mb-2">
                  {INTENT_ICONS[result.intent] ?? <Globe2 className="w-4 h-4 text-gray-400" />}
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    {INTENT_LABEL[result.intent] ?? result.intent}
                  </span>
                  {result.generated_title && (
                    <span className="ml-auto text-[10px] text-emerald-600 font-medium">✓ Saved</span>
                  )}
                </div>
                {/* Transcript */}
                {transcript && (
                  <p className="text-xs text-gray-500 italic mb-1.5">"{transcript}"</p>
                )}
                {/* Response */}
                <p className="text-sm text-gray-800 leading-relaxed">{result.spoken_response}</p>
                {/* Entities summary */}
                {result.entities.topic && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {result.entities.subject && (
                      <span className="text-[10px] bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                        {result.entities.subject}
                      </span>
                    )}
                    {result.entities.class_level && (
                      <span className="text-[10px] bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                        {result.entities.class_level}
                      </span>
                    )}
                    {result.entities.topic && (
                      <span className="text-[10px] bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                        {result.entities.topic}
                      </span>
                    )}
                  </div>
                )}
                {/* Navigation CTA for action intents */}
                {result.action_taken === 'lesson_generated' && props.onNavigate && (
                  <button
                    onClick={() => props.onNavigate?.('my-lessons')}
                    className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 font-medium"
                  >
                    <BookOpen className="w-3.5 h-3.5" /> View in Lesson Library
                  </button>
                )}
                {result.action_taken === 'assessment_generated' && props.onNavigate && (
                  <button
                    onClick={() => props.onNavigate?.('my-assessments')}
                    className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-xs rounded-lg hover:bg-violet-700 font-medium"
                  >
                    <ClipboardList className="w-3.5 h-3.5" /> View Assessment
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Status area / empty state */}
          {!result && status === 'idle' && (
            <div className="px-4 py-6 text-center text-gray-400">
              <Mic className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm">Tap the microphone to speak.</p>
              <p className="text-xs mt-1">Ask about lessons, assessments, or student mastery.</p>
            </div>
          )}

          {status === 'processing' && (
            <div className="px-4 py-4 flex items-center justify-center gap-2 text-sm text-amber-600">
              <Loader2 className="w-4 h-4 animate-spin" /> Analysing your request…
            </div>
          )}

          {!supported && (
            <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
              <p className="text-xs text-amber-700">Voice recognition requires Chrome, Edge, or Safari. Use the example prompts above to try text input.</p>
            </div>
          )}

          {/* History */}
          {history.length > 1 && (
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Recent</p>
              <div className="space-y-2">
                {history.slice(1, 5).map((h, i) => (
                  <div key={i} className="flex items-start gap-2 py-1.5">
                    <div className="mt-0.5 flex-shrink-0">
                      {INTENT_ICONS[h.intent] ?? <Globe2 className="w-3.5 h-3.5 text-gray-300" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 truncate italic">"{h.spoken_response?.slice(0, 60)}…"</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating button + label */}
      <div className="flex flex-col items-center gap-1.5" onClick={handleToggle}>
        <StatusRing status={status} />
        <div className={`px-3 py-1 rounded-full text-xs font-medium shadow-sm border transition-all ${
          status === 'listening' ? 'bg-red-50 text-red-600 border-red-200' :
          status === 'processing' ? 'bg-amber-50 text-amber-700 border-amber-200' :
          status === 'responding' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
          'bg-white text-gray-600 border-gray-200'
        }`}>
          <StatusLabel status={status} interimTranscript={interimTranscript} />
        </div>
      </div>
    </div>
  );
};

export default VoiceAssistant;
