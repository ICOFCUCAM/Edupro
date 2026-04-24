import { supabase } from '@/lib/supabase';

// ── Types ──────────────────────────────────────────────────

export interface AlignmentResult {
  alignmentScore: number;       // 0–100
  confidenceScore: number;      // 0–100
  alignmentLevel: 'full' | 'partial' | 'needs_improvement';
  matchedObjectives: string[];
  missingObjectives: string[];
  recommendations: string[];
}

export interface DualAlignmentResult {
  national: AlignmentResult;
  school: AlignmentResult | null;  // null when no school scheme exists
}

export interface CurriculumObjective {
  id: string;
  country: string;
  subject: string;
  class_level: string;
  topic: string;
  learning_objective: string;
  term: string | null;
  week: number | null;
  strand: string | null;
  source_label: string | null;
}

export interface StoredAlignmentScore extends AlignmentResult {
  id: string;
  lesson_id: string;
  country: string;
  subject: string;
  class_level: string;
  school_alignment_score: number | null;
  school_matched_objectives: string[] | null;
  school_missing_objectives: string[] | null;
  checked_at: string;
}

// ── Fetch curriculum objectives ────────────────────────────

export async function getCurriculumObjectives(
  country: string,
  subject?: string,
  classLevel?: string
): Promise<CurriculumObjective[]> {
  let query = supabase.from('curriculum_objectives').select('*').eq('country', country);
  if (subject) query = query.eq('subject', subject);
  if (classLevel) query = query.eq('class_level', classLevel);
  const { data } = await query;
  return data || [];
}

// ── National curriculum alignment (AI + heuristic fallback) ─

export async function alignLessonToCurriculum(
  lessonText: string,
  country: string,
  subject: string,
  classLevel: string
): Promise<AlignmentResult | null> {
  const objectives = await getCurriculumObjectives(country, subject, classLevel);
  if (!objectives.length) return buildHeuristicScore(lessonText, [], subject, classLevel);

  const objectivesList = objectives
    .slice(0, 30)
    .map(o => `• [${o.topic}] ${o.learning_objective}`)
    .join('\n');

  try {
    const { data, error } = await supabase.functions.invoke('check-curriculum-alignment', {
      body: { lessonText: lessonText.slice(0, 4000), country, subject, classLevel, objectives: objectivesList },
    });
    if (error || !data?.success) return buildHeuristicScore(lessonText, objectives, subject, classLevel);

    const r = data.result;
    const score = clamp(r.alignmentScore ?? 0, 0, 100);
    return {
      alignmentScore: score,
      confidenceScore: clamp(r.confidenceScore ?? 70, 0, 100),
      alignmentLevel: scoreToLevel(score),
      matchedObjectives: r.matchedObjectives ?? [],
      missingObjectives: r.missingObjectives ?? [],
      recommendations: r.recommendations ?? [],
    };
  } catch {
    return buildHeuristicScore(lessonText, objectives, subject, classLevel);
  }
}

// ── School-level dual alignment ────────────────────────────
// Checks alignment against BOTH national curriculum and the school's
// uploaded scheme-of-work / knowledge items simultaneously.

export async function alignLessonDual(
  lessonText: string,
  country: string,
  subject: string,
  classLevel: string,
  schoolKnowledgeItems?: Array<{ title: string; summary?: string; content?: string; content_type?: string }>
): Promise<DualAlignmentResult> {
  const objectives = await getCurriculumObjectives(country, subject, classLevel);
  const objectivesList = objectives
    .slice(0, 30)
    .map(o => `• [${o.topic}] ${o.learning_objective}`)
    .join('\n');

  // Build school scheme context from knowledge items
  const schemeItems = schoolKnowledgeItems?.filter(
    k => k.content_type === 'scheme_of_work' || k.content_type === 'document'
  ) ?? [];

  const schoolScheme = schemeItems.length
    ? schemeItems
        .slice(0, 5)
        .map(k => `${k.title}${k.summary ? ': ' + k.summary : ''}${k.content ? '\n' + k.content.slice(0, 300) : ''}`)
        .join('\n---\n')
    : undefined;

  try {
    const { data, error } = await supabase.functions.invoke('check-curriculum-alignment', {
      body: {
        lessonText: lessonText.slice(0, 4000),
        country, subject, classLevel,
        objectives: objectivesList || '(No national objectives found for this level)',
        schoolScheme,
      },
    });

    if (error || !data?.success) {
      const nat = buildHeuristicScore(lessonText, objectives, subject, classLevel);
      const sch = schoolScheme ? buildSchemeHeuristicScore(lessonText, schemeItems) : null;
      return { national: nat, school: sch };
    }

    const r = data.result;
    const natScore = clamp(r.alignmentScore ?? 0, 0, 100);
    const national: AlignmentResult = {
      alignmentScore: natScore,
      confidenceScore: clamp(r.confidenceScore ?? 70, 0, 100),
      alignmentLevel: scoreToLevel(natScore),
      matchedObjectives: r.matchedObjectives ?? [],
      missingObjectives: r.missingObjectives ?? [],
      recommendations: r.recommendations ?? [],
    };

    let school: AlignmentResult | null = null;
    if (schoolScheme && r.schoolAlignmentScore !== undefined) {
      const schScore = clamp(r.schoolAlignmentScore ?? 0, 0, 100);
      school = {
        alignmentScore: schScore,
        confidenceScore: clamp(r.confidenceScore ?? 60, 0, 100),
        alignmentLevel: scoreToLevel(schScore),
        matchedObjectives: r.schoolMatchedObjectives ?? [],
        missingObjectives: r.schoolMissingObjectives ?? [],
        recommendations: [],
      };
    }

    return { national, school };
  } catch {
    const nat = buildHeuristicScore(lessonText, objectives, subject, classLevel);
    const sch = schoolScheme ? buildSchemeHeuristicScore(lessonText, schemeItems) : null;
    return { national: nat, school: sch };
  }
}

