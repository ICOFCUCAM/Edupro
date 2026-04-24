import { supabase } from '@/lib/supabase';

export type OrgType = 'ministry' | 'district' | 'school' | 'ngo' | 'training_center';
export type OrgRole = 'teacher' | 'school_admin' | 'district_admin' | 'ministry_admin';
export type LessonVisibility = 'private' | 'school_only' | 'general';

export interface Organization {
  id: string;
  name: string;
  country: string;
  type: OrgType;
  parent_id: string | null;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  created_at: string;
  profiles?: { full_name: string; email: string; country: string; subscription_plan: string };
}

export interface OrgSubscription {
  id: string;
  organization_id: string;
  plan_id: string;
  seat_count: number;
  status: string;
  price_usd: number | null;
  billing_cycle: string;
  payment_method: string | null;
  activated_at: string;
  expires_at: string | null;
}

// ── Organizations ─────────────────────────────────────────

export async function createOrganization(data: Omit<Organization, 'id' | 'created_at'>): Promise<Organization | null> {
  const { data: org, error } = await supabase.from('organizations').insert(data).select().single();
  if (error) { console.error('createOrganization:', error); return null; }
  return org;
}

export async function getOrganizationsByCountry(country: string): Promise<Organization[]> {
  const { data, error } = await supabase
    .from('organizations').select('*').eq('country', country).order('type').order('name');
  if (error) return [];
  return data || [];
}

export async function getOrganizationById(id: string): Promise<Organization | null> {
  const { data, error } = await supabase.from('organizations').select('*').eq('id', id).single();
  if (error) return null;
  return data;
}

export async function getChildOrganizations(parentId: string): Promise<Organization[]> {
  const { data, error } = await supabase
    .from('organizations').select('*').eq('parent_id', parentId).order('name');
  if (error) return [];
  return data || [];
}

export async function getUserOrganizations(userId: string): Promise<Array<Organization & { role: OrgRole }>> {
  const { data, error } = await supabase
    .from('organization_members')
    .select('role, organizations(*)')
    .eq('user_id', userId);
  if (error) return [];
  return (data || []).map((m: any) => ({ ...m.organizations, role: m.role }));
}

export async function addMember(organizationId: string, userId: string, role: OrgRole): Promise<boolean> {
  const { error } = await supabase
    .from('organization_members')
    .insert({ organization_id: organizationId, user_id: userId, role });
  return !error;
}

export async function getOrganizationMembers(organizationId: string): Promise<OrganizationMember[]> {
  const { data, error } = await supabase
    .from('organization_members')
    .select('*, teachers(full_name, email, country, subscription_plan, lesson_count, last_login)')
    .eq('organization_id', organizationId);
  if (error) return [];
  return (data || []).map((m: any) => ({
    ...m,
    profiles: m.teachers,
  }));
}

export async function getOrganizationStats(organizationId: string) {
  const [membersRes, lessonsRes, knowledgeRes, childrenRes] = await Promise.all([
    supabase.from('organization_members').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
    supabase.from('lesson_notes').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
    supabase.from('school_knowledge_items').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
    supabase.from('organizations').select('id', { count: 'exact', head: true }).eq('parent_id', organizationId),
  ]);
  return {
    memberCount: membersRes.count || 0,
    lessonCount: lessonsRes.count || 0,
    knowledgeCount: knowledgeRes.count || 0,
    childCount: childrenRes.count || 0,
  };
}

// ── School Lessons ────────────────────────────────────────

export async function getSchoolLessons(
  organizationId: string,
  visibility?: LessonVisibility
): Promise<any[]> {
  let query = supabase
    .from('lesson_notes')
    .select('id, title, subject, topic, level, language, visibility, created_at, teacher_id, lesson_alignment_scores(alignment_score, alignment_level)')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (visibility) query = query.eq('visibility', visibility);

  const { data, error } = await query;
  if (error) return [];

  return (data || []).map((l: any) => ({
    ...l,
    alignment_score: l.lesson_alignment_scores?.[0]?.alignment_score,
    alignment_level: l.lesson_alignment_scores?.[0]?.alignment_level,
    lesson_alignment_scores: undefined,
  }));
}

// ── Teacher Analytics ─────────────────────────────────────

