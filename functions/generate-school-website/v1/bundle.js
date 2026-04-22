
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { schoolName, motto, address, phone, email, principal, founded, colors, programs, description, staffCount, studentCount } = await req.json();

    const gatewayApiKey = Deno.env.get("GATEWAY_API_KEY");
    if (!gatewayApiKey) {
      throw new Error("API Gateway key not configured");
    }

    const prompt = `Generate a complete school website content in JSON format for:

School Name: ${schoolName}
Motto: ${motto || 'Excellence in Education'}
Address: ${address}
Phone: ${phone}
Email: ${email}
Principal: ${principal}
Founded: ${founded}
Primary Color: ${colors?.primary || '#2563EB'}
Programs: ${programs || 'Nursery, Primary'}
Description: ${description || ''}
Staff Count: ${staffCount || 20}
Student Count: ${studentCount || 300}

Return JSON with this structure:
{
  "hero": { "headline": "", "subheadline": "", "ctaText": "" },
  "about": { "title": "", "description": "", "mission": "", "vision": "", "values": [""] },
  "programs": [{ "name": "", "description": "", "ageRange": "" }],
  "features": [{ "title": "", "description": "", "icon": "" }],
  "testimonials": [{ "name": "", "role": "", "quote": "" }],
  "admissions": { "process": [""], "requirements": [""], "fees": "" },
  "contact": { "address": "${address}", "phone": "${phone}", "email": "${email}", "hours": "" },
  "footer": { "quickLinks": [""], "socialMedia": {} }
}

Make it professional, warm, and parent-friendly. Include realistic content.`;

    const response = await fetch('https://ai.gateway.fastrouter.io/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': gatewayApiKey
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 3000
      })
    });

    const data = await response.json();
    
    let websiteContent;
    try {
      const rawContent = data.choices[0].message.content;
      const jsonMatch = rawContent.match(/```json\s*([\s\S]*?)\s*```/) || rawContent.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : rawContent;
      websiteContent = JSON.parse(jsonStr);
    } catch (e) {
      websiteContent = { raw: data.choices?.[0]?.message?.content || 'Generation failed' };
    }

    return new Response(JSON.stringify({ success: true, websiteContent }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});
