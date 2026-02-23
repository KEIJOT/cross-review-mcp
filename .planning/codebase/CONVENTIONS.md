# Coding Conventions

**Analysis Date:** 2026-02-23

## Naming Patterns

**Files:**
- TypeScript source files: `camelCase.ts` (e.g., `engine.ts`, `prompts.ts`, `index.ts`)
- Test files: `test-*.mjs` or `*.test.js` (e.g., `smoke.test.js`, `test-live.mjs`, `test-keys.mjs`)
- Configuration files: lowercase with dashes (e.g., `tsconfig.json`, `package.json`)

**Functions:**
- camelCase for function names: `buildAdversarialPrompt()`, `resolveReviewers()`, `extractSection()`
- Private methods: camelCase with leading underscore or `private` keyword: `private initClients()`, `private getOpenAIClient()`
- Async functions: declared with `async` keyword: `async review()`, `async reviewWithModel()`
- Utility/helper functions: placed after main exports in same file

**Variables:**
- camelCase for all variables: `reviewers`, `apiKey`, `levelConfig`, `startTime`
- Constants: UPPER_SNAKE_CASE for module-level constants: `DEFAULT_REVIEWERS`, `KNOWN_PROVIDERS`, `MODEL_COSTS`, `SEVERITY_RANK`
- Type variables: PascalCase for type parameters in generics: `Record<string, TokenUsage>`
- Query/match results: short descriptive names: `match`, `matches`, `severityMatch`

**Types:**
- PascalCase for interface names: `ReviewerConfig`, `TokenUsage`, `ReviewResult`, `CrossReviewResult`
- Export type aliases: `export type ScrutinyLevel = keyof typeof SCRUTINY_LEVELS`
- Use discriminated unions for result types: `status: "success" | "error"` with type guards

**Enums/Constants:**
- Const objects for enum-like values:
  ```typescript
  export const SCRUTINY_LEVELS = {
    quick: { name: "Quick", ... },
    standard: { name: "Standard", ... },
  } as const;
  ```
- Use `as const` for immutable configuration objects

## Code Style

**Formatting:**
- No dedicated formatter configured (no `.prettierrc`, `.eslintrc`, or Biome config files)
- Code follows consistent style by convention:
  - 2-space indentation (observed throughout codebase)
  - Line length varies (not enforced)
  - Semicolons: always used at statement ends
  - Trailing commas: used in multiline objects/arrays

**Linting:**
- No linter configured (no ESLint or similar)
- TypeScript `strict: true` in `tsconfig.json` enforces type safety at compile time
- Compiler options enabled: `strict`, `esModuleInterop`, `forceConsistentCasingInFileNames`

**Quote Style:**
- Double quotes for string literals: `"content"`, `"openai"`
- Template literals for interpolation and multiline strings

## Import Organization

**Order:**
1. External packages (node_modules)
2. Internal modules with relative paths

**Pattern:**
```typescript
// External packages - first
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

// MCP SDK imports
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Internal modules - relative paths with .js extension
import { CrossReviewEngine, resolveReviewers, KNOWN_PROVIDERS, type CrossReviewResult } from "./engine.js";
import { SCRUTINY_LEVELS, CONTENT_TYPES } from "./prompts.js";

// Type imports mixed with value imports, using `type` keyword for types
import { type ReviewerConfig, type TokenUsage } from "./engine.js";
```

**Path Aliases:**
- Not used; relative imports with `.js` extensions (for ESM compatibility)
- Always include `.js` extension in relative imports for Node.js ESM modules

## Error Handling

**Patterns:**

**Try-catch for async operations:**
```typescript
try {
  const result = await engine.review(params.content, options);
  return { content: [{ type: "text" as const, text: formatResult(result) }] };
} catch (error) {
  return {
    content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
    isError: true,
  };
}
```

**Type-safe error checking:**
- Always check `error instanceof Error` before accessing `.message`
- Fallback to `String(error)` for unknown error types
- Do not throw errors; return error status in result objects

**Promise.all with error recovery:**
- Wraps promise arrays with error handling in try-catch
- Returns partial results even if some promises reject
- Failed reviews return: `{ model: name, status: "error", error: message, durationMs }`

**Null/undefined checks:**
- Optional chaining: `response.choices[0]?.message?.content || ""`
- Nullish coalescing: `options.scrutinyLevel || "standard"`, `options.includeConsensus ?? true`

## Logging

**Framework:** `console` (built-in)

**Patterns:**
- `console.error()` for startup logs and error messages: `console.error("Reviewers: ...")`
- `console.log()` for test output: used extensively in test files
- Startup logging to stderr: all status messages use `console.error()` at process start
- No structured logging (no Winston, Pino, etc.)

## Comments

**When to Comment:**
- JSDoc comments for exported functions and types
- Inline comments for complex logic or non-obvious intent
- File-level comments at top: version, date, and key changes
- No comment before every function; only for public API and complex code

**JSDoc/TSDoc:**
- File header format:
  ```typescript
  // Cross-LLM Review Protocol - Core Engine (v0.4.0, 2026-02-22)
  // Changes: Multi-provider support, configurable reviewers via env
  ```
- Used minimally; TypeScript types document interfaces
- When used: describes parameters, return type, and purpose
- Example from code:
  ```typescript
  /**
   * Resolve reviewers from environment variable or use defaults.
   * Accepts JSON array of shorthand ids or full ReviewerConfig objects.
   */
  export function resolveReviewers(envModels?: string): ReviewerConfig[]
  ```

## Function Design

**Size:**
- Small utility functions: 5-20 lines (e.g., `extractIssueCounts()`, `extractSection()`)
- Medium functions: 40-80 lines (e.g., `reviewWithModel()`)
- Large functions: up to 150+ lines (e.g., `buildConsensus()` with multiple branches)
- Class methods follow similar patterns; private helpers keep public methods readable

**Parameters:**
- Typed parameters using TypeScript interfaces: `reviewer: ReviewerConfig`
- Options objects for multiple optional parameters:
  ```typescript
  async review(
    content: string,
    options: {
      scrutinyLevel?: ScrutinyLevel;
      contentType?: ContentType;
      includeConsensus?: boolean;
    } = {}
  )
  ```
- Destructuring in function signatures where appropriate

**Return Values:**
- Explicit return types on all function signatures
- Union types for operations that may fail: `ReviewResult` with `status: "success" | "error"`
- Discriminated unions with type guards:
  ```typescript
  const successfulReviews = reviews.filter(
    (r): r is ReviewResult & { critique: string } =>
      r.status === "success" && !!r.critique
  );
  ```
- Never use implicit `any` returns

## Module Design

**Exports:**
- `export` keyword for public API items (interfaces, functions, classes, constants)
- `export type` for type-only imports
- No barrel files (no `index.ts` re-exporting from other modules in `src/`)
- File-by-file exports kept simple

**Module Organization:**
- `src/index.ts`: MCP server setup, tool definitions, and formatting logic
- `src/engine.ts`: Core review engine, client initialization, token tracking
- `src/prompts.ts`: Prompt templates and scrutiny/content type definitions
- Clear separation of concerns: server, engine, prompts

**Interdependencies:**
- `index.ts` depends on `engine.ts` and `prompts.ts`
- `engine.ts` depends on `prompts.ts`
- `prompts.ts` has no internal dependencies (only exported types)
- Circular dependencies: none detected

---

*Convention analysis: 2026-02-23*
