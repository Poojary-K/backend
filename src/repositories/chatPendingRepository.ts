import type { QueryResult } from 'pg';
import { query } from '../config/database.js';
import type { PendingActionType, PendingStatus } from '../schemas/chatPendingSchemas.js';

export interface ChatPendingTaskRecord {
  readonly pending_id: number;
  readonly session_id: number;
  readonly member_id: number;
  readonly action_type: PendingActionType;
  readonly payload: unknown;
  readonly summary: string;
  readonly status: PendingStatus;
  readonly expires_at: Date;
  readonly executed_at: Date | null;
  readonly result: unknown | null;
  readonly superseded_by: number | null;
  readonly created_at: Date;
  readonly updated_at: Date;
}

export interface CreatePendingTaskInput {
  readonly sessionId: number;
  readonly memberId: number;
  readonly actionType: PendingActionType;
  readonly payload: unknown;
  readonly summary: string;
  readonly expiresAt: Date;
}

const PENDING_COLUMNS =
  'pending_id, session_id, member_id, action_type, payload, summary, status, expires_at, executed_at, result, superseded_by, created_at, updated_at';

/**
 * Inserts a new pending task row.
 */
export const createPendingTask = async (input: CreatePendingTaskInput): Promise<ChatPendingTaskRecord> => {
  const text = `
    INSERT INTO chat_pending_tasks (session_id, member_id, action_type, payload, summary, expires_at)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING ${PENDING_COLUMNS};
  `;
  const values = [
    input.sessionId,
    input.memberId,
    input.actionType,
    JSON.stringify(input.payload),
    input.summary,
    input.expiresAt,
  ];
  const result = await query<ChatPendingTaskRecord>(text, values);
  const row = result.rows[0];
  if (!row) {
    throw new Error('Failed to create pending task');
  }
  return row;
};

/**
 * Finds a pending task by ID.
 */
export const findPendingTaskById = async (pendingId: number): Promise<ChatPendingTaskRecord | null> => {
  const text = `SELECT ${PENDING_COLUMNS} FROM chat_pending_tasks WHERE pending_id = $1 LIMIT 1;`;
  const result = await query<ChatPendingTaskRecord>(text, [pendingId]);
  return result.rows[0] ?? null;
};

/**
 * Returns the active (awaiting_confirmation, not expired) pending task for a session.
 */
export const findActivePendingBySessionId = async (sessionId: number): Promise<ChatPendingTaskRecord | null> => {
  const text = `
    SELECT ${PENDING_COLUMNS}
    FROM chat_pending_tasks
    WHERE session_id = $1
      AND status = 'awaiting_confirmation'
      AND expires_at > current_timestamp
    LIMIT 1;
  `;
  const result = await query<ChatPendingTaskRecord>(text, [sessionId]);
  return result.rows[0] ?? null;
};

/**
 * Marks expired awaiting_confirmation tasks as expired for a session.
 */
export const expireStalePendingForSession = async (sessionId: number): Promise<void> => {
  const text = `
    UPDATE chat_pending_tasks
    SET status = 'expired', updated_at = current_timestamp
    WHERE session_id = $1
      AND status = 'awaiting_confirmation'
      AND expires_at <= current_timestamp;
  `;
  await query(text, [sessionId]);
};

/**
 * Marks the active pending task as superseded, freeing the unique session slot for a new pending row.
 */
export const markActivePendingSuperseded = async (sessionId: number): Promise<ChatPendingTaskRecord | null> => {
  const text = `
    UPDATE chat_pending_tasks
    SET status = 'superseded', updated_at = current_timestamp
    WHERE session_id = $1
      AND status = 'awaiting_confirmation'
      AND expires_at > current_timestamp
    RETURNING ${PENDING_COLUMNS};
  `;
  const result = await query<ChatPendingTaskRecord>(text, [sessionId]);
  return result.rows[0] ?? null;
};

/**
 * Sets superseded_by on a previously superseded pending task.
 */
export const linkSupersededPending = async (oldPendingId: number, newPendingId: number): Promise<void> => {
  const text = `
    UPDATE chat_pending_tasks
    SET superseded_by = $2, updated_at = current_timestamp
    WHERE pending_id = $1;
  `;
  await query(text, [oldPendingId, newPendingId]);
};

/**
 * Marks the current active pending task as superseded by a new pending task.
 * @deprecated Prefer markActivePendingSuperseded before insert, then linkSupersededPending.
 */
export const supersedeActivePending = async (sessionId: number, newPendingId: number): Promise<ChatPendingTaskRecord | null> => {
  const text = `
    UPDATE chat_pending_tasks
    SET status = 'superseded', superseded_by = $2, updated_at = current_timestamp
    WHERE session_id = $1
      AND status = 'awaiting_confirmation'
      AND expires_at > current_timestamp
    RETURNING ${PENDING_COLUMNS};
  `;
  const result = await query<ChatPendingTaskRecord>(text, [sessionId, newPendingId]);
  return result.rows[0] ?? null;
};

export interface UpdatePendingTaskInput {
  readonly payload?: unknown;
  readonly summary?: string;
  readonly status?: PendingStatus;
  readonly result?: unknown;
  readonly executedAt?: Date;
  readonly supersededBy?: number;
}

/**
 * Updates a pending task row.
 */
export const updatePendingTask = async (
  pendingId: number,
  input: UpdatePendingTaskInput,
): Promise<ChatPendingTaskRecord> => {
  const updates: string[] = ['updated_at = current_timestamp'];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (input.payload !== undefined) {
    updates.push(`payload = $${paramIndex++}`);
    values.push(JSON.stringify(input.payload));
  }
  if (input.summary !== undefined) {
    updates.push(`summary = $${paramIndex++}`);
    values.push(input.summary);
  }
  if (input.status !== undefined) {
    updates.push(`status = $${paramIndex++}`);
    values.push(input.status);
  }
  if (input.result !== undefined) {
    updates.push(`result = $${paramIndex++}`);
    values.push(JSON.stringify(input.result));
  }
  if (input.executedAt !== undefined) {
    updates.push(`executed_at = $${paramIndex++}`);
    values.push(input.executedAt);
  }
  if (input.supersededBy !== undefined) {
    updates.push(`superseded_by = $${paramIndex++}`);
    values.push(input.supersededBy);
  }

  values.push(pendingId);
  const text = `
    UPDATE chat_pending_tasks
    SET ${updates.join(', ')}
    WHERE pending_id = $${paramIndex}
    RETURNING ${PENDING_COLUMNS};
  `;
  const result = await query<ChatPendingTaskRecord>(text, values);
  const row = result.rows[0];
  if (!row) {
    throw new Error('Pending task not found');
  }
  return row;
};

/**
 * Lists recently superseded pending tasks for a session (for UI/audit).
 */
export const listRecentlySupersededBySessionId = async (
  sessionId: number,
  limit = 3,
): Promise<ChatPendingTaskRecord[]> => {
  const text = `
    SELECT ${PENDING_COLUMNS}
    FROM chat_pending_tasks
    WHERE session_id = $1 AND status = 'superseded'
    ORDER BY updated_at DESC
    LIMIT $2;
  `;
  const result: QueryResult<ChatPendingTaskRecord> = await query<ChatPendingTaskRecord>(text, [sessionId, limit]);
  return result.rows;
};
