import { supabase } from '@/lib/supabase';

export type OrgRole = 'teacher' | 'school_admin' | 'district_admin' | 'ministry_admin';

const ROLE_LEVEL: Record<OrgRole, number> = {
  teacher: 1,
  school_admin: 2,
  district_admin: 3,
  ministry_admin: 4,
};

export function roleAtLeast(userRole: OrgRole, required: OrgRole): boolean {
  return ROLE_LEVEL[userRole] >= ROLE_LEVEL[required];
}

export async function getUserOrgRole(userId: string, orgId: string): Promise<OrgRole | null> {
  const { data, error } = await supabase
    .from('organization_members')
    .select('role')
    .eq('user_id', userId)
    .eq('organization_id', orgId)
    .single();
  if (error || !data) return null;
  return data.role as OrgRole;
}

// Recursively checks role in org hierarchy: if user is admin of a parent, they have access to children
export async function checkOrganizationAccess(
  userId: string,
  orgId: string,
  requiredRole: OrgRole,
  depth = 0
): Promise<boolean> {
  if (depth > 4) return false; // prevent infinite recursion

  const role = await getUserOrgRole(userId, orgId);
  if (role && roleAtLeast(role, requiredRole)) return true;

  const { data: org } = await supabase
    .from('organizations')
    .select('parent_id')
    .eq('id', orgId)
    .single();

  if (org?.parent_id) {
    return checkOrganizationAccess(userId, org.parent_id, requiredRole, depth + 1);
  }

  return false;
}

export async function getUserHighestRole(userId: string): Promise<OrgRole | null> {
  const { data, error } = await supabase
    .from('organization_members')
    .select('role')
    .eq('user_id', userId);
  if (error || !data?.length) return null;
  return (data as { role: OrgRole }[]).reduce<OrgRole | null>((highest, row) => {
    if (!highest) return row.role;
    return ROLE_LEVEL[row.role] > ROLE_LEVEL[highest] ? row.role : highest;
  }, null);
}

export async function getUserAllRoles(userId: string): Promise<Array<{ orgId: string; role: OrgRole }>> {
  const { data, error } = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', userId);
  if (error) return [];
  return (data || []).map(d => ({ orgId: d.organization_id, role: d.role as OrgRole }));
}
