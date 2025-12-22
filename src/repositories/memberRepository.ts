import type { QueryResult } from 'pg';
import { query } from '../config/database.js';

export interface MemberRecord {
  readonly memberid: number;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly password: string;
  readonly joinedon: Date;
}

export interface CreateMemberInput {
  readonly name: string;
  readonly email?: string | undefined;
  readonly phone?: string | undefined;
  readonly password: string;
}

/**
 * Persists a member and returns the full row from the database.
 */
export const createMember = async (input: CreateMemberInput): Promise<MemberRecord> => {
  const text = `
    INSERT INTO members (name, email, phone, password)
    VALUES ($1, $2, $3, $4)
    RETURNING memberid, name, email, phone, password, joinedon;
  `;
  const values = [input.name, input.email ?? null, input.phone ?? null, input.password];
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
  const text = `SELECT memberid, name, email, phone, password, joinedon FROM members WHERE email = $1 LIMIT 1;`;
  const result = await query<MemberRecord>(text, [email]);
  return result.rows.at(0) ?? null;
};

/**
 * Retrieves a member by ID.
 */
export const findMemberById = async (id: number): Promise<MemberRecord | null> => {
  const text = `SELECT memberid, name, email, phone, password, joinedon FROM members WHERE memberid = $1 LIMIT 1;`;
  const result = await query<MemberRecord>(text, [id]);
  return result.rows.at(0) ?? null;
};

/**
 * Fetches all members ordered by join date.
 */
export const listMembers = async (): Promise<MemberRecord[]> => {
  const text = `SELECT memberid, name, email, phone, password, joinedon FROM members ORDER BY joinedon DESC;`;
  const result: QueryResult<MemberRecord> = await query<MemberRecord>(text);
  return result.rows;
};

