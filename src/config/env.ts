import dotenv from 'dotenv';

dotenv.config();

/**
 * Represents the resolved application configuration sourced from environment variables.
 */
export interface AppConfig {
  readonly port: number;
  readonly databaseUrl: string;
  readonly jwtSecret: string;
  readonly jwtExpiresIn: string;
  readonly bcryptSaltRounds: number;
  readonly adminSecretCode: string;
}

const parseNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const config: AppConfig = {
  port: parseNumber(process.env.PORT, 4000),
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/funds',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
  bcryptSaltRounds: parseNumber(process.env.BCRYPT_SALT_ROUNDS, 10),
  adminSecretCode: process.env.ADMIN_SECRET_CODE ?? 'admin-secret-change-me',
};

/**
 * Returns the immutable application configuration for the current runtime.
 */
export const getConfig = (): AppConfig => config;


