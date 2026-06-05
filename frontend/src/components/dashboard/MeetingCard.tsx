import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Users, Calendar, Trash2, Edit2, Tag, ChevronRight, FileAudio } from 'lucide-react';
import type { MeetingListItem } from '../../types';
import { formatDuration, formatRelativeDate } from '../../utils/formatters';
import { Badge } from '../ui/Badge';
import { StatusBadge } from '../ui/StatusBadge';
import { Modal } from '../ui/Modal';
import { Spinner } from '../ui/Spinner';
import api, { getApiError } from '../../services/api';

interface MeetingCardProps {
  meeting: MeetingListItem;
  onDelete: (id: string) => void;
  onUpdate: (id: string, title: string, tags: string[]) => void;
}

export function MeetingCard({ meeting, onDelete, onUpdate }: MeetingCardProps) {
  const navigate = useNavigate();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(meeting.title);
  const [editTagInput, setEditTagInput] = useState('');
  const [editTags, setEditTags] = useState(meeting.tags.map((t) => t.tagName));
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  const preview = meeting.transcriptSegs?.[0];

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await api.delete(`/meetings/${meeting.id}`);
      onDelete(meeting.id);
      setIsDeleteOpen(false);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) return;
    setIsSaving(true);
    try {
      await api.patch(`/meetings/${meeting.id}`, { title: editTitle.trim(), tags: editTags });
      onUpdate(meeting.id, editTitle.trim(), editTags);
      setIsEditOpen(false);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setIsSaving(false);
    }
  };

  const addTag = () => {
    const tag = editTagInput.trim();
    if (tag && !editTags.includes(tag)) {
      setEditTags([...editTags, tag]);
      setEditTagInput('');
    }
  };

  return (
    <>
      <div className="card p-5 hover:shadow-md transition-all duration-200 group animate-fade-in">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="rounded-lg bg-primary-50 dark:bg-primary-950/40 p-2.5 flex-shrink-0">
              <FileAudio className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div className="min-w-0">
              <h3
                className="font-semibold text-gray-900 dark:text-white truncate cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                onClick={() => meeting.status === 'completed' && navigate(`/meetings/${meeting.id}`)}
              >
                {meeting.title}
              </h3>
              <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                <Calendar className="h-3 w-3" />
                {formatRelativeDate(meeting.createdAt)}
              </div>
            </div>
          </div>
          <StatusBadge status={meeting.status} />
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-3">
          {meeting.duration != null && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatDuration(meeting.duration)}
            </span>
          )}
          {meeting.speakerCount != null && (
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {meeting.speakerCount} speaker{meeting.speakerCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Error message for failed meetings */}
        {meeting.status === 'failed' && meeting.errorMessage && (
          <p className="text-sm text-red-600 dark:text-red-400 line-clamp-3 mb-3 pl-3 border-l-2 border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/20 rounded-r py-1 pr-2">
            {meeting.errorMessage}
          </p>
        )}

        {/* Transcript preview */}
        {preview && (
          <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-3 pl-3 border-l-2 border-gray-200 dark:border-gray-700">
            <span className="font-medium text-gray-700 dark:text-gray-300">{preview.speakerLabel}: </span>
            {preview.transcriptText}
          </p>
        )}

        {/* Tags */}
        {meeting.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {meeting.tags.slice(0, 4).map((tag) => (
              <Badge key={tag.id} label={tag.tagName} color="indigo" />
            ))}
            {meeting.tags.length > 4 && (
              <Badge label={`+${meeting.tags.length - 4}`} color="default" />
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setIsEditOpen(true); setEditTitle(meeting.title); setEditTags(meeting.tags.map(t => t.tagName)); }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Edit"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setIsDeleteOpen(true)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          {meeting.status === 'completed' && (
            <button
              onClick={() => navigate(`/meetings/${meeting.id}`)}
              className="flex items-center gap-1 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
            >
              View transcript
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Delete modal */}
      <Modal isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} title="Delete Meeting" size="sm">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Are you sure you want to delete "<strong>{meeting.title}</strong>"? This action cannot be undone.
        </p>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3 justify-end">
          <button onClick={() => setIsDeleteOpen(false)} className="btn-secondary">Cancel</button>
          <button onClick={handleDelete} disabled={isDeleting} className="btn-danger">
            {isDeleting ? <Spinner size="sm" /> : null}
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Edit Meeting">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Title</label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="input-base"
              placeholder="Meeting title"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Tags</label>
            <div className="flex gap-2 mb-2">
              <div className="relative flex-1">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={editTagInput}
                  onChange={(e) => setEditTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                  className="input-base pl-9"
                  placeholder="Add tag and press Enter"
                />
              </div>
              <button onClick={addTag} className="btn-secondary px-3">Add</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {editTags.map((tag) => (
                <Badge key={tag} label={tag} color="indigo" onRemove={() => setEditTags(editTags.filter(t => t !== tag))} />
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 justify-end">
            <button onClick={() => setIsEditOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSaveEdit} disabled={isSaving} className="btn-primary">
              {isSaving ? <Spinner size="sm" /> : null}
              {isSaving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
