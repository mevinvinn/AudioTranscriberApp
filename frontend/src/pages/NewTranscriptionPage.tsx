import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tag, Upload, Mic, ArrowLeft, Loader2, CheckCircle2, Info } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { AudioUploader } from '../components/transcription/AudioUploader';
import { AudioRecorder } from '../components/transcription/AudioRecorder';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import api, { getApiError } from '../services/api';
import { clsx } from 'clsx';

type AudioSource = 'upload' | 'record';

export function NewTranscriptionPage() {
  const [title, setTitle] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [audioSource, setAudioSource] = useState<AudioSource>('upload');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [recordedFile, setRecordedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const activeFile = audioSource === 'upload' ? uploadFile : recordedFile;

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag) && tags.length < 10) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => setTags(tags.filter((t) => t !== tag));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (!title.trim()) {
      setSubmitError('Please enter a meeting title');
      return;
    }

    if (!activeFile) {
      setSubmitError(`Please ${audioSource === 'upload' ? 'upload' : 'record'} an audio file`);
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('tags', JSON.stringify(tags));
      formData.append('audio', activeFile, activeFile.name);

      const { data } = await api.post('/meetings', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 600000, // 10 minutes - allows larger files on slower connections
      });

      setSuccess(true);
      setTimeout(() => navigate(`/dashboard`), 2000);
      void data;
    } catch (err) {
      setSubmitError(getApiError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <Layout>
        <div className="max-w-xl mx-auto py-16 flex flex-col items-center text-center">
          <div className="rounded-full bg-emerald-100 dark:bg-emerald-900/40 p-6 mb-4">
            <CheckCircle2 className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Upload successful!</h2>
          <p className="text-gray-500 dark:text-gray-400">
            Your meeting is being transcribed. This usually takes 1–3 minutes.
            Redirecting to your dashboard...
          </p>
          <div className="mt-6">
            <Spinner size="md" />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">New Transcription</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Upload or record your meeting</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Meeting Details */}
          <div className="card p-6 space-y-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">Meeting Details</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Meeting title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Weekly Team Standup, Client Call Q1..."
                className="input-base"
                maxLength={200}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Tags <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <div className="flex gap-2 mb-2">
                <div className="relative flex-1">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); addTag(); }
                      if (e.key === ',') { e.preventDefault(); addTag(); }
                    }}
                    placeholder="Add tags (e.g. Work, Client Call)"
                    className="input-base pl-9"
                  />
                </div>
                <button type="button" onClick={addTag} className="btn-secondary px-3">
                  Add
                </button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <Badge key={tag} label={tag} color="indigo" size="md" onRemove={() => removeTag(tag)} />
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {['Work', 'Team Meeting', 'Client Call', 'College', 'Personal'].filter(t => !tags.includes(t)).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { if (!tags.includes(t)) setTags([...tags, t]); }}
                    className="px-2.5 py-1 text-xs rounded-full border border-dashed border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                  >
                    + {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Audio Source */}
          <div className="card p-6 space-y-4">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Audio Source</h2>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {([
                  { id: 'upload', icon: Upload, label: 'Upload File', desc: 'MP3, WAV, M4A, AAC' },
                  { id: 'record', icon: Mic, label: 'Record Audio', desc: 'From microphone' },
                ] as const).map(({ id, icon: Icon, label, desc }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setAudioSource(id)}
                    className={clsx(
                      'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
                      audioSource === id
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30 text-primary-700 dark:text-primary-300'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400'
                    )}
                  >
                    <Icon className={clsx('h-6 w-6', audioSource === id ? 'text-primary-600 dark:text-primary-400' : '')} />
                    <div>
                      <p className="font-medium text-sm">{label}</p>
                      <p className="text-xs opacity-70">{desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {audioSource === 'upload' ? (
              <AudioUploader file={uploadFile} onFileSelect={setUploadFile} />
            ) : (
              <AudioRecorder onRecordingComplete={setRecordedFile} />
            )}

            {/* Info note */}
            <div className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
              <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>
                Transcription uses AI to identify speakers, add timestamps, and remove filler words.
                Processing typically takes 1–3 minutes depending on audio length.
              </span>
            </div>
          </div>

          {/* Submit error */}
          {submitError && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3 text-red-700 dark:text-red-400 text-sm">
              {submitError}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => navigate('/dashboard')} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !activeFile || !title.trim()}
              className="btn-primary min-w-[160px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Start Transcribing
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
