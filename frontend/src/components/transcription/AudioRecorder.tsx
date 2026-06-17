import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, Pause, Play, Trash2, CheckCircle2, AlertCircle, Monitor } from 'lucide-react';
import { clsx } from 'clsx';
import { formatDuration } from '../../utils/formatters';

type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped';

interface AudioRecorderProps {
  onRecordingComplete: (file: File | null) => void;
}

const BAR_COUNT = 48;
const MAX_DURATION = 2 * 60 * 60;

export function AudioRecorder({ onRecordingComplete }: AudioRecorderProps) {
  const [state, setState] = useState<RecordingState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [bars, setBars] = useState<number[]>(new Array(BAR_COUNT).fill(2));
  const [error, setError] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [systemAudioEnabled, setSystemAudioEnabled] = useState(false);
  const [systemAudioActive, setSystemAudioActive] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const acquireWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      }
    } catch {
      // Not supported or user denied — recording continues without it
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      try { await wakeLockRef.current.release(); } catch { /* ignore */ }
      wakeLockRef.current = null;
    }
  };

  // Re-acquire wake lock when user returns to the tab while recording
  // (browsers auto-release it when the tab becomes hidden)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && state === 'recording') {
        acquireWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [state]);

  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const stopAnimation = () => {
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
  };

  const cleanupMedia = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    displayStreamRef.current?.getTracks().forEach((t) => t.stop());
    displayStreamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }, []);

  const animateWaveform = useCallback(() => {
    if (!analyserRef.current) return;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    const chunkSize = Math.floor(dataArray.length / BAR_COUNT);
    const newBars = Array.from({ length: BAR_COUNT }, (_, i) => {
      const start = i * chunkSize;
      const chunk = dataArray.slice(start, start + chunkSize);
      const avg = chunk.reduce((a, b) => a + b, 0) / chunk.length;
      return Math.max(2, (avg / 255) * 64);
    });
    setBars(newBars);
    animFrameRef.current = requestAnimationFrame(animateWaveform);
  }, []);

  const startRecording = async () => {
    setError('');
    chunksRef.current = [];
    setSystemAudioActive(false);

    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = micStream;

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const destination = audioCtx.createMediaStreamDestination();

      // Mic → waveform analyser + recording destination
      const micSource = audioCtx.createMediaStreamSource(micStream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      micSource.connect(analyser);
      micSource.connect(destination);
      analyserRef.current = analyser;

      // System audio (laptop meeting audio)
      if (systemAudioEnabled) {
        try {
          // video: true is required by some browsers; we immediately drop the video track
          const displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
          });
          displayStream.getVideoTracks().forEach((t) => t.stop());

          const audioTracks = displayStream.getAudioTracks();
          if (audioTracks.length > 0) {
            displayStreamRef.current = displayStream;
            audioCtx.createMediaStreamSource(displayStream).connect(destination);
            setSystemAudioActive(true);
            // If user stops sharing mid-recording, reflect that in the UI
            audioTracks[0].onended = () => setSystemAudioActive(false);
          } else {
            // Source had no audio channel
            displayStream.getTracks().forEach((t) => t.stop());
          }
        } catch {
          // User cancelled the screen-share picker — continue with mic only
        }
      }

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      // 48kbps keeps a full 2-hour recording around ~43MB, well within the upload limit
      const recorder = new MediaRecorder(destination.stream, { mimeType, audioBitsPerSecond: 48000 });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const file = new File([blob], 'recording.webm', { type: mimeType });
        setAudioUrl(URL.createObjectURL(blob));
        onRecordingComplete(file);
        stopAnimation();
        setBars(new Array(BAR_COUNT).fill(2));
        cleanupMedia();
      };

      recorder.start(200);
      setState('recording');
      await acquireWakeLock();

      timerRef.current = window.setInterval(() => {
        setElapsed((prev) => {
          if (prev >= MAX_DURATION) { stopRecording(); return prev; }
          return prev + 1;
        });
      }, 1000);

      animFrameRef.current = requestAnimationFrame(animateWaveform);
    } catch (err) {
      cleanupMedia();
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone permissions.');
      } else {
        setError('Could not access microphone. Please check your device settings.');
      }
    }
  };

  const pauseRecording = async () => {
    mediaRecorderRef.current?.pause();
    setState('paused');
    stopTimer();
    stopAnimation();
    await releaseWakeLock();
  };

  const resumeRecording = async () => {
    mediaRecorderRef.current?.resume();
    setState('recording');
    timerRef.current = window.setInterval(() => setElapsed((p) => p + 1), 1000);
    animFrameRef.current = requestAnimationFrame(animateWaveform);
    await acquireWakeLock();
  };

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setState('stopped');
    stopTimer();
    stopAnimation();
    setSystemAudioActive(false);
    releaseWakeLock();
  }, []);

  const discardRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl('');
    setElapsed(0);
    setBars(new Array(BAR_COUNT).fill(2));
    setState('idle');
    setSystemAudioActive(false);
    onRecordingComplete(null);
    cleanupMedia();
  };

  useEffect(() => {
    return () => {
      stopTimer();
      stopAnimation();
      cleanupMedia();
      releaseWakeLock();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl, cleanupMedia]);

  if (state === 'stopped' && audioUrl) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg px-4 py-3">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          <span className="text-sm font-medium">Recording complete · {formatDuration(elapsed)}</span>
        </div>
        <audio src={audioUrl} controls className="w-full rounded-lg" />
        <button
          onClick={discardRecording}
          className="btn-ghost text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
        >
          <Trash2 className="h-4 w-4" />
          Discard and re-record
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg px-4 py-3">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* System audio toggle — only show before recording starts */}
      {state === 'idle' && (
        <button
          type="button"
          onClick={() => setSystemAudioEnabled((v) => !v)}
          className={clsx(
            'w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all',
            systemAudioEnabled
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30 text-primary-700 dark:text-primary-300'
              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
          )}
        >
          <Monitor className={clsx('h-4 w-4 flex-shrink-0', systemAudioEnabled ? 'text-primary-600 dark:text-primary-400' : '')} />
          <div className="flex-1 text-left">
            <p>Include system audio</p>
            <p className="text-xs font-normal opacity-70 mt-0.5">Captures audio from meetings / apps on this device · Chrome &amp; Edge only</p>
          </div>
          <div className={clsx(
            'w-9 h-5 rounded-full transition-colors flex-shrink-0',
            systemAudioEnabled ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
          )}>
            <div className={clsx(
              'w-4 h-4 rounded-full bg-white mt-0.5 transition-transform shadow-sm',
              systemAudioEnabled ? 'translate-x-4' : 'translate-x-0.5'
            )} />
          </div>
        </button>
      )}

      {/* Waveform visualizer */}
      <div className="flex items-center justify-center gap-0.5 h-20 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 px-4">
        {bars.map((height, i) => (
          <div
            key={i}
            className={clsx(
              'w-1 rounded-full transition-all duration-75',
              state === 'recording'
                ? 'bg-primary-500 dark:bg-primary-400'
                : state === 'paused'
                ? 'bg-amber-400'
                : 'bg-gray-300 dark:bg-gray-700'
            )}
            style={{ height: `${height}px` }}
          />
        ))}
      </div>

      {/* Timer + status */}
      <div className="flex items-center justify-center gap-3">
        <div className={clsx('flex items-center gap-2 font-mono text-2xl font-bold',
          state === 'recording' ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
        )}>
          {state === 'recording' && <span className="h-2.5 w-2.5 rounded-full bg-red-500 recording-pulse" />}
          {state === 'paused' && <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />}
          {formatDuration(elapsed)}
        </div>
        <div className="text-sm text-gray-400 text-center">
          {state === 'recording'
            ? systemAudioActive ? 'Recording mic + system audio' : 'Recording...'
            : state === 'paused' ? 'Paused'
            : 'Ready'}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        {state === 'idle' && (
          <button
            onClick={startRecording}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-red-500 hover:bg-red-600 text-white font-medium transition-colors shadow-sm"
          >
            <Mic className="h-5 w-5" />
            Start Recording
          </button>
        )}

        {state === 'recording' && (
          <>
            <button
              onClick={pauseRecording}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors"
            >
              <Pause className="h-4 w-4" />
              Pause
            </button>
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-300 font-medium transition-colors"
            >
              <Square className="h-4 w-4" />
              Stop
            </button>
          </>
        )}

        {state === 'paused' && (
          <>
            <button
              onClick={resumeRecording}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary-600 hover:bg-primary-700 text-white font-medium transition-colors"
            >
              <Play className="h-4 w-4" />
              Resume
            </button>
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-medium transition-colors"
            >
              <Square className="h-4 w-4" />
              Stop
            </button>
            <button
              onClick={discardRecording}
              className="p-2.5 rounded-full hover:bg-red-50 dark:hover:bg-red-950/30 text-red-500 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
