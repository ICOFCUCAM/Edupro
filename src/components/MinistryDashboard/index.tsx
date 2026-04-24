import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Globe2, Building2, Users, FileText, TrendingUp, Bell, BarChart3,
  Loader2, ChevronRight, AlertTriangle, BookOpen, Flame, Target,
  ClipboardList, Search, Filter, Eye, Printer, Globe,
} from 'lucide-react';
import { getChildOrganizations, getOrganizationStats, Organization } from '@/services/organizationService';
import { getCountryAlignmentStats } from '@/services/alignmentService';
import { getMinistryQuestionBank, type MinistryQuestionBankItem } from '@/services/assessmentService';
import { getNationalPerformance } from '@/services/performanceService';
import { compareTextbooksForMinistry, type MinistryComparisonRow } from '@/services/textbookService';
import TextbookLibrary from '@/components/TextbookLibrary';
import CurriculumCrosswalk from '@/components/CurriculumCrosswalk';
import { BookMarked } from 'lucide-react';
import { SUBJECTS } from '@/lib/constants';
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
  const [alignmentStats, setAlignmentStats] = useState<{
    avg_score: number; total_lessons: number; full: number; partial: number; needs_improvement: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'districts' | 'alerts' | 'question-bank' | 'national-mastery' | 'textbook-eval' | 'regional-analysis'>('overview');
  const [tbComparison, setTbComparison]   = useState<MinistryComparisonRow[]>([]);
  const [tbCompLoading, setTbCompLoading] = useState(false);

  // National mastery state
  const [nationalPerf, setNationalPerf] = useState<{ subject: string; average_score: number; district_count: number; student_count: number }[]>([]);
  const [nationalPerfLoaded, setNationalPerfLoaded] = useState(false);
  const [nationalPerfLoading, setNationalPerfLoading] = useState(false);

  // Question bank state
  const [qbItems, setQbItems]               = useState<MinistryQuestionBankItem[]>([]);
  const [qbLoading, setQbLoading]           = useState(false);
  const [qbSubject, setQbSubject]           = useState('');
  const [qbLevel, setQbLevel]               = useState('');
  const [qbType, setQbType]                 = useState('');
  const [qbSearch, setQbSearch]             = useState('');
  const [qbSelected, setQbSelected]         = useState<MinistryQuestionBankItem | null>(null);

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

    getCountryAlignmentStats(organization.country).then(a => {
      if (a.total_lessons > 0) setAlignmentStats(a);
    });

    setLoading(false);
  };

  const loadQuestionBank = async () => {
    setQbLoading(true);
    try {
      const items = await getMinistryQuestionBank(
        organization.country,
        qbSubject || undefined,
        qbLevel   || undefined,
        qbType    || undefined,
        200,
      );
      setQbItems(items);
    } catch { /* silent */ } finally {
      setQbLoading(false);
    }
  };

  const loadNationalPerformance = async () => {
    if (nationalPerfLoaded) return;
    setNationalPerfLoading(true);
    const data = await getNationalPerformance(organization.country);
    setNationalPerf(data);
    setNationalPerfLoaded(true);
    setNationalPerfLoading(false);
  };

  const tabs = [
    { id: 'overview'         as const, label: 'Overview',         icon: BarChart3 },
    { id: 'districts'        as const, label: 'Districts',        icon: Building2 },
    { id: 'national-mastery' as const, label: 'National Mastery', icon: Target },
    { id: 'question-bank'    as const, label: 'Question Bank',    icon: ClipboardList },
    { id: 'textbook-eval'     as const, label: 'Textbook Evaluation', icon: BookMarked },
    { id: 'regional-analysis' as const, label: 'Regional Analysis',   icon: Globe },
    { id: 'alerts'           as const, label: `Alerts${alerts.length ? ` (${alerts.length})` : ''}`, icon: Bell },
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
          <button key={tab.id} onClick={() => {
            setActiveTab(tab.id);
            if (tab.id === 'question-bank' && qbItems.length === 0) loadQuestionBank();
            if (tab.id === 'national-mastery') loadNationalPerformance();
            if (tab.id === 'textbook-eval' && tbComparison.length === 0) {
              setTbCompLoading(true);
              compareTextbooksForMinistry(organization.country ?? '').then(rows => {
                setTbComparison(rows);
                setTbCompLoading(false);
              }).catch(() => setTbCompLoading(false));
            }
          }}
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

          {/* National curriculum alignment */}
          {alignmentStats && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                <Target className="w-5 h-5 text-indigo-600" /> National Curriculum Alignment Compliance
              </h3>
              <p className="text-xs text-gray-400 mb-4">{alignmentStats.total_lessons} lessons scored across {organization.country}</p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                {[
                  { label: 'National Avg', value: `${alignmentStats.avg_score}%`, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                  { label: '🟢 Fully Aligned', value: `${alignmentStats.full}`, color: 'text-emerald-700', bg: 'bg-emerald-50' },
                  { label: '🟡 Partial', value: `${alignmentStats.partial}`, color: 'text-amber-700', bg: 'bg-amber-50' },
                  { label: '🔴 Needs Work', value: `${alignmentStats.needs_improvement}`, color: 'text-red-700', bg: 'bg-red-50' },
                ].map((s, i) => (
                  <div key={i} className={`${s.bg} rounded-xl p-4 text-center`}>
                    <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                    <div className="text-xs text-gray-500 mt-1">{s.label}</div>
                  </div>
                ))}
              </div>

              <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex gap-0.5">
                <div className="bg-emerald-500 h-full rounded-l-full transition-all"
                  style={{ width: `${(alignmentStats.full / alignmentStats.total_lessons) * 100}%` }} />
                <div className="bg-amber-400 h-full transition-all"
                  style={{ width: `${(alignmentStats.partial / alignmentStats.total_lessons) * 100}%` }} />
                <div className="bg-red-400 h-full rounded-r-full transition-all"
                  style={{ width: `${(alignmentStats.needs_improvement / alignmentStats.total_lessons) * 100}%` }} />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>Fully Aligned ({Math.round((alignmentStats.full / alignmentStats.total_lessons) * 100)}%)</span>
                <span>Needs Work ({Math.round((alignmentStats.needs_improvement / alignmentStats.total_lessons) * 100)}%)</span>
              </div>
            </div>
          )}
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

      {/* National Mastery */}
      {activeTab === 'national-mastery' && (
        <div className="space-y-5">
          <p className="text-sm text-gray-500">
            Nationwide subject performance aggregated across all districts and schools.
          </p>

          {nationalPerfLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
            </div>
          )}

          {!nationalPerfLoading && nationalPerf.length === 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center text-gray-400">
              <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium text-gray-600 mb-1">No national performance data yet</p>
              <p className="text-sm">Data appears here once district performance summaries are populated from school assessment results.</p>
            </div>
          )}

          {!nationalPerfLoading && nationalPerf.length > 0 && (
            <>
              {/* Mastery heatmap — subject × mastery band */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-600" /> Nationwide Mastery Heatmap
                </h3>
                <p className="text-xs text-gray-400 mb-4">Subject performance index (0–100). Color indicates curriculum delivery health.</p>
                <div className="space-y-2">
                  {nationalPerf.map((p) => {
                    const pct = Math.min(100, Math.max(0, p.average_score));
                    const color = pct >= 75 ? '#22c55e' : pct >= 65 ? '#3b82f6' : pct >= 50 ? '#f97316' : '#ef4444';
                    const bgLight = pct >= 75 ? 'bg-emerald-50' : pct >= 65 ? 'bg-blue-50' : pct >= 50 ? 'bg-orange-50' : 'bg-red-50';
                    return (
                      <div key={p.subject} className={`${bgLight} rounded-xl p-3`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium text-gray-900">{p.subject}</span>
                          <span className="text-xs font-bold" style={{ color }}>{pct.toFixed(1)}%</span>
                        </div>
                        {/* Progress bar acting as heatmap cell */}
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                        </div>
                        <div className="flex justify-between mt-1 text-[10px] text-gray-400">
                          <span>{p.district_count} districts</span>
                          <span>{p.student_count.toLocaleString()} students</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Legend */}
                <div className="flex gap-4 mt-4 text-xs flex-wrap">
                  {[['#22c55e','Mastered (≥75%)'],['#3b82f6','Proficient (65–74%)'],['#f97316','Developing (50–64%)'],['#ef4444','Critical (<50%)']].map(([c, l]) => (
                    <div key={l} className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />
                      <span className="text-gray-500">{l}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Subject difficulty clusters */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-600" /> Subject Difficulty Clusters
                </h3>
                <p className="text-xs text-gray-400 mb-4">Subjects grouped by national average performance — guides curriculum investment priorities.</p>
                {(() => {
                  const easy = nationalPerf.filter(p => p.average_score >= 70);
                  const medium = nationalPerf.filter(p => p.average_score >= 50 && p.average_score < 70);
                  const hard = nationalPerf.filter(p => p.average_score < 50);
                  return (
                    <div className="grid sm:grid-cols-3 gap-4">
                      {[
                        { label: 'Low Difficulty', items: easy, color: 'emerald', desc: '≥ 70% national avg' },
                        { label: 'Medium Difficulty', items: medium, color: 'amber', desc: '50–69% national avg' },
                        { label: 'High Difficulty', items: hard, color: 'red', desc: '< 50% national avg' },
                      ].map(({ label, items, color, desc }) => (
                        <div key={label} className={`bg-${color}-50 border border-${color}-200 rounded-xl p-4`}>
                          <p className={`text-sm font-semibold text-${color}-800 mb-0.5`}>{label}</p>
                          <p className={`text-xs text-${color}-600 mb-3`}>{desc}</p>
                          {items.length === 0 ? (
                            <p className={`text-xs text-${color}-400`}>None</p>
                          ) : (
                            <ul className="space-y-1">
                              {items.map(p => (
                                <li key={p.subject} className={`text-xs text-${color}-700 flex items-center justify-between`}>
                                  <span>{p.subject}</span>
                                  <span className="font-semibold">{p.average_score.toFixed(0)}%</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Curriculum effectiveness signals */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" /> Curriculum Effectiveness Signals
                </h3>
                <div className="space-y-3">
                  {nationalPerf.map((p) => {
                    const belowBenchmark = p.average_score < 65;
                    const critical = p.average_score < 50;
                    return (
                      <div key={p.subject} className={`flex items-center justify-between p-3 rounded-xl ${
                        critical ? 'bg-red-50' : belowBenchmark ? 'bg-amber-50' : 'bg-emerald-50'
                      }`}>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{p.subject}</p>
                          <p className="text-xs text-gray-500">{p.district_count} districts · {p.student_count} students</p>
                        </div>
                        <div className="text-right flex items-center gap-2">
                          <span className={`text-base font-bold ${
                            critical ? 'text-red-600' : belowBenchmark ? 'text-amber-600' : 'text-emerald-600'
                          }`}>{p.average_score.toFixed(1)}%</span>
                          {critical && <AlertTriangle className="w-4 h-4 text-red-500" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {nationalPerf.filter(p => p.average_score < 50).length > 0 && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-sm font-semibold text-red-800">Policy Action Required</p>
                    <p className="text-xs text-red-700 mt-1">
                      {nationalPerf.filter(p => p.average_score < 50).map(p => p.subject).join(', ')} {nationalPerf.filter(p => p.average_score < 50).length === 1 ? 'is' : 'are'} below 50% nationally. Consider curriculum review, teacher training programmes, or targeted interventions.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Question Bank */}
      {activeTab === 'question-bank' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[160px]">
                <label className="block text-xs font-medium text-gray-500 mb-1">Search topic</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    value={qbSearch}
                    onChange={e => setQbSearch(e.target.value)}
                    placeholder="Search…"
                    className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Subject</label>
                <select value={qbSubject} onChange={e => setQbSubject(e.target.value)}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
                  <option value="">All subjects</option>
                  {SUBJECTS.slice(0, 10).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                <select value={qbType} onChange={e => setQbType(e.target.value)}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
                  <option value="">All types</option>
                  {['class_exercise','homework','quiz','test','exam','competency_check'].map(t => (
                    <option key={t} value={t} className="capitalize">{t.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <button onClick={loadQuestionBank}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl text-sm font-medium hover:bg-blue-100 transition-all">
                <Filter className="w-3.5 h-3.5" /> Apply
              </button>
            </div>
          </div>

          {qbSelected ? (
            /* Detail view */
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-gray-900">{qbSelected.title ?? qbSelected.topic}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {qbSelected.subject} · {qbSelected.class_level} · {qbSelected.difficulty} · {qbSelected.question_count} Qs · {qbSelected.total_marks} marks
                    {qbSelected.school_name && <> · {qbSelected.school_name}</>}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => window.print()}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-100">
                    <Printer className="w-3.5 h-3.5" /> Print
                  </button>
                  <button onClick={() => setQbSelected(null)}
                    className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl text-xs font-medium hover:bg-blue-100">
                    ← Back
                  </button>
                </div>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl mb-4 text-sm text-blue-800">
                <strong>Instructions:</strong> {qbSelected.content?.instructions}
                <span className="ml-3 text-xs text-blue-600">⏱ {qbSelected.duration_minutes} min</span>
              </div>
              {qbSelected.content?.sections?.map((section: any, i: number) => (
                <div key={i} className="mb-5">
                  <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                    {section.title}
                    {section.instructions && <span className="text-xs text-gray-400 font-normal italic">— {section.instructions}</span>}
                  </h4>
                  <div className="space-y-2">
                    {section.questions?.map((q: any) => (
                      <div key={q.number} className="flex items-start gap-2.5 p-3 bg-gray-50 rounded-xl">
                        <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{q.number}</span>
                        <div className="flex-1">
                          <p className="text-sm text-gray-800">{q.text}</p>
                          {q.options && (
                            <div className="mt-1.5 grid grid-cols-2 gap-1">
                              {Object.entries(q.options).map(([k, v]) => (
                                <span key={k} className="text-xs text-gray-600 px-2 py-0.5 bg-white border border-gray-200 rounded">{k}. {v as string}</span>
                              ))}
                            </div>
                          )}
                          <span className="text-xs text-gray-400 mt-1 inline-block">{q.marks} mark{q.marks !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* List view */
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
              {qbLoading ? (
                <div className="flex items-center justify-center py-16 text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading question bank…
                </div>
              ) : (() => {
                const filtered = qbItems.filter(item =>
                  !qbSearch || item.topic?.toLowerCase().includes(qbSearch.toLowerCase()) ||
                  item.title?.toLowerCase().includes(qbSearch.toLowerCase())
                );
                return filtered.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No assessments in the question bank yet.</p>
                    <p className="text-xs mt-1">Assessments auto-generated by teachers appear here.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    <div className="px-5 py-3 bg-gray-50 rounded-t-2xl flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-600">{filtered.length} assessments — {organization.country}</p>
                      <div className="flex gap-3 text-xs text-gray-400">
                        <span>Auto: {filtered.filter(i => i.auto_generated).length}</span>
                        <span>Manual: {filtered.filter(i => !i.auto_generated).length}</span>
                      </div>
                    </div>
                    {filtered.map(item => (
                      <button key={item.id} onClick={() => setQbSelected(item)}
                        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-all text-left">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                          <ClipboardList className="w-4.5 h-4.5 text-indigo-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{item.title ?? item.topic}</p>
                          <p className="text-xs text-gray-500">
                            {item.subject} · {item.class_level} · {item.difficulty} ·{' '}
                            <span className="capitalize">{item.package_type?.replace('_', ' ')}</span>
                            {item.school_name && <> · {item.school_name}</>}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {item.auto_generated && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded-full font-medium">Auto</span>
                          )}
                          <span className="text-xs text-gray-400">{item.question_count} Qs</span>
                          <Eye className="w-4 h-4 text-gray-300" />
                        </div>
                      </button>
                    ))}
                  </div>
                );
              })()}
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
      {/* ── Textbook Evaluation ── */}
      {activeTab === 'textbook-eval' && (
        <div className="space-y-6">
          {/* Ministry comparison table */}
          {tbCompLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : tbComparison.length > 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="font-bold text-gray-900">Curriculum Coverage by Textbook</h3>
                <p className="text-sm text-gray-500 mt-0.5">Ministry view — ranked by curriculum coverage</p>
              </div>
              <div className="divide-y divide-gray-50">
                {tbComparison.map((row, i) => (
                  <div key={row.textbook_id} className="px-6 py-4 flex items-center gap-4">
                    <span className="text-lg font-bold text-gray-300 w-6 text-right flex-shrink-0">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{row.title}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-500">{row.chapter_count} chapters</span>
                        <span className="text-xs text-gray-500">•</span>
                        <span className="text-xs text-gray-500">{row.missing_count} missing objectives</span>
                        {row.extra_topics_count > 0 && (
                          <>
                            <span className="text-xs text-gray-500">•</span>
                            <span className="text-xs text-amber-500">{row.extra_topics_count} extra topics</span>
                          </>
                        )}
                      </div>
                      <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            row.coverage_percentage >= 80 ? 'bg-emerald-500' :
                            row.coverage_percentage >= 60 ? 'bg-blue-500' :
                            row.coverage_percentage >= 40 ? 'bg-amber-400' : 'bg-red-400'
                          }`}
                          style={{ width: `${row.coverage_percentage}%` }}
                        />
                      </div>
                    </div>
                    <span className={`text-xl font-bold px-3 py-1 rounded-xl border flex-shrink-0 ${
                      row.coverage_percentage >= 80 ? 'text-emerald-600 bg-emerald-50 border-emerald-200' :
                      row.coverage_percentage >= 60 ? 'text-blue-600 bg-blue-50 border-blue-200' :
                      row.coverage_percentage >= 40 ? 'text-amber-600 bg-amber-50 border-amber-200' :
                                                      'text-red-600 bg-red-50 border-red-200'
                    }`}>
                      {row.coverage_percentage}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Upload ministry textbooks for evaluation */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h3 className="font-bold text-gray-900 mb-1">Evaluate a Textbook</h3>
            <p className="text-sm text-gray-500 mb-4">Upload a candidate textbook to check curriculum coverage before approval.</p>
            <TextbookLibrary
              organizationId={organization.id}
              teacherId={''}
              country={organization.country ?? ''}
            />
          </div>
        </div>
      )}

      {/* ── Regional Analysis (Curriculum Crosswalk) ── */}
      {activeTab === 'regional-analysis' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <CurriculumCrosswalk
            teacherId={''}
            userCountry={organization.country ?? 'Nigeria'}
          />
        </div>
      )}
    </div>
  );
};

export default MinistryDashboard;
