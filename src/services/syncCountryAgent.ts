import { supabase } from '../lib/supabaseClient';
import { chatCompletion } from '../lib/openaiClient';
import { countryAgentPrompt } from '../prompts/countryAgentPrompt';

export async function syncCountryAgent(country: string): Promise<void> {
  await supabase.from('country_agents').update({ status: 'syncing' }).eq('country', country);

  try {
    const { data: sources } = await supabase
      .from('country_sources')
      .select('*')
      .eq('country', country)
      .eq('active', true);

    const prompt = countryAgentPrompt(country, sources ?? []);
    const result = await chatCompletion([{ role: 'user', content: prompt }]);

    let items: { title: string; summary: string; impact_level: string; type: string; tags: string[] }[] = [];
    try {
      const match = result.match(/```json\s*([\s\S]*?)\s*```/) ?? result.match(/\[[\s\S]*\]/);
      items = JSON.parse(match ? (match[1] ?? match[0]) : result);
    } catch {
      items = [];
    }

    if (items.length > 0) {
      await supabase.from('knowledge_items').insert(
        items.map((item) => ({ ...item, country, source_type: 'ai_generated', confidence_score: 75 }))
      );
    }

    const { count } = await supabase
      .from('knowledge_items')
      .select('*', { count: 'exact', head: true })
      .eq('country', country);

    await supabase.from('country_agents').update({
      status: 'active',
      last_sync: new Date().toISOString(),
      knowledge_items_count: count ?? 0,
    }).eq('country', country);
  } catch {
    await supabase.from('country_agents').update({ status: 'error' }).eq('country', country);
  }
}
