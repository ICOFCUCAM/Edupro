import { supabase } from '@/lib/supabase';

// ── Types ──────────────────────────────────────────────────

export type PackageType = 'class_exercise' | 'homework' | 'quiz' | 'test' | 'exam' | 'competency_check';
export type Difficulty = 'easy' | 'standard' | 'advanced' | 'mixed';

export interface AssessmentQuestion {
  number: number;
  text: string;
  type: 'mcq' | 'true_false' | 'fill_blank' | 'short_answer' | 'structured' | 'matching';
  options?: Record<string, string>;
  marks: number;
  parts?: Array<{ label: string; text: string; marks: number }>;
}

export interface AssessmentSection {
  title: string;
  type: string;
  instructions?: string;
  questions: AssessmentQuestion[];
}

export interface AssessmentContent {
  title: string;
  instructions: string;
  duration_minutes: number;
  total_marks: number;
  sections: AssessmentSection[];
}

export interface MarkingAnswer {
  number: number;
  type: string;
  correct_answer: string;
  explanation?: string;
  marks: number;
  partial_marks?: Array<{ condition: string; marks: number }>;
}

export interface MarkingScheme {
  total_marks: number;
  answers: MarkingAnswer[];
  teacher_guidance: string;
  grade_boundaries: Record<string, number>;
}

export interface AssessmentVariants {
  easy: AssessmentContent;
  standard: AssessmentContent;
  advanced: AssessmentContent;
}

export interface AssessmentPackage {
  id?: string;
  teacher_id?: string;
  organization_id?: string;
  country: string;
  subject: string;
  class_level: string;
  topic: string;
  package_type: PackageType;
  difficulty: Difficulty;
  language: string;
  question_count: number;
  term?: string;
  week?: number;
  title?: string;
  instructions?: string;
  duration_minutes?: number;
  total_marks?: number;
  content: AssessmentContent;
  marking_scheme: MarkingScheme;
  variants?: AssessmentVariants;
  is_differentiated: boolean;
  created_at?: string;
}

export interface GenerateParams {
  country: string;
  subject: string;
  classLevel: string;
  topic: string;
  packageType: PackageType;
  difficulty: Difficulty;
  questionCount: number;
  language: string;
  objectives?: string;
  differentiated: boolean;
  term?: string;
  week?: number;
}

export interface ObjectiveCoverageStats {
  objective_id: string;
  learning_objective: string;
  topic: string;
  assessment_count: number;
  last_assessed?: string;
}

export interface TeacherAssessmentInsights {
  total: number;
  byType: Record<string, number>;
  byDifficulty: Record<string, number>;
  bySubject: Record<string, number>;
  recentPackages: AssessmentPackage[];
}

// ── Generate ───────────────────────────────────────────────

export async function generateAssessmentPackage(
  params: GenerateParams,
): Promise<{ content: AssessmentContent; marking_scheme: MarkingScheme; variants?: AssessmentVariants }> {
  const { data, error } = await supabase.functions.invoke('generate-assessment', {
    body: {
      country: params.country,
      subject: params.subject,
      classLevel: params.classLevel,
      topic: params.topic,
      packageType: params.packageType,
      difficulty: params.difficulty,
      questionCount: params.questionCount,
      language: params.language,
      objectives: params.objectives ?? '',
      differentiated: params.differentiated,
      term: params.term,
      week: params.week,
    },
  });

  if (error) throw new Error(error.message ?? 'Edge function error');
  if (!data.success) throw new Error(data.error ?? 'Generation failed');

  const raw = data.assessment as Record<string, unknown>;
  return {
    content: {
      title: raw.title as string,
      instructions: raw.instructions as string,
      duration_minutes: raw.duration_minutes as number,
      total_marks: raw.total_marks as number,
      sections: (raw.sections as AssessmentSection[]) ?? [],
    },
    marking_scheme: raw.marking_scheme as MarkingScheme,
    variants: raw.variants as AssessmentVariants | undefined,
  };
}

// ── Save ───────────────────────────────────────────────────

