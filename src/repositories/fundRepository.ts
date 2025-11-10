import { query } from '../config/database.js';

export interface FundStatusRecord {
  readonly totalcontributions: string;
  readonly totaldonations: string;
  readonly availablefunds: string;
}

/**
 * Retrieves aggregate totals from the fund status database view.
 */
export const getFundStatus = async (): Promise<FundStatusRecord> => {
  const text = `SELECT totalcontributions, totaldonations, availablefunds FROM fundstatusview LIMIT 1;`;
  const result = await query<FundStatusRecord>(text);
  return result.rows[0] ?? { totalcontributions: '0', totaldonations: '0', availablefunds: '0' };
};


