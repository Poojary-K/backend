import type { PoolClient, QueryResult } from 'pg';
import { query } from '../config/database.js';

export interface MemberRecord {
  readonly memberid: number;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly password: string;
  readonly joinedon: Date;
  readonly is_admin: boolean;
  readonly email_verified: boolean;
  readonly email_verified_at: Date | null;
  readonly email_verification_token_hash: string | null;
  readonly email_verification_expires_at: Date | null;
  readonly email_verification_sent_at: Date | null;
}

export interface CreateMemberInput {
  readonly name: string;
  readonly email?: string | undefined;
  readonly phone?: string | undefined;
  readonly password: string;
  readonly is_admin?: boolean | undefined;
}

/**
 * Persists a member and returns the full row from the database.
 */
export const createMember = async (input: CreateMemberInput): Promise<MemberRecord> => {
  const text = `
    INSERT INTO members (name, email, phone, password, is_admin)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING memberid, name, email, phone, password, joinedon, is_admin,
      email_verified, email_verified_at, email_verification_token_hash,
      email_verification_expires_at, email_verification_sent_at;
  `;
  const values = [input.name, input.email ?? null, input.phone ?? null, input.password, input.is_admin ?? false];
  const result = await query<MemberRecord>(text, values);
  const row = result.rows[0];
  if (!row) {
    throw new Error('Failed to create member');
  }
  return row;
};

/**
 * Retrieves a member by unique email address.
 */
export const findMemberByEmail = async (email: string): Promise<MemberRecord | null> => {
  const text = `
    SELECT memberid, name, email, phone, password, joinedon, is_admin,
      email_verified, email_verified_at, email_verification_token_hash,
      email_verification_expires_at, email_verification_sent_at
    FROM members
    WHERE email = $1
    LIMIT 1;
  `;
  const result = await query<MemberRecord>(text, [email]);
  return result.rows.at(0) ?? null;
};

/**
 * Retrieves a member by ID.
 */
export const findMemberById = async (id: number): Promise<MemberRecord | null> => {
  const text = `
    SELECT memberid, name, email, phone, password, joinedon, is_admin,
      email_verified, email_verified_at, email_verification_token_hash,
      email_verification_expires_at, email_verification_sent_at
    FROM members
    WHERE memberid = $1
    LIMIT 1;
  `;
  const result = await query<MemberRecord>(text, [id]);
  return result.rows.at(0) ?? null;
};

/**
 * Fetches all members ordered by join date.
 */
export const listMembers = async (): Promise<MemberRecord[]> => {
  const text = `
    SELECT memberid, name, email, phone, password, joinedon, is_admin,
      email_verified, email_verified_at, email_verification_token_hash,
      email_verification_expires_at, email_verification_sent_at
    FROM members
    ORDER BY joinedon DESC;
  `;
  const result: QueryResult<MemberRecord> = await query<MemberRecord>(text);
  return result.rows;
};

/**
 * Updates a member's admin status.
 */
export const updateMemberAdminStatus = async (id: number, isAdmin: boolean): Promise<MemberRecord> => {
  const text = `
    UPDATE members
    SET is_admin = $1
    WHERE memberid = $2
    RETURNING memberid, name, email, phone, password, joinedon, is_admin,
      email_verified, email_verified_at, email_verification_token_hash,
      email_verification_expires_at, email_verification_sent_at;
  `;
  const result = await query<MemberRecord>(text, [isAdmin, id]);
  const row = result.rows[0];
  if (!row) {
    throw new Error('Failed to update member admin status');
  }
  return row;
};

export interface UpdateMemberInput {
  readonly name?: string | undefined;
  readonly email?: string | undefined;
  readonly phone?: string | undefined;
  readonly is_admin?: boolean | undefined;
}

/**
 * Updates a member and returns the updated record.
 */
