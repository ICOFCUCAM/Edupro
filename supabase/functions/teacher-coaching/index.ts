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
      question,        // string: teacher's question
      performanceData, // JSON: ClassPerformanceSummary[]
      country,
      teacherName,
    } = await req.json();

    if (!question) {
      return new Response(JSON.stringify({ error: 'question required' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('GATEWAY_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'GATEWAY_API_KEY not set' }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Format performance data as readable context
    const perfContext = Array.isArray(performanceData) && performanceData.length > 0
      ? performanceData.map((c: any) =>
          `Class: ${c.class_level} | Subject: ${c.subject} | Average: ${c.average_score?.toFixed(1)}% | Students: ${c.student_count} | Intervention needed: ${c.intervention_needed ? 'YES' : 'No'}` +
          (c.weak_objectives?.length
            ? `\n  Weak objectives: ${c.weak_objectives.slice(0, 5).join('; ')}`
            : '') +
          (c.strong_objectives?.length
            ? `\n  Strong areas: ${c.strong_objectives.slice(0, 3).join('; ')}`
            : '')
        ).join('\n\n')
      : 'No performance data available yet for this teacher\'s classes.';

    const systemPrompt = `You are an expert teacher coaching assistant for ${country || 'African'} schools. You help teachers understand their students' learning performance and provide actionable, specific pedagogical advice.

Your tone is: supportive, specific, and practical. Keep responses concise (3-5 sentences max unless the teacher asks for detail). Always reference actual data when available.

Current class performance data:
${perfContext}

Teacher: ${teacherName || 'Teacher'}`;

    const response = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question },
        ],
        temperature: 0.5,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(JSON.stringify({ error: `AI gateway error: ${errText}` }), {
        status: 502, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await response.json();
    const answer = aiData.choices?.[0]?.message?.content?.trim() ?? 'I could not generate a coaching response. Please try again.';

    return new Response(JSON.stringify({ success: true, answer }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
