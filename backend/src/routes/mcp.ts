import { Router, Request, Response } from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createEvoMcpServer } from '../mcp/geminiEvoMcpServer.js';

const router = Router();
const transports = new Map<string, SSEServerTransport>();

// Helper to set standard SSE and CORS headers
function setMcpHeaders(res: Response) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-requested-with');
}

// OPTIONS preflight handler
router.options('*', (_req: Request, res: Response) => {
  setMcpHeaders(res);
  res.status(204).end();
});

// Info endpoint to quickly check MCP status in browser
router.get('/info', (_req: Request, res: Response) => {
  res.json({
    status: 'online',
    server: 'EVO Gemini MCP Server',
    version: '1.0.0',
    endpoint: '/mcp',
    transport: 'Server-Sent Events (SSE)',
    activeSessions: transports.size,
  });
});

// SSE connection handler: handles GET /mcp and GET /mcp/sse
router.get(['/', '/sse'], async (req: Request, res: Response) => {
  setMcpHeaders(res);
  console.log(`⚡ [MCP] New incoming SSE connection from: ${req.headers['user-agent'] || 'Gemini'}`);

  try {
    const transport = new SSEServerTransport('/mcp/messages', res);
    const server = createEvoMcpServer();

    transports.set(transport.sessionId, transport);
    console.log(`🔌 [MCP] Session started: ${transport.sessionId} (Active: ${transports.size})`);

    res.on('close', () => {
      console.log(`🔌 [MCP] Session disconnected: ${transport.sessionId}`);
      transports.delete(transport.sessionId);
      server.close().catch(() => {});
    });

    await server.connect(transport);
  } catch (error: any) {
    console.error('❌ [MCP] Error establishing SSE connection:', error);
    if (!res.headersSent) {
      res.status(500).send(`Failed to establish MCP connection: ${error.message}`);
    }
  }
});

// Message handler: handles client JSON-RPC messages POST /mcp/messages?sessionId=...
router.post('/messages', async (req: Request, res: Response) => {
  setMcpHeaders(res);
  const sessionId = (req.query.sessionId as string) || '';
  const transport = transports.get(sessionId);

  if (!transport) {
    console.warn(`⚠️ [MCP] Received message for unknown session: ${sessionId}`);
    res.status(404).send('Session not found or expired');
    return;
  }

  try {
    await transport.handlePostMessage(req, res, req.body);
  } catch (error: any) {
    console.error(`❌ [MCP] Error handling message for session ${sessionId}:`, error);
    if (!res.headersSent) {
      res.status(500).send(`Error processing message: ${error.message}`);
    }
  }
});

export default router;
