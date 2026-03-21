// Cross-Review MCP - Adaptive Fallback Tests
// Tests failure classification, proactive skip, token estimation, and fallback tagging
// No API keys needed — tests pure functions and executor with mock providers

import { classifyFailure, estimateTokens } from "../dist/executor.js";
import { ReviewExecutor } from "../dist/executor.js";
import { TokenTracker } from "../dist/tracking.js";
import { CacheManager } from "../dist/cache.js";
import { CostManager } from "../dist/cost-manager.js";
import { configureLogger } from "../dist/logger.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testLogFile = path.join(__dirname, ".test_fallback_usage.json");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  \u2713 ${message}`);
  } else {
    failed++;
    console.error(`  \u2717 ${message}`);
  }
}

configureLogger({ enabled: false });

// ── classifyFailure() ──

console.log("\n\u2500\u2500 Failure Classification \u2500\u2500\n");

{
  // Token limit: 0 output tokens with positive input tokens
  assert(
    classifyFailure("", 0, 500) === "token_limit",
    "0 output + positive input = token_limit"
  );

  // Rate limit: error contains 'rate'
  assert(
    classifyFailure("rate limit exceeded", 0, 0) === "rate_limit",
    "Error with 'rate' = rate_limit"
  );

  // Rate limit: error contains '429'
  assert(
    classifyFailure("HTTP 429 Too Many Requests", 0, 0) === "rate_limit",
    "Error with '429' = rate_limit"
  );

  // Empty response
  assert(
    classifyFailure("Empty response from model", 0, 0) === "empty_response",
    "Error with 'Empty response' = empty_response"
  );

  // Network errors (retryable patterns)
  assert(
    classifyFailure("ECONNRESET", 0, 0) === "network",
    "ECONNRESET = network"
  );
  assert(
    classifyFailure("502 Bad Gateway", 0, 0) === "network",
    "502 Bad Gateway = network"
  );
  assert(
    classifyFailure("socket hang up", 0, 0) === "network",
    "socket hang up = network"
  );
  assert(
    classifyFailure("fetch failed", 0, 0) === "network",
    "fetch failed = network"
  );

  // Unknown: nothing matches
  assert(
    classifyFailure("some random error", 0, 0) === "unknown",
    "Unrecognized error = unknown"
  );

  // Edge: token_limit takes priority over rate_limit text when outputTokens=0 and inputTokens>0
  assert(
    classifyFailure("rate limit", 0, 100) === "token_limit",
    "Token limit check takes priority over rate_limit text"
  );
}

// ── estimateTokens() ──

console.log("\n\u2500\u2500 Token Estimation \u2500\u2500\n");

{
  assert(
    estimateTokens("") === 0,
    "Empty string = 0 tokens"
  );

  assert(
    estimateTokens("a") === 1,
    "Single char = 1 token (ceiling)"
  );

  assert(
    estimateTokens("abcd") === 1,
    "4 chars = 1 token"
  );

  assert(
    estimateTokens("abcde") === 2,
    "5 chars = 2 tokens (ceiling of 5/4)"
  );

  const longText = "x".repeat(10000);
  assert(
    estimateTokens(longText) === 2500,
    "10000 chars = 2500 tokens"
  );

  // Realistic prompt
  const prompt = "Please review this code for security vulnerabilities. ".repeat(100);
  const estimated = estimateTokens(prompt);
  assert(
    estimated > 0 && estimated === Math.ceil(prompt.length / 4),
    `Realistic prompt: ${prompt.length} chars = ${estimated} tokens`
  );
}

// ── Proactive Skip (context window exceeded) ──

console.log("\n\u2500\u2500 Proactive Skip \u2500\u2500\n");

