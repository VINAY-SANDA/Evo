import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

async function initDatabase() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ Error: DATABASE_URL is not set in backend/.env');
    process.exit(1);
  }

  console.log(`🔌 Attempting to connect to PostgreSQL at:`);
  console.log(`   ${connectionString.replace(/:([^:@]+)@/, ':****@')}`);

  const client = new pg.Client({
    connectionString,
    ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL database successfully!');

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

    console.log('📦 Executing schema.sql to create all tables and extensions...');
    await client.query(schemaSql);

    console.log('🎉 Database initialization complete! All 11 tables & pgvector structures are ready.');
  } catch (err: any) {
    console.error('❌ Failed to connect or initialize database:');
    console.error(err.message);
    console.log('\n💡 Tip: Check your DATABASE_URL in backend/.env');
  } finally {
    await client.end();
  }
}

initDatabase();
