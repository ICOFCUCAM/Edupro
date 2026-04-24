import React, { useEffect, useState } from 'react';
import { Search, Filter, Brain } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { semanticSearch } from '../../lib/embeddingService';
import KnowledgeCard from '../../components/KnowledgeCard';
import AssistantChat from '../../components/AssistantChat';

interface KnowledgeItem {
  id: string;
  country: string;
  type: string;
  title: string;
  summary: string;
  impact_level: 'low' | 'medium' | 'high' | 'critical';
  tags: string[];
  source_url?: string;
  confidence_score?: number;
  created_at: string;
}

const COUNTRIES = ['All', 'Nigeria', 'Ghana', 'Kenya', 'Cameroon', 'Tanzania', 'Uganda', 'Rwanda', 'South Africa'];
const IMPACT_LEVELS = ['All', 'low', 'medium', 'high', 'critical'];

const KnowledgeBasePage: React.FC<{ country?: string }> = ({ country: defaultCountry }) => {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCountry, setFilterCountry] = useState(defaultCountry ?? 'All');
  const [filterImpact, setFilterImpact] = useState('All');
  const [searching, setSearching] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    let query = supabase.from('knowledge_items').select('*').order('created_at', { ascending: false }).limit(50);
    if (filterCountry !== 'All') query = query.eq('country', filterCountry);
    if (filterImpact !== 'All') query = query.eq('impact_level', filterImpact);
    const { data } = await query;
    setItems((data as KnowledgeItem[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, [filterCountry, filterImpact]);

  const handleSemanticSearch = async () => {
    if (!search.trim()) { fetchItems(); return; }
    setSearching(true);
    try {
      const results = await semanticSearch(search, 0.6, 10);
      if (results.length > 0) {
        const ids = results.map((r) => r.id);
        const { data } = await supabase.from('knowledge_items').select('*').in('id', ids);
        setItems((data as KnowledgeItem[]) ?? []);
      }
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-purple-700 to-blue-800 text-white py-10 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-2"><Brain className="w-8 h-8" /><h1 className="text-3xl font-bold">Knowledge Base</h1></div>
          <p className="text-purple-200">AI-curated curriculum intelligence across Africa</p>
          <div className="mt-4 flex gap-2 max-w-xl">
            <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSemanticSearch()}
              placeholder="Semantic search — ask anything..." className="flex-1 px-4 py-2.5 rounded-xl text-gray-900 text-sm outline-none" />
            <button onClick={handleSemanticSearch} disabled={searching}
              className="px-4 py-2.5 bg-white/20 hover:bg-white/30 rounded-xl transition-all">
              <Search className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-5 flex-wrap">
              <Filter className="w-4 h-4 text-gray-400" />
              <select value={filterCountry} onChange={(e) => setFilterCountry(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white outline-none">
                {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <select value={filterImpact} onChange={(e) => setFilterImpact(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white outline-none">
                {IMPACT_LEVELS.map((l) => <option key={l}>{l === 'All' ? 'All Impact' : l}</option>)}
              </select>
              <span className="text-sm text-gray-400 ml-auto">{items.length} items</span>
            </div>

            {loading ? (
              <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="bg-white rounded-2xl h-36 animate-pulse border border-gray-100" />)}</div>
            ) : items.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Brain className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No knowledge items yet. Sync a country agent to populate.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item) => (
                  <KnowledgeCard key={item.id} id={item.id} country={item.country} type={item.type}
                    title={item.title} summary={item.summary} impactLevel={item.impact_level}
                    tags={item.tags} sourceUrl={item.source_url} confidenceScore={item.confidence_score}
                    createdAt={item.created_at} />
                ))}
              </div>
            )}
          </div>
          <div>
            <AssistantChat country={filterCountry !== 'All' ? filterCountry : 'Africa'} subject="Curriculum" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBasePage;
