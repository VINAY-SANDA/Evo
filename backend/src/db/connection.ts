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
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.warn('⚠️ [PostgreSQL Pool Warning]:', err.message);
});

export async function testConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch {
    return false;
  }
}

export async function query<T extends pg.QueryResultRow = any>(text: string, params?: any[]): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params);
}