// ── Persist scores ─────────────────────────────────────────

export async function saveAlignmentScore(
  lessonId: string,
  country: string,
  subject: string,
  classLevel: string,
  result: AlignmentResult,
  schoolResult?: AlignmentResult | null
): Promise<boolean> {
  const { error } = await supabase.from('lesson_alignment_scores').upsert({
    lesson_id: lessonId,
    country, subject,
    class_level: classLevel,
    alignment_score: result.alignmentScore,
    confidence_score: result.confidenceScore,
    alignment_level: result.alignmentLevel,
    matched_objectives: result.matchedObjectives,
    missing_objectives: result.missingObjectives,
    recommendations: result.recommendations,
    school_alignment_score: schoolResult?.alignmentScore ?? null,
    school_matched_objectives: schoolResult?.matchedObjectives ?? null,
    school_missing_objectives: schoolResult?.missingObjectives ?? null,
    checked_at: new Date().toISOString(),
  }, { onConflict: 'lesson_id' });
  return !error;
}

export async function getAlignmentScore(lessonId: string): Promise<StoredAlignmentScore | null> {
  const { data, error } = await supabase
    .from('lesson_alignment_scores').select('*').eq('lesson_id', lessonId).single();
  if (error || !data) return null;
  return rowToStored(data);
}

export async function getAlignmentScoresForLessons(
  lessonIds: string[]
): Promise<Record<string, StoredAlignmentScore>> {
  if (!lessonIds.length) return {};
  const { data } = await supabase
    .from('lesson_alignment_scores').select('*').in('lesson_id', lessonIds);
  const map: Record<string, StoredAlignmentScore> = {};
  for (const row of data || []) map[row.lesson_id] = rowToStored(row);
  return map;
}

// ── Batch rescore for a country (called from KnowledgeBase) ─

export async function rescoreLessonsForCountry(
  country: string,
  subject?: string
): Promise<{ rescored: number; errors: number }> {
  // Fetch up to 50 most recent lessons for this country that need rescoring
  let q = supabase
    .from('lesson_notes')
    .select('id, subject, level, content')
    .eq('country', country)
    .order('created_at', { ascending: false })
    .limit(50);
  if (subject) q = q.eq('subject', subject);

  const { data: lessons } = await q;
  if (!lessons?.length) return { rescored: 0, errors: 0 };

  let rescored = 0;
  let errors = 0;

  // Process in batches of 5 to avoid hammering the edge function
  for (let i = 0; i < lessons.length; i += 5) {
    const batch = lessons.slice(i, i + 5);
    await Promise.all(batch.map(async lesson => {
      try {
        const text = extractTextFromLessonNote(lesson.content);
        if (!text.trim()) return;
        const result = await alignLessonToCurriculum(text, country, lesson.subject, lesson.level);
        if (result) {
          await saveAlignmentScore(lesson.id, country, lesson.subject, lesson.level, result);
          rescored++;
        }
      } catch {
        errors++;
      }
    }));
  }

  // Log the curriculum change/rescore event
  if (rescored > 0) {
    await supabase.from('curriculum_change_log').insert({
      country,
      subject: subject ?? null,
      change_type: 'updated',
      description: `Batch rescore triggered: ${rescored} lessons re-analysed`,
    });
  }

  return { rescored, errors };
}

// ── Analytics helpers ──────────────────────────────────────

export async function getCountryAlignmentStats(
  country: string,
  subject?: string
): Promise<{ avg_score: number; total_lessons: number; full: number; partial: number; needs_improvement: number }> {
  let q = supabase
    .from('lesson_alignment_scores')
    .select('alignment_score, alignment_level')
    .eq('country', country);
  if (subject) q = q.eq('subject', subject);
  const { data } = await q;
  if (!data?.length) return { avg_score: 0, total_lessons: 0, full: 0, partial: 0, needs_improvement: 0 };

  const total = data.length;
  const avg = Math.round(data.reduce((s, r) => s + r.alignment_score, 0) / total);
  return {
    avg_score: avg, total_lessons: total,
    full: data.filter(r => r.alignment_level === 'full').length,
    partial: data.filter(r => r.alignment_level === 'partial').length,
    needs_improvement: data.filter(r => r.alignment_level === 'needs_improvement').length,
  };
}

