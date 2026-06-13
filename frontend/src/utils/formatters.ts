import { formatDistanceToNow, format } from 'date-fns';

export function formatDuration(seconds?: number): string {
  if (!seconds || seconds === 0 || !Number.isFinite(seconds)) return '--:--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatTimestamp(seconds: number): string {
  return formatDuration(seconds);
}

export function formatDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
}

export function formatRelativeDate(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return dateStr;
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function highlightText(text: string, query: string): string {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(
    new RegExp(escaped, 'gi'),
    (match) => `<mark class="highlight-text">${match}</mark>`
  );
}

export function getSpeakerColor(speakerLabel: string): string {
  const colors = [
    'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  ];
  const idx = speakerLabel.charCodeAt(speakerLabel.length - 1) % colors.length;
  return colors[idx];
}

export function getSpeakerDotColor(speakerLabel: string): string {
  const colors = [
    'bg-indigo-500',
    'bg-rose-500',
    'bg-emerald-500',
    'bg-amber-500',
    'bg-violet-500',
    'bg-cyan-500',
  ];
  const idx = speakerLabel.charCodeAt(speakerLabel.length - 1) % colors.length;
  return colors[idx];
}
