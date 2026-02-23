# Architecture

**Analysis Date:** 2026-02-23

## Pattern Overview

**Overall:** Model Context Protocol (MCP) Server with Multi-Provider LLM Orchestration

**Key Characteristics:**
- Multi-model peer review engine with consensus arbitration
- Provider-agnostic abstraction supporting OpenAI, Google Gemini, and OpenAI-compatible APIs
- Adversarial prompt construction with content-type and scrutiny-level customization
- Consensus synthesis using arbitrator selection based on confidence calibration
- Token counting and cost estimation across heterogeneous models

## Layers

**MCP Server Layer:**
- Purpose: Expose tools to Claude Desktop and other MCP clients via stdio transport
- Location: `src/index.ts`
- Contains: Tool registration (cross_review, list_models, list_scrutiny_levels, list_content_types), result formatting, response serialization
- Depends on: CrossReviewEngine, SCRUTINY_LEVELS, CONTENT_TYPES
- Used by: Claude Desktop, Claude Code, Cursor, Windsurf

**Review Engine Layer:**
- Purpose: Orchestrate multi-model reviews and consensus building
- Location: `src/engine.ts`
- Contains: CrossReviewEngine class, ReviewerConfig management, client initialization, model review coordination
- Depends on: OpenAI SDK, Google Generative AI SDK, prompts
- Used by: MCP Server Layer

**Prompt Engineering Layer:**
- Purpose: Generate calibrated adversarial prompts and consensus synthesis prompts
- Location: `src/prompts.ts`
- Contains: SCRUTINY_LEVELS, CONTENT_TYPES, buildAdversarialPrompt(), buildConsensusPrompt()
- Depends on: None
- Used by: Review Engine Layer

## Data Flow

**Review Flow:**

1. User submits content via `cross_review` tool with optional scrutiny_level, content_type, include_consensus, min_severity
2. MCP Server (index.ts) validates inputs and calls engine.review()
3. CrossReviewEngine.review() builds adversarial prompt using buildAdversarialPrompt()
4. Engine spawns parallel Promise.all() calls to reviewWithModel() for each configured reviewer
5. Each reviewWithModel() invokes the appropriate provider API (OpenAI or Gemini) with calibrated parameters
6. Models return structured critiques with severity and confidence ratings
7. If includeConsensus=true and ≥2 successful reviews, engine calls buildConsensus()
8. Arbitrator (model with fewest HIGH-confidence claims) synthesizes verdict
9. Engine aggregates token usage and cost across all models
10. Result formatted by formatResult() in index.ts with severity filtering
11. Formatted text returned to MCP client

**State Management:**
- ReviewerConfig[] stored in engine.reviewers (immutable list set at construction)
- API clients cached in engine.openaiClients (Map<string, OpenAI>) and engine.gemini (GoogleGenerativeAI | null)
- No stateful session storage; each review is independent

## Key Abstractions

**ReviewerConfig:**
- Purpose: Define a single model reviewer with provider, authentication, and model details
- Examples: `src/engine.ts` lines 14-21 (interface), 56-69 (defaults), 72-90 (KNOWN_PROVIDERS)
- Pattern: Union of shorthand string lookup + full config object (polymorphic parsing in resolveReviewers)

**CrossReviewResult:**
- Purpose: Aggregate all review outputs, consensus, token tracking, and cost estimation
- Examples: `src/engine.ts` lines 37-54 (interface definition)
- Pattern: Nested object with reviews array, optional consensus object, accumulated cost/token objects

**TokenUsage:**
- Purpose: Track input and output tokens per model for cost calculation
- Examples: `src/engine.ts` lines 23-26
- Pattern: Simple aggregate object with inputTokens and outputTokens counters

**Prompt Templates:**
- Purpose: Encapsulate scrutiny-level-specific and content-type-specific review directives
- Examples: `src/prompts.ts` SCRUTINY_LEVELS (lines 6-31), CONTENT_TYPES (lines 35-43)
- Pattern: Const object enums with metadata (name, description) and buildXXX() functions that inject values

## Entry Points

**CLI Entry Point (MCP Server):**
- Location: `src/index.ts` (shebang line 1, main() function lines 255-264)
- Triggers: npm start or npx cross-review-mcp (from package.json bin field)
- Responsibilities: Initialize reviewers from CROSS_REVIEW_MODELS env, create McpServer instance, register tools, start stdio transport

**Tool: cross_review:**
- Location: `src/index.ts` lines 29-88
- Triggers: Called by MCP client when user invokes tool
- Responsibilities: Parse and validate input, call engine.review(), catch errors, return formatted response

**Tool: list_models:**
- Location: `src/index.ts` lines 102-124
- Triggers: User requests available models
- Responsibilities: Return active reviewers and KNOWN_PROVIDERS lookup table

**Tool: list_scrutiny_levels:**
- Location: `src/index.ts` lines 90-100
- Triggers: User requests scrutiny options
- Responsibilities: Format SCRUTINY_LEVELS as JSON array of {level, name, description}

**Tool: list_content_types:**
- Location: `src/index.ts` lines 126-135
- Triggers: User requests content type options
- Responsibilities: Format CONTENT_TYPES as JSON array of {type, description}

## Error Handling

**Strategy:** Fail gracefully per model; surface errors in review results; allow partial consensus

**Patterns:**
- Missing API key: Logged to stderr during initClients(); client skipped; review runs with remaining models
- API call failure: Caught in reviewWithModel() try-catch (lines 349-356); returns ReviewResult with status="error"
- Consensus build failure: Caught at line 456; returns undefined; reviewers field still populated
- Invalid input: Zod schemas validate at tool invocation; returns error content with isError=true
- Verdict parsing failure: Falls back to "revise" (line 487)

## Cross-Cutting Concerns

**Logging:**
- Approach: console.error() for startup diagnostics (reviewer list, MCP startup), error conditions
- Examples: lines 13, 162, 258, 261

**Validation:**
- Approach: Zod schemas for tool inputs (index.ts lines 31-59)
- Scrutiny levels and content types are enum constrained
- include_consensus defaults to true if omitted
- min_severity filters applied post-hoc (filterBySeverity function, lines 233-252)

**Authentication:**
- Approach: Environment variable lookup per provider (engine.ts lines 153-159)
- Fallback hierarchy: reviewer.apiKeyEnv → provider default (OPENAI_API_KEY, GEMINI_API_KEY) → undefined
- API keys never logged or exposed in responses

**Cost Tracking:**
- Approach: MODEL_COSTS lookup table (engine.ts lines 121-139) with 1M-token rates
- Estimated at result time using model ID and actual token counts from API responses
- Summed across all reviews + consensus call

**Provider Abstraction:**
- Approach: Provider-specific logic in reviewWithModel() switch statement (engine.ts lines 293-340)
- OpenAI/compatible: Uses OpenAI SDK with baseURL override if provided
- Gemini: Uses Google Generative AI SDK
- Token parameter variance: GPT-5.x uses max_completion_tokens; others use max_tokens

---

*Architecture analysis: 2026-02-23*