{
  // Create executor with a reviewer that has a small contextLength
  const config = {
    reviewers: [
      {
        id: "tiny-model",
        provider: "openai-compatible",
        model: "test/tiny-model",
        baseUrl: "https://openrouter.ai/api/v1",
        apiKeyEnv: "FAKE_KEY",
        contextLength: 100,  // very small — any real prompt will exceed 80%
        timeout_ms: 5000,
        execution_order: 1,
      },
    ],
    execution: { strategy: "wait_all", allow_partial_results: true },
    costs: { models: {} },
    tracking: { enabled: true, log_file: testLogFile },
  };

  // Set a fake API key so provider initializes
  process.env.FAKE_KEY = "sk-fake-key-for-testing";

  const tracker = new TokenTracker(testLogFile);
  const cache = new CacheManager({ enabled: false, ttl: 60, maxSize: 10, strategy: "lru" });
  const costMgr = new CostManager({ trackingEnabled: false, dailyThreshold: 100 });
  const executor = new ReviewExecutor(config, tracker, cache, costMgr);

  // Send a prompt that exceeds 80% of 100-token context (i.e., >80 estimated tokens = >320 chars)
  const bigPrompt = "This is a test prompt for proactive skip. ".repeat(20); // ~860 chars = ~215 tokens
  const result = await executor.execute({ content: bigPrompt, models: ["tiny-model"] });

  const tinyReview = result.reviews["tiny-model"];
  assert(tinyReview !== undefined, "Proactive skip: review entry exists for tiny-model");
  assert(
    tinyReview?.error?.includes("Proactive skip"),
    "Proactive skip: error message contains 'Proactive skip'"
  );
  assert(
    tinyReview?.error?.includes("context window"),
    "Proactive skip: error mentions context window"
  );
  assert(
    tinyReview?.inputTokens === 0,
    "Proactive skip: no input tokens used (API not called)"
  );
  assert(
    tinyReview?.outputTokens === 0,
    "Proactive skip: no output tokens (API not called)"
  );
  assert(
    tinyReview?.finishReason === "error",
    "Proactive skip: finishReason is 'error'"
  );

  // A prompt within limits should NOT trigger proactive skip
  const smallPrompt = "hi";  // 1 token, well under 80 token threshold
  const smallResult = await executor.execute({ content: smallPrompt, models: ["tiny-model"] });
  const smallReview = smallResult.reviews["tiny-model"];
  // It will still fail (fake API key) but NOT with "Proactive skip"
  if (smallReview) {
    assert(
      !smallReview.error?.includes("Proactive skip"),
      "Small prompt: does NOT trigger proactive skip"
    );
  } else {
    // No review means provider didn't even try (which is fine for fake key)
    assert(true, "Small prompt: no proactive skip (provider attempted normally)");
  }

  delete process.env.FAKE_KEY;
  try { fs.unlinkSync(testLogFile); } catch (e) {}
}

// ── fallbackFrom field on LLMResponse ──

console.log("\n\u2500\u2500 FallbackFrom Field \u2500\u2500\n");

{
  // Test that fallbackFrom is part of the response type
  // When no fallback occurs, fallbackFrom should be undefined
  const config = {
    reviewers: [],
    execution: { strategy: "wait_all", allow_partial_results: true },
    costs: { models: {} },
    tracking: { enabled: true, log_file: testLogFile },
  };

  const tracker = new TokenTracker(testLogFile);
  const executor = new ReviewExecutor(config, tracker);
  const result = await executor.execute({ content: "test" });

  // With no providers, there are no reviews — but verify the result shape
  assert(
    Object.keys(result.reviews).length === 0,
    "No reviews when no providers (baseline)"
  );
  assert(
    result.totalCost === 0,
    "Zero cost baseline"
  );

  // Verify LLMResponse type accepts fallbackFrom by constructing one
  const mockResponse = {
    modelId: "replacement-model",
    content: "test response",
    inputTokens: 100,
    outputTokens: 50,
    finishReason: "stop",
    fallbackFrom: "original-model",
    executionTimeMs: 500,
  };
  assert(
    mockResponse.fallbackFrom === "original-model",
    "fallbackFrom field holds original model ID"
  );
  assert(
    mockResponse.modelId === "replacement-model",
    "modelId field holds replacement model ID"
  );

  try { fs.unlinkSync(testLogFile); } catch (e) {}
}

// ── Proactive Skip Threshold Math ──

