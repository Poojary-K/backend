import crypto from 'node:crypto';
import { getClient } from '../config/database.js';
import { getConfig } from '../config/env.js';
import { HttpError } from '../middlewares/errorHandler.js';
import { findMemberByEmail, updateMemberPassword, type MemberRecord } from '../repositories/memberRepository.js';
import {
  createPasswordResetToken,
  findPasswordResetTokenForUpdate,
  markPasswordResetTokensUsedByMember,
} from '../repositories/passwordResetRepository.js';
import { hashPassword } from '../utils/password.js';
import { sendTemplatedEmail } from './emailService.js';

const PASSWORD_RESET_TTL_MINUTES = 15;
const PASSWORD_RESET_TTL_MS = PASSWORD_RESET_TTL_MINUTES * 60 * 1000;

const hashToken = (token: string): string => crypto.createHash('sha256').update(token).digest('hex');

const buildResetToken = (): { token: string; tokenHash: string; expiresAt: Date } => {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
  return { token, tokenHash, expiresAt };
};

const buildResetUrl = (token: string): string => {
  const { clientBaseUrl, appBaseUrl } = getConfig();
  const baseUrl = clientBaseUrl || appBaseUrl;
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const url = new URL('reset-password', normalizedBaseUrl);
  url.searchParams.set('token', token);
  return url.toString();
};

const sendPasswordResetEmail = async (member: MemberRecord, token: string): Promise<void> => {
  if (!member.email) {
    return;
  }
  const resetUrl = buildResetUrl(token);
  try {
    await sendTemplatedEmail('auth.reset', member.email, {
      memberName: member.name,
      resetUrl,
      expiresInMinutes: String(PASSWORD_RESET_TTL_MINUTES),
    });
  } catch (error) {
    console.error('Failed to send password reset email.', error);
  }
};

/**
 * Creates and emails a password reset token for the member if they exist.
 */
export const requestPasswordReset = async (email: string): Promise<void> => {
  const member = await findMemberByEmail(email);
  if (!member || !member.email) {
    return;
  }
  const { token, tokenHash, expiresAt } = buildResetToken();
  const usedAt = new Date();
  await markPasswordResetTokensUsedByMember(member.memberid, usedAt);
  await createPasswordResetToken(member.memberid, tokenHash, expiresAt);
  await sendPasswordResetEmail(member, token);
};

/**
 * Resets the member password if the reset token is valid.
 */
export const resetPassword = async (token: string, newPassword: string): Promise<void> => {
  const tokenHash = hashToken(token);
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const resetToken = await findPasswordResetTokenForUpdate(tokenHash, client);
    if (!resetToken) {
      throw new HttpError('Invalid or expired reset token', 400);
    }
    if (resetToken.used_at) {
      throw new HttpError('Reset token already used', 400);
    }
    if (new Date(resetToken.expires_at).getTime() < Date.now()) {
      throw new HttpError('Reset token expired', 400);
    }

    const passwordHash = await hashPassword(newPassword);
    await updateMemberPassword(resetToken.memberid, passwordHash, client);
    const usedAt = new Date();
    await markPasswordResetTokensUsedByMember(resetToken.memberid, usedAt, client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
