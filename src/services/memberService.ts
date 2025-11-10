import { HttpError } from '../middlewares/errorHandler.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { signToken } from '../utils/jwt.js';
import { createMember, findMemberByEmail, listMembers, type MemberRecord } from '../repositories/memberRepository.js';

export interface RegisterMemberInput {
  readonly name: string;
  readonly email?: string | undefined;
  readonly phone?: string | undefined;
  readonly password: string;
}

export interface LoginInput {
  readonly email: string;
  readonly password: string;
}

/**
 * Registers a new member, ensuring email uniqueness when provided and hashing the password.
 */
export const registerMember = async (input: RegisterMemberInput) => {
  if (input.email) {
    const existing = await findMemberByEmail(input.email);
    if (existing) {
      throw new HttpError('Email already registered', 409);
    }
  }
  const hashedPassword = await hashPassword(input.password);
  const storedMember = await createMember({
    name: input.name,
    email: input.email,
    phone: input.phone,
    password: hashedPassword,
  });
  const token = signToken({ memberId: storedMember.memberid, email: storedMember.email ?? '' });
  return {
    memberId: storedMember.memberid,
    name: storedMember.name,
    email: storedMember.email,
    phone: storedMember.phone,
    joinedOn: storedMember.joinedon,
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
  const token = signToken({ memberId: member.memberid, email: member.email ?? '' });
  return {
    token,
    member: {
      memberId: member.memberid,
      name: member.name,
      email: member.email,
      phone: member.phone,
      joinedOn: member.joinedon,
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