export const updateMember = async (id: number, input: UpdateMemberInput): Promise<MemberRecord> => {
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (input.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(input.name);
  }
  if (input.email !== undefined) {
    updates.push(`email = $${paramIndex++}`);
    values.push(input.email);
  }
  if (input.phone !== undefined) {
    updates.push(`phone = $${paramIndex++}`);
    values.push(input.phone);
  }
  if (input.is_admin !== undefined) {
    updates.push(`is_admin = $${paramIndex++}`);
    values.push(input.is_admin);
  }

  if (updates.length === 0) {
    // No updates, just return the existing record
    const existing = await findMemberById(id);
    if (!existing) {
      throw new Error('Member not found');
    }
    return existing;
  }

  values.push(id);
  const text = `
    UPDATE members
    SET ${updates.join(', ')}
    WHERE memberid = $${paramIndex}
    RETURNING memberid, name, email, phone, password, joinedon, is_admin,
      email_verified, email_verified_at, email_verification_token_hash,
      email_verification_expires_at, email_verification_sent_at;
  `;
  const result = await query<MemberRecord>(text, values);
  const row = result.rows[0];
  if (!row) {
    throw new Error('Member not found');
  }
  return row;
};

/**
 * Deletes a member by ID.
 */
export const deleteMember = async (id: number): Promise<void> => {
  const text = `DELETE FROM members WHERE memberid = $1;`;
  const result = await query(text, [id]);
  if (result.rowCount === 0) {
    throw new Error('Member not found');
  }
};

/**
 * Finds a member by email verification token hash.
 */
export const findMemberByVerificationTokenHash = async (tokenHash: string): Promise<MemberRecord | null> => {
  const text = `
    SELECT memberid, name, email, phone, password, joinedon, is_admin,
      email_verified, email_verified_at, email_verification_token_hash,
      email_verification_expires_at, email_verification_sent_at
    FROM members
    WHERE email_verification_token_hash = $1
    LIMIT 1;
  `;
  const result = await query<MemberRecord>(text, [tokenHash]);
  return result.rows.at(0) ?? null;
};

/**
 * Stores a new email verification token for a member.
 */
export const setEmailVerificationToken = async (
  memberId: number,
  tokenHash: string,
  expiresAt: Date,
  sentAt: Date,
): Promise<MemberRecord> => {
  const text = `
    UPDATE members
    SET email_verification_token_hash = $1,
        email_verification_expires_at = $2,
        email_verification_sent_at = $3,
        email_verified = FALSE,
        email_verified_at = NULL
    WHERE memberid = $4
    RETURNING memberid, name, email, phone, password, joinedon, is_admin,
      email_verified, email_verified_at, email_verification_token_hash,
      email_verification_expires_at, email_verification_sent_at;
  `;
  const result = await query<MemberRecord>(text, [tokenHash, expiresAt, sentAt, memberId]);
  const row = result.rows[0];
  if (!row) {
    throw new Error('Failed to update member verification token');
  }
  return row;
};

/**
 * Marks a member's email as verified and clears verification fields.
 */
export const markEmailVerified = async (memberId: number): Promise<MemberRecord> => {
  const text = `
    UPDATE members
    SET email_verified = TRUE,
        email_verified_at = NOW(),
        email_verification_token_hash = NULL,
        email_verification_expires_at = NULL,
        email_verification_sent_at = NULL
    WHERE memberid = $1
    RETURNING memberid, name, email, phone, password, joinedon, is_admin,
      email_verified, email_verified_at, email_verification_token_hash,
      email_verification_expires_at, email_verification_sent_at;
  `;
  const result = await query<MemberRecord>(text, [memberId]);
  const row = result.rows[0];
  if (!row) {
    throw new Error('Failed to mark email verified');
  }
  return row;
};

/**
 * Updates a member password hash.
 */
export const updateMemberPassword = async (
  memberId: number,
  passwordHash: string,
  client?: PoolClient,
): Promise<MemberRecord> => {
  const text = `
    UPDATE members
    SET password = $1
    WHERE memberid = $2
    RETURNING memberid, name, email, phone, password, joinedon, is_admin,
      email_verified, email_verified_at, email_verification_token_hash,
      email_verification_expires_at, email_verification_sent_at;
  `;
  const result = client
    ? await client.query<MemberRecord>(text, [passwordHash, memberId])
    : await query<MemberRecord>(text, [passwordHash, memberId]);
  const row = result.rows[0];
  if (!row) {
    throw new Error('Member not found');
  }
  return row;
};
