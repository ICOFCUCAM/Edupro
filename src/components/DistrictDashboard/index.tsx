import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Building2, Users, FileText, TrendingUp, Loader2, BarChart3, MapPin } from 'lucide-react';
import { getChildOrganizations, getOrganizationStats, Organization } from '@/services/organizationService';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface DistrictDashboardProps {
  organization: Organization;
}

interface SchoolStat {
  school: Organization;
  lessonCount: number;
  memberCount: number;
}

const DistrictDashboard: React.FC<DistrictDashboardProps> = ({ organization }) => {
  const [schools, setSchools] = useState<SchoolStat[]>([]);
  const [subjectBreakdown, setSubjectBreakdown] = useState<{ subject: string; count: number }[]>([]);
  const [totalStats, setTotalStats] = useState({ schools: 0, teachers: 0, lessons: 0 });
  const [loading, setLoading] = useState(true);

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

      {/* Curriculum coverage gaps callout */}
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
    </div>
  );
};

export default DistrictDashboard;
