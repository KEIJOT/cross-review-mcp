// src/server.ts - Express HTTP server with MCP StreamableHTTP transport + dashboard
import express from 'express';
import { randomUUID } from 'crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { eventBus } from './events.js';
import { getDashboardHTML } from './dashboard.js';
import { CacheManager } from './cache.js';
import { CostManager } from './cost-manager.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

export interface HTTPServerOptions {
  port: number;
  host: string;
  cache: CacheManager;
  costManager: CostManager;
  registerTools: (server: Server, cache: CacheManager, costManager: CostManager) => void;
  authToken?: string;
  providerIds?: string[];
  version?: string;
}

export async function startHTTPServer(options: HTTPServerOptions): Promise<void> {
  const { port, host, cache, costManager, registerTools, authToken, providerIds, version } = options;
  const app = express();

  // Track active transports per session
  const transports = new Map<string, StreamableHTTPServerTransport>();

  // Health check endpoint (always unauthenticated)
  app.get('/health', (_req: express.Request, res: express.Response) => {
    const providers: Record<string, string> = {};
    for (const id of (providerIds || [])) {
      const envKey = `${id.toUpperCase()}_API_KEY`;
      providers[id] = process.env[envKey] ? 'up' : 'down';
    }
    res.json({
      status: 'ok',
      uptime: Math.floor(eventBus.getUptimeMs() / 1000),
      providers,
      version: version || '0.6.0',
      activeSessions: transports.size,
      totalRequests: eventBus.getTotalRequests(),
    });
  });

  // Auth middleware — applied to all routes except /health
  if (authToken) {
    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (req.path === '/health') { next(); return; }

      // Allow dashboard access with ?token= query param
      if (req.path === '/' && req.query.token === authToken) { next(); return; }

      const header = req.headers['authorization'];
      if (header === `Bearer ${authToken}`) { next(); return; }

      res.status(401).json({ error: 'Unauthorized. Provide Authorization: Bearer <token> header.' });
    });
  }

  // Parse JSON for MCP endpoint
  app.use('/mcp', express.json());

  // Dashboard
  app.get('/', (_req: express.Request, res: express.Response) => {
    res.type('html').send(getDashboardHTML(port));
  });

  // Stats API
  app.get('/api/stats', (_req: express.Request, res: express.Response) => {
    const recentRequests = eventBus.getRecentRequests().slice(0, 20).map(r => ({
      requestId: r.requestId,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      type: r.type,
      contentLength: r.contentLength,
      executionTimeMs: r.executionTimeMs,
      totalCost: r.totalCost,
      completed: !!r.completedAt,
      models: Array.from(r.models.entries()).map(([id, m]) => ({
        id,
        status: m.success ? 'success' : 'error',
        time: m.executionTimeMs,
      })),
    }));

    res.json({
      uptimeMs: eventBus.getUptimeMs(),
      totalRequests: eventBus.getTotalRequests(),
      activeSessions: transports.size,
      costs: costManager.getStats(),
      cache: cache.getStats(),
      recentRequests,
    });
  });

  // SSE live events
  app.get('/api/events', (req: express.Request, res: express.Response) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write(':\n\n'); // SSE comment as keepalive

    const onStart = (data: any) => { res.write(`event: request:start\ndata: ${JSON.stringify(data)}\n\n`); };
    const onModelComplete = (data: any) => { res.write(`event: model:complete\ndata: ${JSON.stringify(data)}\n\n`); };
    const onComplete = (data: any) => { res.write(`event: request:complete\ndata: ${JSON.stringify(data)}\n\n`); };

    eventBus.on('request:start', onStart);
    eventBus.on('model:complete', onModelComplete);
    eventBus.on('request:complete', onComplete);

    req.on('close', () => {
      eventBus.off('request:start', onStart);
      eventBus.off('model:complete', onModelComplete);
      eventBus.off('request:complete', onComplete);
    });
  });

  // MCP StreamableHTTP endpoint - handles POST, GET, DELETE
  app.all('/mcp', async (req: express.Request, res: express.Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (req.method === 'GET' || req.method === 'DELETE') {
      // GET opens SSE stream, DELETE closes session
      if (sessionId && transports.has(sessionId)) {
        const transport = transports.get(sessionId)!;
        await transport.handleRequest(
          req as unknown as IncomingMessage,
          res as unknown as ServerResponse,
        );
      } else if (req.method === 'DELETE') {
        res.status(404).json({ error: 'Session not found' });
      } else {
        res.status(400).json({ error: 'Missing or invalid session ID' });
      }
      return;
    }

    // POST - either initialization or existing session message
    if (sessionId && transports.has(sessionId)) {
      // Existing session
      const transport = transports.get(sessionId)!;
      await transport.handleRequest(
        req as unknown as IncomingMessage,
        res as unknown as ServerResponse,
        req.body,
      );
      return;
    }

    // New session - create transport + server
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });

    const server = new Server(
      { name: 'cross-review-mcp', version: '0.6.0' },
      { capabilities: { tools: {} } },
    );

    registerTools(server, cache, costManager);
    await server.connect(transport);

    // Store by session ID once assigned
    transport.onclose = () => {
      if (transport.sessionId) {
        transports.delete(transport.sessionId);
      }
    };

    // Handle the initialization request
    await transport.handleRequest(
      req as unknown as IncomingMessage,
      res as unknown as ServerResponse,
      req.body,
    );

    // After handling, the transport has a session ID
    if (transport.sessionId) {
      transports.set(transport.sessionId, transport);
    }
  });

  app.listen(port, host, () => {
    console.log(`Cross-Review MCP Dashboard: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
    console.log(`MCP endpoint: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/mcp`);
    console.log(`SSE events: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/api/events`);
  });
}
