import { AssemblyAI } from 'assemblyai';
import { removeFillerWords } from '../utils/fillerWords';

interface TranscriptSegment {
  speakerLabel: string;
  timestamp: number;
  transcriptText: string;
  confidence?: number;
}

interface UtteranceSegment extends TranscriptSegment {
  endTimestamp: number;
}

export interface ActionItem {
  text: string;
  speaker: string;
  timestamp: number;
  status: 'todo' | 'done';
}

interface TranscriptResult {
  segments: TranscriptSegment[];
  speakerCount: number;
  duration: number;
  jobId: string;
  summary?: string;
  actionItems?: ActionItem[];
}

function getClient(): AssemblyAI {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    throw new Error('ASSEMBLYAI_API_KEY is not configured');
  }
  return new AssemblyAI({ apiKey });
}

export async function transcribeAudio(audioBuffer: Buffer): Promise<TranscriptResult> {
  if (process.env.USE_MOCK_TRANSCRIPTION === 'true' || !process.env.ASSEMBLYAI_API_KEY) {
    return await generateMockTranscript();
  }

  const client = getClient();

  console.log(`[AssemblyAI] Uploading file (${audioBuffer.length} bytes)`);

  // Upload the file buffer first, then transcribe using the returned URL
  const uploadUrl = await client.files.upload(audioBuffer);
  console.log(`[AssemblyAI] File uploaded, URL: ${uploadUrl}`);

  const transcript = await client.transcripts.transcribe({
    audio: uploadUrl,
    speech_models: ['universal-2'] as never,
    speaker_labels: true,
  });

  console.log(`[AssemblyAI] Transcription status: ${transcript.status}`);

  if (transcript.status === 'error') {
    throw new Error(transcript.error || 'Transcription failed');
  }

  const utterances = transcript.utterances || [];
  const utteranceSegments: UtteranceSegment[] = utterances.map((u) => ({
    speakerLabel: `Speaker ${u.speaker}`,
    timestamp: Math.floor((u.start || 0) / 1000),
    endTimestamp: Math.floor((u.end || u.start || 0) / 1000),
    transcriptText: removeFillerWords(u.text || ''),
    confidence: u.confidence,
  }));
  const segments: TranscriptSegment[] = utteranceSegments.map(
    ({ endTimestamp, ...seg }) => seg
  );

  const speakers = new Set(utterances.map((u) => u.speaker));
  const durationMs = transcript.audio_duration ? transcript.audio_duration * 1000 : 0;
  const summary = await buildSummary(segments);
  const actionItems = buildActionItems(utteranceSegments);

  return {
    segments,
    speakerCount: speakers.size,
    duration: Math.floor(durationMs / 1000),
    jobId: transcript.id,
    summary,
    actionItems,
  };
}

export async function submitTranscriptionJob(audioFilePath: string): Promise<string> {
  if (process.env.USE_MOCK_TRANSCRIPTION === 'true' || !process.env.ASSEMBLYAI_API_KEY) {
    return `mock-${Date.now()}`;
  }

  const client = getClient();

  const uploaded = await client.files.upload(audioFilePath);

  const transcript = await client.transcripts.submit({
    audio_url: uploaded,
    speaker_labels: true,
    punctuate: true,
    format_text: true,
    disfluencies: false,
  });

  return transcript.id;
}

export async function pollTranscriptionJob(jobId: string): Promise<TranscriptResult | null> {
  if (jobId.startsWith('mock-')) {
    return await generateMockTranscript();
  }

  const client = getClient();
  const transcript = await client.transcripts.get(jobId);

  if (transcript.status === 'processing' || transcript.status === 'queued') {
    return null;
  }

  if (transcript.status === 'error') {
    throw new Error(transcript.error || 'Transcription failed');
  }

  const utterances = transcript.utterances || [];
  const segments: TranscriptSegment[] = utterances.map((u) => ({
    speakerLabel: `Speaker ${u.speaker}`,
    timestamp: Math.floor((u.start || 0) / 1000),
    transcriptText: removeFillerWords(u.text || ''),
    confidence: u.confidence,
  }));

  const speakers = new Set(utterances.map((u) => u.speaker));
  const durationMs = transcript.audio_duration ? transcript.audio_duration * 1000 : 0;

  return {
    segments,
    speakerCount: speakers.size,
    duration: Math.floor(durationMs / 1000),
    jobId: transcript.id,
  };
}

