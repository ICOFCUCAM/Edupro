import { supabase } from '../lib/supabaseClient';

export type AlertSeverity = 'info' | 'important' | 'urgent' | 'critical';

export async function createAlert(
  country: string,
  message: string,
  severity: AlertSeverity,
  source?: string
): Promise<void> {
  const { error } = await supabase.from('alerts').insert({ country, message, severity, source });
  if (error) throw error;

  // Increment alert count on country agent
  const { data: agent } = await supabase
    .from('country_agents')
    .select('alerts_count')
    .eq('country', country)
    .single();

  if (agent) {
    await supabase
      .from('country_agents')
      .update({ alerts_count: (agent.alerts_count ?? 0) + 1 })
      .eq('country', country);
  }
}

export async function getAlerts(country?: string, unreadOnly = false) {
  let query = supabase.from('alerts').select('*').order('created_at', { ascending: false });
  if (country) query = query.eq('country', country);
  if (unreadOnly) query = query.eq('read_status', false);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function markRead(alertId: string): Promise<void> {
  await supabase.from('alerts').update({ read_status: true }).eq('id', alertId);
}
