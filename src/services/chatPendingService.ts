import { HttpError } from '../middlewares/errorHandler.js';
import { getFundSummary } from './fundService.js';
import { getMember } from './chatReadService.js';
import {
  createPendingTask,
  findActivePendingBySessionId,
  findPendingTaskById,
  markActivePendingSuperseded,
  linkSupersededPending,
  updatePendingTask as updatePendingTaskRow,
  expireStalePendingForSession,
  listRecentlySupersededBySessionId,
  type ChatPendingTaskRecord,
} from '../repositories/chatPendingRepository.js';
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

const PENDING_TTL_MS = 30 * 60 * 1000;

export interface PendingTaskDto {
  readonly pendingId: number;
  readonly actionType: PendingActionType;
  readonly payload: unknown;
  readonly summary: string;
  readonly status: string;
  readonly expiresAt: Date;
  readonly supersededBy?: number;
}

export interface ProposeResult {
  readonly pending: PendingTaskDto;
  readonly superseded?: PendingTaskDto;
}

export interface SessionPendingState {
  readonly active: PendingTaskDto | null;
  readonly recentlySuperseded: Array<{
    readonly pendingId: number;
    readonly summary: string;
    readonly supersededAt: Date;
  }>;
}

const toPendingDto = (record: ChatPendingTaskRecord): PendingTaskDto => ({
  pendingId: record.pending_id,
  actionType: record.action_type,
  payload: record.payload,
  summary: record.summary,
  status: record.status,
  expiresAt: record.expires_at,
  ...(record.superseded_by !== null ? { supersededBy: record.superseded_by } : {}),
});

const formatCurrency = (amount: number): string => `₹${amount.toLocaleString('en-IN')}`;

const formatDate = (date: Date): string => date.toISOString().slice(0, 10);

const requireAdmin = (isAdmin: boolean): void => {
  if (!isAdmin) {
    throw new HttpError('Admin access required', 403);
  }
};

const requireSessionId = (sessionId: number | undefined): number => {
  if (sessionId === undefined) {
    throw new HttpError('Session context required for pending tasks', 400);
  }
  return sessionId;
};

const buildSummary = async (actionType: PendingActionType, payload: unknown): Promise<string> => {
  switch (actionType) {
    case 'create_contribution': {
      const p = payload as ReturnType<typeof createContributionPayloadSchema.parse>;
      const member = await getMember(p.memberId);
      return `Create contribution: ${member.name}, ${formatCurrency(p.amount)}, ${formatDate(p.contributedDate)}`;
    }
    case 'create_contributions_batch': {
      const p = payload as ReturnType<typeof createContributionsBatchPayloadSchema.parse>;
      const lines: string[] = [];
      let total = 0;
      for (const item of p.contributions) {
        const member = await getMember(item.memberId);
        total += item.amount;
        lines.push(`${member.name} ${formatCurrency(item.amount)} (${formatDate(item.contributedDate)})`);
      }
      return `Create ${p.contributions.length} contributions (total ${formatCurrency(total)}): ${lines.join('; ')}`;
    }
    case 'update_contribution': {
      const p = payload as ReturnType<typeof updateContributionPayloadSchema.parse>;
      const parts = [`Update contribution #${p.contributionId}`];
      if (p.amount !== undefined) parts.push(`amount → ${formatCurrency(p.amount)}`);
      if (p.memberId !== undefined) {
        const member = await getMember(p.memberId);
        parts.push(`member → ${member.name}`);
      }
      if (p.contributedDate !== undefined) parts.push(`date → ${formatDate(p.contributedDate)}`);
      return parts.join(': ');
    }
    case 'delete_contribution':
      return `Delete contribution #${(payload as ReturnType<typeof deleteContributionPayloadSchema.parse>).contributionId}`;
    case 'create_cause': {
      const p = payload as ReturnType<typeof createCausePayloadSchema.parse>;
      const amountPart = p.amount !== undefined ? ` ${formatCurrency(p.amount)}` : '';
      return `Create cause: "${p.title}"${amountPart}`;
    }
    case 'update_cause': {
      const p = payload as ReturnType<typeof updateCausePayloadSchema.parse>;
      const parts = [`Update cause #${p.causeId}`];
      if (p.title !== undefined) parts.push(`title → "${p.title}"`);
      if (p.amount !== undefined) parts.push(`amount → ${formatCurrency(p.amount)}`);
      return parts.join(': ');
    }
    case 'delete_cause':
      return `Delete cause #${(payload as ReturnType<typeof deleteCausePayloadSchema.parse>).causeId}`;
    case 'update_member': {
      const p = payload as ReturnType<typeof updateMemberPayloadSchema.parse>;
      const member = await getMember(p.memberId);
      const parts = [`Update member ${member.name}`];
      if (p.name !== undefined) parts.push(`name → "${p.name}"`);
      if (p.email !== undefined) parts.push(`email → ${p.email}`);
      if (p.phone !== undefined) parts.push(`phone → ${p.phone}`);
      return parts.join(': ');
    }
    case 'promote_member': {
      const p = payload as ReturnType<typeof promoteMemberPayloadSchema.parse>;
      const member = await getMember(p.memberId);
      return `Promote ${member.name} to admin`;
    }
    case 'delete_member': {
      const p = payload as ReturnType<typeof deleteMemberPayloadSchema.parse>;
      const member = await getMember(p.memberId);
      return `Delete member ${member.name}`;
    }
    default:
      return `Pending action: ${actionType}`;
  }
};

