import { spawn } from 'node:child_process';
import { unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { getConfig } from '../config/env.js';
import { HttpError } from '../middlewares/errorHandler.js';
import { findMemberById } from '../repositories/memberRepository.js';
import { uploadDriveBuffer } from './driveService.js';
import { notifyDbBackupCompleted, notifyDbBackupFailed } from './notificationService.js';

let backupInProgress = false;

const buildDumpFileName = (): string => {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '_');
  return `pg_backup_${stamp}.dump`;
};

const runPgDump = (outputPath: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const { databaseUrl } = getConfig();
    const args = ['-Fc', '--schema=public', '--no-owner', '--no-acl', '-d', databaseUrl, '-f', outputPath];
    const child = spawn('pg_dump', args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `pg_dump exited with code ${code}`));
    });
  });

export const startDbBackup = async (adminMemberId: number): Promise<void> => {
  if (backupInProgress) {
    throw new HttpError('A database backup is already in progress', 409);
  }

  if (!process.env.DATABASE_URL && !getConfig().databaseUrl) {
    throw new HttpError('Database connection is not configured', 500);
  }

  backupInProgress = true;
  const fileName = buildDumpFileName();
  const tempPath = path.join(tmpdir(), fileName);

  void (async () => {
    try {
      await runPgDump(tempPath);
      const { fileId } = await uploadDriveBuffer('backups', tempPath, fileName, 'application/octet-stream');
      const admin = await findMemberById(adminMemberId);
      if (admin?.email) {
        await notifyDbBackupCompleted(admin, fileName, fileId);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Database backup failed.', error);
      try {
        const admin = await findMemberById(adminMemberId);
        if (admin?.email) {
          await notifyDbBackupFailed(admin, message);
        }
      } catch (notifyError) {
        console.error('Failed to send backup failure email.', notifyError);
      }
    } finally {
      await unlink(tempPath).catch(() => undefined);
      backupInProgress = false;
    }
  })();
};
