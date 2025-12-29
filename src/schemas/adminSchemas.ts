import { z } from 'zod';

/**
 * Schema for upgrading to admin with secret code.
 */
export const upgradeToAdminSchema = z.object({
  adminSecretCode: z.string().min(1).trim(),
});





