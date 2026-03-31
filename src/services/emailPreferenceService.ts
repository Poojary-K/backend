import { HttpError } from '../middlewares/errorHandler.js';
import { findMemberById, updateMemberEmailUpdatesEnabled } from '../repositories/memberRepository.js';
import { verifyEmailUnsubscribeToken } from '../utils/emailUnsubscribeToken.js';

export const getEmailUpdatesEnabledForMember = async (
  memberId: number,
): Promise<{ readonly emailUpdatesEnabled: boolean }> => {
  const member = await findMemberById(memberId);
  if (!member) {
    throw new HttpError('Member not found', 404);
  }
  return { emailUpdatesEnabled: member.email_updates_enabled };
};

export const setEmailUpdatesEnabledForMember = async (
  memberId: number,
  emailUpdatesEnabled: boolean,
): Promise<{ readonly emailUpdatesEnabled: boolean }> => {
  const member = await findMemberById(memberId);
  if (!member) {
    throw new HttpError('Member not found', 404);
  }
  await updateMemberEmailUpdatesEnabled(memberId, emailUpdatesEnabled);
  return { emailUpdatesEnabled };
};

export const disableEmailUpdatesFromUnsubscribeToken = async (token: string): Promise<void> => {
  let memberId: number;
  try {
    memberId = verifyEmailUnsubscribeToken(token);
  } catch {
    throw new HttpError('Invalid or expired unsubscribe link', 400);
  }
  const member = await findMemberById(memberId);
  if (!member) {
    throw new HttpError('Member not found', 404);
  }
  await updateMemberEmailUpdatesEnabled(memberId, false);
};
