import type { Request, Response, NextFunction } from 'express';
import type { z } from 'zod';
import {
  getEmailUpdatesEnabledForMember,
  setEmailUpdatesEnabledForMember,
} from '../services/emailPreferenceService.js';
import { patchEmailPreferencesSchema } from '../schemas/meSchemas.js';

export const getMyEmailPreferencesHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const memberId = req.user!.memberId;
    const data = await getEmailUpdatesEnabledForMember(memberId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const patchMyEmailPreferencesHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const memberId = req.user!.memberId;
    const payload = req.body as z.infer<typeof patchEmailPreferencesSchema>;
    const data = await setEmailUpdatesEnabledForMember(memberId, payload.emailUpdatesEnabled);
    res.status(200).json({ success: true, data, message: 'Email preferences updated' });
  } catch (error) {
    next(error);
  }
};
