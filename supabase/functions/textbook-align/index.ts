import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY_URL = 'https://ai.gateway.fastrouter.io/api/v1/chat/completions';

function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }

// Score a batch of chapters against all objectives in one AI call
async function scoreChapterBatch(
  chapters: Array<{ id: string; number: string; title: string; content: string }>,
  objectives: Array<{ id: string; learning_objective: string; topic: string }>,
  country: string,
  subject: string,
  classLevel: string,
  apiKey: string,
): Promise<Array<{ chapter_id: string; objective_id: string; score: number; note: string }>> {

  const chapterList = chapters.map(c =>
    `[${c.number}] "${c.title}": ${c.content.slice(0, 400)}`
  ).join('\n---\n');

  const objectiveList = objectives.map((o, i) =>
    `O${i + 1} (id:${o.id}): [${o.topic}] ${o.learning_objective}`
  ).join('\n');

  const prompt = `You are a ${country} curriculum alignment expert for ${subject} ${classLevel}.

Score how well each textbook chapter covers each curriculum objective on a 0–100 scale.

CHAPTERS:
${chapterList}

CURRICULUM OBJECTIVES:
${objectiveList}

Return ONLY a JSON array (no markdown):
[
  { "chapter_number": "1", "objective_id": "<uuid>", "score": 85, "note": "Directly covers..." },
  ...
]
Only include entries where score >= 20. Return scores for all chapter-objective pairs above threshold.`;

  const res = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({
      model:       'google/gemini-2.5-flash',
      temperature: 0.1,
      max_tokens:  1500,
      messages:    [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) return [];

  const data    = await res.json();
  const rawText = data.choices?.[0]?.message?.content?.trim() ?? '[]';
  const jsonStr = rawText.match(/\[[\s\S]*\]/)?.[0] ?? '[]';

  let rows: any[] = [];
  try { rows = JSON.parse(jsonStr); } catch { return []; }

  const chapterByNumber = Object.fromEntries(chapters.map(c => [c.number, c.id]));

  return rows
    .filter(r => r.objective_id && r.chapter_number != null && typeof r.score === 'number')
    .map(r => ({
      chapter_id:   chapterByNumber[String(r.chapter_number)] ?? '',
      objective_id: r.objective_id,
      score:        clamp(Math.round(r.score), 0, 100),
      note:         r.note ?? '',
    }))
    .filter(r => r.chapter_id);
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
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // ── Fetch textbook + chapters ────────────────────────────────────────
    const { data: book, error: bookErr } = await supabase
      .from('textbooks')
      .select('*, textbook_chapters(*)')
      .eq('id', textbookId)
      .single();

    if (bookErr || !book) {
      return new Response(JSON.stringify({ error: 'Textbook not found' }),
        { status: 404, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const chapters: any[] = book.textbook_chapters ?? [];
    if (!chapters.length) {
      return new Response(JSON.stringify({ error: 'No chapters found. Run textbook-process first.' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // ── Fetch curriculum objectives ──────────────────────────────────────
    const objQuery = supabase
      .from('curriculum_objectives')
      .select('id, learning_objective, topic')
      .eq('country',     book.country)
      .eq('subject',     book.subject)
      .eq('class_level', book.class_level)
      .limit(50);

    const { data: objectives } = await objQuery;

    if (!objectives?.length) {
      // No objectives in DB — skip alignment, mark ready
      await supabase.from('textbooks').update({ status: 'ready' }).eq('id', textbookId);
      await supabase.from('textbook_coverage_summary').upsert({
        textbook_id:          textbookId,
        coverage_percentage:  0,
        total_objectives:     0,
        covered_objectives:   0,
        missing_objectives:   [],
        extra_topics:         [],
        chapter_count:        chapters.length,
        updated_at:           new Date().toISOString(),
      }, { onConflict: 'textbook_id' });

      return new Response(JSON.stringify({
        success: true,
        coverage_percentage: 0,
        message: 'No curriculum objectives found for this subject/level. Textbook chapters saved.',
        chapter_count: chapters.length,
      }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // ── Batch scoring (10 chapters × all objectives per call) ────────────
    const BATCH = 10;
    const allAlignmentRows: any[] = [];

    for (let i = 0; i < chapters.length; i += BATCH) {
      const batch = chapters.slice(i, i + BATCH).map(c => ({
        id:      c.id,
        number:  c.chapter_number ?? String(i + 1),
        title:   c.chapter_title,
        content: c.content ?? '',
      }));

      const rows = await scoreChapterBatch(
        batch, objectives,
        book.country, book.subject, book.class_level,
        apiKey,
      );

      allAlignmentRows.push(...rows.map(r => ({
        textbook_id:     textbookId,
        chapter_id:      r.chapter_id,
        objective_id:    r.objective_id,
        alignment_score: r.score,
        coverage_notes:  r.note,
      })));
    }

    // ── Upsert alignment rows ────────────────────────────────────────────
    if (allAlignmentRows.length > 0) {
      await supabase.from('textbook_alignment').upsert(allAlignmentRows, {
        onConflict:             'textbook_id,chapter_id,objective_id',
        ignoreDuplicates:       false,
      });
    }

    // ── Calculate coverage summary ───────────────────────────────────────
    const coveredObjectiveIds = new Set(
      allAlignmentRows.filter(r => r.alignment_score >= 50).map(r => r.objective_id)
    );

    const coveredCount    = coveredObjectiveIds.size;
    const totalCount      = objectives.length;
    const coveragePct     = totalCount > 0 ? Math.round((coveredCount / totalCount) * 100) : 0;

    const missingObjectives = objectives
      .filter(o => !coveredObjectiveIds.has(o.id))
      .map(o => `[${o.topic}] ${o.learning_objective}`);

    // Extra topics: unique chapter titles not strongly mapped to any objective
    const chaptersMapped = new Set(allAlignmentRows.filter(r => r.alignment_score >= 60).map(r => r.chapter_id));
    const extraTopics = chapters
      .filter(c => !chaptersMapped.has(c.id))
      .map(c => c.chapter_title);

    await supabase.from('textbook_coverage_summary').upsert({
      textbook_id:           textbookId,
      coverage_percentage:   coveragePct,
      total_objectives:      totalCount,
      covered_objectives:    coveredCount,
      missing_objectives:    missingObjectives,
      extra_topics:          extraTopics,
      chapter_count:         chapters.length,
      updated_at:            new Date().toISOString(),
    }, { onConflict: 'textbook_id' });

    // Mark textbook as aligned/ready
    await supabase.from('textbooks').update({
      status:     'aligned',
      updated_at: new Date().toISOString(),
    }).eq('id', textbookId);

    return new Response(
      JSON.stringify({
        success:             true,
        coverage_percentage: coveragePct,
        total_objectives:    totalCount,
        covered_objectives:  coveredCount,
        missing_objectives:  missingObjectives,
        extra_topics:        extraTopics,
        chapter_count:       chapters.length,
        alignment_rows:      allAlignmentRows.length,
      }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
