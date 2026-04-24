import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

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

// ── Embedding generation ───────────────────────────────────
async function generateEmbedding(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const res = await fetch('https://ai.gateway.fastrouter.io/api/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify({
        model: 'google/text-embedding-004',
        input: text.slice(0, 2000),
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return (data.data?.[0]?.embedding as number[]) ?? null
  } catch {
    return null
  }
}

// ── Assessment prompt builder ──────────────────────────────
function buildPrompt(params: {
  country: string; subject: string; classLevel: string; topic: string;
  pkgLabel: string; difficultyDesc: string; questionCount: number;
  langLabel: string; duration: number; objectivesSection: string;
  variantSection: string; differentiated: boolean; term?: string; week?: number;
}): string {
  const { country, subject, classLevel, topic, pkgLabel, difficultyDesc,
          questionCount, langLabel, duration, objectivesSection, variantSection,
          differentiated, term, week } = params
  return `You are an expert African primary school assessment specialist.
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
- Use question types appropriate for primary school: MCQ (with 4 options A-D), True/False, Fill-in-the-blank, Short answer, Structured (multi-part)
- Distribute question types: ~40% MCQ, ~20% True/False, ~20% Fill-in-blank, ~20% short/structured
- Every MCQ must have exactly 4 options (A, B, C, D) and one correct answer
- Total marks must equal sum of all individual question marks
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
      "questions": [{"number": <n>, "text": "...", "type": "true_false", "marks": 1}]
    },
    {
      "title": "Section C – Fill in the Blanks",
      "type": "fill_blank",
      "instructions": "Complete each sentence.",
      "questions": [{"number": <n>, "text": "The ___ is ...", "type": "fill_blank", "marks": 1}]
    },
    {
      "title": "Section D – Short Answer",
      "type": "short_answer",
      "instructions": "Answer in full sentences.",
      "questions": [{"number": <n>, "text": "...", "type": "short_answer", "marks": 2}]
    }
  ],
  "marking_scheme": {
    "total_marks": <total>,
    "answers": [
      {"number": 1, "type": "mcq", "correct_answer": "B", "explanation": "Brief explanation", "marks": 1}
    ],
    "teacher_guidance": "Notes on common errors and partial mark guidance",
    "grade_boundaries": {"A": <min%>, "B": <min%>, "C": <min%>, "D": <min%>, "F": 0}
  }${differentiated ? `,
  "variants": {
    "easy":     {"title": "Easy Version: ${topic}", "instructions": "...", "duration_minutes": ${duration}, "total_marks": <n>, "sections": [...]},
    "standard": {"title": "Standard Version: ${topic}", "sections": [...]},
    "advanced": {"title": "Advanced Version: ${topic}", "sections": [...]}
  }` : ''}
}`
}

// ── Parse AI JSON response ─────────────────────────────────
function parseAIJson(raw: string): Record<string, unknown> {
  const fenceMatch = raw.match(/```json\s*([\s\S]*?)\s*```/)
  const jsonStr = fenceMatch ? fenceMatch[1] : (raw.match(/\{[\s\S]*\}/)?.[0] ?? raw)
  return JSON.parse(jsonStr)
}

// ── Build embedding input text from parsed assessment ──────
function buildEmbeddingText(
  parsed: Record<string, unknown>,
  country: string, subject: string, classLevel: string, topic: string,
): string {
  const sections = (parsed.sections as any[]) ?? []
  const firstQuestions = sections.flatMap((s: any) => s.questions ?? []).slice(0, 5)
    .map((q: any) => q.text).join(' ')
  return `${parsed.title ?? ''} ${topic} ${subject} ${classLevel} ${country} ${firstQuestions}`.trim()
}

// ── Main handler ───────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const {
      country, subject, classLevel, topic, packageType, difficulty,
      questionCount = 10, language = 'en', objectives = '',
      differentiated = false, term, week,
      // Auto-generate: request multiple package types in one call
      packageTypes,           // string[] — if provided, generates multiple packages
      triggerType = 'manual', // 'lesson_save' | 'lesson_upload' | 'objective_select' | 'manual' | 'curriculum_change'
      withEmbedding = false,  // if true, generate and return a vector embedding
    } = await req.json()

    const gatewayApiKey = Deno.env.get('GATEWAY_API_KEY')
    if (!gatewayApiKey) throw new Error('API Gateway key not configured')

    const langLabel   = LANG_LABELS[language]     ?? 'English'
    const duration    = DURATION_DEFAULTS[packageType ?? (packageTypes?.[0])] ?? 30

    const difficultyDesc =
      difficulty === 'easy'     ? 'simple, foundational questions for below-average learners' :
      difficulty === 'standard' ? 'grade-appropriate questions for average learners' :
      difficulty === 'advanced' ? 'challenging, higher-order thinking questions for above-average learners' :
      'a mixed spread: 30% easy, 50% standard, 20% advanced questions'

    const objectivesSection = objectives ? `\nCurriculum Objectives to cover:\n${objectives}\n` : ''
    const variantSection    = differentiated ? `
IMPORTANT: Also generate THREE DIFFERENTIATED VARIANTS:
- easy: adapted for below-average learners (simpler language, scaffolding)
- standard: same as main assessment
- advanced: higher-order thinking, application, analysis
Each variant must contain the same sections structure.` : ''

    // ── Single package type (normal mode) ──────────────────
    const typesToGenerate: string[] = packageTypes ?? [packageType]
    const results: Record<string, unknown>[] = []

    for (const pkgType of typesToGenerate) {
      const pkgLabel = PACKAGE_LABELS[pkgType] ?? pkgType
      const pkgDuration = DURATION_DEFAULTS[pkgType] ?? 30

      const prompt = buildPrompt({
        country, subject, classLevel, topic, pkgLabel,
        difficultyDesc, questionCount, langLabel,
        duration: pkgDuration, objectivesSection, variantSection,
        differentiated, term, week,
      })

      const aiRes = await fetch('https://ai.gateway.fastrouter.io/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': gatewayApiKey },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 8000,
        }),
      })

      const aiData  = await aiRes.json()
      const rawText = aiData.choices?.[0]?.message?.content ?? ''

      try {
        const parsed = parseAIJson(rawText)
        parsed.__package_type = pkgType
        parsed.__trigger_type = triggerType
        results.push(parsed)
      } catch {
        throw new Error(`AI returned invalid JSON for ${pkgType}. Raw: ${rawText.slice(0, 300)}`)
      }
    }

    // ── Embeddings (optional) ──────────────────────────────
    if (withEmbedding) {
      for (const parsed of results) {
        const embText = buildEmbeddingText(
          parsed, country, subject, classLevel, topic
        )
        parsed.__embedding = await generateEmbedding(embText, gatewayApiKey)
      }
    }

    // Return single object or array
    const response = results.length === 1
      ? { success: true, assessment: results[0] }
      : { success: true, assessments: results }

    return new Response(JSON.stringify(response), {
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
