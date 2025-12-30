import type { CauseRecord } from '../repositories/causeRepository.js';
import type { ContributionRecord } from '../repositories/contributionRepository.js';
import { findMemberById, listMembers, type MemberRecord } from '../repositories/memberRepository.js';
import { sendTemplatedEmail } from './emailService.js';

const formatDate = (value: Date | string | null | undefined): string => {
  if (!value) {
    return 'N/A';
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 'N/A' : date.toISOString().split('T')[0];
};

const normalizeEmail = (value: string | null): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const buildContributionData = (contribution: ContributionRecord, member: MemberRecord): Record<string, string> => ({
  memberName: member.name,
  amount: contribution.amount,
  contributedDate: formatDate(contribution.contributeddate),
  contributionId: String(contribution.contributionid),
});

const buildCauseData = (cause: CauseRecord, member: MemberRecord): Record<string, string> => ({
  memberName: member.name,
  title: cause.title,
  description: cause.description ?? 'No description provided.',
  amount: cause.amount ?? 'N/A',
  causeId: String(cause.causeid),
});

const resolveMember = async (memberId: number, fallback?: MemberRecord | null): Promise<MemberRecord | null> => {
  if (fallback) {
    return fallback;
  }
  return findMemberById(memberId);
};

export const notifyContributionCreated = async (
  contribution: ContributionRecord,
  member?: MemberRecord | null,
): Promise<void> => {
  try {
    const resolvedMember = await resolveMember(contribution.memberid, member);
    if (!resolvedMember) {
      return;
    }
    const email = normalizeEmail(resolvedMember.email);
    if (!email) {
      return;
    }

    await sendTemplatedEmail('contribution.created', email, buildContributionData(contribution, resolvedMember));
  } catch (error) {
    console.error('Failed to send contribution created email.', error);
  }
};

export const notifyContributionUpdated = async (contribution: ContributionRecord): Promise<void> => {
  try {
    const resolvedMember = await resolveMember(contribution.memberid);
    if (!resolvedMember) {
      return;
    }
    const email = normalizeEmail(resolvedMember.email);
    if (!email) {
      return;
    }

    await sendTemplatedEmail('contribution.updated', email, buildContributionData(contribution, resolvedMember));
  } catch (error) {
    console.error('Failed to send contribution updated email.', error);
  }
};

export const notifyContributionDeleted = async (contribution: ContributionRecord): Promise<void> => {
  try {
    const resolvedMember = await resolveMember(contribution.memberid);
    if (!resolvedMember) {
      return;
    }
    const email = normalizeEmail(resolvedMember.email);
    if (!email) {
      return;
    }

    await sendTemplatedEmail('contribution.deleted', email, buildContributionData(contribution, resolvedMember));
  } catch (error) {
    console.error('Failed to send contribution deleted email.', error);
  }
};

export const notifyCauseCreated = async (cause: CauseRecord): Promise<void> => {
  try {
    const members = await listMembers();
    for (const member of members) {
      const email = normalizeEmail(member.email);
      if (!email) {
        continue;
      }
      await sendTemplatedEmail('cause.created', email, buildCauseData(cause, member));
    }
  } catch (error) {
    console.error('Failed to send cause created emails.', error);
  }
};

export const notifyCauseUpdated = async (cause: CauseRecord): Promise<void> => {
  try {
    const members = await listMembers();
    for (const member of members) {
      const email = normalizeEmail(member.email);
      if (!email) {
        continue;
      }
      await sendTemplatedEmail('cause.updated', email, buildCauseData(cause, member));
    }
  } catch (error) {
    console.error('Failed to send cause updated emails.', error);
  }
};

export const notifyCauseDeleted = async (cause: CauseRecord): Promise<void> => {
  try {
    const members = await listMembers();
    for (const member of members) {
      const email = normalizeEmail(member.email);
      if (!email) {
        continue;
      }
      await sendTemplatedEmail('cause.deleted', email, buildCauseData(cause, member));
    }
  } catch (error) {
    console.error('Failed to send cause deleted emails.', error);
  }
};
