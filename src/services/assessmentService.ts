import { supabase } from '@/lib/supabase';

// ── Types ──────────────────────────────────────────────────

export type PackageType = 'class_exercise' | 'homework' | 'quiz' | 'test' | 'exam' | 'competency_check';
export type Difficulty  = 'easy' | 'standard' | 'advanced' | 'mixed';
export type TriggerType = 'lesson_save' | 'lesson_upload' | 'objective_select' | 'manual' | 'curriculum_change';

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
  auto_generated?: boolean;
  trigger_type?: TriggerType;
  source_lesson_id?: string;
  source_objective_id?: string;
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
  triggerType?: TriggerType;
  withEmbedding?: boolean;
}

export interface AutoGenerateParams {
  country: string;
  subject: string;
  classLevel: string;
  topic: string;
  language?: string;
  objectives?: string;
  teacherId: string;
  organizationId?: string;
  sourceLessonId?: string;
  sourceObjectiveId?: string;
  triggerType: TriggerType;
}

export interface SemanticSearchResult {
  id: string;
  title: string;
  topic: string;
  country: string;
  subject: string;
  class_level: string;
  package_type: string;
  difficulty: string;
  similarity: number;
}

export interface MinistryQuestionBankItem {
  id: string;
  country: string;
  subject: string;
  class_level: string;
  topic: string;
  package_type: string;
  difficulty: string;
  language: string;
  question_count: number;
  total_marks: number;
  duration_minutes: number;
  term: string | null;
  week: number | null;
  title: string | null;
  content: AssessmentContent;
  marking_scheme: MarkingScheme;
  is_differentiated: boolean;
  auto_generated: boolean;
  trigger_type: string | null;
  created_at: string;
  school_name: string | null;
  organization_name: string | null;
  org_type: string | null;
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

// ── Internal helpers ───────────────────────────────────────

function extractRawAssessment(raw: Record<string, unknown>, pkgType: PackageType): {
  content: AssessmentContent;
  marking_scheme: MarkingScheme;
  variants?: AssessmentVariants;
  embedding?: number[] | null;
} {
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
    embedding: raw.__embedding as number[] | null | undefined,
  };
}

// ── Generate (manual) ──────────────────────────────────────

export async function generateAssessmentPackage(
  params: GenerateParams,
): Promise<{ content: AssessmentContent; marking_scheme: MarkingScheme; variants?: AssessmentVariants; embedding?: number[] | null }> {
  const { data, error } = await supabase.functions.invoke('generate-assessment', {
    body: {
      country:       params.country,
      subject:       params.subject,
      classLevel:    params.classLevel,
      topic:         params.topic,
      packageType:   params.packageType,
      difficulty:    params.difficulty,
      questionCount: params.questionCount,
      language:      params.language,
      objectives:    params.objectives ?? '',
      differentiated: params.differentiated,
      term:           params.term,
      week:           params.week,
      triggerType:    params.triggerType ?? 'manual',
      withEmbedding:  params.withEmbedding ?? false,
    },
  });

  if (error) throw new Error(error.message ?? 'Edge function error');
  if (!data.success) throw new Error(data.error ?? 'Generation failed');

  return extractRawAssessment(data.assessment as Record<string, unknown>, params.packageType);
}

// ── Auto-generate for a lesson (background, non-blocking) ──

export async function autoGenerateForLesson(params: AutoGenerateParams): Promise<void> {
  const {
    country, subject, classLevel, topic, language = 'en',
    objectives = '', teacherId, organizationId, sourceLessonId, triggerType,
  } = params;

  // Generate class_exercise + homework simultaneously
  const { data, error } = await supabase.functions.invoke('generate-assessment', {
    body: {
      country, subject, classLevel, topic, difficulty: 'standard',
      questionCount: 10, language, objectives,
      differentiated: false,
      packageTypes: ['class_exercise', 'homework'],
      triggerType,
      withEmbedding: true,
    },
  });

  if (error || !data?.success) return; // silent — auto-gen is best-effort

  const assessments: Record<string, unknown>[] = data.assessments ?? [];
  for (const raw of assessments) {
    const pkgType = (raw.__package_type as PackageType) ?? 'class_exercise';
    const result  = extractRawAssessment(raw, pkgType);

    await supabase.from('assessment_packages').insert({
      teacher_id:        teacherId,
      organization_id:   organizationId ?? null,
      country, subject,
      class_level:       classLevel,
      topic,
      package_type:      pkgType,
      difficulty:        'standard',
      language,
      question_count:    10,
      title:             result.content.title,
      instructions:      result.content.instructions,
      duration_minutes:  result.content.duration_minutes,
      total_marks:       result.content.total_marks,
      content:           result.content,
      marking_scheme:    result.marking_scheme,
      is_differentiated: false,
      auto_generated:    true,
      trigger_type:      triggerType,
      source_lesson_id:  sourceLessonId ?? null,
      embedding:         result.embedding ? JSON.stringify(result.embedding) : null,
    });
  }
}

