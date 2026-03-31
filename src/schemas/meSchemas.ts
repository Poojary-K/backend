import { z } from 'zod';

export const patchEmailPreferencesSchema = z.object({
  emailUpdatesEnabled: z.boolean(),
});
