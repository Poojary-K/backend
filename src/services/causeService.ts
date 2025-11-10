import { HttpError } from '../middlewares/errorHandler.js';
import { createCause, listCauses, type CauseRecord } from '../repositories/causeRepository.js';

export interface CauseInput {
  readonly title: string;
  readonly description?: string | undefined;
  readonly amount?: number | undefined;
}

/**
 * Validates and creates a new fundraising cause.
 */
export const registerCause = async (input: CauseInput): Promise<CauseRecord> => {
  if (input.amount !== undefined && input.amount < 0) {
    throw new HttpError('Amount cannot be negative', 400);
  }
  return createCause(input);
};

/**
 * Lists all causes by recency.
 */
export const getCauses = async (): Promise<CauseRecord[]> => {
  return listCauses();
};


