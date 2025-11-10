import bcrypt from 'bcrypt';
import { getConfig } from '../config/env.js';

const { bcryptSaltRounds } = getConfig();

/**
 * Hashes the provided plaintext password using bcrypt with the configured salt rounds.
 */
export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, bcryptSaltRounds);
};

/**
 * Compares a candidate password against a previously hashed password.
 */
export const verifyPassword = async (candidate: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(candidate, hash);
};


