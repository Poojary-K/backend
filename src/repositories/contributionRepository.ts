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


