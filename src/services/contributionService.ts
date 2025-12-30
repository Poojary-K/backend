import { HttpError } from '../middlewares/errorHandler.js';
import {
  createContribution,
  listContributions,
  findContributionById,
  updateContribution,
  deleteContribution,
  type ContributionRecord,
  type UpdateContributionInput,
} from '../repositories/contributionRepository.js';
import { findMemberById } from '../repositories/memberRepository.js';
import {
  notifyContributionCreated,
  notifyContributionDeleted,
  notifyContributionUpdated,
} from './notificationService.js';
import { cleanupContributionImages, listContributionImagesById } from './contributionImageService.js';

export interface ContributionInput {
  readonly memberId: number;
  readonly amount: number;
  readonly contributedDate: Date;
}

/**
 * Validates and records a contribution for a member.
 */
export const recordContribution = async (
  input: ContributionInput,
  options?: { notify?: boolean },
): Promise<ContributionRecord> => {
  if (input.amount <= 0) {
    throw new HttpError('Contribution amount must be positive', 400);
  }

  // Validate that member exists before creating contribution
  const member = await findMemberById(input.memberId);
  if (!member) {
    throw new HttpError(`Member with ID ${input.memberId} not found`, 404);
  }

  const contribution = await createContribution(input);
  if (options?.notify !== false) {
    void notifyContributionCreated(contribution, member);
  }
  return contribution;
};

/**
 * Retrieves the list of contributions ordered by date.
 */
export const getContributions = async (): Promise<ContributionRecord[]> => {
  return listContributions();
};

/**
 * Retrieves a contribution by ID.
 */
export const getContributionById = async (id: number): Promise<ContributionRecord> => {
  const contribution = await findContributionById(id);
  if (!contribution) {
    throw new HttpError('Contribution not found', 404);
  }
  return contribution;
};

/**
 * Updates a contribution. Validates member exists if memberId is being updated.
 */
export const updateContributionById = async (id: number, input: UpdateContributionInput): Promise<ContributionRecord> => {
  if (input.amount !== undefined && input.amount <= 0) {
    throw new HttpError('Contribution amount must be positive', 400);
  }

  if (input.memberId !== undefined) {
    const member = await findMemberById(input.memberId);
    if (!member) {
      throw new HttpError(`Member with ID ${input.memberId} not found`, 404);
    }
  }

  try {
    const updatedContribution = await updateContribution(id, input);
    void notifyContributionUpdated(updatedContribution);
    return updatedContribution;
  } catch (error) {
    if (error instanceof Error && error.message === 'Contribution not found') {
      throw new HttpError('Contribution not found', 404);
    }
    throw error;
  }
};

/**
 * Deletes a contribution by ID.
 */
export const deleteContributionById = async (id: number): Promise<void> => {
  const existing = await findContributionById(id);
  if (!existing) {
    throw new HttpError('Contribution not found', 404);
  }

  try {
    const images = await listContributionImagesById(id);
    await deleteContribution(id);
    void notifyContributionDeleted(existing);
    void cleanupContributionImages(images);
  } catch (error) {
    if (error instanceof Error && error.message === 'Contribution not found') {
      throw new HttpError('Contribution not found', 404);
    }
    throw error;
  }
};

/**
 * Checks if a user is the owner of a contribution or is an admin.
 */
export const canModifyContribution = async (contributionId: number, userId: number, isAdmin: boolean): Promise<boolean> => {
  const contribution = await findContributionById(contributionId);
  if (!contribution) {
    return false;
  }
  return isAdmin || contribution.memberid === userId;
};
