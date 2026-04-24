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
      transcript,        // string: what teacher said
      teacherCountry,    // string: teacher's country
      teacherSubject,    // string: teacher's default subject
      teacherClassLevel, // string: teacher's default class
      teacherName,       // string
      performanceData,   // ClassPerformanceSummary[] | null
      language = 'en',   // preferred language code
    } = await req.json();

    if (!transcript) {
      return new Response(JSON.stringify({ error: 'transcript required' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('GATEWAY_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'GATEWAY_API_KEY not set' }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const perfContext = Array.isArray(performanceData) && performanceData.length > 0
      ? performanceData.map((c: any) =>
          `${c.subject} ${c.class_level}: avg ${c.average_score?.toFixed(1)}%, ` +
          `${c.intervention_needed ? 'INTERVENTION NEEDED, ' : ''}` +
          (c.weak_objectives?.length ? `weak: ${c.weak_objectives.slice(0, 3).join('; ')}` : 'no weak objectives')
        ).join('\n')
      : null;

    const systemPrompt = `You are an AI intent classifier and voice assistant for EduPro, an educational platform used by teachers in ${teacherCountry || 'Africa'}.

Teacher context:
- Name: ${teacherName || 'Teacher'}
- Country: ${teacherCountry || 'Nigeria'}
- Default subject: ${teacherSubject || 'not specified'}
- Default class level: ${teacherClassLevel || 'not specified'}
${perfContext ? `\nClass performance data:\n${perfContext}` : ''}

You must return ONLY a valid JSON object (no markdown, no explanation) in this exact format:
{
  "intent": "<one of: generate_lesson | generate_assessment | check_mastery | ask_agent | translate_content | check_alignment | dictate_lesson | general_question>",
  "entities": {
    "country": "<extracted or use teacher default>",
    "subject": "<extracted or use teacher default>",
    "class_level": "<extracted or use teacher default>",
    "topic": "<extracted topic or null>",
    "assessment_type": "<quiz|test|homework|class_exercise|exam or null>",
    "difficulty": "<easy|standard|advanced|mixed or null>",
    "question_count": "<number or null>",
    "target_language": "<language code: en|fr|ar|sw|pt|ha or null>"
  },
  "spoken_response": "<A 1-2 sentence spoken response FOR informational intents (check_mastery, ask_agent, general_question) only. For action intents, return empty string.>",
  "confidence": <0.0 to 1.0>
}

Intent mapping rules:
- generate_lesson: teacher wants to create a lesson note (create/generate/make + lesson/plan/note)
- generate_assessment: teacher wants to create a test/quiz/homework/assessment/exam/exercise
- check_mastery: teacher asks about student performance, weak objectives, class analytics, who is struggling
- ask_agent: teacher asks about curriculum changes, policy updates, what's new, country guidelines
- translate_content: teacher wants content in a different language
- check_alignment: teacher wants to check if lesson matches curriculum
- dictate_lesson: teacher is dictating a lesson ("lesson title:", "objective:", "the lesson starts with")
- general_question: everything else (explanations, definitions, methodology questions)

For informational intents (check_mastery, ask_agent, general_question), provide a helpful spoken_response using the performance data if available.`;

    const response = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: transcript },
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(JSON.stringify({ error: `AI gateway error: ${errText}` }), {
        status: 502, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await response.json();
    const rawContent = aiData.choices?.[0]?.message?.content?.trim() ?? '{}';

    let result: any;
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      result = JSON.parse(jsonMatch ? jsonMatch[0] : rawContent);
    } catch {
      result = {
        intent: 'general_question',
        entities: {
          country: teacherCountry,
          subject: teacherSubject,
          class_level: teacherClassLevel,
        },
        spoken_response: rawContent.slice(0, 300),
        confidence: 0.5,
      };
    }

    // Fill defaults from teacher profile
    result.entities = {
      country: teacherCountry || 'Nigeria',
      subject: teacherSubject || 'Mathematics',
      class_level: teacherClassLevel || '',
      ...result.entities,
    };

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
