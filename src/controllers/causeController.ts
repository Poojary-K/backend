import type { Request, Response, NextFunction } from 'express';
import { getCauses, registerCause, getCauseById, updateCauseById, deleteCauseById } from '../services/causeService.js';
import type { z } from 'zod';
import type { causeSchema } from '../schemas/causeSchemas.js';

/**
 * Creates a fundraising cause.
 * Request body is validated by validateRequest middleware.
 */
export const createCauseHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = req.body as z.infer<typeof causeSchema>;
    const cause = await registerCause(payload);
    res.status(201).json({ success: true, data: cause });
  } catch (error) {
    next(error);
  }
};

/**
 * Lists all causes.
 */
export const listCausesHandler = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const causes = await getCauses();
    res.status(200).json({ success: true, data: { causes } });
  } catch (error) {
    next(error);
  }
};

/**
 * Gets a single cause by ID.
 */
export const getCauseByIdHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const idParam = req.params.id;
    if (!idParam) {
      res.status(400).json({ success: false, message: 'Cause ID is required' });
      return;
    }
    const id = Number.parseInt(idParam, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid cause ID' });
      return;
    }
    const cause = await getCauseById(id);
    res.status(200).json({ success: true, data: cause, message: 'Cause retrieved successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Updates a cause by ID.
 */
export const updateCauseHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const idParam = req.params.id;
    if (!idParam) {
      res.status(400).json({ success: false, message: 'Cause ID is required' });
      return;
    }
    const id = Number.parseInt(idParam, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid cause ID' });
      return;
    }
    const payload = req.body as z.infer<typeof causeSchema>;
    const cause = await updateCauseById(id, payload);
    res.status(200).json({ success: true, data: cause, message: 'Cause updated successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Deletes a cause by ID.
 */
export const deleteCauseHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const idParam = req.params.id;
    if (!idParam) {
      res.status(400).json({ success: false, message: 'Cause ID is required' });
      return;
    }
    const id = Number.parseInt(idParam, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid cause ID' });
      return;
    }
    await deleteCauseById(id);
    res.status(200).json({ success: true, message: 'Cause deleted successfully' });
  } catch (error) {
    next(error);
  }
};


