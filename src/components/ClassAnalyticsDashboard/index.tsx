import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, BarChart3, Target, AlertTriangle, CheckCircle2, Loader2,
  Plus, Trash2, Upload, Download, ChevronDown, ChevronUp, Brain,
  TrendingUp, Award, BookOpen, RefreshCw, X,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import {
  getClassPerformanceSummary, getClassObjectiveMastery, calculateMasteryLevel,
  addStudentResult, updateClassPerformanceSummary, type ClassPerformanceSummary,
  type ObjectiveMasteryRow, type MasteryLevel,
} from '@/services/performanceService';
import {
  getStudents, addStudent, deleteStudent, bulkAddStudents, parseStudentCSV, type Student,
} from '@/services/studentService';
import { generateRemediation } from '@/services/remediationService';
import { supabase } from '@/lib/supabase';

interface ClassAnalyticsDashboardProps {
  organizationId: string;
  teacherId: string;
  organizationCountry?: string;
}

type DashTab = 'students' | 'results' | 'mastery' | 'remediation';

const MASTERY_COLORS: Record<MasteryLevel, string> = {
  not_started: '#ef4444',
  developing: '#f97316',
  proficient: '#3b82f6',
  mastered: '#22c55e',
};

const MASTERY_LABELS: Record<MasteryLevel, string> = {
  not_started: 'Not Started',
  developing: 'Developing',
  proficient: 'Proficient',
  mastered: 'Mastered',
};

interface AssessmentOption {
  id: string;
  title: string;
  subject: string;
  class_level: string;
  total_marks: number;
}

