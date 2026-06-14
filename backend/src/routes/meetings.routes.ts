import { Router, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, VerticalAlign,
} from 'docx';
import PDFDocument from 'pdfkit';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { upload } from '../middleware/upload.middleware';
import { transcribeAudio } from '../services/assemblyai.service';
import { uploadAudioFile, deleteAudioFile } from '../services/storage.service';

export const meetingsRoutes = Router();
meetingsRoutes.use(authenticate);

// GET /api/meetings - list user meetings with search/filter/sort
meetingsRoutes.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { search, tags, speakers, sortBy, order } = req.query as Record<string, string>;

  const where: Record<string, unknown> = { userId: req.userId };

  if (search) {
    where.title = { contains: search, mode: 'insensitive' };
  }

  if (tags) {
    const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean);
    if (tagList.length) {
      where.tags = { some: { tagName: { in: tagList } } };
    }
  }

  if (speakers) {
    const count = parseInt(speakers, 10);
    if (!isNaN(count)) {
      where.speakerCount = count;
    }
  }

  const orderByMap: Record<string, unknown> = {
    newest: { createdAt: 'desc' },
    oldest: { createdAt: 'asc' },
    longest: { duration: 'desc' },
    shortest: { duration: 'asc' },
  };

  const orderBy = orderByMap[sortBy || 'newest'] || { createdAt: order === 'asc' ? 'asc' : 'desc' };

  const meetings = await prisma.meeting.findMany({
    where,
    orderBy,
    include: {
      tags: { select: { id: true, tagName: true } },
      transcriptSegs: {
        take: 1,
        orderBy: { timestamp: 'asc' },
        select: { transcriptText: true, speakerLabel: true },
      },
    },
  });

  res.json({ meetings });
});

// POST /api/meetings - create meeting with audio upload
meetingsRoutes.post(
  '/',
  upload.single('audio'),
  [
    body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }),
    body('tags').optional(),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'Audio file is required' });
      return;
    }

    const { title, tags } = req.body;

    // Parse tags
    let tagList: string[] = [];
    if (tags) {
      try {
        tagList = typeof tags === 'string' ? JSON.parse(tags) : tags;
      } catch {
        tagList = tags.split(',').map((t: string) => t.trim()).filter(Boolean);
      }
    }

    const { path: storagePath, url: audioFileUrl } = await uploadAudioFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    // Create meeting record
    const meeting = await prisma.meeting.create({
      data: {
        userId: req.userId!,
        title,
        audioFileUrl,
        audioFileName: req.file.originalname,
        audioFilePath: storagePath,
        status: 'processing',
        tags: {
          create: tagList.map((tagName: string) => ({ tagName })),
        },
      },
      include: { tags: true },
    });

    res.status(202).json({ meeting });

    // Run transcription asynchronously
    processTranscription(meeting.id, req.file.buffer).catch((err) => {
      console.error(`Transcription failed for meeting ${meeting.id}:`, err.message);
    });
  }
);

// GET /api/meetings/:id - get meeting details
meetingsRoutes.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const meeting = await (prisma.meeting.findFirst as Function)({
    where: { id: req.params.id, userId: req.userId },
    include: {
      tags: { select: { id: true, tagName: true } },
      transcriptSegs: {
        orderBy: { timestamp: 'asc' },
        select: {
          id: true,
          speakerLabel: true,
          timestamp: true,
          transcriptText: true,
          confidence: true,
        },
      },
    },
  });

  if (!meeting) {
    res.status(404).json({ error: 'Meeting not found' });
    return;
  }

  res.json({ meeting });
});

// PATCH /api/meetings/:id - update title/tags
meetingsRoutes.patch(
  '/:id',
  [body('title').optional().trim().notEmpty().isLength({ max: 200 })],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const meeting = await prisma.meeting.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });

    if (!meeting) {
      res.status(404).json({ error: 'Meeting not found' });
      return;
    }

    const { title, tags, speakerNames } = req.body;
    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (speakerNames !== undefined) updateData.speakerNames = JSON.stringify(speakerNames);

    if (tags !== undefined) {
      // Replace tags entirely
      await prisma.tag.deleteMany({ where: { meetingId: meeting.id } });
      updateData.tags = {
        create: (tags as string[]).map((tagName) => ({ tagName })),
      };
    }

    const updated = await prisma.meeting.update({
      where: { id: meeting.id },
      data: updateData,
      include: { tags: true },
    });

    res.json({ meeting: updated });
  }
);

