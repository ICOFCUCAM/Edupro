import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  BookOpen, Upload, FileText, BarChart3, CheckCircle2, AlertCircle,
  Loader2, ChevronRight, X, Play, Download, Trash2, RefreshCw,
  Search, Plus, BookMarked, Target, Layers, AlertTriangle, FileX,
  ChevronDown, ChevronUp, GraduationCap, Mic,
} from 'lucide-react';
import {
  processTextbookPipeline, getTextbooks, getTextbookChapters,
  getTextbookAlignments, deleteTextbook, generateChapterContent, generateAllChapterContent,
  searchChaptersByQuery, getSupplementaryLessons,
  type Textbook, type TextbookWithSummary, type TextbookChapter,
  type TextbookCoverageSummary, type ProcessStep,
  type ChapterSearchResult, type SupplementaryLesson,
} from '@/services/textbookService';
import { supabase } from '@/lib/supabase';

const SUBJECTS = [
  'Mathematics','English Language','Basic Science','Social Studies','Civic Education',
  'Agricultural Science','Economics','History','Geography','French','Physics','Chemistry','Biology',
];
const CLASS_LEVELS = [
  'Primary 1','Primary 2','Primary 3','Primary 4','Primary 5','Primary 6',
  'JSS 1','JSS 2','JSS 3','SSS 1','SSS 2','SSS 3',
  'Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6',
  'Grade 7','Grade 8','Grade 9','Grade 10','Grade 11','Grade 12',
];

const COVERAGE_COLOR = (pct: number) =>
  pct >= 80 ? 'text-emerald-600 bg-emerald-50 border-emerald-200' :
  pct >= 60 ? 'text-blue-600 bg-blue-50 border-blue-200' :
  pct >= 40 ? 'text-amber-600 bg-amber-50 border-amber-200' :
              'text-red-600 bg-red-50 border-red-200';

const STATUS_INFO: Record<string, { label: string; color: string }> = {
  processing:          { label: 'Processing',  color: 'text-amber-600' },
  chapters_extracted:  { label: 'Extracted',   color: 'text-blue-600' },
  aligned:             { label: 'Aligned',     color: 'text-purple-600' },
  ready:               { label: 'Ready',       color: 'text-emerald-600' },
  failed:              { label: 'Failed',      color: 'text-red-600' },
};

interface TextbookLibraryProps {
  organizationId: string;
  teacherId:      string;
  country:        string;
  onNavigate?:    (page: string) => void;
}

