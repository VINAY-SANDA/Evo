import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Response } from 'express';
import type { OAuthClientInformationFull, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';
import type { OAuthServerProvider, AuthorizationParams } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import {
  AccessDeniedError,
  InvalidClientMetadataError,
  InvalidGrantError,
  InvalidScopeError,
  InvalidTargetError,
} from '@modelcontextprotocol/sdk/server/auth/errors.js';
import { query } from '../db/connection.js';
import { DEFAULT_USER_ID } from '../db/userHelper.js';
import { isValidOwnerPasscode } from './ownerCredentials.js';

export const EVO_MCP_SCOPE = 'mcp:tools';
const OPTIONAL_SCOPE = 'offline_access';
const AUTH_CODE_TTL_SECONDS = 5 * 60;
const CONSENT_FLOW_TTL_SECONDS = 10 * 60;
const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
const TOKEN_PREFIX = 'evo_oauth_';

export interface StoredAuthorizationCode {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  resource: string;
  scopes: string[];
}

export interface EvoMcpOAuthStore {
  getClient(clientId: string): OAuthClientInformationFull | undefined | Promise<OAuthClientInformationFull | undefined>;
  registerClient(client: OAuthClientInformationFull): OAuthClientInformationFull | Promise<OAuthClientInformationFull>;
  createAuthorizationCode(code: string, record: StoredAuthorizationCode): Promise<void>;
  getAuthorizationCode(clientId: string, code: string): Promise<StoredAuthorizationCode | undefined>;
  consumeAuthorizationCode(clientId: string, code: string): Promise<StoredAuthorizationCode | undefined>;
}

let tablesReady: Promise<void> | undefined;

export function ensureMcpOAuthTables(): Promise<void> {
  if (!tablesReady) {
    tablesReady = query(`
      CREATE TABLE IF NOT EXISTS evo_mcp_oauth_clients (
        client_id TEXT PRIMARY KEY,
        client_info JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS evo_mcp_oauth_codes (
        code_hash CHAR(64) PRIMARY KEY,
        client_id TEXT NOT NULL REFERENCES evo_mcp_oauth_clients(client_id) ON DELETE CASCADE,
        redirect_uri TEXT NOT NULL,
        code_challenge TEXT NOT NULL,
        resource TEXT NOT NULL,
        scopes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS evo_mcp_oauth_codes_expiry_idx
        ON evo_mcp_oauth_codes (expires_at);
    `).then(() => undefined).catch((error) => {
      tablesReady = undefined;
      throw error;
    });
  }
  return tablesReady;
}

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

export class PostgresEvoMcpOAuthStore implements EvoMcpOAuthStore {
  async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
    await ensureMcpOAuthTables();
    const result = await query<{ client_info: OAuthClientInformationFull }>(
      'SELECT client_info FROM evo_mcp_oauth_clients WHERE client_id = $1',
      [clientId]
    );
    return result.rows[0]?.client_info;
  }

  async registerClient(client: OAuthClientInformationFull): Promise<OAuthClientInformationFull> {
    const supportedGrantTypes = client.grant_types || ['authorization_code'];
    const supportedResponseTypes = client.response_types || ['code'];
    const authMethod = client.token_endpoint_auth_method || 'none';
    if (
      (authMethod !== 'none' && authMethod !== 'client_secret_post')
      || supportedGrantTypes.some(grantType => grantType !== 'authorization_code' && grantType !== 'refresh_token')
      || supportedResponseTypes.some(responseType => responseType !== 'code')
    ) {
      throw new InvalidClientMetadataError('EVO MCP clients must use a public authorization-code client with PKCE.');
    }
    for (const redirectUri of client.redirect_uris) {
      const url = new URL(redirectUri);
      const loopback = url.protocol === 'http:'
        && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
      if (url.protocol !== 'https:' && !loopback) {
        throw new InvalidClientMetadataError('Client redirect URIs must use HTTPS or a loopback address.');
      }
    }

    const normalizedClient: OAuthClientInformationFull = {
      ...client,
      ...(authMethod === 'none' ? { client_secret: undefined, client_secret_expires_at: undefined } : {}),
      token_endpoint_auth_method: authMethod,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    };
    await ensureMcpOAuthTables();
    await query(
      'INSERT INTO evo_mcp_oauth_clients (client_id, client_info) VALUES ($1, $2::jsonb)',
      [normalizedClient.client_id, JSON.stringify(normalizedClient)]
    );
    return normalizedClient;
  }

  async createAuthorizationCode(code: string, record: StoredAuthorizationCode): Promise<void> {
    await ensureMcpOAuthTables();
    await query('DELETE FROM evo_mcp_oauth_codes WHERE expires_at <= CURRENT_TIMESTAMP');
    await query(
      `INSERT INTO evo_mcp_oauth_codes
        (code_hash, client_id, redirect_uri, code_challenge, resource, scopes, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP + ($7 * INTERVAL '1 second'))`,
      [hashCode(code), record.clientId, record.redirectUri, record.codeChallenge, record.resource, record.scopes, AUTH_CODE_TTL_SECONDS]
    );
  }

  async getAuthorizationCode(clientId: string, code: string): Promise<StoredAuthorizationCode | undefined> {
    await ensureMcpOAuthTables();
    const result = await query<any>(
      `SELECT client_id, redirect_uri, code_challenge, resource, scopes
       FROM evo_mcp_oauth_codes
       WHERE code_hash = $1 AND client_id = $2 AND expires_at > CURRENT_TIMESTAMP`,
      [hashCode(code), clientId]
    );
    const row = result.rows[0];
    return row && {
      clientId: row.client_id,
      redirectUri: row.redirect_uri,
      codeChallenge: row.code_challenge,
      resource: row.resource,
      scopes: row.scopes || [],
    };
  }

  async consumeAuthorizationCode(clientId: string, code: string): Promise<StoredAuthorizationCode | undefined> {
    await ensureMcpOAuthTables();
    const result = await query<any>(
      `DELETE FROM evo_mcp_oauth_codes
       WHERE code_hash = $1 AND client_id = $2 AND expires_at > CURRENT_TIMESTAMP
       RETURNING client_id, redirect_uri, code_challenge, resource, scopes`,
      [hashCode(code), clientId]
    );
    const row = result.rows[0];
    return row && {
      clientId: row.client_id,
      redirectUri: row.redirect_uri,
      codeChallenge: row.code_challenge,
      resource: row.resource,
      scopes: row.scopes || [],
    };
  }
}