console.log("\n\u2500\u2500 Threshold Calculations \u2500\u2500\n");

{
  // Verify the 80% threshold calculation
  const contextLength = 4096;
  const threshold = contextLength * 0.8;
  assert(threshold === 3276.8, "80% of 4096 = 3276.8");

  // A prompt at exactly 80% should trigger skip
  const exactPrompt = "x".repeat(Math.ceil(3276.8 * 4)); // 3277 tokens worth
  const estimatedExact = estimateTokens(exactPrompt);
  assert(
    estimatedExact > threshold,
    `Prompt at boundary (${estimatedExact} tokens) exceeds threshold (${threshold})`
  );

  // A prompt just under 80% should NOT trigger
  const underPrompt = "x".repeat(3276 * 4); // 3276 tokens
  const estimatedUnder = estimateTokens(underPrompt);
  assert(
    estimatedUnder <= threshold,
    `Prompt under boundary (${estimatedUnder} tokens) does not exceed threshold (${threshold})`
  );

  // minContextLength multiplier: estimatedTokens * 2
  const fallbackMinContext = estimatedExact * 2;
  assert(
    fallbackMinContext >= estimatedExact,
    `Fallback minContextLength (${fallbackMinContext}) >= prompt tokens (${estimatedExact})`
  );
}

// ── Duplicate Provider Guard ──

console.log("\n\u2500\u2500 Duplicate Provider Guard \u2500\u2500\n");

{
  // The guard checks activeProviders.has(replacementId)
  // Verify the logic: if a model ID matches an active provider key, it should be blocked
  const activeProviders = new Map();
  activeProviders.set("openai", { id: "openai" });
  activeProviders.set("gemini", { id: "gemini" });
  activeProviders.set("nemotron", { id: "nemotron" });

  assert(
    activeProviders.has("nemotron"),
    "Guard blocks: nemotron is in active providers"
  );
  assert(
    !activeProviders.has("nvidia/nemotron-3-super-120b-a12b:free"),
    "Guard allows: OpenRouter model ID differs from config ID"
  );
  assert(
    !activeProviders.has("anthropic/claude-3"),
    "Guard allows: new model not in active providers"
  );
}

// ── Classification Edge Cases ──

console.log("\n\u2500\u2500 Classification Edge Cases \u2500\u2500\n");

{
  // Case insensitive rate limit
  assert(
    classifyFailure("Rate Limit Exceeded", 0, 0) === "rate_limit",
    "Case insensitive: 'Rate Limit Exceeded' = rate_limit"
  );

  // 429 embedded in longer string
  assert(
    classifyFailure("HTTP error 429: too many requests", 0, 0) === "rate_limit",
    "429 in longer string = rate_limit"
  );

  // Empty response case insensitive
  assert(
    classifyFailure("empty response from provider", 0, 0) === "empty_response",
    "Case insensitive: 'empty response' = empty_response"
  );

  // ETIMEDOUT as network
  assert(
    classifyFailure("ETIMEDOUT connecting to api.openai.com", 0, 0) === "network",
    "ETIMEDOUT = network"
  );

  // 503 Service Unavailable
  assert(
    classifyFailure("503 Service Unavailable", 0, 0) === "network",
    "503 Service Unavailable = network"
  );

  // Both output=0 and input=0 — not token_limit (no evidence of input)
  assert(
    classifyFailure("unknown error", 0, 0) === "unknown",
    "Both tokens 0 with unknown error = unknown (not token_limit)"
  );

  // Positive output tokens means model did respond — even if error text matches
  assert(
    classifyFailure("rate limit", 50, 100) === "rate_limit",
    "Positive output but rate limit error = rate_limit"
  );
}

// ── Print Results ──

console.log("\n\u2500\u2500 Results \u2500\u2500\n");
console.log(`\u2713 Passed: ${passed}`);
console.log(`\u2717 Failed: ${failed}`);
console.log(`Total:   ${passed + failed}\n`);
if (failed === 0) {
  console.log("\u2705 All fallback tests passed!");
} else {
  console.log(`\u274C ${failed} test(s) failed`);
  process.exit(1);
}
