import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/evo_db';
const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');

export const pool = new Pool({
  connectionString: dbUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 3000,
  ssl: isLocal ? false : { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== 'false' },
});

pool.on('error', (err) => {
  console.warn('⚠️ [PostgreSQL Pool Warning]:', err.message);
});

export async function testConnection(): Promise<boolean> {
  let client: pg.PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    client?.release();
  }
}

export async function query<T extends pg.QueryResultRow = any>(text: string, params?: any[]): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params);
}
