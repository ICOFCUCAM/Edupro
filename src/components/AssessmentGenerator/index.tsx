import React, { useState, useCallback } from 'react';
import {
  FileText, Settings, Sparkles, Save, Printer, Download,
  ChevronDown, ChevronUp, Loader2, CheckCircle2, AlertTriangle,
  BarChart3, Eye, BookOpen, Users, Target, Trash2, RefreshCw, Info,
} from 'lucide-react';
import { SUBJECTS, COUNTRIES_WITH_LEVELS } from '@/lib/constants';
import {
  generateAssessmentPackage, saveAssessmentPackage, getTeacherAssessments,
  getObjectivesForScope, linkObjectivesToAssessment, deleteAssessmentPackage,
  type AssessmentPackage, type AssessmentContent, type AssessmentQuestion,
  type AssessmentSection, type MarkingScheme, type PackageType, type Difficulty,
} from '@/services/assessmentService';

// ── Constants ──────────────────────────────────────────────

const PACKAGE_TYPES: { id: PackageType; label: string; icon: string }[] = [
  { id: 'class_exercise', label: 'Class Exercise', icon: '📝' },
  { id: 'homework', label: 'Homework', icon: '🏠' },
  { id: 'quiz', label: 'Quiz', icon: '⚡' },
  { id: 'test', label: 'Test', icon: '📋' },
  { id: 'exam', label: 'Examination', icon: '📜' },
  { id: 'competency_check', label: 'Competency Check', icon: '✅' },
];

const DIFFICULTIES: { id: Difficulty; label: string; desc: string }[] = [
  { id: 'easy', label: 'Easy', desc: 'Below average / foundational' },
  { id: 'standard', label: 'Standard', desc: 'Grade-appropriate' },
  { id: 'advanced', label: 'Advanced', desc: 'Higher-order thinking' },
  { id: 'mixed', label: 'Mixed', desc: '30% easy · 50% standard · 20% advanced' },
];

const QUESTION_COUNTS = [5, 10, 15, 20, 25, 30];

const ASSESSMENT_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'ar', label: 'العربية' },
  { code: 'pt', label: 'Português' },
  { code: 'sw', label: 'Kiswahili' },
  { code: 'ha', label: 'Hausa' },
];

// ── Sub-components ─────────────────────────────────────────

