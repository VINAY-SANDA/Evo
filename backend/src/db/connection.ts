import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/evo_db';
const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
const configuredSslMode = (() => {
  try { return new URL(dbUrl).searchParams.get('sslmode'); }
  catch { return null; }
})();
const rejectUnauthorized = process.env.PGSSL_REJECT_UNAUTHORIZED === 'true'
  || (process.env.PGSSL_REJECT_UNAUTHORIZED !== 'false' && ['verify-ca', 'verify-full'].includes(configuredSslMode || ''));

export const pool = new Pool({
  connectionString: dbUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  // Render's internal Postgres endpoints may use self-signed certificates. TLS
  // remains enabled; certificate verification is opt-in unless the URL requests it.
  ssl: isLocal ? false : { rejectUnauthorized },
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
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`[PostgreSQL connection check failed] ${detail}`);
    return false;
  } finally {
    client?.release();
  }
}

export async function query<T extends pg.QueryResultRow = any>(text: string, params?: any[]): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params);
}
