import React, { useState, useEffect } from 'react';
import { REGIONS } from '@/lib/constants';
import {
  Brain, Search, Plus, ChevronRight, Globe2, BookOpen, Zap, AlertCircle, CheckCircle2,
  Clock, RefreshCw, Bot, Target, ClipboardList, Loader2, MessageCircle, Send, AlertTriangle,
} from 'lucide-react';
import { rescoreLessonsForCountry } from '@/services/alignmentService';
import {
  autoGenerateForObjective, regenerateAssessmentsForCurriculumChange,
  getObjectivesForScope,
} from '@/services/assessmentService';
import { getTeacherCoachingData, type ClassPerformanceSummary } from '@/services/performanceService';
import { supabase } from '@/lib/supabase';

const KB_ENTRIES = [
  { id: 1, country: 'Nigeria', category: 'Curriculum Update', title: 'NERDC 2025 Revised Primary Curriculum', content: 'The Nigerian Educational Research and Development Council has updated the primary school curriculum to include digital literacy as a core subject from Primary 3. All lesson notes should now incorporate ICT integration objectives.', date: '2025-12-15', status: 'active', impact: 'high' },
  { id: 2, country: 'Ghana', category: 'Pedagogy', title: 'NaCCA Activity-Based Learning Guidelines', content: 'New guidelines emphasize hands-on, activity-based learning approaches. Teachers should design lessons with at least 60% student-led activities. Assessment should be formative and continuous.', date: '2025-11-20', status: 'active', impact: 'high' },
  { id: 3, country: 'Kenya', category: 'Assessment', title: 'CBC Formative Assessment Framework 2025', content: 'Kenya\'s Competency-Based Curriculum now requires portfolio-based assessment alongside traditional testing. Rubrics must be included in all lesson plans for competency evaluation.', date: '2025-10-05', status: 'active', impact: 'medium' },
  { id: 4, country: 'South Africa', category: 'Curriculum Update', title: 'CAPS Amendment: Indigenous Knowledge Integration', content: 'The Department of Basic Education mandates integration of indigenous knowledge systems across all subjects. Lesson notes should reference local cultural practices and knowledge where applicable.', date: '2025-09-18', status: 'active', impact: 'high' },
  { id: 5, country: 'Uganda', category: 'Pedagogy', title: 'NCDC Inclusive Education Policy Update', content: 'New inclusive education guidelines require differentiated instruction strategies in every lesson plan. Teachers must provide accommodations for learners with special needs.', date: '2025-08-30', status: 'active', impact: 'medium' },
  { id: 6, country: 'Tanzania', category: 'Assessment', title: 'TIE Continuous Assessment Guidelines', content: 'Tanzania Institute of Education has introduced new continuous assessment protocols. Weekly assessments should be documented and contribute 40% to final grades.', date: '2025-07-22', status: 'active', impact: 'medium' },
  { id: 7, country: 'Cameroon', category: 'Curriculum Update', title: 'Bilingual Education Enhancement Program', content: 'New requirements for bilingual lesson delivery in Anglophone and Francophone regions. Lesson notes should include key vocabulary in both English and French.', date: '2025-06-10', status: 'active', impact: 'high' },
  { id: 8, country: 'Rwanda', category: 'Pedagogy', title: 'CBC Cross-Cutting Issues Integration', content: 'Rwanda Education Board requires explicit integration of cross-cutting issues: gender, environment, peace education, and financial literacy in all lesson plans.', date: '2025-05-15', status: 'active', impact: 'medium' },
  { id: 9, country: 'Ethiopia', category: 'Curriculum Update', title: 'Mother Tongue Education Policy Extension', content: 'Extended mother tongue instruction policy now covers Grades 1-6 in all regions. Lesson notes should be available in regional languages alongside English/Amharic.', date: '2025-04-20', status: 'active', impact: 'high' },
  { id: 10, country: 'Senegal', category: 'Pedagogy', title: 'Approche Par Compétences (APC) Update', content: 'Updated competency-based approach guidelines for primary education. Lesson plans must clearly define competencies, learning situations, and integration activities.', date: '2025-03-08', status: 'active', impact: 'medium' },
];

