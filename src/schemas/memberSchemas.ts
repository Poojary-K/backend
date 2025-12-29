import { z } from 'zod';

/**
 * Schema for updating a member with input sanitization.
 */
export const updateMemberSchema = z.object({
  name: z.string().min(1).trim().optional(),
  email: z
    .string()
    .trim()
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: 'Invalid email address' })
    .optional(),
  phone: z.string().max(15).trim().optional(),
  isAdmin: z.boolean().optional(),
});

