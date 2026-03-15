// src/index.ts - MCP Server Entry Point (v0.5.2, 2026-03-15)
// ⚠️ CRITICAL ORDER: Suppress console FIRST, then load dotenv, then other imports

// Step 1: Suppress console BEFORE any imports that might log
const originalError = console.error;
const originalLog = console.log;
const originalWarn = console.warn;

// Only suppress in stdio/both modes (will be re-enabled for http mode below)
let suppressConsole = true;
console.error = (...args: any[]) => { if (!suppressConsole) originalError(...args); };
console.log = (...args: any[]) => { if (!suppressConsole) originalLog(...args); };
console.warn = (...args: any[]) => { if (!suppressConsole) originalWarn(...args); };

// Step 2: NOW load dotenv (logging is suppressed)
import * as dotenv from 'dotenv';
dotenv.config({ debug: false });

// Step 3: Continue with normal imports
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { loadConfig } from './config.js';
import { TokenTracker } from './tracking.js';
import { CacheManager } from './cache.js';
import { CostManager } from './cost-manager.js';
import { analyzeDevelopmentProblem } from './dev-guidance.js';
import { configureLogger } from './logger.js';

// Re-export library components for NPM usage
export { ReviewExecutor } from './executor.js';
export { loadConfig } from './config.js';
export { TokenTracker } from './tracking.js';
export { CacheManager } from './cache.js';
export { CostManager } from './cost-manager.js';

// LAZY INITIALIZATION: Don't load ReviewExecutor until tools need it
let reviewExecutor: any = null;
let isInitializing = false;
let sharedCache: CacheManager | null = null;
let sharedCostManager: CostManager | null = null;

function setSharedServices(cache: CacheManager, costManager: CostManager) {
  sharedCache = cache;
  sharedCostManager = costManager;
}

async function getExecutor() {
  if (reviewExecutor) return reviewExecutor;
  if (isInitializing) {
    throw new Error('ReviewExecutor initialization already in progress');
  }

  try {
    isInitializing = true;
    const { ReviewExecutor } = await import('./executor.js');
    const config = loadConfig();
    const tracker = new TokenTracker('.llmapi_usage.json');
    reviewExecutor = new ReviewExecutor(config, tracker, sharedCache || undefined, sharedCostManager || undefined);
    return reviewExecutor;
  } finally {
    isInitializing = false;
  }
}

/**
 * Register all MCP tools on a Server instance.
 * Extracted so both stdio and HTTP transports can share tool definitions.
 */
