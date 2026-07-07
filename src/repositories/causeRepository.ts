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
  readonly createdat?: Date | undefined;
}

export interface CauseStatsRecord {
  readonly totalAmount: string;
  readonly count: number;
}

/**
 * Persists a cause and returns the stored database row.
 */
export const createCause = async (input: CreateCauseInput): Promise<CauseRecord> => {
  const columns: string[] = ['title', 'description', 'amount'];
  const values: unknown[] = [input.title, input.description ?? null, input.amount ?? null];
  if (input.createdat) {
    columns.push('createdat');
    values.push(input.createdat);
  }
  const placeholders = values.map((_, index) => `$${index + 1}`);
  const text = `
    INSERT INTO causes (${columns.join(', ')})
    VALUES (${placeholders.join(', ')})
    RETURNING causeid, title, description, amount, createdat;
  `;
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
  readonly createdat?: Date | undefined;
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
  if (input.createdat !== undefined) {
    updates.push(`createdat = $${paramIndex++}`);
    values.push(input.createdat);
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
 * Searches causes by keyword in title or description.
 */
export const searchCauses = async (queryText: string, limit = 20): Promise<CauseRecord[]> => {
  const text = `
    SELECT causeid, title, description, amount, createdat
    FROM causes
    WHERE title ILIKE $1 OR description ILIKE $1
    ORDER BY createdat DESC
    LIMIT $2;
  `;
  const result = await query<CauseRecord>(text, [`%${queryText}%`, limit]);
  return result.rows;
};

/**
 * Lists causes created within an optional date range, newest first.
 */
export const listCausesInDateRange = async (
  fromDate?: Date,
  toDate?: Date,
  limit = 20,
): Promise<CauseRecord[]> => {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (fromDate !== undefined) {
    conditions.push(`createdat >= $${paramIndex++}`);
    values.push(fromDate);
  }
  if (toDate !== undefined) {
    conditions.push(`createdat <= $${paramIndex++}`);
    values.push(toDate);
  }
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  values.push(limit);
  const text = `
    SELECT causeid, title, description, amount, createdat
    FROM causes
    ${whereClause}
    ORDER BY createdat DESC
    LIMIT $${paramIndex};
  `;
  const result = await query<CauseRecord>(text, values);
  return result.rows;
};

/**
 * Aggregates cause totals and count within an optional date range.
 */
export const getCauseStats = async (
  options: { fromDate?: Date | undefined; toDate?: Date | undefined } = {},
): Promise<CauseStatsRecord> => {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (options.fromDate !== undefined) {
    conditions.push(`createdat >= $${paramIndex++}`);
    values.push(options.fromDate);
  }
  if (options.toDate !== undefined) {
    conditions.push(`createdat <= $${paramIndex++}`);
    values.push(options.toDate);
  }
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const text = `
    SELECT COALESCE(SUM(amount), 0)::text AS "totalAmount", COUNT(*)::int AS count
    FROM causes
    ${whereClause};
  `;
  const result = await query<CauseStatsRecord>(text, values);
  return result.rows[0] ?? { totalAmount: '0', count: 0 };
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
