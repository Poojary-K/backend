import type { ContributionImageRecord } from '../repositories/contributionImageRepository.js';
import {
  createContributionImage,
  listContributionImages,
  findContributionImageById,
  updateContributionImage,
  deleteContributionImage,
} from '../repositories/contributionImageRepository.js';
import { findContributionById, type ContributionRecord } from '../repositories/contributionRepository.js';
import { HttpError } from '../middlewares/errorHandler.js';
import { deleteDriveFileByUrl, uploadDriveFile } from './driveService.js';
import { findMemberById, type MemberRecord } from '../repositories/memberRepository.js';
import path from 'node:path';
import { notifyContributionUpdated } from './notificationService.js';

const ensureContributionExists = async (contributionId: number): Promise<ContributionRecord> => {
  const contribution = await findContributionById(contributionId);
  if (!contribution) {
    throw new HttpError('Contribution not found', 404);
  }
  return contribution;
};

const normalizeFiles = (files: Express.Multer.File[] | undefined): Express.Multer.File[] => files ?? [];

const formatDate = (value: Date | string): string => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'unknown-date';
  }
  const [datePart = 'unknown-date'] = date.toISOString().split('T');
  return datePart;
};

const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

const extensionMap: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/bmp': '.bmp',
  'image/tiff': '.tif',
};

const getFileExtension = (file: Express.Multer.File): string => {
  const ext = path.extname(file.originalname).toLowerCase();
  return ext || extensionMap[file.mimetype] || '';
};

const resolveMember = async (memberId: number): Promise<MemberRecord> => {
  const member = await findMemberById(memberId);
  if (!member) {
    throw new HttpError('Member not found', 404);
  }
  return member;
};

const buildBaseName = (member: MemberRecord, contribution: ContributionRecord): string => {
  const memberName = slugify(member.name) || 'member';
  const amount = slugify(contribution.amount) || 'amount';
  const date = slugify(formatDate(contribution.contributeddate)) || 'date';
  return `${memberName}-${amount}-${date}`;
};

const buildFileName = (
  baseName: string,
  file: Express.Multer.File,
  index: number,
  total: number,
): string => {
  const suffix = total > 1 ? `-${index + 1}` : '';
  return `${baseName}${suffix}${getFileExtension(file)}`;
};

export const addContributionImages = async (
  contributionId: number,
  files: Express.Multer.File[] | undefined,
  options?: { notify?: boolean },
): Promise<ContributionImageRecord[]> => {
  const contribution = await ensureContributionExists(contributionId);
  const member = await resolveMember(contribution.memberid);
  const normalizedFiles = normalizeFiles(files);
  if (normalizedFiles.length === 0) {
    throw new HttpError('No images uploaded', 400);
  }

  const created: ContributionImageRecord[] = [];
  const uploadedUrls: string[] = [];
  const baseName = buildBaseName(member, contribution);

  try {
    for (const [index, file] of normalizedFiles.entries()) {
      const fileName = buildFileName(baseName, file, index, normalizedFiles.length);
      const { publicUrl } = await uploadDriveFile('contributions', file, fileName);
      uploadedUrls.push(publicUrl);
      const record = await createContributionImage(contributionId, publicUrl);
      created.push(record);
    }
  } catch (error) {
    for (const url of uploadedUrls) {
      try {
        await deleteDriveFileByUrl(url);
      } catch (cleanupError) {
        console.error('Failed to cleanup uploaded contribution image.', cleanupError);
      }
    }
    throw error;
  }

  if (options?.notify !== false) {
    void notifyContributionUpdated(contribution);
  }
  return created;
};

export const listContributionImagesById = async (contributionId: number): Promise<ContributionImageRecord[]> => {
  await ensureContributionExists(contributionId);
  return listContributionImages(contributionId);
};

export const replaceContributionImage = async (
  contributionId: number,
  imageId: number,
  file: Express.Multer.File | undefined,
): Promise<ContributionImageRecord> => {
  const contribution = await ensureContributionExists(contributionId);
  if (!file) {
    throw new HttpError('Image file is required', 400);
  }

  const existing = await findContributionImageById(imageId);
  if (!existing || existing.contributionid !== contributionId) {
    throw new HttpError('Contribution image not found', 404);
  }

  const member = await resolveMember(contribution.memberid);
  const baseName = buildBaseName(member, contribution);
  const fileName = buildFileName(baseName, file, 0, 1);
  const { publicUrl } = await uploadDriveFile('contributions', file, fileName);
  try {
    const updated = await updateContributionImage(imageId, publicUrl);
    try {
      await deleteDriveFileByUrl(existing.url);
    } catch (cleanupError) {
      console.error('Failed to delete replaced contribution image.', cleanupError);
    }
    void notifyContributionUpdated(contribution);
    return updated;
  } catch (error) {
    try {
      await deleteDriveFileByUrl(publicUrl);
    } catch (cleanupError) {
      console.error('Failed to cleanup newly uploaded contribution image.', cleanupError);
    }
    throw error;
  }
};

export const removeContributionImage = async (contributionId: number, imageId: number): Promise<void> => {
  await ensureContributionExists(contributionId);
  const existing = await findContributionImageById(imageId);
  if (!existing || existing.contributionid !== contributionId) {
    throw new HttpError('Contribution image not found', 404);
  }

  await deleteContributionImage(imageId);
  try {
    await deleteDriveFileByUrl(existing.url);
  } catch (error) {
    console.error('Failed to delete contribution image from Drive.', error);
  }
  const contribution = await findContributionById(contributionId);
  if (contribution) {
    void notifyContributionUpdated(contribution);
  }
};

export const cleanupContributionImages = async (images: ContributionImageRecord[]): Promise<void> => {
  for (const image of images) {
    try {
      await deleteDriveFileByUrl(image.url);
    } catch (error) {
      console.error('Failed to delete contribution image from Drive.', error);
    }
  }
};
