import { HttpError } from '../middlewares/errorHandler.js';
import {
  createCause,
  listCauses,
  findCauseById,
  updateCause,
  deleteCause,
  type CauseRecord,
  type UpdateCauseInput,
} from '../repositories/causeRepository.js';

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

/**
 * Retrieves a cause by ID.
 */
export const getCauseById = async (id: number): Promise<CauseRecord> => {
  const cause = await findCauseById(id);
  if (!cause) {
    throw new HttpError('Cause not found', 404);
  }
  return cause;
};

/**
 * Updates a cause.
 */
export const updateCauseById = async (id: number, input: UpdateCauseInput): Promise<CauseRecord> => {
  if (input.amount !== undefined && input.amount < 0) {
    throw new HttpError('Amount cannot be negative', 400);
  }
  try {
    return await updateCause(id, input);
  } catch (error) {
    if (error instanceof Error && error.message === 'Cause not found') {
      throw new HttpError('Cause not found', 404);
    }
    throw error;
  }
};

/**
 * Deletes a cause by ID.
 */
export const deleteCauseById = async (id: number): Promise<void> => {
  try {
    await deleteCause(id);
  } catch (error) {
    if (error instanceof Error && error.message === 'Cause not found') {
      throw new HttpError('Cause not found', 404);
    }
    throw error;
  }
};


