import { supabase } from '@/lib/supabase';

export type MasteryLevel = 'not_started' | 'developing' | 'proficient' | 'mastered';

export interface StudentResult {
  id: string;
  student_id: string;
  assessment_package_id: string;
  teacher_id?: string;
  organization_id?: string;
  score: number;
  max_score: number;
  percentage: number;
  mastery_level: MasteryLevel;
  notes?: string;
  created_at: string;
}

export interface ClassPerformanceSummary {
  id: string;
  organization_id: string;
  teacher_id?: string;
  class_level: string;
  subject: string;
  average_score: number;
  student_count: number;
  weak_objectives: string[];
  strong_objectives: string[];
  mastery_distribution: Record<MasteryLevel, number>;
  intervention_needed: boolean;
  last_updated: string;
}

export interface DistrictPerformanceSummary {
  id: string;
  district_id: string;
  subject: string;
  class_level: string;
  average_score: number;
  school_count: number;
  student_count: number;
  weak_topics: string[];
  improvement_trend: 'improving' | 'stable' | 'declining';
  benchmark_met: boolean;
  last_updated: string;
}

export interface ObjectiveMasteryRow {
  objective_id: string;
  learning_objective: string;
  topic: string;
  not_started_count: number;
  developing_count: number;
  proficient_count: number;
  mastered_count: number;
  avg_confidence: number;
}

export function calculateMasteryLevel(percentage: number): MasteryLevel {
  if (percentage >= 85) return 'mastered';
  if (percentage >= 65) return 'proficient';
  if (percentage >= 40) return 'developing';
  return 'not_started';
}