// DELETE /api/meetings/:id
meetingsRoutes.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const meeting = await prisma.meeting.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });

  if (!meeting) {
    res.status(404).json({ error: 'Meeting not found' });
    return;
  }

  // Delete audio file from Supabase Storage
  if (meeting.audioFilePath) {
    await deleteAudioFile(meeting.audioFilePath);
  }

  await prisma.meeting.delete({ where: { id: meeting.id } });

  res.json({ message: 'Meeting deleted' });
});

// GET /api/meetings/:id/status - poll transcription status
meetingsRoutes.get('/:id/status', async (req: AuthRequest, res: Response): Promise<void> => {
  const meeting = await prisma.meeting.findFirst({
    where: { id: req.params.id, userId: req.userId },
    select: {
      id: true,
      status: true,
      speakerCount: true,
      duration: true,
      errorMessage: true,
    },
  });

  if (!meeting) {
    res.status(404).json({ error: 'Meeting not found' });
    return;
  }

  res.json(meeting);
});

// GET /api/meetings/:id/transcript/search
meetingsRoutes.get(
  '/:id/transcript/search',
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { q } = req.query as { q: string };

    if (!q) {
      res.status(400).json({ error: 'Search query required' });
      return;
    }

    const meeting = await prisma.meeting.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });

    if (!meeting) {
      res.status(404).json({ error: 'Meeting not found' });
      return;
    }

    const segments = await prisma.transcriptSegment.findMany({
      where: {
        meetingId: meeting.id,
        transcriptText: { contains: q },
      },
      orderBy: { timestamp: 'asc' },
    });

    res.json({ segments, query: q });
  }
);

// GET /api/meetings/tags/all - get all user tags
meetingsRoutes.get('/tags/all', async (req: AuthRequest, res: Response): Promise<void> => {
  const tags = await prisma.tag.findMany({
    where: { meeting: { userId: req.userId } },
    distinct: ['tagName'],
    select: { tagName: true },
    orderBy: { tagName: 'asc' },
  });

  res.json({ tags: tags.map((t) => t.tagName) });
});

