import { syncCountryAgent } from '../services/syncCountryAgent';
import { detectTrends } from '../services/trendDetection';
import { supabase } from '../lib/supabaseClient';

const COUNTRY = 'Cameroon';

export const cameroonAgent = {
  country: COUNTRY,
  curriculum: 'Cameroon National Curriculum (Anglophone & Francophone systems)',
  examBodies: ['GCE Board', 'MINESEC', 'OBC'],
  levels: ['Nursery 1-2', 'Class 1-6'],

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
