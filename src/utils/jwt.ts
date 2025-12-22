import jwt from 'jsonwebtoken';
import type { JwtPayload as JWTLibPayload, Secret, SignOptions } from 'jsonwebtoken';
import { getConfig } from '../config/env.js';

export interface AuthTokenPayload extends JWTLibPayload {
  readonly memberId: number;
  readonly email: string;
  readonly isAdmin?: boolean;
}

const { jwtSecret, jwtExpiresIn } = getConfig();

/**
 * Issues a signed JSON Web Token for the supplied payload.
 */
export const signToken = (payload: AuthTokenPayload): string => {
  const options: SignOptions = {};
  if (jwtExpiresIn) {
    options.expiresIn = jwtExpiresIn as unknown as NonNullable<SignOptions['expiresIn']>;
  }
  return jwt.sign(payload, jwtSecret as Secret, options);
};

/**
 * Validates and decodes the provided token, throwing on signature or expiry issues.
 */
export const verifyToken = (token: string): AuthTokenPayload => {
  const decoded = jwt.verify(token, jwtSecret);
  if (typeof decoded === 'string') {
    throw new TypeError('Invalid token payload');
  }
  return decoded as AuthTokenPayload;
};

