import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { TeacherProfile } from '@/hooks/useAuth';
import {
  User, BookOpen, FileText, Star, CreditCard, Settings, Globe2, Calendar,
  Sparkles, Download, Printer, Trash2, Eye, ChevronRight, Award, BarChart3,
  Clock, Loader2, Save, CheckCircle2, AlertCircle, Edit3, Mail, Building, MapPin, Target,
  ClipboardList,
} from 'lucide-react';
import AssessmentGenerator from './AssessmentGenerator';
import ConnectionBadge from './ConnectionBadge';
import AlignmentBadge from './AlignmentBadge';
import {
  getAlignmentScoresForLessons, alignLessonToCurriculum,
  saveAlignmentScore, extractTextFromLessonNote, StoredAlignmentScore,
} from '@/services/alignmentService';
import type { SyncStatus } from '../workers/offlineSyncWorker';

interface UserDashboardProps {
  profile: TeacherProfile | null;
  onNavigate: (page: string) => void;
  onUpdateProfile: (updates: Partial<TeacherProfile>) => Promise<{ success: boolean; error?: string }>;
  initialTab?: 'overview' | 'lessons' | 'saved' | 'settings' | 'assessments';
  isOnline?: boolean;
  syncStatus?: SyncStatus;
  pendingCount?: number;
  lastSyncTime?: string | null;
  onSyncClick?: () => void;
}


interface LessonRecord {
  id: string;
  title: string;
  subject: string;
  topic: string;
  country: string;
  level: string;
  status: string;
  created_at: string;
  content: any;
  alignmentScore?: StoredAlignmentScore;
}

interface SavedItem {
  id: string;
  content_type: string;
  title: string;
  metadata: any;
  created_at: string;
}

