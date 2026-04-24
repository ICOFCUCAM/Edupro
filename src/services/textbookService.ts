import { supabase } from '@/lib/supabase';

// ── Types ────────────────────────────────────────────────────────────────────

export interface Textbook {
  id:              string;
  title:           string;
  country?:        string;
  subject?:        string;
  class_level?:    string;
  uploaded_by?:    string;
  organization_id?: string;
  file_url?:       string;
  file_name?:      string;
  file_size_bytes?: number;
  status:          'processing' | 'chapters_extracted' | 'aligned' | 'ready' | 'failed';
  mode:            'school' | 'ministry' | 'publisher';
  created_at:      string;
}

export interface TextbookChapter {
  id:             string;
  textbook_id:    string;
  chapter_number: string;
  chapter_title:  string;
  content:        string;
  word_count?:    number;
  lesson_note_id?: string;
  assessment_id?: string;
  created_at:     string;
}

export interface TextbookAlignment {
  id:              string;
  textbook_id:     string;
  chapter_id:      string;
  objective_id:    string;
  alignment_score: number;
  coverage_notes?: string;
  chapter_title?:  string;   // joined
  objective_text?: string;   // joined
  topic?:          string;   // joined
}

export interface TextbookCoverageSummary {
  id:                    string;
  textbook_id:           string;
  coverage_percentage:   number;
  total_objectives:      number;
  covered_objectives:    number;
  missing_objectives:    string[];
  extra_topics:          string[];
  chapter_count:         number;
  generated_lessons:     number;
  generated_assessments: number;
  updated_at:            string;
}

export interface TextbookWithSummary extends Textbook {
  textbook_coverage_summary?: TextbookCoverageSummary[];
}

export type ProcessStep =
  | 'extracting'
  | 'uploading'
  | 'detecting_chapters'
  | 'aligning'
  | 'embedding'
  | 'done'
  | 'error';

export interface ChapterSearchResult {
  id:             string;
  textbook_id:    string;
  textbook_title: string;
  chapter_number: string;
  chapter_title:  string;
  content:        string;
  similarity:     number;
  match_type:     'semantic' | 'keyword';
}

export interface SupplementaryLesson {
  id:        string;
  title:     string;
  topic:     string;
  content:   string;
  class_level?: string;
  created_at: string;
}

// ── File text extraction (client-side) ───────────────────────────────────────

export async function extractFileText(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'txt' || ext === 'md') {
    return file.text();
  }

  if (ext === 'docx') {
    return extractDocxText(file);
  }

  if (ext === 'pdf') {
    return extractPdfText(file);
  }

  throw new Error(`Unsupported file type ".${ext}". Please use PDF, DOCX, or TXT.`);
}

async function extractDocxText(file: File): Promise<string> {
  const { default: JSZip } = await import('jszip');
  const zip    = await JSZip.loadAsync(file);
  const xmlStr = await zip.file('word/document.xml')?.async('text');
  if (!xmlStr) throw new Error('Invalid DOCX file — word/document.xml not found.');

  return xmlStr
    .replace(/<w:p[ >]/g, '\n<w:p>')   // paragraph breaks
    .replace(/<w:br[^>]*\/>/g, '\n')   // line breaks
    .replace(/<[^>]+>/g, '')           // strip all XML tags
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');

  // Use CDN worker to avoid Vite/bundler worker config
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf         = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page        = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText    = (textContent.items as any[])
      .filter(item => item.str)
      .map(item => item.str)
      .join(' ');
    pages.push(pageText);
  }

  return pages.join('\n').replace(/\s{3,}/g, ' ').trim();
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function getTextbooks(organizationId: string): Promise<TextbookWithSummary[]> {
  const { data } = await supabase
    .from('textbooks')
    .select('*, textbook_coverage_summary(*)')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });
  return (data ?? []) as TextbookWithSummary[];
}

export async function getTextbooksByCountry(country: string, subject?: string): Promise<TextbookWithSummary[]> {
  let q = supabase
    .from('textbooks')
    .select('*, textbook_coverage_summary(*)')
    .eq('country', country);
  if (subject) q = q.eq('subject', subject);
  const { data } = await q.order('created_at', { ascending: false });
  return (data ?? []) as TextbookWithSummary[];
}

export async function getTextbookChapters(textbookId: string): Promise<TextbookChapter[]> {
  const { data } = await supabase
    .from('textbook_chapters')
    .select('*')
    .eq('textbook_id', textbookId)
    .order('chapter_number');
  return (data ?? []) as TextbookChapter[];
}

export async function getTextbookAlignments(textbookId: string): Promise<TextbookAlignment[]> {
  const { data } = await supabase
    .from('textbook_alignment')
    .select(`
      *,
      textbook_chapters(chapter_title),
      curriculum_objectives(learning_objective, topic)
    `)
    .eq('textbook_id', textbookId)
    .order('alignment_score', { ascending: false });

  return (data ?? []).map((row: any) => ({
    ...row,
    chapter_title:  row.textbook_chapters?.chapter_title,
    objective_text: row.curriculum_objectives?.learning_objective,
    topic:          row.curriculum_objectives?.topic,
  })) as TextbookAlignment[];
}

