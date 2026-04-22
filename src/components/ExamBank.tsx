import React, { useState } from 'react';
import { REGIONS } from '@/lib/constants';
import { FileText, Search, Download, Plus, ChevronRight, Calendar, BookOpen, Award, Filter, Clock, Eye } from 'lucide-react';

const SAMPLE_EXAMS = [
  { id: 1, title: 'First School Leaving Certificate 2024', country: 'Nigeria', type: 'First School', subject: 'Mathematics', year: 2024, level: 'Primary 6', questions: 50, duration: '2 hours' },
  { id: 2, title: 'Common Entrance Examination 2024', country: 'Nigeria', type: 'Common Entrance', subject: 'English Language', year: 2024, level: 'Primary 5-6', questions: 60, duration: '1.5 hours' },
  { id: 3, title: 'BECE Mathematics 2023', country: 'Ghana', type: 'BECE', subject: 'Mathematics', year: 2023, level: 'Primary 6', questions: 40, duration: '2 hours' },
  { id: 4, title: 'KCPE Science 2023', country: 'Kenya', type: 'KCPE', subject: 'Science', year: 2023, level: 'Grade 6', questions: 50, duration: '2 hours' },
  { id: 5, title: 'PLE English 2023', country: 'Uganda', type: 'PLE', subject: 'English', year: 2023, level: 'P7', questions: 45, duration: '2 hours' },
  { id: 6, title: 'Common Entrance Science 2023', country: 'Nigeria', type: 'Common Entrance', subject: 'General Science', year: 2023, level: 'Primary 5-6', questions: 40, duration: '1 hour' },
  { id: 7, title: 'PSLE Mathematics 2023', country: 'Tanzania', type: 'PSLE', subject: 'Mathematics', year: 2023, level: 'Standard 7', questions: 50, duration: '2.5 hours' },
  { id: 8, title: 'ANA Grade 3 Literacy 2023', country: 'South Africa', type: 'ANA', subject: 'Literacy', year: 2023, level: 'Grade 3', questions: 30, duration: '1 hour' },
  { id: 9, title: 'First School CRS 2022', country: 'Nigeria', type: 'First School', subject: 'Christian Religious Studies', year: 2022, level: 'Primary 6', questions: 40, duration: '1.5 hours' },
  { id: 10, title: 'BECE Social Studies 2022', country: 'Ghana', type: 'BECE', subject: 'Social Studies', year: 2022, level: 'Primary 6', questions: 40, duration: '1.5 hours' },
  { id: 11, title: 'Common Entrance Verbal Reasoning 2024', country: 'Nigeria', type: 'Common Entrance', subject: 'Verbal Reasoning', year: 2024, level: 'Primary 5-6', questions: 50, duration: '45 min' },
  { id: 12, title: 'KCPE Social Studies 2022', country: 'Kenya', type: 'KCPE', subject: 'Social Studies', year: 2022, level: 'Grade 6', questions: 50, duration: '2 hours' },
];

