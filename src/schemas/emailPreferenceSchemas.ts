import { z } from 'zod';

export const emailUnsubscribeQuerySchema = z.object({
  token: z.string().trim().min(1),
});
