import type { Request, Response, NextFunction } from 'express';
import { recordContribution, getContributions } from '../services/contributionService.js';
import type { z } from 'zod';
import type { contributionSchema } from '../schemas/contributionSchemas.js';

/**
 * Handles the creation of contributions.
 * Request body is validated by validateRequest middleware.
 */
export const createContributionHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = req.body as z.infer<typeof contributionSchema>;
    const contribution = await recordContribution(payload);
    res.status(201).json({ success: true, data: contribution });
  } catch (error) {
    next(error);
  }
};

/**
 * Lists contributions.
 */
export const listContributionsHandler = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const contributions = await getContributions();
    res.status(200).json({ success: true, data: { contributions } });
  } catch (error) {
    next(error);
  }
};

