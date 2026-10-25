import { query } from './connection.js';

export const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

export async function ensureDefaultUser() {
  try {
    await query(`
      INSERT INTO users (id, name, email, timezone, ai_tone)
      VALUES ($1, 'Vinay', 'vinay@example.com', 'Asia/Kolkata', 'rigorous')
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
    `, [DEFAULT_USER_ID]);
  } catch (err: any) {
    console.warn('Could not ensure default user:', err.message);
  }
}
