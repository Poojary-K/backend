import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { HttpError } from './errorHandler.js';

type RequestLocation = 'body' | 'query' | 'params';

/**
 * Produces a middleware that validates a specific request location against a zod schema.
 */
export const validateRequest = (schema: ZodType<unknown>, location: RequestLocation = 'body') => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const target = req[location];
    const result = schema.safeParse(target);
    if (!result.success) {
      const issues = result.error.issues.map((issue: (typeof result.error.issues)[number]) => ({
        path: issue.path,
        message: issue.message,
      }));
      next(new HttpError('Request validation failed', 400, issues));
      return;
    }
    // Normalise the request property with the parsed value to ensure correct types downstream.
    if (location === 'body') {
      req.body = result.data;
    } else if (target && typeof target === 'object' && result.data && typeof result.data === 'object') {
      Object.assign(target as Record<string, unknown>, result.data);
    }
    next();
  };
};
