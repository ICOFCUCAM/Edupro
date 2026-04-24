import React, { useEffect, useState } from 'react';
import { Globe, RefreshCw, TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { runCountrySync } from '../../workers/cronSyncWorker';
import AgentCard from '../../components/AgentCard';
import AlertsPanel from '../../components/AlertsPanel';

interface CountryAgent {
  id: string;
  country: string;
  status: 'active' | 'learning' | 'syncing' | 'idle' | 'error';
  last_sync: string | null;
  knowledge_items_count: number;
  alerts_count: number;
}

const CountryAgentsPage: React.FC = () => {
  const [agents, setAgents] = useState<CountryAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingCountry, setSyncingCountry] = useState<string | null>(null);

  const fetchAgents = async () => {
    const { data } = await supabase.from('country_agents').select('*').order('country');
    setAgents((data as CountryAgent[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAgents(); }, []);

  const handleSync = async (country: string) => {
    setSyncingCountry(country);
    try {
      await runCountrySync(country);
      await fetchAgents();
    } finally {
      setSyncingCountry(null);
    }
  };

  const totalKnowledge = agents.reduce((s, a) => s + (a.knowledge_items_count ?? 0), 0);
  const activeAgents = agents.filter((a) => a.status === 'active').length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-blue-700 to-blue-900 text-white py-10 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Globe className="w-8 h-8" />
            <h1 className="text-3xl font-bold">Country AI Agents</h1>
          </div>
          <p className="text-blue-200">Autonomous intelligence nodes monitoring education across Africa</p>
          <div className="grid grid-cols-3 gap-4 mt-6 max-w-lg">
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold">{agents.length}</div>
              <div className="text-xs text-blue-200">Countries</div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold">{activeAgents}</div>
              <div className="text-xs text-blue-200">Active</div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold">{totalKnowledge}</div>
              <div className="text-xs text-blue-200">Knowledge Items</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" /> Agent Network
              </h2>
              <button onClick={fetchAgents} className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800">
                <RefreshCw className="w-4 h-4" /> Refresh
              </button>
            </div>
            {loading ? (
              <div className="grid sm:grid-cols-2 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse h-40" />
                ))}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {agents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    country={agent.country}
                    status={agent.status}
                    lastSync={agent.last_sync ?? undefined}
                    knowledgeItemsCount={agent.knowledge_items_count}
                    alertsCount={agent.alerts_count}
                    onSync={() => handleSync(agent.country)}
                    syncing={syncingCountry === agent.country}
                  />
                ))}
              </div>
            )}
          </div>
          <div>
            <AlertsPanel />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CountryAgentsPage;
