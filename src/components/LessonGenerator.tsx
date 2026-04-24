import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { REGIONS, COUNTRIES_WITH_LEVELS, SUBJECTS } from '@/lib/constants';
import { BookOpen, Printer, Loader2, Sparkles, FileText, RotateCcw, Save, CheckCircle2, WifiOff, Building2, Lock, Globe, Eye, ClipboardList } from 'lucide-react';
import { saveLessonOffline, enqueueUpload } from '@/lib/offlineDB';
import { getUserOrganizations, Organization } from '@/services/organizationService';
import { buildSchoolContextPrompt } from '@/services/schoolContextService';
import { alignLessonDual, saveAlignmentScore, extractTextFromLessonNote, AlignmentResult, DualAlignmentResult } from '@/services/alignmentService';
import { getSchoolKnowledgeItems } from '@/services/organizationService';
import AlignmentBadge from '@/components/AlignmentBadge';

interface LessonGeneratorProps {
  teacherId?: string;
  onLessonSaved?: () => void;
  onNavigate?: (page: string) => void;
  isOnline?: boolean;
}

type Visibility = 'private' | 'school_only' | 'general';

const VISIBILITY_OPTIONS: { value: Visibility; label: string; icon: React.ElementType; desc: string }[] = [
  { value: 'private',     label: 'Private',      icon: Lock,      desc: 'Only you can see this' },
  { value: 'school_only', label: 'School Only',   icon: Building2, desc: 'Share with your school' },
  { value: 'general',     label: 'Public',        icon: Globe,     desc: 'Visible to all teachers' },
];

