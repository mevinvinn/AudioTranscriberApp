import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { formatTimestamp } from '../../utils/formatters';
import { clsx } from 'clsx';

interface AudioPlayerProps {
  src: string;
  onTimeUpdate?: (time: number) => void;
  seekTo?: number | null;
  fallbackDuration?: number;
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export function AudioPlayer({ src, onTimeUpdate, seekTo, fallbackDuration }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlers = {
      timeupdate: () => {
        setCurrentTime(audio.currentTime);
        onTimeUpdate?.(audio.currentTime);
      },
      durationchange: () => {
        if (Number.isFinite(audio.duration)) setDuration(audio.duration);
      },
      loadedmetadata: () => {
        if (Number.isFinite(audio.duration)) setDuration(audio.duration);
        setIsLoaded(true);
      },
      ended: () => setIsPlaying(false),
      play: () => setIsPlaying(true),
      pause: () => setIsPlaying(false),
    };

    Object.entries(handlers).forEach(([event, handler]) => {
      audio.addEventListener(event, handler);
    });

    return () => {
      Object.entries(handlers).forEach(([event, handler]) => {
        audio.removeEventListener(event, handler);
      });
    };
  }, [onTimeUpdate]);

  useEffect(() => {
    if (seekTo !== null && seekTo !== undefined && audioRef.current && isLoaded) {
      audioRef.current.currentTime = seekTo;
      audioRef.current.play().catch(() => {});
    }
  }, [seekTo, isLoaded]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
  };

  const effectiveDuration = duration > 0 ? duration : (fallbackDuration ?? 0);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = progressRef.current?.getBoundingClientRect();
    if (!rect || !audioRef.current || !effectiveDuration) return;
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    audioRef.current.currentTime = ratio * effectiveDuration;
  }, [effectiveDuration]);

  const seek = (delta: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, Math.min(effectiveDuration, currentTime + delta));
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    if (audioRef.current) audioRef.current.volume = v;
    setVolume(v);
    setIsMuted(v === 0);
  };

  const setSpeed = (speed: number) => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
    setPlaybackSpeed(speed);
  };

  const progress = effectiveDuration > 0 ? (currentTime / effectiveDuration) * 100 : 0;

  return (
    <div className="card p-4 space-y-3">
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Progress bar */}
      <div className="space-y-1">
        <div
          ref={progressRef}
          className="relative h-2 rounded-full bg-gray-200 dark:bg-gray-700 cursor-pointer group"
          onClick={handleProgressClick}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-primary-600 transition-none"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-primary-600 shadow opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `${progress}%`, transform: 'translate(-50%, -50%)' }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
          <span>{formatTimestamp(Math.floor(currentTime))}</span>
          <span>{effectiveDuration > 0 ? formatTimestamp(Math.floor(effectiveDuration)) : '--:--'}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button onClick={toggleMute} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
            {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-20 accent-primary-600 cursor-pointer"
          />
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => seek(-10)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors" title="-10s">
            <SkipBack className="h-4 w-4" />
          </button>
          <button
            onClick={togglePlay}
            className="h-10 w-10 rounded-full bg-primary-600 hover:bg-primary-700 text-white flex items-center justify-center transition-colors shadow-sm"
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
          </button>
          <button onClick={() => seek(10)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors" title="+10s">
            <SkipForward className="h-4 w-4" />
          </button>
        </div>

        {/* Playback speed */}
        <div className="relative">
          <select
            value={playbackSpeed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            className={clsx(
              'text-xs rounded-lg px-2 py-1.5 border cursor-pointer transition-colors appearance-none pr-6',
              'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800',
              'text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-500'
            )}
          >
            {SPEED_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}×</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