export interface TeacherLessonStat {
  teacher_id: string;
  full_name: string;
  email: string;
  lesson_count: number;
  last_lesson_at: string | null;
  subjects: string[];
}

export async function getTeacherLessonStats(organizationId: string): Promise<TeacherLessonStat[]> {
  // Get members of this org
  const membersRes = await supabase
    .from('organization_members')
    .select('user_id, teachers(id, full_name, email, lesson_count, last_login)')
    .eq('organization_id', organizationId)
    .eq('role', 'teacher');

  if (membersRes.error || !membersRes.data?.length) return [];

  // Get lessons per teacher for this org
  const teacherIds = membersRes.data.map((m: any) => m.user_id);
  const { data: lessons } = await supabase
    .from('lesson_notes')
    .select('teacher_id, subject, created_at')
    .in('teacher_id', teacherIds)
    .eq('organization_id', organizationId);

  return membersRes.data.map((m: any): TeacherLessonStat => {
    const teacher = m.teachers;
    const teacherLessons = (lessons || []).filter((l: any) => l.teacher_id === m.user_id);
    const subjects = [...new Set(teacherLessons.map((l: any) => l.subject))] as string[];
    const lastLesson = teacherLessons
      .map((l: any) => l.created_at)
      .sort()
      .pop() || null;
    return {
      teacher_id: m.user_id,
      full_name: teacher?.full_name || 'Unknown',
      email: teacher?.email || '',
      lesson_count: teacherLessons.length,
      last_lesson_at: lastLesson,
      subjects,
    };
  }).sort((a, b) => b.lesson_count - a.lesson_count);
}

// ── School Knowledge ──────────────────────────────────────

export async function getSchoolKnowledgeItems(organizationId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('school_knowledge_items')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return data || [];
}

export async function addSchoolKnowledgeItem(item: {
  organization_id: string;
  title: string;
  summary?: string;
  content?: string;
  tags?: string[];
  content_type?: string;
  file_url?: string;
  created_by: string;
}): Promise<any | null> {
  const { data, error } = await supabase
    .from('school_knowledge_items').insert(item).select().single();
  if (error) { console.error('addSchoolKnowledgeItem:', error); return null; }
  return data;
}

export async function uploadSchemeOfWork(
  organizationId: string,
  file: File,
  teacherId: string
): Promise<{ url: string; item: any } | null> {
  const ext = file.name.split('.').pop();
  const path = `${organizationId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  const { error: uploadErr } = await supabase.storage
    .from('scheme-of-work')
    .upload(path, file, { upsert: false });

  if (uploadErr) { console.error('uploadSchemeOfWork:', uploadErr); return null; }

  const { data: { publicUrl } } = supabase.storage
    .from('scheme-of-work')
    .getPublicUrl(path);

  const item = await addSchoolKnowledgeItem({
    organization_id: organizationId,
    title: file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '),
    summary: `Uploaded document: ${file.name}`,
    content_type: 'scheme_of_work',
    file_url: publicUrl,
    tags: ['scheme-of-work', ext || 'document'],
    created_by: teacherId,
  });

  return item ? { url: publicUrl, item } : null;
}

// ── Org Subscriptions ─────────────────────────────────────

export async function getOrgSubscription(organizationId: string): Promise<OrgSubscription | null> {
  const { data, error } = await supabase
    .from('org_subscriptions')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .order('activated_at', { ascending: false })
    .limit(1)
    .single();
  if (error) return null;
  return data;
}

export async function createOrgSubscription(sub: Omit<OrgSubscription, 'id' | 'activated_at'>): Promise<OrgSubscription | null> {
  const { data, error } = await supabase
    .from('org_subscriptions').insert(sub).select().single();
  if (error) { console.error('createOrgSubscription:', error); return null; }
  return data;
}

// ── Aggregate helpers for district/ministry analytics ─────

export async function getOrgLessonStats(organizationIds: string[]): Promise<any[]> {
  if (!organizationIds.length) return [];
  const { data, error } = await supabase
    .from('lesson_notes')
    .select('organization_id, subject, created_at')
    .in('organization_id', organizationIds);
  if (error) return [];
  return data || [];
}

export async function getCountryMinistries(country: string): Promise<Organization[]> {
  const { data, error } = await supabase
    .from('organizations').select('*').eq('country', country).eq('type', 'ministry');
  if (error) return [];
  return data || [];
}
