import type { CauseRecord } from '../repositories/causeRepository.js';
import type { ContributionRecord } from '../repositories/contributionRepository.js';
import { listCauseImages } from '../repositories/causeImageRepository.js';
import { listContributionImages } from '../repositories/contributionImageRepository.js';
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

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildImagesHtml = (urls: string[]): string => {
  if (urls.length === 0) {
    return '';
  }

  const items = urls
    .map((url) => {
      const safeUrl = escapeHtml(url);
      return [
        "<div style='margin:0 0 8px 0;'>",
        "<img src='",
        safeUrl,
        "' alt='Image' style='display:block;width:100%;max-width:480px;height:auto;border-radius:8px;border:1px solid #eee;' />",
        '</div>',
      ].join('');
    })
    .join('');

  return [
    "<div style='margin:12px 0 0 0;'>",
    "<div style='font-size:12px;color:#777;margin-bottom:6px;'>Proof of Payment</div>",
    items,
    '</div>',
  ].join('');
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

    const images = await listContributionImages(contribution.contributionid);
    const imagesHtml = buildImagesHtml(images.map((image) => image.url));
    await sendTemplatedEmail('contribution.created', email, {
      ...buildContributionData(contribution, resolvedMember),
      imagesHtml,
    });
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

    const images = await listContributionImages(contribution.contributionid);
    const imagesHtml = buildImagesHtml(images.map((image) => image.url));
    await sendTemplatedEmail('contribution.updated', email, {
      ...buildContributionData(contribution, resolvedMember),
      imagesHtml,
    });
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

    const images = await listContributionImages(contribution.contributionid);
    const imagesHtml = buildImagesHtml(images.map((image) => image.url));
    await sendTemplatedEmail('contribution.deleted', email, {
      ...buildContributionData(contribution, resolvedMember),
      imagesHtml,
    });
  } catch (error) {
    console.error('Failed to send contribution deleted email.', error);
  }
};

const notifyCauseToMembers = async (templateKey: string, cause: CauseRecord): Promise<void> => {
  try {
    const members = await listMembers();
    const images = await listCauseImages(cause.causeid);
    const imagesHtml = buildImagesHtml(images.map((image) => image.url));
    const tasks = members
      .map((member) => {
        const email = normalizeEmail(member.email);
        if (!email) {
          return null;
        }
        return sendTemplatedEmail(templateKey, email, {
          ...buildCauseData(cause, member),
          imagesHtml,
        });
      })
      .filter((task): task is Promise<void> => task !== null);

    const results = await Promise.allSettled(tasks);
    const failures = results.filter((result) => result.status === 'rejected');
    if (failures.length > 0) {
      console.error(`Failed to send ${failures.length} ${templateKey} emails.`);
    }
  } catch (error) {
    console.error(`Failed to send ${templateKey} emails.`, error);
  }
};

export const notifyCauseCreated = async (cause: CauseRecord): Promise<void> =>
  notifyCauseToMembers('cause.created', cause);

export const notifyCauseUpdated = async (cause: CauseRecord): Promise<void> =>
  notifyCauseToMembers('cause.updated', cause);

export const notifyCauseDeleted = async (cause: CauseRecord): Promise<void> =>
  notifyCauseToMembers('cause.deleted', cause);
