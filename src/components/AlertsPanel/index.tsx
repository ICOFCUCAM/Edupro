import React, { useEffect, useState } from 'react';
import { Bell, X, AlertTriangle, Info, Zap, AlertCircle } from 'lucide-react';
import { getAlerts, markRead } from '../../services/alertEngine';

interface Alert {
  id: string;
  country: string;
  message: string;
  severity: 'info' | 'important' | 'urgent' | 'critical';
  source?: string;
  read_status: boolean;
  created_at: string;
}

interface AlertsPanelProps {
  country?: string;
}

const SEVERITY_CONFIG = {
  info:      { color: 'bg-blue-50 border-blue-200 text-blue-800',     icon: Info,          badge: 'bg-blue-100 text-blue-700' },
  important: { color: 'bg-yellow-50 border-yellow-200 text-yellow-800', icon: AlertCircle, badge: 'bg-yellow-100 text-yellow-700' },
  urgent:    { color: 'bg-orange-50 border-orange-200 text-orange-800', icon: AlertTriangle, badge: 'bg-orange-100 text-orange-700' },
  critical:  { color: 'bg-red-50 border-red-200 text-red-800',        icon: Zap,           badge: 'bg-red-100 text-red-700' },
};

const AlertsPanel: React.FC<AlertsPanelProps> = ({ country }) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAlerts(country, false)
      .then((data) => setAlerts(data as Alert[]))
      .finally(() => setLoading(false));
  }, [country]);

  const dismiss = async (id: string) => {
    await markRead(id);
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, read_status: true } : a));
  };

  const unread = alerts.filter((a) => !a.read_status);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-gray-700" />
          <h3 className="font-semibold text-gray-900">Alerts</h3>
          {unread.length > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{unread.length}</span>
          )}
        </div>
        {country && <span className="text-xs text-gray-400">{country}</span>}
      </div>

      <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
        {loading ? (
          <div className="py-8 text-center text-gray-400 text-sm">Loading alerts...</div>
        ) : alerts.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-sm">No alerts</div>
        ) : (
          alerts.map((alert) => {
            const cfg = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.info;
            const Icon = cfg.icon;
            return (
              <div key={alert.id} className={`flex items-start gap-3 px-5 py-4 border-l-4 ${cfg.color} ${alert.read_status ? 'opacity-50' : ''}`}>
                <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badge}`}>
                      {alert.severity.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-400">{alert.country}</span>
                  </div>
                  <p className="text-sm leading-snug">{alert.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(alert.created_at).toLocaleDateString()}</p>
                </div>
                {!alert.read_status && (
                  <button onClick={() => dismiss(alert.id)} className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AlertsPanel;