// Add a student result and trigger the analytics pipeline
export async function addStudentResult(
  studentId: string,
  assessmentPackageId: string,
  score: number,
  maxScore: number,
  teacherId?: string,
  organizationId?: string,
  notes?: string
): Promise<{ success: boolean; resultId?: string; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('student_results')
      .insert({
        student_id: studentId,
        assessment_package_id: assessmentPackageId,
        score,
        max_score: maxScore,
        teacher_id: teacherId,
        organization_id: organizationId,
        notes,
      })
      .select('id')
      .single();

    if (error) return { success: false, error: error.message };

    // Fire-and-forget pipeline
    if (organizationId) {
      const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;

      // Map to curriculum objectives via assessment links
      mapResultToObjectives(studentId, assessmentPackageId, percentage).catch(() => {});

      // Refresh class summary after a brief delay to batch concurrent inserts
      setTimeout(() => {
        refreshClassSummary(studentId, assessmentPackageId, organizationId).catch(() => {});
      }, 500);
    }

    return { success: true, resultId: data.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function mapResultToObjectives(
  studentId: string,
  assessmentPackageId: string,
  percentage: number
): Promise<void> {
  const { data: links } = await supabase
    .from('objective_question_links')
    .select('objective_id')
    .eq('assessment_package_id', assessmentPackageId);

  if (!links?.length) return;
  const objectiveIds = [...new Set(links.map((l: any) => l.objective_id))];
  await updateObjectiveMastery(studentId, objectiveIds, percentage);
}

export async function updateObjectiveMastery(
  studentId: string,
  objectiveIds: string[],
  percentage: number
): Promise<void> {
  if (!objectiveIds.length) return;
  const level = calculateMasteryLevel(percentage);

  const upserts = objectiveIds.map((objectiveId) => ({
    student_id: studentId,
    objective_id: objectiveId,
    mastery_level: level,
    confidence_score: percentage,
    attempt_count: 1,
    last_updated: new Date().toISOString(),
  }));

  await supabase
    .from('objective_mastery')
    .upsert(upserts, {
      onConflict: 'student_id,objective_id',
      ignoreDuplicates: false,
    });
}

async function refreshClassSummary(
  studentId: string,
  assessmentPackageId: string,
  organizationId: string
): Promise<void> {
  // Look up the student to get class_level
  const [studentRes, pkgRes] = await Promise.all([
    supabase.from('students').select('class_level').eq('id', studentId).single(),
    supabase.from('assessment_packages').select('subject').eq('id', assessmentPackageId).single(),
  ]);

  const classLevel = studentRes.data?.class_level;
  const subject = pkgRes.data?.subject;

  if (classLevel && subject) {
    await updateClassPerformanceSummary(organizationId, classLevel, subject);
  }
}

export async function updateClassPerformanceSummary(
  organizationId: string,
  classLevel: string,
  subject: string
): Promise<void> {
  // Fetch all results for students in this org/class/subject
  const { data: results } = await supabase
    .from('student_results')
    .select('percentage, mastery_level, student_id, assessment_packages!inner(subject)')
    .eq('organization_id', organizationId)
    .filter('assessment_packages.subject', 'eq', subject);

  if (!results) return;

  const classResults = results.filter((r: any) => r.percentage !== null);
  if (!classResults.length) return;

  const studentIds = [...new Set(classResults.map((r: any) => r.student_id))];
  const avgScore = classResults.reduce((s: number, r: any) => s + (r.percentage ?? 0), 0) / classResults.length;

  const dist: Record<MasteryLevel, number> = { not_started: 0, developing: 0, proficient: 0, mastered: 0 };
  classResults.forEach((r: any) => {
    const lvl = (r.mastery_level as MasteryLevel) ?? 'not_started';
    dist[lvl] = (dist[lvl] || 0) + 1;
  });

  // Identify weak objectives (avg confidence < 50%)
  const { data: weakData } = await supabase
    .rpc('get_class_objective_mastery', {
      p_organization_id: organizationId,
      p_class_level: classLevel,
      p_subject: subject,
    });

  const weakObjectives: string[] = [];
  const strongObjectives: string[] = [];
  (weakData || []).forEach((row: ObjectiveMasteryRow) => {
    if (row.avg_confidence < 50) weakObjectives.push(row.learning_objective);
    else if (row.avg_confidence >= 75) strongObjectives.push(row.learning_objective);
  });

  await supabase
    .from('class_performance_summary')
    .upsert(
      {
        organization_id: organizationId,
        class_level: classLevel,
        subject,
        average_score: Math.round(avgScore * 100) / 100,
        student_count: studentIds.length,
        weak_objectives: weakObjectives.slice(0, 10),
        strong_objectives: strongObjectives.slice(0, 10),
        mastery_distribution: dist,
        intervention_needed: avgScore < 50,
        last_updated: new Date().toISOString(),
      },
      { onConflict: 'organization_id,class_level,subject' }
    );
}

export async function getClassPerformanceSummary(
  organizationId: string,
  classLevel?: string,
  subject?: string
): Promise<ClassPerformanceSummary[]> {
  let q = supabase.from('class_performance_summary').select('*').eq('organization_id', organizationId);
  if (classLevel) q = q.eq('class_level', classLevel);
  if (subject) q = q.eq('subject', subject);
  const { data } = await q.order('last_updated', { ascending: false });
  return (data || []) as ClassPerformanceSummary[];
}

export async function getClassObjectiveMastery(
  organizationId: string,
  classLevel: string,
  subject: string
): Promise<ObjectiveMasteryRow[]> {
  const { data } = await supabase.rpc('get_class_objective_mastery', {
    p_organization_id: organizationId,
    p_class_level: classLevel,
    p_subject: subject,
  });
  return (data || []) as ObjectiveMasteryRow[];
}

export async function getWeakObjectives(
  organizationId: string,
  classLevel: string,
  subject: string,
  threshold = 50
): Promise<ObjectiveMasteryRow[]> {
  const rows = await getClassObjectiveMastery(organizationId, classLevel, subject);
  return rows.filter((r) => r.avg_confidence < threshold);
}

export async function checkInterventionNeeded(
  organizationId: string,
  classLevel: string,
  subject: string
): Promise<{ needed: boolean; averageScore: number; weakCount: number }> {
  const summaries = await getClassPerformanceSummary(organizationId, classLevel, subject);
  const summary = summaries[0];
  if (!summary) return { needed: false, averageScore: 0, weakCount: 0 };
  return {
    needed: summary.intervention_needed,
    averageScore: summary.average_score,
    weakCount: summary.weak_objectives.length,
  };
}

export async function getDistrictPerformance(
  districtId: string,
  subject?: string
): Promise<DistrictPerformanceSummary[]> {
  let q = supabase.from('district_performance_summary').select('*').eq('district_id', districtId);
  if (subject) q = q.eq('subject', subject);
  const { data } = await q.order('average_score', { ascending: true });
  return (data || []) as DistrictPerformanceSummary[];
}

export async function refreshDistrictPerformance(districtId: string): Promise<void> {
  // Aggregate class summaries from all schools in the district
  const { data: schools } = await supabase
    .from('organizations')
    .select('id')
    .eq('parent_organization_id', districtId);

  if (!schools?.length) return;
  const schoolIds = schools.map((s: any) => s.id);

  const { data: classSummaries } = await supabase
    .from('class_performance_summary')
    .select('subject, class_level, average_score, student_count, weak_objectives, organization_id')
    .in('organization_id', schoolIds);

  if (!classSummaries?.length) return;

  // Group by subject
  const bySubject: Record<string, typeof classSummaries> = {};
  classSummaries.forEach((cs: any) => {
    if (!bySubject[cs.subject]) bySubject[cs.subject] = [];
    bySubject[cs.subject].push(cs);
  });

  for (const [subject, rows] of Object.entries(bySubject)) {
    const avgScore = rows.reduce((s, r) => s + r.average_score, 0) / rows.length;
    const totalStudents = rows.reduce((s, r) => s + r.student_count, 0);
    const allWeak = rows.flatMap((r) => r.weak_objectives || []);
    const weakTopics = [...new Set(allWeak)].slice(0, 10);

    await supabase
      .from('district_performance_summary')
      .upsert(
        {
          district_id: districtId,
          subject,
          class_level: 'all',
          average_score: Math.round(avgScore * 100) / 100,
          school_count: new Set(rows.map((r) => r.organization_id)).size,
          student_count: totalStudents,
          weak_topics: weakTopics,
          improvement_trend: 'stable',
          benchmark_met: avgScore >= 65,
          last_updated: new Date().toISOString(),
        },
        { onConflict: 'district_id,subject,class_level' }
      );
  }
}

// Query by teacher_id (used by coaching assistant)
export async function getTeacherCoachingData(teacherId: string): Promise<ClassPerformanceSummary[]> {
  const { data } = await supabase
    .from('class_performance_summary')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('average_score', { ascending: true });
  return (data || []) as ClassPerformanceSummary[];
}

export async function getNationalPerformance(
  country: string
): Promise<{ subject: string; average_score: number; district_count: number; student_count: number }[]> {
  const { data: districts } = await supabase
    .from('organizations')
    .select('id')
    .eq('country', country)
    .eq('type', 'district');

  if (!districts?.length) return [];
  const districtIds = districts.map((d: any) => d.id);

  const { data } = await supabase
    .from('district_performance_summary')
    .select('subject, average_score, student_count, district_id')
    .in('district_id', districtIds);

  if (!data?.length) return [];

  const bySubject: Record<string, { scores: number[]; students: number; districts: Set<string> }> = {};
  data.forEach((row: any) => {
    if (!bySubject[row.subject]) bySubject[row.subject] = { scores: [], students: 0, districts: new Set() };
    bySubject[row.subject].scores.push(row.average_score);
    bySubject[row.subject].students += row.student_count || 0;
    bySubject[row.subject].districts.add(row.district_id);
  });

  return Object.entries(bySubject).map(([subject, val]) => ({
    subject,
    average_score: Math.round((val.scores.reduce((a, b) => a + b, 0) / val.scores.length) * 100) / 100,
    district_count: val.districts.size,
    student_count: val.students,
  })).sort((a, b) => a.average_score - b.average_score);
}
