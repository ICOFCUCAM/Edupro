import React, { useState, useEffect, useCallback } from 'react';
import {
  Globe, ArrowRightLeft, Loader2, CheckCircle2, AlertCircle,
  BarChart3, BookOpen, Layers, RefreshCw, ChevronDown, ChevronUp,
  Map, Search, Zap, FileText, Bell, BookMarked,
} from 'lucide-react';
import {
  generateCrosswalk, getCrosswalkMatches, getSimilarityMatrix,
  getClassLevelEquivalency, getSubjectEquivalency, localizeLesson,
  AFRICAN_COUNTRIES,
  type CrosswalkMatch, type SimilarityIndex,
  type ClassLevelEquivalency, type SubjectEquivalency,
} from '@/services/crosswalkService';
import {
  compareTextbooksAcrossCountries,
  type CrossCountryTextbookComparison,
} from '@/services/textbookService';
import {
  getAlertsForCountry, markAlertsRead, broadcastCurriculumUpdate,
  type CurriculumAlert,
} from '@/services/alertService';
import { supabase } from '@/lib/supabase';

interface CurriculumCrosswalkProps {
  teacherId:   string;
  userCountry: string;
}

type Tab = 'generate' | 'matrix' | 'matches' | 'class-levels' | 'subjects' | 'localize' | 'alerts' | 'textbook-compare';

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

  // Alerts state
  const [alerts, setAlerts]             = useState<CurriculumAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [broadcastDone, setBroadcastDone] = useState<string>('');
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastDesc, setBroadcastDesc]   = useState('');
  const [broadcastType, setBroadcastType]   = useState<'added' | 'updated' | 'removed'>('updated');

  // Textbook compare state
  const [tbCompare, setTbCompare]       = useState<CrossCountryTextbookComparison | null>(null);
  const [tbComparing, setTbComparing]   = useState(false);
  const [tbCompareError, setTbCompareError] = useState('');
  const [tbSubject, setTbSubject]       = useState('');

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

  const loadAlerts = useCallback(async () => {
    setAlertsLoading(true);
    const data = await getAlertsForCountry(userCountry, 50);
    setAlerts(data);
    setAlertsLoading(false);
    // Mark all as read for this teacher
    if (data.length && teacherId) {
      const unread = data.filter(a => !a.read_by[teacherId]).map(a => a.id);
      if (unread.length) markAlertsRead(unread, teacherId).catch(() => {});
    }
  }, [userCountry, teacherId]);

  const handleBroadcast = async () => {
    setBroadcastLoading(true); setBroadcastDone('');
    try {
      const result = await broadcastCurriculumUpdate({
        sourceCountry: srcCountry,
        changeType:    broadcastType,
        subject:       broadcastSubject || undefined,
        description:   broadcastDesc || undefined,
      });
      setBroadcastDone(
        `Alert sent to ${result.affected_countries.length} countries: ${result.affected_countries.join(', ')}`
      );
      setBroadcastDesc(''); setBroadcastSubject('');
    } catch (e: any) {
      setBroadcastDone(`Error: ${e.message}`);
    } finally {
      setBroadcastLoading(false);
    }
  };

  const handleTextbookCompare = async () => {
    if (srcCountry === tgtCountry) { setTbCompareError('Countries must differ.'); return; }
    setTbComparing(true); setTbCompareError(''); setTbCompare(null);
    try {
      const result = await compareTextbooksAcrossCountries(srcCountry, tgtCountry, tbSubject || undefined);
      setTbCompare(result);
    } catch (e: any) {
      setTbCompareError(e.message);
    } finally {
      setTbComparing(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'matrix')      loadMatrix();
    if (activeTab === 'matches')     loadMatches();
    if (activeTab === 'class-levels' || activeTab === 'subjects') loadEquivalency();
    if (activeTab === 'localize')    loadLessons();
    if (activeTab === 'alerts')      loadAlerts();
  }, [activeTab, loadMatrix, loadMatches, loadEquivalency, loadLessons, loadAlerts]);

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
    { id: 'generate',         label: 'Generate Crosswalk',  icon: Zap },
    { id: 'matrix',           label: 'Similarity Matrix',   icon: BarChart3 },
    { id: 'matches',          label: 'Objective Matches',   icon: ArrowRightLeft },
    { id: 'class-levels',     label: 'Class Levels',        icon: Layers },
    { id: 'subjects',         label: 'Subjects',            icon: BookOpen },
    { id: 'localize',         label: 'Localize Lesson',     icon: Globe },
    { id: 'alerts',           label: 'Curriculum Alerts',   icon: Bell },
    { id: 'textbook-compare', label: 'Textbook Compare',    icon: BookMarked },
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

      {/* ── Tab: Curriculum Alerts ── */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          {/* Incoming alerts for this country */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900">Curriculum Update Alerts</h3>
                <p className="text-sm text-gray-500">Changes from other countries that affect {userCountry}'s curriculum</p>
              </div>
              <button onClick={loadAlerts} className="p-2 hover:bg-gray-100 rounded-lg">
                <RefreshCw className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {alertsLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-blue-400" /></div>
            ) : alerts.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No curriculum alerts for {userCountry} yet.</p>
                <p className="text-xs mt-1 text-gray-400">Alerts appear when countries with similar curricula update their objectives.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {alerts.map(alert => {
                  const isRead = !!alert.read_by[teacherId];
                  const typeColor =
                    alert.change_type === 'added'   ? 'text-emerald-600 bg-emerald-50 border-emerald-200' :
                    alert.change_type === 'removed' ? 'text-red-600 bg-red-50 border-red-200' :
                                                      'text-blue-600 bg-blue-50 border-blue-200';
                  return (
                    <div key={alert.id}
                      className={`border rounded-xl p-4 space-y-1 transition-colors ${isRead ? 'border-gray-100 bg-gray-50/50' : 'border-blue-200 bg-blue-50/30'}`}>
                      <div className="flex items-start gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${typeColor}`}>
                          {alert.change_type.toUpperCase()}
                        </span>
                        <span className="text-xs font-semibold text-gray-700">
                          From {alert.source_country}
                        </span>
                        {alert.similarity_score > 0 && (
                          <span className="text-[10px] text-gray-400">{alert.similarity_score}% match</span>
                        )}
                        {!isRead && (
                          <span className="ml-auto text-[10px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">NEW</span>
                        )}
                      </div>
                      {alert.description && (
                        <p className="text-sm text-gray-700">{alert.description}</p>
                      )}
                      <div className="flex gap-3 text-[10px] text-gray-400">
                        {alert.subject    && <span>{alert.subject}</span>}
                        {alert.class_level && <span>{alert.class_level}</span>}
                        <span className="ml-auto">{new Date(alert.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Broadcast a curriculum change from this country */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
            <div>
              <h3 className="font-bold text-gray-900 mb-1">Broadcast Curriculum Update</h3>
              <p className="text-sm text-gray-500">
                Notify other countries when {srcCountry}'s curriculum changes so they can review shared objectives.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Change Type</label>
                <select value={broadcastType} onChange={e => setBroadcastType(e.target.value as any)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                  <option value="added">Objective Added</option>
                  <option value="updated">Objective Updated</option>
                  <option value="removed">Objective Removed</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Subject (optional)</label>
                <input type="text" value={broadcastSubject} onChange={e => setBroadcastSubject(e.target.value)}
                  placeholder="e.g. Mathematics"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                <input type="text" value={broadcastDesc} onChange={e => setBroadcastDesc(e.target.value)}
                  placeholder="Brief summary of the change…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
            </div>

            {broadcastDone && (
              <div className={`flex items-center gap-2 text-sm rounded-xl p-3 border ${
                broadcastDone.startsWith('Error')
                  ? 'text-red-600 bg-red-50 border-red-200'
                  : 'text-emerald-600 bg-emerald-50 border-emerald-200'}`}>
                {broadcastDone.startsWith('Error')
                  ? <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  : <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
                {broadcastDone}
              </div>
            )}

            <button onClick={handleBroadcast} disabled={broadcastLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors text-sm">
              {broadcastLoading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Broadcasting…</>
                : <><Bell className="w-4 h-4" /> Broadcast Alert</>}
            </button>
          </div>
        </div>
      )}

      {/* ── Tab: Textbook Compare ── */}
      {activeTab === 'textbook-compare' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
          <div>
            <h3 className="font-bold text-gray-900 mb-1">Cross-Country Textbook Comparison</h3>
            <p className="text-sm text-gray-500">
              Measures how well each country's textbooks cover the shared crosswalk objectives.
              Requires an existing crosswalk and uploaded textbooks for both countries.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 items-end">
            <CountryPairSelectors />
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Subject (optional)</label>
              <input type="text" value={tbSubject} onChange={e => setTbSubject(e.target.value)}
                placeholder="e.g. Mathematics"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
          </div>

          {tbCompareError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {tbCompareError}
            </div>
          )}

          {tbCompare && (
            <div className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: `${tbCompare.country_a} textbooks`, value: tbCompare.textbook_count_a },
                  { label: `${tbCompare.country_b} textbooks`, value: tbCompare.textbook_count_b },
                  { label: 'Shared crosswalk pairs', value: tbCompare.shared_crosswalk_pairs },
                  { label: `${tbCompare.country_a} coverage`, value: `${tbCompare.country_a_coverage}%` },
                ].map((s, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl border border-gray-100 p-3 text-center">
                    <p className="text-xl font-bold text-gray-900">{s.value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Coverage bars */}
              <div className="space-y-3">
                {[
                  { country: tbCompare.country_a, coverage: tbCompare.country_a_coverage, gaps: tbCompare.gap_count_a },
                  { country: tbCompare.country_b, coverage: tbCompare.country_b_coverage, gaps: tbCompare.gap_count_b },
                ].map(row => (
                  <div key={row.country} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-900">{row.country}</span>
                      <div className="flex gap-2 items-center">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${SCORE_COLOR(row.coverage)}`}>
                          {row.coverage}% coverage
                        </span>
                        {row.gaps > 0 && (
                          <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            {row.gaps} gap{row.gaps !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${SCORE_BAR(row.coverage)}`}
                        style={{ width: `${row.coverage}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Topic breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {tbCompare.top_shared_topics.length > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                    <p className="text-xs font-bold text-emerald-700 mb-2">Shared Topics</p>
                    <ul className="space-y-1">
                      {tbCompare.top_shared_topics.map(t => (
                        <li key={t} className="text-xs text-emerald-800">• {t}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {tbCompare.gap_topics_a.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-xs font-bold text-amber-700 mb-2">{tbCompare.country_a} Gaps</p>
                    <p className="text-[10px] text-amber-600 mb-1">Covered by {tbCompare.country_b} but missing</p>
                    <ul className="space-y-1">
                      {tbCompare.gap_topics_a.map(t => (
                        <li key={t} className="text-xs text-amber-800">• {t}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {tbCompare.gap_topics_b.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                    <p className="text-xs font-bold text-blue-700 mb-2">{tbCompare.country_b} Gaps</p>
                    <p className="text-[10px] text-blue-600 mb-1">Covered by {tbCompare.country_a} but missing</p>
                    <ul className="space-y-1">
                      {tbCompare.gap_topics_b.map(t => (
                        <li key={t} className="text-xs text-blue-800">• {t}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <p className="text-xs text-gray-400">
                Computed: {new Date(tbCompare.computed_at).toLocaleString()}. Results are cached for 24 hours.
              </p>
            </div>
          )}

          <button onClick={handleTextbookCompare} disabled={tbComparing || srcCountry === tgtCountry}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            {tbComparing
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Comparing textbooks…</>
              : <><BookMarked className="w-4 h-4" /> Compare Textbooks</>}
          </button>
        </div>
      )}
    </div>
  );
};

export default CurriculumCrosswalk;
