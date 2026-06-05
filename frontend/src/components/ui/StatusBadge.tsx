import { clsx } from 'clsx';
import { CheckCircle2, Clock, AlertCircle, Loader2 } from 'lucide-react';
import type { MeetingStatus } from '../../types';

const config: Record<MeetingStatus, { label: string; icon: typeof CheckCircle2; classes: string }> = {
  pending: {
    label: 'Pending',
    icon: Clock,
    classes: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  },
  processing: {
    label: 'Processing',
    icon: Loader2,
    classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  failed: {
    label: 'Failed',
    icon: AlertCircle,
    classes: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  },
};

export function StatusBadge({ status }: { status: MeetingStatus }) {
  const { label, icon: Icon, classes } = config[status];
  return (
    <span
      className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', classes)}
    >
      <Icon className={clsx('h-3 w-3', status === 'processing' && 'animate-spin')} />
      {label}
    </span>
  );
}
