import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY_URL = 'https://ai.gateway.fastrouter.io/api/v1/chat/completions';

// Heuristic chapter splitter: finds headings like "Chapter 1", "UNIT ONE", "1. Title", etc.
function splitByChapterHeadings(text: string): Array<{ number: string; title: string; content: string }> {
  const patterns = [
    /^(?:chapter|chap\.|ch\.)\s+(\d+|[ivxlc]+)[:\.\s]+(.+)$/im,
    /^(?:unit|section)\s+(\d+|[ivxlc]+)[:\.\s]+(.+)$/im,
    /^(\d{1,2})\.\s{1,4}([A-Z][A-Za-z\s\-:]{3,60})$/m,
    /^(?:CHAPTER|UNIT|SECTION)\s+(\w+)[:\s]+(.+)$/m,
  ];

  // Try each pattern, pick the one that finds the most matches
  let bestChapters: Array<{ number: string; title: string; start: number }> = [];
  for (const pattern of patterns) {
    const g = new RegExp(pattern.source, 'gim');
    const found: Array<{ number: string; title: string; start: number }> = [];
    let match;
    while ((match = g.exec(text)) !== null) {
      found.push({ number: match[1] ?? String(found.length + 1), title: match[2]?.trim() ?? '', start: match.index });
    }
    if (found.length > bestChapters.length) bestChapters = found;
  }

  if (bestChapters.length < 2) return [];

  return bestChapters.map((ch, i) => {
    const end = i < bestChapters.length - 1 ? bestChapters[i + 1].start : text.length;
    const content = text.slice(ch.start, end).trim().slice(0, 3000);
    return { number: ch.number, title: ch.title, content };
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const {
      text,        // full extracted text (client truncates at 80k chars)
      country,
      textbookId,
    } = await req.json();

    if (!text || !textbookId) {
      return new Response(
        JSON.stringify({ error: 'text and textbookId are required' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    const apiKey    = Deno.env.get('GATEWAY_API_KEY')!;
    const supabase  = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // ── Step 1: AI detects metadata + chapter list from first 8 000 chars ─
    const sampleText = text.slice(0, 8000);

    const aiRes = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        temperature: 0.1,
        max_tokens: 800,
        messages: [
          {
            role: 'system',
            content: `You are an education metadata extractor. Analyze a textbook excerpt and return ONLY a JSON object:
{
  "detected_title": "Full book title",
  "detected_subject": "Mathematics|Science|English|etc.",
  "detected_class_level": "Primary 1|JSS 2|Grade 5|etc.",
  "chapters": [
    { "number": "1", "title": "Chapter title" },
    ...
  ]
}
Return at most 30 chapters. Use the country context (${country}) for education terminology. No markdown.`,
          },
          { role: 'user', content: sampleText },
        ],
      }),
    });

    let detected: any = {};
    if (aiRes.ok) {
      const aiData  = await aiRes.json();
      const raw     = aiData.choices?.[0]?.message?.content?.trim() ?? '{}';
      const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}';
      try { detected = JSON.parse(jsonStr); } catch { /* use heuristic fallback */ }
    }

    // ── Step 2: Split text into chapters ────────────────────────────────
    let chapters: Array<{ number: string; title: string; content: string }> = [];

    if (Array.isArray(detected.chapters) && detected.chapters.length >= 2) {
      // Use AI-detected chapter titles to find positions in full text
      for (const ch of detected.chapters) {
        const safeTitle = ch.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex     = new RegExp(safeTitle.slice(0, 40), 'i');
        const idx       = text.search(regex);
        if (idx >= 0) chapters.push({ number: ch.number, title: ch.title, start: idx } as any);
      }
      // Convert starts to content slices
      chapters = (chapters as any[])
        .sort((a, b) => a.start - b.start)
        .map((ch, i, arr) => {
          const end     = i < arr.length - 1 ? arr[i + 1].start : text.length;
          const content = text.slice(ch.start, end).trim().slice(0, 3000);
          return { number: ch.number, title: ch.title, content };
        });
    }

    // Fallback: heuristic regex splitter
    if (chapters.length < 2) {
      chapters = splitByChapterHeadings(text);
    }

    // Last resort: split every ~4 000 chars labelled as sections
    if (chapters.length === 0) {
      const chunkSize = 4000;
      for (let i = 0; i < Math.min(text.length / chunkSize, 20); i++) {
        chapters.push({
          number:  String(i + 1),
          title:   `Section ${i + 1}`,
          content: text.slice(i * chunkSize, (i + 1) * chunkSize).trim(),
        });
      }
    }

    // ── Step 3: Save chapters to DB ──────────────────────────────────────
    const rows = chapters.map(ch => ({
      textbook_id:    textbookId,
      chapter_number: ch.number,
      chapter_title:  ch.title,
      content:        ch.content,
      word_count:     ch.content.split(/\s+/).length,
    }));

    const { error: insertErr } = await supabase.from('textbook_chapters').insert(rows);
    if (insertErr) {
      return new Response(JSON.stringify({ error: `DB insert failed: ${insertErr.message}` }),
        { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // ── Step 4: Update textbook record with detected metadata ────────────
    await supabase.from('textbooks').update({
      title:       detected.detected_title  || null,
      subject:     detected.detected_subject || null,
      class_level: detected.detected_class_level || null,
      status:      'chapters_extracted',
      updated_at:  new Date().toISOString(),
    }).eq('id', textbookId);

    return new Response(
      JSON.stringify({
        success:              true,
        detected_title:       detected.detected_title,
        detected_subject:     detected.detected_subject,
        detected_class_level: detected.detected_class_level,
        chapter_count:        chapters.length,
        chapters:             chapters.map(c => ({ number: c.number, title: c.title })),
      }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
