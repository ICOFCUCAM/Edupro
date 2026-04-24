import React from 'react';
import { RefreshCw, AlertCircle, CheckCircle, Loader2, Clock, Brain } from 'lucide-react';

export interface AgentCardProps {
  country: string;
  status: 'active' | 'learning' | 'syncing' | 'idle' | 'error';
  lastSync?: string;
  knowledgeItemsCount: number;
  alertsCount: number;
  onSync?: () => void;
  syncing?: boolean;
}

const STATUS_CONFIG = {
  active:   { color: 'text-emerald-600 bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500', icon: CheckCircle },
  learning: { color: 'text-blue-600 bg-blue-50 border-blue-200',         dot: 'bg-blue-500 animate-pulse', icon: Brain },
  syncing:  { color: 'text-yellow-600 bg-yellow-50 border-yellow-200',   dot: 'bg-yellow-500 animate-pulse', icon: Loader2 },
  idle:     { color: 'text-gray-500 bg-gray-50 border-gray-200',         dot: 'bg-gray-400', icon: Clock },
  error:    { color: 'text-red-600 bg-red-50 border-red-200',            dot: 'bg-red-500', icon: AlertCircle },
};

const AgentCard: React.FC<AgentCardProps> = ({
  country, status, lastSync, knowledgeItemsCount, alertsCount, onSync, syncing,
}) => {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.idle;
  const StatusIcon = cfg.icon;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-bold text-gray-900 text-base">{country}</h3>
          <div className={`inline-flex items-center gap-1.5 mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            <StatusIcon className="w-3 h-3" />
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </div>
        </div>
        <button
          onClick={onSync}
          disabled={syncing || status === 'syncing'}
          className="p-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-50 transition-colors"
          title="Sync agent"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-blue-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-blue-700">{knowledgeItemsCount}</div>
          <div className="text-xs text-blue-500 mt-0.5">Knowledge Items</div>
        </div>
        <div className="bg-orange-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-orange-600">{alertsCount}</div>
          <div className="text-xs text-orange-500 mt-0.5">Alerts</div>
        </div>
      </div>

      {lastSync && (
        <p className="text-xs text-gray-400 mt-3">
          Last sync: {new Date(lastSync).toLocaleDateString()}
        </p>
      )}
    </div>
  );
};

export default AgentCard;