interface ConsentFlow {
  type: 'consent';
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  resource: string;
  scopes: string[];
  state?: string;
  expiresAt: number;
}

interface OAuthTokenPayload {
  type: 'access' | 'refresh';
  clientId: string;
  userId: string;
  resource: string;
  scopes: string[];
  expiresAt: number;
}

function configuredOAuthSecret(): string {
  const secret = process.env.EVO_AUTH_SECRET;
  if (!secret) throw new Error('EVO_AUTH_SECRET is required for EVO OAuth.');
  return secret;
}

function encodeSignedPayload(payload: object, prefix: string): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', configuredOAuthSecret()).update(encoded).digest('base64url');
  return `${prefix}${encoded}.${signature}`;
}

function decodeSignedPayload<T>(value: string, prefix: string): T | null {
  if (!value.startsWith(prefix)) return null;
  const signed = value.slice(prefix.length);
  const separator = signed.lastIndexOf('.');
  if (separator < 1) return null;
  const encoded = signed.slice(0, separator);
  const suppliedSignature = signed.slice(separator + 1);
  try {
    const expectedSignature = createHmac('sha256', configuredOAuthSecret()).update(encoded).digest('base64url');
    const actualBytes = Buffer.from(suppliedSignature);
    const expectedBytes = Buffer.from(expectedSignature);
    if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) return null;
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

function comparableUrl(value: string | URL): string {
  const url = new URL(value);
  url.hash = '';
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/$/, '');
  return url.href;
}

function appendAuthorizationResponse(redirectUri: string, parameters: Record<string, string | undefined>): string {
  const redirect = new URL(redirectUri);
  for (const [key, value] of Object.entries(parameters)) {
    if (value !== undefined) redirect.searchParams.set(key, value);
  }
  return redirect.href;
}

export class EvoMcpOAuthProvider implements OAuthServerProvider {
  readonly clientsStore: EvoMcpOAuthStore;