const LessonGenerator: React.FC<LessonGeneratorProps> = ({ teacherId, onLessonSaved, onNavigate, isOnline = true }) => {
  const [formData, setFormData] = useState({
    country: 'Nigeria', subject: 'Mathematics', topic: '',
    level: 'Primary 3', week: '1', language: 'English', additionalNotes: ''
  });
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [lessonNote, setLessonNote] = useState<any>(null);
  const [error, setError] = useState('');
  const [schoolOrg, setSchoolOrg] = useState<Organization | null>(null);
  const [schoolContextLabel, setSchoolContextLabel] = useState('');
  const [dualAlignment, setDualAlignment] = useState<DualAlignmentResult | null>(null);
  const [alignmentLoading, setAlignmentLoading] = useState(false);
  const [savedLessonId, setSavedLessonId] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const countryData = COUNTRIES_WITH_LEVELS[formData.country];
  const levels = countryData?.levels || ['Primary 1', 'Primary 2', 'Primary 3'];
  const curriculum = countryData?.curriculum || 'National Curriculum';

  // Load teacher's school affiliation
  useEffect(() => {
    if (!teacherId || !isOnline) return;
    getUserOrganizations(teacherId).then(orgs => {
      const school = orgs.find(o => o.type === 'school' || o.type === 'ngo' || o.type === 'training_center');
      setSchoolOrg(school || null);
      if (school) setSchoolContextLabel(`Using school context: ${school.name}`);
    });
  }, [teacherId]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'country') {
        const newLevels = COUNTRIES_WITH_LEVELS[value]?.levels || [];
        updated.level = newLevels[0] || 'Primary 1';
      }
      return updated;
    });
  };

  // Offline template fallback
  const buildOfflineLesson = () => {
    const { subject, topic, level, country, language, week } = formData;
    const curr = COUNTRIES_WITH_LEVELS[country]?.curriculum || 'National Curriculum';
    return {
      title: `${subject} – ${topic}`,
      columns: ['Step', 'Teacher Activity', 'Pupil Activity', 'Resources', 'Assessment'],
      rows: [
        { Step: 'Introduction (10 min)', 'Teacher Activity': `Introduce ${topic} with a relevant question or story.`, 'Pupil Activity': 'Listen and respond to questions.', Resources: 'Textbook, chalkboard', Assessment: 'Oral questioning' },
        { Step: 'Development (20 min)', 'Teacher Activity': `Explain ${topic} using examples. Demonstrate on board.`, 'Pupil Activity': 'Take notes and solve guided examples.', Resources: 'Textbook, exercise books', Assessment: 'Class observation' },
        { Step: 'Activity (15 min)', 'Teacher Activity': 'Circulate and support groups.', 'Pupil Activity': `Work in groups on ${topic} exercises.`, Resources: 'Worksheets', Assessment: 'Group work check' },
        { Step: 'Conclusion (5 min)', 'Teacher Activity': 'Summarise key points. Set homework.', 'Pupil Activity': 'Answer summary questions.', Resources: 'Chalkboard', Assessment: 'Exit ticket' },
      ],
      metadata: { Subject: subject, Topic: topic, 'Class/Level': level, Week: `Week ${week}`, Curriculum: curr, Language: language, Country: country },
      teacherNotes: `Offline template for "${topic}". Regenerate online for a fully AI-personalised lesson note.`,
    };
  };

  const generateLesson = async () => {
    if (!formData.topic.trim()) { setError('Please enter a topic'); return; }
    setError('');
    setLoading(true);
    setLessonNote(null);
    setSaved(false);
    setDualAlignment(null);
    setSavedLessonId(null);

    if (!isOnline) {
      await new Promise(r => setTimeout(r, 600));
      setLessonNote(buildOfflineLesson());
      setLoading(false);
      return;
    }

    try {
      let schoolContext: string | null = null;
      if (schoolOrg) {
        schoolContext = await buildSchoolContextPrompt(schoolOrg.id, schoolOrg.name);
      }

      const { data, error: fnError } = await supabase.functions.invoke('generate-lesson-note', {
        body: { ...formData, schoolContext }
      });

      if (fnError) throw fnError;
      if (data?.success) {
        setLessonNote(data.lessonNote);
        runAlignmentCheck(data.lessonNote);
      } else {
        throw new Error(data?.error || 'Failed to generate lesson note');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const runAlignmentCheck = async (note: any) => {
    setAlignmentLoading(true);
    try {
      const text = extractTextFromLessonNote(note);
      let schoolItems: any[] | undefined;
      if (schoolOrg) {
        schoolItems = await getSchoolKnowledgeItems(schoolOrg.id);
      }
      const dual = await alignLessonDual(text, formData.country, formData.subject, formData.level, schoolItems);
      setDualAlignment(dual);
    } finally {
      setAlignmentLoading(false);
    }
  };

  const saveLesson = async () => {
    if (!lessonNote || !teacherId) return;
    setSaving(true);
    try {
      const title = lessonNote.title || `${formData.subject} - ${formData.topic}`;
      const contentStr = JSON.stringify(lessonNote);

      if (!isOnline) {
        const offlineId = `offline_${Date.now()}`;
        await saveLessonOffline({
          id: offlineId,
          country: formData.country,
          subject: formData.subject,
          class_level: formData.level,
          title,
          content: contentStr,
          visibility,
          created_at: new Date().toISOString(),
          synced: false,
        });
        await enqueueUpload({
          id: offlineId,
          content: contentStr,
          subject: formData.subject,
          class_level: formData.level,
          country: formData.country,
          title,
          status: 'pending',
          created_at: new Date().toISOString(),
        });
        setSaved(true);
        onLessonSaved?.();
        return;
      }

      const region = REGIONS.find(r => r.countries.includes(formData.country))?.name || 'West Africa';
      const { data: insertedLesson, error: saveErr } = await supabase
        .from('lesson_notes')
        .insert({
          teacher_id: teacherId,
          title,
          subject: formData.subject,
          topic: formData.topic,
          country: formData.country,
          region,
          level: formData.level,
          class_name: formData.level,
          language: formData.language,
          content: lessonNote,
          status: 'draft',
          visibility,
          organization_id: schoolOrg?.id || null,
        })
        .select('id')
        .single();

      if (saveErr) throw saveErr;

      const lessonId = insertedLesson?.id;
      if (lessonId) {
        setSavedLessonId(lessonId);
        if (dualAlignment?.national) {
          saveAlignmentScore(
            lessonId, formData.country, formData.subject, formData.level,
            dualAlignment.national, dualAlignment.school
          );
        }
      }

      setSaved(true);
      onLessonSaved?.();
    } catch (err: any) {
      console.error('Save error:', err);
      setError('Failed to save lesson note.');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Lesson Note - ${formData.topic}</title>
      <style>
        body { font-family: 'Times New Roman', serif; padding: 20px; color: #000; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #333; padding: 8px 10px; text-align: left; font-size: 12px; }
        th { background-color: #1e40af; color: white; font-weight: bold; }
        tr:nth-child(even) { background-color: #f0f4ff; }
        h1 { text-align: center; color: #1e40af; font-size: 22px; margin-bottom: 5px; }
        h2 { text-align: center; color: #333; font-size: 16px; margin-bottom: 20px; }
        .metadata { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 20px; font-size: 13px; }
        .metadata div { padding: 4px 0; }
        .metadata strong { color: #1e40af; }
        .notes { margin-top: 20px; padding: 15px; background: #f8fafc; border-left: 4px solid #1e40af; font-size: 13px; }
        @media print { body { padding: 10px; } }
      </style></head><body>
      ${content.innerHTML}
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const renderLessonTable = () => {
    if (!lessonNote) return null;
    const columns = lessonNote.columns || [];
    const rows = lessonNote.rows || [];

    return (
      <div ref={printRef}>
        <h1 style={{ textAlign: 'center', color: '#1e40af', fontSize: '22px', marginBottom: '5px' }}>
          {lessonNote.title || `${formData.subject} - ${formData.topic}`}
        </h1>
        <h2 style={{ textAlign: 'center', color: '#666', fontSize: '14px', marginBottom: '20px' }}>
          {curriculum} | {formData.country}
        </h2>

        {lessonNote.metadata && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px', fontSize: '13px' }}>
            {Object.entries(lessonNote.metadata).map(([key, val]) => (
              <div key={key}><strong style={{ color: '#1e40af', textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}:</strong> {String(val)}</div>
            ))}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {columns.map((col: string, i: number) => (
                  <th key={i} className="bg-blue-700 text-white px-3 py-2 text-left text-xs font-semibold border border-blue-800 whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row: any, ri: number) => (
                <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                  {columns.map((col: string, ci: number) => (
                    <td key={ci} className="px-3 py-2 border border-gray-200 text-xs text-gray-700 align-top min-w-[120px]">{row[col] || '-'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(lessonNote.teacherNotes || lessonNote.differentiationStrategies || lessonNote.crossCurricularLinks) && (
          <div style={{ marginTop: '20px' }}>
            {lessonNote.teacherNotes && (
              <div style={{ padding: '15px', background: '#f0fdf4', borderLeft: '4px solid #059669', marginBottom: '10px', fontSize: '13px' }}>
                <strong>Teacher's Notes:</strong> {lessonNote.teacherNotes}
              </div>
            )}
            {lessonNote.differentiationStrategies && (
              <div style={{ padding: '15px', background: '#eff6ff', borderLeft: '4px solid #2563eb', marginBottom: '10px', fontSize: '13px' }}>
                <strong>Differentiation Strategies:</strong> {lessonNote.differentiationStrategies}
              </div>
            )}
            {lessonNote.crossCurricularLinks && (
              <div style={{ padding: '15px', background: '#fefce8', borderLeft: '4px solid #ca8a04', fontSize: '13px' }}>
                <strong>Cross-Curricular Links:</strong> {lessonNote.crossCurricularLinks}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-900 text-white py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">AI Lesson Note Generator</h1>
              <p className="text-blue-200">Create curriculum-aligned lesson notes in seconds</p>
            </div>
            {!isOnline && (
              <span className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-800/60 border border-blue-400/40 text-blue-100 text-xs font-medium">
                <WifiOff className="w-3.5 h-3.5" /> Offline — Template Mode
              </span>
            )}
            {schoolOrg && isOnline && (
              <span className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-700/60 border border-emerald-400/40 text-emerald-100 text-xs font-medium">
                <Building2 className="w-3.5 h-3.5" /> {schoolOrg.name}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 -mt-6">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sticky top-24">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" /> Lesson Details
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                  <select value={formData.country} onChange={e => handleChange('country', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm bg-white">
                    {REGIONS.map(region => (
                      <optgroup key={region.id} label={region.name}>
                        {region.countries.filter(c => COUNTRIES_WITH_LEVELS[c]).map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">{curriculum}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Class / Level</label>
                  <select value={formData.level} onChange={e => handleChange('level', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm bg-white">
                    {levels.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                  <select value={formData.subject} onChange={e => handleChange('subject', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm bg-white">
                    {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Topic <span className="text-red-500">*</span></label>
                  <input type="text" value={formData.topic} onChange={e => handleChange('topic', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                    placeholder="e.g., Addition and Subtraction" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Week</label>
                  <select value={formData.week} onChange={e => handleChange('week', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm bg-white">
                    {Array.from({ length: 14 }, (_, i) => (
                      <option key={i + 1} value={String(i + 1)}>Week {i + 1}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
                  <select value={formData.language} onChange={e => handleChange('language', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm bg-white">
                    <option>English</option>
                    <option>French</option>
                    <option>Spanish</option>
                    <option>Swahili</option>
                    <option>Hausa</option>
                    <option>Yoruba</option>
                    <option>Amharic</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
                  <textarea value={formData.additionalNotes} onChange={e => handleChange('additionalNotes', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm resize-none"
                    rows={3} placeholder="Any specific requirements..." />
                </div>

                {/* Visibility selector */}
                {teacherId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Visibility when saved</label>
                    <div className="space-y-2">
                      {VISIBILITY_OPTIONS.map(opt => {
                        const Icon = opt.icon;
                        const disabled = opt.value === 'school_only' && !schoolOrg;
                        return (
                          <label key={opt.value} className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${
                            disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-50'
                          } ${visibility === opt.value ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`}>
                            <input type="radio" name="visibility" value={opt.value}
                              checked={visibility === opt.value}
                              disabled={disabled}
                              onChange={() => !disabled && setVisibility(opt.value)}
                              className="sr-only" />
                            <Icon className={`w-4 h-4 flex-shrink-0 ${visibility === opt.value ? 'text-blue-600' : 'text-gray-400'}`} />
                            <div>
                              <span className={`text-xs font-medium ${visibility === opt.value ? 'text-blue-700' : 'text-gray-700'}`}>{opt.label}</span>
                              {opt.value === 'school_only' && !schoolOrg && (
                                <p className="text-xs text-gray-400">Join a school to enable</p>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* School context indicator */}
                {schoolContextLabel && isOnline && (
                  <div className="flex items-center gap-2 p-2.5 bg-emerald-50 rounded-xl border border-emerald-100">
                    <Building2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <p className="text-xs text-emerald-700">{schoolContextLabel}</p>
                  </div>
                )}

                {error && <div className="text-red-500 text-sm bg-red-50 p-3 rounded-xl">{error}</div>}

                <button onClick={generateLesson} disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-emerald-500 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading
                    ? <><Loader2 className="w-5 h-5 animate-spin" /> Generating...</>
                    : <><Sparkles className="w-5 h-5" /> Generate Lesson Note</>
                  }
                </button>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 min-h-[600px]">
              {/* Toolbar */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100 flex-wrap gap-3">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-blue-600" /> Lesson Note Preview
                </h2>
                {lessonNote && (
                  <div className="flex items-center gap-2">
                    {teacherId && (
                      <div className="flex flex-col items-end gap-0.5">
                        <button onClick={saveLesson} disabled={saving || saved}
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            saved ? 'bg-emerald-50 text-emerald-600' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                          }`}>
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                          {saving ? 'Saving...' : saved ? (!isOnline ? 'Saved Locally' : 'Saved!') : 'Save'}
                        </button>
                        {saved && !isOnline && (
                          <span className="text-xs text-blue-500">Will sync when connected</span>
                        )}
                      </div>
                    )}
                    {saved && onNavigate && (
                      <button
                        onClick={() => onNavigate('assessments')}
                        className="flex items-center gap-1.5 px-4 py-2 bg-violet-50 text-violet-700 rounded-lg text-sm font-medium hover:bg-violet-100 transition-all"
                        title="Generate an assessment for this lesson topic"
                      >
                        <ClipboardList className="w-4 h-4" /> Generate Assessment
                      </button>
                    )}
                    <button onClick={handlePrint}
                      className="flex items-center gap-1.5 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-all">
                      <Printer className="w-4 h-4" /> Print / PDF
                    </button>
                    <button onClick={() => { setLessonNote(null); setFormData(p => ({ ...p, topic: '' })); setSaved(false); }}
                      className="flex items-center gap-1.5 px-4 py-2 bg-gray-50 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-100 transition-all">
                      <RotateCcw className="w-4 h-4" /> New
                    </button>
                  </div>
                )}
              </div>

              {/* Content */}
              {loading ? (
                <div className="flex flex-col items-center justify-center py-24">
                  <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-4">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Generating Your Lesson Note</h3>
                  <p className="text-gray-500 text-sm text-center max-w-md">
                    Our AI is creating a detailed, curriculum-aligned lesson note{schoolOrg ? ` aligned to ${schoolOrg.name}` : ''} for {formData.country}'s {curriculum}. This may take 15–30 seconds…
                  </p>
                  <div className="mt-6 w-64 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full animate-pulse" style={{ width: '70%' }} />
                  </div>
                </div>
              ) : lessonNote ? (
                <div className="space-y-4">
                  <AlignmentBadge
                    result={dualAlignment?.national ?? null}
                    schoolResult={dualAlignment?.school}
                    loading={alignmentLoading}
                  />
                  <div className="overflow-x-auto">
                    {renderLessonTable()}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                    <FileText className="w-10 h-10 text-gray-300" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Lesson Note Yet</h3>
                  <p className="text-gray-500 text-sm max-w-md">
                    Fill in the lesson details on the left and click "Generate Lesson Note" to create a curriculum-aligned lesson note formatted for your country's education system.
                  </p>
                  {schoolOrg && (
                    <div className="mt-4 flex items-center gap-2 px-4 py-2.5 bg-emerald-50 rounded-xl border border-emerald-100">
                      <Building2 className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs text-emerald-700">AI will align this lesson to <strong>{schoolOrg.name}</strong>'s curriculum</span>
                    </div>
                  )}
                  <div className="mt-6 grid grid-cols-3 gap-3 text-xs text-gray-400">
                    <div className="bg-gray-50 rounded-lg p-3"><div className="font-medium text-gray-600 mb-1">Step 1</div>Select country & class</div>
                    <div className="bg-gray-50 rounded-lg p-3"><div className="font-medium text-gray-600 mb-1">Step 2</div>Choose subject & topic</div>
                    <div className="bg-gray-50 rounded-lg p-3"><div className="font-medium text-gray-600 mb-1">Step 3</div>Generate & print</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LessonGenerator;
