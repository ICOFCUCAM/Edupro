import { supabase } from '@/lib/supabase';
import type { StudentResult } from './performanceService';

export interface Student {
  id: string;
  organization_id: string;
  teacher_id?: string;
  first_name: string;
  last_name: string;
  student_identifier?: string;
  class_level: string;
  gender?: 'male' | 'female' | 'other';
  created_at: string;
}

export interface BulkStudentInput {
  first_name: string;
  last_name: string;
  student_identifier?: string;
  gender?: 'male' | 'female' | 'other';
}

export async function getStudents(
  organizationId: string,
  classLevel?: string
): Promise<Student[]> {
  let q = supabase
    .from('students')
    .select('*')
    .eq('organization_id', organizationId)
    .order('last_name', { ascending: true });
  if (classLevel) q = q.eq('class_level', classLevel);
  const { data } = await q;
  return (data || []) as Student[];
}

export async function addStudent(
  organizationId: string,
  classLevel: string,
  firstName: string,
  lastName: string,
  teacherId?: string,
  studentIdentifier?: string,
  gender?: 'male' | 'female' | 'other'
): Promise<{ success: boolean; student?: Student; error?: string }> {
  const { data, error } = await supabase
    .from('students')
    .insert({
      organization_id: organizationId,
      teacher_id: teacherId,
      class_level: classLevel,
      first_name: firstName,
      last_name: lastName,
      student_identifier: studentIdentifier || null,
      gender: gender || null,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, student: data as Student };
}

export async function bulkAddStudents(
  organizationId: string,
  classLevel: string,
  students: BulkStudentInput[],
  teacherId?: string
): Promise<{ success: boolean; count: number; errors: string[] }> {
  const rows = students.map((s) => ({
    organization_id: organizationId,
    teacher_id: teacherId || null,
    class_level: classLevel,
    first_name: s.first_name,
    last_name: s.last_name,
    student_identifier: s.student_identifier || null,
    gender: s.gender || null,
  }));

  const { data, error } = await supabase
    .from('students')
    .upsert(rows, { onConflict: 'organization_id,student_identifier', ignoreDuplicates: true })
    .select('id');

  if (error) return { success: false, count: 0, errors: [error.message] };
  return { success: true, count: data?.length || 0, errors: [] };
}

export async function deleteStudent(studentId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('students').delete().eq('id', studentId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function getStudentResults(
  studentId: string,
  limit = 20
): Promise<(StudentResult & { assessment_title: string; subject: string })[]> {
  const { data } = await supabase
    .from('student_results')
    .select('*, assessment_packages(title, subject)')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data || []).map((r: any) => ({
    ...r,
    assessment_title: r.assessment_packages?.title ?? 'Unknown Assessment',
    subject: r.assessment_packages?.subject ?? '',
  }));
}

export async function getClassResultsForAssessment(
  assessmentPackageId: string,
  organizationId: string
): Promise<(StudentResult & { student_name: string })[]> {
  const { data } = await supabase
    .from('student_results')
    .select('*, students(first_name, last_name)')
    .eq('assessment_package_id', assessmentPackageId)
    .eq('organization_id', organizationId)
    .order('percentage', { ascending: false });

  return (data || []).map((r: any) => ({
    ...r,
    student_name: r.students
      ? `${r.students.first_name} ${r.students.last_name}`
      : 'Unknown Student',
  }));
}

// Parse CSV/TSV text into bulk student rows
export function parseStudentCSV(text: string): BulkStudentInput[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const results: BulkStudentInput[] = [];
  for (const line of lines) {
    const parts = line.split(/[,\t]/).map((p) => p.trim().replace(/^"|"$/g, ''));
    const [firstName, lastName, studentIdentifier, gender] = parts;
    if (firstName && lastName) {
      results.push({
        first_name: firstName,
        last_name: lastName,
        student_identifier: studentIdentifier || undefined,
        gender: (['male', 'female', 'other'].includes(gender?.toLowerCase())
          ? gender.toLowerCase()
          : undefined) as 'male' | 'female' | 'other' | undefined,
      });
    }
  }
  return results;
}
