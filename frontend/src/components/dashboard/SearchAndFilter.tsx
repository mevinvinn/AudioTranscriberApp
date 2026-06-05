import { Search, SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { FilterState, SortOption } from '../../types';
import { Badge } from '../ui/Badge';
import { clsx } from 'clsx';

interface SearchAndFilterProps {
  filters: FilterState;
  onFilterChange: (filters: Partial<FilterState>) => void;
  allTags: string[];
  totalCount: number;
}

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'longest', label: 'Longest meeting' },
  { value: 'shortest', label: 'Shortest meeting' },
];

const speakerOptions = [
  { value: '', label: 'Any' },
  { value: '1', label: '1 speaker' },
  { value: '2', label: '2 speakers' },
  { value: '3', label: '3 speakers' },
  { value: '4', label: '4+ speakers' },
];

export function SearchAndFilter({ filters, onFilterChange, allTags, totalCount }: SearchAndFilterProps) {
  const [showFilters, setShowFilters] = useState(false);

  const hasActiveFilters = filters.tags.length > 0 || filters.speakers !== '' || filters.sortBy !== 'newest';

  const addTag = (tag: string) => {
    if (!filters.tags.includes(tag)) {
      onFilterChange({ tags: [...filters.tags, tag] });
    }
  };

  const removeTag = (tag: string) => {
    onFilterChange({ tags: filters.tags.filter((t) => t !== tag) });
  };

  const clearAll = () => {
    onFilterChange({ search: '', tags: [], speakers: '', sortBy: 'newest' });
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onFilterChange({ search: e.target.value })}
            placeholder="Search meetings, transcripts, tags..."
            className="input-base pl-10 pr-4"
          />
          {filters.search && (
            <button
              onClick={() => onFilterChange({ search: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={clsx(
            'btn-secondary flex items-center gap-2 px-4',
            hasActiveFilters && 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/30'
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:block">Filters</span>
          {hasActiveFilters && (
            <span className="h-5 w-5 rounded-full bg-primary-600 text-white text-xs flex items-center justify-center">
              {(filters.tags.length > 0 ? 1 : 0) + (filters.speakers ? 1 : 0) + (filters.sortBy !== 'newest' ? 1 : 0)}
            </span>
          )}
          <ChevronDown className={clsx('h-4 w-4 transition-transform', showFilters && 'rotate-180')} />
        </button>

        {/* Sort (always visible) */}
        <select
          value={filters.sortBy}
          onChange={(e) => onFilterChange({ sortBy: e.target.value as SortOption })}
          className="input-base w-auto cursor-pointer"
        >
          {sortOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Expanded filters */}
      {showFilters && (
        <div className="card p-4 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Speaker filter */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
                Speakers
              </label>
              <div className="flex flex-wrap gap-2">
                {speakerOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => onFilterChange({ speakers: opt.value })}
                    className={clsx(
                      'px-3 py-1 rounded-full text-sm transition-colors',
                      filters.speakers === opt.value
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tag filter */}
            {allTags.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
                  Filter by tag
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {allTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => (filters.tags.includes(tag) ? removeTag(tag) : addTag(tag))}
                      className={clsx(
                        'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                        filters.tags.includes(tag)
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                      )}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Active filter pills + results count */}
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {filters.tags.map((tag) => (
            <Badge key={tag} label={tag} color="indigo" onRemove={() => removeTag(tag)} />
          ))}
          {filters.speakers && (
            <Badge
              label={`${speakerOptions.find(o => o.value === filters.speakers)?.label}`}
              color="blue"
              onRemove={() => onFilterChange({ speakers: '' })}
            />
          )}
          {hasActiveFilters && (
            <button onClick={clearAll} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 underline">
              Clear all
            </button>
          )}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
          {totalCount} meeting{totalCount !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
}
