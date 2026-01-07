import { z } from 'zod';

/**
 * Schema for creating a cause with input sanitization.
 */
export const causeSchema = z.object({
  title: z.string().min(1).trim(),
  description: z.string().max(1000).trim().optional(),
  amount: z.number().nonnegative().optional(),
  createdat: z
    .string()
    .transform((value, ctx) => {
      const parsed = new Date(value.trim());
      if (Number.isNaN(parsed.getTime())) {
        ctx.addIssue({ code: 'custom', message: 'Invalid createdat' });
        return z.NEVER;
      }
      return parsed;
    })
    .optional(),
});





