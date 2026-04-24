import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Globe2, Building2, Users, FileText, TrendingUp, Bell, BarChart3,
  Loader2, ChevronRight, AlertTriangle, BookOpen, Flame
} from 'lucide-react';
import { getChildOrganizations, getOrganizationStats, Organization } from '@/services/organizationService';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend
} from 'recharts';

interface MinistryDashboardProps {
  organization: Organization;
  onDrillDown?: (org: Organization) => void;
}

const MinistryDashboard: React.FC<MinistryDashboardProps> = ({ organization, onDrillDown }) => {
  const [districts, setDistricts] = useState<Array<Organization & { stats: any }>>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [subjectData, setSubjectData] = useState<{ subject: string; count: number }[]>([]);
  const [weeklyData, setWeeklyData] = useState<{ week: string; lessons: number }[]>([]);
  const [totals, setTotals] = useState({ districts: 0, schools: 0, teachers: 0, lessons: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'districts' | 'alerts'>('overview');

  useEffect(() => {
    loadData();
  }, [organization.id]);

  const loadData = async () => {
    setLoading(true);

    // Load districts under this ministry
    const districtOrgs = await getChildOrganizations(organization.id);

    const districtStats = await Promise.all(
      districtOrgs.map(async (d) => {
        const stats = await getOrganizationStats(d.id);
        return { ...d, stats };
      })
    );
    setDistricts(districtStats);

    // Collect all school IDs under this ministry via districts
    const allSchoolIds: string[] = [];
    await Promise.all(
      districtOrgs.map(async (d) => {
        const schools = await getChildOrganizations(d.id);
        allSchoolIds.push(...schools.map(s => s.id));
      })
    );

    // Lesson analytics
    const { data: lessons } = await supabase
      .from('lesson_notes')
      .select('subject, created_at')
      .eq('country', organization.country)
      .order('created_at', { ascending: false })
      .limit(500);

    if (lessons?.length) {
      // Subject breakdown
      const freq: Record<string, number> = {};
      lessons.forEach((l: any) => { freq[l.subject] = (freq[l.subject] || 0) + 1; });
      setSubjectData(
        Object.entries(freq).map(([subject, count]) => ({ subject, count }))
          .sort((a, b) => b.count - a.count).slice(0, 8)
      );

      // Weekly activity (last 8 weeks)
      const now = Date.now();
      const weekly = Array.from({ length: 8 }, (_, i) => {
        const start = now - (8 - i) * 7 * 24 * 3600 * 1000;
        const end = start + 7 * 24 * 3600 * 1000;
        return {
          week: `W${i + 1}`,
          lessons: lessons.filter(l => {
            const t = new Date((l as any).created_at).getTime();
            return t >= start && t < end;
          }).length,
        };
      });
      setWeeklyData(weekly);
    }

    // Alerts for this country
    const { data: alertsData } = await supabase
      .from('alerts')
      .select('*')
      .eq('country', organization.country)
      .order('created_at', { ascending: false })
      .limit(20);
    setAlerts(alertsData || []);

    // Totals
    const countryMembersRes = await supabase
      .from('organization_members')
      .select('id', { count: 'exact', head: true });

    setTotals({
      districts: districtOrgs.length,
      schools: districtStats.reduce((s, d) => s + d.stats.childCount, 0),
      teachers: districtStats.reduce((s, d) => s + d.stats.memberCount, 0),
      lessons: lessons?.length || 0,
    });

    setLoading(false);
  };

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: BarChart3 },
    { id: 'districts' as const, label: 'Districts', icon: Building2 },
    { id: 'alerts' as const, label: `Alerts${alerts.length ? ` (${alerts.length})` : ''}`, icon: Bell },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Ministry header */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
            <Globe2 className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{organization.name}</h2>
            <p className="text-blue-300 text-sm">{organization.country} · Ministry Dashboard</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Districts', value: totals.districts, icon: Building2 },
            { label: 'Schools', value: totals.schools, icon: BookOpen },
            { label: 'Teachers', value: totals.teachers, icon: Users },
            { label: 'Lessons (Country)', value: totals.lessons, icon: FileText },
          ].map((s, i) => (
            <div key={i} className="bg-white/10 rounded-xl p-4 text-center">
              <s.icon className="w-5 h-5 mx-auto mb-1 opacity-80" />
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs text-blue-200">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-1.5 flex gap-1 overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50'
            }`}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Subject hotspots */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" /> Subject Demand Hotspots
            </h3>
            {subjectData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={subjectData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="subject" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-gray-400 text-sm py-10">No lesson data for {organization.country} yet.</p>
            )}
          </div>

          {/* Weekly adoption trend */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" /> Teacher Adoption Trend (8 weeks)
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="lessons" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} name="Lessons Generated" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Districts */}
      {activeTab === 'districts' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-bold text-gray-900 mb-4">District Performance</h3>
          {districts.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No districts linked to this ministry yet.</p>
          ) : (
            <div className="space-y-3">
              {districts.sort((a, b) => b.stats.lessonCount - a.stats.lessonCount).map((d) => (
                <button key={d.id} onClick={() => onDrillDown?.(d)}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-blue-50 rounded-xl transition-all text-left group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{d.name}</p>
                      <p className="text-xs text-gray-400">{d.stats.memberCount} teachers · {d.stats.childCount} schools</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-bold text-blue-600">{d.stats.lessonCount}</div>
                      <div className="text-xs text-gray-400">lessons</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Alerts */}
      {activeTab === 'alerts' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-bold text-gray-900 mb-4">Policy Alerts & Curriculum Changes</h3>
          {alerts.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No alerts for {organization.country}.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert: any) => (
                <div key={alert.id} className={`p-4 rounded-xl border ${
                  alert.severity === 'high' ? 'bg-red-50 border-red-200'
                  : alert.severity === 'medium' ? 'bg-amber-50 border-amber-200'
                  : 'bg-blue-50 border-blue-200'
                }`}>
                  <div className="flex items-start gap-3">
                    <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                      alert.severity === 'high' ? 'text-red-500'
                      : alert.severity === 'medium' ? 'text-amber-500'
                      : 'text-blue-500'
                    }`} />
                    <div className="flex-1">
                      <p className="text-sm text-gray-800">{alert.message}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(alert.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                      alert.severity === 'high' ? 'bg-red-100 text-red-700'
                      : alert.severity === 'medium' ? 'bg-amber-100 text-amber-700'
                      : 'bg-blue-100 text-blue-700'
                    }`}>{alert.severity}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MinistryDashboard;