  constructor(
    clientsStore: EvoMcpOAuthStore,
    private readonly issuerUrl: URL,
    private readonly resourceUrl: URL
  ) {
    this.clientsStore = clientsStore;
  }

  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response): Promise<void> {
    const requestedScopes = params.scopes || [];
    const scopes = requestedScopes.length > 0 ? [...new Set<string>(requestedScopes)] : [EVO_MCP_SCOPE];
    if (!scopes.includes(EVO_MCP_SCOPE) || scopes.some(scope => scope !== EVO_MCP_SCOPE && scope !== OPTIONAL_SCOPE)) {
      throw new InvalidScopeError('EVO supports the mcp:tools scope and optional offline_access scope.');
    }

    const resource = params.resource || this.resourceUrl;
    if (comparableUrl(resource) !== comparableUrl(this.resourceUrl)) {
      throw new InvalidTargetError('The requested resource is not this EVO MCP server.');
    }

    const flow: ConsentFlow = {
      type: 'consent',
      clientId: client.client_id,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      resource: resource.href,
      scopes,
      state: params.state,
      expiresAt: Math.floor(Date.now() / 1000) + CONSENT_FLOW_TTL_SECONDS,
    };
    const ticket = encodeSignedPayload(flow, 'evo_consent_');
    const consentUrl = new URL('/oauth/consent', this.issuerUrl);
    consentUrl.searchParams.set('flow', ticket);
    res.redirect(302, consentUrl.href);
  }

  readConsentFlow(ticket: string): { flow: ConsentFlow; clientName: string } | null {
    const flow = decodeSignedPayload<ConsentFlow>(ticket, 'evo_consent_');
    if (!flow || flow.type !== 'consent' || flow.expiresAt <= Math.floor(Date.now() / 1000)) return null;
    return { flow, clientName: 'Gemini or connected MCP client' };
  }

  async getConsentClientName(ticket: string): Promise<string> {
    const consent = this.readConsentFlow(ticket);
    if (!consent) return 'connected MCP client';
    const client = await this.clientsStore.getClient(consent.flow.clientId);
    return client?.client_name || 'connected MCP client';
  }

  async authorizeOwner(ticket: string, passcode: unknown): Promise<string> {
    const consent = this.readConsentFlow(ticket);
    if (!consent) throw new InvalidGrantError('This authorization request expired. Start the connection again.');
    if (!isValidOwnerPasscode(passcode)) throw new AccessDeniedError('The EVO owner passcode is incorrect.');
    const client = await this.clientsStore.getClient(consent.flow.clientId);
    if (!client) throw new InvalidGrantError('The MCP client registration is no longer available.');

    const code = randomBytes(32).toString('base64url');
    await this.clientsStore.createAuthorizationCode(code, {
      clientId: consent.flow.clientId,
      redirectUri: consent.flow.redirectUri,
      codeChallenge: consent.flow.codeChallenge,
      resource: consent.flow.resource,
      scopes: consent.flow.scopes,
    });
    return appendAuthorizationResponse(consent.flow.redirectUri, {
      code,
      state: consent.flow.state,
    });
  }

  denyOwnerAuthorization(ticket: string): string {
    const consent = this.readConsentFlow(ticket);
    if (!consent) throw new InvalidGrantError('This authorization request expired. Start the connection again.');
    return appendAuthorizationResponse(consent.flow.redirectUri, {
      error: 'access_denied',
      error_description: 'EVO access was not approved.',
      state: consent.flow.state,
    });
  }

  async challengeForAuthorizationCode(client: OAuthClientInformationFull, authorizationCode: string): Promise<string> {
    const record = await this.clientsStore.getAuthorizationCode(client.client_id, authorizationCode);
    if (!record) throw new InvalidGrantError('The authorization code is invalid, expired, or already used.');
    return record.codeChallenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    redirectUri?: string,
    resource?: URL
  ): Promise<OAuthTokens> {
    const record = await this.clientsStore.consumeAuthorizationCode(client.client_id, authorizationCode);
    if (!record) throw new InvalidGrantError('The authorization code is invalid, expired, or already used.');
    if (!redirectUri || redirectUri !== record.redirectUri) {
      throw new InvalidGrantError('The redirect URI does not match the authorization request.');
    }
    if (resource && comparableUrl(resource) !== comparableUrl(record.resource)) {
      throw new InvalidTargetError('The token is not valid for the requested resource.');
    }
    return this.issueTokens(client.client_id, record.resource, record.scopes);
  }

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    scopes?: string[],
    resource?: URL
  ): Promise<OAuthTokens> {
    const payload = this.readToken(refreshToken, 'refresh');
    if (!payload || payload.clientId !== client.client_id) {
      throw new InvalidGrantError('The refresh token is invalid or expired.');
    }
    if (resource && comparableUrl(resource) !== comparableUrl(payload.resource)) {
      throw new InvalidTargetError('The token is not valid for the requested resource.');
    }
    const requestedScopes = scopes && scopes.length ? scopes : payload.scopes;
    if (requestedScopes.some(scope => !payload.scopes.includes(scope))) {
      throw new InvalidScopeError('A refresh request cannot grant additional scopes.');
    }
    return this.issueTokens(client.client_id, payload.resource, requestedScopes, refreshToken);
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const payload = this.readToken(token, 'access');
    if (!payload) throw new InvalidGrantError('The access token is invalid or expired.');
    return {
      token,
      clientId: payload.clientId,
      scopes: payload.scopes,
      expiresAt: payload.expiresAt,
      resource: new URL(payload.resource),
      extra: { userId: payload.userId },
    };
  }

  private issueTokens(clientId: string, resource: string, scopes: string[], refreshToken?: string): OAuthTokens {
    const now = Math.floor(Date.now() / 1000);
    const accessToken = encodeSignedPayload({
      type: 'access',
      clientId,
      userId: DEFAULT_USER_ID,
      resource,
      scopes,
      expiresAt: now + ACCESS_TOKEN_TTL_SECONDS,
    } satisfies OAuthTokenPayload, TOKEN_PREFIX);
    const refresh = scopes.includes(OPTIONAL_SCOPE)
      ? refreshToken || encodeSignedPayload({
        type: 'refresh',
        clientId,
        userId: DEFAULT_USER_ID,
        resource,
        scopes,
        expiresAt: now + REFRESH_TOKEN_TTL_SECONDS,
      } satisfies OAuthTokenPayload, TOKEN_PREFIX)
      : undefined;
    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      scope: scopes.join(' '),
      refresh_token: refresh,
    };
  }

  private readToken(token: string, type: OAuthTokenPayload['type']): OAuthTokenPayload | null {
    const payload = decodeSignedPayload<OAuthTokenPayload>(token, TOKEN_PREFIX);
    if (
      !payload
      || payload.type !== type
      || payload.userId !== DEFAULT_USER_ID
      || typeof payload.clientId !== 'string'
      || !Array.isArray(payload.scopes)
      || !payload.scopes.includes(EVO_MCP_SCOPE)
      || typeof payload.expiresAt !== 'number'
      || payload.expiresAt <= Math.floor(Date.now() / 1000)
    ) return null;
    try {
      new URL(payload.resource);
      return payload;
    } catch {
      return null;
    }
  }
}

