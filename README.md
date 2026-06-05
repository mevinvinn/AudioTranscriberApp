# TranscribeAI — AI Meeting Transcription App

A full-stack AI-powered meeting transcription platform with speaker diarization, timestamps, search, and dark/light mode.

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, TypeScript, Tailwind CSS, Vite |
| Backend | Node.js, Express, TypeScript |
| Database | SQLite (via Prisma ORM) |
| AI | AssemblyAI (speaker diarization + timestamps) |
| Auth | JWT (bcrypt password hashing) |

---

## Quick Start

### 1. Install dependencies

```bash
cd "AudioTranscriberApp"
npm install
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure your AssemblyAI API key

Edit `backend/.env`:

```env
ASSEMBLYAI_API_KEY="your-key-from-assemblyai.com"
USE_MOCK_TRANSCRIPTION=false
```

> **No API key?** Leave `USE_MOCK_TRANSCRIPTION=true` to use a built-in mock transcript for testing.

### 3. Start both servers

From the project root:

```bash
npm run dev
```

Or start them separately:

```bash
# Terminal 1 — Backend (port 5000)
cd backend && npm run dev

# Terminal 2 — Frontend (port 5173)
cd frontend && npm run dev
```

### 4. Open the app

Navigate to **http://localhost:5173**

---

## Features

### Authentication
- Register / Login with JWT tokens
- Password hashing (bcrypt, 12 rounds)
- Protected routes — each user sees only their own data

### Dashboard
- Grid of all your meetings with status badges
- **Search** by title, transcript content, or tags
- **Filter** by speaker count or tags
- **Sort** by newest/oldest/longest/shortest
- Real-time polling for processing meetings
- Edit title/tags inline, delete meetings

### New Transcription
- **Upload** MP3, WAV, M4A, or AAC (max 10MB)
- **Record** directly from microphone with:
  - Live waveform visualization
  - Start / Pause / Resume / Stop controls
  - Recording timer
- Drag-and-drop upload
- Add tags with quick-select suggestions

### AI Transcription (AssemblyAI)
- Speaker diarization (auto-labels multiple speakers)
- Timestamps on every segment
- Automatic filler word removal (um, uh, hmm, etc.)
- Punctuation and formatting

### Transcript Detail View
- **Audio player** with seek bar, volume, playback speed (0.5x–2x)
- **Click any timestamp** to jump to that audio position
- Active segment highlighted as audio plays
- **Search within transcript** with highlighted matches
- Export transcript as `.txt`
- Edit title inline
- Tag manager (add/remove/suggest tags)

### Dark / Light Mode
- Auto-detects system preference
- Toggle button in the navbar
- Persists across sessions

---

## Project Structure

```
AudioTranscriberApp/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Database schema
│   │   └── dev.db                 # SQLite database (auto-created)
│   ├── src/
│   │   ├── lib/prisma.ts          # Prisma client singleton
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts  # JWT authentication
│   │   │   ├── upload.middleware.ts # Multer file upload
│   │   │   └── error.middleware.ts
│   │   ├── routes/
│   │   │   ├── auth.routes.ts     # POST /register, /login, GET /me
│   │   │   └── meetings.routes.ts # Full meeting CRUD + transcription
│   │   ├── services/
│   │   │   └── assemblyai.service.ts # AI transcription + mock
│   │   ├── utils/
│   │   │   ├── jwt.utils.ts
│   │   │   └── fillerWords.ts     # Filler word removal
│   │   ├── app.ts
│   │   └── server.ts
│   ├── uploads/                   # Uploaded audio files
│   └── .env
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── dashboard/         # MeetingCard, SearchAndFilter
│       │   ├── layout/            # Navbar, Layout, ProtectedRoute
│       │   ├── transcript/        # AudioPlayer, TranscriptViewer, TagManager
│       │   ├── transcription/     # AudioUploader, AudioRecorder
│       │   └── ui/                # Badge, Modal, Spinner, StatusBadge, EmptyState
│       ├── context/               # AuthContext, ThemeContext
│       ├── pages/                 # LoginPage, RegisterPage, Dashboard, New, Detail
│       ├── services/api.ts        # Axios instance + error helper
│       ├── types/index.ts         # Shared TypeScript types
│       └── utils/formatters.ts   # Duration, date, color helpers
└── package.json                   # Root scripts (npm run dev runs both)
```

---

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/meetings` | List meetings (search/filter/sort) |
| POST | `/api/meetings` | Upload audio + create meeting |
| GET | `/api/meetings/:id` | Get meeting + transcript |
| PATCH | `/api/meetings/:id` | Update title/tags |
| DELETE | `/api/meetings/:id` | Delete meeting |
| GET | `/api/meetings/:id/status` | Poll transcription status |
| GET | `/api/meetings/tags/all` | Get all user tags |

---

## Switching to PostgreSQL

1. Change `backend/prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

2. Update `DATABASE_URL` in `.env`:
```
DATABASE_URL="postgresql://user:password@localhost:5432/transcribeai"
```

3. Re-run migrations:
```bash
cd backend && npx prisma migrate dev
```

---

## Future Extensions

The architecture is ready for:
- AI meeting summaries (OpenAI / Claude integration)
- Action item extraction
- Multi-language transcription
- Export to PDF/DOCX
- Team workspaces and shared transcripts
- Webhook-based transcription (non-polling)
