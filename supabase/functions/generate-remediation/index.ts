import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY_URL = 'https://ai.gateway.fastrouter.io/api/v1/chat/completions';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const {
      objective,       // string: the learning objective text
      topic,           // string
      country,         // string
      subject,         // string
      classLevel,      // string
      masteryLevel,    // 'not_started' | 'developing'
      language = 'en', // preferred language code
    } = await req.json();

    if (!objective || !country || !subject) {
      return new Response(JSON.stringify({ error: 'objective, country, subject required' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('GATEWAY_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'GATEWAY_API_KEY not set' }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const levelNote = masteryLevel === 'not_started'
      ? 'Students have no prior exposure. Use very basic language and concrete examples.'
      : 'Students have partial understanding. Reinforce core concepts with practice.';

    const langNote = language !== 'en'
      ? `Generate content in ${language} language.`
      : 'Generate content in English.';

    const prompt = `You are an expert remediation curriculum designer for ${country} ${subject} education.

Objective: "${objective}"
Topic: ${topic || subject}
Class Level: ${classLevel || 'General'}
Mastery Gap: ${masteryLevel} — ${levelNote}
${langNote}

Generate a targeted remediation package with exactly this JSON structure:
{
  "lesson": {
    "title": "string (short remediation title)",
    "explanation": "string (clear 3-4 paragraph simplified explanation with examples)",
    "key_points": ["string", "string", "string"]
  },
  "exercises": [
    { "question": "string", "answer": "string", "hint": "string" }
  ],
  "quiz": [
    {
      "question": "string",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct": "A",
      "explanation": "string"
    }
  ]
}

Rules:
- lesson.explanation must be simplified for the mastery gap level
- exercises: exactly 5 guided practice items with hints
- quiz: exactly 5 multiple-choice questions testing the objective
- All content must align to ${country} curriculum standards
- Return ONLY the JSON object, no markdown, no extra text`;

    const response = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(JSON.stringify({ error: `AI gateway error: ${errText}` }), {
        status: 502, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await response.json();
    const rawContent = aiData.choices?.[0]?.message?.content ?? '';

    // Parse JSON from AI response
    let remediation: any;
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      remediation = JSON.parse(jsonMatch ? jsonMatch[0] : rawContent);
    } catch {
      return new Response(JSON.stringify({ error: 'Failed to parse AI response', raw: rawContent }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, remediation }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
