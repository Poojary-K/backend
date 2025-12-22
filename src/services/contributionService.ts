import { HttpError } from '../middlewares/errorHandler.js';
import {
  createContribution,
  listContributions,
  type ContributionRecord,
} from '../repositories/contributionRepository.js';
import { findMemberById } from '../repositories/memberRepository.js';

export interface ContributionInput {
  readonly memberId: number;
  readonly amount: number;
  readonly contributedDate: Date;
}

/**
 * Validates and records a contribution for a member.
 */
export const recordContribution = async (input: ContributionInput): Promise<ContributionRecord> => {
  if (input.amount <= 0) {
    throw new HttpError('Contribution amount must be positive', 400);
  }
  
  // Validate that member exists before creating contribution
  const member = await findMemberById(input.memberId);
  if (!member) {
    throw new HttpError(`Member with ID ${input.memberId} not found`, 404);
  }
  
  return createContribution(input);
};

/**
 * Retrieves the list of contributions ordered by date.
 */
export const getContributions = async (): Promise<ContributionRecord[]> => {
  return listContributions();
};


