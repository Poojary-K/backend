import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getCauses, registerCause } from '../services/causeService.js';

const causeSchema = z.object({
  title: z.string().min(1),
  description: z.string().max(1000).optional(),
  amount: z.number().nonnegative().optional(),
});

/**
 * Creates a fundraising cause.
 */
export const createCauseHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = causeSchema.parse(req.body);
    const cause = await registerCause(payload);
    res.status(201).json({ success: true, data: cause });
  } catch (error) {
    next(error);
  }
};

/**
 * Lists all causes.
 */
export const listCausesHandler = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const causes = await getCauses();
    res.status(200).json({ success: true, data: { causes } });
  } catch (error) {
    next(error);
  }
};


