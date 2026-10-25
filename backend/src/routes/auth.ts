import { Router, Request, Response } from 'express';
import dotenv from 'dotenv';
import { query } from '../db/connection.js';
import { DEFAULT_USER_ID } from '../db/userHelper.js';

dotenv.config();

const router = Router();

// Master access key for Vinay (customizable via environment variable)
const MASTER_PASSCODE = process.env.EVO_MASTER_PASSCODE || process.env.MASTER_PASSWORD || 'Vinay@2026';
const MASTER_EMAIL = process.env.EVO_MASTER_EMAIL || 'vinay@example.com';

// ── Login Endpoint ──
router.post('/login', async (req: Request, res: Response) => {
  const { passcode, email } = req.body;

  if (!passcode) {
    return res.status(400).json({ error: 'Passcode is required' });
  }

  // Validate only for Vinay
  const isEmailMatch = !email || email.trim().toLowerCase() === MASTER_EMAIL.toLowerCase();
  const isPasscodeMatch = passcode.trim() === MASTER_PASSCODE;

  if (!isPasscodeMatch || !isEmailMatch) {
    return res.status(401).json({
      error: 'Access denied: Invalid credentials. Authorized personnel only.',
    });
  }

  // Fetch or fallback user profile
  let user = {
    id: DEFAULT_USER_ID,
    name: 'Vinay',
    email: MASTER_EMAIL,
    timezone: 'Asia/Kolkata',
    aiTone: 'rigorous',
  };

  try {
    const userRes = await query('SELECT id, name, email, timezone, ai_tone FROM users WHERE id = $1', [DEFAULT_USER_ID]);
    if (userRes.rows.length > 0) {
      user = {
        id: userRes.rows[0].id,
        name: userRes.rows[0].name,
        email: userRes.rows[0].email,
        timezone: userRes.rows[0].timezone || 'Asia/Kolkata',
        aiTone: userRes.rows[0].ai_tone || 'rigorous',
      };
    }
  } catch (err) {
    // In-memory fallback
  }

  // Simple token format for single-user environment: base64 encoded user info + timestamp
  const authToken = Buffer.from(JSON.stringify({
    userId: user.id,
    email: user.email,
    authTime: Date.now(),
    role: 'owner',
  })).toString('base64');

  res.json({
    success: true,
    message: 'Access granted. Personal operating system unlocked.',
    token: `evo_sec_${authToken}`,
    user,
  });
});

// ── Verify Session Endpoint ──
router.get('/verify', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer evo_sec_')) {
    return res.status(401).json({ authenticated: false, error: 'No active session token' });
  }

  try {
    const rawToken = authHeader.replace('Bearer evo_sec_', '');
    const payload = JSON.parse(Buffer.from(rawToken, 'base64').toString('utf8'));

    if (payload.role !== 'owner' || payload.userId !== DEFAULT_USER_ID) {
      return res.status(401).json({ authenticated: false, error: 'Session invalid' });
    }

    res.json({
      authenticated: true,
      user: {
        id: payload.userId,
        email: payload.email,
        name: 'Vinay',
      },
    });
  } catch {
    res.status(401).json({ authenticated: false, error: 'Malformed session token' });
  }
});

export default router;
