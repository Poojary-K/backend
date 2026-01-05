import crypto from 'node:crypto';
import { HttpError } from '../middlewares/errorHandler.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { signToken } from '../utils/jwt.js';
import { getConfig } from '../config/env.js';
import {
  createMember,
  findMemberByEmail,
  findMemberById,
  findMemberByVerificationTokenHash,
  listMembers,
  markEmailVerified,
  setEmailVerificationToken,
  updateMemberAdminStatus,
  updateMember,
  deleteMember,
  type MemberRecord,
  type UpdateMemberInput as UpdateMemberRepositoryInput,
} from '../repositories/memberRepository.js';
import { sendTemplatedEmail } from './emailService.js';

const EMAIL_VERIFICATION_TTL_SECONDS = 90;
const EMAIL_VERIFICATION_TTL_MS = EMAIL_VERIFICATION_TTL_SECONDS * 1000;

const hashToken = (token: string): string => crypto.createHash('sha256').update(token).digest('hex');

const buildVerificationToken = (): { token: string; tokenHash: string; expiresAt: Date } => {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);
  return { token, tokenHash, expiresAt };
};

const buildVerificationUrl = (token: string): string => {
  const { appBaseUrl } = getConfig();
  const normalizedBaseUrl = appBaseUrl.endsWith('/') ? appBaseUrl : `${appBaseUrl}/`;
  const url = new URL('api/auth/verify-email', normalizedBaseUrl);
  url.searchParams.set('token', token);
  return url.toString();
};

const sendVerificationEmail = async (member: MemberRecord, token: string): Promise<void> => {
  if (!member.email) {
    return;
  }
  const verificationUrl = buildVerificationUrl(token);
  try {
    await sendTemplatedEmail('auth.verify', member.email, {
      memberName: member.name,
      verificationUrl,
      expiresInSeconds: String(EMAIL_VERIFICATION_TTL_SECONDS),
    });
  } catch (error) {
    console.error('Failed to send verification email.', error);
  }
};

const sanitizeMember = (member: MemberRecord): MemberRecord => ({
  ...member,
  password: '[REDACTED]',
  email_verification_token_hash: null,
  email_verification_expires_at: null,
  email_verification_sent_at: null,
});

export interface RegisterMemberInput {
  readonly name: string;
  readonly email?: string | undefined;
  readonly phone?: string | undefined;
  readonly password: string;
  readonly adminSecretCode?: string | undefined;
}

export interface LoginInput {
  readonly email: string;
  readonly password: string;
}

export interface UpdateMemberPayload {
  readonly name?: string | undefined;
  readonly email?: string | undefined;
  readonly phone?: string | undefined;
  readonly isAdmin?: boolean | undefined;
  readonly is_admin?: boolean | undefined;
}

/**
 * Registers a new member, ensuring email uniqueness when provided and hashing the password.
 * If adminSecretCode is provided and matches, the member will be registered as admin.
 */
export const registerMember = async (input: RegisterMemberInput) => {
  if (input.email) {
    const existing = await findMemberByEmail(input.email);
    if (existing) {
      if (!existing.email_verified) {
        const { token, tokenHash, expiresAt } = buildVerificationToken();
        const sentAt = new Date();
        await setEmailVerificationToken(existing.memberid, tokenHash, expiresAt, sentAt);
        await sendVerificationEmail(existing, token);
        return {
          memberId: existing.memberid,
          name: existing.name,
          email: existing.email,
          phone: existing.phone,
          joinedOn: existing.joinedon,
          isAdmin: existing.is_admin,
          verificationRequired: true,
          verificationExpiresInSeconds: EMAIL_VERIFICATION_TTL_SECONDS,
        };
      }
      throw new HttpError('Email already registered', 409);
    }
  }
  
  // Check if admin secret code is provided and valid
  const { adminSecretCode } = getConfig();
  const isAdmin = input.adminSecretCode !== undefined && input.adminSecretCode === adminSecretCode;
  
  const hashedPassword = await hashPassword(input.password);
  const storedMember = await createMember({
    name: input.name,
    email: input.email,
    phone: input.phone,
    password: hashedPassword,
    is_admin: isAdmin,
  });

  if (storedMember.email) {
    const { token, tokenHash, expiresAt } = buildVerificationToken();
    const sentAt = new Date();
    await setEmailVerificationToken(storedMember.memberid, tokenHash, expiresAt, sentAt);
    await sendVerificationEmail(storedMember, token);
    return {
      memberId: storedMember.memberid,
      name: storedMember.name,
      email: storedMember.email,
      phone: storedMember.phone,
      joinedOn: storedMember.joinedon,
      isAdmin: storedMember.is_admin,
      verificationRequired: true,
      verificationExpiresInSeconds: EMAIL_VERIFICATION_TTL_SECONDS,
    };
  }

  const token = signToken({
    memberId: storedMember.memberid,
    email: storedMember.email ?? '',
    isAdmin: storedMember.is_admin,
  });
  return {
    memberId: storedMember.memberid,
    name: storedMember.name,
    email: storedMember.email,
    phone: storedMember.phone,
    joinedOn: storedMember.joinedon,
    isAdmin: storedMember.is_admin,
    token,
  };
};

