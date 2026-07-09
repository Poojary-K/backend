import { HttpError } from '../middlewares/errorHandler.js';
import {
  findActivePendingBySessionId,
  expireStalePendingForSession,
} from '../repositories/chatPendingRepository.js';
import { executePendingTask, type ExecutePendingResult } from './chatPendingExecutor.js';
import { cancelPendingTask, type PendingTaskDto } from './chatPendingService.js';

const YES_PATTERNS = [
  /^yes\.?$/,
  /^yep\.?$/,
  /^yeah\.?$/,
  /^yea\.?$/,
  /^sure\.?$/,
  /^y\.?$/,
  /^confirm\.?$/,
  /^confirmed\.?$/,
  /^go ahead\.?$/,
  /^proceed\.?$/,
  /^do it\.?$/,
  /^approve\.?$/,
  /^ok\.?$/,
  /^okay\.?$/,
  /^absolutely\.?$/,
];

const NO_PATTERNS = [
  /^no\.?$/,
  /^nope\.?$/,
  /^nah\.?$/,
  /^n\.?$/,
  /^cancel\.?$/,
  /^abort\.?$/,
  /^stop\.?$/,
  /^reject\.?$/,
  /^nevermind\.?$/,
  /^never mind\.?$/,
];

export type ConfirmationResolution =
  | { readonly action: 'execute'; readonly result: ExecutePendingResult; readonly pending: PendingTaskDto }
  | { readonly action: 'cancel'; readonly pending: PendingTaskDto }
  | { readonly action: 'none' };

const normalizeMessage = (message: string): string =>
  message
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');

const matchesPatterns = (normalized: string, patterns: RegExp[]): boolean =>
  patterns.some((pattern) => pattern.test(normalized));

/**
 * Returns whether a message is a bare yes/no with no other content.
 */
export const isBareConfirmationMessage = (message: string): 'yes' | 'no' | null => {
  const normalized = normalizeMessage(message);
  if (matchesPatterns(normalized, YES_PATTERNS)) {
    return 'yes';
  }
  if (matchesPatterns(normalized, NO_PATTERNS)) {
    return 'no';
  }
  return null;
};

/**
 * Reply when the user sends yes/no but no pending task is active.
 */
export const buildOrphanConfirmationReply = (kind: 'yes' | 'no'): string =>
  kind === 'yes'
    ? 'There is no pending action awaiting your confirmation. If you want to make a change, describe what you need and I will prepare it for review.'
    : 'Nothing to cancel — there is no pending action in this chat.';

/**
 * Deterministically resolves yes/no confirmation against the active pending task.
 * Returns 'none' when the message is not a clear confirmation or rejection.
 */
export const resolveUserConfirmation = async (input: {
  readonly message: string;
  readonly sessionId: number;
  readonly memberId: number;
  readonly isAdmin: boolean;
}): Promise<ConfirmationResolution> => {
  if (!input.isAdmin) {
    return { action: 'none' };
  }

  await expireStalePendingForSession(input.sessionId);
  const active = await findActivePendingBySessionId(input.sessionId);
  if (!active) {
    return { action: 'none' };
  }

  const normalized = normalizeMessage(input.message);

  if (matchesPatterns(normalized, YES_PATTERNS)) {
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
  }

  if (matchesPatterns(normalized, NO_PATTERNS)) {
    const cancelled = await cancelPendingTask(input.sessionId, input.memberId, input.isAdmin);
    return { action: 'cancel', pending: cancelled };
  }

  return { action: 'none' };
};

/**
 * Builds a user-facing assistant message after a confirmation resolution.
 */
export const buildConfirmationReply = (resolution: ConfirmationResolution): string => {
  if (resolution.action === 'execute') {
    const { result } = resolution;
    const details = result.result && typeof result.result === 'object' ? (result.result as Record<string, unknown>) : {};
    if (!result.success) {
      return `Failed to apply: ${result.summary}. Please review and try again.`;
    }

    switch (result.actionType) {
      case 'create_contribution':
        return `Done. Contribution #${details.contributionId} recorded successfully.`;
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
  if (resolution.action === 'cancel') {
    return `Cancelled. The pending action "${resolution.pending.summary}" was not applied.`;
  }
  return '';
};
