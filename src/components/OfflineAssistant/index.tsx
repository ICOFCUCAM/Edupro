import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Wifi, WifiOff, Sparkles } from 'lucide-react';
import { chatCompletion, ChatMessage } from '../../lib/openaiClient';
import { teacherAssistantPrompt } from '../../prompts/teacherAssistantPrompt';
import { searchKnowledgeOffline, localSemanticSearch } from '../../lib/offlineDB';

// Lightweight offline response engine using cached curriculum
const OFFLINE_TEMPLATES: Record<string, (subject: string, level: string) => string> = {
  activities: (subject, level) =>
    `Here are 5 activities for ${subject} at ${level} (from cached curriculum):\n\n` +
    `1. **Group Discussion** — Divide class into groups of 4-5 to discuss the topic\n` +
    `2. **Think-Pair-Share** — Students think individually, pair up, then share\n` +
    `3. **Hands-on Practice** — Use locally available materials to demonstrate\n` +
    `4. **Q&A Session** — Teacher-led questioning to check understanding\n` +
    `5. **Exit Ticket** — Short 3-question written assessment at end of lesson\n\n` +
    `_Powered by offline cache. Connect internet for AI-enhanced suggestions._`,

  evaluation: (subject, level) =>
    `Evaluation questions for ${subject} — ${level}:\n\n` +
    `**Oral Questions:**\n- What did you learn today?\n- Can you explain [topic] in your own words?\n\n` +
    `**Written Questions:**\n- Complete the following exercises in your notebook\n- Answer 3 questions from today's lesson\n\n` +
    `**Practical:**\n- Demonstrate understanding through a class activity\n\n` +
    `_Offline mode — connect internet for curriculum-specific questions._`,

  homework: (subject, level) =>
    `Homework suggestions for ${subject} — ${level}:\n\n` +
    `1. Complete the exercises on pages covered today\n` +
    `2. Write a short summary of today's lesson (5 sentences)\n` +
    `3. Find one real-life example of today's topic and share tomorrow\n` +
    `4. Practice 10 minutes of reading related to today's subject\n\n` +
    `_Generated from offline template. Online mode provides curriculum-aligned homework._`,

  lesson: (subject, level) =>
    `Lesson planning outline for ${subject} — ${level}:\n\n` +
    `**Introduction (5 min):** Review previous lesson, set objectives\n` +
    `**Development (20 min):** Teach new content with examples\n` +
    `**Practice (10 min):** Guided and independent activities\n` +
    `**Assessment (5 min):** Oral questions and exit ticket\n\n` +
    `_Basic template available offline. Connect for full AI lesson note generation._`,
};

function getOfflineResponse(query: string, subject: string, level: string): string | null {
  const lower = query.toLowerCase();
  if (lower.includes('activit') || lower.includes('strategy') || lower.includes('strateg')) return OFFLINE_TEMPLATES.activities(subject, level);
  if (lower.includes('evaluat') || lower.includes('question') || lower.includes('assess')) return OFFLINE_TEMPLATES.evaluation(subject, level);
  if (lower.includes('homework') || lower.includes('assignment') || lower.includes('exercise')) return OFFLINE_TEMPLATES.homework(subject, level);
  if (lower.includes('lesson') || lower.includes('plan') || lower.includes('note')) return OFFLINE_TEMPLATES.lesson(subject, level);
  return null;
}

interface Message { role: 'user' | 'assistant'; content: string; offline?: boolean; }

interface OfflineAssistantProps {
  country: string;
  subject?: string;
  classLevel?: string;
  isOnline: boolean;
  userId?: string;
}

const OfflineAssistant: React.FC<OfflineAssistantProps> = ({
  country, subject = 'General', classLevel = 'Primary', isOnline, userId: _userId,
}) => {
  const [messages, setMessages] = useState<Message[]>([{
    role: 'assistant',
    content: `Hello! I'm your ${country} teaching assistant${!isOnline ? ' (offline mode)' : ''}.\n\nI can help with lesson activities, evaluation questions, homework ideas, and curriculum guidance for ${subject}.`,
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setLoading(true);

    try {
      if (!isOnline) {
        // Try offline semantic search first
        const knowledgeResults = await searchKnowledgeOffline(text, country);
        const offlineTemplate = getOfflineResponse(text, subject, classLevel);

        let reply: string;
        if (knowledgeResults.length > 0) {
          const context = knowledgeResults.slice(0, 2).map((r) => `- ${r.title}: ${r.summary}`).join('\n');
          reply = `Based on cached curriculum for ${country}:\n\n${context}\n\n${offlineTemplate ?? 'Ask me about activities, evaluation, homework, or lesson planning.'}`;
        } else if (offlineTemplate) {
          reply = offlineTemplate;
        } else {
          reply = `I'm in offline mode. I can help with:\n• Teaching activities\n• Evaluation questions\n• Homework ideas\n• Lesson planning\n\nConnect to internet for full AI responses about: "${text}"`;
        }

        setMessages((prev) => [...prev, { role: 'assistant', content: reply, offline: true }]);
      } else {
        // Full AI response
        const systemPrompt = teacherAssistantPrompt(country, subject);
        const history: ChatMessage[] = [
          { role: 'system', content: systemPrompt },
          ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
          { role: 'user', content: text },
        ];
        const reply = await chatCompletion(history, { max_tokens: 1000 });
        setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      }
    } catch {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
        offline: !isOnline,
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[520px] bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className={`flex items-center gap-3 px-4 py-3 text-white ${isOnline ? 'bg-gradient-to-r from-blue-600 to-blue-800' : 'bg-gradient-to-r from-slate-600 to-slate-800'}`}>
        <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm">{country} Assistant</p>
          <p className="text-xs opacity-70">{subject} · {classLevel}</p>
        </div>
        <div className="flex items-center gap-1 text-xs opacity-80">
          {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {isOnline ? 'Online' : 'Offline'}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'assistant' ? 'bg-blue-100' : 'bg-emerald-100'}`}>
              {msg.role === 'assistant' ? <Bot className="w-4 h-4 text-blue-600" /> : <User className="w-4 h-4 text-emerald-600" />}
            </div>
            <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === 'assistant'
                ? msg.offline
                  ? 'bg-slate-50 text-slate-700 border border-slate-100 rounded-tl-sm'
                  : 'bg-gray-50 text-gray-800 rounded-tl-sm'
                : 'bg-blue-600 text-white rounded-tr-sm'
            }`}>
              {msg.content}
              {msg.offline && <span className="block text-xs text-slate-400 mt-1">📴 offline response</span>}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center"><Bot className="w-4 h-4 text-blue-600" /></div>
            <div className="bg-gray-50 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1">{[0,1,2].map((i) => <div key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder={isOnline ? 'Ask about lessons, curriculum...' : 'Ask offline (limited)...'}
          className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button onClick={send} disabled={loading || !input.trim()}
          className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 transition-all">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default OfflineAssistant;
