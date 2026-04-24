import { supabase } from '@/lib/supabase';

export interface AlignmentResult {
  alignmentScore: number;       // 0–100
  confidenceScore: number;      // 0–100 (AI certainty)
  alignmentLevel: 'full' | 'partial' | 'needs_improvement';
  matchedObjectives: string[];
  missingObjectives: string[];
  recommendations: string[];
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
  checked_at: string;
}

// ── Fetch curriculum objectives ────────────────────────────

export async function getCurriculumObjectives(
  country: string,
  subject?: string,
  classLevel?: string
): Promise<CurriculumObjective[]> {
  let query = supabase
    .from('curriculum_objectives')
    .select('*')
    .eq('country', country);

  if (subject) query = query.eq('subject', subject);
  if (classLevel) query = query.eq('class_level', classLevel);

  const { data, error } = await query;
  if (error) return [];
  return data || [];
}

// ── AI alignment check ─────────────────────────────────────

export async function alignLessonToCurriculum(
  lessonText: string,
  country: string,
  subject: string,
  classLevel: string
): Promise<AlignmentResult | null> {
  const objectives = await getCurriculumObjectives(country, subject, classLevel);
  if (!objectives.length) {
    return buildHeuristicScore(lessonText, [], subject, classLevel);
  }

  const objectivesList = objectives
    .slice(0, 30)
    .map(o => `• [${o.topic}] ${o.learning_objective}`)
    .join('\n');

  try {
    const { data, error } = await supabase.functions.invoke('check-curriculum-alignment', {
      body: {
        lessonText: lessonText.slice(0, 4000),
        country,
        subject,
        classLevel,
        objectives: objectivesList,
      },
    });

    if (error || !data?.success) {
      return buildHeuristicScore(lessonText, objectives, subject, classLevel);
    }

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

// ── Persist score ──────────────────────────────────────────

export async function saveAlignmentScore(
  lessonId: string,
  country: string,
  subject: string,
  classLevel: string,
  result: AlignmentResult
): Promise<boolean> {
  const { error } = await supabase
    .from('lesson_alignment_scores')
    .upsert({
      lesson_id: lessonId,
      country,
      subject,
      class_level: classLevel,
      alignment_score: result.alignmentScore,
      confidence_score: result.confidenceScore,
      alignment_level: result.alignmentLevel,
      matched_objectives: result.matchedObjectives,
      missing_objectives: result.missingObjectives,
      recommendations: result.recommendations,
      checked_at: new Date().toISOString(),
    }, { onConflict: 'lesson_id' });

  return !error;
}

export async function getAlignmentScore(lessonId: string): Promise<StoredAlignmentScore | null> {
  const { data, error } = await supabase
    .from('lesson_alignment_scores')
    .select('*')
    .eq('lesson_id', lessonId)
    .single();

  if (error || !data) return null;

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
    checked_at: data.checked_at,
  };
}

// ── Ministry analytics helper ──────────────────────────────

export async function getCountryAlignmentStats(
  country: string,
  subject?: string
): Promise<{ avg_score: number; total_lessons: number; full: number; partial: number; needs_improvement: number }> {
  let query = supabase
    .from('lesson_alignment_scores')
    .select('alignment_score, alignment_level')
    .eq('country', country);

  if (subject) query = query.eq('subject', subject);
  const { data } = await query;
  if (!data?.length) return { avg_score: 0, total_lessons: 0, full: 0, partial: 0, needs_improvement: 0 };

  const total = data.length;
  const avg = Math.round(data.reduce((s, r) => s + r.alignment_score, 0) / total);
  return {
    avg_score: avg,
    total_lessons: total,
    full: data.filter(r => r.alignment_level === 'full').length,
    partial: data.filter(r => r.alignment_level === 'partial').length,
    needs_improvement: data.filter(r => r.alignment_level === 'needs_improvement').length,
  };
}

// ── Text extractor for uploaded documents ──────────────────

export function extractTextFromLessonNote(lessonNote: any): string {
  if (!lessonNote) return '';
  const parts: string[] = [];
  if (lessonNote.title) parts.push(lessonNote.title);
  if (lessonNote.teacherNotes) parts.push(lessonNote.teacherNotes);
  if (lessonNote.differentiationStrategies) parts.push(lessonNote.differentiationStrategies);
  if (lessonNote.crossCurricularLinks) parts.push(lessonNote.crossCurricularLinks);
  if (Array.isArray(lessonNote.rows)) {
    for (const row of lessonNote.rows) {
      if (typeof row === 'object') parts.push(Object.values(row).join(' '));
    }
  }
  return parts.join('. ');
}

// ── Helpers ────────────────────────────────────────────────

function scoreToLevel(score: number): 'full' | 'partial' | 'needs_improvement' {
  if (score >= 75) return 'full';
  if (score >= 45) return 'partial';
  return 'needs_improvement';
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
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
    if (hits >= Math.ceil(keywords.length * 0.4)) {
      matched.push(obj.learning_objective);
    } else {
      missing.push(obj.learning_objective);
    }
  }

  const total = matched.length + missing.length || 1;
  const score = Math.round((matched.length / total) * 100);

  const recommendations: string[] = [];
  if (missing.length > 0) {
    recommendations.push(`Consider covering: ${missing.slice(0, 2).join('; ')}`);
  }
  if (score < 45) {
    recommendations.push(`Align lesson activities more closely with ${classLevel} ${subject} objectives.`);
  }

  return {
    alignmentScore: score,
    confidenceScore: 55,
    alignmentLevel: scoreToLevel(score),
    matchedObjectives: matched,
    missingObjectives: missing,
    recommendations,
  };
}