const TextbookLibrary: React.FC<TextbookLibraryProps> = ({
  organizationId, teacherId, country, onNavigate,
}) => {
  const [view, setView]               = useState<'library' | 'upload' | 'report'>('library');
  const [textbooks, setTextbooks]     = useState<TextbookWithSummary[]>([]);
  const [loading, setLoading]         = useState(true);
  const [selectedBook, setSelectedBook] = useState<TextbookWithSummary | null>(null);
  const [chapters, setChapters]       = useState<TextbookChapter[]>([]);
  const [search, setSearch]           = useState('');

  // Upload form
  const [file, setFile]               = useState<File | null>(null);
  const [pastedText, setPastedText]   = useState('');
  const [inputMode, setInputMode]     = useState<'file' | 'paste'>('file');
  const [subject, setSubject]         = useState('');
  const [classLevel, setClassLevel]   = useState('');
  const [processStep, setProcessStep] = useState<ProcessStep | null>(null);
  const [processDetail, setProcessDetail] = useState('');
  const [processError, setProcessError]   = useState('');
  const [generatingAll, setGeneratingAll] = useState(false);
  const [genProgress, setGenProgress]     = useState({ done: 0, total: 0 });

  // Chapter semantic search
  const [chapterSearch, setChapterSearch]         = useState('');
  const [chapterSearchResults, setChapterSearchResults] = useState<ChapterSearchResult[]>([]);
  const [chapterSearchLoading, setChapterSearchLoading] = useState(false);

  // Marking scheme expand per chapter
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null);
  const [markingSchemes, setMarkingSchemes]       = useState<Record<string, any>>({});

  // Supplementary lessons
  const [suppLessons, setSuppLessons]     = useState<SupplementaryLesson[]>([]);
  const [suppLoading, setSuppLoading]     = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadLibrary = useCallback(async () => {
    setLoading(true);
    const data = await getTextbooks(organizationId);
    setTextbooks(data);
    setLoading(false);
  }, [organizationId]);

  useEffect(() => { loadLibrary(); }, [loadLibrary]);

  const openReport = async (book: TextbookWithSummary) => {
    setSelectedBook(book);
    const ch = await getTextbookChapters(book.id);
    setChapters(ch);
    setView('report');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  const handleProcess = async () => {
    if (!file && !pastedText.trim()) return;
    setProcessError('');
    setProcessStep('extracting');

    try {
      const { textbookId, summary, chapterCount } = await processTextbookPipeline({
        file:           file ?? undefined,
        pastedText:     pastedText.trim() || undefined,
        country,
        subject:        subject || undefined,
        classLevel:     classLevel || undefined,
        organizationId,
        teacherId,
        onProgress: (step, detail) => {
          setProcessStep(step);
          setProcessDetail(detail ?? '');
        },
      });

      await loadLibrary();
      // Open report immediately
      const freshBooks = await getTextbooks(organizationId);
      const fresh = freshBooks.find(b => b.id === textbookId);
      if (fresh) await openReport(fresh);
    } catch (err: any) {
      setProcessStep('error');
      setProcessError(err.message ?? 'Processing failed.');
    }
  };

  const handleGenerateAll = async (bookId: string) => {
    setGeneratingAll(true);
    setGenProgress({ done: 0, total: 0 });
    try {
      await generateAllChapterContent(bookId, teacherId, (done, total) => {
        setGenProgress({ done, total });
      });
      const ch = await getTextbookChapters(bookId);
      setChapters(ch);
    } finally {
      setGeneratingAll(false);
    }
  };

  const handleGenerateChapter = async (chapterId: string) => {
    try {
      await generateChapterContent(chapterId, teacherId);
      if (selectedBook) {
        const ch = await getTextbookChapters(selectedBook.id);
        setChapters(ch);
      }
    } catch (err: any) {
      alert(`Generation failed: ${err.message}`);
    }
  };

  const handleDelete = async (bookId: string) => {
    if (!confirm('Delete this textbook and all its data?')) return;
    await deleteTextbook(bookId);
    await loadLibrary();
    if (selectedBook?.id === bookId) setView('library');
  };

  const handleChapterSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setChapterSearchResults([]); return; }
    setChapterSearchLoading(true);
    const results = await searchChaptersByQuery(q, {
      textbookId: selectedBook?.id,
      country,
      subject:    selectedBook?.subject ?? undefined,
    });
    setChapterSearchResults(results);
    setChapterSearchLoading(false);
  }, [selectedBook, country]);

  const handleToggleMarkingScheme = useCallback(async (ch: TextbookChapter) => {
    if (expandedChapterId === ch.id) { setExpandedChapterId(null); return; }
    setExpandedChapterId(ch.id);
    if (!ch.assessment_id || markingSchemes[ch.id]) return;
    const { data } = await supabase
      .from('assessment_packages')
      .select('content')
      .eq('id', ch.assessment_id)
      .single();
    if (data?.content) {
      setMarkingSchemes(prev => ({ ...prev, [ch.id]: data.content }));
    }
  }, [expandedChapterId, markingSchemes]);

  const handleLoadSupplementary = useCallback(async () => {
    const summary = selectedBook?.textbook_coverage_summary?.[0];
    if (!summary?.missing_objectives?.length) return;
    setSuppLoading(true);
    const lessons = await getSupplementaryLessons(
      country,
      selectedBook?.subject ?? '',
      summary.missing_objectives,
    );
    setSuppLessons(lessons);
    setSuppLoading(false);
  }, [selectedBook, country]);

  const filteredBooks = textbooks.filter(b =>
    !search ||
    b.title.toLowerCase().includes(search.toLowerCase()) ||
    (b.subject ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (b.class_level ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const STEP_LABELS: Record<ProcessStep, string> = {
    extracting:         'Extracting text from file…',
    uploading:          'Saving to library…',
    detecting_chapters: 'Detecting chapters and subject…',
    aligning:           'Mapping to curriculum objectives…',
    embedding:          'Building semantic search index…',
    done:               'Complete!',
    error:              'Error',
  };

  // ── Views ────────────────────────────────────────────────────────────────

  if (view === 'upload') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => { setView('library'); setProcessStep(null); setFile(null); setPastedText(''); }}
            className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4 text-gray-500" />
          </button>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Upload Textbook</h2>
            <p className="text-sm text-gray-500">PDF, DOCX, or TXT — or paste the text directly</p>
          </div>
        </div>

        {/* Input mode toggle */}
        <div className="flex gap-2">
          {(['file', 'paste'] as const).map(m => (
            <button key={m} onClick={() => setInputMode(m)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${inputMode === m ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
              {m === 'file' ? 'Upload File' : 'Paste Text'}
            </button>
          ))}
        </div>

        {inputMode === 'file' ? (
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
          >
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="w-8 h-8 text-blue-600" />
                <div className="text-left">
                  <p className="font-medium text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
                <button onClick={e => { e.stopPropagation(); setFile(null); }}
                  className="ml-4 p-1 hover:bg-gray-100 rounded">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">Drop a file here or click to browse</p>
                <p className="text-xs text-gray-400 mt-1">PDF, DOCX, TXT — max 50 MB</p>
              </>
            )}
            <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt,.md" className="hidden" onChange={handleFileChange} />
          </div>
        ) : (
          <textarea
            className="w-full h-56 border border-gray-300 rounded-xl p-4 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Paste your textbook content here…"
            value={pastedText}
            onChange={e => setPastedText(e.target.value)}
          />
        )}

        {/* Optional metadata */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Subject (optional — auto-detected)</label>
            <select value={subject} onChange={e => setSubject(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="">Auto-detect</option>
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Class Level (optional)</label>
            <select value={classLevel} onChange={e => setClassLevel(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="">Auto-detect</option>
              {CLASS_LEVELS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Progress */}
        {processStep && processStep !== 'error' && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
            {(['extracting','uploading','detecting_chapters','aligning','embedding','done'] as ProcessStep[]).map(step => {
              const steps: ProcessStep[] = ['extracting','uploading','detecting_chapters','aligning','embedding','done'];
              const idx    = steps.indexOf(step);
              const curIdx = steps.indexOf(processStep);
              const done   = idx < curIdx || processStep === 'done';
              const active = step === processStep;
              return (
                <div key={step} className={`flex items-center gap-3 text-sm transition-opacity ${idx > curIdx ? 'opacity-30' : ''}`}>
                  {done ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        : active ? <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />
                        : <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />}
                  <span className={active ? 'text-blue-700 font-medium' : done ? 'text-gray-600' : 'text-gray-400'}>
                    {STEP_LABELS[step]}
                  </span>
                  {active && processDetail && <span className="text-xs text-blue-500">{processDetail}</span>}
                </div>
              );
            })}
          </div>
        )}

        {processError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-700">Processing failed</p>
              <p className="text-xs text-red-600 mt-1">{processError}</p>
            </div>
          </div>
        )}

        <button
          onClick={handleProcess}
          disabled={(!file && !pastedText.trim()) || (processStep !== null && processStep !== 'error' && processStep !== 'done')}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {processStep && processStep !== 'error' && processStep !== 'done'
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
            : <><Play className="w-4 h-4" /> Process Textbook</>}
        </button>
      </div>
    );
  }

  if (view === 'report' && selectedBook) {
    const summary = selectedBook.textbook_coverage_summary?.[0];
    const coveragePct = summary?.coverage_percentage ?? 0;

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-3">
          <button onClick={() => setView('library')} className="p-2 hover:bg-gray-100 rounded-lg mt-0.5">
            <X className="w-4 h-4 text-gray-500" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900 truncate">{selectedBook.title}</h2>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {selectedBook.subject    && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{selectedBook.subject}</span>}
              {selectedBook.class_level && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{selectedBook.class_level}</span>}
              {selectedBook.country    && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{selectedBook.country}</span>}
            </div>
          </div>
          <button onClick={() => handleDelete(selectedBook.id)}
            className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Coverage summary cards */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className={`rounded-xl border p-4 text-center ${COVERAGE_COLOR(coveragePct)}`}>
              <p className="text-3xl font-bold">{coveragePct}%</p>
              <p className="text-xs font-medium mt-0.5">Curriculum Coverage</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{summary.chapter_count}</p>
              <p className="text-xs text-gray-500 mt-0.5">Chapters</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{summary.covered_objectives}/{summary.total_objectives}</p>
              <p className="text-xs text-gray-500 mt-0.5">Objectives Covered</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{summary.missing_objectives?.length ?? 0}</p>
              <p className="text-xs text-gray-500 mt-0.5">Missing Objectives</p>
            </div>
          </div>
        )}

        {/* Missing objectives */}
        {summary && summary.missing_objectives?.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <p className="text-sm font-bold text-red-700">Missing Curriculum Objectives ({summary.missing_objectives.length})</p>
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {summary.missing_objectives.map((obj, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-red-700">
                  <span className="text-red-400 flex-shrink-0">•</span>
                  <span>{obj}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chapter search */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-blue-500" />
            <p className="text-sm font-semibold text-gray-700">Which chapter covers…?</p>
            <span className="text-xs text-gray-400 flex items-center gap-1"><Mic className="w-3 h-3" /> Ask by voice</span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. fractions, photosynthesis, civil rights…"
              value={chapterSearch}
              onChange={e => setChapterSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleChapterSearch(chapterSearch)}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              onClick={() => handleChapterSearch(chapterSearch)}
              disabled={chapterSearchLoading || !chapterSearch.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {chapterSearchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
            </button>
          </div>
          {chapterSearchResults.length > 0 && (
            <div className="space-y-2 pt-1">
              {chapterSearchResults.map(r => (
                <div key={r.id} className="flex items-start gap-2.5 p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <div className="w-6 h-6 bg-blue-200 rounded flex items-center justify-center text-[10px] font-bold text-blue-700 flex-shrink-0 mt-0.5">
                    {r.chapter_number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{r.chapter_title}</p>
                    {r.content && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{r.content}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">
                        {r.match_type === 'semantic' ? `${r.similarity}% match` : 'keyword match'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!chapterSearchLoading && chapterSearch.trim() && chapterSearchResults.length === 0 && (
            <p className="text-xs text-gray-400 pt-1">No chapters found for "{chapterSearch}". Try a different keyword.</p>
          )}
        </div>

        {/* Extra topics not in curriculum */}
        {summary && summary.extra_topics?.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="w-4 h-4 text-amber-500" />
              <p className="text-sm font-medium text-amber-700">Topics not in national curriculum ({summary.extra_topics.length})</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {summary.extra_topics.slice(0, 12).map((t, i) => (
                <span key={i} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{t}</span>
              ))}
            </div>
          </div>
        )}

        {/* Supplementary lesson recommendations */}
        {summary && summary.missing_objectives?.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-purple-500" />
                <p className="text-sm font-semibold text-gray-700">Supplementary Lessons for Missing Objectives</p>
              </div>
              {!suppLessons.length && (
                <button
                  onClick={handleLoadSupplementary}
                  disabled={suppLoading}
                  className="text-xs text-purple-600 hover:text-purple-700 font-medium disabled:opacity-50"
                >
                  {suppLoading ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Load suggestions'}
                </button>
              )}
            </div>
            {suppLessons.length > 0 ? (
              <div className="space-y-2">
                {suppLessons.map(l => (
                  <div key={l.id} className="flex items-start gap-2.5 p-3 bg-purple-50 rounded-lg border border-purple-100">
                    <FileText className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{l.title}</p>
                      <p className="text-xs text-purple-600 mt-0.5">{l.topic}</p>
                    </div>
                    <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded flex-shrink-0">
                      {l.class_level ?? ''}
                    </span>
                  </div>
                ))}
              </div>
            ) : !suppLoading ? (
              <p className="text-xs text-gray-400">Click "Load suggestions" to find supplementary lessons that fill curriculum gaps.</p>
            ) : null}
          </div>
        )}

        {/* Generate all content */}
        {!generatingAll && chapters.some(c => !c.lesson_note_id) && (
          <button
            onClick={() => handleGenerateAll(selectedBook.id)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors text-sm"
          >
            <Play className="w-4 h-4" />
            Generate Lessons &amp; Assessments for All Chapters
          </button>
        )}

        {generatingAll && (
          <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
            <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
            <p className="text-sm text-emerald-700">
              Generating content… {genProgress.done}/{genProgress.total} chapters
            </p>
          </div>
        )}

        {/* Chapter list */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-700">Chapters ({chapters.length})</p>
          {chapters.map(ch => {
            const isExpanded = expandedChapterId === ch.id;
            const scheme     = markingSchemes[ch.id];
            return (
              <div key={ch.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 p-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-xs font-bold text-gray-500 flex-shrink-0">
                    {ch.chapter_number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{ch.chapter_title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {ch.lesson_note_id
                        ? <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">Lesson ✓</span>
                        : <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded">No lesson</span>}
                      {ch.assessment_id
                        ? <span className="text-[10px] bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded">Quiz ✓</span>
                        : <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded">No quiz</span>}
                      {ch.word_count && <span className="text-[10px] text-gray-400">{ch.word_count} words</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {ch.assessment_id && (
                      <button
                        onClick={() => handleToggleMarkingScheme(ch)}
                        className="flex items-center gap-1 px-2 py-1.5 bg-violet-50 text-violet-600 rounded-lg text-xs font-medium hover:bg-violet-100 transition-colors"
                        title="View marking scheme"
                      >
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        Scheme
                      </button>
                    )}
                    {!ch.lesson_note_id && (
                      <button
                        onClick={() => handleGenerateChapter(ch.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors"
                      >
                        <Play className="w-3 h-3" /> Generate
                      </button>
                    )}
                  </div>
                </div>

                {/* Marking scheme panel */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-3 bg-violet-50/40">
                    {scheme ? (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-violet-700">Marking Scheme</p>
                        {(scheme.marking_scheme ?? scheme.sections?.[0]?.marking_scheme ?? []).length > 0 ? (
                          (scheme.marking_scheme ?? scheme.sections?.[0]?.marking_scheme ?? []).slice(0, 8).map((item: any, i: number) => (
                            <div key={i} className="flex gap-2 text-xs">
                              <span className="text-violet-400 font-bold flex-shrink-0">{i + 1}.</span>
                              <div>
                                <span className="text-gray-700">{item.answer ?? item.expected_answer ?? item.key_points ?? item}</span>
                                {item.marks && <span className="ml-2 text-violet-600 font-medium">({item.marks} mark{item.marks > 1 ? 's' : ''})</span>}
                              </div>
                            </div>
                          ))
                        ) : (
                          <pre className="text-xs text-gray-600 whitespace-pre-wrap overflow-auto max-h-48">
                            {JSON.stringify(scheme, null, 2).slice(0, 800)}
                          </pre>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-violet-500">
                        <Loader2 className="w-3 h-3 animate-spin" /> Loading marking scheme…
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Library view ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookMarked className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-gray-900">Textbook Library</h2>
          {!loading && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{textbooks.length}</span>}
        </div>
        <button
          onClick={() => { setView('upload'); setProcessStep(null); setFile(null); setPastedText(''); setProcessError(''); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Upload Textbook
        </button>
      </div>

      {/* Search */}
      {textbooks.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search textbooks…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
      )}

      {/* Textbook cards */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
        </div>
      ) : filteredBooks.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No textbooks yet</p>
          <p className="text-sm text-gray-400 mt-1">Upload a PDF or DOCX to get curriculum coverage analysis.</p>
          <button
            onClick={() => setView('upload')}
            className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium mx-auto hover:bg-blue-700"
          >
            <Upload className="w-4 h-4" /> Upload First Textbook
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredBooks.map(book => {
            const summary = book.textbook_coverage_summary?.[0];
            const pct     = summary?.coverage_percentage ?? 0;
            const si      = STATUS_INFO[book.status] ?? STATUS_INFO.processing;

            return (
              <div key={book.id}
                className="bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-200 hover:shadow-sm transition-all cursor-pointer"
                onClick={() => openReport(book)}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-gray-900 truncate">{book.title}</p>
                      {summary ? (
                        <span className={`text-sm font-bold px-2.5 py-1 rounded-lg border flex-shrink-0 ${COVERAGE_COLOR(pct)}`}>
                          {pct}%
                        </span>
                      ) : (
                        <span className={`text-xs font-medium flex-shrink-0 ${si.color}`}>{si.label}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {book.subject     && <span className="text-xs text-gray-500">{book.subject}</span>}
                      {book.class_level && <span className="text-xs text-gray-500">• {book.class_level}</span>}
                      {summary && (
                        <>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs text-gray-500">{summary.chapter_count} chapters</span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs text-gray-500">{summary.missing_objectives?.length ?? 0} missing objectives</span>
                        </>
                      )}
                    </div>
                    {/* Coverage bar */}
                    {summary && (
                      <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-blue-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TextbookLibrary;
