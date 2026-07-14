import { z } from 'zod';
import { HttpError } from '../middlewares/errorHandler.js';
import {
  findPendingTaskById,
  updatePendingTask,
  type ChatPendingTaskRecord,
} from '../repositories/chatPendingRepository.js';
import { findSessionById } from '../repositories/chatRepository.js';
import { findMemberById } from '../repositories/memberRepository.js';
import { findContributionById } from '../repositories/contributionRepository.js';
import { findCauseById } from '../repositories/causeRepository.js';
import { getFundSummary } from '../services/fundService.js';
import { recordContribution, updateContributionById, deleteContributionById } from '../services/contributionService.js';
import { registerCause, updateCauseById, deleteCauseById } from '../services/causeService.js';
import { updateMemberById, deleteMemberById } from '../services/memberService.js';
import { updateMemberAdminStatus } from '../repositories/memberRepository.js';
import {
  validatePendingPayload,
  type PendingActionType,
  createContributionPayloadSchema,
  createContributionsBatchPayloadSchema,
  updateContributionPayloadSchema,
  deleteContributionPayloadSchema,
  createCausePayloadSchema,
  updateCausePayloadSchema,
  deleteCausePayloadSchema,
  updateMemberPayloadSchema,
  promoteMemberPayloadSchema,
  deleteMemberPayloadSchema,
} from '../schemas/chatPendingSchemas.js';

export interface ExecutePendingResult {
  readonly pendingId: number;
  readonly actionType: PendingActionType;
  readonly success: boolean;
  readonly result: unknown;
  readonly summary: string;
}