// ─── TextRank Summarizer ────────────────────────────────────────────────────
// TextRank builds a cosine-similarity graph between sentences and runs
// PageRank on it. Sentences that are similar to *many* other sentences
// (i.e. central to the discussion) score highest — much better than plain
// TF-IDF which scores sentences with rare words, not important ones.

const STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with','by',
  'is','was','are','were','be','been','being','have','has','had','do','did',
  'does','will','would','could','should','may','might','shall','can',
  'this','that','these','those','it','its','i','we','you','he','she','they',
  'my','our','your','his','her','their','me','us','him','them',
  'so','if','as','not','no','just','also','well','then','than','more','very',
  'all','about','up','out','what','how','when','who','which','there','here',
  'like','know','think','want','need','make','right','good','going','get',
  'got','go','now','yeah','yes','okay','ok','really','actually','basically',
  'kind','sort','thing','things','lot','lots','little','bit','way','mean',
  'said','say','saying','talking','talk','tell','told','asked','ask','going',
]);

// Repeated leading-junk stripping turns "And so well yeah, particles..." →
// "Particles..." which starts a sentence cleanly.
const LEADING_JUNK =
  /^(and|but|or|so|well|now|yeah|yes|okay|ok|right|also|plus|because|since|though|although|however|anyway|actually|basically|honestly|i mean|you know|kind of|sort of|i think|i guess|look|listen)\b[,\s]*/i;

function cleanSentence(raw: string): string {
  let s = raw.trim();
  let prev = '';
  while (prev !== s) { prev = s; s = s.replace(LEADING_JUNK, '').trim(); }
  if (!s || s.length < 15) return '';
  s = s[0].toUpperCase() + s.slice(1);
  if (!/[.!?]$/.test(s)) s += '.';
  return s;
}

