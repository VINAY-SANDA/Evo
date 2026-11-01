import { Router, Request, Response, type RequestHandler } from 'express';
import dotenv from 'dotenv';
import { query } from '../db/connection.js';
import { DEFAULT_USER_ID } from '../db/userHelper.js';
import { createOwnerSessionToken, verifyOwnerSessionToken } from '../middleware/auth.js';
import { getOwnerPasscode, isValidOwnerPasscode } from '../services/ownerCredentials.js';

dotenv.config();

const router = Router();

const MASTER_EMAIL = process.env.EVO_MASTER_EMAIL || 'vinay@example.com';
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

const limitLoginAttempts: RequestHandler = (req, res, next) => {
  const now = Date.now();
  for (const [ip, attempt] of loginAttempts) {
    if (attempt.resetAt <= now) loginAttempts.delete(ip);
  }

  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const current = loginAttempts.get(ip);
  if (current && current.count >= LOGIN_MAX_ATTEMPTS && current.resetAt > now) {
    res.setHeader('Retry-After', String(Math.ceil((current.resetAt - now) / 1000)));
    res.status(429).json({ error: 'Too many sign-in attempts. Please wait and try again.' });
    return;
  }

  loginAttempts.set(ip, current && current.resetAt > now
    ? { ...current, count: current.count + 1 }
    : { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  next();
};

// ── Login Endpoint ──
router.post('/login', limitLoginAttempts, async (req: Request, res: Response) => {
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
  } catch {
    return res.status(503).json({ error: 'EVO is still connecting to its database. Please try again shortly.' });
  }

  const authToken = createOwnerSessionToken(user);
  if (!authToken) {
    return res.status(503).json({ error: 'EVO authentication is not configured on the server.' });
  }

  loginAttempts.delete(req.ip || req.socket.remoteAddress || 'unknown');

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
