import dotenv from 'dotenv';

dotenv.config();

/**
 * Represents the resolved application configuration sourced from environment variables.
 */
export interface AppConfig {
  readonly port: number;
  readonly appBaseUrl: string;
  readonly clientBaseUrl: string;
  readonly databaseUrl: string;
  readonly jwtSecret: string;
  readonly jwtExpiresIn: string;
  readonly bcryptSaltRounds: number;
  readonly adminSecretCode: string;
  readonly mailEnabled: boolean;
  readonly mailProvider: 'auto' | 'smtp' | 'resend';
  readonly mailFrom: string;
  readonly mailUser: string;
  readonly mailPass: string;
  readonly resendApiKey: string;
  readonly gdriveParentFolderId: string;
  readonly gdriveContributionFolderId: string;
  readonly gdriveCauseFolderId: string;
  readonly gdriveMaxFileSizeMb: number;
  readonly gdriveMaxFiles: number;
  readonly gdriveOauthClientId: string;
  readonly gdriveOauthClientSecret: string;
  readonly gdriveOauthRedirectUri: string;
  readonly gdriveOauthRefreshToken: string;
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

const parseMailProvider = (value: string | undefined): 'auto' | 'smtp' | 'resend' => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'smtp' || normalized === 'resend') {
    return normalized;
  }
  return 'auto';
};

const hasResendConfig = Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
const hasSmtpConfig = Boolean(process.env.MAIL_FROM && process.env.MAIL_PASS);

const config: AppConfig = {
  port: parseNumber(process.env.PORT, 4000),
  appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:4000',
  clientBaseUrl: process.env.CLIENT_BASE_URL ?? '',
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/funds',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
  bcryptSaltRounds: parseNumber(process.env.BCRYPT_SALT_ROUNDS, 10),
  adminSecretCode: process.env.ADMIN_SECRET_CODE ?? 'admin-secret-change-me',
  mailEnabled: parseBoolean(
    process.env.MAIL_ENABLED,
    hasResendConfig || hasSmtpConfig,
  ),
  mailProvider: parseMailProvider(process.env.MAIL_PROVIDER),
  mailFrom: process.env.MAIL_FROM ?? '',
  mailUser: process.env.MAIL_USER ?? process.env.MAIL_FROM ?? '',
  mailPass: process.env.MAIL_PASS ?? '',
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  gdriveParentFolderId: process.env.GDRIVE_PARENT_FOLDER_ID ?? '',
  gdriveContributionFolderId: process.env.GDRIVE_CONTRIB_FOLDER_ID ?? '',
  gdriveCauseFolderId: process.env.GDRIVE_CAUSE_FOLDER_ID ?? '',
  gdriveMaxFileSizeMb: parseNumber(process.env.GDRIVE_MAX_FILE_SIZE_MB, 10),
  gdriveMaxFiles: parseNumber(process.env.GDRIVE_MAX_FILES, 10),
  gdriveOauthClientId: process.env.GDRIVE_OAUTH_CLIENT_ID ?? '',
  gdriveOauthClientSecret: process.env.GDRIVE_OAUTH_CLIENT_SECRET ?? '',
  gdriveOauthRedirectUri: process.env.GDRIVE_OAUTH_REDIRECT_URI ?? '',
  gdriveOauthRefreshToken: process.env.GDRIVE_OAUTH_REFRESH_TOKEN ?? '',
};

/**
 * Returns the immutable application configuration for the current runtime.
 */
export const getConfig = (): AppConfig => config;