const ExamBank: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedExam, setSelectedExam] = useState<typeof SAMPLE_EXAMS[0] | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const allCountries = [...new Set(SAMPLE_EXAMS.map(e => e.country))];
  const allTypes = [...new Set(SAMPLE_EXAMS.map(e => e.type))];

  const filtered = SAMPLE_EXAMS.filter(exam => {
    if (countryFilter !== 'all' && exam.country !== countryFilter) return false;
    if (typeFilter !== 'all' && exam.type !== typeFilter) return false;
    if (searchQuery && !exam.title.toLowerCase().includes(searchQuery.toLowerCase()) && !exam.subject.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-600 to-orange-800 text-white py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Exam Bank</h1>
                <p className="text-amber-200">Past papers, practice tests & exam resources</p>
              </div>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="hidden sm:flex items-center gap-2 px-4 py-2.5 bg-white/20 backdrop-blur-sm rounded-xl text-sm font-medium hover:bg-white/30 transition-all border border-white/20"
            >
              <Plus className="w-4 h-4" /> Add Exam
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 -mt-6">
        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                placeholder="Search exams..."
              />
            </div>
            <select value={countryFilter} onChange={e => setCountryFilter(e.target.value)} className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-amber-500 outline-none">
              <option value="all">All Countries</option>
              {allCountries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-amber-500 outline-none">
              <option value="all">All Types</option>
              {allTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Exams', value: SAMPLE_EXAMS.length, icon: FileText, color: 'bg-amber-50 text-amber-600' },
            { label: 'Countries', value: allCountries.length, icon: Filter, color: 'bg-blue-50 text-blue-600' },
            { label: 'Subjects', value: [...new Set(SAMPLE_EXAMS.map(e => e.subject))].length, icon: BookOpen, color: 'bg-emerald-50 text-emerald-600' },
            { label: 'Years Covered', value: '2020-2024', icon: Calendar, color: 'bg-purple-50 text-purple-600' },
          ].map((stat, i) => (
            <div key={i} className="bg-white rounded-xl p-4 border border-gray-100">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${stat.color}`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-xs text-gray-500">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Exam List */}
        <div className="space-y-3 pb-12">
          {filtered.map(exam => (
            <div
              key={exam.id}
              onClick={() => setSelectedExam(selectedExam?.id === exam.id ? null : exam)}
              className={`bg-white rounded-xl border transition-all cursor-pointer ${
                selectedExam?.id === exam.id ? 'border-amber-300 shadow-lg shadow-amber-100' : 'border-gray-100 hover:border-gray-200 hover:shadow-md'
              }`}
            >
              <div className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <FileText className="w-6 h-6 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-sm">{exam.title}</h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{exam.country}</span>
                    <span className="text-xs bg-gray-50 text-gray-600 px-2 py-0.5 rounded-full">{exam.subject}</span>
                    <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full">{exam.level}</span>
                    <span className="text-xs text-gray-400 flex items-center gap-1"><Calendar className="w-3 h-3" />{exam.year}</span>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-3 text-sm text-gray-500">
                  <span className="flex items-center gap-1"><FileText className="w-4 h-4" />{exam.questions} Qs</span>
                  <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{exam.duration}</span>
                </div>
                <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${selectedExam?.id === exam.id ? 'rotate-90' : ''}`} />
              </div>

              {selectedExam?.id === exam.id && (
                <div className="px-4 pb-4 border-t border-gray-100 pt-4">
                  <div className="grid sm:grid-cols-3 gap-3">
                    <button className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-50 text-amber-700 rounded-xl text-sm font-medium hover:bg-amber-100 transition-all">
                      <Eye className="w-4 h-4" /> View Questions
                    </button>
                    <button className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 text-blue-700 rounded-xl text-sm font-medium hover:bg-blue-100 transition-all">
                      <Download className="w-4 h-4" /> Download PDF
                    </button>
                    <button className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-medium hover:bg-emerald-100 transition-all">
                      <BookOpen className="w-4 h-4" /> Practice Test
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No exams found</h3>
            <p className="text-gray-500 text-sm">Try adjusting your filters</p>
          </div>
        )}
      </div>

      {/* Add Exam Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Add New Exam</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Exam Title</label>
                <input className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none" placeholder="e.g., Common Entrance 2025" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                  <select className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-amber-500 outline-none">
                    {REGIONS.flatMap(r => r.countries).map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                  <input type="number" defaultValue={2025} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <input className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none" placeholder="e.g., Mathematics" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Upload Exam Paper (PDF)</label>
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-amber-300 transition-colors cursor-pointer">
                  <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Click to upload or drag and drop</p>
                  <p className="text-xs text-gray-400 mt-1">PDF, DOC up to 10MB</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowAddModal(false)} className="flex-1 py-3 border border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={() => setShowAddModal(false)} className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium hover:shadow-lg transition-all">Save Exam</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamBank;