interface KnowledgeBaseProps {
  teacherCountry?: string;
  teacherId?: string;
  teacherName?: string;
}

const QUICK_QUESTIONS = [
  'Which objectives are weak in my class?',
  'Which class needs the most attention?',
  'What interventions do you recommend?',
  'Which topics are my students struggling with?',
  'What are my students doing well?',
];

const KnowledgeBase: React.FC<KnowledgeBaseProps> = ({ teacherCountry, teacherId, teacherName }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState(teacherCountry && teacherCountry !== 'all' ? teacherCountry : 'all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedEntry, setSelectedEntry] = useState<typeof KB_ENTRIES[0] | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [rescoring, setRescoring] = useState<string | null>(null);
  const [rescoreMsg, setRescoreMsg] = useState<string | null>(null);
  const [generatingAssessment, setGeneratingAssessment] = useState<string | null>(null);
  const [assessmentMsg, setAssessmentMsg] = useState<string | null>(null);
  const [objectives, setObjectives] = useState<Array<{ id: string; learning_objective: string; topic: string; subject: string; class_level: string; country: string }>>([]);
  const [objectivesLoading, setObjectivesLoading] = useState(false);
  const [objectivesCountry, setObjectivesCountry] = useState<string | null>(null);

  // Coaching assistant state
  const [coachingData, setCoachingData] = useState<ClassPerformanceSummary[]>([]);
  const [coachingLoaded, setCoachingLoaded] = useState(false);
  const [coachQuestion, setCoachQuestion] = useState('');
  const [coachAnswer, setCoachAnswer] = useState('');
  const [coachAsking, setCoachAsking] = useState(false);
  const [showCoach, setShowCoach] = useState(false);

  useEffect(() => {
    if (teacherId && !coachingLoaded) {
      getTeacherCoachingData(teacherId)
        .then((data) => { setCoachingData(data); setCoachingLoaded(true); })
        .catch(() => setCoachingLoaded(true));
    }
  }, [teacherId]);

  const handleAskCoach = async (question?: string) => {
    const q = question ?? coachQuestion;
    if (!q.trim()) return;
    setCoachAsking(true);
    setCoachAnswer('');
    if (question) setCoachQuestion(question);
    try {
      const { data, error } = await supabase.functions.invoke('teacher-coaching', {
        body: {
          question: q,
          performanceData: coachingData,
          country: teacherCountry,
          teacherName,
        },
      });
      if (error || !data?.success) {
        setCoachAnswer(data?.error || 'Could not get a response. Please try again.');
      } else {
        setCoachAnswer(data.answer);
      }
    } catch {
      setCoachAnswer('Could not connect to coaching assistant. Please try again.');
    } finally {
      setCoachAsking(false);
    }
  };

  const allCountries = [...new Set(KB_ENTRIES.map(e => e.country))];
  const allCategories = [...new Set(KB_ENTRIES.map(e => e.category))];

  const filtered = KB_ENTRIES.filter(entry => {
    if (countryFilter !== 'all' && entry.country !== countryFilter) return false;
    if (categoryFilter !== 'all' && entry.category !== categoryFilter) return false;
    if (searchQuery && !entry.title.toLowerCase().includes(searchQuery.toLowerCase()) && !entry.content.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const handleSync = async (country: string) => {
    setSyncing(country);
    await new Promise(r => setTimeout(r, 1500));
    setSyncing(null);
  };

  const handleRescore = async (entry: typeof KB_ENTRIES[0]) => {
    const key = `${entry.id}`;
    setRescoring(key);
    setRescoreMsg(null);
    try {
      const { rescored, errors } = await rescoreLessonsForCountry(entry.country);
      // Also regenerate assessments in background when curriculum changes
      regenerateAssessmentsForCurriculumChange(entry.country, entry.category === 'Assessment' ? undefined : undefined)
        .then(count => {
          if (count > 0) {
            setRescoreMsg(prev => prev ? `${prev} Also regenerated ${count} assessment${count !== 1 ? 's' : ''}.` : `Regenerated ${count} assessment${count !== 1 ? 's' : ''} for ${entry.country}.`);
          }
        })
        .catch(() => {});
      setRescoreMsg(
        rescored > 0
          ? `Rescored ${rescored} lesson${rescored !== 1 ? 's' : ''} for ${entry.country}.`
          : errors > 0
          ? `Rescore encountered errors for some lessons.`
          : `No lessons found to rescore for ${entry.country}.`
      );
    } catch {
      setRescoreMsg('Rescore failed. Please try again.');
    } finally {
      setRescoring(null);
      setTimeout(() => setRescoreMsg(null), 8000);
    }
  };

  const loadObjectives = async (country: string) => {
    if (objectivesCountry === country && objectives.length > 0) return;
    setObjectivesLoading(true);
    try {
      // Aggregate objectives across subjects for this country
      const subjects = ['Mathematics', 'English Language', 'Basic Science', 'Social Studies'];
      const all: any[] = [];
      for (const subject of subjects) {
        const rows = await getObjectivesForScope(country, subject, '');
        all.push(...rows.map(r => ({ ...r, subject, country })));
      }
      setObjectives(all.slice(0, 20));
      setObjectivesCountry(country);
    } catch { /* silent */ } finally {
      setObjectivesLoading(false);
    }
  };

  const handleGenerateFromObjective = async (
    obj: { id: string; learning_objective: string; topic: string; subject: string; class_level: string; country: string },
  ) => {
    if (!teacherId) return;
    setGeneratingAssessment(obj.id);
    setAssessmentMsg(null);
    try {
      const packageId = await autoGenerateForObjective(obj, teacherId);
      setAssessmentMsg(packageId
        ? `Quiz generated for "${obj.topic}"! Check your Assessments tab.`
        : 'Could not generate assessment. Please try again.'
      );
    } finally {
      setGeneratingAssessment(null);
      setTimeout(() => setAssessmentMsg(null), 6000);
    }
  };

  const impactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'bg-red-50 text-red-600 border-red-200';
      case 'medium': return 'bg-amber-50 text-amber-600 border-amber-200';
      default: return 'bg-green-50 text-green-600 border-green-200';
    }
  };

  const categoryColor = (cat: string) => {
    switch (cat) {
      case 'Curriculum Update': return 'bg-blue-100 text-blue-700';
      case 'Pedagogy': return 'bg-emerald-100 text-emerald-700';
      case 'Assessment': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-700 to-teal-900 text-white py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Brain className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">AI Knowledge Base</h1>
                <p className="text-emerald-200">Country-specific pedagogical updates & curriculum changes</p>
              </div>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="hidden sm:flex items-center gap-2 px-4 py-2.5 bg-white/20 backdrop-blur-sm rounded-xl text-sm font-medium hover:bg-white/30 transition-all border border-white/20"
            >
              <Plus className="w-4 h-4" /> Add Knowledge
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 -mt-6">

        {/* Teacher Coaching Assistant */}
        {teacherId && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-purple-600" /> Teacher Coaching Assistant
              </h3>
              <button
                onClick={() => setShowCoach(!showCoach)}
                className="text-xs text-purple-600 hover:underline"
              >
                {showCoach ? 'Collapse' : 'Expand'}
              </button>
            </div>

            {/* Always-visible: weak objectives summary */}
            {coachingLoaded && coachingData.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-medium text-gray-500 mb-2">Your class performance snapshot:</p>
                <div className="flex flex-wrap gap-2">
                  {coachingData.slice(0, 4).map((c) => (
                    <div key={c.id} className={`px-3 py-2 rounded-xl text-xs border ${
                      c.intervention_needed
                        ? 'bg-red-50 border-red-200 text-red-700'
                        : c.average_score < 65
                        ? 'bg-amber-50 border-amber-200 text-amber-700'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    }`}>
                      <span className="font-semibold">{c.subject} · {c.class_level}</span>
                      <span className="ml-1.5">{c.average_score.toFixed(0)}%</span>
                      {c.intervention_needed && <AlertTriangle className="w-3 h-3 inline ml-1" />}
                    </div>
                  ))}
                  {coachingData.some(c => c.weak_objectives.length > 0) && (
                    <div className="px-3 py-2 rounded-xl text-xs bg-purple-50 border border-purple-200 text-purple-700">
                      {coachingData.reduce((n, c) => n + c.weak_objectives.length, 0)} weak objectives detected
                    </div>
                  )}
                </div>
              </div>
            )}

            {coachingLoaded && coachingData.length === 0 && (
              <p className="text-xs text-gray-400 mb-4">No performance data yet. Enter student assessment results to unlock coaching insights.</p>
            )}

            {/* Quick question chips */}
            <div className="flex flex-wrap gap-2 mb-3">
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => { setShowCoach(true); handleAskCoach(q); }}
                  disabled={coachAsking}
                  className="px-3 py-1.5 bg-purple-50 text-purple-700 text-xs rounded-lg border border-purple-200 hover:bg-purple-100 transition-colors disabled:opacity-40"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Free-form input */}
            {showCoach && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    value={coachQuestion}
                    onChange={(e) => setCoachQuestion(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !coachAsking) handleAskCoach(); }}
                    placeholder="Ask your coaching assistant anything..."
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                  <button
                    onClick={() => handleAskCoach()}
                    disabled={coachAsking || !coachQuestion.trim()}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-purple-600 text-white text-sm rounded-xl hover:bg-purple-700 disabled:opacity-40 transition-colors"
                  >
                    {coachAsking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>

                {coachAsking && (
                  <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Analysing your class data…
                  </div>
                )}

                {coachAnswer && !coachAsking && (
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Brain className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-purple-700 mb-1">Coaching Assistant</p>
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{coachAnswer}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Country Bots */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Bot className="w-4 h-4 text-emerald-600" /> Country AI Knowledge Bots
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {allCountries.map(country => {
              const count = KB_ENTRIES.filter(e => e.country === country).length;
              return (
                <div key={country} className="bg-gray-50 rounded-xl p-3 hover:bg-emerald-50 transition-all group">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                      <Bot className="w-4 h-4 text-emerald-600" />
                    </div>
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{count}</span>
                  </div>
                  <div className="text-sm font-medium text-gray-900">{country}</div>
                  <button
                    onClick={() => handleSync(country)}
                    disabled={syncing === country}
                    className="mt-2 w-full flex items-center justify-center gap-1 px-2 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${syncing === country ? 'animate-spin' : ''}`} />
                    {syncing === country ? 'Syncing...' : 'Sync'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                placeholder="Search knowledge base..."
              />
            </div>
            <select value={countryFilter} onChange={e => setCountryFilter(e.target.value)} className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none">
              <option value="all">All Countries</option>
              {allCountries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none">
              <option value="all">All Categories</option>
              {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Entries */}
        <div className="space-y-3 pb-12">
          {filtered.map(entry => (
            <div
              key={entry.id}
              className={`bg-white rounded-xl border transition-all cursor-pointer ${
                selectedEntry?.id === entry.id ? 'border-emerald-300 shadow-lg' : 'border-gray-100 hover:border-gray-200 hover:shadow-md'
              }`}
              onClick={() => setSelectedEntry(selectedEntry?.id === entry.id ? null : entry)}
            >
              <div className="p-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                    {entry.category === 'Curriculum Update' ? <BookOpen className="w-5 h-5 text-emerald-600" /> :
                     entry.category === 'Pedagogy' ? <Brain className="w-5 h-5 text-emerald-600" /> :
                     <Zap className="w-5 h-5 text-emerald-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryColor(entry.category)}`}>{entry.category}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${impactColor(entry.impact)}`}>
                        {entry.impact === 'high' ? 'High Impact' : 'Medium Impact'}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-900 text-sm">{entry.title}</h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><Globe2 className="w-3 h-3" />{entry.country}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{entry.date}</span>
                      <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" />Active</span>
                    </div>
                  </div>
                  <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${selectedEntry?.id === entry.id ? 'rotate-90' : ''}`} />
                </div>

                {selectedEntry?.id === entry.id && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-sm text-gray-600 leading-relaxed mb-4">{entry.content}</p>

                    {rescoreMsg && selectedEntry?.id === entry.id && (
                      <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" /> {rescoreMsg}
                      </div>
                    )}
                    {assessmentMsg && selectedEntry?.id === entry.id && (
                      <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-violet-50 text-violet-700 rounded-lg text-xs">
                        <ClipboardList className="w-3.5 h-3.5 flex-shrink-0" /> {assessmentMsg}
                      </div>
                    )}

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={e => { e.stopPropagation(); handleRescore(entry); }}
                        disabled={rescoring === String(entry.id)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-100 transition-all disabled:opacity-50"
                      >
                        {rescoring === String(entry.id)
                          ? <><RefreshCw className="w-3 h-3 animate-spin" /> Rescoring + Regenerating…</>
                          : <><Target className="w-3 h-3" /> Rescore {entry.country} Lessons</>
                        }
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); setCountryFilter(entry.country); }}
                        className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 transition-all"
                      >
                        <AlertCircle className="w-3 h-3" /> Filter to {entry.country}
                      </button>
                      {teacherId && (
                        <button
                          onClick={e => { e.stopPropagation(); loadObjectives(entry.country); }}
                          className="flex items-center gap-1.5 px-3 py-2 bg-violet-50 text-violet-700 rounded-lg text-xs font-medium hover:bg-violet-100 transition-all"
                        >
                          <ClipboardList className="w-3 h-3" /> Generate from Objectives
                        </button>
                      )}
                    </div>

                    {/* Curriculum objectives list with per-objective generate button */}
                    {objectivesCountry === entry.country && teacherId && (
                      <div className="mt-4 border-t border-gray-100 pt-4">
                        <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                          <Target className="w-3.5 h-3.5" /> Curriculum Objectives — {entry.country}
                        </p>
                        {objectivesLoading ? (
                          <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading objectives…
                          </div>
                        ) : objectives.length === 0 ? (
                          <p className="text-xs text-gray-400">No objectives in database for {entry.country}.</p>
                        ) : (
                          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                            {objectives.map(obj => (
                              <div key={obj.id}
                                className="flex items-start gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-gray-700">{obj.topic}</p>
                                  <p className="text-xs text-gray-500 truncate">{obj.learning_objective}</p>
                                  <p className="text-[10px] text-gray-400">{obj.subject}</p>
                                </div>
                                <button
                                  onClick={e => { e.stopPropagation(); handleGenerateFromObjective(obj); }}
                                  disabled={generatingAssessment === obj.id}
                                  className="flex items-center gap-1 px-2 py-1 bg-violet-600 text-white rounded-lg text-[10px] font-medium hover:bg-violet-700 transition-all disabled:opacity-50 flex-shrink-0"
                                >
                                  {generatingAssessment === obj.id
                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                    : <ClipboardList className="w-3 h-3" />
                                  }
                                  Quiz
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Add Knowledge Entry</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="e.g., New curriculum update..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                  <select className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none">
                    {REGIONS.flatMap(r => r.countries).map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none">
                    <option>Curriculum Update</option>
                    <option>Pedagogy</option>
                    <option>Assessment</option>
                    <option>Policy</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                <textarea className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-none" rows={5} placeholder="Describe the update or change..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Impact Level</label>
                <div className="flex gap-3">
                  {['high', 'medium', 'low'].map(level => (
                    <label key={level} className={`flex-1 text-center py-2 rounded-xl border-2 cursor-pointer text-sm font-medium capitalize ${impactColor(level)} hover:opacity-80`}>
                      <input type="radio" name="impact" className="sr-only" /> {level}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowAddModal(false)} className="flex-1 py-3 border border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={() => setShowAddModal(false)} className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium hover:shadow-lg transition-all">Save Entry</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeBase;
