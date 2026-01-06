import type { PoolClient, QueryResultRow } from 'pg';
import { query } from '../config/database.js';

export interface PasswordResetTokenRecord extends QueryResultRow {
  readonly tokenid: number;
  readonly memberid: number;
  readonly token_hash: string;
  readonly expires_at: Date;
  readonly used_at: Date | null;
  readonly created_at: Date;
}

const tokenColumns = `
  tokenid,
  memberid,
  token_hash,
  expires_at,
  used_at,
  created_at
`;

const runQuery = async <T extends QueryResultRow>(
  client: PoolClient | undefined,
  text: string,
  params: unknown[],
): Promise<{ rows: T[] }> => {
  if (client) {
    return client.query<T>(text, params);
  }
  return query<T>(text, params);
};

/**
 * Creates a new password reset token row for a member.
 */
export const createPasswordResetToken = async (
  memberId: number,
  tokenHash: string,
  expiresAt: Date,
): Promise<PasswordResetTokenRecord> => {
  const text = `
    INSERT INTO password_reset_tokens (memberid, token_hash, expires_at)
    VALUES ($1, $2, $3)
    RETURNING ${tokenColumns};
  `;
  const result = await query<PasswordResetTokenRecord>(text, [memberId, tokenHash, expiresAt]);
  const row = result.rows[0];
  if (!row) {
    throw new Error('Failed to create password reset token');
  }
  return row;
};

/**
 * Locks and returns a password reset token row for a transaction.
 */
export const findPasswordResetTokenForUpdate = async (
  tokenHash: string,
  client: PoolClient,
): Promise<PasswordResetTokenRecord | null> => {
  const text = `
    SELECT ${tokenColumns}
    FROM password_reset_tokens
    WHERE token_hash = $1
    LIMIT 1
    FOR UPDATE;
  `;
  const result = await client.query<PasswordResetTokenRecord>(text, [tokenHash]);
  return result.rows.at(0) ?? null;
};

/**
 * Marks all active reset tokens for a member as used.
 */
export const markPasswordResetTokensUsedByMember = async (
  memberId: number,
  usedAt: Date,
  client?: PoolClient,
): Promise<void> => {
  const text = `
    UPDATE password_reset_tokens
    SET used_at = $1
    WHERE memberid = $2
      AND used_at IS NULL;
  `;
  await runQuery(client, text, [usedAt, memberId]);
};
