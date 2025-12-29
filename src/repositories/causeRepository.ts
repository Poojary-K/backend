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

/**
 * Retrieves a cause by ID.
 */
export const findCauseById = async (id: number): Promise<CauseRecord | null> => {
  const text = `
    SELECT causeid, title, description, amount, createdat
    FROM causes
    WHERE causeid = $1
    LIMIT 1;
  `;
  const result = await query<CauseRecord>(text, [id]);
  return result.rows[0] ?? null;
};

export interface UpdateCauseInput {
  readonly title?: string | undefined;
  readonly description?: string | undefined;
  readonly amount?: number | undefined;
}

/**
 * Updates a cause and returns the updated record.
 */
export const updateCause = async (id: number, input: UpdateCauseInput): Promise<CauseRecord> => {
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (input.title !== undefined) {
    updates.push(`title = $${paramIndex++}`);
    values.push(input.title);
  }
  if (input.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(input.description);
  }
  if (input.amount !== undefined) {
    updates.push(`amount = $${paramIndex++}`);
    values.push(input.amount);
  }

  if (updates.length === 0) {
    // No updates, just return the existing record
    const existing = await findCauseById(id);
    if (!existing) {
      throw new Error('Cause not found');
    }
    return existing;
  }

  values.push(id);
  const text = `
    UPDATE causes
    SET ${updates.join(', ')}
    WHERE causeid = $${paramIndex}
    RETURNING causeid, title, description, amount, createdat;
  `;
  const result = await query<CauseRecord>(text, values);
  const row = result.rows[0];
  if (!row) {
    throw new Error('Cause not found');
  }
  return row;
};

/**
 * Deletes a cause by ID.
 */
export const deleteCause = async (id: number): Promise<void> => {
  const text = `DELETE FROM causes WHERE causeid = $1;`;
  const result = await query(text, [id]);
  if (result.rowCount === 0) {
    throw new Error('Cause not found');
  }
};

