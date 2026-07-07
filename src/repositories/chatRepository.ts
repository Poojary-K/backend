import type { QueryResult } from 'pg';
import { query } from '../config/database.js';

export interface ChatSessionRecord {
  readonly session_id: number;
  readonly member_id: number;
  readonly title: string;
  readonly created_at: Date;
  readonly updated_at: Date;
  readonly archived_at: Date | null;
}

export interface ChatMessageRecord {
  readonly message_id: number;
  readonly session_id: number;
  readonly role: 'user' | 'assistant' | 'tool';
  readonly content: string;
  readonly tool_calls: unknown | null;
  readonly tool_name: string | null;
  readonly tool_call_id: string | null;
  readonly created_at: Date;
}

export interface CreateMessageInput {
  readonly sessionId: number;
  readonly role: 'user' | 'assistant' | 'tool';
  readonly content: string;
  readonly toolCalls?: unknown | undefined;
  readonly toolName?: string | undefined;
  readonly toolCallId?: string | undefined;
}

const SESSION_COLUMNS = 'session_id, member_id, title, created_at, updated_at, archived_at';
const MESSAGE_COLUMNS = 'message_id, session_id, role, content, tool_calls, tool_name, tool_call_id, created_at';

/**
 * Creates a new chat session for a member.
 */
export const createSession = async (memberId: number, title?: string): Promise<ChatSessionRecord> => {
  const text = `
    INSERT INTO chat_sessions (member_id, title)
    VALUES ($1, COALESCE($2, 'New chat'))
    RETURNING ${SESSION_COLUMNS};
  `;
  const result = await query<ChatSessionRecord>(text, [memberId, title ?? null]);
  const row = result.rows[0];
  if (!row) {
    throw new Error('Failed to create chat session');
  }
  return row;
};

/**
 * Retrieves a chat session by ID (including archived).
 */
export const findSessionById = async (sessionId: number): Promise<ChatSessionRecord | null> => {
  const text = `SELECT ${SESSION_COLUMNS} FROM chat_sessions WHERE session_id = $1 LIMIT 1;`;
  const result = await query<ChatSessionRecord>(text, [sessionId]);
  return result.rows[0] ?? null;
};

/**
 * Lists a member's non-archived sessions, newest updated first.
 */
export const listSessionsByMember = async (memberId: number, limit = 50): Promise<ChatSessionRecord[]> => {
  const text = `
    SELECT ${SESSION_COLUMNS}
    FROM chat_sessions
    WHERE member_id = $1 AND archived_at IS NULL
    ORDER BY updated_at DESC
    LIMIT $2;
  `;
  const result: QueryResult<ChatSessionRecord> = await query<ChatSessionRecord>(text, [memberId, limit]);
  return result.rows;
};

/**
 * Hard-deletes a session and its messages (cascade), verifying ownership.
 */
export const deleteSession = async (sessionId: number, memberId: number): Promise<void> => {
  const text = `DELETE FROM chat_sessions WHERE session_id = $1 AND member_id = $2;`;
  const result = await query(text, [sessionId, memberId]);
  if (result.rowCount === 0) {
    throw new Error('Chat session not found');
  }
};

/**
 * Updates a session's title.
 */
export const updateSessionTitle = async (sessionId: number, title: string): Promise<void> => {
  const text = `UPDATE chat_sessions SET title = $2 WHERE session_id = $1;`;
  await query(text, [sessionId, title]);
};

/**
 * Bumps a session's updated_at timestamp.
 */
export const touchSession = async (sessionId: number): Promise<void> => {
  const text = `UPDATE chat_sessions SET updated_at = current_timestamp WHERE session_id = $1;`;
  await query(text, [sessionId]);
};

/**
 * Persists a single chat message row.
 */
export const createMessage = async (input: CreateMessageInput): Promise<ChatMessageRecord> => {
  const text = `
    INSERT INTO chat_messages (session_id, role, content, tool_calls, tool_name, tool_call_id)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING ${MESSAGE_COLUMNS};
  `;
  const values = [
    input.sessionId,
    input.role,
    input.content,
    input.toolCalls === undefined ? null : JSON.stringify(input.toolCalls),
    input.toolName ?? null,
    input.toolCallId ?? null,
  ];
  const result = await query<ChatMessageRecord>(text, values);
  const row = result.rows[0];
  if (!row) {
    throw new Error('Failed to create chat message');
  }
  return row;
};

/**
 * Lists messages for a session in chronological order.
 */
export const listMessagesBySession = async (sessionId: number, limit = 200): Promise<ChatMessageRecord[]> => {
  const text = `
    SELECT ${MESSAGE_COLUMNS}
    FROM chat_messages
    WHERE session_id = $1
    ORDER BY created_at ASC, message_id ASC
    LIMIT $2;
  `;
  const result: QueryResult<ChatMessageRecord> = await query<ChatMessageRecord>(text, [sessionId, limit]);
  return result.rows;
};

/**
 * Lists the most recent messages for a session (chronological order), for LLM context.
 */
export const listRecentMessagesBySession = async (
  sessionId: number,
  limit: number,
): Promise<ChatMessageRecord[]> => {
  const text = `
    SELECT ${MESSAGE_COLUMNS}
    FROM (
      SELECT ${MESSAGE_COLUMNS}
      FROM chat_messages
      WHERE session_id = $1
      ORDER BY created_at DESC, message_id DESC
      LIMIT $2
    ) recent
    ORDER BY created_at ASC, message_id ASC;
  `;
  const result: QueryResult<ChatMessageRecord> = await query<ChatMessageRecord>(text, [sessionId, limit]);
  return result.rows;
};
