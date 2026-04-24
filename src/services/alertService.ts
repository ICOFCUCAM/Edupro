import { supabase } from '@/lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CurriculumAlert {
  id:                   string;
  source_country:       string;
  target_country:       string;
  change_type:          'added' | 'updated' | 'removed';
  subject?:             string;
  class_level?:         string;
  objective_id?:        string;
  similar_objective_id?: string;
  similarity_score:     number;
  description?:         string;
  change_log_id?:       string;
  read_by:              Record<string, string>;
  created_at:           string;
}

export interface BroadcastParams {
  sourceCountry: string;
  changeType:    'added' | 'updated' | 'removed';
  subject?:      string;
  classLevel?:   string;
  description?:  string;
  changeLogId?:  string;
}

export interface BroadcastResult {
  alerts_created:     number;
  affected_countries: string[];
  source_country:     string;
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getAlertsForCountry(
  country: string,
  limit = 50,
  since?: string,
): Promise<CurriculumAlert[]> {
  let q = supabase
    .from('curriculum_update_alerts')
    .select('*')
    .eq('target_country', country)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (since) q = q.gte('created_at', since);
  const { data } = await q;
  return (data ?? []) as CurriculumAlert[];
}

export async function getUnreadAlertCount(
  country: string,
  teacherId: string,
): Promise<number> {
  const { data } = await supabase
    .from('curriculum_update_alerts')
    .select('id, read_by')
    .eq('target_country', country)
    .order('created_at', { ascending: false })
    .limit(200);

  return (data ?? []).filter(
    (row: any) => !(row.read_by as Record<string, string>)[teacherId],
  ).length;
}

export async function markAlertsRead(
  alertIds: string[],
  teacherId: string,
): Promise<void> {
  // Fetch current read_by for each alert, then merge
  const { data: rows } = await supabase
    .from('curriculum_update_alerts')
    .select('id, read_by')
    .in('id', alertIds);

  if (!rows?.length) return;

  const now = new Date().toISOString();
  await Promise.all(
    rows.map((row: any) =>
      supabase
        .from('curriculum_update_alerts')
        .update({ read_by: { ...(row.read_by ?? {}), [teacherId]: now } })
        .eq('id', row.id),
    ),
  );
}

// ── Broadcast ─────────────────────────────────────────────────────────────────

export async function broadcastCurriculumUpdate(
  params: BroadcastParams,
): Promise<BroadcastResult> {
  const { data, error } = await supabase.functions.invoke('curriculum-alert-broadcast', {
    body: {
      sourceCountry: params.sourceCountry,
      changeType:    params.changeType,
      subject:       params.subject ?? null,
      classLevel:    params.classLevel ?? null,
      description:   params.description ?? null,
      changeLogId:   params.changeLogId ?? null,
    },
  });
  if (error || !data?.success) throw new Error(error?.message ?? 'Alert broadcast failed');
  return data as BroadcastResult;
}
