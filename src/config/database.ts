import { Pool } from 'pg';
import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { getConfig } from './env.js';

let pool: Pool | null = null;

/**
 * Lazily instantiates and returns the shared PostgreSQL connection pool.
 */
export const getPool = (): Pool => {
  if (pool === null) {
    const { databaseUrl } = getConfig();
    pool = new Pool({ connectionString: databaseUrl });
  }
  return pool;
};

/**
 * Executes a parameterised SQL query using the shared pool.
 */
export const query = async <T extends QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>> => {
  if (params === undefined) {
    return getPool().query<T>(text);
  }
  return getPool().query<T>(text, params);
};

/**
 * Acquires a dedicated client from the pool for transactional operations.
 */
export const getClient = async (): Promise<PoolClient> => getPool().connect();

/**
 * Gracefully terminates the shared pool. Intended for test suites and shutdown hooks.
 */
export const closePool = async (): Promise<void> => {
  if (pool === null) {
    return;
  }
  await pool.end();
  pool = null;
};

