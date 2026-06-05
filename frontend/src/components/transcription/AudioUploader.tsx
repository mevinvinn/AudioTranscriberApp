import { useCallback, useState } from 'react';
import { Upload, FileAudio, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { clsx } from 'clsx';
import { formatFileSize } from '../../utils/formatters';

const ALLOWED_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac'];
const ALLOWED_EXTS = ['.mp3', '.wav', '.m4a', '.aac'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

interface AudioUploaderProps {
  file: File | null;
  onFileSelect: (file: File | null) => void;
}

export function AudioUploader({ file, onFileSelect }: AudioUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState('');

  const validateFile = (f: File): string | null => {
    const ext = '.' + f.name.split('.').pop()?.toLowerCase();
    const typeOk = ALLOWED_TYPES.includes(f.type) || ALLOWED_EXTS.includes(ext);
    if (!typeOk) return `Unsupported format. Allowed: ${ALLOWED_EXTS.join(', ')}`;
    if (f.size > MAX_SIZE) return `File too large. Maximum size is 10MB (your file: ${formatFileSize(f.size)})`;
    return null;
  };

  const handleFile = useCallback((f: File) => {
    setError('');
    const err = validateFile(f);
    if (err) {
      setError(err);
      onFileSelect(null);
      return;
    }
    onFileSelect(f);
  }, [onFileSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = '';
  };

  return (
    <div>
      {file ? (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
          <div className="rounded-lg bg-emerald-100 dark:bg-emerald-900/40 p-2.5">
            <FileAudio className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-emerald-900 dark:text-emerald-200 truncate">{file.name}</p>
            <p className="text-sm text-emerald-600 dark:text-emerald-400">{formatFileSize(file.size)}</p>
          </div>
          <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
          <button
            onClick={() => { onFileSelect(null); setError(''); }}
            className="p-1.5 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <label
          className={clsx(
            'flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-colors',
            isDragOver
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/20'
              : 'border-gray-300 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-600 bg-gray-50 dark:bg-gray-900/50'
          )}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
        >
          <div className={clsx(
            'rounded-full p-4 transition-colors',
            isDragOver ? 'bg-primary-100 dark:bg-primary-900/40' : 'bg-gray-100 dark:bg-gray-800'
          )}>
            <Upload className={clsx('h-8 w-8 transition-colors', isDragOver ? 'text-primary-600' : 'text-gray-400')} />
          </div>
          <div className="text-center">
            <p className="font-medium text-gray-700 dark:text-gray-300">
              Drop your audio file here or{' '}
              <span className="text-primary-600 dark:text-primary-400">browse</span>
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              MP3, WAV, M4A, AAC · Max 10MB
            </p>
          </div>
          <input type="file" accept=".mp3,.wav,.m4a,.aac,audio/*" onChange={handleInput} className="hidden" />
        </label>
      )}

      {error && (
        <div className="mt-2 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
