// src/index.ts - MCP Server Entry Point (v0.5.2, 2026-03-15)
// ⚠️ CRITICAL ORDER: Suppress console FIRST, then load dotenv, then other imports

// Step 1: Suppress console BEFORE any imports that might log
const originalError = console.error;
const originalLog = console.log;
const originalWarn = console.warn;
console.error = () => {};
console.log = () => {};
console.warn = () => {};

// Step 2: NOW load dotenv (logging is suppressed)
import * as dotenv from 'dotenv';
dotenv.config({ debug: false });

// Step 3: Continue with normal imports
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema, 
  Tool, 
  TextContent 
} from '@modelcontextprotocol/sdk/types.js';
import { loadConfig } from './config.js';
import { TokenTracker } from './tracking.js';
import { CacheManager } from './cache.js';
import { CostManager } from './cost-manager.js';
import { analyzeDevelopmentProblem, type DevelopmentProblem } from './dev-guidance.js';

// Re-export library components for NPM usage
export { ReviewExecutor } from './executor.js';
export { loadConfig } from './config.js';
export { TokenTracker } from './tracking.js';
export { CacheManager } from './cache.js';
export { CostManager } from './cost-manager.js';

// LAZY INITIALIZATION: Don't load ReviewExecutor until tools need it
let reviewExecutor: any = null;
let isInitializing = false;

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
    reviewExecutor = new ReviewExecutor(config, tracker);
    return reviewExecutor;
  } finally {
    isInitializing = false;
  }
}

async function startMCPServer() {
  try {
    // Initialize ONLY non-API services at startup
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

    // Create Server with EXPLICIT capabilities
    const server = new Server(
      {
        name: 'cross-review-mcp',
        version: '0.5.2',
      },
      {
        capabilities: {
          tools: {}, // REQUIRED for the inspector to see tools
        },
      }
    );

    // Register tool list
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'review_content',
            description: 'Submit content for cross-LLM peer review across OpenAI, Gemini, DeepSeek, Mistral, OpenRouter',
            inputSchema: {
              type: 'object',
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
              type: 'object',
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
            inputSchema: { type: 'object', properties: {} },
          },
          {
            name: 'get_cost_summary',
            description: 'Get API cost tracking summary and budget status',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
      };
    });

    // Register tool execution
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

    // Connect Transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
  } catch (error: any) {
    originalError('[MCP] ❌ FATAL ERROR:', error);
    process.exit(1);
  }
}

if (import.meta.url.endsWith(process.argv[1]) || process.argv[1].endsWith('dist/index.js')) {
  startMCPServer();
}
