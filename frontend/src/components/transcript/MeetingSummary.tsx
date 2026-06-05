import { useState } from 'react';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

interface MeetingSummaryProps {
  summary: string;
  speakerNames?: Record<string, string>;
}

export function MeetingSummary({ summary, speakerNames }: MeetingSummaryProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Replace any leftover original speaker labels with their renamed versions
  const resolvedSummary = speakerNames
    ? Object.entries(speakerNames).reduce(
        (text, [label, name]) => text.replaceAll(label, name),
        summary
      )
    : summary;

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary-500 flex-shrink-0" />
          <span className="font-semibold text-gray-900 dark:text-white text-sm">
            AI Meeting Summary
          </span>
        </div>
        {collapsed ? (
          <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
        )}
      </button>

      {!collapsed && (
        <div className="px-5 pb-5 border-t border-gray-100 dark:border-gray-700 pt-4">
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
            {resolvedSummary}
          </p>
        </div>
      )}
    </div>
  );
}