export async function getTextbookCoverage(textbookId: string): Promise<TextbookCoverageSummary | null> {
  const { data } = await supabase
    .from('textbook_coverage_summary')
    .select('*')
    .eq('textbook_id', textbookId)
    .single();
  return data as TextbookCoverageSummary | null;
}

export async function deleteTextbook(textbookId: string): Promise<void> {
  await supabase.from('textbooks').delete().eq('id', textbookId);
}

// ── Full pipeline orchestration ──────────────────────────────────────────────

export interface PipelineOptions {
  file?:           File;
  pastedText?:     string;
  country:         string;
  subject?:        string;
  classLevel?:     string;
  organizationId:  string;
  teacherId:       string;
  mode?:           'school' | 'ministry' | 'publisher';
  onProgress:      (step: ProcessStep, detail?: string) => void;
}

export async function processTextbookPipeline(opts: PipelineOptions): Promise<{
  textbookId: string;
  summary: TextbookCoverageSummary | null;
  chapterCount: number;
}> {
  const {
    file, pastedText, country, subject, classLevel,
    organizationId, teacherId, mode = 'school', onProgress,
  } = opts;

  if (!file && !pastedText) throw new Error('Provide a file or pasted text.');

  // ── Step 1: Extract text ─────────────────────────────────────────────
  onProgress('extracting', file ? `Reading ${file.name}…` : 'Processing pasted text…');
  let rawText = pastedText ?? '';
  if (file) {
    rawText = await extractFileText(file);
  }
  // Limit to 80k chars — enough for most textbooks
  rawText = rawText.slice(0, 80000);

  // ── Step 2: Create textbook record ───────────────────────────────────
  onProgress('uploading', 'Saving to library…');
  const { data: book, error: bookErr } = await supabase
    .from('textbooks')
    .insert({
      title:           file?.name?.replace(/\.[^.]+$/, '') ?? 'Uploaded Textbook',
      country,
      subject:         subject ?? null,
      class_level:     classLevel ?? null,
      uploaded_by:     teacherId,
      organization_id: organizationId,
      file_name:       file?.name ?? null,
      file_size_bytes: file?.size ?? null,
      status:          'processing',
      mode,
    })
    .select('id')
    .single();

  if (bookErr || !book?.id) throw new Error(`Failed to create textbook record: ${bookErr?.message}`);
  const textbookId = book.id;

  // ── Step 3: Process chapters via edge function ───────────────────────
  onProgress('detecting_chapters', 'Detecting chapters and subject…');
  const processRes = await supabase.functions.invoke('textbook-process', {
    body: { text: rawText, country, textbookId },
  });

  if (processRes.error || !processRes.data?.success) {
    await supabase.from('textbooks').update({ status: 'failed' }).eq('id', textbookId);
    throw new Error(processRes.error?.message ?? 'Chapter extraction failed.');
  }

  const chapterCount: number = processRes.data.chapter_count ?? 0;
  const detectedSubject: string  = processRes.data.detected_subject  ?? subject ?? '';
  const detectedClass: string    = processRes.data.detected_class_level ?? classLevel ?? '';

  // Update subject/class_level from detection if not provided
  if (!subject || !classLevel) {
    await supabase.from('textbooks').update({
      subject:     detectedSubject  || subject  || null,
      class_level: detectedClass    || classLevel || null,
    }).eq('id', textbookId);
  }

  // ── Step 4: Align to curriculum ──────────────────────────────────────
  onProgress('aligning', `Mapping ${chapterCount} chapters to curriculum objectives…`);
  const alignRes = await supabase.functions.invoke('textbook-align', {
    body: { textbookId },
  });

  // Alignment failure is non-fatal — textbook still usable
  if (alignRes.error || !alignRes.data?.success) {
    console.warn('Alignment step failed:', alignRes.error?.message);
    await supabase.from('textbooks').update({ status: 'ready' }).eq('id', textbookId);
  }

  // ── Step 5: Generate chapter embeddings (non-fatal, fire-and-forget) ─
  onProgress('embedding', 'Generating semantic search index…');
  supabase.functions.invoke('textbook-embed-chapters', { body: { textbookId } }).catch(() => {});

  // ── Fetch final summary ──────────────────────────────────────────────
  onProgress('done', 'Processing complete.');
  const summary = await getTextbookCoverage(textbookId);

  return { textbookId, summary, chapterCount };
}

// ── Generate content for a single chapter ────────────────────────────────────

export async function generateChapterContent(
  chapterId: string,
  teacherId: string,
): Promise<{ lessonNoteId: string | null; assessmentId: string | null }> {
  const { data, error } = await supabase.functions.invoke('textbook-generate-content', {
    body: { chapterId, teacherId },
  });
  if (error || !data?.success) throw new Error(error?.message ?? 'Content generation failed.');
  return {
    lessonNoteId: data.lesson_note_id ?? null,
    assessmentId: data.assessment_id  ?? null,
  };
}

