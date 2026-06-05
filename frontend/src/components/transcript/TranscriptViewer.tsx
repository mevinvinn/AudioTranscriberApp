import { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import type { TranscriptSegment } from '../../types';
import { formatTimestamp, getSpeakerColor, getSpeakerDotColor } from '../../utils/formatters';
import { clsx } from 'clsx';

interface TranscriptViewerProps {
  segments: TranscriptSegment[];
  currentTime: number;
  onSeek: (seconds: number) => void;
  speakerNames?: Record<string, string>;
}

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightMatches(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="highlight-text">{part}</mark>
    ) : (
      part
    )
  );
}

export function TranscriptViewer({ segments, currentTime, onSeek, speakerNames = {} }: TranscriptViewerProps) {
  const displayName = (label: string) => speakerNames[label] || label;
  const [search, setSearch] = useState('');
  const [activeIdx, setActiveIdx] = useState<number>(-1);
  const activeRef = useRef<HTMLDivElement>(null);

  // Find the currently playing segment
  useEffect(() => {
    if (segments.length === 0) return;
    let current = 0;
    for (let i = 0; i < segments.length; i++) {
      if (segments[i].timestamp <= currentTime) current = i;
      else break;
    }
    setActiveIdx(current);
  }, [currentTime, segments]);

  // Scroll active segment into view
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeIdx]);

  const filteredSegments = search
    ? segments.filter(
        (s) =>
          s.transcriptText.toLowerCase().includes(search.toLowerCase()) ||
          s.speakerLabel.toLowerCase().includes(search.toLowerCase())
      )
    : segments;

  const speakerLabels = [...new Set(segments.map((s) => s.speakerLabel))];

  return (
    <div className="card flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900 dark:text-white">Transcript</h2>
          <span className="text-xs text-gray-400">{segments.length} segments</span>
        </div>

        {/* Speaker legend */}
        {speakerLabels.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {speakerLabels.map((label) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className={clsx('h-2.5 w-2.5 rounded-full', getSpeakerDotColor(label))} />
                <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', getSpeakerColor(label))}>
                  {displayName(label)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search transcript..."
            className="input-base pl-8 pr-8 text-sm py-2"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-gray-400 hover:text-gray-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {search && (
          <p className="text-xs text-gray-400 mt-1">
            {filteredSegments.length} result{filteredSegments.length !== 1 ? 's' : ''} for "{search}"
          </p>
        )}
      </div>

      {/* Segments */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {filteredSegments.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-400 dark:text-gray-500">
            No results found for "{search}"
          </div>
        ) : (
          filteredSegments.map((seg, i) => {
            const isActive = !search && activeIdx === segments.indexOf(seg);
            return (
              <div
                key={seg.id}
                ref={isActive ? activeRef : undefined}
                className={clsx(
                  'group flex gap-3 p-3 rounded-xl cursor-pointer transition-colors',
                  isActive
                    ? 'bg-primary-50 dark:bg-primary-950/30 border border-primary-200 dark:border-primary-800/50'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                )}
                onClick={() => onSeek(seg.timestamp)}
              >
                {/* Timestamp */}
                <div className="flex-shrink-0 pt-0.5">
                  <button
                    className={clsx(
                      'text-xs font-mono rounded px-1.5 py-0.5 transition-colors',
                      isActive
                        ? 'text-primary-600 dark:text-primary-400 bg-primary-100 dark:bg-primary-900/40'
                        : 'text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    )}
                  >
                    [{formatTimestamp(seg.timestamp)}]
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={clsx(
                      'h-2 w-2 rounded-full flex-shrink-0',
                      getSpeakerDotColor(seg.speakerLabel)
                    )} />
                    <span className={clsx(
                      'text-xs font-semibold',
                      isActive ? 'text-primary-700 dark:text-primary-300' : 'text-gray-600 dark:text-gray-400'
                    )}>
                      {displayName(seg.speakerLabel)}
                    </span>
                  </div>
                  <p className={clsx(
                    'text-sm leading-relaxed',
                    isActive ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-700 dark:text-gray-300'
                  )}>
                    {highlightMatches(seg.transcriptText, search)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
