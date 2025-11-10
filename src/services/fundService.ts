import { getFundStatus, type FundStatusRecord } from '../repositories/fundRepository.js';

/**
 * Returns aggregate fund totals.
 */
export const getFundSummary = async (): Promise<FundStatusRecord> => getFundStatus();


