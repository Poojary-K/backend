import type { Request, Response, NextFunction } from 'express';
import { getCauses, registerCause } from '../services/causeService.js';
import type { z } from 'zod';
import type { causeSchema } from '../schemas/causeSchemas.js';

/**
 * Creates a fundraising cause.
 * Request body is validated by validateRequest middleware.
 */
export const createCauseHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = req.body as z.infer<typeof causeSchema>;
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


