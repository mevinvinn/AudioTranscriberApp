import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, Pause, Play, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { formatDuration } from '../../utils/formatters';

type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped';

interface AudioRecorderProps {
  onRecordingComplete: (file: File | null) => void;
}

const BAR_COUNT = 48;

export function AudioRecorder({ onRecordingComplete }: AudioRecorderProps) {
  const [state, setState] = useState<RecordingState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [bars, setBars] = useState<number[]>(new Array(BAR_COUNT).fill(2));
  const [error, setError] = useState('');
  const [audioUrl, setAudioUrl] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const MAX_DURATION = 2 * 60 * 60; // 2 hours

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopAnimation = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  };

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

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Set up audio analyser
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const file = new File([blob], 'recording.webm', { type: mimeType });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        onRecordingComplete(file);
        stopAnimation();
        setBars(new Array(BAR_COUNT).fill(2));

        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start(200);
      setState('recording');

      timerRef.current = window.setInterval(() => {
        setElapsed((prev) => {
          if (prev >= MAX_DURATION) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);

      animFrameRef.current = requestAnimationFrame(animateWaveform);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone permissions.');
      } else {
        setError('Could not access microphone. Please check your device settings.');
      }
    }
  };

  const pauseRecording = () => {
    mediaRecorderRef.current?.pause();
    setState('paused');
    stopTimer();
    stopAnimation();
  };

  const resumeRecording = () => {
    mediaRecorderRef.current?.resume();
    setState('recording');
    timerRef.current = window.setInterval(() => setElapsed((p) => p + 1), 1000);
    animFrameRef.current = requestAnimationFrame(animateWaveform);
  };

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setState('stopped');
    stopTimer();
    stopAnimation();
  }, []);

  const discardRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl('');
    setElapsed(0);
    setBars(new Array(BAR_COUNT).fill(2));
    setState('idle');
    onRecordingComplete(null);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  };

  useEffect(() => {
    return () => {
      stopTimer();
      stopAnimation();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

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

      {/* Timer */}
      <div className="flex items-center justify-center gap-3">
        <div className={clsx('flex items-center gap-2 font-mono text-2xl font-bold',
          state === 'recording' ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
        )}>
          {state === 'recording' && (
            <span className="h-2.5 w-2.5 rounded-full bg-red-500 recording-pulse" />
          )}
          {state === 'paused' && (
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
          )}
          {formatDuration(elapsed)}
        </div>
        <span className="text-sm text-gray-400">
          {state === 'recording' ? 'Recording...' : state === 'paused' ? 'Paused' : 'Ready'}
        </span>
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
