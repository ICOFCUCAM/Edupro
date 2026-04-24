import React, { useState, useEffect, useCallback } from 'react';
import {
  Globe, ArrowRightLeft, Loader2, CheckCircle2, AlertCircle,
  BarChart3, BookOpen, Layers, RefreshCw, ChevronDown, ChevronUp,
  Map, Search, Zap, FileText,
} from 'lucide-react';
import {
  generateCrosswalk, getCrosswalkMatches, getSimilarityMatrix,
  getClassLevelEquivalency, getSubjectEquivalency, localizeLesson,
  AFRICAN_COUNTRIES,
  type CrosswalkMatch, type SimilarityIndex,
  type ClassLevelEquivalency, type SubjectEquivalency,
} from '@/services/crosswalkService';
import { supabase } from '@/lib/supabase';

interface CurriculumCrosswalkProps {
  teacherId:   string;
  userCountry: string;
}

type Tab = 'generate' | 'matrix' | 'matches' | 'class-levels' | 'subjects' | 'localize';

const SCORE_COLOR = (s: number) =>
  s >= 80 ? 'text-emerald-600 bg-emerald-50 border-emerald-200' :
  s >= 60 ? 'text-blue-600 bg-blue-50 border-blue-200' :
  s >= 40 ? 'text-amber-600 bg-amber-50 border-amber-200' :
            'text-red-600 bg-red-50 border-red-200';

const SCORE_BAR = (s: number) =>
  s >= 80 ? 'bg-emerald-500' :
  s >= 60 ? 'bg-blue-500' :
  s >= 40 ? 'bg-amber-400' : 'bg-red-400';

