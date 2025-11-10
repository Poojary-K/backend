import type { Request, Response, NextFunction } from 'express';
import { getMembers } from '../services/memberService.js';

/**
 * Returns the list of registered members.
 */
export const listMembersHandler = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const members = await getMembers();
    res.status(200).json({ success: true, data: { members } });
  } catch (error) {
    next(error);
  }
};