// ── Auto-generate for a curriculum objective ───────────────

export async function autoGenerateForObjective(
  objective: { id: string; learning_objective: string; topic: string; country: string; subject: string; class_level: string },
  teacherId: string,
  language = 'en',
  organizationId?: string,
): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('generate-assessment', {
    body: {
      country:      objective.country,
      subject:      objective.subject,
      classLevel:   objective.class_level,
      topic:        objective.topic,
      packageType:  'quiz',
      difficulty:   'standard',
      questionCount: 5,
      language,
      objectives:   `- ${objective.topic}: ${objective.learning_objective}`,
      differentiated: false,
      triggerType:  'objective_select',
      withEmbedding: true,
    },
  });

  if (error || !data?.success) return null;

  const result = extractRawAssessment(data.assessment as Record<string, unknown>, 'quiz');

  const { data: inserted, error: insertErr } = await supabase
    .from('assessment_packages')
    .insert({
      teacher_id:          teacherId,
      organization_id:     organizationId ?? null,
      country:             objective.country,
      subject:             objective.subject,
      class_level:         objective.class_level,
      topic:               objective.topic,
      package_type:        'quiz',
      difficulty:          'standard',
      language,
      question_count:      5,
      title:               result.content.title,
      instructions:        result.content.instructions,
      duration_minutes:    result.content.duration_minutes,
      total_marks:         result.content.total_marks,
      content:             result.content,
      marking_scheme:      result.marking_scheme,
      is_differentiated:   false,
      auto_generated:      true,
      trigger_type:        'objective_select',
      source_objective_id: objective.id,
      embedding:           result.embedding ? JSON.stringify(result.embedding) : null,
    })
    .select('id')
    .single();

  if (insertErr) return null;

  // Link to the objective
  await supabase.from('objective_question_links').insert({
    objective_id:          objective.id,
    assessment_package_id: inserted.id,
  }).then(() => {});

  return inserted.id;
}

// ── Regenerate assessments when curriculum changes ─────────

export async function regenerateAssessmentsForCurriculumChange(
  country: string,
  subject: string,
  logId?: string,
): Promise<number> {
  // Find all assessment packages for this country/subject that are auto-generated
  const { data: packages, error } = await supabase
    .from('assessment_packages')
    .select('id, teacher_id, organization_id, class_level, topic, language, question_count')
    .eq('country', country)
    .eq('subject', subject)
    .eq('auto_generated', true)
    .limit(50);

  if (error || !packages?.length) return 0;

  let regenerated = 0;
  // Process in batches of 3 to avoid rate limits
  for (let i = 0; i < packages.length; i += 3) {
    const batch = packages.slice(i, i + 3);
    await Promise.allSettled(batch.map(async (pkg: any) => {
      const { data, error: genErr } = await supabase.functions.invoke('generate-assessment', {
        body: {
          country, subject,
          classLevel:    pkg.class_level,
          topic:         pkg.topic,
          packageType:   'quiz',
          difficulty:    'standard',
          questionCount: pkg.question_count ?? 10,
          language:      pkg.language ?? 'en',
          triggerType:   'curriculum_change',
          withEmbedding: true,
        },
      });

      if (genErr || !data?.success) return;

      const result = extractRawAssessment(data.assessment as Record<string, unknown>, 'quiz');
      await supabase.from('assessment_packages').insert({
        teacher_id:       pkg.teacher_id,
        organization_id:  pkg.organization_id ?? null,
        country, subject,
        class_level:      pkg.class_level,
        topic:            pkg.topic,
        package_type:     'quiz',
        difficulty:       'standard',
        language:         pkg.language ?? 'en',
        question_count:   pkg.question_count ?? 10,
        title:            result.content.title,
        instructions:     result.content.instructions,
        duration_minutes: result.content.duration_minutes,
        total_marks:      result.content.total_marks,
        content:          result.content,
        marking_scheme:   result.marking_scheme,
        is_differentiated: false,
        auto_generated:   true,
        trigger_type:     'curriculum_change',
        embedding:        result.embedding ? JSON.stringify(result.embedding) : null,
      });
      regenerated++;
    }));
  }

  // Update change log
  if (logId) {
    await supabase.from('curriculum_change_log').update({
      assessments_regenerated:       true,
      assessments_regenerated_count: regenerated,
      assessments_regenerated_at:    new Date().toISOString(),
    }).eq('id', logId);
  }

  return regenerated;
}

// ── Semantic search via pgvector ───────────────────────────

