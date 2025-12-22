import { z } from 'zod';

/**
 * Schema for creating a contribution with input sanitization.
 */
export const contributionSchema = z.object({
  memberId: z.number().int().positive(),
  amount: z.number().positive(),
  contributedDate: z.string().transform((value, ctx) => {
    const parsed = new Date(value.trim());
    if (Number.isNaN(parsed.getTime())) {
      ctx.addIssue({ code: 'custom', message: 'Invalid contributedDate' });
      return z.NEVER;
    }
    return parsed;
  }),
});



