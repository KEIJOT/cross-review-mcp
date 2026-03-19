// src/index.ts - MCP Server Entry Point (v0.6.0, 2026-03-15)
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
import { buildModelBenchmark } from './benchmark.js';
import { searchModels, testModel, swapModel, findReplacement } from './model-discovery.js';

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
export function registerTools(server: Server, cache: CacheManager, costManager: CostManager, sessionId?: string): void {
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
              models: {
                oneOf: [
                  {
                    type: 'string',
                    enum: ['fast', 'balanced', 'thorough'],
                    description: 'Preset: "fast" (cheapest 2), "balanced" (3 models), "thorough" (all)',
                  },
                  {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Specific model IDs to use (e.g., ["openai", "gemini"])',
                  },
                ],
                description: 'Which models to use. Preset name or array of model IDs. Default: all models.',
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
              models: {
                oneOf: [
                  {
                    type: 'string',
                    enum: ['fast', 'balanced', 'thorough'],
                    description: 'Preset: "fast" (cheapest 2), "balanced" (3 models), "thorough" (all)',
                  },
                  {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Specific model IDs to use (e.g., ["openai", "gemini"])',
                  },
                ],
                description: 'Which models to use. Preset name or array of model IDs. Default: all models.',
              },
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
        {
          name: 'benchmark_models',
          description: 'Get per-model performance benchmarks: avg latency, error rate, tokens/request, cost efficiency, and reliability ranking',
          inputSchema: { type: 'object' as const, properties: {} },
        },
        {
          name: 'search_models',
          description: 'Search available LLM models on OpenRouter. Find free alternatives, compare context lengths, and discover new models.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              query: { type: 'string', description: 'Search query (e.g., "llama", "mistral", "coding", "free")' },
              freeOnly: { type: 'boolean', description: 'Only show free models (default: false)' },
              minContextLength: { type: 'number', description: 'Minimum context window size (default: 0)' },
              maxResults: { type: 'number', description: 'Max results to return (default: 20)' },
            },
          },
        },
        {
          name: 'test_model',
          description: 'Test a specific model by sending a probe request. Returns latency, token counts, and response content.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              modelId: { type: 'string', description: 'Model ID to test (e.g., "openai/gpt-oss-120b:free")' },
              baseUrl: { type: 'string', description: 'API base URL (default: OpenRouter)' },
            },
            required: ['modelId'],
          },
        },
        {
          name: 'swap_model',
          description: 'Replace a reviewer\'s model in the config. Tests the new model first, then updates llmapi.config.json.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              reviewerId: { type: 'string', description: 'ID of the reviewer slot to update (e.g., "openrouter", "nemotron")' },
              newModelId: { type: 'string', description: 'New model ID (e.g., "nvidia/nemotron-3-super-120b-a12b:free")' },
              newName: { type: 'string', description: 'Optional display name for the reviewer' },
              baseUrl: { type: 'string', description: 'API base URL (default: OpenRouter)' },
              skipTest: { type: 'boolean', description: 'Skip the pre-swap test (default: false)' },
            },
            required: ['reviewerId', 'newModelId'],
          },
        },
        {
          name: 'find_replacement',
          description: 'Automatically search, test, and recommend replacement models for a failing reviewer. Tests multiple candidates and ranks by reliability and speed.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              reviewerId: { type: 'string', description: 'ID of the reviewer to find a replacement for' },
              freeOnly: { type: 'boolean', description: 'Only consider free models (default: true)' },
              minContextLength: { type: 'number', description: 'Minimum context window (default: 32000)' },
              maxCandidates: { type: 'number', description: 'Number of models to test (default: 5)' },
            },
            required: ['reviewerId'],
          },
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
            models: args?.models as string | string[] | undefined,
            sessionId,
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
            executor,
            args?.models as string | string[] | undefined,
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

      case 'benchmark_models':
        try {
          const benchmark = buildModelBenchmark(costManager);
          return {
            content: [{ type: 'text', text: JSON.stringify(benchmark, null, 2) }],
          };
        } catch (error: any) {
          return {
            content: [{ type: 'text', text: `Error: ${error.message}` }],
          };
        }

      case 'search_models':
        try {
          const models = await searchModels({
            query: args?.query as string | undefined,
            freeOnly: args?.freeOnly as boolean | undefined,
            minContextLength: args?.minContextLength as number | undefined,
            maxResults: args?.maxResults as number | undefined,
          });
          return {
            content: [{ type: 'text', text: JSON.stringify({ count: models.length, models }, null, 2) }],
          };
        } catch (error: any) {
          return {
            content: [{ type: 'text', text: `Error: ${error.message}` }],
          };
        }

      case 'test_model':
        try {
          const apiKey = process.env.OPENROUTER_API_KEY || '';
          const result = await testModel(
            args?.modelId as string,
            apiKey,
            args?.baseUrl as string | undefined,
          );
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        } catch (error: any) {
          return {
            content: [{ type: 'text', text: `Error: ${error.message}` }],
          };
        }

      case 'swap_model':
        try {
          const result = await swapModel(
            args?.reviewerId as string,
            args?.newModelId as string,
            {
              testFirst: !(args?.skipTest as boolean),
              baseUrl: args?.baseUrl as string | undefined,
              newName: args?.newName as string | undefined,
            },
          );
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        } catch (error: any) {
          return {
            content: [{ type: 'text', text: `Error: ${error.message}` }],
          };
        }

      case 'find_replacement':
        try {
          const result = await findReplacement(
            args?.reviewerId as string,
            {
              freeOnly: args?.freeOnly as boolean | undefined,
              minContextLength: args?.minContextLength as number | undefined,
              maxCandidates: args?.maxCandidates as number | undefined,
            },
          );
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
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
function parseArgs(): { mode: 'stdio' | 'http' | 'both'; port: number; host: string; authToken?: string } {
  const args = process.argv.slice(2);
  let mode: 'stdio' | 'http' | 'both' = 'stdio';
  let port = 6280;
  let host = '0.0.0.0';
  let authToken: string | undefined = process.env.AUTH_TOKEN;

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
    } else if (args[i] === '--auth-token' && args[i + 1]) {
      authToken = args[i + 1];
      i++;
    }
  }

  return { mode, port, host, authToken };
}

