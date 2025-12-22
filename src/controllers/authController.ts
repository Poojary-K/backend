import type { Request, Response, NextFunction } from 'express';
import { authenticateMember, registerMember } from '../services/memberService.js';
import type { z } from 'zod';
import { registerSchema, loginSchema } from '../schemas/authSchemas.js';

/**
 * Handles member registration.
 * Request body is validated by validateRequest middleware.
 */
export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = req.body as z.infer<typeof registerSchema>;
    const result = await registerMember(payload);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Handles member login and issues JWT.
 * Request body is validated by validateRequest middleware.
 */
export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = req.body as z.infer<typeof loginSchema>;
    const result = await authenticateMember(payload);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

