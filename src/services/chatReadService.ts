import { HttpError } from '../middlewares/errorHandler.js';
import { getFundSummary } from './fundService.js';
import { getCauseById } from './causeService.js';
import { getMemberById, getMembers } from './memberService.js';
import { listCauseImagesById } from './causeImageService.js';
import { listContributionImagesById } from './contributionImageService.js';
import {
  findContributionById,
  listContributionsByMemberId,
  sumContributionsByMemberId,
  listContributionsWithMemberNames,
  getContributionStats,
  type ContributionRecord,
  type ContributionWithMemberRecord,
  type ContributionStatsRecord,
} from '../repositories/contributionRepository.js';
import {
  searchCauses as searchCausesRepo,
  listCausesInDateRange,
  getCauseStats,
  type CauseRecord,
  type CauseStatsRecord,
} from '../repositories/causeRepository.js';
import { findMemberById, searchMembers as searchMembersRepo, type MemberRecord } from '../repositories/memberRepository.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// Clamps a requested limit into the allowed range.
const clampLimit = (limit?: number): number => {
  if (limit === undefined || Number.isNaN(limit)) {
    return DEFAULT_LIMIT;
  }
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT);
};

export interface DateRangeOptions {
  readonly fromDate?: Date | undefined;
  readonly toDate?: Date | undefined;
}

export interface FundStatusDto {
  readonly totalContributions: string;
  readonly totalDisbursements: string;
  readonly availableFunds: string;
}

export interface SafeMemberDto {
  readonly memberId: number;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly joinedOn: Date;
  readonly isAdmin: boolean;
  readonly emailUpdatesEnabled: boolean;
  readonly emailVerified: boolean;
}

export interface ImageDto {
  readonly imageId: number;
  readonly url: string;
  readonly createdAt: Date;
}

// Strips sensitive columns from a member row before it reaches the LLM/tools.
const toSafeMember = (member: MemberRecord): SafeMemberDto => ({
  memberId: member.memberid,
  name: member.name,
  email: member.email,
  phone: member.phone,
  joinedOn: member.joinedon,
  isAdmin: member.is_admin,
  emailUpdatesEnabled: member.email_updates_enabled,
  emailVerified: member.email_verified,
});

/**
 * Returns fund totals mapped to friendly, chat-facing field names.
 */
export const getFundStatus = async (): Promise<FundStatusDto> => {
  const summary = await getFundSummary();
  return {
    totalContributions: summary.totalcontributions,
    totalDisbursements: summary.totaldonations,
    availableFunds: summary.availablefunds,
  };
};

/**
 * Lists causes, optionally filtered by creation date range.
 */
export const listCauses = async (
  options: DateRangeOptions & { limit?: number | undefined } = {},
): Promise<CauseRecord[]> =>
  listCausesInDateRange(options.fromDate, options.toDate, clampLimit(options.limit));

/**
 * Searches causes by keyword.
 */
export const searchCauses = async (queryText: string, limit?: number): Promise<CauseRecord[]> =>
  searchCausesRepo(queryText, clampLimit(limit));

/**
 * Fetches a single cause by ID.
 */
export const getCause = async (causeId: number): Promise<CauseRecord> => getCauseById(causeId);

/**
 * Lists proof images for a cause.
 */
export const listCauseImages = async (causeId: number): Promise<ImageDto[]> => {
  const images = await listCauseImagesById(causeId);
  return images.map((image) => ({ imageId: image.imageid, url: image.url, createdAt: image.createdat }));
};

/**
 * Returns the current user's sanitized profile.
 */
export const getMyProfile = async (memberId: number): Promise<SafeMemberDto> => {
  const member = await findMemberById(memberId);
  if (!member) {
    throw new HttpError('Member not found', 404);
  }
  return toSafeMember(member);
};

/**
 * Lists the current user's contributions, optionally filtered by date range.
 */
