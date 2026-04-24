import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AlignmentRequest {
  lessonText: string
  country: string
  subject: string
  classLevel: string
  objectives: string        // pre-formatted bullet list from DB
  schoolScheme?: string     // optional school-level scheme-of-work context
}

interface AlignmentResult {
  alignmentScore: number
  confidenceScore: number
  matchedObjectives: string[]
  missingObjectives: string[]
  recommendations: string[]
  schoolAlignmentScore?: number
  schoolMatchedObjectives?: string[]
  schoolMissingObjectives?: string[]
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body: AlignmentRequest = await req.json()
    const { lessonText, country, subject, classLevel, objectives, schoolScheme } = body

    const gatewayApiKey = Deno.env.get('GATEWAY_API_KEY')
    if (!gatewayApiKey) throw new Error('API Gateway key not configured')

    const schoolSection = schoolScheme
      ? `\n\nSchool Scheme of Work / Local Curriculum Notes:\n${schoolScheme.slice(0, 1500)}`
      : ''

    const prompt = `You are an expert ${country} education curriculum analyst.

Analyze this lesson note against the ${country} ${subject} ${classLevel} national curriculum objectives.

## Lesson Note (excerpt):
${lessonText.slice(0, 3000)}

## National Curriculum Objectives for ${country} — ${subject}, ${classLevel}:
${objectives}
${schoolSection}

## Task:
1. Identify which curriculum objectives are addressed in this lesson (matched_objectives).
2. Identify which curriculum objectives are NOT covered or only superficially mentioned (missing_objectives).
3. Calculate an alignment score 0–100 based on how many objectives are covered and how deeply.
4. Provide 2–4 short, actionable improvement recommendations.
5. Rate your confidence in this analysis 0–100 (lower if lesson text is vague or short).
${schoolScheme ? '6. Also rate alignment against the school scheme of work separately (school_alignment_score 0–100).' : ''}

## Rules:
- Only include an objective in matched_objectives if the lesson clearly addresses it.
- Recommendations must be specific to this lesson and these objectives.
- Score 75–100 = Fully Aligned, 45–74 = Partial, 0–44 = Needs Improvement.

Return ONLY valid JSON — no markdown, no explanation:
{
  "alignmentScore": <0-100>,
  "confidenceScore": <0-100>,
  "matchedObjectives": ["objective text", ...],
  "missingObjectives": ["objective text", ...],
  "recommendations": ["recommendation", ...]${schoolScheme ? ',\n  "schoolAlignmentScore": <0-100>,\n  "schoolMatchedObjectives": ["..."],\n  "schoolMissingObjectives": ["..."]' : ''}
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
        temperature: 0.2,
        max_tokens: 1500,
      }),
    })

    const aiData = await aiRes.json()
    const rawContent: string = aiData.choices?.[0]?.message?.content ?? ''

    let result: AlignmentResult
    try {
      const jsonMatch = rawContent.match(/```json\s*([\s\S]*?)\s*```/) ?? rawContent.match(/\{[\s\S]*\}/)
      const jsonStr = jsonMatch ? (jsonMatch[1] ?? jsonMatch[0]) : rawContent
      const parsed = JSON.parse(jsonStr)

      result = {
        alignmentScore: clamp(Number(parsed.alignmentScore) || 0, 0, 100),
        confidenceScore: clamp(Number(parsed.confidenceScore) || 70, 0, 100),
        matchedObjectives: Array.isArray(parsed.matchedObjectives) ? parsed.matchedObjectives.slice(0, 20) : [],
        missingObjectives: Array.isArray(parsed.missingObjectives) ? parsed.missingObjectives.slice(0, 20) : [],
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.slice(0, 5) : [],
      }

      if (schoolScheme && parsed.schoolAlignmentScore !== undefined) {
        result.schoolAlignmentScore = clamp(Number(parsed.schoolAlignmentScore) || 0, 0, 100)
        result.schoolMatchedObjectives = Array.isArray(parsed.schoolMatchedObjectives) ? parsed.schoolMatchedObjectives : []
        result.schoolMissingObjectives = Array.isArray(parsed.schoolMissingObjectives) ? parsed.schoolMissingObjectives : []
      }
    } catch {
      throw new Error(`Failed to parse AI alignment response: ${rawContent.slice(0, 200)}`)
    }

    return new Response(JSON.stringify({ success: true, result }), {
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

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}
