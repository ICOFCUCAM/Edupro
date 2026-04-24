import { supabase } from '@/lib/supabase';
import type { MasteryLevel } from './performanceService';

export interface RemediationPackage {
  lesson: {
    title: string;
    explanation: string;
    key_points: string[];
  };
  exercises: { question: string; answer: string; hint: string }[];
  quiz: {
    question: string;
    options: string[];
    correct: string;
    explanation: string;
  }[];
}

export interface SavedRemediation {
  id: string;
  title: string;
  topic: string;
  subject: string;
  class_level: string;
  content: RemediationPackage;
  remediation_for_objective: string;
  remediation_level: string;
  created_at: string;
}

export async function generateRemediation(
  objective: { id: string; learning_objective: string; topic?: string; country: string; subject: string; class_level?: string },
  masteryLevel: 'not_started' | 'developing',
  teacherId: string,
  language = 'en',
  organizationId?: string
): Promise<{ success: boolean; packageId?: string; error?: string }> {
  try {
    const { data: fnData, error: fnError } = await supabase.functions.invoke('generate-remediation', {
      body: {
        objective: objective.learning_objective,
        topic: objective.topic,
        country: objective.country,
        subject: objective.subject,
        classLevel: objective.class_level,
        masteryLevel,
        language,
      },
    });

    if (fnError || !fnData?.success) {
      return { success: false, error: fnError?.message || fnData?.error || 'Generation failed' };
    }

    const rem: RemediationPackage = fnData.remediation;
    const title = rem.lesson?.title || `Remediation: ${objective.learning_objective.slice(0, 60)}`;

    const { data: pkg, error: saveError } = await supabase
      .from('assessment_packages')
      .insert({
        teacher_id: teacherId,
        organization_id: organizationId || null,
        country: objective.country,
        subject: objective.subject,
        class_level: objective.class_level || '',
        topic: objective.topic || objective.subject,
        package_type: 'remediation',
        difficulty: masteryLevel === 'not_started' ? 'easy' : 'medium',
        language,
        title,
        content: rem,
        question_count: (rem.exercises?.length || 0) + (rem.quiz?.length || 0),
        total_marks: rem.quiz?.length || 5,
        auto_generated: true,
        trigger_type: 'manual',
        source_objective_id: objective.id,
        remediation_for_objective: objective.id,
        remediation_level: masteryLevel,
      })
      .select('id')
      .single();

    if (saveError) return { success: false, error: saveError.message };
    return { success: true, packageId: pkg.id };

  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getRemediationsForObjective(
  objectiveId: string
): Promise<SavedRemediation[]> {
  const { data } = await supabase
    .from('assessment_packages')
    .select('id, title, topic, subject, class_level, content, remediation_for_objective, remediation_level, created_at')
    .eq('remediation_for_objective', objectiveId)
    .order('created_at', { ascending: false });

  return (data || []) as SavedRemediation[];
}