async function startMCPServer() {
  const { mode, port, host, authToken } = parseArgs();

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
    const config = loadConfig();

    const cache = new CacheManager({
      enabled: true,
      ttl: 86400,
      maxSize: 1000,
      strategy: 'lru'
    });

    const costManager = new CostManager({
      trackingEnabled: true,
      dailyThreshold: 10,
      configCosts: config.costs.models,
    });

    // Share cache and costManager with lazy executor
    setSharedServices(cache, costManager);

    // Start stdio transport
    if (mode === 'stdio' || mode === 'both') {
      const server = new Server(
        { name: 'cross-review-mcp', version: '0.6.0' },
        { capabilities: { tools: {} } }
      );
      registerTools(server, cache, costManager);
      const transport = new StdioServerTransport();
      await server.connect(transport);
    }

    // Start HTTP server (dashboard + MCP endpoint)
    if (mode === 'http' || mode === 'both') {
      const { startHTTPServer } = await import('./server.js');
      await startHTTPServer({
        port,
        host,
        cache,
        costManager,
        registerTools,
        authToken,
        providerIds: config.reviewers.map(r => r.id),
        reviewerConfigs: config.reviewers.map(r => ({ id: r.id, apiKeyEnv: r.apiKeyEnv })),
        version: '0.6.0',
      });
    }
  } catch (error: any) {
    originalError('[MCP] FATAL ERROR:', error);
    process.exit(1);
  }
}

const entryArg = process.argv[1] || '';
if (import.meta.url.endsWith(entryArg) || entryArg.endsWith('dist/index.js')) {
  startMCPServer();
}
