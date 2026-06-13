import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

export interface AuthRequest extends Request {
  userId?: string;
}

export async function attachUser(req: AuthRequest, _res: Response, next: NextFunction): Promise<void> {
  const user = await prisma.user.findFirstOrThrow();
  req.userId = user.id;
  next();
}