// GET /api/meetings/:id/export?format=txt|docx|pdf|mom
meetingsRoutes.get('/:id/export', async (req: AuthRequest, res: Response): Promise<void> => {
  const format = (req.query.format as string || 'txt').toLowerCase();
  if (!['txt', 'docx', 'pdf', 'mom'].includes(format)) {
    res.status(400).json({ error: 'Invalid format. Use txt, docx, pdf, or mom.' });
    return;
  }

  const meeting = await (prisma.meeting.findFirst as Function)({
    where: { id: req.params.id, userId: req.userId },
    include: {
      transcriptSegs: { orderBy: { timestamp: 'asc' } },
      tags: { select: { tagName: true } },
    },
  });

  if (!meeting) {
    res.status(404).json({ error: 'Meeting not found' });
    return;
  }

  let speakerNames: Record<string, string> = {};
  try { speakerNames = JSON.parse(meeting.speakerNames || '{}'); } catch { /* ignore */ }

  const resolveSpeaker = (label: string) => speakerNames[label] || label;

  const safeName = meeting.title.replace(/[^a-z0-9]/gi, '_');
  const dateStr = new Date(meeting.createdAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  if (format === 'mom') {
    const buffer = await buildMomDocx(meeting, speakerNames, req.userId!);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}_MOM.docx"`);
    res.send(buffer);
    return;
  }

  if (format === 'txt') {
    const lines: string[] = [
      meeting.title,
      dateStr,
      '='.repeat(40),
    ];
    if (meeting.summary) {
      lines.push('', 'SUMMARY', '-'.repeat(20), meeting.summary, '');
    }
    lines.push('TRANSCRIPT', '-'.repeat(20), '');
    for (const seg of meeting.transcriptSegs) {
      const mins = Math.floor(seg.timestamp / 60).toString().padStart(2, '0');
      const secs = (seg.timestamp % 60).toString().padStart(2, '0');
      lines.push(`[${mins}:${secs}]`);
      lines.push(`${resolveSpeaker(seg.speakerLabel)}:`);
      lines.push(seg.transcriptText);
      lines.push('');
    }
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}_transcript.txt"`);
    res.send(lines.join('\n'));
    return;
  }

  if (format === 'docx') {
    const children: Paragraph[] = [
      new Paragraph({ text: meeting.title, heading: HeadingLevel.HEADING_1 }),
      new Paragraph({ text: dateStr, spacing: { after: 200 } }),
    ];

    if (meeting.summary) {
      children.push(
        new Paragraph({ text: 'Summary', heading: HeadingLevel.HEADING_2, spacing: { before: 300 } }),
        new Paragraph({ text: meeting.summary, spacing: { after: 300 } }),
      );
    }

    children.push(
      new Paragraph({ text: 'Transcript', heading: HeadingLevel.HEADING_2, spacing: { before: 300 } }),
    );

    for (const seg of meeting.transcriptSegs) {
      const mins = Math.floor(seg.timestamp / 60).toString().padStart(2, '0');
      const secs = (seg.timestamp % 60).toString().padStart(2, '0');
      children.push(
        new Paragraph({
          spacing: { before: 200 },
          children: [
            new TextRun({ text: `[${mins}:${secs}]  `, color: '888888', size: 18 }),
            new TextRun({ text: `${resolveSpeaker(seg.speakerLabel)}: `, bold: true }),
          ],
        }),
        new Paragraph({ text: seg.transcriptText, spacing: { after: 100 } }),
      );
    }

    const doc = new Document({ sections: [{ children }] });
    const buffer = await Packer.toBuffer(doc);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}_transcript.docx"`);
    res.send(buffer);
    return;
  }

  if (format === 'pdf') {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}_transcript.pdf"`);
    doc.pipe(res);

    // Title
    doc.fontSize(20).font('Helvetica-Bold').text(meeting.title, { align: 'left' });
    doc.fontSize(11).font('Helvetica').fillColor('#555555').text(dateStr);
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').stroke();
    doc.moveDown(0.5);

    // Summary
    if (meeting.summary) {
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#111111').text('Summary');
      doc.moveDown(0.3);
      doc.fontSize(11).font('Helvetica').fillColor('#222222').text(meeting.summary, { align: 'justify' });
      doc.moveDown(1);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').stroke();
      doc.moveDown(0.5);
    }

    // Transcript
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#111111').text('Transcript');
    doc.moveDown(0.5);

    for (const seg of meeting.transcriptSegs) {
      const mins = Math.floor(seg.timestamp / 60).toString().padStart(2, '0');
      const secs = (seg.timestamp % 60).toString().padStart(2, '0');
      const timestamp = `[${mins}:${secs}]`;
      const speaker = resolveSpeaker(seg.speakerLabel);

      doc.moveDown(0.4);
      doc.fontSize(10).font('Helvetica').fillColor('#888888').text(timestamp, { continued: true });
      doc.fillColor('#000000').font('Helvetica-Bold').text(`  ${speaker}:`, { continued: false });
      doc.fontSize(11).font('Helvetica').fillColor('#222222').text(seg.transcriptText, { indent: 10 });
    }

    doc.end();
    return;
  }
});

