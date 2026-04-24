import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY_URL = 'https://ai.gateway.fastrouter.io/api/v1/chat/completions';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { lessonNoteId, targetCountry, teacherId } = await req.json();

    if (!lessonNoteId || !targetCountry) {
      return new Response(
        JSON.stringify({ error: 'lessonNoteId and targetCountry required' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    const apiKey   = Deno.env.get('GATEWAY_API_KEY')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── Fetch lesson ──────────────────────────────────────────────────────
    const { data: lesson } = await supabase
      .from('lesson_notes')
      .select('*')
      .eq('id', lessonNoteId)
      .single();

    if (!lesson) {
      return new Response(JSON.stringify({ error: 'Lesson not found' }),
        { status: 404, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const sourceCountry = lesson.country ?? 'Nigeria';
    const lessonText    = typeof lesson.content === 'string'
      ? lesson.content
      : JSON.stringify(lesson.content ?? '');

    // ── Fetch crosswalk context (top-10 matched objectives) ───────────────
    const { data: crosswalkRows } = await supabase
      .from('curriculum_crosswalk')
      .select(`
        similarity_score, notes,
        source_obj:source_objective_id(learning_objective, topic, class_level),
        target_obj:target_objective_id(learning_objective, topic, class_level)
      `)
      .eq('source_country', sourceCountry)
      .eq('target_country', targetCountry)
      .gte('similarity_score', 60)
      .order('similarity_score', { ascending: false })
      .limit(10);

    // ── Fetch class level + subject equivalency ───────────────────────────
    const [{ data: classMap }, { data: subjectMap }] = await Promise.all([
      supabase
        .from('class_level_equivalency')
        .select('class_level_b, equivalency_score')
        .eq('country_a', sourceCountry)
        .eq('country_b', targetCountry)
        .eq('class_level_a', lesson.class_level ?? '')
        .order('equivalency_score', { ascending: false })
        .limit(1),
      supabase
        .from('subject_equivalency')
        .select('subject_b, similarity_score')
        .eq('country_a', sourceCountry)
        .eq('country_b', targetCountry)
        .eq('subject_a', lesson.subject ?? '')
        .order('similarity_score', { ascending: false })
        .limit(1),
    ]);

    const targetClassLevel = classMap?.[0]?.class_level_b ?? lesson.class_level ?? '';
    const targetSubject    = subjectMap?.[0]?.subject_b    ?? lesson.subject    ?? '';

    const crosswalkContext = (crosswalkRows ?? []).length > 0
      ? `\nCURRICULUM CROSSWALK (${sourceCountry} → ${targetCountry}):\n` +
        (crosswalkRows ?? []).map((r: any) =>
          `  • ${(r.source_obj as any)?.learning_objective} → ${(r.target_obj as any)?.learning_objective} (${r.similarity_score}% match)`
        ).join('\n')
      : '';

    // ── Build localization prompt ─────────────────────────────────────────
    const prompt = `You are an expert curriculum localization specialist converting lessons across African education systems.

SOURCE LESSON (${sourceCountry} | ${lesson.subject} | ${lesson.class_level}):
${lessonText.slice(0, 3000)}
${crosswalkContext}

TARGET SYSTEM:
- Country: ${targetCountry}
- Equivalent subject: ${targetSubject}
- Equivalent class level: ${targetClassLevel}

Rewrite the lesson for ${targetCountry} teachers. Follow these rules:
1. Replace ${sourceCountry}-specific examples with ${targetCountry} local context (places, currency, names, culture)
2. Adjust objectives to match ${targetCountry} curriculum language and terminology
3. Keep the same pedagogical structure and learning flow
4. Localize evaluation criteria to match ${targetCountry} assessment conventions
5. Adjust difficulty/depth if class levels differ
6. Note any significant curriculum gaps or additions

Return ONLY a JSON object (no markdown):
{
  "title": "Localized lesson title",
  "objectives": ["localized objective 1", "localized objective 2", "localized objective 3"],
  "introduction": "Localized 2-3 sentence hook using local context",
  "activities": [
    { "name": "Activity name", "description": "What students do with local examples", "duration": "10 mins" }
  ],
  "examples": ["Local example 1 using ${targetCountry} context", "Local example 2"],
  "evaluation": "Localized evaluation matching ${targetCountry} assessment style",
  "homework": "Localized homework task",
  "localization_notes": "Summary of key changes made and any curriculum gaps identified"
}`;

    // ── Call AI ───────────────────────────────────────────────────────────
    const res = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify({
        model:       'google/gemini-2.5-flash',
        temperature: 0.5,
        max_tokens:  1600,
        messages:    [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `AI gateway error: ${res.status}` }),
        { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const aiData = await res.json();
    const raw    = aiData.choices?.[0]?.message?.content?.trim() ?? '{}';
    let localizedContent: any = {};
    try { localizedContent = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}'); } catch {}

    // ── Save localized lesson note ────────────────────────────────────────
    const { data: newLesson } = await supabase
      .from('lesson_notes')
      .insert({
        teacher_id:  teacherId ?? null,
        country:     targetCountry,
        subject:     targetSubject,
        class_level: targetClassLevel,
        title:       localizedContent.title ?? `${lesson.title} (${targetCountry})`,
        topic:       lesson.topic,
        content:     {
          ...localizedContent,
          localized_from: lessonNoteId,
          source_country: sourceCountry,
        },
        visibility: 'private',
        status:     'draft',
      })
      .select('id')
      .single();

    return new Response(
      JSON.stringify({
        success:              true,
        localized_lesson_id:  newLesson?.id ?? null,
        title:                localizedContent.title,
        target_country:       targetCountry,
        target_subject:       targetSubject,
        target_class_level:   targetClassLevel,
        localization_notes:   localizedContent.localization_notes ?? '',
        content:              localizedContent,
      }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
