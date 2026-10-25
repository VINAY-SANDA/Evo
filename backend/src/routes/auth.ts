import { Router, Request, Response } from 'express';
import dotenv from 'dotenv';
import { query } from '../db/connection.js';
import { DEFAULT_USER_ID } from '../db/userHelper.js';
import { createOwnerSessionToken, verifyOwnerSessionToken } from '../middleware/auth.js';
import { getOwnerPasscode, isValidOwnerPasscode } from '../services/ownerCredentials.js';

dotenv.config();

const router = Router();

const MASTER_EMAIL = process.env.EVO_MASTER_EMAIL || 'vinay@example.com';

// ── Login Endpoint ──
router.post('/login', async (req: Request, res: Response) => {
  const { passcode, email } = req.body || {};

  if (!passcode) {
    return res.status(400).json({ error: 'Passcode is required' });
  }

  if (!getOwnerPasscode() || !process.env.EVO_AUTH_SECRET) {
    return res.status(503).json({ error: 'EVO authentication is not configured on the server.' });
  }

  // Validate only for Vinay
  const isEmailMatch = typeof email !== 'string' || email.trim().toLowerCase() === MASTER_EMAIL.toLowerCase();
  const isPasscodeMatch = isValidOwnerPasscode(passcode);

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

  const authToken = createOwnerSessionToken(user);
  if (!authToken) {
    return res.status(503).json({ error: 'EVO authentication is not configured on the server.' });
  }

  res.json({
    success: true,
    message: 'Access granted. Personal operating system unlocked.',
    token: authToken,
    user,
  });
});

// ── Verify Session Endpoint ──
router.get('/verify', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer evo_sec_')) {
    return res.status(401).json({ authenticated: false, error: 'No active session token' });
  }

  const session = verifyOwnerSessionToken(authHeader.replace(/^Bearer\s+/i, ''));
  if (!session) {
    return res.status(401).json({ authenticated: false, error: 'Session is invalid or expired' });
  }

  res.json({
    authenticated: true,
    user: {
      id: session.userId,
      email: session.email,
      name: session.name,
    },
  });
});

export default router;