export async function saveAssessmentPackage(
  pkg: Omit<AssessmentPackage, 'id' | 'created_at'>,
  teacherId: string,
  organizationId?: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('assessment_packages')
    .insert({
      teacher_id: teacherId,
      organization_id: organizationId ?? null,
      country: pkg.country,
      subject: pkg.subject,
      class_level: pkg.class_level,
      topic: pkg.topic,
      package_type: pkg.package_type,
      difficulty: pkg.difficulty,
      language: pkg.language,
      question_count: pkg.question_count,
      term: pkg.term ?? null,
      week: pkg.week ?? null,
      title: pkg.content.title,
      instructions: pkg.content.instructions,
      duration_minutes: pkg.content.duration_minutes,
      total_marks: pkg.content.total_marks,
      content: pkg.content,
      marking_scheme: pkg.marking_scheme,
      variants: pkg.variants ?? null,
      is_differentiated: pkg.is_differentiated,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return data.id;
}

// ── Link objectives ────────────────────────────────────────

export async function linkObjectivesToAssessment(
  packageId: string,
  objectiveIds: string[],
): Promise<void> {
  if (!objectiveIds.length) return;
  const rows = objectiveIds.map((oid) => ({
    objective_id: oid,
    assessment_package_id: packageId,
  }));
  const { error } = await supabase.from('objective_question_links').insert(rows);
  if (error) throw new Error(error.message);
}

// ── Fetch ──────────────────────────────────────────────────

export async function getTeacherAssessments(
  teacherId: string,
  limit = 50,
): Promise<AssessmentPackage[]> {
  const { data, error } = await supabase
    .from('assessment_packages')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as AssessmentPackage[];
}

export async function getAssessmentPackage(id: string): Promise<AssessmentPackage> {
  const { data, error } = await supabase
    .from('assessment_packages')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw new Error(error.message);
  return data as AssessmentPackage;
}

export async function deleteAssessmentPackage(id: string): Promise<void> {
  const { error } = await supabase.from('assessment_packages').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Objective coverage analytics ──────────────────────────

export async function getObjectiveCoverageStats(
  country: string,
  subject: string,
  classLevel: string,
): Promise<ObjectiveCoverageStats[]> {
  const { data: objectives, error: objErr } = await supabase
    .from('curriculum_objectives')
    .select('id, learning_objective, topic')
    .eq('country', country)
    .eq('subject', subject)
    .eq('class_level', classLevel);

  if (objErr) throw new Error(objErr.message);
  if (!objectives?.length) return [];

  const objectiveIds = objectives.map((o) => o.id);

  const { data: links, error: linkErr } = await supabase
    .from('objective_question_links')
    .select('objective_id, assessment_packages(created_at)')
    .in('objective_id', objectiveIds);

  if (linkErr) throw new Error(linkErr.message);

  const countMap: Record<string, { count: number; last?: string }> = {};
  for (const link of links ?? []) {
    const oid = link.objective_id as string;
    const ts = (link.assessment_packages as Record<string, string> | null)?.created_at;
    if (!countMap[oid]) countMap[oid] = { count: 0 };
    countMap[oid].count++;
    if (ts && (!countMap[oid].last || ts > countMap[oid].last!)) {
      countMap[oid].last = ts;
    }
  }

  return objectives.map((obj) => ({
    objective_id: obj.id,
    learning_objective: obj.learning_objective,
    topic: obj.topic,
    assessment_count: countMap[obj.id]?.count ?? 0,
    last_assessed: countMap[obj.id]?.last,
  }));
}

// ── Teacher insights ───────────────────────────────────────

export async function getTeacherAssessmentInsights(
  teacherId: string,
): Promise<TeacherAssessmentInsights> {
  const packages = await getTeacherAssessments(teacherId, 200);

  const byType: Record<string, number> = {};
  const byDifficulty: Record<string, number> = {};
  const bySubject: Record<string, number> = {};

  for (const pkg of packages) {
    byType[pkg.package_type] = (byType[pkg.package_type] ?? 0) + 1;
    byDifficulty[pkg.difficulty] = (byDifficulty[pkg.difficulty] ?? 0) + 1;
    bySubject[pkg.subject] = (bySubject[pkg.subject] ?? 0) + 1;
  }

  return {
    total: packages.length,
    byType,
    byDifficulty,
    bySubject,
    recentPackages: packages.slice(0, 5),
  };
}

// ── Fetch curriculum objectives for a scope ────────────────

export async function getObjectivesForScope(
  country: string,
  subject: string,
  classLevel: string,
  term?: string,
  week?: number,
): Promise<Array<{ id: string; learning_objective: string; topic: string; strand?: string }>> {
  let query = supabase
    .from('curriculum_objectives')
    .select('id, learning_objective, topic, strand')
    .eq('country', country)
    .eq('subject', subject)
    .eq('class_level', classLevel);

  if (term) query = query.eq('term', term);
  if (week) query = query.eq('week', week);

  const { data, error } = await query.limit(30);
  if (error) throw new Error(error.message);
  return data ?? [];
}