function toRawSentences(text: string): string[] {
  return text
    .replace(/([.!?])\s+/g, '$1\n')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function cosineSimilarity(
  a: Map<string, number>,
  b: Map<string, number>,
  idf: Map<string, number>,
): number {
  let dot = 0, magA = 0, magB = 0;
  a.forEach((tfA, w) => {
    const weight = (idf.get(w) ?? 1);
    const wA = tfA * weight;
    magA += wA * wA;
    const wB = (b.get(w) ?? 0) * weight;
    dot += wA * wB;
  });
  b.forEach((tfB, w) => {
    const weight = (idf.get(w) ?? 1);
    magB += (tfB * weight) ** 2;
  });
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom > 0 ? dot / denom : 0;
}

async function buildSummary(segments: TranscriptSegment[]): Promise<string> {
  if (segments.length === 0) return '';

  // ── Step 1: Extract and clean candidate sentences ─────────────────────────
  interface Candidate {
    clean: string;
    tf: Map<string, number>;
    segIdx: number;
    sentPos: number;
  }

  const candidates: Candidate[] = [];

  segments.forEach((seg, segIdx) => {
    toRawSentences(seg.transcriptText).forEach((raw, sentPos) => {
      const clean = cleanSentence(raw);
      if (!clean) return;
      const toks = tokenise(clean);
      if (toks.length < 5 || clean.length < 30) return;
      // Drop pure short questions — they're rarely informative in a summary
      if (clean.endsWith('?') && toks.length < 8) return;

      const tf = new Map<string, number>();
      toks.forEach((w) => tf.set(w, (tf.get(w) ?? 0) + 1 / toks.length));
      candidates.push({ clean, tf, segIdx, sentPos });
    });
  });

  if (candidates.length <= 3) {
    return candidates.map((c) => c.clean).join(' ');
  }

  // ── Step 2: Compute IDF across all candidate sentences ────────────────────
  const df = new Map<string, number>();
  candidates.forEach((c) => {
    const seen = new Set<string>();
    c.tf.forEach((_, w) => {
      if (!seen.has(w)) { df.set(w, (df.get(w) ?? 0) + 1); seen.add(w); }
    });
  });
  const N = candidates.length;
  const idf = new Map<string, number>();
  df.forEach((count, w) => idf.set(w, Math.log((N + 1) / (count + 1)) + 1));

  // ── Step 3: Build pairwise cosine-similarity matrix ───────────────────────
  const n = candidates.length;
  const sim: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const s = cosineSimilarity(candidates[i].tf, candidates[j].tf, idf);
      sim[i][j] = s;
      sim[j][i] = s;
    }
  }

  // ── Step 4: TextRank — PageRank on the similarity graph ───────────────────
  // Damping factor d = 0.85 (standard PageRank default)
  const d = 0.85;
  let scores = new Array<number>(n).fill(1 / n);

  for (let iter = 0; iter < 30; iter++) {
    const next = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i++) {
      let incoming = 0;
      for (let j = 0; j < n; j++) {
        if (i === j || sim[j][i] === 0) continue;
        const outJ = sim[j].reduce((a, b) => a + b, 0);
        if (outJ > 0) incoming += (sim[j][i] / outJ) * scores[j];
      }
      next[i] = (1 - d) / n + d * incoming;
    }
    scores = next;
  }

  // ── Step 5: Select highest-scoring sentences within ~30 % word budget ─────
  const totalWords = segments.reduce((acc, s) => acc + s.transcriptText.split(/\s+/).length, 0);
  const targetWords = Math.max(60, Math.round(totalWords * 0.3));

  const ranked = scores
    .map((score, idx) => ({ idx, score }))
    .sort((a, b) => b.score - a.score);

  let budget = targetWords;
  const chosen = new Set<number>();

  for (const { idx } of ranked) {
    if (budget <= 0) break;
    const wc = candidates[idx].clean.split(/\s+/).length;

    // Skip sentences too similar to one we already chose (avoid near-dupes)
    let tooSimilar = false;
    for (const picked of chosen) {
      if (sim[idx][picked] > 0.6) { tooSimilar = true; break; }
    }
    if (tooSimilar) continue;

    if (budget - wc >= -12) {
      chosen.add(idx);
      budget -= wc;
    }
  }

  // ── Step 6: Restore chronological order; group into paragraphs ────────────
  const ordered = [...chosen].sort((a, b) => {
    const ca = candidates[a];
    const cb = candidates[b];
    return ca.segIdx !== cb.segIdx ? ca.segIdx - cb.segIdx : ca.sentPos - cb.sentPos;
  });

  const paragraphs: string[] = [];
  let para: string[] = [];
  let lastSeg = -1;

  ordered.forEach((i) => {
    const c = candidates[i];
    // Start a new paragraph when there is a gap of 5+ segments (topic shift)
    if (lastSeg >= 0 && c.segIdx - lastSeg > 5 && para.length > 0) {
      paragraphs.push(para.join(' '));
      para = [];
    }
    para.push(c.clean);
    lastSeg = c.segIdx;
  });
  if (para.length > 0) paragraphs.push(para.join(' '));

  return paragraphs.join('\n\n');
}

// ─── Action Item Extraction ────────────────────────────────────────────────
// Heuristic pass over each sentence looking for language that signals a
// commitment ("I'll send the deck"), an outstanding task ("we need to
// finalize the budget"), or something already completed ("I've deployed it").

const DONE_PATTERNS = [
  /\b(already|just)\s+\w*\s*(finished|completed|sent|deployed|done|wrapped up|fixed|resolved|submitted|reviewed|updated|shipped|handled)\b/i,
  /\b(i've|we've|i have|we have)\s+(finished|completed|sent|deployed|wrapped up|fixed|resolved|submitted|reviewed|updated|shipped|handled|done)\b/i,
];

