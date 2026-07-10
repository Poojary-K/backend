import { z } from 'zod';

const MIN_FUND_DATE_YEAR = 2025;

const parseDateString = (value: string, ctx: z.RefinementCtx, field: string): Date => {
  const trimmed = value.trim();
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T12:00:00.000Z`)
    : new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    ctx.addIssue({ code: 'custom', message: `Invalid ${field}` });
    return z.NEVER;
  }
  const year = parsed.getUTCFullYear();
  const maxYear = new Date().getUTCFullYear() + 1;
  if (year < MIN_FUND_DATE_YEAR || year > maxYear) {
    ctx.addIssue({
      code: 'custom',
      message: `${field} year ${year} looks wrong. Use YYYY-MM-DD with the correct year (e.g. ${maxYear - 1}-08-01 for August 1). Allowed: ${MIN_FUND_DATE_YEAR}–${maxYear}.`,
    });
    return z.NEVER;
  }
  return parsed;
};

export const PENDING_ACTION_TYPES = [
  'create_contribution',
  'update_contribution',
  'delete_contribution',
  'create_cause',
  'update_cause',
  'delete_cause',
  'update_member',
  'promote_member',
  'delete_member',
] as const;

export type PendingActionType = (typeof PENDING_ACTION_TYPES)[number];

export const PENDING_STATUSES = [
  'awaiting_confirmation',
  'confirmed',
  'executed',
  'rejected',
  'superseded',
  'expired',
  'failed',
] as const;

export type PendingStatus = (typeof PENDING_STATUSES)[number];

export const createContributionPayloadSchema = z.object({
  memberId: z.number().int().positive(),
  amount: z.number().positive(),
  contributedDate: z.string().transform((value, ctx) => parseDateString(value, ctx, 'contributedDate')),
});

export const updateContributionPayloadSchema = z.object({
  contributionId: z.number().int().positive(),
  memberId: z.number().int().positive().optional(),
  amount: z.number().positive().optional(),
  contributedDate: z
    .string()
    .transform((value, ctx) => parseDateString(value, ctx, 'contributedDate'))
    .optional(),
});

export const deleteContributionPayloadSchema = z.object({
  contributionId: z.number().int().positive(),
});

export const createCausePayloadSchema = z.object({
  title: z.string().min(1).trim(),
  description: z.string().max(1000).trim().optional(),
  amount: z.number().nonnegative().optional(),
  createdat: z
    .string()
    .transform((value, ctx) => parseDateString(value, ctx, 'createdat'))
    .optional(),
});

export const updateCausePayloadSchema = z.object({
  causeId: z.number().int().positive(),
  title: z.string().min(1).trim().optional(),
  description: z.string().max(1000).trim().optional(),
  amount: z.number().nonnegative().optional(),
  createdat: z
    .string()
    .transform((value, ctx) => parseDateString(value, ctx, 'createdat'))
    .optional(),
});

export const deleteCausePayloadSchema = z.object({
  causeId: z.number().int().positive(),
});

export const updateMemberPayloadSchema = z.object({
  memberId: z.number().int().positive(),
  name: z.string().min(1).trim().optional(),
  email: z
    .string()
    .trim()
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: 'Invalid email address' })
    .optional(),
  phone: z.string().max(15).trim().optional(),
});

export const promoteMemberPayloadSchema = z.object({
  memberId: z.number().int().positive(),
});

export const deleteMemberPayloadSchema = z.object({
  memberId: z.number().int().positive(),
});

export const PENDING_PAYLOAD_SCHEMAS: Record<PendingActionType, z.ZodType<unknown>> = {
  create_contribution: createContributionPayloadSchema,
  update_contribution: updateContributionPayloadSchema,
  delete_contribution: deleteContributionPayloadSchema,
  create_cause: createCausePayloadSchema,
  update_cause: updateCausePayloadSchema,
  delete_cause: deleteCausePayloadSchema,
  update_member: updateMemberPayloadSchema,
  promote_member: promoteMemberPayloadSchema,
  delete_member: deleteMemberPayloadSchema,
};

/**
 * Validates and parses a pending task payload for the given action type.
 */
export const validatePendingPayload = (actionType: PendingActionType, payload: unknown): unknown => {
  const schema = PENDING_PAYLOAD_SCHEMAS[actionType];
  return schema.parse(payload);
};
