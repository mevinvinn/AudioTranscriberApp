import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Clock, Users, Calendar, Edit2, Check, X,
  Download, AlertTriangle, Loader2, FileText, FileType, ChevronDown
} from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { AudioPlayer } from '../components/transcript/AudioPlayer';
import { TranscriptViewer } from '../components/transcript/TranscriptViewer';
import { TagManager } from '../components/transcript/TagManager';
import { SpeakerRenamer } from '../components/transcript/SpeakerRenamer';
import { MeetingSummary } from '../components/transcript/MeetingSummary';
import { Spinner } from '../components/ui/Spinner';
import type { Meeting } from '../types';
import { formatDuration, formatDate } from '../utils/formatters';
import api, { getApiError, resolveMediaUrl } from '../services/api';

export function TranscriptDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [seekTo, setSeekTo] = useState<number | null>(null);
  const [speakerNames, setSpeakerNames] = useState<Record<string, string>>({});
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const fetchMeeting = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/meetings/${id}`);
      setMeeting(data.meeting);
      setEditTitle(data.meeting.title);
      try {
        setSpeakerNames(JSON.parse(data.meeting.speakerNames || '{}'));
      } catch {
        setSpeakerNames({});
      }
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchMeeting(); }, [fetchMeeting]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  // Close export menu when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSaveTitle = async () => {
    if (!meeting || !editTitle.trim()) return;
    setIsSavingTitle(true);
    try {
      await api.patch(`/meetings/${meeting.id}`, { title: editTitle.trim() });
      setMeeting((m) => m ? { ...m, title: editTitle.trim() } : m);
      setIsEditingTitle(false);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setIsSavingTitle(false);
    }
  };

  const handleTagUpdate = (newTags: string[]) => {
    setMeeting((m) =>
      m ? { ...m, tags: newTags.map((t, i) => ({ id: `tag-${i}`, tagName: t })) } : m
    );
  };

  const handleExport = async (format: 'txt' | 'docx' | 'pdf') => {
    if (!meeting) return;
    setExportMenuOpen(false);
    setIsExporting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/meetings/${meeting.id}/export?format=${format}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = meeting.title.replace(/[^a-z0-9]/gi, '_');
      a.download = `${safeName}_transcript.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      </Layout>
    );
  }

  if (error || !meeting) {
    return (
      <Layout>
        <div className="max-w-xl mx-auto py-16 text-center">
          <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Meeting not found</h2>
          <p className="text-gray-500 mb-4">{error || 'This meeting may have been deleted.'}</p>
          <button onClick={() => navigate('/dashboard')} className="btn-primary">
            Back to Dashboard
          </button>
        </div>
      </Layout>
    );
  }

  const audioUrl = resolveMediaUrl(meeting.audioFileUrl || '');
  const segments = meeting.transcriptSegs || [];

  return (
    <Layout>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors mt-1"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="flex-1 min-w-0">
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  ref={titleInputRef}
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTitle();
                    if (e.key === 'Escape') setIsEditingTitle(false);
                  }}
                  className="input-base text-xl font-bold py-1"
                />
                <button
                  onClick={handleSaveTitle}
                  disabled={isSavingTitle}
                  className="p-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                >
                  {isSavingTitle ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => setIsEditingTitle(false)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate">
                  {meeting.title}
                </h1>
                <button
                  onClick={() => setIsEditingTitle(true)}
                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-all"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Metadata row */}
            <div className="flex flex-wrap items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(meeting.createdAt)}
              </span>
              {meeting.duration != null && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDuration(meeting.duration)}
                </span>
              )}
              {meeting.speakerCount != null && (
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {meeting.speakerCount} speaker{meeting.speakerCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Tags */}
            <div className="mt-2">
              <TagManager
                meetingId={meeting.id}
                tags={meeting.tags.map((t) => t.tagName)}
                onUpdate={handleTagUpdate}
              />
            </div>
          </div>

          {/* Export dropdown */}
          {segments.length > 0 && (
            <div className="relative flex-shrink-0" ref={exportMenuRef}>
              <button
                onClick={() => setExportMenuOpen((o) => !o)}
                disabled={isExporting}
                className="btn-secondary flex items-center gap-1.5"
              >
                {isExporting
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Download className="h-4 w-4" />
                }
                <span className="hidden sm:block">Export</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </button>

              {exportMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20 overflow-hidden">
                  <div className="px-3 py-2 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Export Transcript
                  </div>
                  <button
                    onClick={() => handleExport('txt')}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <FileText className="h-4 w-4 text-gray-400" />
                    Export as TXT
                  </button>
                  <button
                    onClick={() => handleExport('docx')}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <FileType className="h-4 w-4 text-blue-500" />
                    Export as Word (.docx)
                  </button>
                  <button
                    onClick={() => handleExport('pdf')}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <FileText className="h-4 w-4 text-red-500" />
                    Export as PDF
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Main content */}
        {meeting.status === 'processing' || meeting.status === 'pending' ? (
          <div className="card p-12 flex flex-col items-center text-center">
            <Loader2 className="h-12 w-12 text-primary-500 animate-spin mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Transcription in progress
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              Our AI is processing your audio. This usually takes 1–3 minutes.
            </p>
          </div>
        ) : meeting.status === 'failed' ? (
          <div className="card p-12 flex flex-col items-center text-center">
            <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Transcription failed
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {meeting.errorMessage || 'An error occurred during transcription.'}
            </p>
            <button onClick={() => navigate('/new')} className="btn-primary">
              Try again
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* AI Summary — shown above the transcript grid */}
            {meeting.summary && (
              <MeetingSummary summary={meeting.summary} speakerNames={speakerNames} />
            )}

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Left: Player */}
              <div className="lg:col-span-2 space-y-4">
                {audioUrl ? (
                  <AudioPlayer
                    src={audioUrl}
                    onTimeUpdate={setCurrentTime}
                    seekTo={seekTo}
                  />
                ) : (
                  <div className="card p-6 text-center text-sm text-gray-400">
                    Audio file not available
                  </div>
                )}

                {/* Speaker Renamer */}
                {segments.length > 0 && (
                  <SpeakerRenamer
                    meetingId={meeting.id}
                    speakerLabels={[...new Set(segments.map((s) => s.speakerLabel))]}
                    speakerNames={speakerNames}
                    onUpdate={setSpeakerNames}
                  />
                )}

                {/* Stats */}
                <div className="card p-4 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Duration</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {formatDuration(meeting.duration)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Speakers</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {meeting.speakerCount ?? '--'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Segments</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {segments.length}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Words (est.)</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {segments.reduce((acc, s) => acc + s.transcriptText.split(' ').length, 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right: Transcript */}
              <div className="lg:col-span-3 min-h-[600px]">
                {segments.length > 0 ? (
                  <TranscriptViewer
                    segments={segments}
                    currentTime={currentTime}
                    onSeek={(t) => setSeekTo(t)}
                    speakerNames={speakerNames}
                  />
                ) : (
                  <div className="card p-8 text-center text-sm text-gray-400">
                    No transcript available
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
