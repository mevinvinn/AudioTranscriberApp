export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface Tag {
  id: string;
  tagName: string;
}

export interface TranscriptSegment {
  id: string;
  speakerLabel: string;
  timestamp: number;
  transcriptText: string;
  confidence?: number;
}

export type MeetingStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Meeting {
  id: string;
  userId: string;
  title: string;
  duration?: number;
  speakerCount?: number;
  audioFileUrl?: string;
  audioFileName?: string;
  status: MeetingStatus;
  errorMessage?: string;
  speakerNames?: string;
  summary?: string;
  createdAt: string;
  updatedAt: string;
  tags: Tag[];
  transcriptSegs?: TranscriptSegment[];
}

export interface MeetingListItem extends Meeting {
  transcriptSegs: TranscriptSegment[];
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export type SortOption = 'newest' | 'oldest' | 'longest' | 'shortest';

export interface FilterState {
  search: string;
  tags: string[];
  speakers: string;
  sortBy: SortOption;
}

export interface ApiError {
  error?: string;
  errors?: Array<{ msg: string; path: string }>;
  message?: string;
}
