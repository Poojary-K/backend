import type { QueryResult } from 'pg';
import { query } from '../config/database.js';

export interface CauseRecord {
  readonly causeid: number;
  readonly title: string;
  readonly description: string | null;
  readonly amount: string | null;
  readonly createdat: Date;
}

export interface CreateCauseInput {
  readonly title: string;
  readonly description?: string | undefined;
  readonly amount?: number | undefined;
}

/**
 * Persists a cause and returns the stored database row.
 */
export const createCause = async (input: CreateCauseInput): Promise<CauseRecord> => {
  const text = `
    INSERT INTO causes (title, description, amount)
    VALUES ($1, $2, $3)
    RETURNING causeid, title, description, amount, createdat;
  `;
  const values = [input.title, input.description ?? null, input.amount ?? null];
  const result = await query<CauseRecord>(text, values);
  const row = result.rows[0];
  if (!row) {
    throw new Error('Failed to create cause');
  }
  return row;
};

/**
 * Retrieves all causes ordered by creation timestamp.
 */
export const listCauses = async (): Promise<CauseRecord[]> => {
  const text = `
    SELECT causeid, title, description, amount, createdat
    FROM causes
    ORDER BY createdat DESC;
  `;
  const result: QueryResult<CauseRecord> = await query<CauseRecord>(text);
  return result.rows;
};

