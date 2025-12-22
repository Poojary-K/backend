import { HttpError } from '../middlewares/errorHandler.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { signToken } from '../utils/jwt.js';
import { getConfig } from '../config/env.js';
import {
  createMember,
  findMemberByEmail,
  findMemberById,
  listMembers,
  updateMemberAdminStatus,
  type MemberRecord,
} from '../repositories/memberRepository.js';

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

/**
 * Registers a new member, ensuring email uniqueness when provided and hashing the password.
 * If adminSecretCode is provided and matches, the member will be registered as admin.
 */
export const registerMember = async (input: RegisterMemberInput) => {
  if (input.email) {
    const existing = await findMemberByEmail(input.email);
    if (existing) {
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
  return members.map<MemberRecord>((member) => ({
    ...member,
    password: '[REDACTED]',
  }));
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

