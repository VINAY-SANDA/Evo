const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const test = require('node:test');

process.env.EVO_AUTH_SECRET = 'test-only-evo-auth-secret';
process.env.EVO_MCP_TOKEN = 'test-only-evo-mcp-token';

const {
  authenticateApiRequest,
  authenticateRequest,
  createOwnerSessionToken,
  verifyOwnerSessionToken,
} = require('../dist/middleware/auth.js');

const owner = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'owner@example.com',
  name: 'Owner',
};

function invoke(middleware, { authorization, method = 'GET', originalUrl = '/api/dashboard' } = {}) {
  let statusCode = 200;
  let nextCalled = false;
  const responseHeaders = {};
  const req = {
    method,
    originalUrl,
    protocol: 'http',
    headers: { host: 'localhost:5000', ...(authorization ? { authorization } : {}) },
    get(name) {
      return this.headers[name.toLowerCase()];
    },
  };
  const res = {
    setHeader(name, value) {
      responseHeaders[name.toLowerCase()] = value;
      return this;
    },
    status(code) {
      statusCode = code;
      return this;
    },
    json() {
      return this;
    },
  };

  middleware(req, res, () => {
    nextCalled = true;
  });

  return { statusCode, nextCalled, responseHeaders };
}

test('owner sessions are signed, owner-bound, and expire', () => {
  const token = createOwnerSessionToken(owner);
  assert.ok(token);
  const session = verifyOwnerSessionToken(token);
  assert.ok(session);
  assert.equal(session.userId, owner.id);
  assert.equal(session.email, owner.email);
  assert.equal(session.name, owner.name);
  assert.ok(session.expiresAt > Math.floor(Date.now() / 1000));

  const tampered = `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`;
  assert.equal(verifyOwnerSessionToken(tampered), null);

  const payload = Buffer.from(JSON.stringify({
    ...owner,
    expiresAt: Math.floor(Date.now() / 1000) - 1,
  })).toString('base64url');
  const signature = createHmac('sha256', process.env.EVO_AUTH_SECRET)
    .update(payload)
    .digest('base64url');
  assert.equal(verifyOwnerSessionToken(`evo_sec_${payload}.${signature}`), null);
});

test('protected routes reject anonymous and invalid sessions', () => {
  const token = createOwnerSessionToken(owner);
  const anonymousMcp = invoke(authenticateRequest);
  assert.equal(anonymousMcp.statusCode, 401);
  assert.match(anonymousMcp.responseHeaders['www-authenticate'], /resource_metadata=/);
  assert.equal(invoke(authenticateApiRequest).statusCode, 401);
  assert.equal(invoke(authenticateApiRequest, { authorization: 'Bearer invalid' }).statusCode, 401);
  assert.equal(invoke(authenticateApiRequest, { authorization: `Bearer ${token}` }).nextCalled, true);
  assert.equal(invoke(authenticateRequest).statusCode, 401);
  assert.equal(invoke(authenticateRequest, { authorization: 'Bearer test-only-evo-mcp-token' }).nextCalled, true);
});

test('MCP credentials are limited to tool-required API operations', () => {
  const authorization = 'Bearer test-only-evo-mcp-token';
  assert.equal(invoke(authenticateApiRequest, {
    authorization,
    method: 'POST',
    originalUrl: '/api/tasks',
  }).nextCalled, true);
  assert.equal(invoke(authenticateApiRequest, {
    authorization,
    method: 'POST',
    originalUrl: '/api/habits',
  }).nextCalled, true);
  assert.equal(invoke(authenticateApiRequest, {
    authorization,
    method: 'DELETE',
    originalUrl: '/api/tasks/00000000-0000-0000-0000-000000000001',
  }).statusCode, 401);
});
