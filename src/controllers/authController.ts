import type { Request, Response, NextFunction } from 'express';
import { authenticateMember, registerMember, verifyMemberEmail, resendEmailVerification } from '../services/memberService.js';
import type { z } from 'zod';
import { registerSchema, loginSchema, verifyEmailSchema, resendVerificationSchema } from '../schemas/authSchemas.js';

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

/**
 * Verifies a member's email address using the supplied token.
 */
export const verifyEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = req.query as z.infer<typeof verifyEmailSchema>;
    const result = await verifyMemberEmail(payload.token);
    res.status(200).json({ success: true, data: result, message: 'Email verified successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Resends a verification email to an unverified member.
 */
export const resendVerification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = req.body as z.infer<typeof resendVerificationSchema>;
    await resendEmailVerification(payload.email);
    res.status(200).json({ success: true, message: 'Verification email sent' });
  } catch (error) {
    next(error);
  }
};