// ── Text extraction ────────────────────────────────────────

export function extractTextFromLessonNote(lessonNote: any): string {
  if (!lessonNote) return '';
  const parts: string[] = [];
  if (typeof lessonNote === 'string') {
    try { lessonNote = JSON.parse(lessonNote); } catch { return lessonNote; }
  }
  if (lessonNote.title) parts.push(lessonNote.title);
  if (lessonNote.teacherNotes) parts.push(lessonNote.teacherNotes);
  if (lessonNote.differentiationStrategies) parts.push(lessonNote.differentiationStrategies);
  if (lessonNote.crossCurricularLinks) parts.push(lessonNote.crossCurricularLinks);
  if (Array.isArray(lessonNote.rows)) {
    for (const row of lessonNote.rows) {
      if (typeof row === 'object') parts.push(Object.values(row).filter(Boolean).join(' '));
    }
  }
  // metadata fields
  if (lessonNote.metadata && typeof lessonNote.metadata === 'object') {
    parts.push(Object.values(lessonNote.metadata).filter(Boolean).join(' '));
  }
  return parts.join('. ');
}

// Extracts plain text from uploaded files (browser-side)
export async function extractTextFromFile(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'txt') {
    return await file.text();
  }

  if (ext === 'docx') {
    // Minimal DOCX text extraction: unzip and pull text from word/document.xml
    try {
      const { default: JSZip } = await import('jszip');
      const zip = await JSZip.loadAsync(file);
      const xml = await zip.file('word/document.xml')?.async('text');
      if (!xml) return '';
      // Strip XML tags, decode entities
      return xml
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim();
    } catch {
      return '';
    }
  }

  // PDF: we can't extract text client-side without a heavy lib; return empty
  return '';
}

// ── Private helpers ────────────────────────────────────────

function scoreToLevel(score: number): 'full' | 'partial' | 'needs_improvement' {
  if (score >= 75) return 'full';
  if (score >= 45) return 'partial';
  return 'needs_improvement';
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function rowToStored(data: any): StoredAlignmentScore {
  return {
    id: data.id,
    lesson_id: data.lesson_id,
    country: data.country,
    subject: data.subject,
    class_level: data.class_level,
    alignmentScore: data.alignment_score,
    confidenceScore: data.confidence_score,
    alignmentLevel: data.alignment_level,
    matchedObjectives: data.matched_objectives || [],
    missingObjectives: data.missing_objectives || [],
    recommendations: data.recommendations || [],
    school_alignment_score: data.school_alignment_score ?? null,
    school_matched_objectives: data.school_matched_objectives ?? null,
    school_missing_objectives: data.school_missing_objectives ?? null,
    checked_at: data.checked_at,
  };
}

function buildHeuristicScore(
  lessonText: string,
  objectives: CurriculumObjective[],
  subject: string,
  classLevel: string
): AlignmentResult {
  const text = lessonText.toLowerCase();
  const matched: string[] = [];
  const missing: string[] = [];

  for (const obj of objectives.slice(0, 15)) {
    const keywords = obj.learning_objective.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    const hits = keywords.filter(k => text.includes(k)).length;
    if (hits >= Math.ceil(keywords.length * 0.4)) matched.push(obj.learning_objective);
    else missing.push(obj.learning_objective);
  }

  const total = matched.length + missing.length || 1;
  const score = Math.round((matched.length / total) * 100);
  const recommendations: string[] = [];
  if (missing.length > 0) recommendations.push(`Consider covering: ${missing.slice(0, 2).join('; ')}`);
  if (score < 45) recommendations.push(`Align lesson activities more closely with ${classLevel} ${subject} objectives.`);

  return {
    alignmentScore: score, confidenceScore: 55,
    alignmentLevel: scoreToLevel(score),
    matchedObjectives: matched, missingObjectives: missing, recommendations,
  };
}

function buildSchemeHeuristicScore(
  lessonText: string,
  schemeItems: Array<{ title: string; summary?: string; content?: string }>
): AlignmentResult {
  const text = lessonText.toLowerCase();
  const matched: string[] = [];
  const missing: string[] = [];

  for (const item of schemeItems.slice(0, 10)) {
    const ref = `${item.title} ${item.summary || ''}`.toLowerCase();
    const keywords = ref.split(/\s+/).filter(w => w.length > 4);
    const hits = keywords.filter(k => text.includes(k)).length;
    const label = item.summary ? `${item.title}: ${item.summary.slice(0, 80)}` : item.title;
    if (hits >= Math.ceil(keywords.length * 0.3)) matched.push(label);
    else missing.push(label);
  }

  const total = matched.length + missing.length || 1;
  const score = Math.round((matched.length / total) * 100);

  return {
    alignmentScore: score, confidenceScore: 45,
    alignmentLevel: scoreToLevel(score),
    matchedObjectives: matched, missingObjectives: missing, recommendations: [],
  };
}
