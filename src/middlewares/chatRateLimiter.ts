import type { Request, Response, NextFunction } from 'express';
import { HttpError } from './errorHandler.js';
import { getConfig } from '../config/env.js';

// Per-member sliding window counter (in-memory; sufficient for a single instance).
const requestCounts = new Map<string, { count: number; resetTime: number }>();

/**
 * Stricter rate limiter for the LLM-backed chat message endpoint, keyed per member.
 */
export const chatRateLimiter = (req: Request, _res: Response, next: NextFunction): void => {
  const { chatRateLimitWindowMs, chatRateLimitMaxRequests } = getConfig();
  const clientId = req.user ? `member:${req.user.memberId}` : req.ip ?? 'unknown';
  const now = Date.now();

  const record = requestCounts.get(clientId);
  if (!record || record.resetTime < now) {
    requestCounts.set(clientId, { count: 1, resetTime: now + chatRateLimitWindowMs });
    next();
    return;
  }

  if (record.count >= chatRateLimitMaxRequests) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    next(new HttpError(`Too many chat requests, please retry in ${retryAfter}s`, 429));
    return;
  }

  record.count += 1;
  next();
};
