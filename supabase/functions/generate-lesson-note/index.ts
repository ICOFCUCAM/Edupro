import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const COUNTRY_FORMATS: Record<string, { columns: string[]; curriculum: string; levels: string[] }> = {
  'Nigeria': {
    columns: ['Week', 'Day', 'Subject', 'Topic', 'Sub-Topic', 'Objectives', 'Teaching Activities', 'Learning Activities', 'Teaching Aids', 'Evaluation', 'Assignment'],
    curriculum: 'Nigerian National Curriculum (NERDC)',
    levels: ['Nursery 1', 'Nursery 2', 'Nursery 3', 'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6'],
  },
  'Ghana': {
    columns: ['Week', 'Day', 'Subject', 'Strand', 'Sub-Strand', 'Content Standard', 'Indicators', 'Core Competencies', 'Teaching & Learning Activities', 'Resources', 'Assessment'],
    curriculum: 'Ghana NaCCA Curriculum',
    levels: ['KG1', 'KG2', 'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6'],
  },
  'Kenya': {
    columns: ['Week', 'Lesson', 'Strand', 'Sub-Strand', 'Specific Learning Outcomes', 'Key Inquiry Questions', 'Learning Experiences', 'Learning Resources', 'Assessment Methods', 'Reflection'],
    curriculum: 'Kenya CBC (Competency-Based Curriculum)',
    levels: ['PP1', 'PP2', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'],
  },
  'South Africa': {
    columns: ['Week', 'Day', 'Subject', 'Topic', 'Content & Concepts', 'Skills', 'Teaching Activities', 'Learner Activities', 'Resources', 'Assessment', 'Expanded Opportunities'],
    curriculum: 'South Africa CAPS Curriculum',
    levels: ['Grade R', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7'],
  },
  'Cameroon': {
    columns: ['Week', 'Day', 'Subject', 'Topic', 'Lesson Title', 'Competences', 'Teaching Objectives', 'Didactic Materials', 'Teaching/Learning Activities', 'Evaluation', 'Remediation'],
    curriculum: 'Cameroon National Curriculum (Anglophone/Francophone)',
    levels: ['Nursery 1', 'Nursery 2', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6'],
  },
  'Tanzania': {
    columns: ['Week', 'Period', 'Topic', 'Sub-Topic', 'Specific Objectives', 'Teaching Strategies', 'Teaching/Learning Materials', 'Assessment', 'Remarks'],
    curriculum: 'Tanzania National Curriculum (TIE)',
    levels: ['Pre-Primary 1', 'Pre-Primary 2', 'Standard 1', 'Standard 2', 'Standard 3', 'Standard 4', 'Standard 5', 'Standard 6', 'Standard 7'],
  },
  'Uganda': {
    columns: ['Week', 'Day', 'Theme', 'Topic', 'Sub-Topic', 'Competences', 'Learning Outcomes', 'Life Skills', 'Teaching/Learning Activities', 'Learning Materials', 'Assessment Strategy'],
    curriculum: 'Uganda National Curriculum (NCDC)',
    levels: ['Baby Class', 'Middle Class', 'Top Class', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'],
  },
  'Rwanda': {
    columns: ['Week', 'Lesson', 'Unit', 'Key Competence', 'Learning Objectives', 'Content', 'Learning Activities', 'Cross-cutting Issues', 'Resources', 'Assessment Criteria'],
    curriculum: 'Rwanda CBC (Competency-Based Curriculum)',
    levels: ['Nursery 1', 'Nursery 2', 'Nursery 3', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6'],
  },
  'Ethiopia': {
    columns: ['Week', 'Day', 'Subject', 'Unit', 'Topic', 'Learning Competencies', 'Contents', 'Teaching Methods', 'Activities', 'Resources', 'Assessment', 'Reflection'],
    curriculum: 'Ethiopia National Curriculum Framework',
    levels: ['KG1', 'KG2', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'],
  },
  'Senegal': {
    columns: ["Semaine", "Jour", "Matière", "Thème", "Leçon", "Objectifs", "Compétences", "Activités d'Enseignement", "Activités d'Apprentissage", "Matériel", "Évaluation"],
    curriculum: 'Curriculum National du Sénégal',
    levels: ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'],
  },
  'DRC': {
    columns: ["Semaine", "Jour", "Branche", "Sous-Branche", "Sujet", "Objectifs Opérationnels", "Matériel Didactique", "Activités d'Enseignement", "Activités d'Apprentissage", "Évaluation"],
    curriculum: 'Programme National de la RDC (EPSP)',
    levels: ['1ère Maternelle', '2ème Maternelle', '3ème Maternelle', '1ère Primaire', '2ème Primaire', '3ème Primaire', '4ème Primaire', '5ème Primaire', '6ème Primaire'],
  },
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { topic, subject, country, level, language, week, additionalNotes } = await req.json()

    const gatewayApiKey = Deno.env.get('GATEWAY_API_KEY')
    if (!gatewayApiKey) throw new Error('API Gateway key not configured')

    const countryFormat = COUNTRY_FORMATS[country] ?? COUNTRY_FORMATS['Nigeria']
    const { columns, curriculum } = countryFormat

    const prompt = `You are an expert African education curriculum specialist. Generate a detailed lesson note for the following:

Country: ${country}
Curriculum: ${curriculum}
Level/Class: ${level}
Subject: ${subject}
Topic: ${topic}
Week: ${week ?? 1}
Language: ${language ?? 'English'}
${additionalNotes ? `Additional Notes: ${additionalNotes}` : ''}

Generate a comprehensive lesson note that follows the ${country} education system format.
The lesson note must include content for ALL of these columns: ${columns.join(', ')}.
Generate content for 5 days/periods of the week. Each day should have detailed, actionable content.

Return ONLY a JSON object — no markdown fences — with this exact structure:
{
  "title": "Lesson note title",
  "metadata": {
    "subject": "${subject}",
    "topic": "${topic}",
    "level": "${level}",
    "country": "${country}",
    "curriculum": "${curriculum}",
    "week": ${week ?? 1},
    "term": "First Term",
    "duration": "40 minutes per lesson"
  },
  "columns": ${JSON.stringify(columns)},
  "rows": [
    { ${columns.map((col) => `"${col}": "detailed content for day 1"`).join(', ')} },
    { ${columns.map((col) => `"${col}": "detailed content for day 2"`).join(', ')} },
    { ${columns.map((col) => `"${col}": "detailed content for day 3"`).join(', ')} },
    { ${columns.map((col) => `"${col}": "detailed content for day 4"`).join(', ')} },
    { ${columns.map((col) => `"${col}": "detailed content for day 5"`).join(', ')} }
  ],
  "teacherNotes": "Additional guidance for the teacher",
  "differentiationStrategies": "How to adapt for different learners",
  "crossCurricularLinks": "Links to other subjects"
}

Make the content educationally sound, age-appropriate, and aligned with ${country}'s national curriculum standards.`

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
        max_tokens: 4000,
      }),
    })

    const aiData = await aiRes.json()
    const rawContent: string = aiData.choices?.[0]?.message?.content ?? ''

    let lessonNote: Record<string, unknown>
    try {
      const jsonMatch = rawContent.match(/```json\s*([\s\S]*?)\s*```/) ?? rawContent.match(/\{[\s\S]*\}/)
      const jsonStr = jsonMatch ? (jsonMatch[1] ?? jsonMatch[0]) : rawContent
      lessonNote = JSON.parse(jsonStr)
    } catch {
      lessonNote = {
        title: `${subject} - ${topic}`,
        metadata: { subject, topic, level, country, curriculum, week: week ?? 1 },
        columns,
        rows: [],
        rawContent,
        teacherNotes: '',
        differentiationStrategies: '',
        crossCurricularLinks: '',
      }
    }

    return new Response(JSON.stringify({ success: true, lessonNote, countryFormat }), {
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
