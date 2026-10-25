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

// Info / Verification endpoint for health checkers & browser probes
router.get('/info', (req: Request, res: Response) => {
  setCors(req, res);
  res.json({
    status: 'online',
    server: 'EVO Gemini MCP Server',
    version: '1.0.0',
    endpoint: '/mcp',
    transport: 'Streamable HTTP (JSON + SSE)',
    protocolVersion: '2024-11-05',
  });
});

// Universal MCP endpoint handling GET, POST, HEAD
router.all(['/', '/sse'], async (req: Request, res: Response) => {
  setCors(req, res);

  console.log(`📡 [MCP ${req.method}] ${req.originalUrl} | Accept: ${req.headers.accept || 'none'} | UA: ${req.headers['user-agent'] || 'unknown'}`);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // If a GET request comes in without explicit text/event-stream, respond with 200 OK JSON
  // to pass URL verification probes and health checks instantly
  if (req.method === 'GET' && !req.headers.accept?.includes('text/event-stream')) {
    return res.status(200).json({
      status: 'online',
      server: 'EVO Gemini MCP Server',
      version: '1.0.0',
      protocolVersion: '2024-11-05',
      endpoint: '/mcp',
    });
  }

  // Ensure accept header is compatible with Streamable HTTP
  if (!req.headers.accept || req.headers.accept === '*/*') {
    req.headers.accept = 'application/json, text/event-stream';
  } else if (!req.headers.accept.includes('text/event-stream')) {
    req.headers.accept = `${req.headers.accept}, text/event-stream`;
  }

  try {
    // In stateless mode with enableJsonResponse: true, responses to POST JSON-RPC requests
    // are returned as standard application/json, while GET requests receive text/event-stream
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
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
