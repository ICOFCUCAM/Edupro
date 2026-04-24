import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─────────────────────────────────────────────────────────────────────────────
// curriculum-alert-broadcast
//
// Called when a country's curriculum changes (objective added/updated/removed).
// Finds all countries that have similar crosswalk matches for the affected
// objectives and creates curriculum_update_alerts rows so those countries'
// teachers are notified.
//
// Input (one of two forms):
//   A) { changeLogId }              — resolves from curriculum_change_log
//   B) { sourceCountry, changeType, subject?, classLevel?, description? }
//
// Returns: { alerts_created, affected_countries, source_country }
// ─────────────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const body = await req.json();
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── Resolve change metadata ───────────────────────────────────────────
    let sourceCountry: string;
    let changeType:    string;
    let subject:       string | null;
    let classLevel:    string | null;
    let description:   string | null;
    let changeLogId:   string | null;

    if (body.changeLogId) {
      const { data: logEntry } = await supabase
        .from('curriculum_change_log')
        .select('*')
        .eq('id', body.changeLogId)
        .single();
      if (!logEntry) {
        return new Response(JSON.stringify({ error: 'Change log entry not found' }),
          { status: 404, headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
      sourceCountry = logEntry.country;
      changeType    = logEntry.change_type;
      subject       = logEntry.subject ?? null;
      classLevel    = logEntry.class_level ?? null;
      description   = logEntry.description ?? null;
      changeLogId   = logEntry.id;
    } else if (body.sourceCountry && body.changeType) {
      sourceCountry = body.sourceCountry;
      changeType    = body.changeType;
      subject       = body.subject ?? null;
      classLevel    = body.classLevel ?? null;
      description   = body.description ?? null;
      changeLogId   = null;
    } else {
      return new Response(
        JSON.stringify({ error: 'Provide either changeLogId or sourceCountry + changeType' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    // ── Find affected crosswalk targets ───────────────────────────────────
    // Query crosswalk rows where source_country = sourceCountry (and optional subject filter)
    let cwQuery = supabase
      .from('curriculum_crosswalk')
      .select(`
        id, target_country, similarity_score,
        source_obj:source_objective_id(id, topic, subject, class_level),
        target_obj:target_objective_id(id)
      `)
      .eq('source_country', sourceCountry)
      .gte('similarity_score', 60)
      .order('similarity_score', { ascending: false })
      .limit(200);

    if (subject) cwQuery = cwQuery.eq(
      'source_obj.subject', subject,
    );

    const { data: cwRows } = await cwQuery;

    if (!cwRows?.length) {
      // No crosswalk data yet — still log the alert generically per country
      // Broadcast to ALL countries that have a similarity index entry
      const { data: simRows } = await supabase
        .from('curriculum_similarity_index')
        .select('country_b')
        .eq('country_a', sourceCountry)
        .gte('similarity_score', 40);

      const affectedCountries = [...new Set((simRows ?? []).map((r: any) => r.country_b))];

      if (!affectedCountries.length) {
        return new Response(JSON.stringify({
          success: true, alerts_created: 0, affected_countries: [],
          source_country: sourceCountry,
        }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
      }

      const genericAlerts = affectedCountries.map(tc => ({
        source_country:  sourceCountry,
        target_country:  tc,
        change_type:     changeType,
        subject:         subject ?? null,
        class_level:     classLevel ?? null,
        description:     description ?? `${sourceCountry} curriculum ${changeType} — check for impact on shared objectives`,
        change_log_id:   changeLogId,
        similarity_score: 0,
      }));

      await supabase.from('curriculum_update_alerts').insert(genericAlerts);

      return new Response(JSON.stringify({
        success: true, alerts_created: genericAlerts.length,
        affected_countries: affectedCountries, source_country: sourceCountry,
      }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // ── Group crosswalk rows by target country ────────────────────────────
    type CountryGroup = {
      similarity_score: number;
      objective_id:     string | null;
      similar_obj_id:   string | null;
      topic:            string | null;
      subj:             string | null;
      lvl:              string | null;
    };
    const byCountry = new Map<string, CountryGroup>();

    for (const row of cwRows as any[]) {
      const tc = row.target_country as string;
      if (tc === sourceCountry) continue;
      const existing = byCountry.get(tc);
      if (!existing || row.similarity_score > existing.similarity_score) {
        byCountry.set(tc, {
          similarity_score: row.similarity_score,
          objective_id:     (row.source_obj as any)?.id ?? null,
          similar_obj_id:   (row.target_obj as any)?.id ?? null,
          topic:            (row.source_obj as any)?.topic ?? null,
          subj:             (row.source_obj as any)?.subject ?? subject ?? null,
          lvl:              (row.source_obj as any)?.class_level ?? classLevel ?? null,
        });
      }
    }

    if (!byCountry.size) {
      return new Response(JSON.stringify({
        success: true, alerts_created: 0, affected_countries: [],
        source_country: sourceCountry,
      }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // ── Insert alerts ─────────────────────────────────────────────────────
    const alertRows = Array.from(byCountry.entries()).map(([tc, g]) => ({
      source_country:      sourceCountry,
      target_country:      tc,
      change_type:         changeType,
      subject:             g.subj ?? subject ?? null,
      class_level:         g.lvl ?? classLevel ?? null,
      objective_id:        g.objective_id,
      similar_objective_id: g.similar_obj_id,
      similarity_score:    g.similarity_score,
      description:         description ??
        `${sourceCountry} ${changeType} objective${g.topic ? ` in ${g.topic}` : ''} — similar to your ${tc} curriculum (${g.similarity_score}% match)`,
      change_log_id: changeLogId,
    }));

    const { error: insertErr } = await supabase
      .from('curriculum_update_alerts')
      .insert(alertRows);

    if (insertErr) throw new Error(insertErr.message);

    return new Response(
      JSON.stringify({
        success:           true,
        alerts_created:    alertRows.length,
        affected_countries: Array.from(byCountry.keys()),
        source_country:    sourceCountry,
      }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
