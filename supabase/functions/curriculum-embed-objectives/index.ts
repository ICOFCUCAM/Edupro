import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EMBED_URL = 'https://ai.gateway.fastrouter.io/api/v1/embeddings';

async function generateEmbedding(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const res = await fetch(EMBED_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify({ model: 'google/text-embedding-004', input: text }),
    });
    if (!res.ok) return null;
    return ((await res.json()).data?.[0]?.embedding as number[]) ?? null;
  } catch { return null; }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { country, subject, classLevel } = await req.json();

    if (!country) {
      return new Response(JSON.stringify({ error: 'country required' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const apiKey   = Deno.env.get('GATEWAY_API_KEY')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Fetch objectives without embeddings
    let q = supabase
      .from('curriculum_objectives')
      .select('id, learning_objective, topic')
      .eq('country', country)
      .is('embedding', null)
      .limit(100);

    if (subject)    q = q.eq('subject', subject);
    if (classLevel) q = q.eq('class_level', classLevel);

    const { data: objectives } = await q;

    if (!objectives?.length) {
      return new Response(
        JSON.stringify({ success: true, embedded: 0, message: 'All objectives already embedded.' }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    let embedded = 0, failed = 0;

    for (let i = 0; i < objectives.length; i += 5) {
      await Promise.all(objectives.slice(i, i + 5).map(async (obj) => {
        // Embed: topic + objective text for richer semantic signal
        const text      = `${obj.topic}: ${obj.learning_objective}`;
        const embedding = await generateEmbedding(text, apiKey);
        if (!embedding) { failed++; return; }

        const { error } = await supabase
          .from('curriculum_objectives')
          .update({ embedding })
          .eq('id', obj.id);

        if (error) failed++; else embedded++;
      }));

      if (i + 5 < objectives.length) await new Promise(r => setTimeout(r, 200));
    }

    return new Response(
      JSON.stringify({ success: true, embedded, failed, total: objectives.length }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
