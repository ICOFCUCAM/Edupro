import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LANG_LABELS: Record<string, string> = {
  en: 'English', fr: 'French', ar: 'Arabic', pt: 'Portuguese',
  sw: 'Kiswahili', ha: 'Hausa', yo: 'Yoruba', ig: 'Igbo',
}

const PACKAGE_LABELS: Record<string, string> = {
  class_exercise: 'Class Exercise',
  homework: 'Homework',
  quiz: 'Quiz',
  test: 'Test',
  exam: 'Examination',
  competency_check: 'Competency Check',
}

const DURATION_DEFAULTS: Record<string, number> = {
  class_exercise: 20, homework: 30, quiz: 15, test: 40, exam: 90, competency_check: 25,
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      country, subject, classLevel, topic, packageType, difficulty,
      questionCount = 10, language = 'en', objectives = '',
      differentiated = false, term, week,
    } = await req.json()

    const gatewayApiKey = Deno.env.get('GATEWAY_API_KEY')
    if (!gatewayApiKey) throw new Error('API Gateway key not configured')

    const langLabel = LANG_LABELS[language] ?? 'English'
    const pkgLabel = PACKAGE_LABELS[packageType] ?? packageType
    const duration = DURATION_DEFAULTS[packageType] ?? 30

    const difficultyDesc =
      difficulty === 'easy' ? 'simple, foundational questions suitable for below-average learners' :
      difficulty === 'standard' ? 'grade-appropriate questions for average learners' :
      difficulty === 'advanced' ? 'challenging, higher-order thinking questions for above-average learners' :
      'a mixed spread: 30% easy, 50% standard, 20% advanced questions'

    const variantSection = differentiated ? `
IMPORTANT: Also generate THREE DIFFERENTIATED VARIANTS of the full assessment:
- variant_easy: All questions adapted for below-average learners (simpler language, scaffolding, fewer steps)
- variant_standard: Same as main assessment
- variant_advanced: Extended questions with higher-order thinking, application, analysis

Each variant must contain the same sections structure as the main assessment.` : ''

    const objectivesSection = objectives
      ? `\nCurriculum Objectives to cover:\n${objectives}\n` : ''

    const prompt = `You are an expert African primary school assessment specialist.
Generate a ${pkgLabel} for the following:

Country: ${country}
Subject: ${subject}
Class Level: ${classLevel}
Topic: ${topic}
Difficulty: ${difficultyDesc}
Number of Questions: ${questionCount}
Language: ${langLabel}
${term ? `Term: ${term}` : ''}${week ? ` Week: ${week}` : ''}
${objectivesSection}
Assessment Rules:
- Use question types appropriate for primary school: MCQ (with 4 options A-D), True/False, Fill-in-the-blank, Short answer, Matching, Structured (multi-part)
- Distribute question types: ~40% MCQ, ~20% True/False, ~20% Fill-in-blank, ~20% short answer/structured
- Every MCQ must have exactly 4 options (A, B, C, D) and one correct answer
- Total marks must equal sum of individual question marks
- Duration: ${duration} minutes
- All content in ${langLabel}
${variantSection}

Return ONLY valid JSON — no markdown fences, no explanation:
{
  "title": "${pkgLabel}: ${topic}",
  "instructions": "Clear instructions for learners in ${langLabel}",
  "duration_minutes": ${duration},
  "total_marks": <sum of all marks>,
  "sections": [
    {
      "title": "Section A – Multiple Choice",
      "type": "mcq",
      "instructions": "Circle the correct answer.",
      "questions": [
        {
          "number": 1,
          "text": "Question text",
          "type": "mcq",
          "options": {"A": "...", "B": "...", "C": "...", "D": "..."},
          "marks": 1
        }
      ]
    },
    {
      "title": "Section B – True or False",
      "type": "true_false",
      "instructions": "Write True or False.",
      "questions": [
        {"number": <n>, "text": "...", "type": "true_false", "marks": 1}
      ]
    },
    {
      "title": "Section C – Fill in the Blanks",
      "type": "fill_blank",
      "instructions": "Complete each sentence.",
      "questions": [
        {"number": <n>, "text": "The ___ is ...", "type": "fill_blank", "marks": 1}
      ]
    },
    {
      "title": "Section D – Short Answer",
      "type": "short_answer",
      "instructions": "Answer in full sentences.",
      "questions": [
        {"number": <n>, "text": "...", "type": "short_answer", "marks": 2}
      ]
    }
  ],
  "marking_scheme": {
    "total_marks": <total>,
    "answers": [
      {
        "number": 1,
        "type": "mcq",
        "correct_answer": "B",
        "explanation": "Brief explanation of why B is correct",
        "marks": 1
      }
    ],
    "teacher_guidance": "Notes on common errors to watch for and partial mark award guidance",
    "grade_boundaries": {"A": <min%>, "B": <min%>, "C": <min%>, "D": <min%>, "F": 0}
  }${differentiated ? `,
  "variants": {
    "easy": {
      "title": "Easy Version: ${topic}",
      "instructions": "...",
      "duration_minutes": ${duration},
      "total_marks": <total>,
      "sections": [...]
    },
    "standard": {
      "title": "Standard Version: ${topic}",
      "sections": [...]
    },
    "advanced": {
      "title": "Advanced Version: ${topic}",
      "sections": [...]
    }
  }` : ''}
}`

    const aiRes = await fetch('https://ai.gateway.fastrouter.io/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': gatewayApiKey,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 8000,
      }),
    })

    const aiData = await aiRes.json()
    const rawContent: string = aiData.choices?.[0]?.message?.content ?? ''

    let parsed: Record<string, unknown>
    try {
      const fenceMatch = rawContent.match(/```json\s*([\s\S]*?)\s*```/)
      const jsonStr = fenceMatch ? fenceMatch[1] : rawContent.match(/\{[\s\S]*\}/)?.[0] ?? rawContent
      parsed = JSON.parse(jsonStr)
    } catch {
      throw new Error('AI returned invalid JSON. Raw: ' + rawContent.slice(0, 500))
    }

    return new Response(JSON.stringify({ success: true, assessment: parsed }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})