export function registerTools(server: Server, cache: CacheManager, costManager: CostManager): void {
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'review_content',
          description: 'Submit content for cross-LLM peer review across OpenAI, Gemini, DeepSeek, Mistral, OpenRouter',
          inputSchema: {
            type: 'object' as const,
            properties: {
              content: { type: 'string', description: 'Content to review (code, text, design, etc)' },
              reviewType: {
                type: 'string',
                enum: ['security', 'performance', 'correctness', 'style', 'general'],
                description: 'Type of review to perform',
              },
            },
            required: ['content', 'reviewType'],
          },
        },
        {
          name: 'get_dev_guidance',
          description: 'Get developer guidance for solving a blocker using cross-LLM consensus (INNOVATION: See what EACH model thinks, not just consensus)',
          inputSchema: {
            type: 'object' as const,
            properties: {
              error: { type: 'string', description: 'The error or blocker message (e.g., "PORT IS IN USE at 6277")' },
              technology: { type: 'string', description: 'Technology involved (e.g., "MCP Inspector", "Docker", "Node.js")' },
              environment: { type: 'string', description: 'Environment (e.g., "macOS", "Linux", "Windows")' },
              attempts: {
                type: 'array',
                items: { type: 'string' },
                description: 'What has already been tried to solve this',
              },
              codeSnippet: { type: 'string', description: 'Optional: relevant code snippet' },
            },
            required: ['error', 'technology', 'environment', 'attempts'],
          },
        },
        {
          name: 'get_cache_stats',
          description: 'Get cache performance statistics and metrics',
          inputSchema: { type: 'object' as const, properties: {} },
        },
        {
          name: 'get_cost_summary',
          description: 'Get API cost tracking summary and budget status',
          inputSchema: { type: 'object' as const, properties: {} },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'review_content':
        try {
          const executor = await getExecutor();
          const result = await executor.execute({
            content: args?.content as string,
            type: args?.reviewType as any,
          });
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        } catch (error: any) {
          return {
            content: [{ type: 'text', text: `Error: ${error.message}` }],
          };
        }

      case 'get_dev_guidance':
        try {
          const executor = await getExecutor();
          const guidance = await analyzeDevelopmentProblem(
            {
              error: args?.error as string,
              context: {
                technology: args?.technology as string,
                environment: args?.environment as string,
                attempts: args?.attempts as string[],
              },
              codeSnippet: args?.codeSnippet as string | undefined,
            },
            executor
          );
          return {
            content: [{ type: 'text', text: JSON.stringify(guidance, null, 2) }],
          };
        } catch (error: any) {
          return {
            content: [{ type: 'text', text: `Error: ${error.message}` }],
          };
        }

      case 'get_cache_stats':
        try {
          const stats = cache.getStats();
          return {
            content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }],
          };
        } catch (error: any) {
          return {
            content: [{ type: 'text', text: `Error: ${error.message}` }],
          };
        }

      case 'get_cost_summary':
        try {
          const summary = costManager.getStats();
          return {
            content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
          };
        } catch (error: any) {
          return {
            content: [{ type: 'text', text: `Error: ${error.message}` }],
          };
        }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });
}

// Parse CLI args
function parseArgs(): { mode: 'stdio' | 'http' | 'both'; port: number; host: string } {
  const args = process.argv.slice(2);
  let mode: 'stdio' | 'http' | 'both' = 'stdio';
  let port = 6280;
  let host = '0.0.0.0';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--mode' && args[i + 1]) {
      const val = args[i + 1];
      if (val === 'stdio' || val === 'http' || val === 'both') {
        mode = val;
      }
      i++;
    } else if (args[i] === '--port' && args[i + 1]) {
      port = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--host' && args[i + 1]) {
      host = args[i + 1];
      i++;
    }
  }

  return { mode, port, host };
}

async function startMCPServer() {
  const { mode, port, host } = parseArgs();

  // Un-suppress console for http-only mode (no stdio conflict)
  if (mode === 'http') {
    suppressConsole = false;
  }

  // Configure structured logging: disable for stdio (conflicts with MCP), enable for http
  configureLogger({
    enabled: mode === 'http' || mode === 'both',
    level: 'info',
  });

  try {
    const cache = new CacheManager({
      enabled: true,
      ttl: 86400,
      maxSize: 1000,
      strategy: 'lru'
    });

    const costManager = new CostManager({
      trackingEnabled: true,
      dailyThreshold: 10
    });

    // Share cache and costManager with lazy executor
    setSharedServices(cache, costManager);

    // Start stdio transport
    if (mode === 'stdio' || mode === 'both') {
      const server = new Server(
        { name: 'cross-review-mcp', version: '0.5.2' },
        { capabilities: { tools: {} } }
      );
      registerTools(server, cache, costManager);
      const transport = new StdioServerTransport();
      await server.connect(transport);
    }

    // Start HTTP server (dashboard + MCP endpoint)
    if (mode === 'http' || mode === 'both') {
      const { startHTTPServer } = await import('./server.js');
      await startHTTPServer({ port, host, cache, costManager, registerTools });
    }
  } catch (error: any) {
    originalError('[MCP] FATAL ERROR:', error);
    process.exit(1);
  }
}

if (import.meta.url.endsWith(process.argv[1]) || process.argv[1].endsWith('dist/index.js')) {
  startMCPServer();
}
