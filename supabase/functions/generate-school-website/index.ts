import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      schoolName, motto, address, phone, email,
      principal, founded, colors, programs,
      description, staffCount, studentCount,
    } = await req.json()

    const gatewayApiKey = Deno.env.get('GATEWAY_API_KEY')
    if (!gatewayApiKey) throw new Error('API Gateway key not configured')

    const prompt = `Generate complete school website content in JSON format for:

School Name: ${schoolName}
Motto: ${motto ?? 'Excellence in Education'}
Address: ${address}
Phone: ${phone}
Email: ${email}
Principal: ${principal}
Founded: ${founded ?? 'N/A'}
Primary Color: ${colors?.primary ?? '#2563EB'}
Secondary Color: ${colors?.secondary ?? '#10B981'}
Programs: ${programs ?? 'Nursery, Primary'}
Description: ${description ?? ''}
Staff Count: ${staffCount ?? 20}
Student Count: ${studentCount ?? 300}

Return ONLY a JSON object — no markdown fences — with this exact structure:
{
  "hero": {
    "headline": "",
    "subheadline": "",
    "ctaText": "",
    "ctaLink": "#admissions"
  },
  "about": {
    "title": "",
    "description": "",
    "mission": "",
    "vision": "",
    "values": ["", "", ""]
  },
  "stats": [
    { "label": "Students", "value": "${studentCount ?? 300}" },
    { "label": "Staff", "value": "${staffCount ?? 20}" },
    { "label": "Years of Excellence", "value": "" },
    { "label": "Programs", "value": "" }
  ],
  "programs": [
    { "name": "", "description": "", "ageRange": "", "duration": "" }
  ],
  "features": [
    { "title": "", "description": "", "icon": "star" }
  ],
  "testimonials": [
    { "name": "", "role": "Parent", "quote": "" }
  ],
  "admissions": {
    "process": ["", "", ""],
    "requirements": ["", "", ""],
    "fees": "",
    "deadline": ""
  },
  "contact": {
    "address": "${address}",
    "phone": "${phone}",
    "email": "${email}",
    "hours": "Monday – Friday, 7:30 AM – 4:00 PM"
  },
  "footer": {
    "tagline": "",
    "quickLinks": ["Home", "About", "Programs", "Admissions", "Contact"],
    "socialMedia": { "facebook": "", "twitter": "", "instagram": "" }
  }
}

Make the content professional, warm, and parent-friendly. All text should reflect an African primary school setting.`

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
        max_tokens: 3000,
      }),
    })

    const aiData = await aiRes.json()
    const rawContent: string = aiData.choices?.[0]?.message?.content ?? ''

    let websiteContent: Record<string, unknown>
    try {
      const jsonMatch = rawContent.match(/```json\s*([\s\S]*?)\s*```/) ?? rawContent.match(/\{[\s\S]*\}/)
      const jsonStr = jsonMatch ? (jsonMatch[1] ?? jsonMatch[0]) : rawContent
      websiteContent = JSON.parse(jsonStr)
    } catch {
      websiteContent = { raw: rawContent }
    }

    return new Response(JSON.stringify({ success: true, websiteContent }), {
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
