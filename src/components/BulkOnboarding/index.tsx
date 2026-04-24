import React, { useState, useRef } from 'react';
import {
  Upload, FileText, CheckCircle2, AlertCircle, Download,
  Loader2, Building2, X, Play
} from 'lucide-react';
import {
  parseCSV, bulkCreateSchools, BulkSchoolRow,
  CSV_TEMPLATE_HEADERS, CSV_TEMPLATE_EXAMPLE
} from '@/services/bulkOnboardingService';

interface BulkOnboardingProps {
  defaultCountry?: string;
}

const BulkOnboarding: React.FC<BulkOnboardingProps> = ({ defaultCountry = '' }) => {
  const [rows, setRows] = useState<BulkSchoolRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setParseError('');
    setResult(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        const parsed = parseCSV(text);
        if (parsed.length === 0) {
          setParseError('No valid rows found. Check your CSV format.');
          setRows([]);
        } else {
          setRows(parsed);
        }
      } catch {
        setParseError('Failed to parse CSV. Ensure it uses comma-separated format with a header row.');
        setRows([]);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith('.csv')) handleFile(file);
  };

  const handleRun = async () => {
    if (!rows.length) return;
    setRunning(true);
    setResult(null);
    const res = await bulkCreateSchools(rows);
    setResult(res);
    setRunning(false);
    if (res.created > 0) setRows([]);
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE_EXAMPLE], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'edupro_school_template.csv';
    a.click();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-700 to-purple-800 text-white py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Bulk School Onboarding</h1>
              <p className="text-indigo-200">Upload a CSV to create schools, districts, and teacher accounts at scale</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-6 pb-16 space-y-6">
        {/* Template download */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-bold text-gray-900">Step 1 — Download Template</h2>
              <p className="text-sm text-gray-500 mt-0.5">Use this template to prepare your school data</p>
            </div>
            <button onClick={downloadTemplate}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-all">
              <Download className="w-4 h-4" /> Download CSV Template
            </button>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 font-mono text-xs text-gray-600 overflow-x-auto">
            <div className="text-gray-400 mb-1">Required columns:</div>
            {CSV_TEMPLATE_HEADERS}
          </div>
        </div>

        {/* File upload */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
          <h2 className="font-bold text-gray-900 mb-4">Step 2 — Upload Your CSV</h2>

          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all"
          >
            <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="font-medium text-gray-600">
              {fileName ? fileName : 'Drop your CSV here or click to browse'}
            </p>
            <p className="text-xs text-gray-400 mt-1">Supports .csv files up to 5 MB</p>
          </div>
          <input ref={fileRef} type="file" accept=".csv" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

          {parseError && (
            <div className="mt-3 flex items-center gap-2 text-red-600 bg-red-50 px-4 py-2.5 rounded-xl text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {parseError}
            </div>
          )}
        </div>

        {/* Preview table */}
        {rows.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">Step 3 — Preview ({rows.length} schools)</h2>
              <button onClick={() => { setRows([]); setFileName(''); }}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['School Name', 'District', 'Country', 'Subjects', 'Grades'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 10).map((r, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="px-4 py-2 font-medium text-gray-900 text-xs">{r.schoolName}</td>
                      <td className="px-4 py-2 text-gray-600 text-xs">{r.district || '—'}</td>
                      <td className="px-4 py-2 text-gray-600 text-xs">{r.country || '—'}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs">{r.subjects || '—'}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs">{r.grades || '—'}</td>
                    </tr>
                  ))}
                  {rows.length > 10 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-2 text-xs text-center text-gray-400">
                        + {rows.length - 10} more schools not shown
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <button onClick={handleRun} disabled={running}
              className="mt-4 w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {running
                ? <><Loader2 className="w-5 h-5 animate-spin" /> Creating schools...</>
                : <><Play className="w-5 h-5" /> Create {rows.length} School{rows.length > 1 ? 's' : ''}</>
              }
            </button>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className={`rounded-2xl border p-6 ${result.errors.length === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex items-center gap-3 mb-3">
              {result.errors.length === 0
                ? <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                : <AlertCircle className="w-6 h-6 text-amber-600" />
              }
              <h3 className={`font-bold ${result.errors.length === 0 ? 'text-emerald-800' : 'text-amber-800'}`}>
                {result.created} school{result.created !== 1 ? 's' : ''} created successfully
                {result.skipped > 0 && `, ${result.skipped} skipped`}
              </h3>
            </div>
            {result.errors.length > 0 && (
              <ul className="space-y-1">
                {result.errors.map((err, i) => (
                  <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                    <span className="text-amber-400 mt-0.5">•</span> {err}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BulkOnboarding;
