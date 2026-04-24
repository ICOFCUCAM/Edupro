import { supabase } from '@/lib/supabase';

export type OrgType = 'ministry' | 'district' | 'school' | 'ngo' | 'training_center';
export type OrgRole = 'teacher' | 'school_admin' | 'district_admin' | 'ministry_admin';

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

export async function createOrganization(data: Omit<Organization, 'id' | 'created_at'>): Promise<Organization | null> {
  const { data: org, error } = await supabase.from('organizations').insert(data).select().single();
  if (error) { console.error('createOrganization:', error); return null; }
  return org;
}

export async function getOrganizationsByCountry(country: string): Promise<Organization[]> {
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('country', country)
    .order('type')
    .order('name');
  if (error) return [];
  return data || [];
}

export async function getOrganizationById(id: string): Promise<Organization | null> {
  const { data, error } = await supabase.from('organizations').select('*').eq('id', id).single();
  if (error) return null;
  return data;
}

export async function getChildOrganizations(parentId: string): Promise<Organization[]> {
  const { data, error } = await supabase.from('organizations').select('*').eq('parent_id', parentId).order('name');
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
    .select('*, profiles(full_name, email, country, subscription_plan)')
    .eq('organization_id', organizationId);
  if (error) return [];
  return data || [];
}

export async function getOrganizationStats(organizationId: string) {
  const [membersRes, lessonsRes, knowledgeRes, childrenRes] = await Promise.all([
    supabase.from('organization_members').select('role', { count: 'exact', head: true }).eq('organization_id', organizationId),
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

export async function getSchoolKnowledgeItems(organizationId: string) {
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
  created_by: string;
}) {
  const { data, error } = await supabase.from('school_knowledge_items').insert(item).select().single();
  if (error) { console.error('addSchoolKnowledgeItem:', error); return null; }
  return data;
}

// Aggregate lesson stats per org — used for district/ministry analytics
export async function getOrgLessonStats(organizationIds: string[]) {
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
    .from('organizations')
    .select('*')
    .eq('country', country)
    .eq('type', 'ministry');
  if (error) return [];
  return data || [];
}