const QuestionCard: React.FC<{ q: AssessmentQuestion; showAnswer?: boolean; answer?: import('@/services/assessmentService').MarkingAnswer }> = ({
  q, showAnswer, answer,
}) => (
  <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
    <div className="flex items-start gap-3">
      <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
        {q.number}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 font-medium leading-relaxed">{q.text}</p>

        {q.type === 'mcq' && q.options && (
          <div className="mt-2.5 grid grid-cols-1 gap-1.5">
            {Object.entries(q.options).map(([key, val]) => (
              <div
                key={key}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border ${
                  showAnswer && answer?.correct_answer === key
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-medium'
                    : 'bg-gray-50 border-gray-200 text-gray-700'
                }`}
              >
                <span className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 ${
                  showAnswer && answer?.correct_answer === key
                    ? 'bg-emerald-500 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}>{key}</span>
                {val}
              </div>
            ))}
          </div>
        )}

        {q.type === 'true_false' && showAnswer && (
          <p className="mt-2 text-sm font-semibold text-emerald-700">
            Answer: {answer?.correct_answer}
          </p>
        )}

        {(q.type === 'fill_blank' || q.type === 'short_answer') && showAnswer && answer && (
          <div className="mt-2 p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
            <p className="text-xs text-emerald-700 font-semibold">Answer: {answer.correct_answer}</p>
            {answer.explanation && <p className="text-xs text-emerald-600 mt-0.5">{answer.explanation}</p>}
          </div>
        )}

        <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
          <span className="capitalize">{q.type.replace('_', ' ')}</span>
          <span>·</span>
          <span>{q.marks} mark{q.marks !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  </div>
);

const SectionView: React.FC<{
  section: AssessmentSection;
  showAnswers: boolean;
  answers: MarkingScheme['answers'];
}> = ({ section, showAnswers, answers }) => {
  const answerMap = Object.fromEntries(answers.map((a) => [a.number, a]));
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="font-semibold text-gray-800 text-sm">{section.title}</h3>
        {section.instructions && (
          <span className="text-xs text-gray-500 italic">— {section.instructions}</span>
        )}
      </div>
      <div className="space-y-2.5">
        {section.questions.map((q) => (
          <QuestionCard
            key={q.number}
            q={q}
            showAnswer={showAnswers}
            answer={answerMap[q.number]}
          />
        ))}
      </div>
    </div>
  );
};

const AssessmentPreview: React.FC<{
  content: AssessmentContent;
  markingScheme: MarkingScheme;
  activeView: 'questions' | 'scheme';
  activeVariant: 'main' | 'easy' | 'standard' | 'advanced';
  variants?: import('@/services/assessmentService').AssessmentVariants;
}> = ({ content, markingScheme, activeView, activeVariant, variants }) => {
  const displayContent =
    activeVariant === 'main' || !variants
      ? content
      : activeVariant === 'easy'
      ? variants.easy
      : activeVariant === 'standard'
      ? variants.standard
      : variants.advanced;

  if (activeView === 'scheme') {
    return (
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-amber-800 mb-2 flex items-center gap-1">
            <Info className="w-3.5 h-3.5" /> Teacher Guidance
          </p>
          <p className="text-sm text-amber-700">{markingScheme.teacher_guidance}</p>
        </div>
        {markingScheme.grade_boundaries && (
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-700 mb-2">Grade Boundaries</p>
            <div className="flex gap-3 flex-wrap">
              {Object.entries(markingScheme.grade_boundaries).map(([grade, pct]) => (
                <div key={grade} className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 rounded-lg border border-gray-200">
                  <span className="font-bold text-sm text-gray-800">{grade}</span>
                  <span className="text-xs text-gray-500">{pct}%+</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="space-y-2">
          {markingScheme.answers.map((ans) => (
            <div key={ans.number} className="flex items-start gap-3 bg-white border border-gray-200 rounded-xl p-3">
              <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                {ans.number}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-gray-800">{ans.correct_answer}</span>
                  <span className="text-xs text-gray-400 capitalize">{ans.type.replace('_', ' ')}</span>
                  <span className="text-xs text-gray-400 ml-auto">{ans.marks} mark{ans.marks !== 1 ? 's' : ''}</span>
                </div>
                {ans.explanation && <p className="text-xs text-gray-500 mt-0.5">{ans.explanation}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <h2 className="font-bold text-gray-900 text-base">{displayContent.title}</h2>
        <p className="text-xs text-gray-600 mt-1">{displayContent.instructions}</p>
        <div className="flex gap-3 mt-2 text-xs text-gray-500">
          <span>⏱ {displayContent.duration_minutes} min</span>
          <span>·</span>
          <span>📊 {displayContent.total_marks} marks</span>
        </div>
      </div>
      {displayContent.sections?.map((section, i) => (
        <SectionView
          key={i}
          section={section}
          showAnswers={false}
          answers={markingScheme.answers}
        />
      ))}
    </div>
  );
};

// ── Package list item ──────────────────────────────────────

const PackageListItem: React.FC<{
  pkg: AssessmentPackage;
  onView: (pkg: AssessmentPackage) => void;
  onDelete: (id: string) => void;
}> = ({ pkg, onView, onDelete }) => (
  <div className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl hover:shadow-sm transition-shadow">
    <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 text-lg">
      {PACKAGE_TYPES.find(t => t.id === pkg.package_type)?.icon ?? '📄'}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-gray-800 truncate">{pkg.title ?? pkg.topic}</p>
      <p className="text-xs text-gray-500">
        {pkg.subject} · {pkg.class_level} · {pkg.difficulty} · {pkg.question_count} Qs
      </p>
    </div>
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <button
        onClick={() => onView(pkg)}
        className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
        title="View"
      >
        <Eye className="w-4 h-4" />
      </button>
      <button
        onClick={() => onDelete(pkg.id!)}
        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
        title="Delete"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  </div>
);

// ── Main Component ─────────────────────────────────────────

interface AssessmentGeneratorProps {
  teacherId?: string;
  organizationId?: string;
  teacherCountry?: string;
  prefillTopic?: string;
  prefillSubject?: string;
  prefillClassLevel?: string;
  mode?: 'teacher' | 'school_exam_builder';
}

const AssessmentGenerator: React.FC<AssessmentGeneratorProps> = ({
  teacherId, organizationId, teacherCountry,
  prefillTopic, prefillSubject, prefillClassLevel,
  mode = 'teacher',
}) => {
  // ── Form state ─────────────────────────────────────────
  const defaultCountry = teacherCountry ?? 'Nigeria';
  const [country, setCountry] = useState(defaultCountry);
  const [subject, setSubject] = useState(prefillSubject ?? 'Mathematics');
  const [classLevel, setClassLevel] = useState(
    prefillClassLevel ?? (COUNTRIES_WITH_LEVELS[defaultCountry]?.levels[3] ?? 'Primary 4'),
  );
  const [topic, setTopic] = useState(prefillTopic ?? '');
  const [packageType, setPackageType] = useState<PackageType>('quiz');
  const [difficulty, setDifficulty] = useState<Difficulty>('standard');
  const [questionCount, setQuestionCount] = useState(10);
  const [language, setLanguage] = useState('en');
  const [term, setTerm] = useState('');
  const [week, setWeek] = useState('');
  const [differentiated, setDifferentiated] = useState(false);

  // ── UI state ───────────────────────────────────────────
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ── Generated content ──────────────────────────────────
  const [generated, setGenerated] = useState<{
    content: AssessmentContent;
    markingScheme: MarkingScheme;
    variants?: import('@/services/assessmentService').AssessmentVariants;
  } | null>(null);

  // ── Preview state ──────────────────────────────────────
  const [activeView, setActiveView] = useState<'questions' | 'scheme'>('questions');
  const [activeVariant, setActiveVariant] = useState<'main' | 'easy' | 'standard' | 'advanced'>('main');

  // ── History ────────────────────────────────────────────
  const [history, setHistory] = useState<AssessmentPackage[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [activePanel, setActivePanel] = useState<'generate' | 'history'>('generate');

  const countryLevels = COUNTRIES_WITH_LEVELS[country]?.levels ?? [];

  const loadHistory = useCallback(async () => {
    if (!teacherId) return;
    try {
      const pkgs = await getTeacherAssessments(teacherId, 30);
      setHistory(pkgs);
      setHistoryLoaded(true);
    } catch { /* silent */ }
  }, [teacherId]);

  // ── Generate ───────────────────────────────────────────
  const handleGenerate = async () => {
    if (!topic.trim()) { setError('Please enter a topic.'); return; }
    setError(null);
    setSuccessMsg(null);
    setGenerating(true);
    setGenerated(null);

    try {
      // Fetch objectives if available
      let objectivesText = '';
      try {
        const objs = await getObjectivesForScope(
          country, subject, classLevel,
          term || undefined, week ? parseInt(week) : undefined,
        );
        if (objs.length) {
          objectivesText = objs.map((o) => `- ${o.topic}: ${o.learning_objective}`).join('\n');
        }
      } catch { /* non-blocking */ }

      const result = await generateAssessmentPackage({
        country, subject, classLevel, topic: topic.trim(),
        packageType, difficulty, questionCount,
        language, differentiated,
        objectives: objectivesText,
        term: term || undefined,
        week: week ? parseInt(week) : undefined,
      });
      setGenerated(result);
      setActiveView('questions');
      setActiveVariant('main');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  // ── Save ───────────────────────────────────────────────
  const handleSave = async () => {
    if (!generated || !teacherId) return;
    setSaving(true);
    setError(null);
    try {
      const packageId = await saveAssessmentPackage(
        {
          country, subject, class_level: classLevel, topic,
          package_type: packageType, difficulty, language,
          question_count: questionCount,
          term: term || undefined, week: week ? parseInt(week) : undefined,
          content: generated.content,
          marking_scheme: generated.markingScheme,
          variants: generated.variants,
          is_differentiated: differentiated,
        },
        teacherId,
        organizationId,
      );

      // Link objectives in background
      try {
        const objs = await getObjectivesForScope(country, subject, classLevel);
        if (objs.length) {
          await linkObjectivesToAssessment(packageId, objs.map(o => o.id));
        }
      } catch { /* non-blocking */ }

      setSuccessMsg('Assessment saved successfully!');
      if (historyLoaded) await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this assessment?')) return;
    try {
      await deleteAssessmentPackage(id);
      setHistory(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  // ── View from history ──────────────────────────────────
  const handleViewFromHistory = (pkg: AssessmentPackage) => {
    setGenerated({
      content: pkg.content,
      markingScheme: pkg.marking_scheme,
      variants: pkg.variants,
    });
    setCountry(pkg.country);
    setSubject(pkg.subject);
    setClassLevel(pkg.class_level);
    setTopic(pkg.topic);
    setPackageType(pkg.package_type);
    setDifficulty(pkg.difficulty);
    setQuestionCount(pkg.question_count);
    setDifferentiated(pkg.is_differentiated);
    setActivePanel('generate');
    setActiveView('questions');
    setActiveVariant('main');
  };

  // ── Print ──────────────────────────────────────────────
  const handlePrint = () => { window.print(); };

  // ── Render ─────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-blue-500 flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {mode === 'school_exam_builder' ? 'School Exam Builder' : 'Assessment Generator'}
            </h1>
            <p className="text-sm text-gray-500">AI-generated assessments with full marking schemes</p>
          </div>
        </div>

        {/* Panel toggle */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mt-4">
          <button
            onClick={() => setActivePanel('generate')}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
              activePanel === 'generate' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 inline mr-1.5" />Generate
          </button>
          <button
            onClick={() => { setActivePanel('history'); if (!historyLoaded) loadHistory(); }}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
              activePanel === 'history' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 inline mr-1.5" />My Assessments
            {history.length > 0 && (
              <span className="ml-1.5 bg-blue-100 text-blue-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
                {history.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── History panel ── */}
      {activePanel === 'history' && (
        <div>
          {!historyLoaded ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No assessments yet. Generate your first one!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map(pkg => (
                <PackageListItem
                  key={pkg.id}
                  pkg={pkg}
                  onView={handleViewFromHistory}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Generate panel ── */}
      {activePanel === 'generate' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Form */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Settings className="w-4 h-4 text-violet-600" /> Assessment Settings
              </h2>

              {/* Country */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">Country</label>
                <select
                  value={country}
                  onChange={e => { setCountry(e.target.value); setClassLevel(COUNTRIES_WITH_LEVELS[e.target.value]?.levels[3] ?? ''); }}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                >
                  {Object.keys(COUNTRIES_WITH_LEVELS).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Subject */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">Subject</label>
                <select
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                >
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Class level */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">Class Level</label>
                <select
                  value={classLevel}
                  onChange={e => setClassLevel(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                >
                  {countryLevels.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>

              {/* Topic */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">Topic *</label>
                <input
                  type="text"
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  placeholder="e.g. Addition and Subtraction"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>

              {/* Package type */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Assessment Type</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {PACKAGE_TYPES.map(pt => (
                    <button
                      key={pt.id}
                      onClick={() => setPackageType(pt.id)}
                      className={`px-2 py-2 rounded-xl border text-xs font-medium text-center transition-all ${
                        packageType === pt.id
                          ? 'bg-violet-600 border-violet-600 text-white'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <div className="text-base mb-0.5">{pt.icon}</div>
                      {pt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Difficulty</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {DIFFICULTIES.map(d => (
                    <button
                      key={d.id}
                      onClick={() => setDifficulty(d.id)}
                      className={`px-3 py-2 rounded-xl border text-left transition-all ${
                        difficulty === d.id
                          ? 'bg-blue-50 border-blue-500 text-blue-800'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <div className="text-xs font-semibold">{d.label}</div>
                      <div className="text-[10px] text-gray-500 leading-tight mt-0.5">{d.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Question count + Language */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Questions</label>
                  <select
                    value={questionCount}
                    onChange={e => setQuestionCount(parseInt(e.target.value))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  >
                    {QUESTION_COUNTS.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Language</label>
                  <select
                    value={language}
                    onChange={e => setLanguage(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  >
                    {ASSESSMENT_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Term / Week */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Term (optional)</label>
                  <input
                    type="text"
                    value={term}
                    onChange={e => setTerm(e.target.value)}
                    placeholder="Term 1"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Week (optional)</label>
                  <input
                    type="number"
                    value={week}
                    onChange={e => setWeek(e.target.value)}
                    placeholder="1"
                    min="1"
                    max="13"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Differentiated toggle */}
              <div className="flex items-center justify-between py-3 border-t border-gray-100">
                <div>
                  <p className="text-sm font-medium text-gray-700">Differentiated Versions</p>
                  <p className="text-xs text-gray-500">Generate Easy / Standard / Advanced variants</p>
                </div>
                <button
                  onClick={() => setDifferentiated(v => !v)}
                  className={`w-11 h-6 rounded-full transition-colors relative ${differentiated ? 'bg-violet-600' : 'bg-gray-300'}`}
                >
                  <span className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${differentiated ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              {/* Generate button */}
              <button
                onClick={handleGenerate}
                disabled={generating || !topic.trim()}
                className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-violet-600 to-blue-500 text-white rounded-xl font-semibold text-sm hover:shadow-lg hover:shadow-violet-200 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Generate Assessment</>
                )}
              </button>

              {error && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}
              {successMsg && (
                <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-emerald-700">{successMsg}</p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Preview */}
          <div className="lg:col-span-3">
            {!generated && !generating && (
              <div className="h-full flex items-center justify-center py-24 text-center">
                <div>
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-gray-300" />
                  </div>
                  <p className="text-sm text-gray-400">Fill in the form and click Generate Assessment</p>
                </div>
              </div>
            )}

            {generating && (
              <div className="h-full flex items-center justify-center py-24">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4 animate-pulse">
                    <Sparkles className="w-8 h-8 text-violet-500" />
                  </div>
                  <p className="text-sm font-medium text-gray-700">Generating your assessment…</p>
                  <p className="text-xs text-gray-400 mt-1">This takes 10–20 seconds</p>
                </div>
              </div>
            )}

            {generated && (
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                {/* Toolbar */}
                <div className="flex items-center gap-2 p-3 border-b border-gray-100 bg-gray-50 flex-wrap">
                  {/* View tabs */}
                  <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-0.5">
                    <button
                      onClick={() => setActiveView('questions')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${activeView === 'questions' ? 'bg-violet-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                      <Eye className="w-3.5 h-3.5 inline mr-1" />Questions
                    </button>
                    <button
                      onClick={() => setActiveView('scheme')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${activeView === 'scheme' ? 'bg-violet-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                      <Target className="w-3.5 h-3.5 inline mr-1" />Marking Scheme
                    </button>
                  </div>

                  {/* Variant tabs (differentiated) */}
                  {generated.variants && (
                    <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-0.5">
                      {(['main', 'easy', 'standard', 'advanced'] as const).map((v) => (
                        <button
                          key={v}
                          onClick={() => setActiveVariant(v)}
                          className={`px-2 py-1.5 text-xs font-medium rounded-lg transition-all capitalize ${activeVariant === v ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                          {v === 'main' ? 'Main' : v}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="ml-auto flex items-center gap-1.5">
                    <button
                      onClick={handleGenerate}
                      disabled={generating}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
                      title="Regenerate"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                    </button>
                    <button
                      onClick={handlePrint}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
                    >
                      <Printer className="w-3.5 h-3.5" /> Print
                    </button>
                    {teacherId && (
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-violet-600 rounded-xl hover:bg-violet-700 transition-all disabled:opacity-60"
                      >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Save
                      </button>
                    )}
                  </div>
                </div>

                {/* Assessment content */}
                <div className="p-5 max-h-[72vh] overflow-y-auto">
                  <AssessmentPreview
                    content={generated.content}
                    markingScheme={generated.markingScheme}
                    activeView={activeView}
                    activeVariant={activeVariant}
                    variants={generated.variants}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AssessmentGenerator;