const CurriculumCrosswalk: React.FC<CurriculumCrosswalkProps> = ({ teacherId, userCountry }) => {
  const [activeTab, setActiveTab]       = useState<Tab>('generate');

  // Generate state
  const [srcCountry, setSrcCountry]     = useState(userCountry || 'Nigeria');
  const [tgtCountry, setTgtCountry]     = useState('Ghana');
  const [subject, setSubject]           = useState('');
  const [generating, setGenerating]     = useState(false);
  const [genResult, setGenResult]       = useState<any>(null);
  const [genError, setGenError]         = useState('');

  // Matrix state
  const [matrix, setMatrix]             = useState<SimilarityIndex[]>([]);
  const [matrixLoading, setMatrixLoading] = useState(false);

  // Matches state
  const [matches, setMatches]           = useState<CrosswalkMatch[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);

  // Class levels + subjects
  const [classEquiv, setClassEquiv]     = useState<ClassLevelEquivalency[]>([]);
  const [subjEquiv, setSubjEquiv]       = useState<SubjectEquivalency[]>([]);
  const [equivLoading, setEquivLoading] = useState(false);

  // Localize state
  const [lessons, setLessons]           = useState<any[]>([]);
  const [selectedLesson, setSelectedLesson] = useState('');
  const [localizeTarget, setLocalizeTarget] = useState('Ghana');
  const [localizing, setLocalizing]     = useState(false);
  const [localizeResult, setLocalizeResult] = useState<any>(null);
  const [localizeError, setLocalizeError] = useState('');

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (srcCountry === tgtCountry) { setGenError('Source and target must differ.'); return; }
    setGenerating(true); setGenError(''); setGenResult(null);
    try {
      const result = await generateCrosswalk(srcCountry, tgtCountry, subject || undefined);
      setGenResult(result);
    } catch (e: any) {
      setGenError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const loadMatrix = useCallback(async () => {
    setMatrixLoading(true);
    const data = await getSimilarityMatrix();
    setMatrix(data);
    setMatrixLoading(false);
  }, []);

  const loadMatches = useCallback(async () => {
    setMatchesLoading(true);
    const data = await getCrosswalkMatches(srcCountry, tgtCountry);
    setMatches(data);
    setMatchesLoading(false);
  }, [srcCountry, tgtCountry]);

  const loadEquivalency = useCallback(async () => {
    setEquivLoading(true);
    const [cl, se] = await Promise.all([
      getClassLevelEquivalency(srcCountry, tgtCountry),
      getSubjectEquivalency(srcCountry, tgtCountry),
    ]);
    setClassEquiv(cl);
    setSubjEquiv(se);
    setEquivLoading(false);
  }, [srcCountry, tgtCountry]);

  const loadLessons = useCallback(async () => {
    const { data } = await supabase
      .from('lesson_notes')
      .select('id, title, subject, class_level, country')
      .eq('country', srcCountry)
      .limit(20);
    setLessons(data ?? []);
  }, [srcCountry]);

  useEffect(() => {
    if (activeTab === 'matrix')      loadMatrix();
    if (activeTab === 'matches')     loadMatches();
    if (activeTab === 'class-levels' || activeTab === 'subjects') loadEquivalency();
    if (activeTab === 'localize')    loadLessons();
  }, [activeTab, loadMatrix, loadMatches, loadEquivalency, loadLessons]);

  const handleLocalize = async () => {
    if (!selectedLesson) { setLocalizeError('Select a lesson first.'); return; }
    setLocalizing(true); setLocalizeError(''); setLocalizeResult(null);
    try {
      const result = await localizeLesson(selectedLesson, localizeTarget, teacherId);
      setLocalizeResult(result);
    } catch (e: any) {
      setLocalizeError(e.message);
    } finally {
      setLocalizing(false);
    }
  };

  // ── Tabs ──────────────────────────────────────────────────────────────────

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'generate',    label: 'Generate Crosswalk', icon: Zap },
    { id: 'matrix',      label: 'Similarity Matrix',  icon: BarChart3 },
    { id: 'matches',     label: 'Objective Matches',  icon: ArrowRightLeft },
    { id: 'class-levels', label: 'Class Levels',      icon: Layers },
    { id: 'subjects',    label: 'Subjects',            icon: BookOpen },
    { id: 'localize',    label: 'Localize Lesson',    icon: Globe },
  ];

  // ── Country + subject selectors (shared) ─────────────────────────────────
  const CountryPairSelectors = () => (
    <div className="flex flex-wrap gap-3 items-end">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Source Country</label>
        <select value={srcCountry} onChange={e => setSrcCountry(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          {AFRICAN_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <ArrowRightLeft className="w-4 h-4 text-gray-400 mb-2.5" />
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Target Country</label>
        <select value={tgtCountry} onChange={e => setTgtCountry(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          {AFRICAN_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
    </div>
  );

  // ── Views ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
          <Globe className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">African Curriculum Translation Layer</h2>
          <p className="text-sm text-gray-500">Cross-country objective mapping, lesson localization & regional analysis</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-gray-100 p-1.5 flex gap-1 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
              activeTab === t.id ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50'
            }`}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Generate ── */}
      {activeTab === 'generate' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
          <div>
            <h3 className="font-bold text-gray-900 mb-1">Generate Curriculum Crosswalk</h3>
            <p className="text-sm text-gray-500">
              Embeds objectives for both countries, runs vector similarity matching, and maps class levels and subjects automatically.
            </p>
          </div>

          <CountryPairSelectors />

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Subject (optional — leave blank for all)</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="e.g. Mathematics, Basic Science…"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {genError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {genError}
            </div>
          )}

          {genResult && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <p className="font-semibold text-emerald-700">Crosswalk Generated</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Similarity', value: `${genResult.similarity_score}%` },
                  { label: 'Matched Pairs', value: genResult.matched_pairs },
                  { label: 'Class Level Maps', value: genResult.class_level_mappings },
                  { label: 'Subject Maps', value: genResult.subject_mappings },
                ].map((s, i) => (
                  <div key={i} className="bg-white rounded-lg border border-emerald-200 p-3 text-center">
                    <p className="text-xl font-bold text-emerald-700">{s.value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-emerald-600">
                {genResult.matched_objectives} of {genResult.total_source} {srcCountry} objectives matched in {tgtCountry} curriculum.
                View results in the other tabs.
              </p>
            </div>
          )}

          <button onClick={handleGenerate} disabled={generating || srcCountry === tgtCountry}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {generating
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating… (this may take 30–60s)</>
              : <><Zap className="w-4 h-4" /> Generate Crosswalk</>}
          </button>
        </div>
      )}

      {/* ── Tab: Similarity Matrix ── */}
      {activeTab === 'matrix' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900">Regional Similarity Matrix</h3>
            <button onClick={loadMatrix} className="p-2 hover:bg-gray-100 rounded-lg">
              <RefreshCw className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {matrixLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-blue-400" /></div>
          ) : matrix.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No crosswalk data yet. Generate a crosswalk first.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {matrix.map(row => (
                <div key={row.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {row.country_a} <span className="text-gray-400">↔</span> {row.country_b}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {row.matched_objectives} of {row.total_source_objectives} objectives matched
                    </p>
                  </div>
                  <div className="w-32">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${SCORE_COLOR(row.similarity_score)}`}>
                        {row.similarity_score}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${SCORE_BAR(row.similarity_score)}`}
                        style={{ width: `${row.similarity_score}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Objective Matches ── */}
      {activeTab === 'matches' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="font-bold text-gray-900">Objective Matches</h3>
            <div className="flex items-center gap-2">
              <CountryPairSelectors />
              <button onClick={loadMatches} disabled={matchesLoading}
                className="mt-5 flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {matchesLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                Load
              </button>
            </div>
          </div>

          {matchesLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-blue-400" /></div>
          ) : matches.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <ArrowRightLeft className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No matches found. Generate a crosswalk for this country pair first.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {matches.map(m => {
                const isOpen = expandedMatch === m.id;
                return (
                  <div key={m.id} className="border border-gray-200 rounded-xl overflow-hidden">
                    <button
                      className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left"
                      onClick={() => setExpandedMatch(isOpen ? null : m.id)}
                    >
                      <span className={`text-xs font-bold px-2 py-1 rounded-lg border flex-shrink-0 ${SCORE_COLOR(m.similarity_score)}`}>
                        {m.similarity_score}%
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500">{m.source_topic} → {m.target_topic}</p>
                        <p className="text-sm font-medium text-gray-900 truncate">{m.source_text}</p>
                      </div>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                               : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                    </button>
                    {isOpen && (
                      <div className="border-t border-gray-100 p-4 bg-blue-50/30 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">{srcCountry} — {m.source_class_level}</p>
                          <p className="text-sm text-gray-700">{m.source_text}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">{tgtCountry} — {m.target_class_level}</p>
                          <p className="text-sm text-gray-700">{m.target_text}</p>
                        </div>
                        {m.notes && (
                          <p className="col-span-full text-xs text-gray-500 border-t border-gray-200 pt-2 mt-1">{m.notes}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Class Levels ── */}
      {activeTab === 'class-levels' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="font-bold text-gray-900">Class Level Equivalency</h3>
            <div className="flex items-center gap-2">
              <CountryPairSelectors />
              <button onClick={loadEquivalency} disabled={equivLoading}
                className="mt-5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {equivLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Load'}
              </button>
            </div>
          </div>

          {equivLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-blue-400" /></div>
          ) : classEquiv.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              No class level mappings yet. Generate a crosswalk first.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 pr-4 text-xs font-medium text-gray-500">{srcCountry}</th>
                    <th className="text-center py-2 px-2 text-xs font-medium text-gray-400">≈</th>
                    <th className="text-left py-2 pl-4 text-xs font-medium text-gray-500">{tgtCountry}</th>
                    <th className="text-right py-2 text-xs font-medium text-gray-500">Match</th>
                  </tr>
                </thead>
                <tbody>
                  {classEquiv.map(row => (
                    <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 pr-4 font-medium text-gray-900">{row.class_level_a}</td>
                      <td className="py-2 px-2 text-center text-gray-400">→</td>
                      <td className="py-2 pl-4 text-gray-700">{row.class_level_b}</td>
                      <td className="py-2 text-right">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${SCORE_COLOR(row.equivalency_score)}`}>
                          {row.equivalency_score}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Subjects ── */}
      {activeTab === 'subjects' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="font-bold text-gray-900">Subject Equivalency</h3>
            <div className="flex items-center gap-2">
              <CountryPairSelectors />
              <button onClick={loadEquivalency} disabled={equivLoading}
                className="mt-5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {equivLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Load'}
              </button>
            </div>
          </div>

          {equivLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-blue-400" /></div>
          ) : subjEquiv.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              No subject mappings yet. Generate a crosswalk first.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 pr-4 text-xs font-medium text-gray-500">{srcCountry} Subject</th>
                    <th className="text-center py-2 px-2 text-xs font-medium text-gray-400">≈</th>
                    <th className="text-left py-2 pl-4 text-xs font-medium text-gray-500">{tgtCountry} Subject</th>
                    <th className="text-right py-2 text-xs font-medium text-gray-500">Similarity</th>
                  </tr>
                </thead>
                <tbody>
                  {subjEquiv.map(row => (
                    <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 pr-4 font-medium text-gray-900">{row.subject_a}</td>
                      <td className="py-2 px-2 text-center text-gray-400">→</td>
                      <td className="py-2 pl-4 text-gray-700">{row.subject_b}</td>
                      <td className="py-2 text-right">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${SCORE_COLOR(row.similarity_score)}`}>
                          {row.similarity_score}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Localize Lesson ── */}
      {activeTab === 'localize' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
          <div>
            <h3 className="font-bold text-gray-900 mb-1">Localize Lesson for Another Country</h3>
            <p className="text-sm text-gray-500">
              Rewrites a lesson using the crosswalk — adjusting objectives, examples, terminology, and evaluation to match the target curriculum.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Lesson to Localize ({srcCountry})</label>
              <select
                value={selectedLesson}
                onChange={e => setSelectedLesson(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="">Select a lesson…</option>
                {lessons.map(l => (
                  <option key={l.id} value={l.id}>{l.title} ({l.subject}, {l.class_level})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Target Country</label>
              <select
                value={localizeTarget}
                onChange={e => setLocalizeTarget(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {AFRICAN_COUNTRIES.filter(c => c !== srcCountry).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {localizeError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {localizeError}
            </div>
          )}

          {localizeResult && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <p className="font-semibold text-emerald-700">Lesson Localized Successfully</p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center text-sm">
                <div className="bg-white rounded-lg border border-emerald-200 p-2">
                  <p className="font-bold text-gray-900">{localizeResult.target_country}</p>
                  <p className="text-xs text-gray-500">Target Country</p>
                </div>
                <div className="bg-white rounded-lg border border-emerald-200 p-2">
                  <p className="font-bold text-gray-900">{localizeResult.target_subject}</p>
                  <p className="text-xs text-gray-500">Subject</p>
                </div>
                <div className="bg-white rounded-lg border border-emerald-200 p-2">
                  <p className="font-bold text-gray-900">{localizeResult.target_class_level}</p>
                  <p className="text-xs text-gray-500">Class Level</p>
                </div>
              </div>
              {localizeResult.localization_notes && (
                <div className="bg-white border border-emerald-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-500 mb-1">Localization Notes</p>
                  <p className="text-sm text-gray-700">{localizeResult.localization_notes}</p>
                </div>
              )}
              <p className="text-xs text-emerald-600">Saved to Lesson Library as draft. Open it to review and publish.</p>
            </div>
          )}

          <button onClick={handleLocalize} disabled={localizing || !selectedLesson}
            className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors">
            {localizing
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Localizing…</>
              : <><Globe className="w-4 h-4" /> Localize for {localizeTarget}</>}
          </button>
        </div>
      )}
    </div>
  );
};

export default CurriculumCrosswalk;
