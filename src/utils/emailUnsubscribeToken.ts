import jwt from 'jsonwebtoken';
import type { Secret } from 'jsonwebtoken';
import { getConfig } from '../config/env.js';

const UNSUBSCRIBE_PURPOSE = 'email_unsubscribe';

interface UnsubscribePayload {
  readonly memberId: number;
  readonly purpose: typeof UNSUBSCRIBE_PURPOSE;
}

/**
 * JWT used only for one-click / link-based email preference unsubscribes (not bearer auth).
 */
export const signEmailUnsubscribeToken = (memberId: number): string => {
  const { jwtSecret } = getConfig();
  const payload: UnsubscribePayload = { memberId, purpose: UNSUBSCRIBE_PURPOSE };
  return jwt.sign(payload, jwtSecret as Secret, { expiresIn: '365d' });
};

/**
 * Validates an unsubscribe token and returns the member id.
 */
export const verifyEmailUnsubscribeToken = (token: string): number => {
  const { jwtSecret } = getConfig();
  const decoded = jwt.verify(token, jwtSecret);
  if (typeof decoded === 'string') {
    throw new TypeError('Invalid unsubscribe token');
  }
  const record = decoded as Record<string, unknown>;
  if (record.purpose !== UNSUBSCRIBE_PURPOSE || typeof record.memberId !== 'number') {
    throw new TypeError('Invalid unsubscribe token');
  }
  return record.memberId;
};
