import { useState } from 'react';
import { User, Check, X, Pencil } from 'lucide-react';
import { getSpeakerDotColor } from '../../utils/formatters';
import { Spinner } from '../ui/Spinner';
import api, { getApiError } from '../../services/api';

interface SpeakerRenamerProps {
  meetingId: string;
  speakerLabels: string[];
  speakerNames: Record<string, string>;
  onUpdate: (names: Record<string, string>) => void;
}

export function SpeakerRenamer({ meetingId, speakerLabels, speakerNames, onUpdate }: SpeakerRenamerProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const startEdit = (label: string) => {
    setEditing(label);
    setInputValue(speakerNames[label] || '');
    setError('');
  };

  const cancelEdit = () => {
    setEditing(null);
    setInputValue('');
  };

  const saveEdit = async (label: string) => {
    const newName = inputValue.trim();
    const updated = { ...speakerNames, [label]: newName || label };
    // Remove entry if reset to original label
    if (!newName || newName === label) delete updated[label];

    setIsSaving(true);
    try {
      await api.patch(`/meetings/${meetingId}`, { speakerNames: updated });
      onUpdate(updated);
      setEditing(null);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setIsSaving(false);
    }
  };

  if (speakerLabels.length === 0) return null;

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <User className="h-4 w-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Speakers</h3>
        <span className="text-xs text-gray-400">— click to rename</span>
      </div>

      <div className="space-y-2">
        {speakerLabels.map((label) => {
          const displayName = speakerNames[label] || label;
          const isEditing = editing === label;

          return (
            <div key={label} className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${getSpeakerDotColor(label)}`} />

              {isEditing ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit(label);
                      if (e.key === 'Escape') cancelEdit();
                    }}
                    placeholder={label}
                    className="input-base py-1 text-sm flex-1"
                    autoFocus
                  />
                  <button
                    onClick={() => saveEdit(label)}
                    disabled={isSaving}
                    className="p-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                  >
                    {isSaving ? <Spinner size="sm" /> : <Check className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => startEdit(label)}
                  className="flex items-center gap-2 flex-1 group text-left"
                >
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {displayName}
                  </span>
                  {speakerNames[label] && (
                    <span className="text-xs text-gray-400">({label})</span>
                  )}
                  <Pencil className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