const UserDashboard: React.FC<UserDashboardProps> = ({
  profile, onNavigate, onUpdateProfile, initialTab,
  isOnline = true, syncStatus = 'idle', pendingCount = 0, lastSyncTime, onSyncClick,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'lessons' | 'saved' | 'settings' | 'assessments'>(initialTab || 'overview');

  const [lessons, setLessons] = useState<LessonRecord[]>([]);
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({ full_name: '', school_name: '', country: '' });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [checkingAlignment, setCheckingAlignment] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (profile) {
      fetchData();
      setEditData({ full_name: profile.full_name, school_name: profile.school_name || '', country: profile.country });
    }
  }, [profile]);

  const fetchData = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const [lessonsRes, savedRes] = await Promise.all([
        supabase.from('lesson_notes').select('*').eq('teacher_id', profile.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('saved_content').select('*').eq('teacher_id', profile.id).order('created_at', { ascending: false }).limit(20),
      ]);
      const lessonRows: LessonRecord[] = lessonsRes.data || [];

      // Load alignment scores and merge into lesson records
      if (lessonRows.length) {
        const scoreMap = await getAlignmentScoresForLessons(lessonRows.map(l => l.id));
        for (const lesson of lessonRows) {
          if (scoreMap[lesson.id]) lesson.alignmentScore = scoreMap[lesson.id];
        }
      }

      setLessons(lessonRows);
      setSavedItems(savedRes.data || []);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteLesson = async (id: string) => {
    if (!confirm('Are you sure you want to delete this lesson note?')) return;
    await supabase.from('lesson_notes').delete().eq('id', id);
    setLessons(prev => prev.filter(l => l.id !== id));
  };

  const checkAlignment = async (lesson: LessonRecord) => {
    setCheckingAlignment(prev => ({ ...prev, [lesson.id]: true }));
    try {
      const text = extractTextFromLessonNote(lesson.content);
      if (!text.trim()) return;
      const result = await alignLessonToCurriculum(text, lesson.country, lesson.subject, lesson.level);
      if (result) {
        await saveAlignmentScore(lesson.id, lesson.country, lesson.subject, lesson.level, result);
        setLessons(prev => prev.map(l =>
          l.id === lesson.id
            ? { ...l, alignmentScore: { ...result, id: '', lesson_id: l.id, country: l.country, subject: l.subject, class_level: l.level, school_alignment_score: null, school_matched_objectives: null, school_missing_objectives: null, checked_at: new Date().toISOString() } }
            : l
        ));
      }
    } finally {
      setCheckingAlignment(prev => ({ ...prev, [lesson.id]: false }));
    }
  };

  const deleteSavedItem = async (id: string) => {
    await supabase.from('saved_content').delete().eq('id', id);
    setSavedItems(prev => prev.filter(s => s.id !== id));
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setSaveMsg('');
    const result = await onUpdateProfile(editData);
    setSaving(false);
    if (result.success) {
      setSaveMsg('Profile updated successfully!');
      setEditMode(false);
      setTimeout(() => setSaveMsg(''), 3000);
    } else {
      setSaveMsg(result.error || 'Failed to update profile');
    }
  };

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch { return d; }
  };

  const planBadge = (plan: string) => {
    switch (plan) {
      case 'professional': return 'bg-blue-100 text-blue-700';
      case 'school': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  if (!profile) return null;

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: BarChart3 },
    { id: 'lessons' as const, label: 'My Lessons', icon: FileText },
    { id: 'assessments' as const, label: 'Assessments', icon: ClipboardList },
    { id: 'saved' as const, label: 'Saved Content', icon: Star },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-900 text-white py-10 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-2xl font-bold">
              {profile.full_name?.charAt(0)?.toUpperCase() || 'T'}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{profile.full_name}</h1>
              <div className="flex items-center gap-3 mt-1 text-blue-200 text-sm">
                <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{profile.email}</span>
                <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{profile.country}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${planBadge(profile.subscription_plan)}`}>
                  {profile.subscription_plan} Plan
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 -mt-6">
        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-1.5 mb-6 flex gap-1 overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50'
              }`}>
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </div>

        {/* ==================== OVERVIEW ==================== */}
        {activeTab === 'overview' && (
          <div className="space-y-6 pb-12">
            {/* Connection status */}
            <ConnectionBadge
              isOnline={isOnline}
              syncStatus={syncStatus}
              pendingCount={pendingCount}
              lastSyncTime={lastSyncTime}
              onSyncClick={onSyncClick}
            />

            {/* Stats cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Lessons Created', value: profile.lesson_count || lessons.length, icon: FileText, color: 'bg-blue-50 text-blue-600', iconBg: 'bg-blue-100' },
                { label: 'Saved Items', value: savedItems.length, icon: Star, color: 'bg-amber-50 text-amber-600', iconBg: 'bg-amber-100' },
                { label: 'Subscription', value: profile.subscription_plan?.charAt(0).toUpperCase() + profile.subscription_plan?.slice(1), icon: CreditCard, color: 'bg-emerald-50 text-emerald-600', iconBg: 'bg-emerald-100' },
                { label: 'Member Since', value: formatDate(profile.created_at), icon: Calendar, color: 'bg-purple-50 text-purple-600', iconBg: 'bg-purple-100' },
              ].map((stat, i) => (
                <div key={i} className={`${stat.color} rounded-2xl p-5 border border-gray-100`}>
                  <div className={`w-10 h-10 ${stat.iconBg} rounded-xl flex items-center justify-center mb-3`}>
                    <stat.icon className="w-5 h-5" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Quick actions */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-gray-900 mb-4">Quick Actions</h3>
              <div className="grid sm:grid-cols-3 gap-3">
                <button onClick={() => onNavigate('lesson-generator')}
                  className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl hover:bg-blue-100 transition-all text-left">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                  <div>
                    <div className="font-semibold text-sm text-gray-900">Generate Lesson</div>
                    <div className="text-xs text-gray-500">Create a new lesson note</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
                </button>
                <button onClick={() => onNavigate('content-library')}
                  className="flex items-center gap-3 p-4 bg-purple-50 rounded-xl hover:bg-purple-100 transition-all text-left">
                  <BookOpen className="w-5 h-5 text-purple-600" />
                  <div>
                    <div className="font-semibold text-sm text-gray-900">Browse Content</div>
                    <div className="text-xs text-gray-500">Videos, audio & games</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
                </button>
                <button onClick={() => onNavigate('exam-bank')}
                  className="flex items-center gap-3 p-4 bg-amber-50 rounded-xl hover:bg-amber-100 transition-all text-left">
                  <Award className="w-5 h-5 text-amber-600" />
                  <div>
                    <div className="font-semibold text-sm text-gray-900">Exam Bank</div>
                    <div className="text-xs text-gray-500">Past papers & practice</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
                </button>
                <button onClick={() => setActiveTab('assessments')}
                  className="flex items-center gap-3 p-4 bg-violet-50 rounded-xl hover:bg-violet-100 transition-all text-left">
                  <ClipboardList className="w-5 h-5 text-violet-600" />
                  <div>
                    <div className="font-semibold text-sm text-gray-900">Assessments</div>
                    <div className="text-xs text-gray-500">Generate exercises & tests</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
                </button>
              </div>
            </div>

            {/* Recent lessons */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">Recent Lesson Notes</h3>
                <button onClick={() => setActiveTab('lessons')} className="text-sm text-blue-600 hover:underline">View All</button>
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 text-blue-500 animate-spin" /></div>
              ) : lessons.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No lesson notes yet. Generate your first one!</p>
                  <button onClick={() => onNavigate('lesson-generator')} className="mt-3 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100">
                    Create Lesson Note
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {lessons.slice(0, 5).map(lesson => (
                    <div key={lesson.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900 truncate">{lesson.title || `${lesson.subject} - ${lesson.topic}`}</div>
                        <div className="text-xs text-gray-400">{lesson.country} | {lesson.level} | {formatDate(lesson.created_at)}</div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${lesson.status === 'published' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                        {lesson.status || 'draft'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Subscription */}
            <div className="bg-gradient-to-r from-blue-600 to-emerald-500 rounded-2xl p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-lg">Your Plan: {profile.subscription_plan?.charAt(0).toUpperCase() + profile.subscription_plan?.slice(1)}</h3>
                  <p className="text-blue-100 text-sm mt-1">
                    {profile.subscription_plan === 'free'
                      ? `${Math.max(0, 3 - (profile.lesson_count || 0))} free lessons remaining this month`
                      : 'Unlimited lesson notes and full access'}
                  </p>
                </div>
                {profile.subscription_plan === 'free' && (
                  <button onClick={() => onNavigate('pricing')}
                    className="px-5 py-2.5 bg-white text-blue-600 rounded-xl font-semibold text-sm hover:shadow-lg transition-all">
                    Upgrade
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== MY LESSONS ==================== */}
        {activeTab === 'lessons' && (
          <div className="space-y-3 pb-12">
            {loading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
            ) : lessons.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                <FileText className="w-14 h-14 text-gray-200 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-900 mb-1">No Lesson Notes Yet</h3>
                <p className="text-sm text-gray-400 mb-4">Start generating AI-powered lesson notes for your classes.</p>
                <button onClick={() => onNavigate('lesson-generator')}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-emerald-500 text-white rounded-xl font-medium hover:shadow-lg transition-all">
                  Generate Your First Lesson
                </button>
              </div>
            ) : (
              lessons.map(lesson => {
                const aScore = lesson.alignmentScore;
                const isChecking = checkingAlignment[lesson.id];
                return (
                  <div key={lesson.id} className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-all">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                        <FileText className="w-6 h-6 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 text-sm truncate">{lesson.title || `${lesson.subject} - ${lesson.topic}`}</h4>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{lesson.country}</span>
                          <span className="text-xs bg-gray-50 text-gray-600 px-2 py-0.5 rounded-full">{lesson.subject}</span>
                          <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full">{lesson.level}</span>
                          <span className="text-xs text-gray-400 flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(lesson.created_at)}</span>
                        </div>

                        {/* Alignment score row */}
                        <div className="mt-2">
                          {isChecking ? (
                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking alignment…
                            </div>
                          ) : aScore ? (
                            <AlignmentBadge result={aScore} compact />
                          ) : (
                            <button
                              onClick={() => checkAlignment(lesson)}
                              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                            >
                              <Target className="w-3.5 h-3.5" /> Check curriculum alignment
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button className="p-2 hover:bg-blue-50 rounded-lg transition-all" title="Print">
                          <Printer className="w-4 h-4 text-gray-400 hover:text-blue-600" />
                        </button>
                        <button onClick={() => deleteLesson(lesson.id)} className="p-2 hover:bg-red-50 rounded-lg transition-all" title="Delete">
                          <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-600" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ==================== SAVED CONTENT ==================== */}
        {activeTab === 'saved' && (
          <div className="space-y-3 pb-12">
            {loading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
            ) : savedItems.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                <Star className="w-14 h-14 text-gray-200 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-900 mb-1">No Saved Content</h3>
                <p className="text-sm text-gray-400 mb-4">Save your favorite content from the library, exams, and lessons.</p>
                <button onClick={() => onNavigate('content-library')}
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-xl font-medium hover:shadow-lg transition-all">
                  Browse Content Library
                </button>
              </div>
            ) : (
              savedItems.map(item => (
                <div key={item.id} className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-all">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      item.content_type === 'lesson' ? 'bg-blue-50' : item.content_type === 'exam' ? 'bg-amber-50' : 'bg-purple-50'
                    }`}>
                      {item.content_type === 'lesson' ? <FileText className="w-5 h-5 text-blue-600" /> :
                       item.content_type === 'exam' ? <Award className="w-5 h-5 text-amber-600" /> :
                       <BookOpen className="w-5 h-5 text-purple-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm text-gray-900 truncate">{item.title}</h4>
                      <div className="text-xs text-gray-400 mt-0.5 capitalize">{item.content_type} | {formatDate(item.created_at)}</div>
                    </div>
                    <button onClick={() => deleteSavedItem(item.id)} className="p-2 hover:bg-red-50 rounded-lg transition-all">
                      <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-600" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ==================== ASSESSMENTS ==================== */}
        {activeTab === 'assessments' && (
          <div className="pb-12">
            <AssessmentGenerator
              teacherId={profile.id}
              teacherCountry={profile.country}
            />
          </div>
        )}

        {/* ==================== SETTINGS ==================== */}
        {activeTab === 'settings' && (
          <div className="space-y-6 pb-12">
            {/* Profile Settings */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-gray-900 flex items-center gap-2"><User className="w-5 h-5 text-blue-600" /> Profile Settings</h3>
                {!editMode ? (
                  <button onClick={() => setEditMode(true)} className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100">
                    <Edit3 className="w-3.5 h-3.5" /> Edit
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => setEditMode(false)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                    <button onClick={handleSaveProfile} disabled={saving}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
                    </button>
                  </div>
                )}
              </div>

              {saveMsg && (
                <div className={`mb-4 flex items-center gap-2 p-3 rounded-xl text-sm ${saveMsg.includes('success') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                  {saveMsg.includes('success') ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {saveMsg}
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  {editMode ? (
                    <input value={editData.full_name} onChange={e => setEditData(p => ({ ...p, full_name: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  ) : (
                    <p className="px-4 py-2.5 bg-gray-50 rounded-xl text-sm text-gray-900">{profile.full_name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <p className="px-4 py-2.5 bg-gray-50 rounded-xl text-sm text-gray-500">{profile.email}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">School Name</label>
                  {editMode ? (
                    <input value={editData.school_name} onChange={e => setEditData(p => ({ ...p, school_name: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  ) : (
                    <p className="px-4 py-2.5 bg-gray-50 rounded-xl text-sm text-gray-900">{profile.school_name || 'Not set'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                  {editMode ? (
                    <input value={editData.country} onChange={e => setEditData(p => ({ ...p, country: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  ) : (
                    <p className="px-4 py-2.5 bg-gray-50 rounded-xl text-sm text-gray-900">{profile.country}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Subscription */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><CreditCard className="w-5 h-5 text-blue-600" /> Subscription</h3>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <div className="font-semibold text-gray-900 capitalize">{profile.subscription_plan} Plan</div>
                  <div className="text-xs text-gray-500 mt-0.5">Status: <span className="capitalize text-emerald-600 font-medium">{profile.subscription_status}</span></div>
                </div>
                <button onClick={() => onNavigate('pricing')}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-emerald-500 text-white rounded-lg text-sm font-medium hover:shadow-lg transition-all">
                  {profile.subscription_plan === 'free' ? 'Upgrade Plan' : 'Manage Plan'}
                </button>
              </div>
            </div>

            {/* Account info */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Globe2 className="w-5 h-5 text-blue-600" /> Account Info</h3>
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-gray-50 rounded-xl">
                  <div className="text-gray-500 text-xs">Region</div>
                  <div className="font-medium text-gray-900">{profile.region}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl">
                  <div className="text-gray-500 text-xs">Language</div>
                  <div className="font-medium text-gray-900">{profile.preferred_language || 'English'}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl">
                  <div className="text-gray-500 text-xs">Last Login</div>
                  <div className="font-medium text-gray-900">{profile.last_login ? formatDate(profile.last_login) : 'N/A'}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl">
                  <div className="text-gray-500 text-xs">Total Lessons</div>
                  <div className="font-medium text-gray-900">{profile.lesson_count || 0}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserDashboard;