const ClassAnalyticsDashboard: React.FC<ClassAnalyticsDashboardProps> = ({
  organizationId, teacherId, organizationCountry = 'Nigeria',
}) => {
  const [tab, setTab] = useState<DashTab>('students');

  // Filters
  const [classLevel, setClassLevel] = useState('');
  const [subject, setSubject] = useState('');

  // Data
  const [students, setStudents] = useState<Student[]>([]);
  const [summary, setSummary] = useState<ClassPerformanceSummary | null>(null);
  const [masteryRows, setMasteryRows] = useState<ObjectiveMasteryRow[]>([]);
  const [assessments, setAssessments] = useState<AssessmentOption[]>([]);
  const [loading, setLoading] = useState(false);

  // Add student form
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newFirst, setNewFirst] = useState('');
  const [newLast, setNewLast] = useState('');
  const [newId, setNewId] = useState('');
  const [addingStudent, setAddingStudent] = useState(false);
  const [studentMsg, setStudentMsg] = useState('');

  // CSV upload
  const [csvText, setCsvText] = useState('');
  const [showCsvUpload, setShowCsvUpload] = useState(false);
  const [csvUploading, setCsvUploading] = useState(false);

  // Score entry
  const [selectedAssessment, setSelectedAssessment] = useState('');
  const [scores, setScores] = useState<Record<string, string>>({});
  const [savingScores, setSavingScores] = useState(false);
  const [scoreMsg, setScoreMsg] = useState('');

  // Remediation
  const [generatingRem, setGeneratingRem] = useState<string>('');
  const [remMsg, setRemMsg] = useState('');

  const loadData = useCallback(async () => {
    if (!classLevel || !subject) return;
    setLoading(true);
    const [studentsData, summaryData, masteryData] = await Promise.all([
      getStudents(organizationId, classLevel),
      getClassPerformanceSummary(organizationId, classLevel, subject),
      getClassObjectiveMastery(organizationId, classLevel, subject),
    ]);
    setStudents(studentsData);
    setSummary(summaryData[0] || null);
    setMasteryRows(masteryData);
    setLoading(false);
  }, [organizationId, classLevel, subject]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load assessments for score entry
  useEffect(() => {
    if (!subject || !classLevel) return;
    supabase
      .from('assessment_packages')
      .select('id, title, subject, class_level, total_marks')
      .eq('subject', subject)
      .eq('class_level', classLevel)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => setAssessments((data || []) as AssessmentOption[]));
  }, [subject, classLevel]);

  const handleAddStudent = async () => {
    if (!newFirst || !newLast || !classLevel) return;
    setAddingStudent(true);
    const res = await addStudent(organizationId, classLevel, newFirst, newLast, teacherId, newId || undefined);
    setAddingStudent(false);
    if (res.success) {
      setStudentMsg('Student added.');
      setNewFirst(''); setNewLast(''); setNewId('');
      setShowAddStudent(false);
      await loadData();
    } else {
      setStudentMsg(`Error: ${res.error}`);
    }
    setTimeout(() => setStudentMsg(''), 3000);
  };

  const handleCsvUpload = async () => {
    if (!csvText || !classLevel) return;
    setCsvUploading(true);
    const parsed = parseStudentCSV(csvText);
    const res = await bulkAddStudents(organizationId, classLevel, parsed, teacherId);
    setCsvUploading(false);
    if (res.success) {
      setStudentMsg(`Imported ${res.count} student(s).`);
      setCsvText(''); setShowCsvUpload(false);
      await loadData();
    } else {
      setStudentMsg(`Error: ${res.errors.join(', ')}`);
    }
    setTimeout(() => setStudentMsg(''), 4000);
  };

  const handleDeleteStudent = async (id: string) => {
    if (!confirm('Remove this student and all their data?')) return;
    await deleteStudent(id);
    await loadData();
  };

  const handleSaveScores = async () => {
    if (!selectedAssessment) return;
    const assessment = assessments.find((a) => a.id === selectedAssessment);
    if (!assessment) return;

    setSavingScores(true);
    const entries = Object.entries(scores).filter(([, v]) => v !== '');
    let saved = 0;
    for (const [studentId, scoreStr] of entries) {
      const score = parseFloat(scoreStr);
      if (isNaN(score) || score < 0) continue;
      const res = await addStudentResult(
        studentId,
        selectedAssessment,
        score,
        assessment.total_marks || 100,
        teacherId,
        organizationId
      );
      if (res.success) saved++;
    }
    setSavingScores(false);
    setScoreMsg(`Saved ${saved} result(s). Analytics updating...`);
    setScores({});
    setTimeout(async () => {
      setScoreMsg('');
      await loadData();
    }, 2000);
  };

  const handleGenerateRemediation = async (row: ObjectiveMasteryRow) => {
    setGeneratingRem(row.objective_id);
    setRemMsg('');
    const res = await generateRemediation(
      {
        id: row.objective_id,
        learning_objective: row.learning_objective,
        topic: row.topic,
        country: organizationCountry,
        subject,
        class_level: classLevel,
      },
      'developing',
      teacherId,
      'en',
      organizationId
    );
    setGeneratingRem('');
    if (res.success) {
      setRemMsg(`Remediation generated for "${row.topic}". It's now in the assessment library.`);
    } else {
      setRemMsg(`Error: ${res.error}`);
    }
    setTimeout(() => setRemMsg(''), 5000);
  };

  const masteryChartData = summary
    ? Object.entries(summary.mastery_distribution).map(([level, count]) => ({
        name: MASTERY_LABELS[level as MasteryLevel],
        count,
        fill: MASTERY_COLORS[level as MasteryLevel],
      }))
    : [];

  const tabs: { id: DashTab; label: string; icon: React.ReactNode }[] = [
    { id: 'students', label: 'Students', icon: <Users className="w-4 h-4" /> },
    { id: 'results', label: 'Enter Results', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'mastery', label: 'Mastery Map', icon: <Target className="w-4 h-4" /> },
    { id: 'remediation', label: 'Remediation', icon: <Brain className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-5">
      {/* Filter bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Class Level</label>
            <input
              value={classLevel}
              onChange={(e) => setClassLevel(e.target.value)}
              placeholder="e.g. JSS 1, Grade 5"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Mathematics"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <button
            onClick={loadData}
            disabled={!classLevel || !subject}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Load
          </button>
          {summary && (
            <div className="ml-auto flex items-center gap-4 text-sm text-gray-600">
              <span className="font-semibold">{summary.student_count} students</span>
              <span>Avg: <strong className={summary.average_score < 50 ? 'text-red-600' : 'text-emerald-600'}>{summary.average_score.toFixed(1)}%</strong></span>
              {summary.intervention_needed && (
                <span className="flex items-center gap-1 text-red-600 font-medium">
                  <AlertTriangle className="w-4 h-4" /> Intervention needed
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Intervention alert */}
      {summary?.intervention_needed && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-red-800 text-sm">Class average below 50% — Intervention Recommended</p>
            <p className="text-red-700 text-xs mt-1">
              {summary.weak_objectives.length > 0
                ? `Struggling areas: ${summary.weak_objectives.slice(0, 3).join('; ')}.`
                : 'Use the Remediation tab to generate targeted support materials.'}
            </p>
          </div>
        </div>
      )}

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {(Object.entries(summary.mastery_distribution) as [MasteryLevel, number][]).map(([level, count]) => (
            <div key={level} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
              <div className="text-2xl font-bold" style={{ color: MASTERY_COLORS[level] }}>{count}</div>
              <div className="text-xs text-gray-500 mt-1">{MASTERY_LABELS[level]}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tab nav */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-white shadow-sm text-blue-700' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
        </div>
      )}

      {!loading && (
        <>
          {/* ── Students tab ── */}
          {tab === 'students' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" /> Students ({students.length})
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowCsvUpload(!showCsvUpload)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
                  >
                    <Upload className="w-4 h-4" /> CSV
                  </button>
                  <button
                    onClick={() => setShowAddStudent(!showAddStudent)}
                    disabled={!classLevel}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-40"
                  >
                    <Plus className="w-4 h-4" /> Add Student
                  </button>
                </div>
              </div>

              {studentMsg && (
                <div className={`mb-3 p-3 rounded-lg text-sm ${studentMsg.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  {studentMsg}
                </div>
              )}

              {showCsvUpload && (
                <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <p className="text-xs text-gray-500 mb-2">Paste CSV/TSV: first_name, last_name, student_id (optional), gender (optional)</p>
                  <textarea
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    placeholder="John,Doe,S001,male&#10;Jane,Smith,S002,female"
                    rows={5}
                    className="w-full border border-gray-200 rounded-lg p-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={handleCsvUpload}
                      disabled={csvUploading || !csvText}
                      className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-40"
                    >
                      {csvUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      Import
                    </button>
                    <button onClick={() => setShowCsvUpload(false)} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {showAddStudent && (
                <div className="mb-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <div className="flex gap-3 flex-wrap">
                    <input value={newFirst} onChange={(e) => setNewFirst(e.target.value)} placeholder="First name*"
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-[120px] focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    <input value={newLast} onChange={(e) => setNewLast(e.target.value)} placeholder="Last name*"
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-[120px] focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    <input value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="Student ID (optional)"
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    <button onClick={handleAddStudent} disabled={addingStudent || !newFirst || !newLast}
                      className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-40">
                      {addingStudent ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Save
                    </button>
                  </div>
                </div>
              )}

              {students.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">{classLevel ? 'No students for this class yet.' : 'Enter a class level above to see students.'}</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {students.map((s) => (
                    <div key={s.id} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                          {s.first_name[0]}{s.last_name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{s.first_name} {s.last_name}</p>
                          {s.student_identifier && <p className="text-xs text-gray-400">{s.student_identifier}</p>}
                        </div>
                      </div>
                      <button onClick={() => handleDeleteStudent(s.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Results tab ── */}
          {tab === 'results' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" /> Enter Assessment Results
              </h3>

              {scoreMsg && (
                <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 rounded-lg text-sm">{scoreMsg}</div>
              )}

              <div className="mb-5">
                <label className="block text-xs font-medium text-gray-600 mb-1">Select Assessment</label>
                <select
                  value={selectedAssessment}
                  onChange={(e) => setSelectedAssessment(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full max-w-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="">-- Choose assessment --</option>
                  {assessments.map((a) => (
                    <option key={a.id} value={a.id}>{a.title} (/{a.total_marks})</option>
                  ))}
                </select>
              </div>

              {selectedAssessment && students.length > 0 && (
                <>
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {students.map((s) => {
                      const assessment = assessments.find((a) => a.id === selectedAssessment);
                      const maxMark = assessment?.total_marks || 100;
                      const pct = scores[s.id] ? Math.round((parseFloat(scores[s.id]) / maxMark) * 100) : null;
                      const masteryColor = pct !== null ? MASTERY_COLORS[calculateMasteryLevel(pct)] : '';
                      return (
                        <div key={s.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs flex-shrink-0">
                            {s.first_name[0]}{s.last_name[0]}
                          </div>
                          <span className="text-sm text-gray-700 flex-1 min-w-0 truncate">{s.first_name} {s.last_name}</span>
                          <input
                            type="number"
                            min={0}
                            max={maxMark}
                            value={scores[s.id] ?? ''}
                            onChange={(e) => setScores((prev) => ({ ...prev, [s.id]: e.target.value }))}
                            placeholder={`/ ${maxMark}`}
                            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm w-24 text-right focus:outline-none focus:ring-2 focus:ring-blue-400"
                          />
                          {pct !== null && (
                            <span className="text-xs font-semibold w-10 text-right" style={{ color: masteryColor }}>
                              {pct}%
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={handleSaveScores}
                      disabled={savingScores || Object.keys(scores).length === 0}
                      className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-40"
                    >
                      {savingScores ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      Save Results
                    </button>
                  </div>
                </>
              )}

              {students.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">Add students in the Students tab first.</p>
              )}
            </div>
          )}

          {/* ── Mastery Map tab ── */}
          {tab === 'mastery' && (
            <div className="space-y-5">
              {masteryChartData.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                  <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Award className="w-5 h-5 text-blue-600" /> Mastery Distribution
                  </h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={masteryChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {masteryChartData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-600" /> Objective Mastery Heatmap
                </h3>
                {masteryRows.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No objective data yet. Enter results to see mastery breakdown.</p>
                ) : (
                  <div className="space-y-3">
                    {masteryRows.map((row) => {
                      const total = row.not_started_count + row.developing_count + row.proficient_count + row.mastered_count;
                      const pct = total > 0 ? Math.round((row.mastered_count + row.proficient_count) / total * 100) : 0;
                      return (
                        <div key={row.objective_id} className="p-3 bg-gray-50 rounded-xl">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <p className="text-sm font-medium text-gray-900 leading-snug">{row.learning_objective}</p>
                              <p className="text-xs text-gray-400">{row.topic}</p>
                            </div>
                            <span className={`text-sm font-bold flex-shrink-0 ${pct >= 65 ? 'text-emerald-600' : 'text-red-500'}`}>{pct}%</span>
                          </div>
                          <div className="flex gap-1.5">
                            {([
                              { key: 'not_started', count: row.not_started_count },
                              { key: 'developing', count: row.developing_count },
                              { key: 'proficient', count: row.proficient_count },
                              { key: 'mastered', count: row.mastered_count },
                            ] as { key: MasteryLevel; count: number }[]).map(({ key, count }) =>
                              count > 0 ? (
                                <div key={key} className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full"
                                  style={{ backgroundColor: MASTERY_COLORS[key] + '20', color: MASTERY_COLORS[key] }}>
                                  {count} {MASTERY_LABELS[key]}
                                </div>
                              ) : null
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Remediation tab ── */}
          {tab === 'remediation' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-600" /> Remediation Generator
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Generate simplified lessons, exercises, and quizzes for objectives where students are struggling.
              </p>

              {remMsg && (
                <div className={`mb-4 p-3 rounded-lg text-sm ${remMsg.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  {remMsg}
                </div>
              )}

              {masteryRows.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No mastery data yet. Enter results and check the Mastery Map tab.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {masteryRows
                    .filter((r) => r.avg_confidence < 65)
                    .map((row) => {
                      const isGenerating = generatingRem === row.objective_id;
                      const needsIntervention = row.avg_confidence < 50;
                      return (
                        <div key={row.objective_id} className={`p-4 rounded-xl border ${needsIntervention ? 'border-red-200 bg-red-50' : 'border-orange-200 bg-orange-50'}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                {needsIntervention ? (
                                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                                ) : (
                                  <TrendingUp className="w-4 h-4 text-orange-500 flex-shrink-0" />
                                )}
                                <p className="text-sm font-medium text-gray-900 leading-snug">{row.learning_objective}</p>
                              </div>
                              <p className="text-xs text-gray-500 ml-6">Topic: {row.topic} · Avg confidence: {row.avg_confidence.toFixed(0)}%</p>
                              <div className="flex gap-2 mt-2 ml-6 text-xs text-gray-500">
                                <span className="text-red-600">{row.not_started_count} not started</span>
                                <span className="text-orange-500">{row.developing_count} developing</span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleGenerateRemediation(row)}
                              disabled={isGenerating || !!generatingRem}
                              className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700 disabled:opacity-40 flex-shrink-0"
                            >
                              {isGenerating ? (
                                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</>
                              ) : (
                                <><Brain className="w-3.5 h-3.5" /> Generate</>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  {masteryRows.filter((r) => r.avg_confidence < 65).length === 0 && (
                    <div className="text-center py-10 text-gray-400">
                      <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-30 text-emerald-500" />
                      <p className="text-sm">All objectives are above 65% confidence. Great work!</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ClassAnalyticsDashboard;
