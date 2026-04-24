import React, { useState, useEffect, useRef } from 'react';
import {
  Users, BookOpen, FileText, Brain, Upload, Plus, Loader2, Building2,
  TrendingUp, Tag, CheckCircle2, X, BarChart3, Clock, Eye, Globe, Lock, Target
} from 'lucide-react';
import {
  getOrganizationStats, getOrganizationMembers, getSchoolKnowledgeItems,
  getSchoolLessons, getTeacherLessonStats, addSchoolKnowledgeItem,
  uploadSchemeOfWork, Organization, LessonVisibility
} from '@/services/organizationService';
import {
  getCountryAlignmentStats, alignLessonDual, extractTextFromFile,
  DualAlignmentResult,
} from '@/services/alignmentService';
import { autoGenerateForLesson } from '@/services/assessmentService';
import AlignmentBadge from '@/components/AlignmentBadge';
import ClassAnalyticsDashboard from '@/components/ClassAnalyticsDashboard';
import TextbookLibrary from '@/components/TextbookLibrary';
import { BookMarked } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface SchoolDashboardProps {
  organization: Organization;
  userId: string;
  userRole: string;
}

const VISIBILITY_ICON = { private: Lock, school_only: Building2, general: Globe };
const VISIBILITY_LABEL = { private: 'Private', school_only: 'School Only', general: 'Public' };
const VISIBILITY_COLOR = {
  private: 'bg-gray-100 text-gray-600',
  school_only: 'bg-blue-100 text-blue-700',
  general: 'bg-emerald-100 text-emerald-700',
};

type Tab = 'overview' | 'lessons' | 'teachers' | 'knowledge' | 'performance' | 'textbooks';

