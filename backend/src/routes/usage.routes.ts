import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

export const usageRoutes = Router();
usageRoutes.use(authenticate);

// AssemblyAI is billed per audio hour on a single shared API key for this app.
// Rate = $0.15/hr base (Universal-2) + $0.02/hr speaker diarization (always enabled here).
const RATE_PER_HOUR = parseFloat(process.env.ASSEMBLYAI_RATE_PER_HOUR || '0.17');
const TOTAL_CREDIT_USD = parseFloat(process.env.ASSEMBLYAI_TOTAL_CREDIT_USD || '50');

// GET /api/usage - AssemblyAI credit usage for the logged-in user's recordings
usageRoutes.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const meetings = await prisma.meeting.findMany({
    where: { userId: req.userId, status: 'completed', duration: { not: null } },
    select: { id: true, title: true, duration: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  const recordings = meetings.map((m) => {
    const durationSec = m.duration || 0;
    const costUsd = (durationSec / 3600) * RATE_PER_HOUR;
    return {
      id: m.id,
      title: m.title,
      duration: durationSec,
      createdAt: m.createdAt,
      costUsd,
    };
  });

  const usedUsd = recordings.reduce((sum, r) => sum + r.costUsd, 0);
  const remainingUsd = Math.max(TOTAL_CREDIT_USD - usedUsd, 0);
  const percentUsed = TOTAL_CREDIT_USD > 0
    ? Math.min((usedUsd / TOTAL_CREDIT_USD) * 100, 100)
    : 0;
  const totalDurationSec = recordings.reduce((sum, r) => sum + r.duration, 0);
  const usedHours = totalDurationSec / 3600;
  const totalHours = TOTAL_CREDIT_USD / RATE_PER_HOUR;
  const remainingHours = Math.max(totalHours - usedHours, 0);

  res.json({
    totalCreditUsd: TOTAL_CREDIT_USD,
    totalHours,
    ratePerHour: RATE_PER_HOUR,
    usedUsd,
    usedHours,
    remainingUsd,
    remainingHours,
    percentUsed,
    totalDurationSec,
    recordings,
  });
});
