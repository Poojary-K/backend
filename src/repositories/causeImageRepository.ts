import type { QueryResult } from 'pg';
import { query } from '../config/database.js';

export interface CauseImageRecord {
  readonly imageid: number;
  readonly causeid: number;
  readonly url: string;
  readonly createdat: Date;
}

export const createCauseImage = async (causeId: number, url: string): Promise<CauseImageRecord> => {
  const text = `
    INSERT INTO cause_images (causeid, url)
    VALUES ($1, $2)
    RETURNING imageid, causeid, url, createdat;
  `;
  const result = await query<CauseImageRecord>(text, [causeId, url]);
  const row = result.rows[0];
  if (!row) {
    throw new Error('Failed to create cause image');
  }
  return row;
};

export const listCauseImages = async (causeId: number): Promise<CauseImageRecord[]> => {
  const text = `
    SELECT imageid, causeid, url, createdat
    FROM cause_images
    WHERE causeid = $1
    ORDER BY createdat DESC;
  `;
  const result: QueryResult<CauseImageRecord> = await query<CauseImageRecord>(text, [causeId]);
  return result.rows;
};

export const findCauseImageById = async (imageId: number): Promise<CauseImageRecord | null> => {
  const text = `
    SELECT imageid, causeid, url, createdat
    FROM cause_images
    WHERE imageid = $1
    LIMIT 1;
  `;
  const result = await query<CauseImageRecord>(text, [imageId]);
  return result.rows[0] ?? null;
};

export const updateCauseImage = async (imageId: number, url: string): Promise<CauseImageRecord> => {
  const text = `
    UPDATE cause_images
    SET url = $1
    WHERE imageid = $2
    RETURNING imageid, causeid, url, createdat;
  `;
  const result = await query<CauseImageRecord>(text, [url, imageId]);
  const row = result.rows[0];
  if (!row) {
    throw new Error('Cause image not found');
  }
  return row;
};

export const deleteCauseImage = async (imageId: number): Promise<void> => {
  const text = `DELETE FROM cause_images WHERE imageid = $1;`;
  const result = await query(text, [imageId]);
  if (result.rowCount === 0) {
    throw new Error('Cause image not found');
  }
};
