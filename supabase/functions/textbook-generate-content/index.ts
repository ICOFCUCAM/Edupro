import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY_URL = 'https://ai.gateway.fastrouter.io/api/v1/chat/completions';

async function callGateway(apiKey: string, prompt: string, maxTokens = 1200): Promise<string> {
  const res = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({
      model:       'google/gemini-2.5-flash',
      temperature: 0.6,
      max_tokens:  maxTokens,
      messages:    [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Gateway error: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { chapterId, teacherId } = await req.json();

    if (!chapterId) {
      return new Response(JSON.stringify({ error: 'chapterId required' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const apiKey   = Deno.env.get('GATEWAY_API_KEY')!;
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // ── Fetch chapter + parent textbook ─────────────────────────────────
    const { data: chapter, error: chErr } = await supabase
      .from('textbook_chapters')
      .select('*, textbooks(id, title, country, subject, class_level)')
      .eq('id', chapterId)
      .single();

    if (chErr || !chapter) {
      return new Response(JSON.stringify({ error: 'Chapter not found' }),
        { status: 404, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const book      = chapter.textbooks as any;
    const country   = book?.country   ?? 'Nigeria';
    const subject   = book?.subject   ?? 'General';
    const classLvl  = book?.class_level ?? '';
    const chTitle   = chapter.chapter_title;
    const chContent = (chapter.content ?? '').slice(0, 2500);

    // ── Generate lesson plan ─────────────────────────────────────────────
    const lessonPrompt = `You are a ${country} curriculum-aligned lesson planner for ${subject} ${classLvl}.

Create a detailed lesson plan from this textbook chapter.

Chapter: "${chTitle}"
Content excerpt:
${chContent}

Return ONLY a JSON object (no markdown):
{
  "title": "Lesson title",
  "objectives": ["obj1", "obj2", "obj3"],
  "introduction": "2–3 sentence hook/introduction",
  "activities": [
    { "name": "Activity name", "description": "What students do", "duration": "10 mins" }
  ],
  "examples": ["Example 1", "Example 2"],
  "evaluation": "How to assess understanding",
  "homework": "Homework task"
}`;

    const lessonRaw  = await callGateway(apiKey, lessonPrompt, 1200);
    const lessonJson = lessonRaw.match(/\{[\s\S]*\}/)?.[0] ?? '{}';
    let lessonContent: any = {};
    try { lessonContent = JSON.parse(lessonJson); } catch { lessonContent = { title: chTitle }; }

    const lessonTitle = lessonContent.title ?? `${chTitle} — Lesson`;

    // ── Generate assessment ──────────────────────────────────────────────
    const assessPrompt = `You are a ${country} assessment designer for ${subject} ${classLvl}.

Create a quiz/test for this textbook chapter.

Chapter: "${chTitle}"
Content:
${chContent}

Return ONLY a JSON object (no markdown):
{
  "sections": [{
    "section_title": "Chapter Quiz",
    "questions": [
      {
        "question": "Question text",
        "type": "multiple_choice",
        "options": ["A", "B", "C", "D"],
        "correct_answer": "A",
        "explanation": "Why A is correct",
        "marks": 2
      }
    ]
  }],
  "marking_scheme": "Total marks: X. Award X marks for each correct answer.",
  "time_allowed": "30 minutes"
}
Include 10 questions mixing multiple_choice and short_answer types.`;

    const assessRaw  = await callGateway(apiKey, assessPrompt, 1500);
    const assessJson = assessRaw.match(/\{[\s\S]*\}/)?.[0] ?? '{}';
    let assessContent: any = {};
    try { assessContent = JSON.parse(assessJson); } catch { assessContent = {}; }

    // ── Save lesson note ─────────────────────────────────────────────────
    let lessonNoteId: string | null = null;
    const { data: lessonRow, error: lessonErr } = await supabase
      .from('lesson_notes')
      .insert({
        teacher_id:  teacherId ?? null,
        country:     country,
        subject:     subject,
        class_level: classLvl,
        title:       lessonTitle,
        topic:       chTitle,
        content:     lessonContent,
        visibility:  'private',
        status:      'draft',
      })
      .select('id')
      .single();

    if (!lessonErr) lessonNoteId = lessonRow?.id ?? null;

    // ── Save assessment package ──────────────────────────────────────────
    let assessmentId: string | null = null;
    const { data: assessRow, error: assessErr } = await supabase
      .from('assessment_packages')
      .insert({
        teacher_id:   teacherId ?? null,
        organization_id: book?.id ?? null,
        country:      country,
        subject:      subject,
        class_level:  classLvl,
        topic:        chTitle,
        package_type: 'quiz',
        difficulty:   'standard',
        title:        `${chTitle} — Chapter Quiz`,
        content:      assessContent,
        status:       'draft',
      })
      .select('id')
      .single();

    if (!assessErr) assessmentId = assessRow?.id ?? null;

    // ── Update chapter with generated content ids ────────────────────────
    await supabase.from('textbook_chapters').update({
      lesson_note_id: lessonNoteId,
      assessment_id:  assessmentId,
    }).eq('id', chapterId);

    // ── Increment textbook counters in coverage summary ──────────────────
    if (lessonNoteId || assessmentId) {
      const { data: summary } = await supabase
        .from('textbook_coverage_summary')
        .select('generated_lessons, generated_assessments, textbook_id')
        .eq('textbook_id', book.id)
        .single();

      if (summary) {
        await supabase.from('textbook_coverage_summary').update({
          generated_lessons:     (summary.generated_lessons     ?? 0) + (lessonNoteId  ? 1 : 0),
          generated_assessments: (summary.generated_assessments ?? 0) + (assessmentId  ? 1 : 0),
          updated_at:            new Date().toISOString(),
        }).eq('textbook_id', book.id);
      }
    }

    return new Response(
      JSON.stringify({
        success:          true,
        lesson_note_id:   lessonNoteId,
        assessment_id:    assessmentId,
        lesson_title:     lessonTitle,
        chapter_title:    chTitle,
      }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
