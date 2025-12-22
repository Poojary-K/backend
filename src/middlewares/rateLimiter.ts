import type { Request, Response, NextFunction } from 'express';
import { HttpError } from './errorHandler.js';

// Simple in-memory rate limiter (for production, consider Redis-based solution)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000; // 15 minutes default
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100; // 100 requests per window default

/**
 * Rate limiting middleware to prevent API abuse.
 * Tracks requests per IP address within a time window.
 */
export const rateLimiter = (req: Request, res: Response, next: NextFunction): void => {
  const clientId = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  // Clean up old entries periodically
  if (requestCounts.size > 10000) {
    for (const [key, value] of requestCounts.entries()) {
      if (value.resetTime < now) {
        requestCounts.delete(key);
      }
    }
  }

  const record = requestCounts.get(clientId);

  if (!record || record.resetTime < now) {
    // New window or expired window
    requestCounts.set(clientId, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    });
    next();
    return;
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    res.setHeader('Retry-After', retryAfter.toString());
    next(new HttpError('Too many requests, please try again later', 429));
    return;
  }

  // Increment count
  record.count += 1;
  requestCounts.set(clientId, record);
  next();
};



