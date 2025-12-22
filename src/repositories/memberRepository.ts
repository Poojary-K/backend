import type { QueryResult } from 'pg';
import { query } from '../config/database.js';

export interface MemberRecord {
  readonly memberid: number;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly password: string;
  readonly joinedon: Date;
  readonly is_admin: boolean;
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
    RETURNING memberid, name, email, phone, password, joinedon, is_admin;
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
  const text = `SELECT memberid, name, email, phone, password, joinedon, is_admin FROM members WHERE email = $1 LIMIT 1;`;
  const result = await query<MemberRecord>(text, [email]);
  return result.rows.at(0) ?? null;
};

/**
 * Retrieves a member by ID.
 */
export const findMemberById = async (id: number): Promise<MemberRecord | null> => {
  const text = `SELECT memberid, name, email, phone, password, joinedon, is_admin FROM members WHERE memberid = $1 LIMIT 1;`;
  const result = await query<MemberRecord>(text, [id]);
  return result.rows.at(0) ?? null;
};

/**
 * Fetches all members ordered by join date.
 */
export const listMembers = async (): Promise<MemberRecord[]> => {
  const text = `SELECT memberid, name, email, phone, password, joinedon, is_admin FROM members ORDER BY joinedon DESC;`;
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
    RETURNING memberid, name, email, phone, password, joinedon, is_admin;
  `;
  const result = await query<MemberRecord>(text, [isAdmin, id]);
  const row = result.rows[0];
  if (!row) {
    throw new Error('Failed to update member admin status');
  }
  return row;
};