export const listMyContributions = async (
  memberId: number,
  options: DateRangeOptions & { limit?: number | undefined } = {},
): Promise<ContributionRecord[]> => {
  if (options.fromDate !== undefined || options.toDate !== undefined) {
    return listContributionsWithMemberNames({
      memberId,
      fromDate: options.fromDate,
      toDate: options.toDate,
      limit: clampLimit(options.limit),
    });
  }
  return listContributionsByMemberId(memberId, clampLimit(options.limit));
};

/**
 * Returns the current user's total contributed amount.
 */
export const getMyContributionTotal = async (memberId: number): Promise<{ totalAmount: string }> => {
  const totalAmount = await sumContributionsByMemberId(memberId);
  return { totalAmount };
};

/**
 * Returns one of the current user's contributions, enforcing ownership.
 */
export const getMyContribution = async (
  memberId: number,
  contributionId: number,
): Promise<ContributionRecord> => {
  const contribution = await findContributionById(contributionId);
  if (!contribution || contribution.memberid !== memberId) {
    throw new HttpError('Contribution not found or access denied', 404);
  }
  return contribution;
};

/**
 * Lists all members (admin), sanitized and limited.
 */
export const listMembers = async (limit?: number): Promise<SafeMemberDto[]> => {
  const members = await getMembers();
  return members.slice(0, clampLimit(limit)).map(toSafeMember);
};

/**
 * Fetches a member by ID (admin), sanitized.
 */
export const getMember = async (memberId: number): Promise<SafeMemberDto> => {
  const member = await getMemberById(memberId);
  return toSafeMember(member);
};

/**
 * Searches members (admin), sanitized.
 */
export const searchMembers = async (queryText: string, limit?: number): Promise<SafeMemberDto[]> => {
  const members = await searchMembersRepo(queryText, clampLimit(limit));
  return members.map(toSafeMember);
};

/**
 * Lists all contributions with member names (admin), with optional filters.
 */
export const listContributions = async (
  options: DateRangeOptions & { memberId?: number | undefined; limit?: number | undefined } = {},
): Promise<ContributionWithMemberRecord[]> =>
  listContributionsWithMemberNames({
    memberId: options.memberId,
    fromDate: options.fromDate,
    toDate: options.toDate,
    limit: clampLimit(options.limit),
  });

/**
 * Fetches any contribution by ID (admin), joined with the member name.
 */
export const getContribution = async (contributionId: number): Promise<ContributionWithMemberRecord> => {
  const contribution = await findContributionById(contributionId);
  if (!contribution) {
    throw new HttpError('Contribution not found', 404);
  }
  const member = await findMemberById(contribution.memberid);
  return { ...contribution, member_name: member?.name ?? 'Unknown' };
};

/**
 * Lists proof images for any contribution (admin).
 */
export const listContributionImages = async (contributionId: number): Promise<ImageDto[]> => {
  const images = await listContributionImagesById(contributionId);
  return images.map((image) => ({ imageId: image.imageid, url: image.url, createdAt: image.createdat }));
};

/**
 * Aggregate contribution statistics (admin).
 */
export const getContributionSummary = async (options: DateRangeOptions = {}): Promise<ContributionStatsRecord> =>
  getContributionStats(options);

/**
 * Aggregate cause statistics (admin).
 */
export const getCauseSummary = async (options: DateRangeOptions = {}): Promise<CauseStatsRecord> =>
  getCauseStats(options);

const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Returns the current date and time in Indian Standard Time (IST).
 * Use when the user omits a year or you need today's date for contribution/cause entries.
 */
export const getCurrentDateIst = (): {
  readonly timezone: string;
  readonly date: string;
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly dateTime: string;
  readonly usageHint: string;
} => {
  const now = new Date();
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now);

  const year = Number(parts.find((p) => p.type === 'year')?.value ?? date.slice(0, 4));
  const month = Number(parts.find((p) => p.type === 'month')?.value ?? 1);
  const day = Number(parts.find((p) => p.type === 'day')?.value ?? 1);

  const dateTime = new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'shortOffset',
  }).format(now);

  return {
    timezone: `${IST_TIMEZONE} (IST)`,
    date,
    year,
    month,
    day,
    dateTime,
    usageHint: 'When the user gives a date without a year, combine their month/day with this year unless context clearly indicates another year.',
  };
};