/**
 * Creates a pending task, superseding any existing active pending in the session.
 */
const createPropose = async (
  sessionId: number,
  memberId: number,
  isAdmin: boolean,
  actionType: PendingActionType,
  rawPayload: unknown,
): Promise<ProposeResult> => {
  requireAdmin(isAdmin);
  await expireStalePendingForSession(sessionId);

  const payload = validatePendingPayload(actionType, rawPayload);
  const summary = await buildSummary(actionType, payload);
  const expiresAt = new Date(Date.now() + PENDING_TTL_MS);

  const existingActive = await findActivePendingBySessionId(sessionId);
  if (existingActive) {
    await markActivePendingSuperseded(sessionId);
  }

  const pending = await createPendingTask({
    sessionId,
    memberId,
    actionType,
    payload,
    summary,
    expiresAt,
  });

  let superseded: PendingTaskDto | undefined;
  if (existingActive) {
    await linkSupersededPending(existingActive.pending_id, pending.pending_id);
    superseded = toPendingDto({ ...existingActive, status: 'superseded', superseded_by: pending.pending_id });
  }

  return { pending: toPendingDto(pending), ...(superseded ? { superseded } : {}) };
};

export const proposeCreateContribution = async (
  sessionId: number | undefined,
  memberId: number,
  isAdmin: boolean,
  rawPayload: unknown,
): Promise<ProposeResult> =>
  createPropose(requireSessionId(sessionId), memberId, isAdmin, 'create_contribution', rawPayload);

export const proposeCreateContributionsBatch = async (
  sessionId: number | undefined,
  memberId: number,
  isAdmin: boolean,
  rawPayload: unknown,
): Promise<ProposeResult> =>
  createPropose(requireSessionId(sessionId), memberId, isAdmin, 'create_contributions_batch', rawPayload);

export const proposeUpdateContribution = async (
  sessionId: number | undefined,
  memberId: number,
  isAdmin: boolean,
  rawPayload: unknown,
): Promise<ProposeResult> =>
  createPropose(requireSessionId(sessionId), memberId, isAdmin, 'update_contribution', rawPayload);

export const proposeDeleteContribution = async (
  sessionId: number | undefined,
  memberId: number,
  isAdmin: boolean,
  rawPayload: unknown,
): Promise<ProposeResult> =>
  createPropose(requireSessionId(sessionId), memberId, isAdmin, 'delete_contribution', rawPayload);

export const proposeCreateCause = async (
  sessionId: number | undefined,
  memberId: number,
  isAdmin: boolean,
  rawPayload: unknown,
): Promise<ProposeResult> =>
  createPropose(requireSessionId(sessionId), memberId, isAdmin, 'create_cause', rawPayload);

export const proposeUpdateCause = async (
  sessionId: number | undefined,
  memberId: number,
  isAdmin: boolean,
  rawPayload: unknown,
): Promise<ProposeResult> =>
  createPropose(requireSessionId(sessionId), memberId, isAdmin, 'update_cause', rawPayload);

export const proposeDeleteCause = async (
  sessionId: number | undefined,
  memberId: number,
  isAdmin: boolean,
  rawPayload: unknown,
): Promise<ProposeResult> =>
  createPropose(requireSessionId(sessionId), memberId, isAdmin, 'delete_cause', rawPayload);

export const proposeUpdateMember = async (
  sessionId: number | undefined,
  memberId: number,
  isAdmin: boolean,
  rawPayload: unknown,
): Promise<ProposeResult> =>
  createPropose(requireSessionId(sessionId), memberId, isAdmin, 'update_member', rawPayload);

export const proposePromoteMember = async (
  sessionId: number | undefined,
  memberId: number,
  isAdmin: boolean,
  rawPayload: unknown,
): Promise<ProposeResult> =>
  createPropose(requireSessionId(sessionId), memberId, isAdmin, 'promote_member', rawPayload);