/**
 * Authenticates a member by email/password and returns a fresh JWT.
 */
export const authenticateMember = async (input: LoginInput) => {
  const member = await findMemberByEmail(input.email);
  if (!member) {
    throw new HttpError('Invalid credentials', 401);
  }
  if (!member.email_verified) {
    throw new HttpError('Email not verified', 403, { code: 'EMAIL_NOT_VERIFIED' });
  }
  const passwordMatches = await verifyPassword(input.password, member.password);
  if (!passwordMatches) {
    throw new HttpError('Invalid credentials', 401);
  }
  const token = signToken({
    memberId: member.memberid,
    email: member.email ?? '',
    isAdmin: member.is_admin,
  });
  return {
    token,
    member: {
      memberId: member.memberid,
      name: member.name,
      email: member.email,
      phone: member.phone,
      joinedOn: member.joinedon,
      isAdmin: member.is_admin,
    },
  };
};

/**
 * Returns a list of all members with sensitive fields removed.
 */
export const getMembers = async () => {
  const members = await listMembers();
  return members.map<MemberRecord>((member) => sanitizeMember(member));
};

export interface UpgradeToAdminInput {
  readonly memberId: number;
  readonly adminSecretCode: string;
}

/**
 * Upgrades a member to admin status if the secret code is valid.
 */
export const upgradeToAdmin = async (input: UpgradeToAdminInput) => {
  const { adminSecretCode } = getConfig();
  
  if (input.adminSecretCode !== adminSecretCode) {
    throw new HttpError('Invalid admin secret code', 403);
  }
  
  const member = await findMemberById(input.memberId);
  if (!member) {
    throw new HttpError('Member not found', 404);
  }
  
  if (member.is_admin) {
    throw new HttpError('Member is already an admin', 400);
  }
  
  const updatedMember = await updateMemberAdminStatus(input.memberId, true);
  
  // Generate new token with updated admin status
  const token = signToken({
    memberId: updatedMember.memberid,
    email: updatedMember.email ?? '',
    isAdmin: updatedMember.is_admin,
  });
  
  return {
    token,
    member: {
      memberId: updatedMember.memberid,
      name: updatedMember.name,
      email: updatedMember.email,
      phone: updatedMember.phone,
      joinedOn: updatedMember.joinedon,
      isAdmin: updatedMember.is_admin,
    },
  };
};

/**
 * Retrieves a member by ID.
 */
export const getMemberById = async (id: number): Promise<MemberRecord> => {
  const member = await findMemberById(id);
  if (!member) {
    throw new HttpError('Member not found', 404);
  }
  return sanitizeMember(member);
};

/**
 * Updates a member.
 */
export const updateMemberById = async (id: number, input: UpdateMemberPayload): Promise<MemberRecord> => {
  try {
    // Map API input to repository format, accepting legacy is_admin payloads.
    const isAdmin = input.isAdmin ?? input.is_admin;
    const repositoryInput: UpdateMemberRepositoryInput = {
      name: input.name,
      email: input.email,
      phone: input.phone,
      is_admin: isAdmin,
    };
    
    const updated = await updateMember(id, repositoryInput);
    return sanitizeMember(updated);
  } catch (error) {
    if (error instanceof Error && error.message === 'Member not found') {
      throw new HttpError('Member not found', 404);
    }
    throw error;
  }
};

/**
 * Deletes a member by ID.
 */
export const deleteMemberById = async (id: number): Promise<void> => {
  try {
    await deleteMember(id);
  } catch (error) {
    if (error instanceof Error && error.message === 'Member not found') {
      throw new HttpError('Member not found', 404);
    }
    throw error;
  }
};

/**
 * Verifies a member's email using a signed token.
 */
export const verifyMemberEmail = async (token: string) => {
  const tokenHash = hashToken(token);
  const member = await findMemberByVerificationTokenHash(tokenHash);
  if (!member) {
    throw new HttpError('Invalid or expired verification token', 400);
  }
  const expiresAt = member.email_verification_expires_at;
  if (!expiresAt || new Date(expiresAt).getTime() < Date.now()) {
    throw new HttpError('Verification token expired', 400);
  }
  const updatedMember = await markEmailVerified(member.memberid);
  return {
    memberId: updatedMember.memberid,
    email: updatedMember.email,
    verifiedAt: updatedMember.email_verified_at,
  };
};

/**
 * Resends a verification email to an unverified member.
 */
export const resendEmailVerification = async (email: string): Promise<void> => {
  const member = await findMemberByEmail(email);
  if (!member) {
    throw new HttpError('Member not found', 404);
  }
  if (member.email_verified) {
    throw new HttpError('Email already verified', 409);
  }
  const { token, tokenHash, expiresAt } = buildVerificationToken();
  const sentAt = new Date();
  await setEmailVerificationToken(member.memberid, tokenHash, expiresAt, sentAt);
  await sendVerificationEmail(member, token);
};
