import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Users, BookOpen, FileText, Brain, Upload, Plus, Loader2,
  Building2, TrendingUp, Tag, CheckCircle2, AlertCircle
} from 'lucide-react';
import {
  getOrganizationStats, getOrganizationMembers, getSchoolKnowledgeItems,
  addSchoolKnowledgeItem, Organization
} from '@/services/organizationService';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface SchoolDashboardProps {
  organization: Organization;
  userId: string;
  userRole: string;
}

const SchoolDashboard: React.FC<SchoolDashboardProps> = ({ organization, userId, userRole }) => {
  const [stats, setStats] = useState({ memberCount: 0, lessonCount: 0, knowledgeCount: 0, childCount: 0 });
  const [members, setMembers] = useState<any[]>([]);
  const [knowledgeItems, setKnowledgeItems] = useState<any[]>([]);
  const [subjectData, setSubjectData] = useState<{ subject: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'teachers' | 'knowledge'>('overview');

  // Add knowledge item
  const [addingKnowledge, setAddingKnowledge] = useState(false);
  const [newKnowledge, setNewKnowledge] = useState({ title: '', summary: '', tags: '' });
  const [kSaving, setKSaving] = useState(false);
  const [kMsg, setKMsg] = useState('');

  useEffect(() => {
    loadData();
  }, [organization.id]);

  const loadData = async () => {
    setLoading(true);
    const [s, m, k, lessonsRes] = await Promise.all([
      getOrganizationStats(organization.id),
      getOrganizationMembers(organization.id),
      getSchoolKnowledgeItems(organization.id),
      supabase.from('lesson_notes').select('subject').eq('organization_id', organization.id),
    ]);
    setStats(s);
    setMembers(m);
    setKnowledgeItems(k);

    // Subject breakdown
    const freq: Record<string, number> = {};
    (lessonsRes.data || []).forEach((l: any) => { freq[l.subject] = (freq[l.subject] || 0) + 1; });
    setSubjectData(Object.entries(freq).map(([subject, count]) => ({ subject, count })).sort((a, b) => b.count - a.count).slice(0, 8));

    setLoading(false);
  };

  const handleAddKnowledge = async () => {
    if (!newKnowledge.title.trim()) return;
    setKSaving(true);
    const tags = newKnowledge.tags.split(',').map(t => t.trim()).filter(Boolean);
    const result = await addSchoolKnowledgeItem({
      organization_id: organization.id,
      title: newKnowledge.title,
      summary: newKnowledge.summary,
      tags,
      content_type: 'manual',
      created_by: userId,
    });
    setKSaving(false);
    if (result) {
      setKMsg('Added successfully!');
      setNewKnowledge({ title: '', summary: '', tags: '' });
      setAddingKnowledge(false);
      loadData();
      setTimeout(() => setKMsg(''), 3000);
    }
  };

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: TrendingUp },
    { id: 'teachers' as const, label: 'Teachers', icon: Users },
    { id: 'knowledge' as const, label: 'School Knowledge', icon: Brain },
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
      {/* School header */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white rounded-2xl p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{organization.name}</h2>
            <p className="text-blue-200 text-sm">{organization.country} · School Dashboard</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-6">
          {[
            { label: 'Teachers', value: stats.memberCount, icon: Users },
            { label: 'Lessons Generated', value: stats.lessonCount, icon: FileText },
            { label: 'Knowledge Items', value: stats.knowledgeCount, icon: Brain },
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
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-1.5 flex gap-1">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab.id ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50'
            }`}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === 'overview' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-bold text-gray-900 mb-4">Subject Activity</h3>
          {subjectData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={subjectData}>
                <XAxis dataKey="subject" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No lessons linked to this school yet.</p>
            </div>
          )}
        </div>
      )}

      {/* Teachers */}
      {activeTab === 'teachers' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-bold text-gray-900 mb-4">School Members</h3>
          {members.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No members yet.</p>
          ) : (
            <div className="space-y-3">
              {members.map((m: any) => (
                <div key={m.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center text-blue-700 font-bold text-sm">
                      {m.profiles?.full_name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{m.profiles?.full_name || 'Unknown'}</p>
                      <p className="text-xs text-gray-400">{m.profiles?.email}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    m.role === 'school_admin' ? 'bg-purple-100 text-purple-700'
                    : m.role === 'teacher' ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600'
                  }`}>{m.role}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* School Knowledge */}
      {activeTab === 'knowledge' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">School Knowledge Space</h3>
            {(userRole === 'school_admin' || userRole === 'teacher') && (
              <button onClick={() => setAddingKnowledge(!addingKnowledge)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-all">
                <Plus className="w-4 h-4" /> Add Item
              </button>
            )}
          </div>

          {kMsg && (
            <div className="flex items-center gap-2 mb-4 text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg text-sm">
              <CheckCircle2 className="w-4 h-4" /> {kMsg}
            </div>
          )}

          {addingKnowledge && (
            <div className="mb-4 p-4 bg-blue-50 rounded-xl space-y-3">
              <input type="text" placeholder="Title *" value={newKnowledge.title}
                onChange={e => setNewKnowledge(p => ({ ...p, title: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-blue-200 text-sm outline-none focus:ring-2 focus:ring-blue-300" />
              <textarea placeholder="Summary / description" value={newKnowledge.summary}
                onChange={e => setNewKnowledge(p => ({ ...p, summary: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-blue-200 text-sm outline-none focus:ring-2 focus:ring-blue-300 resize-none" rows={2} />
              <input type="text" placeholder="Tags (comma-separated)" value={newKnowledge.tags}
                onChange={e => setNewKnowledge(p => ({ ...p, tags: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-blue-200 text-sm outline-none focus:ring-2 focus:ring-blue-300" />
              <div className="flex gap-2">
                <button onClick={handleAddKnowledge} disabled={kSaving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                  {kSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Save
                </button>
                <button onClick={() => setAddingKnowledge(false)}
                  className="px-4 py-2 bg-white text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 border border-gray-200">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {knowledgeItems.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Brain className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No school knowledge items yet. Add schemes of work, curriculum notes, and teaching resources.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {knowledgeItems.map((k: any) => (
                <div key={k.id} className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{k.title}</p>
                      {k.summary && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{k.summary}</p>}
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {new Date(k.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {k.tags?.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {k.tags.map((t: string) => (
                        <span key={t} className="inline-flex items-center gap-0.5 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                          <Tag className="w-2.5 h-2.5" /> {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SchoolDashboard;
