import type { NextFunction, Request, Response } from 'express';
import type { ZodError } from 'zod';

/**
 * Represents an HTTP-specific error with status code and optional details payload.
 */
export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 500, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Express error-handling middleware that normalises thrown errors into JSON responses.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (error: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  // Zod validation errors -> 400 with issues
  if (isZodError(error)) {
    res.status(400).json({ success: false, message: 'Request validation failed', details: error.issues });
    return;
  }
  // Domain errors -> provided status code
  if (error instanceof HttpError) {
    res.status(error.statusCode).json({ success: false, message: error.message, details: error.details ?? null });
    return;
  }
  // Database unique constraint -> 409 conflict
  if (isPgError(error) && error.code === '23505') {
    res.status(409).json({ success: false, message: 'Resource already exists', details: error.detail ?? null });
    return;
  }
  // Database foreign key constraint -> 404 not found
  if (isPgError(error) && error.code === '23503') {
    res.status(404).json({ success: false, message: 'Referenced resource not found', details: error.detail ?? null });
    return;
  }
  const fallback = error instanceof Error ? error : new Error('Unknown error');
  // eslint-disable-next-line no-console
  console.error(fallback);
  res.status(500).json({ success: false, message: 'Internal server error' });
};

function isZodError(err: unknown): err is ZodError {
  return typeof err === 'object' && err !== null && 'issues' in err && Array.isArray((err as any).issues);
}

type PgError = Error & { code?: string; detail?: string };
function isPgError(err: unknown): err is PgError {
  return typeof err === 'object' && err !== null && typeof (err as any).code === 'string';
}


