import type { Request, Response, NextFunction } from 'express';
import {
  addCauseImages,
  listCauseImagesById,
  replaceCauseImage,
  removeCauseImage,
} from '../services/causeImageService.js';

const parseIdParam = (value: string | undefined): number | null => {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

export const listCauseImagesHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const causeId = parseIdParam(req.params.id);
    if (!causeId) {
      res.status(400).json({ success: false, message: 'Invalid cause ID' });
      return;
    }

    const images = await listCauseImagesById(causeId);
    res.status(200).json({ success: true, data: { images } });
  } catch (error) {
    next(error);
  }
};

export const addCauseImagesHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const causeId = parseIdParam(req.params.id);
    if (!causeId) {
      res.status(400).json({ success: false, message: 'Invalid cause ID' });
      return;
    }

    const images = await addCauseImages(causeId, req.files as Express.Multer.File[] | undefined);
    res.status(201).json({ success: true, data: { images } });
  } catch (error) {
    next(error);
  }
};

export const replaceCauseImageHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const causeId = parseIdParam(req.params.id);
    const imageId = parseIdParam(req.params.imageId);
    if (!causeId || !imageId) {
      res.status(400).json({ success: false, message: 'Invalid cause image ID' });
      return;
    }

    const image = await replaceCauseImage(causeId, imageId, req.file as Express.Multer.File | undefined);
    res.status(200).json({ success: true, data: image });
  } catch (error) {
    next(error);
  }
};

export const deleteCauseImageHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const causeId = parseIdParam(req.params.id);
    const imageId = parseIdParam(req.params.imageId);
    if (!causeId || !imageId) {
      res.status(400).json({ success: false, message: 'Invalid cause image ID' });
      return;
    }

    await removeCauseImage(causeId, imageId);
    res.status(200).json({ success: true, message: 'Cause image deleted successfully' });
  } catch (error) {
    next(error);
  }
};
