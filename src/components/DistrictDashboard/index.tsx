import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Building2, Users, FileText, TrendingUp, Loader2, BarChart3, MapPin,
  Target, AlertTriangle, CheckCircle2, RefreshCw,
} from 'lucide-react';
import { getChildOrganizations, getOrganizationStats, Organization } from '@/services/organizationService';
import {
  getDistrictPerformance, refreshDistrictPerformance, type DistrictPerformanceSummary,
} from '@/services/performanceService';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';

interface DistrictDashboardProps {
  organization: Organization;
}

interface SchoolStat {
  school: Organization;
  lessonCount: number;
  memberCount: number;
}

type Tab = 'overview' | 'performance';

const DistrictDashboard: React.FC<DistrictDashboardProps> = ({ organization }) => {
  const [tab, setTab] = useState<Tab>('overview');
  const [schools, setSchools] = useState<SchoolStat[]>([]);
  const [subjectBreakdown, setSubjectBreakdown] = useState<{ subject: string; count: number }[]>([]);
  const [totalStats, setTotalStats] = useState({ schools: 0, teachers: 0, lessons: 0 });
  const [loading, setLoading] = useState(true);

  // Performance tab
  const [perfData, setPerfData] = useState<DistrictPerformanceSummary[]>([]);
  const [perfLoading, setPerfLoading] = useState(false);
  const [perfLoaded, setPerfLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, [organization.id]);

  const loadData = async () => {
    setLoading(true);
    const childOrgs = await getChildOrganizations(organization.id);

    const schoolStats = await Promise.all(
      childOrgs.map(async (school) => {
        const stats = await getOrganizationStats(school.id);
        return { school, lessonCount: stats.lessonCount, memberCount: stats.memberCount };
      })
    );
    setSchools(schoolStats);

    const schoolIds = childOrgs.map(s => s.id);
    if (schoolIds.length) {
      const { data: lessons } = await supabase
        .from('lesson_notes')
        .select('subject')
        .in('organization_id', schoolIds);

      const freq: Record<string, number> = {};
      (lessons || []).forEach((l: any) => { freq[l.subject] = (freq[l.subject] || 0) + 1; });
      setSubjectBreakdown(
        Object.entries(freq).map(([subject, count]) => ({ subject, count })).sort((a, b) => b.count - a.count).slice(0, 8)
      );
    }

    setTotalStats({
      schools: childOrgs.length,
      teachers: schoolStats.reduce((s, ss) => s + ss.memberCount, 0),
      lessons: schoolStats.reduce((s, ss) => s + ss.lessonCount, 0),
    });

    setLoading(false);
  };

  const loadPerformance = async () => {
    if (perfLoaded) return;
    setPerfLoading(true);
    const data = await getDistrictPerformance(organization.id);
    setPerfData(data);
    setPerfLoaded(true);
    setPerfLoading(false);
  };

  const handleRefreshPerf = async () => {
    setRefreshing(true);
    await refreshDistrictPerformance(organization.id);
    const data = await getDistrictPerformance(organization.id);
    setPerfData(data);
    setRefreshing(false);
  };

  useEffect(() => {
    if (tab === 'performance') loadPerformance();
  }, [tab]);

  const scoreColor = (avg: number) => avg >= 65 ? '#22c55e' : avg >= 40 ? '#f97316' : '#ef4444';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-700 to-purple-800 text-white rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
            <MapPin className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{organization.name}</h2>
            <p className="text-indigo-200 text-sm">{organization.country} · District Dashboard</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Schools', value: totalStats.schools, icon: Building2 },
            { label: 'Teachers', value: totalStats.teachers, icon: Users },
            { label: 'Total Lessons', value: totalStats.lessons, icon: FileText },
          ].map((s, i) => (
            <div key={i} className="bg-white/10 rounded-xl p-4 text-center">
              <s.icon className="w-5 h-5 mx-auto mb-1 opacity-80" />
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs text-indigo-200">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {([
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'performance', label: 'Performance Analytics', icon: Target },
        ] as { id: Tab; label: string; icon: React.ElementType }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview tab ── */}
      {tab === 'overview' && (
        <>
          <div className="grid lg:grid-cols-2 gap-6">
            {/* School engagement table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" /> School Engagement
              </h3>
              {schools.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No schools in this district yet.</p>
              ) : (
                <div className="space-y-3">
                  {schools.sort((a, b) => b.lessonCount - a.lessonCount).map(({ school, lessonCount, memberCount }) => (
                    <div key={school.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{school.name}</p>
                        <p className="text-xs text-gray-400">{memberCount} teachers</p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-indigo-600">{lessonCount}</div>
                        <div className="text-xs text-gray-400">lessons</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Subject popularity */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-600" /> Subject Popularity
              </h3>
              {subjectBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={subjectBreakdown} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="subject" type="category" tick={{ fontSize: 10 }} width={90} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No lesson data yet for district schools.</p>
                </div>
              )}
            </div>
          </div>

          {/* Curriculum coverage callout */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-amber-800 text-sm">Curriculum Coverage Insight</p>
                <p className="text-amber-700 text-xs mt-1">
                  {subjectBreakdown.length > 0
                    ? `Most active subject: ${subjectBreakdown[0].subject} (${subjectBreakdown[0].count} lessons). Consider encouraging coverage of underrepresented subjects.`
                    : 'Link school lesson notes to this district to see curriculum coverage insights.'}
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Performance Analytics tab ── */}
      {tab === 'performance' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Aggregated from school-level class performance summaries.</p>
            <button
              onClick={handleRefreshPerf}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-40"
            >
              {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Refresh
            </button>
          </div>

          {perfLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-7 h-7 animate-spin text-indigo-500" />
            </div>
          )}

          {!perfLoading && perfData.length === 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center text-gray-400">
              <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium text-gray-600 mb-1">No performance data yet</p>
              <p className="text-sm">Performance data appears here once teachers enter student assessment results in School Dashboards.</p>
            </div>
          )}

          {!perfLoading && perfData.length > 0 && (
            <>
              {/* District average chart */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-600" /> Subject Performance Averages
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={perfData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <YAxis dataKey="subject" type="category" tick={{ fontSize: 10 }} width={110} />
                    <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                    <Bar dataKey="average_score" radius={[0, 4, 4, 0]}>
                      {perfData.map((entry, i) => (
                        <Cell key={i} fill={scoreColor(entry.average_score)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Subject breakdown cards */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {perfData.map((p) => (
                  <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{p.subject}</p>
                        <p className="text-xs text-gray-400">{p.student_count} students · {p.school_count} schools</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold" style={{ color: scoreColor(p.average_score) }}>
                          {p.average_score.toFixed(1)}%
                        </p>
                        <div className="flex items-center gap-1 justify-end">
                          {p.benchmark_met ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                          )}
                          <span className={`text-xs ${p.benchmark_met ? 'text-emerald-600' : 'text-red-500'}`}>
                            {p.benchmark_met ? 'Benchmark met' : 'Below benchmark'}
                          </span>
                        </div>
                      </div>
                    </div>
                    {p.weak_topics.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <p className="text-xs font-medium text-gray-600 mb-1">Weak topics:</p>
                        <div className="flex flex-wrap gap-1">
                          {p.weak_topics.slice(0, 3).map((t, i) => (
                            <span key={i} className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default DistrictDashboard;
