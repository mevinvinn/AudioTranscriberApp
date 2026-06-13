import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Mic2 } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { MeetingCard } from '../components/dashboard/MeetingCard';
import { SearchAndFilter } from '../components/dashboard/SearchAndFilter';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import type { MeetingListItem, FilterState } from '../types';
import api, { getApiError } from '../services/api';

const defaultFilters: FilterState = {
  search: '',
  tags: [],
  speakers: '',
  sortBy: 'newest',
};

export function DashboardPage() {
  const [meetings, setMeetings] = useState<MeetingListItem[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const fetchMeetings = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filters.search) params.set('search', filters.search);
      if (filters.tags.length) params.set('tags', filters.tags.join(','));
      if (filters.speakers) params.set('speakers', filters.speakers);
      params.set('sortBy', filters.sortBy);

      const { data } = await api.get(`/meetings?${params.toString()}`);
      setMeetings(data.meetings);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  const fetchTags = useCallback(async () => {
    try {
      const { data } = await api.get('/meetings/tags/all');
      setAllTags(data.tags);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  // Poll for status updates on processing meetings
  useEffect(() => {
    const processingMeetings = meetings.filter((m) => m.status === 'processing' || m.status === 'pending');
    if (processingMeetings.length === 0) return;

    const interval = setInterval(async () => {
      for (const meeting of processingMeetings) {
        try {
          const { data } = await api.get(`/meetings/${meeting.id}/status`);
          if (data.status !== meeting.status) {
            setMeetings((prev) =>
              prev.map((m) =>
                m.id === meeting.id
                  ? { ...m, status: data.status, speakerCount: data.speakerCount, duration: data.duration }
                  : m
              )
            );
          }
        } catch { /* ignore */ }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [meetings]);

  const handleFilterChange = (updated: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...updated }));
  };

  const handleDelete = (id: string) => {
    setMeetings((prev) => prev.filter((m) => m.id !== id));
  };

  const handleUpdate = (id: string, title: string, tags: string[]) => {
    setMeetings((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, title, tags: tags.map((t, i) => ({ id: `temp-${i}`, tagName: t })) }
          : m
      )
    );
    fetchTags();
  };

  return (
    <Layout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Good {getGreeting()}!
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Your meeting transcriptions
            </p>
          </div>
          <button
            onClick={() => navigate('/new')}
            className="btn-primary"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:block">New Transcription</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>

        {/* Search & Filter */}
        <SearchAndFilter
          filters={filters}
          onFilterChange={handleFilterChange}
          allTags={allTags}
          totalCount={meetings.length}
        />

        {/* Content */}
        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3 text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : meetings.length === 0 ? (
          <EmptyState
            icon={Mic2}
            title={filters.search || filters.tags.length || filters.speakers ? 'No results found' : 'No meetings yet'}
            description={
              filters.search || filters.tags.length || filters.speakers
                ? 'Try adjusting your search or filters'
                : 'Upload or record your first meeting to get started with AI transcription'
            }
            action={
              !filters.search && !filters.tags.length && !filters.speakers ? (
                <button onClick={() => navigate('/new')} className="btn-primary">
                  <Plus className="h-4 w-4" />
                  Start transcribing
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {meetings.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                onDelete={handleDelete}
                onUpdate={handleUpdate}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
