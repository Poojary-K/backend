import type { QueryResult } from 'pg';
import { query } from '../config/database.js';

export interface ContributionImageRecord {
  readonly imageid: number;
  readonly contributionid: number;
  readonly url: string;
  readonly createdat: Date;
}

export const createContributionImage = async (
  contributionId: number,
  url: string,
): Promise<ContributionImageRecord> => {
  const text = `
    INSERT INTO contribution_images (contributionid, url)
    VALUES ($1, $2)
    RETURNING imageid, contributionid, url, createdat;
  `;
  const result = await query<ContributionImageRecord>(text, [contributionId, url]);
  const row = result.rows[0];
  if (!row) {
    throw new Error('Failed to create contribution image');
  }
  return row;
};

export const listContributionImages = async (contributionId: number): Promise<ContributionImageRecord[]> => {
  const text = `
    SELECT imageid, contributionid, url, createdat
    FROM contribution_images
    WHERE contributionid = $1
    ORDER BY createdat DESC;
  `;
  const result: QueryResult<ContributionImageRecord> = await query<ContributionImageRecord>(text, [contributionId]);
  return result.rows;
};

export const findContributionImageById = async (imageId: number): Promise<ContributionImageRecord | null> => {
  const text = `
    SELECT imageid, contributionid, url, createdat
    FROM contribution_images
    WHERE imageid = $1
    LIMIT 1;
  `;
  const result = await query<ContributionImageRecord>(text, [imageId]);
  return result.rows[0] ?? null;
};

export const updateContributionImage = async (
  imageId: number,
  url: string,
): Promise<ContributionImageRecord> => {
  const text = `
    UPDATE contribution_images
    SET url = $1
    WHERE imageid = $2
    RETURNING imageid, contributionid, url, createdat;
  `;
  const result = await query<ContributionImageRecord>(text, [url, imageId]);
  const row = result.rows[0];
  if (!row) {
    throw new Error('Contribution image not found');
  }
  return row;
};

export const deleteContributionImage = async (imageId: number): Promise<void> => {
  const text = `DELETE FROM contribution_images WHERE imageid = $1;`;
  const result = await query(text, [imageId]);
  if (result.rowCount === 0) {
    throw new Error('Contribution image not found');
  }
};