export const proposeDeleteMember = async (
  sessionId: number | undefined,
  memberId: number,
  isAdmin: boolean,
  rawPayload: unknown,
): Promise<ProposeResult> =>
  createPropose(requireSessionId(sessionId), memberId, isAdmin, 'delete_member', rawPayload);

/**
 * Returns the active pending task for a session.
 */
export const getPendingTask = async (
  sessionId: number | undefined,
  isAdmin: boolean,
): Promise<PendingTaskDto | null> => {
  requireAdmin(isAdmin);
  const sid = requireSessionId(sessionId);
  await expireStalePendingForSession(sid);
  const active = await findActivePendingBySessionId(sid);
  return active ? toPendingDto(active) : null;
};

/**
 * Updates the payload of the active pending task and regenerates its summary.
 */
export const updatePendingTask = async (
  sessionId: number | undefined,
  memberId: number,
  isAdmin: boolean,
  patch: Record<string, unknown>,
): Promise<PendingTaskDto> => {
  requireAdmin(isAdmin);
  const sid = requireSessionId(sessionId);
  await expireStalePendingForSession(sid);

  const active = await findActivePendingBySessionId(sid);
  if (!active) {
    throw new HttpError('No active pending task for this session', 404);
  }
  if (active.member_id !== memberId) {
    throw new HttpError('Pending task ownership mismatch', 403);
  }

  const currentPayload =
    active.payload && typeof active.payload === 'object' ? (active.payload as Record<string, unknown>) : {};
  const mergedPayload = { ...currentPayload, ...patch };
  const payload = validatePendingPayload(active.action_type, mergedPayload);
  const summary = await buildSummary(active.action_type, payload);

  const updated = await updatePendingTaskRow(active.pending_id, { payload, summary, status: 'awaiting_confirmation' });
  return toPendingDto(updated);
};

/**
 * Cancels (rejects) the active pending task without executing it.
 */
export const cancelPendingTask = async (
  sessionId: number | undefined,
  memberId: number,
  isAdmin: boolean,
): Promise<PendingTaskDto> => {
  requireAdmin(isAdmin);
  const sid = requireSessionId(sessionId);
  await expireStalePendingForSession(sid);

  const active = await findActivePendingBySessionId(sid);
  if (!active) {
    throw new HttpError('No active pending task for this session', 404);
  }
  if (active.member_id !== memberId) {
    throw new HttpError('Pending task ownership mismatch', 403);
  }

  const updated = await updatePendingTaskRow(active.pending_id, { status: 'rejected' });
  return toPendingDto(updated);
};

/**
 * Checks whether a proposed cause amount can be disbursed from available funds.
 */
export const checkDisbursementFeasibility = async (
  amount: number,
  isAdmin: boolean,
): Promise<{ feasible: boolean; availableFunds: string; proposedAmount: number; shortfall?: string }> => {
  requireAdmin(isAdmin);
  const fundStatus = await getFundSummary();
  const available = Number.parseFloat(fundStatus.availablefunds);
  const feasible = amount <= available;
  return {
    feasible,
    availableFunds: fundStatus.availablefunds,
    proposedAmount: amount,
    ...(feasible ? {} : { shortfall: (amount - available).toFixed(2) }),
  };
};

/**
 * Returns active and recently superseded pending tasks for a session.
 */
export const getSessionPendingState = async (
  sessionId: number,
  memberId: number,
  isAdmin: boolean,
): Promise<SessionPendingState> => {
  requireAdmin(isAdmin);
  await expireStalePendingForSession(sessionId);
  const active = await findActivePendingBySessionId(sessionId);
  if (active && active.member_id !== memberId) {
    throw new HttpError('Session access denied', 403);
  }
  const superseded = await listRecentlySupersededBySessionId(sessionId);
  return {
    active: active ? toPendingDto(active) : null,
    recentlySuperseded: superseded.map((row) => ({
      pendingId: row.pending_id,
      summary: row.summary,
      supersededAt: row.updated_at,
    })),
  };
};

/**
 * Loads a pending task by ID, verifying session ownership.
 */
export const requirePendingTask = async (
  pendingId: number,
  sessionId: number,
  memberId: number,
): Promise<ChatPendingTaskRecord> => {
  const pending = await findPendingTaskById(pendingId);
  if (!pending || pending.session_id !== sessionId) {
    throw new HttpError('Pending task not found', 404);
  }
  if (pending.member_id !== memberId) {
    throw new HttpError('Pending task ownership mismatch', 403);
  }
  return pending;
};