// Restricted to first-person commitments ("I'll", "we need to") and explicit
// task language, so casual third-person predictions ("the fires are going to
// burn longer") aren't mistaken for action items.
const TODO_PATTERNS = [
  /\b(i'll|i will|we'll|we will|let's|let us)\b/i,
  /\b(i'm|we're|i am|we are)\s+going to\b/i,
  /\b(i|we)\s+(need to|needs to|have to|has to|plan to|planning to|should|must)\b/i,
  /\b(action item|to-?do|next steps?|follow[- ]?up)\b/i,
  /\bnext meeting\b/i,
  /\bby (tomorrow|next week|end of (day|week|month)|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
];

// Splits an utterance's text into raw sentences along with the character
// offset each one starts at, so we can estimate where within the utterance's
// time span a given sentence is actually spoken.
function splitSentencesWithOffsets(text: string): { raw: string; offset: number }[] {
  const result: { raw: string; offset: number }[] = [];
  const regex = /([.!?])(\s+|$)/g;
  let start = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const end = match.index + match[1].length;
    const raw = text.slice(start, end);
    const trimmed = raw.trim();
    if (trimmed) {
      result.push({ raw: trimmed, offset: start + (raw.length - raw.replace(/^\s+/, '').length) });
    }
    start = match.index + match[0].length;
  }

  if (start < text.length) {
    const raw = text.slice(start);
    const trimmed = raw.trim();
    if (trimmed) {
      result.push({ raw: trimmed, offset: start + (raw.length - raw.replace(/^\s+/, '').length) });
    }
  }

  return result;
}

export function buildActionItems(segments: UtteranceSegment[]): ActionItem[] {
  const items: ActionItem[] = [];
  const seen = new Set<string>();

  segments.forEach((seg) => {
    const textLength = seg.transcriptText.length;
    const duration = Math.max((seg.endTimestamp ?? seg.timestamp) - seg.timestamp, 0);

    splitSentencesWithOffsets(seg.transcriptText).forEach(({ raw, offset }) => {
      const clean = cleanSentence(raw);
      if (!clean || seen.has(clean)) return;

      const isDone = DONE_PATTERNS.some((re) => re.test(clean));
      const isTodo = !isDone && TODO_PATTERNS.some((re) => re.test(clean));
      if (!isDone && !isTodo) return;

      seen.add(clean);
      const ratio = textLength > 0 ? offset / textLength : 0;
      const timestamp = seg.timestamp + Math.round(ratio * duration);

      items.push({
        text: clean,
        speaker: seg.speakerLabel,
        timestamp,
        status: isDone ? 'done' : 'todo',
      });
    });
  });

  return items.slice(0, 15);
}

async function generateMockTranscript(): Promise<TranscriptResult> {
  const mockData = [
    { speaker: 'A', start: 0, text: "Good morning everyone, let's get started with today's meeting." },
    { speaker: 'B', start: 5, text: "Thanks for joining. I wanted to go over the project updates." },
    { speaker: 'A', start: 12, text: "Sure, we made great progress this week on the frontend components." },
    { speaker: 'C', start: 20, text: "The backend API is also nearly complete. We just need to finalize the authentication." },
    { speaker: 'B', start: 28, text: "That's excellent news. What about the database migrations?" },
    { speaker: 'A', start: 35, text: "Those are done. We ran all the tests and everything is passing." },
    { speaker: 'C', start: 42, text: "I'll deploy to staging by end of day." },
    { speaker: 'B', start: 48, text: "Perfect. Let's plan the demo for next week then." },
    { speaker: 'A', start: 55, text: "Sounds good. I'll send out the calendar invite." },
    { speaker: 'B', start: 60, text: "Great work everyone. Let's wrap up here." },
  ];

  const segments: TranscriptSegment[] = mockData.map((item) => ({
    speakerLabel: `Speaker ${item.speaker}`,
    timestamp: item.start,
    transcriptText: item.text,
    confidence: 0.95,
  }));

  const utteranceSegments: UtteranceSegment[] = mockData.map((item, i) => ({
    speakerLabel: `Speaker ${item.speaker}`,
    timestamp: item.start,
    endTimestamp: mockData[i + 1]?.start ?? item.start + 5,
    transcriptText: item.text,
    confidence: 0.95,
  }));

  const summary = await buildSummary(segments);
  const actionItems = buildActionItems(utteranceSegments);
  return {
    segments,
    speakerCount: 3,
    duration: 65,
    jobId: `mock-${Date.now()}`,
    summary,
    actionItems,
  };
}
