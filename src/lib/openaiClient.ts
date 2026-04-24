const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'https://ai.gateway.fastrouter.io/api/v1';
const GATEWAY_KEY = import.meta.env.VITE_GATEWAY_API_KEY || '';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

export async function chatCompletion(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string> {
  const res = await fetch(`${GATEWAY_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': GATEWAY_KEY,
    },
    body: JSON.stringify({
      model: options.model ?? 'google/gemini-2.5-flash',
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 2000,
    }),
  });

  if (!res.ok) throw new Error(`AI gateway error: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const res = await fetch(`${GATEWAY_URL}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': GATEWAY_KEY,
    },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
  });

  if (!res.ok) throw new Error(`Embedding error: ${res.status}`);
  const data = await res.json();
  return data.data?.[0]?.embedding ?? [];
}
