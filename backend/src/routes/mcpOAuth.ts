import { Router, Request, Response } from 'express';
import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { AccessDeniedError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import {
  EVO_MCP_SCOPE,
  EvoMcpOAuthProvider,
  evoMcpOAuthProvider,
  getMcpOAuthUrls,
} from '../services/mcpOAuth.js';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] || character);
}

function consentPage(flow: string, clientName: string, errorMessage = ''): string {
  const safeFlow = escapeHtml(flow);
  const safeClientName = escapeHtml(clientName);
  const safeError = errorMessage ? `<p class="error">${escapeHtml(errorMessage)}</p>` : '';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Connect EVO</title>
  <style>
    :root { color-scheme: light; font-family: Inter, Segoe UI, sans-serif; background: #f5f7fb; color: #18212f; }
    body { min-height: 100vh; margin: 0; display: grid; place-items: center; }
    main { width: min(420px, calc(100% - 40px)); padding: 32px; box-sizing: border-box; border: 1px solid #e2e8f0; border-radius: 18px; background: white; box-shadow: 0 18px 55px #18212f12; }
    .brand { color: #6256c7; font-weight: 800; letter-spacing: .12em; font-size: 13px; }
    h1 { margin: 12px 0 8px; font-size: 25px; }
    p { color: #596579; line-height: 1.55; }
    label { display: block; margin: 24px 0 8px; font-size: 14px; font-weight: 650; }
    input { width: 100%; box-sizing: border-box; padding: 12px 14px; border: 1px solid #cbd5e1; border-radius: 10px; font: inherit; }
    button { width: 100%; margin-top: 16px; border: 0; border-radius: 10px; padding: 12px 16px; background: #6256c7; color: white; font: inherit; font-weight: 700; cursor: pointer; }
    button.deny { margin-top: 9px; border: 1px solid #cbd5e1; background: white; color: #334155; }
    .error { color: #b42318; }
    .scope { margin: 18px 0; padding: 12px; border-radius: 10px; background: #f5f7fb; font-size: 14px; }
  </style>
</head>
<body>
  <main>
    <div class="brand">EVO</div>
    <h1>Connect Gemini to EVO</h1>
    <p><strong>${safeClientName}</strong> is requesting access to use EVO tools for your account.</p>
    <div class="scope">Access requested: read and make changes through the tools advertised by EVO.</div>
    ${safeError}
    <form method="post" action="/oauth/consent">
      <input type="hidden" name="flow" value="${safeFlow}">
      <label for="passcode">EVO owner passcode</label>
      <input id="passcode" name="passcode" type="password" autocomplete="current-password" required autofocus>
      <button type="submit" name="decision" value="allow">Allow access</button>
      <button class="deny" type="submit" name="decision" value="deny">Cancel</button>
    </form>
  </main>
</body>
</html>`;
}

export function createEvoMcpOAuthRouter(
  provider: EvoMcpOAuthProvider = evoMcpOAuthProvider,
  resourceUrl = getMcpOAuthUrls().resource,
  issuerUrl = getMcpOAuthUrls().issuer
) {
  const router = Router();

  router.get('/oauth/consent', async (req: Request, res: Response) => {
    const flow = typeof req.query.flow === 'string' ? req.query.flow : '';
    if (!provider.readConsentFlow(flow)) {
      return res.status(400).send('This EVO authorization request is invalid or expired. Start the Gemini connection again.');
    }
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
    res.type('html').send(consentPage(flow, await provider.getConsentClientName(flow)));
  });

  router.post('/oauth/consent', async (req: Request, res: Response) => {
    const flow = typeof req.body?.flow === 'string' ? req.body.flow : '';
    res.setHeader('Cache-Control', 'no-store');
    const consent = provider.readConsentFlow(flow);
    if (!consent) {
      return res.status(400).send('This EVO authorization request is invalid or expired. Start the Gemini connection again.');
    }
    const clientName = await provider.getConsentClientName(flow);

    try {
      if (req.body?.decision === 'deny') {
        return res.redirect(302, provider.denyOwnerAuthorization(flow));
      }
      if (req.body?.decision !== 'allow') {
        return res.status(400).send(consentPage(flow, clientName, 'Choose whether to allow the connection.'));
      }
      return res.redirect(302, await provider.authorizeOwner(flow, req.body?.passcode));
    } catch (error) {
      if (error instanceof AccessDeniedError) {
        return res.status(401).type('html').send(consentPage(flow, clientName, 'That passcode was not accepted. Please try again.'));
      }
      console.error('EVO MCP OAuth authorization failed:', error);
      return res.status(503).type('html').send(consentPage(flow, clientName, 'EVO could not complete the connection. Check that the backend database is available, then try again.'));
    }
  });

  router.use(mcpAuthRouter({
    provider,
    issuerUrl,
    baseUrl: issuerUrl,
    resourceServerUrl: resourceUrl,
    scopesSupported: [EVO_MCP_SCOPE, 'offline_access'],
    resourceName: 'EVO Personal Workspace',
  }));

  return router;
}
