# Codebase Structure

**Analysis Date:** 2026-02-23

## Directory Layout

```
/Users/keijotuominen/PROJECTS/LLMAPI/
├── src/                    # Source TypeScript
│   ├── index.ts            # MCP server + tool registration
│   ├── engine.ts           # Review orchestration engine
│   └── prompts.ts          # Prompt templates
├── test/                   # Test suite
│   └── smoke.test.js       # Structural validation tests
├── dist/                   # Compiled JavaScript output
├── .planning/              # Planning/analysis documents
│   └── codebase/           # Architecture & structure docs
├── package.json            # Dependencies & scripts
├── tsconfig.json           # TypeScript configuration
├── .env.example            # Example environment template
└── README.md               # User documentation
```

## Directory Purposes

**src/:**
- Purpose: All production TypeScript source code
- Contains: MCP server, review engine, prompt templates
- Key files: `index.ts`, `engine.ts`, `prompts.ts`

**dist/:**
- Purpose: Compiled JavaScript output (ES2022 target, NodeNext module resolution)
- Contains: Transpiled .js files and source maps
- Generated: Yes (via `npm run build` → tsc)
- Committed: No (.gitignore excludes dist)

**test/:**
- Purpose: Test code and validation suites
- Contains: Smoke tests in .js format
- Key files: `smoke.test.js`

**.planning/codebase/:**
- Purpose: Generated codebase analysis documents
- Contains: ARCHITECTURE.md, STRUCTURE.md, and future analysis docs
- Generated: Yes (populated by analysis tools)
- Committed: Yes (valuable for team reference)

## Key File Locations

**Entry Points:**
- `src/index.ts`: Main MCP server (#!/usr/bin/env node shebang at line 1)
- `dist/index.js`: Compiled entry point (referenced in package.json bin field)

**Configuration:**
- `package.json`: Dependencies, scripts, metadata (defines CROSS_REVIEW_MODELS env parsing)
- `tsconfig.json`: ES2022 target, strict mode, NodeNext module resolution
- `.env.example`: Template for required API keys (OPENAI_API_KEY, GEMINI_API_KEY, etc.)

**Core Logic:**
- `src/engine.ts`: CrossReviewEngine class (lines 141-489), ReviewerConfig interface, resolveReviewers() function, KNOWN_PROVIDERS lookup
- `src/prompts.ts`: SCRUTINY_LEVELS enum, CONTENT_TYPES enum, buildAdversarialPrompt(), buildConsensusPrompt()
- `src/index.ts`: Tool registration, result formatting, MCP server setup

**Testing:**
- `test/smoke.test.js`: Structural tests for prompt building, enum definitions, consensus format validation

## Naming Conventions

**Files:**
- Source files use kebab-case logic in PascalCase class names: `engine.ts` contains CrossReviewEngine
- Test files: `{name}.test.{js|ts}` (smoke.test.js)
- Configuration: Dot-prefixed (`.env`, `.env.example`) or standard names (tsconfig.json, package.json)

**Directories:**
- Lowercase with forward slash (src/, test/, dist/, .planning/)
- Logical grouping: src for code, test for tests, .planning for analysis

**Exports:**
- Named exports from modules (prompts.ts exports SCRUTINY_LEVELS, CONTENT_TYPES, buildAdversarialPrompt)
- Default export: none (all modules use named exports)
- Barrel files: No barrel/index files; each module imported directly by name

**Functions:**
- camelCase: buildAdversarialPrompt(), buildConsensusPrompt(), resolveReviewers()
- Private methods in classes: prefixed underscore: _initClients(), _reviewWithModel(), _buildConsensus()

**Types/Interfaces:**
- PascalCase: ReviewerConfig, CrossReviewResult, ReviewResult, TokenUsage, ScrutinyLevel, ContentType
- Type unions: "proceed" | "revise" | "abort" (string literals for verdict)

**Constants:**
- SCREAMING_SNAKE_CASE: SCRUTINY_LEVELS, CONTENT_TYPES, KNOWN_PROVIDERS, MODEL_COSTS, SEVERITY_RANK, DEFAULT_REVIEWERS

## Where to Add New Code

**New Feature (e.g., new review mode):**
- Primary code: `src/engine.ts` (add to ReviewerConfig, modify review() method if needed)
- Supporting prompts: `src/prompts.ts` (add SCRUTINY_LEVELS entry, update buildAdversarialPrompt)
- Tool registration: `src/index.ts` (add server.tool() call if new user-facing tool)
- Tests: `test/smoke.test.js` (add assertions for new feature)

**New Tool Endpoint:**
- Register in: `src/index.ts` using `server.tool(name, schema, handler)`
- Handler typically calls engine methods and formats output via helper functions like formatResult()

**New Content Type (e.g., "security-audit"):**
- Add to: `src/prompts.ts` in CONTENT_TYPES enum (line 35)
- Add checks in: `getContentTypeSpecificInstructions()` function (line 109)
- Update tool schema: `src/index.ts` line 37-47 (content_type enum values)
- Test coverage: `test/smoke.test.js`

**New Model Provider:**
- Add to: `src/engine.ts` KNOWN_PROVIDERS object (line 72)
- Add cost data: MODEL_COSTS object (line 121) with input/output rates per 1M tokens
- Implement provider logic: `reviewWithModel()` switch statement (line 293)
- Ensure API key handling in initClients() (line 151)

**Utilities & Helpers:**
- String parsing/formatting: Keep in `src/index.ts` (e.g., extractIssueCounts, filterBySeverity)
- Cost calculation: `src/engine.ts` (estimateCost method, line 188)
- Prompt building: `src/prompts.ts` (all buildXXX functions)

## Special Directories

**node_modules/:**
- Purpose: Installed npm dependencies
- Generated: Yes (npm install)
- Committed: No (.gitignore)

**dist/:**
- Purpose: Compiled TypeScript output
- Generated: Yes (tsc during npm run build)
- Committed: No (.gitignore)
- Consumed by: package.json "main" and "bin" fields

**.git/:**
- Purpose: Version control
- Ignored in exploration (not a git repo in current context)

## Module Import Pattern

All modules use ES2022 imports with .js extensions (required by NodeNext module resolution):

```typescript
// From index.ts
import { CrossReviewEngine, resolveReviewers, KNOWN_PROVIDERS } from "./engine.js";
import { SCRUTINY_LEVELS, CONTENT_TYPES } from "./prompts.js";

// From engine.ts
import { buildAdversarialPrompt, SCRUTINY_LEVELS } from "./prompts.js";
```

No circular dependencies; dependency graph flows: prompts.ts ← engine.ts ← index.ts

---

*Structure analysis: 2026-02-23*
