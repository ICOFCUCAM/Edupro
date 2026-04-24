import { syncCountryAgent } from '../services/syncCountryAgent';
import { detectTrends } from '../services/trendDetection';
import { supabase } from '../lib/supabaseClient';

const COUNTRY = 'Ghana';

export const ghanaAgent = {
  country: COUNTRY,
  curriculum: 'NaCCA (National Council for Curriculum and Assessment)',
  examBodies: ['WAEC', 'BECE', 'GES'],
  levels: ['KG1-KG2', 'Primary 1-6'],

  async sync() {
    return syncCountryAgent(COUNTRY);
  },

  async detectTrends() {
    return detectTrends(COUNTRY);
  },

  async getStatus() {
    const { data } = await supabase
      .from('country_agents')
      .select('*')
      .eq('country', COUNTRY)
      .single();
    return data;
  },

  async getKnowledgeItems(limit = 10) {
    const { data } = await supabase
      .from('knowledge_items')
      .select('*')
      .eq('country', COUNTRY)
      .order('created_at', { ascending: false })
      .limit(limit);
    return data ?? [];
  },
};
