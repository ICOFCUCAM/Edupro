import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EMBED_URL = 'https://ai.gateway.fastrouter.io/api/v1/embeddings';

async function embed(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const res = await fetch(EMBED_URL, {
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
    const {
      query,          // string: "which chapter covers fractions?"
      teacherId,      // uuid: used to look up teacher's organization
      textbookId,     // uuid (optional): scope to a single textbook
      country,        // string (optional): fallback filter
      subject,        // string (optional): narrow results
      matchCount = 5,
    } = await req.json();

    if (!query) {
      return new Response(JSON.stringify({ error: 'query required' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const apiKey   = Deno.env.get('GATEWAY_API_KEY')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Resolve teacher's country + organization if not supplied
    let resolvedCountry = country ?? null;
    let resolvedOrgId:  string | null = null;

    if (teacherId) {
      const { data: teacher } = await supabase
        .from('teachers')
        .select('country, organization_id')
        .eq('id', teacherId)
        .single();

      if (teacher) {
        resolvedCountry = resolvedCountry ?? teacher.country ?? null;
        resolvedOrgId   = teacher.organization_id ?? null;
      }
    }

    // Generate query embedding
    const queryEmbedding = await embed(query, apiKey);
    if (!queryEmbedding) {
      // Fallback: keyword search on chapter_title
      const keywordParts = query.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
      const likeExpr = keywordParts.length ? `%${keywordParts.slice(0, 3).join('%')}%` : `%${query.slice(0, 40)}%`;

      let q = supabase
        .from('textbook_chapters')
        .select('id, textbook_id, chapter_number, chapter_title, content, textbooks(title, country, subject)')
        .ilike('chapter_title', likeExpr)
        .limit(matchCount);

      if (textbookId) q = q.eq('textbook_id', textbookId);

      const { data: rows } = await q;
      const chapters = (rows ?? []).map((r: any) => ({
        id:             r.id,
        textbook_id:    r.textbook_id,
        textbook_title: r.textbooks?.title,
        chapter_number: r.chapter_number,
        chapter_title:  r.chapter_title,
        content:        r.content?.slice(0, 300),
        similarity:     0.5, // placeholder
        match_type:     'keyword',
      }));

      return new Response(
        JSON.stringify({ success: true, chapters, query }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    // Semantic search via RPC
    const { data: rows, error } = await supabase.rpc('match_textbook_chapters', {
      query_embedding: queryEmbedding,
      p_textbook_id:   textbookId  ?? null,
      p_country:       resolvedCountry ?? null,
      p_subject:       subject     ?? null,
      match_count:     matchCount,
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const chapters = (rows ?? []).map((r: any) => ({
      id:             r.id,
      textbook_id:    r.textbook_id,
      textbook_title: r.textbook_title,
      chapter_number: r.chapter_number,
      chapter_title:  r.chapter_title,
      content:        (r.content ?? '').slice(0, 300),
      similarity:     Math.round((r.similarity ?? 0) * 100),
      match_type:     'semantic',
    }));

    return new Response(
      JSON.stringify({ success: true, chapters, query }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
