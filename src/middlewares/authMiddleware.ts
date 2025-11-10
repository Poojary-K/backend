import type { NextFunction, Request, Response } from 'express';
import { HttpError } from './errorHandler.js';
import { verifyToken } from '../utils/jwt.js';

/**
 * Ensures the incoming request presents a valid bearer token and attaches its payload to the request.
 */
export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.header('Authorization');
  if (!authHeader) {
    next(new HttpError('Authorization header missing', 401));
    return;
  }
  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    next(new HttpError('Invalid authorization header format', 401));
    return;
  }
  try {
    req.user = verifyToken(token);
  } catch (error) {
    const details = error instanceof Error ? error.message : 'Token verification failed';
    next(new HttpError('Invalid or expired token', 401, details));
    return;
  }
  next();
};

