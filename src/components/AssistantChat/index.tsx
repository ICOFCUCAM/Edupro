import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Sparkles } from 'lucide-react';
import { chatCompletion, ChatMessage } from '../../lib/openaiClient';
import { teacherAssistantPrompt } from '../../prompts/teacherAssistantPrompt';

interface AssistantChatProps {
  country: string;
  subject?: string;
  userId?: string;
}

interface Message { role: 'user' | 'assistant'; content: string; }

const AssistantChat: React.FC<AssistantChatProps> = ({ country, subject = 'General', userId: _userId }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: `Hello! I'm your ${country} curriculum assistant. Ask me anything about lesson planning, curriculum updates, or teaching strategies for ${subject}.` }
  ]);
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
      const systemPrompt = teacherAssistantPrompt(country, subject);
      const history: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: text },
      ];
      const reply = await chatCompletion(history, { max_tokens: 1000 });
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[500px] bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-800 text-white">
        <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center"><Sparkles className="w-4 h-4" /></div>
        <div>
          <p className="font-semibold text-sm">{country} Teaching Assistant</p>
          <p className="text-xs text-blue-200">{subject}</p>
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
              msg.role === 'assistant' ? 'bg-gray-50 text-gray-800 rounded-tl-sm' : 'bg-blue-600 text-white rounded-tr-sm'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center"><Bot className="w-4 h-4 text-blue-600" /></div>
            <div className="bg-gray-50 rounded-2xl rounded-tl-sm px-4 py-2.5"><Loader2 className="w-4 h-4 animate-spin text-blue-500" /></div>
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
          placeholder="Ask about lessons, curriculum, assessment..."
          className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button onClick={send} disabled={loading || !input.trim()}
          className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 transition-all">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default AssistantChat;
