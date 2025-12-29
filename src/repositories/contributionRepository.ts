import type { QueryResult } from 'pg';
import { query } from '../config/database.js';

export interface ContributionRecord {
  readonly contributionid: number;
  readonly memberid: number;
  readonly amount: string;
  readonly contributeddate: Date;
  readonly createdat: Date;
}

export interface CreateContributionInput {
  readonly memberId: number;
  readonly amount: number;
  readonly contributedDate: Date;
}

/**
 * Saves a contribution for a member and returns the stored record.
 */
export const createContribution = async (input: CreateContributionInput): Promise<ContributionRecord> => {
  const text = `
    INSERT INTO contributions (memberid, amount, contributeddate)
    VALUES ($1, $2, $3)
    RETURNING contributionid, memberid, amount, contributeddate, createdat;
  `;
  const values = [input.memberId, input.amount, input.contributedDate];
  const result = await query<ContributionRecord>(text, values);
  const row = result.rows[0];
  if (!row) {
    throw new Error('Failed to create contribution');
  }
  return row;
};

/**
 * Lists contributions ordered from newest to oldest.
 */
export const listContributions = async (): Promise<ContributionRecord[]> => {
  const text = `
    SELECT contributionid, memberid, amount, contributeddate, createdat
    FROM contributions
    ORDER BY contributeddate DESC, createdat DESC;
  `;
  const result: QueryResult<ContributionRecord> = await query<ContributionRecord>(text);
  return result.rows;
};

/**
 * Retrieves a contribution by ID.
 */
export const findContributionById = async (id: number): Promise<ContributionRecord | null> => {
  const text = `
    SELECT contributionid, memberid, amount, contributeddate, createdat
    FROM contributions
    WHERE contributionid = $1
    LIMIT 1;
  `;
  const result = await query<ContributionRecord>(text, [id]);
  return result.rows[0] ?? null;
};

export interface UpdateContributionInput {
  readonly memberId?: number | undefined;
  readonly amount?: number | undefined;
  readonly contributedDate?: Date | undefined;
}

/**
 * Updates a contribution and returns the updated record.
 */
export const updateContribution = async (id: number, input: UpdateContributionInput): Promise<ContributionRecord> => {
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (input.memberId !== undefined) {
    updates.push(`memberid = $${paramIndex++}`);
    values.push(input.memberId);
  }
  if (input.amount !== undefined) {
    updates.push(`amount = $${paramIndex++}`);
    values.push(input.amount);
  }
  if (input.contributedDate !== undefined) {
    updates.push(`contributeddate = $${paramIndex++}`);
    values.push(input.contributedDate);
  }

  if (updates.length === 0) {
    // No updates, just return the existing record
    const existing = await findContributionById(id);
    if (!existing) {
      throw new Error('Contribution not found');
    }
    return existing;
  }

  values.push(id);
  const text = `
    UPDATE contributions
    SET ${updates.join(', ')}
    WHERE contributionid = $${paramIndex}
    RETURNING contributionid, memberid, amount, contributeddate, createdat;
  `;
  const result = await query<ContributionRecord>(text, values);
  const row = result.rows[0];
  if (!row) {
    throw new Error('Contribution not found');
  }
  return row;
};

/**
 * Deletes a contribution by ID.
 */
export const deleteContribution = async (id: number): Promise<void> => {
  const text = `DELETE FROM contributions WHERE contributionid = $1;`;
  const result = await query(text, [id]);
  if (result.rowCount === 0) {
    throw new Error('Contribution not found');
  }
};