async function processTranscription(meetingId: string, audioBuffer: Buffer): Promise<void> {
  try {
    const result = await transcribeAudio(audioBuffer);

    await (prisma.meeting.update as Function)({
      where: { id: meetingId },
      data: {
        status: 'completed',
        speakerCount: result.speakerCount,
        duration: result.duration,
        assemblyJobId: result.jobId,
        summary: result.summary ?? null,
        actionItems: JSON.stringify(result.actionItems ?? []),
        transcriptSegs: {
          create: result.segments.map((seg) => ({
            speakerLabel: seg.speakerLabel,
            timestamp: seg.timestamp,
            transcriptText: seg.transcriptText,
            confidence: seg.confidence,
          })),
        },
      },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Transcription FAILED] Meeting ${meetingId}: ${errMsg}`);
    if (error instanceof Error) console.error(error.stack);
    await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}

const MOM_NAVY = '1F3864';
const MOM_HEADER_FILL = 'D9E2F3';
const MOM_BORDER_COLOR = 'BFBFBF';

function momSectionHeading(num: number, title: string): Paragraph {
  return new Paragraph({
    spacing: { before: 320, after: 120 },
    children: [new TextRun({ text: `${num}. ${title}`, bold: true, size: 26, color: MOM_NAVY })],
  });
}

function momCell(text: string, width: number, header: boolean): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    shading: header ? { fill: MOM_HEADER_FILL, type: ShadingType.CLEAR, color: 'auto' } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({
      alignment: header ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ text, bold: header })],
    })],
  });
}

function momTable(headers: { text: string; width: number }[], rows: string[][]): Table {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h) => momCell(h.text, h.width, true)),
  });
  const dataRows = rows.map((cells) => new TableRow({
    children: cells.map((c, i) => momCell(c, headers[i].width, false)),
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: MOM_BORDER_COLOR },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: MOM_BORDER_COLOR },
      left: { style: BorderStyle.SINGLE, size: 4, color: MOM_BORDER_COLOR },
      right: { style: BorderStyle.SINGLE, size: 4, color: MOM_BORDER_COLOR },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: MOM_BORDER_COLOR },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: MOM_BORDER_COLOR },
    },
    rows: [headerRow, ...dataRows],
  });
}

function formatMomDuration(seconds?: number): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return '--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} hr`);
  if (m > 0) parts.push(`${m} min`);
  if (h === 0 && m === 0) parts.push(`${s} sec`);
  return parts.join(' ');
}

function splitIntoPoints(text: string, max: number): string[] {
  const paragraphs = text.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const points = paragraphs.length > 1
    ? paragraphs
    : text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  return points.slice(0, max);
}

function buildNumberedRows(items: string[][], minRows: number, cols: number): string[][] {
  const padded = [...items];
  while (padded.length < minRows) padded.push(new Array(cols).fill(''));
  return padded.map((row, i) => [String(i + 1), ...row]);
}

async function buildMomDocx(
  meeting: any,
  speakerNames: Record<string, string>,
  userId: string
): Promise<Buffer> {
  const resolveSpeaker = (label: string) => speakerNames[label] || label;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

  const createdAt = new Date(meeting.createdAt);
  const dateStr = createdAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = createdAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const dayStr = createdAt.toLocaleDateString('en-US', { weekday: 'long' });

  const attendeeSet = new Set<string>();
  for (const seg of meeting.transcriptSegs || []) {
    attendeeSet.add(resolveSpeaker(seg.speakerLabel));
  }

  const discussionPoints = meeting.summary ? splitIntoPoints(meeting.summary, 10) : [];

  let actionItems: { text: string }[] = [];
  try { actionItems = JSON.parse(meeting.actionItems || '[]'); } catch { /* ignore */ }

  const meetingDetailsRows = [
    ['1', `Meeting Title: ${meeting.title}`],
    ['2', `Date: ${dateStr}`],
    ['3', `Time: ${timeStr}`],
    ['4', `Day: ${dayStr}`],
    ['5', `Duration: ${formatMomDuration(meeting.duration)}`],
    ['6', `Prepared By: ${user?.name || ''}`],
  ];

  const attendeeRows = buildNumberedRows(
    Array.from(attendeeSet).map((name) => [name]),
    Math.max(attendeeSet.size, 1),
    1
  );

  const discussionRows = buildNumberedRows(
    discussionPoints.map((text) => [text]),
    Math.max(discussionPoints.length, 1),
    1
  );

  const decisionRows = buildNumberedRows([], 5, 1);

  const actionRows = buildNumberedRows(
    actionItems.map((item) => [item.text, '']),
    Math.max(actionItems.length, 5),
    2
  );

  const notesRows = buildNumberedRows([], 2, 1);

  const children: (Paragraph | Table)[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: MOM_NAVY, space: 6 } },
      children: [new TextRun({ text: 'MOM – MEETING MINUTES', bold: true, size: 36, color: MOM_NAVY })],
    }),

    momSectionHeading(1, 'MEETING DETAILS'),
    momTable([{ text: 'S.No', width: 10 }, { text: 'Details', width: 90 }], meetingDetailsRows),

    momSectionHeading(2, 'ATTENDEES'),
    momTable([{ text: 'S.No', width: 10 }, { text: 'Name', width: 90 }], attendeeRows),

    momSectionHeading(3, 'DISCUSSIONS'),
    momTable([{ text: 'S.No', width: 10 }, { text: 'Details', width: 90 }], discussionRows),

    momSectionHeading(4, 'DECISIONS'),
    momTable([{ text: 'S.No', width: 10 }, { text: 'Details', width: 90 }], decisionRows),

    momSectionHeading(5, 'ACTION ITEMS'),
    momTable([{ text: 'S.No', width: 10 }, { text: 'Details', width: 65 }, { text: 'Due Date', width: 25 }], actionRows),

    momSectionHeading(6, 'OTHER NOTES / OBSERVATIONS'),
    momTable([{ text: 'S.No', width: 10 }, { text: 'Details', width: 90 }], notesRows),
  ];

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}
