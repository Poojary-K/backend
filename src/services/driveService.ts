import { google, type drive_v3 } from 'googleapis';
import { Readable } from 'node:stream';
import path from 'node:path';
import { HttpError } from '../middlewares/errorHandler.js';
import { getConfig } from '../config/env.js';

export type DriveFolderKey = 'contributions' | 'causes';

const folderNames: Record<DriveFolderKey, string> = {
  contributions: 'contributions',
  causes: 'causes',
};

let driveClient: drive_v3.Drive | null = null;
const folderCache = new Map<DriveFolderKey, string>();

const getAuthClient = async () => {
  const {
    gdriveOauthClientId,
    gdriveOauthClientSecret,
    gdriveOauthRedirectUri,
    gdriveOauthRefreshToken,
  } = getConfig();

  const hasOauth =
    Boolean(gdriveOauthClientId) && Boolean(gdriveOauthClientSecret) && Boolean(gdriveOauthRefreshToken);

  if (hasOauth) {
    const oauthClient = new google.auth.OAuth2(
      gdriveOauthClientId,
      gdriveOauthClientSecret,
      gdriveOauthRedirectUri || undefined,
    );
    oauthClient.setCredentials({ refresh_token: gdriveOauthRefreshToken });
    return oauthClient;
  }

  throw new HttpError('Google Drive OAuth credentials are not configured', 500);
};

const getDriveClient = async (): Promise<drive_v3.Drive> => {
  if (driveClient) {
    return driveClient;
  }

  const auth = await getAuthClient();

  driveClient = google.drive({ version: 'v3', auth });
  return driveClient;
};

const findFolderId = async (folderName: string, parentId?: string): Promise<string | null> => {
  const drive = await getDriveClient();
  const parentQuery = parentId ? `'${parentId}' in parents and ` : '';
  const query = `${parentQuery}mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`;

  const result = await drive.files.list({
    q: query,
    fields: 'files(id,name)',
    spaces: 'drive',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const folder = result.data.files?.[0];
  return folder?.id ?? null;
};

const createFolder = async (folderName: string, parentId?: string): Promise<string> => {
  const drive = await getDriveClient();
  const requestBody: drive_v3.Schema$File = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) {
    requestBody.parents = [parentId];
  }
  const response = await drive.files.create({
    requestBody,
    fields: 'id',
    supportsAllDrives: true,
  });

  const folderId = response.data.id;
  if (!folderId) {
    throw new HttpError('Failed to create Google Drive folder', 500);
  }

  return folderId;
};

const resolveFolderId = async (key: DriveFolderKey): Promise<string> => {
  const cached = folderCache.get(key);
  if (cached) {
    return cached;
  }

  const { gdriveParentFolderId, gdriveContributionFolderId, gdriveCauseFolderId } = getConfig();
  const configuredId = key === 'contributions' ? gdriveContributionFolderId : gdriveCauseFolderId;
  if (configuredId) {
    folderCache.set(key, configuredId);
    return configuredId;
  }

  const folderName = folderNames[key];
  const existingId = await findFolderId(folderName, gdriveParentFolderId || undefined);
  if (existingId) {
    folderCache.set(key, existingId);
    return existingId;
  }

  const createdId = await createFolder(folderName, gdriveParentFolderId || undefined);
  folderCache.set(key, createdId);
  return createdId;
};

const buildPublicUrl = (fileId: string): string => `https://drive.google.com/uc?id=${fileId}`;

export const extractFileId = (url: string): string | null => {
  const match =
    url.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
    url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return match?.[1] ?? null;
};

export const uploadDriveFile = async (
  folderKey: DriveFolderKey,
  file: Express.Multer.File,
  fileName: string,
): Promise<{ fileId: string; publicUrl: string }> => {
  const drive = await getDriveClient();
  const folderId = await resolveFolderId(folderKey);
  const safeName = path.basename(fileName);

  const response = await drive.files.create({
    requestBody: {
      name: safeName,
      parents: [folderId],
    },
    media: {
      mimeType: file.mimetype,
      body: Readable.from(file.buffer),
    },
    fields: 'id',
    supportsAllDrives: true,
  });

  const fileId = response.data.id;
  if (!fileId) {
    throw new HttpError('Failed to upload file to Google Drive', 500);
  }

  await drive.permissions.create({
    fileId,
    requestBody: {
      type: 'anyone',
      role: 'reader',
    },
    supportsAllDrives: true,
  });

  return { fileId, publicUrl: buildPublicUrl(fileId) };
};

export const deleteDriveFile = async (fileId: string): Promise<void> => {
  const drive = await getDriveClient();
  await drive.files.delete({ fileId, supportsAllDrives: true });
};

export const deleteDriveFileByUrl = async (url: string): Promise<void> => {
  const fileId = extractFileId(url);
  if (!fileId) {
    return;
  }
  await deleteDriveFile(fileId);
};