// ── Batch generate lessons + assessments for all chapters ────────────────────

export async function generateAllChapterContent(
  textbookId: string,
  teacherId: string,
  onProgress?: (done: number, total: number) => void,
): Promise<{ generated: number; failed: number }> {
  const chapters = await getTextbookChapters(textbookId);
  const pending  = chapters.filter(c => !c.lesson_note_id && !c.assessment_id);

  let generated = 0;
  let failed    = 0;

  for (let i = 0; i < pending.length; i++) {
    try {
      await generateChapterContent(pending[i].id, teacherId);
      generated++;
    } catch {
      failed++;
    }
    onProgress?.(i + 1, pending.length);
  }

  // Mark textbook as ready
  await supabase.from('textbooks').update({ status: 'ready', updated_at: new Date().toISOString() })
    .eq('id', textbookId);

  return { generated, failed };
}

// ── Ministry comparison across multiple textbooks ────────────────────────────

export interface MinistryComparisonRow {
  textbook_id:         string;
  title:               string;
  coverage_percentage: number;
  covered_objectives:  number;
  total_objectives:    number;
  missing_count:       number;
  chapter_count:       number;
  extra_topics_count:  number;
}

export async function compareTextbooksForMinistry(country: string, subject?: string): Promise<MinistryComparisonRow[]> {
  const books = await getTextbooksByCountry(country, subject);
  return books
    .filter(b => b.textbook_coverage_summary?.length)
    .map(b => {
      const s = b.textbook_coverage_summary![0];
      return {
        textbook_id:         b.id,
        title:               b.title,
        coverage_percentage: s.coverage_percentage,
        covered_objectives:  s.covered_objectives,
        total_objectives:    s.total_objectives,
        missing_count:       s.missing_objectives?.length ?? 0,
        chapter_count:       s.chapter_count,
        extra_topics_count:  s.extra_topics?.length ?? 0,
      };
    })
    .sort((a, b) => b.coverage_percentage - a.coverage_percentage);
}

// ── Semantic / keyword chapter search ────────────────────────────────────────

export async function searchChaptersByQuery(
  query: string,
  opts?: { textbookId?: string; country?: string; subject?: string; matchCount?: number; teacherId?: string },
): Promise<ChapterSearchResult[]> {
  const { data, error } = await supabase.functions.invoke('textbook-search', {
    body: {
      query,
      teacherId:  opts?.teacherId  ?? null,
      textbookId: opts?.textbookId ?? null,
      country:    opts?.country    ?? null,
      subject:    opts?.subject    ?? null,
      matchCount: opts?.matchCount ?? 5,
    },
  });
  if (error || !data?.success) return [];
  return (data.chapters ?? []) as ChapterSearchResult[];
}

// ── Cross-country textbook comparison ────────────────────────────────────────

export interface CrossCountryTextbookComparison {
  id?:                    string;
  country_a:              string;
  country_b:              string;
  subject:                string;
  textbook_count_a:       number;
  textbook_count_b:       number;
  shared_crosswalk_pairs: number;
  country_a_coverage:     number;
  country_b_coverage:     number;
  gap_count_a:            number;
  gap_count_b:            number;
  top_shared_topics:      string[];
  gap_topics_a:           string[];
  gap_topics_b:           string[];
  computed_at:            string;
}

export async function compareTextbooksAcrossCountries(
  countryA: string,
  countryB: string,
  subject?: string,
): Promise<CrossCountryTextbookComparison> {
  const { data, error } = await supabase.functions.invoke('textbook-compare-countries', {
    body: { countryA, countryB, subject: subject ?? null },
  });
  if (error || !data?.success) throw new Error(error?.message ?? 'Comparison failed');
  return data.comparison as CrossCountryTextbookComparison;
}

export async function getCrossCountryComparison(
  countryA: string,
  countryB: string,
  subject?: string,
): Promise<CrossCountryTextbookComparison | null> {
  const { data } = await supabase
    .from('textbook_cross_country_comparison')
    .select('*')
    .eq('country_a', countryA)
    .eq('country_b', countryB)
    .eq('subject', subject ?? '')
    .single();
  return data as CrossCountryTextbookComparison | null;
}

// ── Supplementary lessons for missing objectives ──────────────────────────────

export async function getSupplementaryLessons(
  country: string,
  subject: string,
  missingObjectives: string[],
  limit = 5,
): Promise<SupplementaryLesson[]> {
  if (!missingObjectives.length) return [];

  // Search lesson_notes whose topic matches any missing objective keyword
  const keywords = missingObjectives
    .flatMap(o => o.toLowerCase().split(/\s+/))
    .filter(w => w.length > 3)
    .slice(0, 6);

  if (!keywords.length) return [];

  const likeExpr = `%${keywords.slice(0, 3).join('%')}%`;

  const { data } = await supabase
    .from('lesson_notes')
    .select('id, title, topic, content, class_level, created_at')
    .ilike('topic', likeExpr)
    .limit(limit);

  return (data ?? []) as SupplementaryLesson[];
}
