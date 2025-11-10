import type { Request, Response, NextFunction } from 'express';
import { getFundSummary } from '../services/fundService.js';

/**
 * Returns aggregate fund status totals.
 */
export const getFundStatusHandler = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const status = await getFundSummary();
    res.status(200).json({ success: true, data: status });
  } catch (error) {
    next(error);
  }
};


