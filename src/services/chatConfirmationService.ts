import { HttpError } from '../middlewares/errorHandler.js';
import {
  findActivePendingBySessionId,
  expireStalePendingForSession,
} from '../repositories/chatPendingRepository.js';
import { executePendingTask, type ExecutePendingResult } from './chatPendingExecutor.js';
import { cancelPendingTask, type PendingTaskDto } from './chatPendingService.js';

export type PendingActionOutcome =
  | { readonly action: 'execute'; readonly result: ExecutePendingResult; readonly pending: PendingTaskDto }
  | { readonly action: 'cancel'; readonly pending: PendingTaskDto };

/**
 * Executes the active pending task for a session (UI confirm button — not chat text).
 */
export const confirmSessionPending = async (input: {
  readonly sessionId: number;
  readonly memberId: number;
  readonly isAdmin: boolean;
}): Promise<PendingActionOutcome> => {
  if (!input.isAdmin) {
    throw new HttpError('Admin access required', 403);
  }

  await expireStalePendingForSession(input.sessionId);
  const active = await findActivePendingBySessionId(input.sessionId);
  if (!active) {
    throw new HttpError('No active pending task for this session', 404);
  }

  try {
    const result = await executePendingTask(active.pending_id, input.memberId, input.isAdmin);
    return {
      action: 'execute',
      result,
      pending: {
        pendingId: active.pending_id,
        actionType: active.action_type,
        payload: active.payload,
        summary: active.summary,
        status: 'executed',
        expiresAt: active.expires_at,
      },
    };
  } catch (error) {
    const message = error instanceof HttpError ? error.message : 'Execution failed';
    throw new HttpError(message, error instanceof HttpError ? error.statusCode : 500);
  }
};

/**
 * Cancels the active pending task for a session (UI cancel button — not chat text).
 */
export const cancelSessionPending = async (input: {
  readonly sessionId: number;
  readonly memberId: number;
  readonly isAdmin: boolean;
}): Promise<PendingActionOutcome> => {
  if (!input.isAdmin) {
    throw new HttpError('Admin access required', 403);
  }

  const cancelled = await cancelPendingTask(input.sessionId, input.memberId, input.isAdmin);
  return { action: 'cancel', pending: cancelled };
};

/**
 * Builds a user-facing assistant message after confirm/cancel via the UI.
 */
export const buildConfirmationReply = (outcome: PendingActionOutcome): string => {
  if (outcome.action === 'execute') {
    const { result } = outcome;
    const details = result.result && typeof result.result === 'object' ? (result.result as Record<string, unknown>) : {};
    if (!result.success) {
      return `Failed to apply: ${result.summary}. Please review and try again.`;
    }

    switch (result.actionType) {
      case 'create_contribution':
        return `Done. Contribution #${details.contributionId} recorded successfully. If you have more entries to add, ask me to queue the next one.`;
      case 'create_contributions_batch': {
        const count = typeof details.count === 'number' ? details.count : 0;
        const ids = Array.isArray(details.contributions)
          ? (details.contributions as Array<{ contributionId?: number }>)
              .map((c) => c.contributionId)
              .filter((id): id is number => typeof id === 'number')
          : [];
        const idPart = ids.length > 0 ? ` (#${ids.join(', #')})` : '';
        return `Done. ${count} contribution${count === 1 ? '' : 's'} recorded successfully${idPart}.`;
      }
      case 'update_contribution':
        return `Done. Contribution #${details.contributionId} has been updated.`;
      case 'delete_contribution':
        return `Done. Contribution #${details.contributionId} has been deleted.`;
      case 'create_cause':
        return `Done. Cause #${details.causeId} "${details.title ?? ''}" created successfully.`;
      case 'update_cause':
        return `Done. Cause #${details.causeId} has been updated.`;
      case 'delete_cause':
        return `Done. Cause #${details.causeId} has been deleted.`;
      case 'update_member':
        return `Done. Member profile updated successfully.`;
      case 'promote_member':
        return `Done. Member #${details.memberId} has been promoted to admin.`;
      case 'delete_member':
        return `Done. Member #${details.memberId} has been removed.`;
      default:
        return `Done. ${result.summary} has been applied successfully.`;
    }
  }
  return `Cancelled. The pending action "${outcome.pending.summary}" was not applied.`;
};