export async function searchSimilarAssessments(
  queryText: string,
  country: string,
  subject?: string,
  classLevel?: string,
  limit = 8,
): Promise<SemanticSearchResult[]> {
  // First try to get a query embedding via the edge function trick:
  // We generate a tiny "assessment" and pull its embedding — or fall back to text search.
  // In practice, call a dedicated embedding endpoint via Supabase RPC.

  // Fallback: text-based search (works without embeddings)
  const query = supabase
    .from('assessment_packages')
    .select('id, title, topic, country, subject, class_level, package_type, difficulty')
    .eq('country', country)
    .ilike('topic', `%${queryText}%`);

  if (subject) (query as any).eq('subject', subject);
  if (classLevel) (query as any).eq('class_level', classLevel);

  const { data, error } = await (query as any).limit(limit);
  if (error || !data?.length) return [];

  return data.map((row: any) => ({ ...row, similarity: 0.8 }));
}

// ── Ministry Question Bank ─────────────────────────────────

export async function getMinistryQuestionBank(
  country: string,
  subject?: string,
  classLevel?: string,
  packageType?: string,
  limit = 100,
): Promise<MinistryQuestionBankItem[]> {
  let query = supabase
    .from('ministry_question_bank')
    .select('*')
    .eq('country', country)
    .order('created_at', { ascending: false });

  if (subject)     query = query.eq('subject', subject);
  if (classLevel)  query = query.eq('class_level', classLevel);
  if (packageType) query = query.eq('package_type', packageType);

  const { data, error } = await query.limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as MinistryQuestionBankItem[];
}

// ── Save ───────────────────────────────────────────────────

export async function saveAssessmentPackage(
  pkg: Omit<AssessmentPackage, 'id' | 'created_at'>,
  teacherId: string,
  organizationId?: string,
  embedding?: number[] | null,
): Promise<string> {
  const { data, error } = await supabase
    .from('assessment_packages')
    .insert({
      teacher_id:        teacherId,
      organization_id:   organizationId ?? null,
      country:           pkg.country,
      subject:           pkg.subject,
      class_level:       pkg.class_level,
      topic:             pkg.topic,
      package_type:      pkg.package_type,
      difficulty:        pkg.difficulty,
      language:          pkg.language,
      question_count:    pkg.question_count,
      term:              pkg.term ?? null,
      week:              pkg.week ?? null,
      title:             pkg.content.title,
      instructions:      pkg.content.instructions,
      duration_minutes:  pkg.content.duration_minutes,
      total_marks:       pkg.content.total_marks,
      content:           pkg.content,
      marking_scheme:    pkg.marking_scheme,
      variants:          pkg.variants ?? null,
      is_differentiated: pkg.is_differentiated,
      auto_generated:    pkg.auto_generated ?? false,
      trigger_type:      pkg.trigger_type ?? 'manual',
      source_lesson_id:  pkg.source_lesson_id ?? null,
      source_objective_id: pkg.source_objective_id ?? null,
      embedding:         embedding ? JSON.stringify(embedding) : null,
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
    objective_id:          oid,
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

  const objectiveIds = objectives.map((o: any) => o.id);
  const { data: links, error: linkErr } = await supabase
    .from('objective_question_links')
    .select('objective_id, assessment_packages(created_at)')
    .in('objective_id', objectiveIds);

  if (linkErr) throw new Error(linkErr.message);

  const countMap: Record<string, { count: number; last?: string }> = {};
  for (const link of links ?? []) {
    const oid = link.objective_id as string;
    const ts  = (link.assessment_packages as Record<string, string> | null)?.created_at;
    if (!countMap[oid]) countMap[oid] = { count: 0 };
    countMap[oid].count++;
    if (ts && (!countMap[oid].last || ts > countMap[oid].last!)) countMap[oid].last = ts;
  }

  return (objectives as any[]).map((obj: any) => ({
    objective_id:      obj.id,
    learning_objective: obj.learning_objective,
    topic:             obj.topic,
    assessment_count:  countMap[obj.id]?.count ?? 0,
    last_assessed:     countMap[obj.id]?.last,
  }));
}

// ── Teacher insights ───────────────────────────────────────

export async function getTeacherAssessmentInsights(
  teacherId: string,
): Promise<TeacherAssessmentInsights> {
  const packages = await getTeacherAssessments(teacherId, 200);

  const byType: Record<string, number>       = {};
  const byDifficulty: Record<string, number> = {};
  const bySubject: Record<string, number>    = {};

  for (const pkg of packages) {
    byType[pkg.package_type]   = (byType[pkg.package_type]   ?? 0) + 1;
    byDifficulty[pkg.difficulty] = (byDifficulty[pkg.difficulty] ?? 0) + 1;
    bySubject[pkg.subject]     = (bySubject[pkg.subject]     ?? 0) + 1;
  }

  return { total: packages.length, byType, byDifficulty, bySubject, recentPackages: packages.slice(0, 5) };
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
