import type { NextFunction, Request, Response } from 'express';
import { HttpError } from './errorHandler.js';

/**
 * Middleware that ensures the authenticated user is an admin.
 * Must be used after the authenticate middleware.
 */
export const requireAdmin = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user) {
    next(new HttpError('Authentication required', 401));
    return;
  }

  if (!req.user.isAdmin) {
    next(new HttpError('Admin privileges required', 403));
    return;
  }

  next();
};

