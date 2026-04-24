import { supabase } from '../lib/supabaseClient';
import { createAlert } from '../services/alertEngine';

export async function checkAndGenerateAlerts(): Promise<void> {
  // Check for critical knowledge items added in last 24 hours
  const since = new Date(Date.now() - 86400000).toISOString();

  const { data: criticalItems } = await supabase
    .from('knowledge_items')
    .select('country, title, impact_level')
    .eq('impact_level', 'critical')
    .gte('created_at', since);

  for (const item of criticalItems ?? []) {
    await createAlert(
      item.country,
      `Critical update: ${item.title}`,
      'critical',
      'knowledge_engine'
    );
  }

  // Check for high-impact trends
  const { data: trends } = await supabase
    .from('education_trends')
    .select('country, description, impact_score')
    .gte('impact_score', 80)
    .gte('created_at', since);

  for (const trend of trends ?? []) {
    await createAlert(
      trend.country,
      `High-impact trend detected: ${trend.description}`,
      'urgent',
      'trend_engine'
    );
  }
}
