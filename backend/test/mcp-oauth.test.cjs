const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const express = require('express');
const { once } = require('node:events');
const test = require('node:test');
const { requireBearerAuth } = require('@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js');

process.env.EVO_AUTH_SECRET = 'test-only-evo-oauth-secret';
process.env.EVO_MASTER_PASSCODE = 'test-only-owner-passcode';
process.env.EVO_MCP_PUBLIC_URL = '';
process.env.RENDER_EXTERNAL_URL = '';
process.env.EVO_MCP_TOKEN = 'test-only-evo-mcp-token';

const { createEvoMcpOAuthRouter } = require('../dist/routes/mcpOAuth.js');
const { EVO_MCP_SCOPE, EvoMcpOAuthProvider } = require('../dist/services/mcpOAuth.js');
const { authenticateRequest } = require('../dist/middleware/auth.js');
const mcpRouter = require('../dist/routes/mcp.js').default;

class MemoryOAuthStore {
  clients = new Map();
  codes = new Map();

  async getClient(clientId) {
    return this.clients.get(clientId);
  }

  async registerClient(client) {
    this.clients.set(client.client_id, client);
    return client;
  }

  async createAuthorizationCode(code, record) {
    this.codes.set(`${record.clientId}:${code}`, record);
  }

  async getAuthorizationCode(clientId, code) {
    return this.codes.get(`${clientId}:${code}`);
  }

  async consumeAuthorizationCode(clientId, code) {
    const key = `${clientId}:${code}`;
    const record = this.codes.get(key);
    this.codes.delete(key);
    return record;
  }
}

test('Gemini-compatible MCP OAuth discovers, registers, authorizes, and issues a scoped token', async () => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  const server = app.listen(0);
  await once(server, 'listening');
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;
  const resource = new URL('/mcp', origin);
  const provider = new EvoMcpOAuthProvider(new MemoryOAuthStore(), new URL(origin), resource);
  app.use(createEvoMcpOAuthRouter(provider, resource, new URL(origin)));
  app.use('/mcp', authenticateRequest);
  app.use('/mcp', mcpRouter);
  app.get('/mcp/probe', requireBearerAuth({
    verifier: provider,
    requiredScopes: [EVO_MCP_SCOPE],
    expectedResource: resource,
    resourceMetadataUrl: `${origin}/.well-known/oauth-protected-resource/mcp`,
  }), (req, res) => res.json({ clientId: req.auth.clientId, scopes: req.auth.scopes }));

  try {
    const discoveryResponse = await fetch(`${origin}/.well-known/oauth-authorization-server`);
    assert.equal(discoveryResponse.status, 200);
    const discovery = await discoveryResponse.json();
    assert.equal(discovery.issuer, `${origin}/`);
    assert.equal(discovery.authorization_endpoint, `${origin}/authorize`);
    assert.equal(discovery.token_endpoint, `${origin}/token`);
    assert.equal(discovery.registration_endpoint, `${origin}/register`);
    assert.ok(discovery.code_challenge_methods_supported.includes('S256'));

    const protectedResourceResponse = await fetch(`${origin}/.well-known/oauth-protected-resource/mcp`);
    assert.equal(protectedResourceResponse.status, 200);
    assert.equal((await protectedResourceResponse.json()).resource, resource.href);

    const redirectUri = 'https://oauth-redirect.googleusercontent.com/r/evo-test';
    const registrationResponse = await fetch(`${origin}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: 'Gemini test client',
        redirect_uris: [redirectUri],
        token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
      }),
    });
    assert.equal(registrationResponse.status, 201);
    const client = await registrationResponse.json();
    assert.ok(client.client_id);
    assert.equal(client.token_endpoint_auth_method, 'none');

    const codeVerifier = Buffer.from('test verifier for EVO OAuth PKCE').toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
    const authorizationUrl = new URL(`${origin}/authorize`);
    authorizationUrl.search = new URLSearchParams({
      response_type: 'code',
      client_id: client.client_id,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      scope: `${EVO_MCP_SCOPE} offline_access`,
      resource: resource.href,
      state: 'evo-oauth-state-check',
    }).toString();

    const authorizationResponse = await fetch(authorizationUrl, { redirect: 'manual' });
    assert.equal(authorizationResponse.status, 302);
    const consentUrl = new URL(authorizationResponse.headers.get('location'));
    assert.equal(consentUrl.pathname, '/oauth/consent');
    const consentPage = await fetch(consentUrl);
    assert.equal(consentPage.status, 200);
    const html = await consentPage.text();
    assert.match(html, /Gemini test client/);
    const flow = html.match(/name="flow" value="([^"]+)"/)[1];

    const deniedResponse = await fetch(`${origin}/oauth/consent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ flow, passcode: 'wrong-passcode', decision: 'allow' }),
      redirect: 'manual',
    });
    assert.equal(deniedResponse.status, 401);
    assert.match(await deniedResponse.text(), /passcode was not accepted/i);

    const consentResponse = await fetch(`${origin}/oauth/consent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ flow, passcode: process.env.EVO_MASTER_PASSCODE, decision: 'allow' }),
      redirect: 'manual',
    });
    assert.equal(consentResponse.status, 200);
    const completionPage = await consentResponse.text();
    assert.match(completionPage, /Returning to Gemini/);
    assert.match(completionPage, /http-equiv="refresh"/);
    const redirectTarget = completionPage.match(/http-equiv="refresh" content="0;url=([^"]+)"/i)[1]
      .replaceAll('&amp;', '&');
    const callbackUrl = new URL(redirectTarget);
    assert.equal(callbackUrl.origin, new URL(redirectUri).origin);
    assert.equal(callbackUrl.searchParams.get('state'), 'evo-oauth-state-check');
    const code = callbackUrl.searchParams.get('code');
    assert.ok(code);

    const tokenRequestBody = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: client.client_id,
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
      resource: resource.href,
    });
    const tokenResponse = await fetch(`${origin}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenRequestBody,
    });
    assert.equal(tokenResponse.status, 200);
    const tokens = await tokenResponse.json();
    assert.equal(tokens.token_type, 'Bearer');
    assert.equal(tokens.scope, `${EVO_MCP_SCOPE} offline_access`);
    assert.ok(tokens.refresh_token);

    const protectedCall = await fetch(`${origin}/mcp/probe`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    assert.equal(protectedCall.status, 200);
    assert.deepEqual(await protectedCall.json(), {
      clientId: client.client_id,
      scopes: [EVO_MCP_SCOPE, 'offline_access'],
    });

    const initializeResponse = await fetch(`${origin}/mcp`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'gemini-oauth-regression-test', version: '1.0.0' },
        },
      }),
    });
    assert.equal(initializeResponse.status, 200);
    assert.equal((await initializeResponse.json()).result.protocolVersion, '2024-11-05');

    const listToolsResponse = await fetch(`${origin}/mcp`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
        'MCP-Protocol-Version': '2024-11-05',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
    });
    assert.equal(listToolsResponse.status, 200);
    const availableTools = (await listToolsResponse.json()).result.tools;
    assert.ok(availableTools.some(tool => tool.name === 'evo_create_habit'));

    const refreshResponse = await fetch(`${origin}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: client.client_id,
        refresh_token: tokens.refresh_token,
        resource: resource.href,
      }),
    });
    assert.equal(refreshResponse.status, 200);
    assert.ok((await refreshResponse.json()).access_token);

    const replayResponse = await fetch(`${origin}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenRequestBody,
    });
    assert.equal(replayResponse.status, 400);
    assert.equal((await replayResponse.json()).error, 'invalid_grant');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
