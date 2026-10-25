import { createHmac, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { DEFAULT_USER_ID } from '../db/userHelper.js';
import { EVO_MCP_SCOPE, evoMcpOAuthProvider, getMcpOAuthProtectedResourceMetadataUrl, getMcpOAuthUrls } from '../services/mcpOAuth.js';

const SESSION_PREFIX = 'evo_sec_';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export interface OwnerSession {
  userId: string;
  email: string;
  name: string;
  expiresAt: number;
}

function safeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createOwnerSessionToken(user: { id: string; email: string; name: string }): string | null {
  const secret = process.env.EVO_AUTH_SECRET;
  if (!secret) return null;

  const session: OwnerSession = {
    userId: user.id,
    email: user.email,
    name: user.name,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  return `${SESSION_PREFIX}${payload}.${sign(payload, secret)}`;
}

export function verifyOwnerSessionToken(token: string): OwnerSession | null {
  const secret = process.env.EVO_AUTH_SECRET;
  if (!secret || !token.startsWith(SESSION_PREFIX)) return null;

  const tokenBody = token.slice(SESSION_PREFIX.length);
  const separator = tokenBody.lastIndexOf('.');
  if (separator <= 0) return null;

  const payload = tokenBody.slice(0, separator);
  const signature = tokenBody.slice(separator + 1);
  if (!safeEqual(signature, sign(payload, secret))) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as OwnerSession;
    if (
      session.userId !== DEFAULT_USER_ID ||
      typeof session.email !== 'string' ||
      typeof session.name !== 'string' ||
      typeof session.expiresAt !== 'number' ||
      session.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function isValidMcpToken(token: string): boolean {
  const configuredToken = process.env.EVO_MCP_TOKEN;
  return Boolean(configuredToken && safeEqual(token, configuredToken));
}

export const authenticateRequest: RequestHandler = (req, res, next) => {
  if (req.method === 'OPTIONS') return next();

  const match = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '');
  const token = match?.[1];
  if (token && (verifyOwnerSessionToken(token) || isValidMcpToken(token))) {
    return next();
  }

  const { resource } = getMcpOAuthUrls({
    protocol: req.protocol || 'http',
    get: name => (typeof req.get === 'function' ? req.get(name) : undefined)
      || req.headers?.[name.toLowerCase()]?.toString(),
  });
  const resourceMetadataUrl = getMcpOAuthProtectedResourceMetadataUrl(resource);
  if (!token?.startsWith('evo_oauth_')) {
    res.setHeader?.('WWW-Authenticate', `Bearer resource_metadata="${resourceMetadataUrl}"`);
    return res.status(401).json({ error: 'invalid_token', error_description: 'OAuth authorization is required.' });
  }

  return requireBearerAuth({
    verifier: evoMcpOAuthProvider,
    requiredScopes: [EVO_MCP_SCOPE],
    expectedResource: resource,
    resourceMetadataUrl,
  })(req, res, next);
};

function isAllowedMcpApiCall(method: string, originalUrl: string): boolean {
  const pathname = originalUrl.split('?', 1)[0].replace(/\/+$/, '') || '/';
  if (pathname === '/api/mcp' || pathname.startsWith('/api/mcp/')) return true;

  const allowedCalls = new Set([
    'GET /api/dashboard',
    'GET /api/tasks',
    'POST /api/tasks',
    'GET /api/goals',
    'POST /api/goals',
    'GET /api/habits',
    'GET /api/habits/summary/weekly',
    'POST /api/habits',
    'GET /api/finance/summary',
    'GET /api/finance/budgets',
    'PUT /api/finance/budgets',
    'GET /api/projects',
    'POST /api/projects',
    'GET /api/reminders',
    'POST /api/reminders',
    'PATCH /api/reminders/read-all',
    'GET /api/notifications',
    'PATCH /api/notifications/read-all',
    'GET /api/progress/scores',
    'GET /api/reviews/daily',
    'POST /api/reviews/daily',
    'GET /api/reviews/weekly',
    'POST /api/reviews/weekly',
    'GET /api/finance/expenses',
    'POST /api/finance/expenses',
    'GET /api/finance/income',
    'POST /api/finance/income',
    'GET /api/finance/savings',
    'POST /api/finance/savings',
    'GET /api/learning/subjects',
    'POST /api/learning/subjects',
    'GET /api/learning/stats',
    'GET /api/learning/study-sessions',
    'POST /api/learning/study-sessions',
    'GET /api/memories',
    'POST /api/memories',
    'POST /api/ai/chat',
  ]);

  if (allowedCalls.has(`${method} ${pathname}`)) return true;
  return (
    (method === 'POST' && (
    /^\/api\/tasks\/[0-9a-f-]+\/toggle$/i.test(pathname) ||
    /^\/api\/habits\/[0-9a-f-]+\/complete$/i.test(pathname)
    )) ||
    (method === 'DELETE' && (
      /^\/api\/tasks\/[0-9a-f-]+$/i.test(pathname) ||
      /^\/api\/goals\/[0-9a-f-]+$/i.test(pathname) ||
      /^\/api\/habits\/[0-9a-f-]+$/i.test(pathname) ||
      /^\/api\/finance\/(expenses|income|savings)\/[0-9a-f-]+$/i.test(pathname) ||
      /^\/api\/finance\/budgets\/[0-9a-f-]+$/i.test(pathname) ||
      /^\/api\/learning\/(subjects|topics)\/[0-9a-f-]+$/i.test(pathname)
    )) ||
    (method === 'PATCH' && (
      /^\/api\/habits\/[0-9a-f-]+\/(archive|restore)$/i.test(pathname) ||
      /^\/api\/learning\/topics\/[0-9a-f-]+$/i.test(pathname)
    )) ||
    (method === 'PATCH' && (
      /^\/api\/reminders\/[0-9a-f-]+$/i.test(pathname) ||
      /^\/api\/notifications\/(read-all|[0-9a-f-]+\/read)$/i.test(pathname) ||
      /^\/api\/projects\/milestones\/[0-9a-f-]+\/toggle$/i.test(pathname)
    )) ||
    (method === 'DELETE' && (
      /^\/api\/reminders\/[0-9a-f-]+$/i.test(pathname) ||
      /^\/api\/notifications\/[0-9a-f-]+$/i.test(pathname)
    )) ||
    (method === 'GET' && /^\/api\/learning\/subjects\/[0-9a-f-]+\/topics$/i.test(pathname)) ||
    (method === 'GET' && /^\/api\/projects\/[0-9a-f-]+\/milestones$/i.test(pathname)) ||
    (method === 'POST' && /^\/api\/projects\/[0-9a-f-]+\/milestones$/i.test(pathname)) ||
    (method === 'POST' && (
      /^\/api\/learning\/subjects\/[0-9a-f-]+\/topics$/i.test(pathname) ||
      /^\/api\/finance\/savings\/[0-9a-f-]+\/contributions$/i.test(pathname) ||
      /^\/api\/goals\/[0-9a-f-]+\/check-ins$/i.test(pathname)
    )) ||
    (method === 'GET' && (
      /^\/api\/finance\/savings\/[0-9a-f-]+\/contributions$/i.test(pathname) ||
      /^\/api\/goals\/[0-9a-f-]+\/check-ins$/i.test(pathname)
    ))
  );
}

export const authenticateApiRequest: RequestHandler = (req, res, next) => {
  if (req.method === 'OPTIONS') return next();

  const match = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '');
  const token = match?.[1];
  if (token && verifyOwnerSessionToken(token)) return next();
  if (token && isValidMcpToken(token) && isAllowedMcpApiCall(req.method, req.originalUrl)) return next();

  res.status(401).json({ error: 'A valid EVO session is required for this API operation.' });
};
