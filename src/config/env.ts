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
  readonly mailEnabled: boolean;
  readonly mailFrom: string;
  readonly mailUser: string;
  readonly mailPass: string;
}

const parseNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
};

const config: AppConfig = {
  port: parseNumber(process.env.PORT, 4000),
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/funds',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
  bcryptSaltRounds: parseNumber(process.env.BCRYPT_SALT_ROUNDS, 10),
  adminSecretCode: process.env.ADMIN_SECRET_CODE ?? 'admin-secret-change-me',
  mailEnabled: parseBoolean(
    process.env.MAIL_ENABLED,
    Boolean(process.env.MAIL_FROM && process.env.MAIL_PASS),
  ),
  mailFrom: process.env.MAIL_FROM ?? '',
  mailUser: process.env.MAIL_USER ?? process.env.MAIL_FROM ?? '',
  mailPass: process.env.MAIL_PASS ?? '',
};

/**
 * Returns the immutable application configuration for the current runtime.
 */
export const getConfig = (): AppConfig => config;

