import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY_URL = 'https://ai.gateway.fastrouter.io/api/v1/embeddings';

async function generateEmbedding(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const res = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify({ model: 'google/text-embedding-004', input: text }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.data?.[0]?.embedding as number[]) ?? null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { textbookId } = await req.json();

    if (!textbookId) {
      return new Response(JSON.stringify({ error: 'textbookId required' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const apiKey   = Deno.env.get('GATEWAY_API_KEY')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Fetch all chapters that don't have an embedding yet
    const { data: chapters, error } = await supabase
      .from('textbook_chapters')
      .select('id, chapter_title, content')
      .eq('textbook_id', textbookId)
      .is('embedding', null);

    if (error || !chapters?.length) {
      return new Response(
        JSON.stringify({ success: true, embedded: 0, message: 'No chapters to embed.' }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    let embedded = 0;
    let failed   = 0;

    // Process in small batches to stay within rate limits
    const BATCH = 5;
    for (let i = 0; i < chapters.length; i += BATCH) {
      const batch = chapters.slice(i, i + BATCH);

      await Promise.all(batch.map(async (ch) => {
        // Embed: title + first 500 chars of content — enough for semantic matching
        const inputText = `${ch.chapter_title}\n\n${(ch.content ?? '').slice(0, 500)}`;
        const embedding = await generateEmbedding(inputText, apiKey);

        if (!embedding) { failed++; return; }

        const { error: updateErr } = await supabase
          .from('textbook_chapters')
          .update({ embedding })
          .eq('id', ch.id);

        if (updateErr) failed++;
        else embedded++;
      }));

      // Small pause between batches to respect API rate limits
      if (i + BATCH < chapters.length) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    return new Response(
      JSON.stringify({ success: true, embedded, failed, total: chapters.length }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
