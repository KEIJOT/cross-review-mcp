# Technology Stack

**Analysis Date:** 2026-02-23

## Languages

**Primary:**
- TypeScript 5.8.3 - All application source code in `src/`

## Runtime

**Environment:**
- Node.js >= 18.0.0

**Package Manager:**
- npm (with npm lockfile)
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- @modelcontextprotocol/sdk 1.0.0 - MCP server framework for AI tool integration

**API Clients:**
- openai 4.0.0 - OpenAI-compatible API client for GPT models and compatible providers
- @google/generative-ai 0.21.0 - Google Gemini API client

**Validation:**
- zod 3.24.0 - Runtime type validation and schema definition for tool parameters

## Key Dependencies

**Critical:**
- @modelcontextprotocol/sdk - Enables MCP protocol compliance for tool registration and communication
- openai - Universal client for OpenAI and OpenAI-compatible APIs (DeepSeek, Mistral, etc.)
- @google/generative-ai - Direct integration with Google Gemini models

**Development:**
- @types/node 20.11.24 - TypeScript type definitions for Node.js
- dotenv 17.3.1 - Environment variable loading from `.env` files
- typescript 5.8.3 - TypeScript compiler for strict type checking

## Configuration

**Environment:**
- Configuration via environment variables (no config files required)
- Critical env vars:
  - `OPENAI_API_KEY` - API key for OpenAI models
  - `GEMINI_API_KEY` - API key for Google Gemini models
  - `DEEPSEEK_API_KEY` - API key for DeepSeek models (optional)
  - `MISTRAL_API_KEY` - API key for Mistral models (optional)
  - `OPENROUTER_API_KEY` - API key for OpenRouter free models (optional)
  - `CROSS_REVIEW_MODELS` - JSON array of reviewer configurations (optional, defaults to GPT-5.2 + Gemini Flash)

**Build:**
- TypeScript configuration: `tsconfig.json`
  - Target: ES2022
  - Module: NodeNext
  - Strict type checking enabled
  - Source maps and declaration files generated
  - Output directory: `dist/`
  - Source directory: `src/`

## Compiler Settings

**TypeScript Options:**
- `strict: true` - All strict type-checking options enabled
- `esModuleInterop: true` - CommonJS/ES module compatibility
- `skipLibCheck: true` - Skip type checking of declaration files
- `forceConsistentCasingInFileNames: true` - Enforce consistent casing
- `declaration: true` - Generate `.d.ts` files
- `declarationMap: true` - Source maps for declarations
- `sourceMap: true` - Source maps for compiled JavaScript

## Platform Requirements

**Development:**
- Node.js 18.0.0 or higher
- npm (version bundled with Node.js)
- TypeScript compiler (installed via npm)

**Production:**
- Node.js 18.0.0 or higher
- No native dependencies
- Executable: `dist/index.js` (compiled from `src/index.ts`)

## Build Process

**Commands:**
- `npm run build` - Compiles TypeScript to JavaScript in `dist/`
- `npm run dev` - Runs TypeScript compiler in watch mode
- `npm start` - Executes compiled server at `node dist/index.js`
- `npm run inspect` - Launches MCP Inspector for debugging
- `npm run test` - Builds and runs smoke test suite

**Build Artifacts:**
- Generated in `dist/` directory (not committed)
- All source maps and type declarations included
- Distributable via npm registry

## Package Publishing

**Entry Point:**
- Main: `dist/index.js`
- Bin: `cross-review-mcp` command-line tool
- Files included in npm package: `dist/`, `README.md`

**Distribution:**
- Published to npm registry as `cross-review-mcp`
- Version: 0.4.0
- License: MIT

---

*Stack analysis: 2026-02-23*
