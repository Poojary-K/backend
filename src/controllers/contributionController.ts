import type { Request, Response, NextFunction } from 'express';
import {
  recordContribution,
  getContributions,
  getContributionById,
  updateContributionById,
  deleteContributionById,
  canModifyContribution,
} from '../services/contributionService.js';
import { addContributionImages } from '../services/contributionImageService.js';
import { notifyContributionCreated } from '../services/notificationService.js';
import { HttpError } from '../middlewares/errorHandler.js';
import type { z } from 'zod';
import { contributionSchema } from '../schemas/contributionSchemas.js';

/**
 * Handles the creation of contributions.
 * Request body is validated by validateRequest middleware.
 */
export const createContributionHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = req.body as z.infer<typeof contributionSchema>;
    const contribution = await recordContribution(payload);
    res.status(201).json({ success: true, data: contribution });
  } catch (error) {
    next(error);
  }
};

/**
 * Creates a contribution with optional images in a single request (multipart/form-data).
 */
export const createContributionWithImagesHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const payload = {
      memberId: Number.parseInt(req.body.memberId, 10),
      amount: Number.parseFloat(req.body.amount),
      contributedDate: req.body.contributedDate,
    } as z.infer<typeof contributionSchema>;

    const parsed = contributionSchema.safeParse(payload);
    if (!parsed.success) {
      next(parsed.error);
      return;
    }

    const contribution = await recordContribution(parsed.data, { notify: false });
    const files = req.files as Express.Multer.File[] | undefined;
    if (files && files.length > 0) {
      await addContributionImages(contribution.contributionid, files, { notify: false });
    }

    void notifyContributionCreated(contribution);
    res.status(201).json({ success: true, data: contribution });
  } catch (error) {
    next(error);
  }
};

/**
 * Lists contributions.
 */
export const listContributionsHandler = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const contributions = await getContributions();
    res.status(200).json({ success: true, data: { contributions } });
  } catch (error) {
    next(error);
  }
};

/**
 * Gets a single contribution by ID.
 */
export const getContributionByIdHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const idParam = req.params.id;
    if (!idParam) {
      res.status(400).json({ success: false, message: 'Contribution ID is required' });
      return;
    }
    const id = Number.parseInt(idParam, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid contribution ID' });
      return;
    }
    const contribution = await getContributionById(id);
    res.status(200).json({ success: true, data: contribution, message: 'Contribution retrieved successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Updates a contribution by ID. Admin or owner can update.
 */
export const updateContributionHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const idParam = req.params.id;
    if (!idParam) {
      res.status(400).json({ success: false, message: 'Contribution ID is required' });
      return;
    }
    const id = Number.parseInt(idParam, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid contribution ID' });
      return;
    }

    if (!req.user) {
      next(new HttpError('Authentication required', 401));
      return;
    }

    // Check if user is admin or owner
    const canModify = await canModifyContribution(id, req.user.memberId, req.user.isAdmin ?? false);
    if (!canModify) {
      next(new HttpError('You do not have permission to modify this contribution', 403));
      return;
    }

    const payload = req.body as z.infer<typeof contributionSchema>;
    const contribution = await updateContributionById(id, payload);
    res.status(200).json({ success: true, data: contribution, message: 'Contribution updated successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Deletes a contribution by ID. Admin or owner can delete.
 */
export const deleteContributionHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const idParam = req.params.id;
    if (!idParam) {
      res.status(400).json({ success: false, message: 'Contribution ID is required' });
      return;
    }
    const id = Number.parseInt(idParam, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid contribution ID' });
      return;
    }

    if (!req.user) {
      next(new HttpError('Authentication required', 401));
      return;
    }

    // Check if user is admin or owner
    const canModify = await canModifyContribution(id, req.user.memberId, req.user.isAdmin ?? false);
    if (!canModify) {
      next(new HttpError('You do not have permission to delete this contribution', 403));
      return;
    }

    await deleteContributionById(id);
    res.status(200).json({ success: true, message: 'Contribution deleted successfully' });
  } catch (error) {
    next(error);
  }
};
