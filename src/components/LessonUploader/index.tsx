import React, { useState, useRef } from 'react';
import { Upload, FileText, Loader2, CheckCircle, X } from 'lucide-react';
import { processUpload } from '../../services/processUploads';

interface LessonUploaderProps {
  country: string;
  ownerId: string;
  onComplete?: (jobId: string) => void;
}

const LessonUploader: React.FC<LessonUploaderProps> = ({ country, ownerId, onComplete }) => {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (!allowed.includes(f.type)) { setError('Only PDF, DOCX, or TXT files are supported.'); return; }
    setFile(f);
    setError('');
    setDone(false);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const jobId = await processUpload(file, country, ownerId);
      setDone(true);
      onComplete?.(jobId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
          dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
        }`}
      >
        <input ref={inputRef} type="file" className="hidden" accept=".pdf,.docx,.txt"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

        {done ? (
          <div className="flex flex-col items-center gap-2 text-emerald-600">
            <CheckCircle className="w-10 h-10" />
            <p className="font-semibold">Upload complete! Processing in background.</p>
          </div>
        ) : file ? (
          <div className="flex flex-col items-center gap-2">
            <FileText className="w-10 h-10 text-blue-500" />
            <p className="font-medium text-gray-800">{file.name}</p>
            <p className="text-sm text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
            <button onClick={(e) => { e.stopPropagation(); setFile(null); }}
              className="text-gray-400 hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-gray-400">
            <Upload className="w-10 h-10" />
            <p className="text-sm">Drag & drop or <span className="text-blue-600 font-medium">browse</span></p>
            <p className="text-xs">PDF, DOCX, or TXT — max 10MB</p>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-500 mt-2">{error}</p>}

      {file && !done && (
        <button onClick={handleUpload} disabled={uploading}
          className="mt-4 w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-all">
          {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : <><Upload className="w-4 h-4" /> Upload & Embed</>}
        </button>
      )}
    </div>
  );
};

export default LessonUploader;
