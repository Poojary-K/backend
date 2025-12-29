import { z } from 'zod';

/**
 * Schema for creating a cause with input sanitization.
 */
export const causeSchema = z.object({
  title: z.string().min(1).trim(),
  description: z.string().max(1000).trim().optional(),
  amount: z.number().nonnegative().optional(),
});






