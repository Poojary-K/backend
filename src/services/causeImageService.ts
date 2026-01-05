import type { CauseImageRecord } from '../repositories/causeImageRepository.js';
import {
  createCauseImage,
  listCauseImages,
  findCauseImageById,
  updateCauseImage,
  deleteCauseImage,
} from '../repositories/causeImageRepository.js';
import { findCauseById, type CauseRecord } from '../repositories/causeRepository.js';
import { HttpError } from '../middlewares/errorHandler.js';
import { deleteDriveFileByUrl, uploadDriveFile } from './driveService.js';
import path from 'node:path';
import { notifyCauseUpdated } from './notificationService.js';

const ensureCauseExists = async (causeId: number): Promise<CauseRecord> => {
  const cause = await findCauseById(causeId);
  if (!cause) {
    throw new HttpError('Cause not found', 404);
  }
  return cause;
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

const buildBaseName = (cause: CauseRecord): string => {
  const title = slugify(cause.title) || 'cause';
  const amount = slugify(cause.amount ?? 'na') || 'amount';
  const date = slugify(formatDate(cause.createdat)) || 'date';
  return `${title}-${amount}-${date}`;
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

export const addCauseImages = async (
  causeId: number,
  files: Express.Multer.File[] | undefined,
  options?: { notify?: boolean },
): Promise<CauseImageRecord[]> => {
  const cause = await ensureCauseExists(causeId);
  const normalizedFiles = normalizeFiles(files);
  if (normalizedFiles.length === 0) {
    throw new HttpError('No images uploaded', 400);
  }

  const created: CauseImageRecord[] = [];
  const uploadedUrls: string[] = [];
  const baseName = buildBaseName(cause);

  try {
    for (const [index, file] of normalizedFiles.entries()) {
      const fileName = buildFileName(baseName, file, index, normalizedFiles.length);
      const { publicUrl } = await uploadDriveFile('causes', file, fileName);
      uploadedUrls.push(publicUrl);
      const record = await createCauseImage(causeId, publicUrl);
      created.push(record);
    }
  } catch (error) {
    for (const url of uploadedUrls) {
      try {
        await deleteDriveFileByUrl(url);
      } catch (cleanupError) {
        console.error('Failed to cleanup uploaded cause image.', cleanupError);
      }
    }
    throw error;
  }

  if (options?.notify !== false) {
    void notifyCauseUpdated(cause);
  }
  return created;
};

export const listCauseImagesById = async (causeId: number): Promise<CauseImageRecord[]> => {
  await ensureCauseExists(causeId);
  return listCauseImages(causeId);
};

export const replaceCauseImage = async (
  causeId: number,
  imageId: number,
  file: Express.Multer.File | undefined,
): Promise<CauseImageRecord> => {
  const cause = await ensureCauseExists(causeId);
  if (!file) {
    throw new HttpError('Image file is required', 400);
  }

  const existing = await findCauseImageById(imageId);
  if (!existing || existing.causeid !== causeId) {
    throw new HttpError('Cause image not found', 404);
  }

  const baseName = buildBaseName(cause);
  const fileName = buildFileName(baseName, file, 0, 1);
  const { publicUrl } = await uploadDriveFile('causes', file, fileName);
  try {
    const updated = await updateCauseImage(imageId, publicUrl);
    try {
      await deleteDriveFileByUrl(existing.url);
    } catch (cleanupError) {
      console.error('Failed to delete replaced cause image.', cleanupError);
    }
    void notifyCauseUpdated(cause);
    return updated;
  } catch (error) {
    try {
      await deleteDriveFileByUrl(publicUrl);
    } catch (cleanupError) {
      console.error('Failed to cleanup newly uploaded cause image.', cleanupError);
    }
    throw error;
  }
};

export const removeCauseImage = async (causeId: number, imageId: number): Promise<void> => {
  const cause = await ensureCauseExists(causeId);
  const existing = await findCauseImageById(imageId);
  if (!existing || existing.causeid !== causeId) {
    throw new HttpError('Cause image not found', 404);
  }

  await deleteCauseImage(imageId);
  try {
    await deleteDriveFileByUrl(existing.url);
  } catch (error) {
    console.error('Failed to delete cause image from Drive.', error);
  }
  void notifyCauseUpdated(cause);
};

export const cleanupCauseImages = async (images: CauseImageRecord[]): Promise<void> => {
  for (const image of images) {
    try {
      await deleteDriveFileByUrl(image.url);
    } catch (error) {
      console.error('Failed to delete cause image from Drive.', error);
    }
  }
};