const defaultMcpOAuthUrls = getMcpOAuthUrls();
export const evoMcpOAuthProvider = new EvoMcpOAuthProvider(
  new PostgresEvoMcpOAuthStore(),
  defaultMcpOAuthUrls.issuer,
  defaultMcpOAuthUrls.resource
);

export function getMcpOAuthUrls(request?: { protocol: string; get(name: string): string | undefined }): { issuer: URL; resource: URL } {
  const defaultPort = process.env.PORT || '5000';
  const envMcpUrl = process.env.EVO_MCP_PUBLIC_URL;
  const renderUrl = process.env.RENDER_EXTERNAL_URL;
  let resourceUrl: URL;
  if (envMcpUrl) {
    resourceUrl = new URL(envMcpUrl);
  } else if (renderUrl) {
    resourceUrl = new URL('/mcp', renderUrl);
  } else if (request) {
    const protocol = request.get('x-forwarded-proto')?.split(',')[0]?.trim() || request.protocol;
    const host = request.get('x-forwarded-host')?.split(',')[0]?.trim() || request.get('host');
    resourceUrl = new URL('/mcp', `${protocol}://${host}`);
  } else {
    resourceUrl = new URL(`http://localhost:${defaultPort}/mcp`);
  }
  resourceUrl.hash = '';
  resourceUrl.search = '';
  const resourcePath = resourceUrl.pathname.replace(/\/+$/, '');
  if (!resourcePath.endsWith('/mcp')) resourceUrl.pathname = `${resourcePath}/mcp`;
  else resourceUrl.pathname = resourcePath;
  return { issuer: new URL(resourceUrl.origin), resource: resourceUrl };
}

export function getMcpOAuthProtectedResourceMetadataUrl(resourceUrl: URL): string {
  return new URL(`/.well-known/oauth-protected-resource${resourceUrl.pathname}`, resourceUrl.origin).href;
}

