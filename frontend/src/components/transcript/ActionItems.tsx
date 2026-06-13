import { CheckCircle2, Circle, ListChecks } from 'lucide-react';
import type { ActionItem } from '../../types';
import { formatTimestamp } from '../../utils/formatters';
import { clsx } from 'clsx';

interface ActionItemsProps {
  actionItems: string;
  speakerNames?: Record<string, string>;
  onSeek?: (seconds: number) => void;
}

export function ActionItems({ actionItems, speakerNames = {}, onSeek }: ActionItemsProps) {
  let items: ActionItem[] = [];
  try {
    items = JSON.parse(actionItems || '[]');
  } catch {
    items = [];
  }

  if (items.length === 0) return null;

  const displayName = (label: string) => speakerNames[label] || label;

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <ListChecks className="h-4 w-4 text-primary-500 flex-shrink-0" />
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Action Items
        </p>
      </div>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li
            key={i}
            onClick={() => onSeek?.(item.timestamp)}
            className={clsx(
              'flex items-start gap-2 text-sm rounded-lg px-2 py-1.5 -mx-2 transition-colors',
              onSeek && 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50'
            )}
          >
            {item.status === 'done' ? (
              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
            ) : (
              <Circle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <p
                className={clsx(
                  'text-gray-700 dark:text-gray-300 leading-snug',
                  item.status === 'done' && 'line-through text-gray-400 dark:text-gray-500'
                )}
              >
                {item.text}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {displayName(item.speaker)} &middot; {formatTimestamp(item.timestamp)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
