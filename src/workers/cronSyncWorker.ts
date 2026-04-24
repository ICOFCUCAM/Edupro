import { syncCountryAgent } from '../services/syncCountryAgent';
import { detectTrends } from '../services/trendDetection';

const COUNTRIES = ['Nigeria', 'Ghana', 'Kenya', 'Cameroon', 'Tanzania', 'Uganda', 'Rwanda', 'Ethiopia', 'Senegal', 'DRC', 'South Africa'];

// Called by Supabase cron edge function or manual trigger
export async function runFullSync(): Promise<{ synced: string[]; failed: string[] }> {
  const synced: string[] = [];
  const failed: string[] = [];

  for (const country of COUNTRIES) {
    try {
      await syncCountryAgent(country);
      await detectTrends(country);
      synced.push(country);
    } catch {
      failed.push(country);
    }
  }

  return { synced, failed };
}

export async function runCountrySync(country: string): Promise<void> {
  await syncCountryAgent(country);
  await detectTrends(country);
}
