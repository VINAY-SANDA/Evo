import { Router, Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createEvoMcpServer } from '../mcp/geminiEvoMcpServer.js';

const router = Router();

function setCors(req: Request, res: Response) {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, x-requested-with, mcp-session-id');
}

// OPTIONS preflight
router.options('*', (req: Request, res: Response) => {
  setCors(req, res);
  res.status(204).end();
});

// Info endpoint for quick health and connectivity check
router.get('/info', (_req: Request, res: Response) => {
  res.json({
    status: 'online',
    server: 'EVO Gemini MCP Server',
    version: '1.0.0',
    endpoint: '/mcp',
    transport: 'Streamable HTTP (Per-Request Stateless)',
  });
});

// Universal MCP endpoint handling both GET and POST per-request
router.all(['/', '/sse'], async (req: Request, res: Response) => {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Ensure accept header is compatible with Streamable HTTP if missing or wildcard
  if (!req.headers.accept || req.headers.accept === '*/*') {
    req.headers.accept = 'application/json, text/event-stream';
  } else if (!req.headers.accept.includes('text/event-stream')) {
    req.headers.accept = `${req.headers.accept}, text/event-stream`;
  }

  try {
    // In stateless mode, a fresh transport and server instance must be used per request
    // to avoid cross-request collision and ensure compliant JSON-RPC message delivery
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    const server = createEvoMcpServer();
    await server.connect(transport);

    await transport.handleRequest(req, res, req.body);
  } catch (error: any) {
    console.error('❌ [MCP] Error handling request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: `Internal server error: ${error.message}` },
        id: null,
      });
    }
  }
});

export default router;