const parseAmount = (value: string | null | undefined): number => {
  if (value === null || value === undefined) {
    return 0;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Executes a confirmed pending task by calling the appropriate service method.
 * Backend-only — never exposed as an LLM tool.
 */
export const executePendingTask = async (
  pendingId: number,
  actorMemberId: number,
  isAdmin: boolean,
): Promise<ExecutePendingResult> => {
  if (!isAdmin) {
    throw new HttpError('Admin access required', 403);
  }

  const pending = await findPendingTaskById(pendingId);
  if (!pending) {
    throw new HttpError('Pending task not found', 404);
  }

  // Idempotency: return cached result if already executed.
  if (pending.status === 'executed') {
    return {
      pendingId: pending.pending_id,
      actionType: pending.action_type,
      success: true,
      result: pending.result,
      summary: pending.summary,
    };
  }

  if (pending.status !== 'awaiting_confirmation' && pending.status !== 'failed') {
    throw new HttpError(`Pending task is not executable (status: ${pending.status})`, 400);
  }

  if (pending.expires_at.getTime() <= Date.now()) {
    await updatePendingTask(pendingId, { status: 'expired' });
    throw new HttpError('Pending task has expired', 400);
  }

  const session = await findSessionById(pending.session_id);
  if (!session || session.member_id !== actorMemberId) {
    throw new HttpError('Session access denied', 403);
  }

  if (pending.member_id !== actorMemberId) {
    throw new HttpError('Pending task ownership mismatch', 403);
  }

  await updatePendingTask(pendingId, { status: 'confirmed' });

  try {
    const result = await dispatchAction(pending, actorMemberId);
    const executedAt = new Date();
    await updatePendingTask(pendingId, {
      status: 'executed',
      result,
      executedAt,
    });
    return {
      pendingId: pending.pending_id,
      actionType: pending.action_type,
      success: true,
      result,
      summary: pending.summary,
    };
  } catch (error) {
    const errorMessage = error instanceof HttpError ? error.message : 'Execution failed';
    await updatePendingTask(pendingId, {
      status: 'failed',
      result: { error: errorMessage },
    });
    throw error instanceof HttpError ? error : new HttpError(errorMessage, 500);
  }
};

const dispatchAction = async (pending: ChatPendingTaskRecord, actorMemberId: number): Promise<unknown> => {
  switch (pending.action_type) {
    case 'create_contribution': {
      const payload = validatePendingPayload('create_contribution', pending.payload) as z.infer<
        typeof createContributionPayloadSchema
      >;
      const contribution = await recordContribution({
        memberId: payload.memberId,
        amount: payload.amount,
        contributedDate: payload.contributedDate,
      });
      return { contributionId: contribution.contributionid, memberId: contribution.memberid, amount: contribution.amount };
    }
    case 'create_contributions_batch': {
      const payload = validatePendingPayload('create_contributions_batch', pending.payload) as z.infer<
        typeof createContributionsBatchPayloadSchema
      >;
      // Pre-validate every member before writing any rows.
      for (const item of payload.contributions) {
        const member = await findMemberById(item.memberId);
        if (!member) {
          throw new HttpError(`Member with ID ${item.memberId} not found`, 404);
        }
      }
      const created: Array<{ contributionId: number; memberId: number; amount: string }> = [];
      for (const item of payload.contributions) {
        const contribution = await recordContribution({
          memberId: item.memberId,
          amount: item.amount,
          contributedDate: item.contributedDate,
        });
        created.push({
          contributionId: contribution.contributionid,
          memberId: contribution.memberid,
          amount: contribution.amount,
        });
      }
      return { count: created.length, contributions: created };
    }
    case 'update_contribution': {
      const payload = validatePendingPayload('update_contribution', pending.payload) as z.infer<
        typeof updateContributionPayloadSchema
      >;
      const existing = await findContributionById(payload.contributionId);
      if (!existing) {
        throw new HttpError('Contribution not found', 404);
      }
      const { contributionId, ...updates } = payload;
      const contribution = await updateContributionById(contributionId, updates);
      return { contributionId: contribution.contributionid };
    }
    case 'delete_contribution': {
      const payload = validatePendingPayload('delete_contribution', pending.payload) as z.infer<
        typeof deleteContributionPayloadSchema
      >;
      const existing = await findContributionById(payload.contributionId);
      if (!existing) {
        throw new HttpError('Contribution not found', 404);
      }
      await deleteContributionById(payload.contributionId);
      return { contributionId: payload.contributionId, deleted: true };
    }
    case 'create_cause': {
      const payload = validatePendingPayload('create_cause', pending.payload) as z.infer<typeof createCausePayloadSchema>;
      await assertDisbursementFeasible(payload.amount);
      const cause = await registerCause({
        title: payload.title,
        description: payload.description,
        amount: payload.amount,
        createdat: payload.createdat,
      });
      return { causeId: cause.causeid, title: cause.title, amount: cause.amount };
    }
    case 'update_cause': {
      const payload = validatePendingPayload('update_cause', pending.payload) as z.infer<typeof updateCausePayloadSchema>;
      const existing = await findCauseById(payload.causeId);
      if (!existing) {
        throw new HttpError('Cause not found', 404);
      }
      if (payload.amount !== undefined) {
        const currentAmount = parseAmount(existing.amount);
        const delta = payload.amount - currentAmount;
        if (delta > 0) {
          await assertDisbursementFeasible(delta);
        }
      }
      const { causeId, ...updates } = payload;
      const cause = await updateCauseById(causeId, updates);
      return { causeId: cause.causeid };
    }
    case 'delete_cause': {
      const payload = validatePendingPayload('delete_cause', pending.payload) as z.infer<typeof deleteCausePayloadSchema>;
      const existing = await findCauseById(payload.causeId);
      if (!existing) {
        throw new HttpError('Cause not found', 404);
      }
      await deleteCauseById(payload.causeId);
      return { causeId: payload.causeId, deleted: true };
    }
    case 'update_member': {
      const payload = validatePendingPayload('update_member', pending.payload) as z.infer<typeof updateMemberPayloadSchema>;
      const existing = await findMemberById(payload.memberId);
      if (!existing) {
        throw new HttpError('Member not found', 404);
      }
      const { memberId, ...updates } = payload;
      const member = await updateMemberById(memberId, updates);
      return { memberId: member.memberid, name: member.name };
    }
    case 'promote_member': {
      const payload = validatePendingPayload('promote_member', pending.payload) as z.infer<typeof promoteMemberPayloadSchema>;
      const existing = await findMemberById(payload.memberId);
      if (!existing) {
        throw new HttpError('Member not found', 404);
      }
      if (existing.is_admin) {
        throw new HttpError('Member is already an admin', 400);
      }
      const member = await updateMemberAdminStatus(payload.memberId, true);
      return { memberId: member.memberid, isAdmin: member.is_admin };
    }
    case 'delete_member': {
      const payload = validatePendingPayload('delete_member', pending.payload) as z.infer<typeof deleteMemberPayloadSchema>;
      if (payload.memberId === actorMemberId) {
        throw new HttpError('Cannot delete your own account', 400);
      }
      const existing = await findMemberById(payload.memberId);
      if (!existing) {
        throw new HttpError('Member not found', 404);
      }
      if (existing.is_admin) {
        throw new HttpError('Cannot delete an admin member', 400);
      }
      await deleteMemberById(payload.memberId);
      return { memberId: payload.memberId, deleted: true };
    }
    default:
      throw new HttpError(`Unsupported action type: ${pending.action_type}`, 400);
  }
};

const assertDisbursementFeasible = async (amount: number | undefined): Promise<void> => {
  if (amount === undefined || amount <= 0) {
    return;
  }
  const fundStatus = await getFundSummary();
  const available = parseAmount(fundStatus.availablefunds);
  if (amount > available) {
    throw new HttpError(
      `Insufficient funds: proposed amount ₹${amount.toLocaleString('en-IN')} exceeds available ₹${available.toLocaleString('en-IN')}`,
      400,
    );
  }
};
