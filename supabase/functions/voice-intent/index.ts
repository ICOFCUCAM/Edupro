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
      transcript,
      teacherCountry,
      teacherSubject,
      teacherClassLevel,
      teacherName,
      performanceData,
      language = 'en',
      // NEW context fields
      curriculumObjectives,  // string: bullet-list of objectives
      knowledgeSnippets,     // string[]: country KB entries
      schemeContext,         // string: school scheme-of-work snippets
    } = await req.json();

    if (!transcript) {
      return new Response(
        JSON.stringify({ error: 'transcript required' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    const apiKey = Deno.env.get('GATEWAY_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'GATEWAY_API_KEY not set' }),
        { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    // ── Build context blocks ─────────────────────────────────

    const perfContext = Array.isArray(performanceData) && performanceData.length > 0
      ? performanceData.map((c: any) =>
          `${c.subject} ${c.class_level}: avg ${c.average_score?.toFixed(1) ?? '?'}%, ` +
          `${c.intervention_needed ? 'INTERVENTION NEEDED. ' : ''}` +
          (c.weak_objectives?.length
            ? `Weak areas: ${c.weak_objectives.slice(0, 3).join('; ')}`
            : 'No critical weak areas')
        ).join('\n')
      : null;

    const curriculumBlock = curriculumObjectives
      ? `\nNational Curriculum Objectives (${teacherSubject}, ${teacherClassLevel}):\n${curriculumObjectives}`
      : '';

    const knowledgeBlock = Array.isArray(knowledgeSnippets) && knowledgeSnippets.length > 0
      ? `\nCountry Education Policy (${teacherCountry}):\n${knowledgeSnippets.map((s: string) => `• ${s}`).join('\n')}`
      : '';

    const schemeBlock = schemeContext
      ? `\nSchool Scheme of Work:\n${schemeContext}`
      : '';

    // ── System prompt ────────────────────────────────────────

    const systemPrompt = `You are EduPro Voice — an AI teaching assistant for educators in ${teacherCountry || 'Africa'}.

Teacher context:
- Name: ${teacherName || 'Teacher'}
- Country: ${teacherCountry || 'Nigeria'}
- Subject: ${teacherSubject || 'not specified'}
- Class level: ${teacherClassLevel || 'not specified'}
- Language: ${language}
${perfContext ? `\nClass performance data:\n${perfContext}` : ''}${curriculumBlock}${knowledgeBlock}${schemeBlock}

IMPORTANT — respond ONLY with a single valid JSON object. No markdown, no explanation outside the JSON.

JSON format:
{
  "intent": "<one of: generate_lesson | generate_assessment | check_mastery | ask_country_agent | check_alignment | translate_content | dictate_lesson | ask_textbook | localize_lesson | compare_curriculum | general_question>",
  "entities": {
    "country": "<extracted or teacher default>",
    "subject": "<extracted or teacher default>",
    "class_level": "<extracted or teacher default>",
    "topic": "<extracted topic or null>",
    "assessment_type": "<quiz|test|homework|class_exercise|exam or null>",
    "difficulty": "<easy|standard|advanced|mixed or null>",
    "question_count": "<number string or null>",
    "target_language": "<en|fr|ar|sw|pt|pcm or null>",
    "textbook_query": "<the raw search phrase for ask_textbook intent, e.g. 'fractions', 'chapter on photosynthesis' — or null>",
    "target_country": "<the destination country for localize_lesson or second country for compare_curriculum — or null>"
  },
  "spoken_response": "<1–3 sentence spoken answer for informational intents. EMPTY STRING for action intents (generate_lesson, generate_assessment, dictate_lesson, check_alignment, translate_content, ask_textbook, localize_lesson).>",
  "confidence": <0.0 to 1.0>
}

Intent rules:
- generate_lesson      : teacher wants to create/generate/make a lesson note or lesson plan
- generate_assessment  : teacher wants to create a test, quiz, homework, exam, or exercise
- check_mastery        : teacher asks about student performance, weak objectives, mastery, struggling students, class analytics
- ask_country_agent    : teacher asks about curriculum policy, curriculum updates, what changed, guidelines, ministry directives, scheme requirements — use the country knowledge block above to answer
- check_alignment      : teacher asks to check/verify if a lesson is aligned to curriculum
- translate_content    : teacher wants content translated to another language
- dictate_lesson       : teacher is dictating lesson content aloud ("lesson title:", "objectives:", "today we will learn…")
- ask_textbook         : teacher asks which chapter in the textbook covers a topic ("which chapter covers fractions?", "where is photosynthesis in the textbook?", "find me the chapter on algebra")
- localize_lesson      : teacher wants to adapt/convert/localize their lesson for another country's curriculum ("convert my lesson to Ghana curriculum", "localize this for Kenya", "adapt my fractions lesson for Cameroon")
- compare_curriculum   : teacher or admin asks how similar two countries' curricula are ("how similar is Nigeria and Ghana math?", "compare Cameroon and Nigeria curriculum", "what's the overlap between Kenya and Uganda science?")
- general_question     : questions about pedagogy, methodology, definitions, explanations

Spoken response rules:
• For check_mastery: use the performance data. If no data, say how to get started.
• For ask_country_agent: use the country knowledge block to give a specific, factual answer grounded in ${teacherCountry}'s curriculum policy. Cite the policy name if possible.
• For ask_textbook: return EMPTY STRING — the client handles the search and speaks the result.
• For localize_lesson: return EMPTY STRING — the client fetches the lesson and calls the localization engine.
• For compare_curriculum: give a concise 1–2 sentence answer describing curriculum overlap if you know it; otherwise say you will look it up. Extract target_country from the transcript.
• For general_question: give a helpful 1–3 sentence pedagogical answer.
• Language of spoken_response: match the teacher's language (${language}).
• Pidgin (pcm): write the response in Nigerian/Cameroonian Pidgin English if language is 'pcm'.`;

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
          { role: 'user',   content: transcript },
        ],
        temperature: 0.15,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(
        JSON.stringify({ error: `AI gateway error: ${errText}` }),
        { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
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
          country:      teacherCountry,
          subject:      teacherSubject,
          class_level:  teacherClassLevel,
        },
        spoken_response: rawContent.slice(0, 400),
        confidence: 0.5,
      };
    }

    // Fill missing entities from teacher profile defaults
    result.entities = {
      country:     teacherCountry  || 'Nigeria',
      subject:     teacherSubject  || '',
      class_level: teacherClassLevel || '',
      ...result.entities,
    };

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});