const SchoolDashboard: React.FC<SchoolDashboardProps> = ({ organization, userId, userRole }) => {
  const [stats, setStats] = useState({ memberCount: 0, lessonCount: 0, knowledgeCount: 0, childCount: 0 });
  const [members, setMembers] = useState<any[]>([]);
  const [knowledgeItems, setKnowledgeItems] = useState<any[]>([]);
  const [schoolLessons, setSchoolLessons] = useState<any[]>([]);
  const [teacherStats, setTeacherStats] = useState<any[]>([]);
  const [subjectData, setSubjectData] = useState<{ subject: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // Add knowledge item state
  const [addingKnowledge, setAddingKnowledge] = useState(false);
  const [newKnowledge, setNewKnowledge] = useState({ title: '', summary: '', tags: '' });
  const [kSaving, setKSaving] = useState(false);
  const [kMsg, setKMsg] = useState('');

  // File upload state
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [uploadAlignment, setUploadAlignment] = useState<DualAlignmentResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Lesson filter
  const [lessonFilter, setLessonFilter] = useState<LessonVisibility | 'all'>('all');
  const [alignmentStats, setAlignmentStats] = useState<{
    avg_score: number; total_lessons: number; full: number; partial: number; needs_improvement: number;
  } | null>(null);

  const isAdmin = userRole === 'school_admin' || userRole === 'district_admin' || userRole === 'ministry_admin';

  useEffect(() => {
    loadData();
  }, [organization.id]);

  const loadData = async () => {
    setLoading(true);
    const [s, m, k, lessons, tStats] = await Promise.all([
      getOrganizationStats(organization.id),
      getOrganizationMembers(organization.id),
      getSchoolKnowledgeItems(organization.id),
      getSchoolLessons(organization.id),
      isAdmin ? getTeacherLessonStats(organization.id) : Promise.resolve([]),
    ]);
    setStats(s);
    setMembers(m);
    setKnowledgeItems(k);
    setSchoolLessons(lessons);
    setTeacherStats(tStats);

    getCountryAlignmentStats(organization.country).then(aStats => {
      if (aStats.total_lessons > 0) setAlignmentStats(aStats);
    });

    const freq: Record<string, number> = {};
    lessons.forEach((l: any) => { freq[l.subject] = (freq[l.subject] || 0) + 1; });
    setSubjectData(
      Object.entries(freq).map(([subject, count]) => ({ subject, count }))
        .sort((a, b) => b.count - a.count).slice(0, 8)
    );
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
      content_type: 'document',
      created_by: userId,
    });
    setKSaving(false);
    if (result) {
      setKMsg('Added!');
      setNewKnowledge({ title: '', summary: '', tags: '' });
      setAddingKnowledge(false);
      loadData();
      setTimeout(() => setKMsg(''), 3000);
    }
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    setUploadMsg('');
    setUploadAlignment(null);

    const result = await uploadSchemeOfWork(organization.id, file, userId);
    if (result) {
      setUploadMsg(`"${file.name}" uploaded successfully.`);
      loadData();
      setTimeout(() => setUploadMsg(''), 6000);

      // Try to extract text and run alignment check
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'txt' || ext === 'docx') {
        try {
          const text = await extractTextFromFile(file);
          if (text.trim().length > 80) {
            const knowledgeItems = await getSchoolKnowledgeItems(organization.id);
            // Alignment check
            const dual = await alignLessonDual(
              text, organization.country, '', '', knowledgeItems
            );
            setUploadAlignment(dual);
            // Infer topic from file name for auto-generation
            const topicGuess = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
            autoGenerateForLesson({
              country:       organization.country,
              subject:       'General',
              classLevel:    '',
              topic:         topicGuess,
              teacherId:     userId,
              organizationId: organization.id,
              triggerType:   'lesson_upload',
            }).catch(() => {});
          }
        } catch {
          // Best-effort; silently ignore
        }
      }
    } else {
      setUploadMsg('Upload failed. Check storage bucket permissions.');
    }
    setUploading(false);
  };

  const filteredLessons = lessonFilter === 'all'
    ? schoolLessons
    : schoolLessons.filter((l: any) => l.visibility === lessonFilter);

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'lessons', label: `Lesson Library (${schoolLessons.length})`, icon: BookOpen },
    ...(isAdmin ? [{ id: 'teachers' as Tab, label: 'Teacher Analytics', icon: Users }] : []),
    { id: 'knowledge', label: `School Knowledge (${knowledgeItems.length})`, icon: Brain },
    { id: 'performance', label: 'Performance Analytics', icon: Target },
    { id: 'textbooks', label: 'Textbook Library', icon: BookMarked },
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
          {[
            { label: 'Teachers', value: stats.memberCount, icon: Users },
            { label: 'School Lessons', value: stats.lessonCount, icon: FileText },
            { label: 'Knowledge Items', value: stats.knowledgeCount, icon: Brain },
            { label: 'Shared Lessons', value: schoolLessons.filter((l: any) => l.visibility === 'school_only').length, icon: Eye },
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

      {/* ── Overview ── */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" /> Subject Activity
            </h3>
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
                <p className="text-sm">No lessons linked to this school yet. Teachers need to set their school when saving lessons.</p>
              </div>
            )}
          </div>

          {alignmentStats && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-indigo-600" /> Curriculum Alignment ({organization.country})
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                {[
                  { label: 'Avg Score', value: `${alignmentStats.avg_score}%`, color: 'text-indigo-600' },
                  { label: 'Fully Aligned 🟢', value: alignmentStats.full, color: 'text-emerald-600' },
                  { label: 'Partial 🟡', value: alignmentStats.partial, color: 'text-amber-600' },
                  { label: 'Needs Work 🔴', value: alignmentStats.needs_improvement, color: 'text-red-500' },
                ].map((s, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-4 text-center">
                    <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                    <div className="text-xs text-gray-500 mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden flex">
                <div className="bg-emerald-500 h-full transition-all" style={{ width: `${(alignmentStats.full / alignmentStats.total_lessons) * 100}%` }} />
                <div className="bg-amber-400 h-full transition-all" style={{ width: `${(alignmentStats.partial / alignmentStats.total_lessons) * 100}%` }} />
                <div className="bg-red-400 h-full transition-all" style={{ width: `${(alignmentStats.needs_improvement / alignmentStats.total_lessons) * 100}%` }} />
              </div>
              <p className="text-xs text-gray-400 mt-1.5">{alignmentStats.total_lessons} lessons scored</p>
            </div>
          )}
        </div>
      )}

      {/* ── Lesson Library ── */}
      {activeTab === 'lessons' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h3 className="font-bold text-gray-900">School Lesson Library</h3>
            {/* Visibility filter */}
            <div className="flex gap-1.5">
              {(['all', 'school_only', 'general', 'private'] as const).map(v => (
                <button key={v} onClick={() => setLessonFilter(v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                    lessonFilter === v ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {v === 'all' ? 'All' : VISIBILITY_LABEL[v]}
                </button>
              ))}
            </div>
          </div>

          {filteredLessons.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No {lessonFilter !== 'all' ? VISIBILITY_LABEL[lessonFilter] + ' ' : ''}lessons found.</p>
              <p className="text-xs mt-1">Teachers can set visibility when saving lesson notes.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLessons.map((lesson: any) => {
                const VIcon = VISIBILITY_ICON[lesson.visibility as LessonVisibility] || Lock;
                const aScore = lesson.alignment_score as number | undefined;
                return (
                  <div key={lesson.id} className="flex items-center justify-between p-3 bg-gray-50 hover:bg-blue-50/30 rounded-xl transition-all gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{lesson.title}</p>
                      <p className="text-xs text-gray-400">{lesson.subject} · {lesson.level} · {new Date(lesson.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {aScore !== undefined && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          aScore >= 75 ? 'bg-emerald-100 text-emerald-700' :
                          aScore >= 45 ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-600'
                        }`}>
                          {aScore >= 75 ? '🟢' : aScore >= 45 ? '🟡' : '🔴'} {aScore}%
                        </span>
                      )}
                      <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${
                        VISIBILITY_COLOR[lesson.visibility as LessonVisibility] || 'bg-gray-100 text-gray-600'
                      }`}>
                        <VIcon className="w-3 h-3" />
                        {VISIBILITY_LABEL[lesson.visibility as LessonVisibility] || lesson.visibility}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Teacher Analytics ── */}
      {activeTab === 'teachers' && isAdmin && (
        <div className="space-y-6">
          {/* Teacher table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-bold text-gray-900 mb-4">Teacher Performance</h3>
            {teacherStats.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No teacher data yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Teacher', 'Lessons', 'Subjects', 'Last Active'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {teacherStats.map((t, i) => (
                      <tr key={t.teacher_id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                              {t.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 text-xs">{t.full_name}</p>
                              <p className="text-gray-400 text-xs">{t.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-bold ${t.lesson_count > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                            {t.lesson_count}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 flex-wrap">
                            {t.subjects.slice(0, 3).map((s: string) => (
                              <span key={s} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">{s}</span>
                            ))}
                            {t.subjects.length > 3 && (
                              <span className="text-xs text-gray-400">+{t.subjects.length - 3}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {t.last_lesson_at ? new Date(t.last_lesson_at).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Subject breakdown chart */}
          {subjectData.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-500" /> Subject Coverage
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={subjectData}>
                  <XAxis dataKey="subject" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Members who haven't generated a lesson */}
          {(() => {
            const inactive = members.filter(
              m => m.role === 'teacher' &&
                !teacherStats.find(t => t.teacher_id === m.user_id && t.lesson_count > 0)
            );
            if (!inactive.length) return null;
            return (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                <p className="font-semibold text-amber-800 text-sm mb-2">
                  {inactive.length} teacher{inactive.length !== 1 ? 's' : ''} haven't generated a lesson yet
                </p>
                <div className="flex flex-wrap gap-2">
                  {inactive.map((m: any) => (
                    <span key={m.id} className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-lg">
                      {m.profiles?.full_name || 'Unknown'}
                    </span>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── School Knowledge ── */}
      {activeTab === 'knowledge' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h3 className="font-bold text-gray-900">School Knowledge Space</h3>
            <div className="flex gap-2">
              {/* File upload */}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-all disabled:opacity-50"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Upload Scheme of Work
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx,.doc,.txt"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = ''; }}
              />
              <button onClick={() => setAddingKnowledge(!addingKnowledge)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-all">
                <Plus className="w-4 h-4" /> Add Note
              </button>
            </div>
          </div>

          {/* Status messages */}
          {uploadMsg && (
            <div className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-lg text-sm ${
              uploadMsg.includes('failed') ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
            }`}>
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> {uploadMsg}
            </div>
          )}

          {/* Alignment result for uploaded file */}
          {uploadAlignment && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-600 mb-1.5">Document alignment preview:</p>
              <AlignmentBadge
                result={uploadAlignment.national}
                schoolResult={uploadAlignment.school}
              />
            </div>
          )}

          {kMsg && (
            <div className="flex items-center gap-2 mb-4 bg-emerald-50 text-emerald-600 px-3 py-2 rounded-lg text-sm">
              <CheckCircle2 className="w-4 h-4" /> {kMsg}
            </div>
          )}

          {/* Add note form */}
          {addingKnowledge && (
            <div className="mb-4 p-4 bg-blue-50 rounded-xl space-y-3 border border-blue-100">
              <input type="text" placeholder="Title *" value={newKnowledge.title}
                onChange={e => setNewKnowledge(p => ({ ...p, title: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-blue-200 text-sm outline-none focus:ring-2 focus:ring-blue-300" />
              <textarea placeholder="Summary / description" value={newKnowledge.summary}
                onChange={e => setNewKnowledge(p => ({ ...p, summary: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-blue-200 text-sm outline-none focus:ring-2 focus:ring-blue-300 resize-none" rows={2} />
              <input type="text" placeholder="Tags (comma-separated, e.g. fractions, primary-4)" value={newKnowledge.tags}
                onChange={e => setNewKnowledge(p => ({ ...p, tags: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-blue-200 text-sm outline-none focus:ring-2 focus:ring-blue-300" />
              <div className="flex gap-2">
                <button onClick={handleAddKnowledge} disabled={kSaving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                  {kSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Save
                </button>
                <button onClick={() => setAddingKnowledge(false)}
                  className="px-4 py-2 bg-white text-gray-600 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50 flex items-center gap-1">
                  <X className="w-4 h-4" /> Cancel
                </button>
              </div>
            </div>
          )}

          {/* Knowledge list */}
          {knowledgeItems.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Brain className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No school knowledge yet.</p>
              <p className="text-xs mt-1">Upload a scheme of work or add a curriculum note to help the AI generate better lessons.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {knowledgeItems.map((k: any) => (
                <div key={k.id} className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          k.content_type === 'scheme_of_work' ? 'bg-indigo-100 text-indigo-700'
                          : k.content_type === 'ai_insight' ? 'bg-purple-100 text-purple-700'
                          : 'bg-gray-100 text-gray-600'
                        }`}>
                          {k.content_type === 'scheme_of_work' ? 'Scheme of Work'
                          : k.content_type === 'ai_insight' ? 'AI Insight'
                          : 'Document'}
                        </span>
                        {k.file_url && (
                          <a href={k.file_url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline">View file</a>
                        )}
                      </div>
                      <p className="font-medium text-gray-900 text-sm">{k.title}</p>
                      {k.summary && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{k.summary}</p>}
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
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

      {activeTab === 'performance' && (
        <ClassAnalyticsDashboard
          organizationId={organization.id}
          teacherId={userId}
          organizationCountry={organization.country}
        />
      )}

      {activeTab === 'textbooks' && (
        <TextbookLibrary
          organizationId={organization.id}
          teacherId={userId}
          country={organization.country ?? ''}
        />
      )}
    </div>
  );
};

export default SchoolDashboard;
