import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EMBED_URL   = 'https://ai.gateway.fastrouter.io/api/v1/embeddings';
const GATEWAY_URL = 'https://ai.gateway.fastrouter.io/api/v1/chat/completions';

// ── Helpers ───────────────────────────────────────────────────────────────────

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

async function embedMissingObjectives(
  supabase: any,
  country: string,
  subject: string | null,
  apiKey: string,
): Promise<void> {
  let q = supabase
    .from('curriculum_objectives')
    .select('id, learning_objective, topic')
    .eq('country', country)
    .is('embedding', null)
    .limit(100);
  if (subject) q = q.eq('subject', subject);

  const { data: objectives } = await q;
  if (!objectives?.length) return;

  for (let i = 0; i < objectives.length; i += 5) {
    await Promise.all(objectives.slice(i, i + 5).map(async (obj: any) => {
      const embedding = await generateEmbedding(`${obj.topic}: ${obj.learning_objective}`, apiKey);
      if (embedding) await supabase.from('curriculum_objectives').update({ embedding }).eq('id', obj.id);
    }));
    if (i + 5 < objectives.length) await new Promise(r => setTimeout(r, 200));
  }
}

async function aiClassLevelMap(
  sourceCountry: string,
  targetCountry: string,
  apiKey: string,
): Promise<Array<{ class_level_a: string; class_level_b: string; score: number }>> {
  const res = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      temperature: 0.1,
      max_tokens: 700,
      messages: [{
        role: 'user',
        content: `Map every primary and secondary school class/grade level between ${sourceCountry} and ${targetCountry}.

Return ONLY a JSON array (no markdown):
[
  { "class_level_a": "${sourceCountry} level", "class_level_b": "${targetCountry} equivalent", "score": 95 }
]
score = equivalency confidence 0–100. Include all levels (Primary 1–6, JSS 1–3, SSS 1–3, Grade 1–12, CM1–CM2, etc. as relevant).`,
      }],
    }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  const raw  = data.choices?.[0]?.message?.content?.trim() ?? '[]';
  try { return JSON.parse(raw.match(/\[[\s\S]*\]/)?.[0] ?? '[]'); } catch { return []; }
}

async function aiSubjectMap(
  sourceCountry: string,
  targetCountry: string,
  apiKey: string,
): Promise<Array<{ subject_a: string; subject_b: string; score: number }>> {
  const res = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      temperature: 0.1,
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Map school subjects between ${sourceCountry} and ${targetCountry} education systems.
Some countries merge/split subjects differently (e.g. "Basic Science" vs "Integrated Science" vs "Environmental Studies").

Return ONLY a JSON array (no markdown):
[
  { "subject_a": "${sourceCountry} subject", "subject_b": "${targetCountry} equivalent", "score": 90 }
]
score = similarity confidence 0–100.`,
      }],
    }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  const raw  = data.choices?.[0]?.message?.content?.trim() ?? '[]';
  try { return JSON.parse(raw.match(/\[[\s\S]*\]/)?.[0] ?? '[]'); } catch { return []; }
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { sourceCountry, targetCountry, subject } = await req.json();

    if (!sourceCountry || !targetCountry) {
      return new Response(
        JSON.stringify({ error: 'sourceCountry and targetCountry required' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    const apiKey   = Deno.env.get('GATEWAY_API_KEY')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── Step 1: Embed objectives for both countries (parallel) ────────────
    await Promise.all([
      embedMissingObjectives(supabase, sourceCountry, subject ?? null, apiKey),
      embedMissingObjectives(supabase, targetCountry, subject ?? null, apiKey),
    ]);

    // ── Step 2: Vector similarity matching via RPC ────────────────────────
    const { data: matches, error: matchErr } = await supabase.rpc(
      'match_cross_country_objectives',
      {
        p_source_country: sourceCountry,
        p_target_country: targetCountry,
        p_subject:        subject ?? null,
        p_threshold:      0.65,
        p_top_k:          3,
      },
    );

    if (matchErr) {
      return new Response(JSON.stringify({ error: matchErr.message }),
        { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // ── Step 3: Upsert crosswalk rows ─────────────────────────────────────
    if (matches?.length) {
      const rows = (matches as any[]).map(m => ({
        source_country:      sourceCountry,
        target_country:      targetCountry,
        source_objective_id: m.source_id,
        target_objective_id: m.target_id,
        similarity_score:    Math.round(m.similarity * 100),
        notes: `${m.source_topic} ↔ ${m.target_topic} | ${m.source_class_level} ↔ ${m.target_class_level}`,
      }));
      await supabase.from('curriculum_crosswalk').upsert(rows, {
        onConflict: 'source_objective_id,target_objective_id',
        ignoreDuplicates: false,
      });
    }

    // ── Step 4: Compute similarity index ──────────────────────────────────
    let srcQuery = supabase
      .from('curriculum_objectives')
      .select('id', { count: 'exact', head: true })
      .eq('country', sourceCountry);
    if (subject) srcQuery = srcQuery.eq('subject', subject);
    const { count: totalSource } = await srcQuery;

    const matchedSource   = new Set((matches ?? []).map((m: any) => m.source_id)).size;
    const similarityScore = totalSource ? Math.round((matchedSource / totalSource) * 100) : 0;
    const subjectKey      = subject ?? '';

    // Upsert both directions
    await supabase.from('curriculum_similarity_index').upsert([
      { country_a: sourceCountry, country_b: targetCountry, subject: subjectKey, similarity_score: similarityScore, matched_objectives: matchedSource, total_source_objectives: totalSource ?? 0, computed_at: new Date().toISOString() },
      { country_a: targetCountry, country_b: sourceCountry, subject: subjectKey, similarity_score: similarityScore, matched_objectives: matchedSource, total_source_objectives: totalSource ?? 0, computed_at: new Date().toISOString() },
    ], { onConflict: 'country_a,country_b,subject', ignoreDuplicates: false });

    // ── Step 5: Class level + subject maps (parallel, non-fatal) ─────────
    const [classLevels, subjects] = await Promise.all([
      aiClassLevelMap(sourceCountry, targetCountry, apiKey),
      aiSubjectMap(sourceCountry, targetCountry, apiKey),
    ]);

    if (classLevels.length) {
      await supabase.from('class_level_equivalency').upsert(
        classLevels.map(r => ({
          country_a: sourceCountry, class_level_a: r.class_level_a,
          country_b: targetCountry, class_level_b: r.class_level_b,
          equivalency_score: Math.round(r.score ?? 80),
        })),
        { onConflict: 'country_a,class_level_a,country_b,class_level_b', ignoreDuplicates: false },
      );
    }

    if (subjects.length) {
      await supabase.from('subject_equivalency').upsert(
        subjects.map(r => ({
          country_a: sourceCountry, subject_a: r.subject_a,
          country_b: targetCountry, subject_b: r.subject_b,
          similarity_score: Math.round(r.score ?? 80),
        })),
        { onConflict: 'country_a,subject_a,country_b,subject_b', ignoreDuplicates: false },
      );
    }

    return new Response(
      JSON.stringify({
        success:              true,
        source_country:       sourceCountry,
        target_country:       targetCountry,
        similarity_score:     similarityScore,
        matched_pairs:        matches?.length ?? 0,
        matched_objectives:   matchedSource,
        total_source:         totalSource ?? 0,
        class_level_mappings: classLevels.length,
        subject_mappings:     subjects.length,
      }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
