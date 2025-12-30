import type { Request, Response, NextFunction } from 'express';
import { HttpError } from '../middlewares/errorHandler.js';
import { canModifyContribution } from '../services/contributionService.js';
import {
  addContributionImages,
  listContributionImagesById,
  replaceContributionImage,
  removeContributionImage,
} from '../services/contributionImageService.js';

const parseIdParam = (value: string | undefined): number | null => {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

export const listContributionImagesHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const contributionId = parseIdParam(req.params.id);
    if (!contributionId) {
      res.status(400).json({ success: false, message: 'Invalid contribution ID' });
      return;
    }

    const images = await listContributionImagesById(contributionId);
    res.status(200).json({ success: true, data: { images } });
  } catch (error) {
    next(error);
  }
};

export const addContributionImagesHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const contributionId = parseIdParam(req.params.id);
    if (!contributionId) {
      res.status(400).json({ success: false, message: 'Invalid contribution ID' });
      return;
    }

    if (!req.user) {
      next(new HttpError('Authentication required', 401));
      return;
    }
    const canModify = await canModifyContribution(contributionId, req.user.memberId, req.user.isAdmin ?? false);
    if (!canModify) {
      next(new HttpError('You do not have permission to modify this contribution', 403));
      return;
    }

    const images = await addContributionImages(contributionId, req.files as Express.Multer.File[] | undefined);
    res.status(201).json({ success: true, data: { images } });
  } catch (error) {
    next(error);
  }
};

export const replaceContributionImageHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const contributionId = parseIdParam(req.params.id);
    const imageId = parseIdParam(req.params.imageId);
    if (!contributionId || !imageId) {
      res.status(400).json({ success: false, message: 'Invalid contribution image ID' });
      return;
    }

    if (!req.user) {
      next(new HttpError('Authentication required', 401));
      return;
    }
    const canModify = await canModifyContribution(contributionId, req.user.memberId, req.user.isAdmin ?? false);
    if (!canModify) {
      next(new HttpError('You do not have permission to modify this contribution', 403));
      return;
    }

    const image = await replaceContributionImage(
      contributionId,
      imageId,
      req.file as Express.Multer.File | undefined,
    );
    res.status(200).json({ success: true, data: image });
  } catch (error) {
    next(error);
  }
};

export const deleteContributionImageHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const contributionId = parseIdParam(req.params.id);
    const imageId = parseIdParam(req.params.imageId);
    if (!contributionId || !imageId) {
      res.status(400).json({ success: false, message: 'Invalid contribution image ID' });
      return;
    }

    if (!req.user) {
      next(new HttpError('Authentication required', 401));
      return;
    }
    const canModify = await canModifyContribution(contributionId, req.user.memberId, req.user.isAdmin ?? false);
    if (!canModify) {
      next(new HttpError('You do not have permission to modify this contribution', 403));
      return;
    }

    await removeContributionImage(contributionId, imageId);
    res.status(200).json({ success: true, message: 'Contribution image deleted successfully' });
  } catch (error) {
    next(error);
  }
};
