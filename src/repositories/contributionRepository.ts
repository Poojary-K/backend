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

export interface ContributionWithMemberRecord extends ContributionRecord {
  readonly member_name: string;
}

export interface ContributionStatsRecord {
  readonly totalAmount: string;
  readonly count: number;
  readonly topContributors: Array<{
    readonly memberId: number;
    readonly memberName: string;
    readonly totalAmount: string;
  }>;
}

export interface ListContributionsFilter {
  readonly memberId?: number | undefined;
  readonly fromDate?: Date | undefined;
  readonly toDate?: Date | undefined;
  readonly limit?: number | undefined;
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
 * Lists a single member's contributions, newest first.
 */
export const listContributionsByMemberId = async (
  memberId: number,
  limit = 20,
): Promise<ContributionRecord[]> => {
  const text = `
    SELECT contributionid, memberid, amount, contributeddate, createdat
    FROM contributions
    WHERE memberid = $1
    ORDER BY contributeddate DESC, createdat DESC
    LIMIT $2;
  `;
  const result = await query<ContributionRecord>(text, [memberId, limit]);
  return result.rows;
};

/**
 * Returns the total amount a member has contributed (as a numeric string).
 */
export const sumContributionsByMemberId = async (memberId: number): Promise<string> => {
  const text = `SELECT COALESCE(SUM(amount), 0)::text AS total FROM contributions WHERE memberid = $1;`;
  const result = await query<{ total: string }>(text, [memberId]);
  return result.rows[0]?.total ?? '0';
};

/**
 * Lists contributions joined with member names, with optional filters.
 */
export const listContributionsWithMemberNames = async (
  options: ListContributionsFilter = {},
): Promise<ContributionWithMemberRecord[]> => {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (options.memberId !== undefined) {
    conditions.push(`c.memberid = $${paramIndex++}`);
    values.push(options.memberId);
  }
  if (options.fromDate !== undefined) {
    conditions.push(`c.contributeddate >= $${paramIndex++}`);
    values.push(options.fromDate);
  }
  if (options.toDate !== undefined) {
    conditions.push(`c.contributeddate <= $${paramIndex++}`);
    values.push(options.toDate);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  values.push(options.limit ?? 20);
  const text = `
    SELECT c.contributionid, c.memberid, m.name AS member_name, c.amount, c.contributeddate, c.createdat
    FROM contributions c
    JOIN members m ON m.memberid = c.memberid
    ${whereClause}
    ORDER BY c.contributeddate DESC, c.createdat DESC
    LIMIT $${paramIndex};
  `;
  const result = await query<ContributionWithMemberRecord>(text, values);
  return result.rows;
};

/**
 * Aggregates contribution totals, count, and top contributors within an optional date range.
 */
export const getContributionStats = async (
  options: { fromDate?: Date | undefined; toDate?: Date | undefined } = {},
): Promise<ContributionStatsRecord> => {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (options.fromDate !== undefined) {
    conditions.push(`contributeddate >= $${paramIndex++}`);
    values.push(options.fromDate);
  }
  if (options.toDate !== undefined) {
    conditions.push(`contributeddate <= $${paramIndex++}`);
    values.push(options.toDate);
  }
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const totalsText = `
    SELECT COALESCE(SUM(amount), 0)::text AS "totalAmount", COUNT(*)::int AS count
    FROM contributions
    ${whereClause};
  `;
  const topText = `
    SELECT c.memberid AS "memberId", m.name AS "memberName", SUM(c.amount)::text AS "totalAmount"
    FROM contributions c
    JOIN members m ON m.memberid = c.memberid
    ${whereClause ? whereClause.replace(/contributeddate/g, 'c.contributeddate') : ''}
    GROUP BY c.memberid, m.name
    ORDER BY SUM(c.amount) DESC
    LIMIT 10;
  `;
  const totals = await query<{ totalAmount: string; count: number }>(totalsText, values);
  const top = await query<{ memberId: number; memberName: string; totalAmount: string }>(topText, values);
  const totalsRow = totals.rows[0] ?? { totalAmount: '0', count: 0 };
  return {
    totalAmount: totalsRow.totalAmount,
    count: totalsRow.count,
    topContributors: top.rows,
  };
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


