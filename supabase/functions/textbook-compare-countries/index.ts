import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─────────────────────────────────────────────────────────────────────────────
// textbook-compare-countries
//
// Compares textbook coverage between two countries for a given subject.
// Uses the curriculum_crosswalk as the bridge: for each crosswalk pair
// (source_obj in countryA ↔ target_obj in countryB) it checks whether
// each country's textbooks actually cover their respective side.
//
// Input:  { countryA, countryB, subject? }
// Output: { success, comparison, cached }
// ─────────────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { countryA, countryB, subject } = await req.json();

    if (!countryA || !countryB) {
      return new Response(
        JSON.stringify({ error: 'countryA and countryB required' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const subjectKey = subject ?? '';

    // ── Check cache (< 24 h old) ──────────────────────────────────────────
    const { data: cached } = await supabase
      .from('textbook_cross_country_comparison')
      .select('*')
      .eq('country_a', countryA)
      .eq('country_b', countryB)
      .eq('subject', subjectKey)
      .gte('computed_at', new Date(Date.now() - 86_400_000).toISOString())
      .single();

    if (cached) {
      return new Response(
        JSON.stringify({ success: true, comparison: cached, cached: true }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    // ── Fetch textbooks for both countries ────────────────────────────────
    const [booksA, booksB] = await Promise.all([
      (async () => {
        let q = supabase.from('textbooks').select('id').eq('country', countryA).eq('status', 'ready');
        if (subject) q = q.eq('subject', subject);
        const { data } = await q;
        return (data ?? []).map((r: any) => r.id as string);
      })(),
      (async () => {
        let q = supabase.from('textbooks').select('id').eq('country', countryB).eq('status', 'ready');
        if (subject) q = q.eq('subject', subject);
        const { data } = await q;
        return (data ?? []).map((r: any) => r.id as string);
      })(),
    ]);

    // ── Fetch crosswalk pairs (A→B direction) ─────────────────────────────
    let cwQuery = supabase
      .from('curriculum_crosswalk')
      .select('source_objective_id, target_objective_id, similarity_score, notes')
      .eq('source_country', countryA)
      .eq('target_country', countryB)
      .gte('similarity_score', 60)
      .limit(500);
    // Subject filter via notes field (topic-level; best-effort)
    const { data: cwPairs } = await cwQuery;

    const pairs = cwPairs ?? [];

    if (!pairs.length) {
      // No crosswalk yet — return minimal result without caching
      const base = {
        country_a: countryA, country_b: countryB, subject: subjectKey,
        textbook_count_a: booksA.length, textbook_count_b: booksB.length,
        shared_crosswalk_pairs: 0,
        country_a_coverage: 0, country_b_coverage: 0,
        gap_count_a: 0, gap_count_b: 0,
        top_shared_topics: [], gap_topics_a: [], gap_topics_b: [],
        computed_at: new Date().toISOString(),
      };
      return new Response(
        JSON.stringify({ success: true, comparison: base, cached: false }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    // ── Get objective IDs covered by each country's textbooks ─────────────
    const sourceObjIds = pairs.map((p: any) => p.source_objective_id as string);
    const targetObjIds = pairs.map((p: any) => p.target_objective_id as string);

    const [coveredA, coveredB] = await Promise.all([
      (async () => {
        if (!booksA.length) return new Set<string>();
        const { data } = await supabase
          .from('textbook_alignment')
          .select('objective_id')
          .in('textbook_id', booksA)
          .in('objective_id', sourceObjIds)
          .gte('alignment_score', 50);
        return new Set((data ?? []).map((r: any) => r.objective_id as string));
      })(),
      (async () => {
        if (!booksB.length) return new Set<string>();
        const { data } = await supabase
          .from('textbook_alignment')
          .select('objective_id')
          .in('textbook_id', booksB)
          .in('objective_id', targetObjIds)
          .gte('alignment_score', 50);
        return new Set((data ?? []).map((r: any) => r.objective_id as string));
      })(),
    ]);

    // ── Compute metrics ───────────────────────────────────────────────────
    let sharedCount  = 0;
    let gapA         = 0; // pairs where B covers its side but A doesn't
    let gapB         = 0; // pairs where A covers its side but B doesn't
    const sharedTopics: string[] = [];
    const gapTopicsA: string[]   = [];
    const gapTopicsB: string[]   = [];

    for (const pair of pairs as any[]) {
      const aCovers = coveredA.has(pair.source_objective_id);
      const bCovers = coveredB.has(pair.target_objective_id);
      const topic   = pair.notes?.split('↔')[0]?.split('|')?.[0]?.trim() ?? '';

      if (aCovers && bCovers) {
        sharedCount++;
        if (topic && !sharedTopics.includes(topic)) sharedTopics.push(topic);
      } else if (!aCovers && bCovers) {
        gapA++;
        if (topic && !gapTopicsA.includes(topic)) gapTopicsA.push(topic);
      } else if (aCovers && !bCovers) {
        gapB++;
        if (topic && !gapTopicsB.includes(topic)) gapTopicsB.push(topic);
      }
    }

    const total = pairs.length;
    const coverageA = total ? parseFloat(((coveredA.size / total) * 100).toFixed(2)) : 0;
    const coverageB = total ? parseFloat(((coveredB.size / total) * 100).toFixed(2)) : 0;

    const comparison = {
      country_a:             countryA,
      country_b:             countryB,
      subject:               subjectKey,
      textbook_count_a:      booksA.length,
      textbook_count_b:      booksB.length,
      shared_crosswalk_pairs: total,
      country_a_coverage:    coverageA,
      country_b_coverage:    coverageB,
      gap_count_a:           gapA,
      gap_count_b:           gapB,
      top_shared_topics:     sharedTopics.slice(0, 8),
      gap_topics_a:          gapTopicsA.slice(0, 6),
      gap_topics_b:          gapTopicsB.slice(0, 6),
      computed_at:           new Date().toISOString(),
    };

    // ── Upsert cache ──────────────────────────────────────────────────────
    await supabase
      .from('textbook_cross_country_comparison')
      .upsert(comparison, { onConflict: 'country_a,country_b,subject', ignoreDuplicates: false });

    return new Response(
      JSON.stringify({ success: true, comparison, cached: false }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
