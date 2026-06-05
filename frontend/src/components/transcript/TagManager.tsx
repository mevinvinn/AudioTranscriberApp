import { useState } from 'react';
import { Tag, Plus, Check, X } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Spinner } from '../ui/Spinner';
import api, { getApiError } from '../../services/api';

interface TagManagerProps {
  meetingId: string;
  tags: string[];
  onUpdate: (tags: string[]) => void;
}

const SUGGESTED_TAGS = ['Work', 'Team Meeting', 'Client Call', 'College', 'Personal', 'Follow-up', 'Urgent'];

export function TagManager({ meetingId, tags, onUpdate }: TagManagerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [input, setInput] = useState('');
  const [localTags, setLocalTags] = useState(tags);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const addTag = () => {
    const tag = input.trim();
    if (tag && !localTags.includes(tag)) {
      setLocalTags([...localTags, tag]);
      setInput('');
    }
  };

  const removeTag = (tag: string) => setLocalTags(localTags.filter((t) => t !== tag));

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    try {
      await api.patch(`/meetings/${meetingId}`, { tags: localTags });
      onUpdate(localTags);
      setIsEditing(false);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setLocalTags(tags);
    setIsEditing(false);
    setError('');
  };

  if (!isEditing) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {tags.length === 0 ? (
          <span className="text-sm text-gray-400 dark:text-gray-500">No tags</span>
        ) : (
          tags.map((tag) => <Badge key={tag} label={tag} color="indigo" />)
        )}
        <button
          onClick={() => setIsEditing(true)}
          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          {tags.length === 0 ? 'Add tags' : 'Edit'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
            className="input-base pl-8 py-1.5 text-sm"
            placeholder="Add tag..."
            autoFocus
          />
        </div>
        <button onClick={addTag} className="btn-secondary px-2.5 py-1.5 text-sm">Add</button>
      </div>

      {/* Current tags */}
      {localTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {localTags.map((tag) => (
            <Badge key={tag} label={tag} color="indigo" onRemove={() => removeTag(tag)} />
          ))}
        </div>
      )}

      {/* Suggestions */}
      <div className="flex flex-wrap gap-1">
        {SUGGESTED_TAGS.filter((t) => !localTags.includes(t)).slice(0, 5).map((t) => (
          <button
            key={t}
            onClick={() => setLocalTags([...localTags, t])}
            className="px-2 py-0.5 text-xs rounded-full border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-primary-400 hover:text-primary-600 transition-colors"
          >
            + {t}
          </button>
        ))}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex items-center gap-2">
        <button onClick={handleSave} disabled={isSaving} className="btn-primary py-1.5 px-3 text-sm">
          {isSaving ? <Spinner size="sm" /> : <Check className="h-3.5 w-3.5" />}
          Save
        </button>
        <button onClick={handleCancel} className="btn-ghost py-1.5 px-3 text-sm">
          <X className="h-3.5 w-3.5" />
          Cancel
        </button>
      </div>
    </div>
  );
}
