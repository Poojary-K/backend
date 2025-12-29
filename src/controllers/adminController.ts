import type { Request, Response, NextFunction } from 'express';
import { upgradeToAdmin } from '../services/memberService.js';
import type { z } from 'zod';
import { upgradeToAdminSchema } from '../schemas/adminSchemas.js';

/**
 * Handles upgrading a member to admin status.
 * Requires authentication - the memberId comes from the JWT token.
 */
export const upgradeToAdminHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new Error('User not authenticated');
    }
    
    const payload = req.body as z.infer<typeof upgradeToAdminSchema>;
    const result = await upgradeToAdmin({
      memberId: req.user.memberId,
      adminSecretCode: payload.adminSecretCode,
    });
    
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};





