import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticateMember, registerMember } from '../services/memberService.js';

const registerSchema = z.object({
  name: z.string().min(1),
  email: z
    .string()
    .trim()
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: 'Invalid email address' })
    .optional(),
  phone: z.string().max(15).optional(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().trim().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: 'Invalid email address' }),
  password: z.string().min(8),
});

/**
 * Handles member registration.
 */
export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = registerSchema.parse(req.body);
    const result = await registerMember(payload);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Handles member login and issues JWT.
 */
export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = loginSchema.parse(req.body);
    const result = await authenticateMember(payload);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

