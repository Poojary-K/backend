import { z } from 'zod';

/**
 * Schema for member registration with input sanitization.
 */
export const registerSchema = z.object({
  name: z.string().min(1).trim(),
  email: z
    .string()
    .trim()
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: 'Invalid email address' })
    .optional(),
  phone: z.string().max(15).trim().optional(),
  password: z.string().min(8),
});

/**
 * Schema for member login with input sanitization.
 */
export const loginSchema = z.object({
  email: z.string().trim().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: 'Invalid email address' }),
  password: z.string().min(8),
});


