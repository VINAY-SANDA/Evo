import { Router, Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createEvoMcpServer } from '../mcp/geminiEvoMcpServer.js';

const router = Router();

// Create streamable transport in stateless mode (ideal for cloud/distributed deployment)
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined,
});

const server = createEvoMcpServer();
let isConnected = false;
async function ensureConnected() {
  if (!isConnected) {
    await server.connect(transport);
    isConnected = true;
  }
}
ensureConnected().catch((err) => {
  console.error('Failed to initialize MCP Streamable transport:', err);
});

function setCors(req: Request, res: Response) {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, x-requested-with');
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
    transport: 'Streamable HTTP + SSE',
  });
});

// Universal MCP endpoint handling both GET and POST
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
    await ensureConnected();
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
