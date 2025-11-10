import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { recordContribution, getContributions } from '../services/contributionService.js';

const contributionSchema = z.object({
  memberId: z.number().int().positive(),
  amount: z.number().positive(),
  contributedDate: z.string().transform((value, ctx) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      ctx.addIssue({ code: 'custom', message: 'Invalid contributedDate' });
    }
    return parsed;
  }),
});

/**
 * Handles the creation of contributions.
 */
export const createContributionHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = contributionSchema.parse(req.body);
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

