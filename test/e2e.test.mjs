#!/usr/bin/env node
// Cross-Review MCP - End-to-End Test with Real API Keys
// Requires: .env file with at least one API key configured
//
// Usage: node test/e2e.test.mjs
//
// This test validates the full flow:
// 1. ReviewExecutor initializes providers from config + .env
// 2. Sends a real prompt to all available models
// 3. Validates response structure and content parsing
// 4. Verifies cache stores and retrieves results
// 5. Verifies cost tracking accumulates
// 6. Tests dev guidance flow end-to-end

import 'dotenv/config';
import { loadConfig } from '../dist/config.js';
import { ReviewExecutor } from '../dist/executor.js';
import { TokenTracker } from '../dist/tracking.js';
import { CacheManager } from '../dist/cache.js';
import { CostManager } from '../dist/cost-manager.js';
import { analyzeDevelopmentProblem } from '../dist/dev-guidance.js';
import { configureLogger } from '../dist/logger.js';
import { eventBus } from '../dist/events.js';
import * as fs from 'fs';

configureLogger({ enabled: true, level: 'info' });

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

// Check which API keys are available
const keyNames = ['OPENAI', 'GEMINI', 'DEEPSEEK', 'MISTRAL', 'OPENROUTER'];
const availableKeys = keyNames.filter(k => process.env[`${k}_API_KEY`]);

console.log(`\n\u2500\u2500 API Key Check \u2500\u2500\n`);
console.log(`  Available keys: ${availableKeys.length > 0 ? availableKeys.join(', ') : 'NONE'}`);

if (availableKeys.length === 0) {
  console.log('\n  No API keys found in .env - skipping E2E tests.');
  console.log('  To run E2E tests, create a .env file with at least one API key.');
  console.log('  See .env.example for the format.\n');
  process.exit(0);
}

// Setup
const config = loadConfig();
const testLogFile = '.test_e2e_usage.json';
const tracker = new TokenTracker(testLogFile);
const cache = new CacheManager({ enabled: true, ttl: 300, maxSize: 100, strategy: 'lru' });
const costManager = new CostManager({ trackingEnabled: true, dailyThreshold: 10 });
const executor = new ReviewExecutor(config, tracker, cache, costManager);

// ── Test 1: Basic review_content flow ──

console.log(`\n\u2500\u2500 Test 1: review_content E2E \u2500\u2500\n`);

const reviewPrompt = 'What is 2 + 2? Answer with just the number.';

let eventsReceived = { start: 0, modelComplete: 0, complete: 0 };
const onStart = () => eventsReceived.start++;
const onModel = () => eventsReceived.modelComplete++;
const onComplete = () => eventsReceived.complete++;

eventBus.on('request:start', onStart);
eventBus.on('model:complete', onModel);
eventBus.on('request:complete', onComplete);

try {
  const result = await executor.execute({ content: reviewPrompt, type: 'general' });

  assert(result !== null, 'Execute returns result');
  assert(typeof result.executionTimeMs === 'number', 'Has execution time');
  assert(result.executionTimeMs > 0, `Execution took ${result.executionTimeMs}ms`);

  const reviewKeys = Object.keys(result.reviews);
  assert(reviewKeys.length > 0, `Got ${reviewKeys.length} model response(s)`);

  let successCount = 0;
  for (const [modelId, response] of Object.entries(result.reviews)) {
    if (response.error) {
      console.log(`    [${modelId}] ERROR: ${response.error.slice(0, 80)}`);
    } else {
      successCount++;
      assert(response.content.length > 0, `${modelId}: non-empty response (${response.content.length} chars)`);
      assert(response.inputTokens > 0, `${modelId}: tracked ${response.inputTokens} input tokens`);
      assert(response.outputTokens > 0, `${modelId}: tracked ${response.outputTokens} output tokens`);
      assert(response.executionTimeMs > 0, `${modelId}: ${response.executionTimeMs}ms`);
      console.log(`    [${modelId}] "${response.content.trim().slice(0, 50)}" (${response.inputTokens}in/${response.outputTokens}out)`);
    }
  }

  assert(successCount > 0, `At least 1 model succeeded (${successCount}/${reviewKeys.length})`);

  // Verify events fired
  assert(eventsReceived.start > 0, 'request:start event fired');
  assert(eventsReceived.modelComplete > 0, `model:complete fired ${eventsReceived.modelComplete} time(s)`);
  assert(eventsReceived.complete > 0, 'request:complete event fired');

} catch (e) {
  assert(false, `Execute threw: ${e.message}`);
}

eventBus.off('request:start', onStart);
eventBus.off('model:complete', onModel);
eventBus.off('request:complete', onComplete);

// ── Test 2: Cache works ──

console.log(`\n\u2500\u2500 Test 2: Cache Integration \u2500\u2500\n`);

const cacheStats1 = cache.getStats();
const hitsBefore = cacheStats1.hits;

try {
  // Same request should hit cache
  const cachedResult = await executor.execute({ content: reviewPrompt, type: 'general' });
  const cacheStats2 = cache.getStats();
  assert(cacheStats2.hits > hitsBefore, 'Second identical request hit cache');
  assert(cachedResult.reviews !== undefined, 'Cached result has reviews');
} catch (e) {
  assert(false, `Cached execute threw: ${e.message}`);
}

// ── Test 3: Cost tracking works ──

console.log(`\n\u2500\u2500 Test 3: Cost Tracking \u2500\u2500\n`);

const costStats = costManager.getStats();
assert(costStats.totalInputTokens > 0, `Tracked ${costStats.totalInputTokens} total input tokens`);
assert(costStats.totalOutputTokens > 0, `Tracked ${costStats.totalOutputTokens} total output tokens`);
// With very few tokens, cost might round to $0.00 - just verify it's a valid dollar string
assert(costStats.dailySpend.startsWith('$'), `Daily spend format valid: ${costStats.dailySpend}`);
assert(Object.keys(costStats.perModel).length > 0, `Per-model costs tracked for ${Object.keys(costStats.perModel).length} model(s)`);

for (const [model, cost] of Object.entries(costStats.perModel)) {
  console.log(`    ${model}: ${cost}`);
}

// ── Test 4: Dev Guidance E2E ──

console.log(`\n\u2500\u2500 Test 4: get_dev_guidance E2E \u2500\u2500\n`);

try {
  const guidance = await analyzeDevelopmentProblem(
    {
      error: 'Cannot find module react',
      context: {
        technology: 'Node.js',
        environment: 'macOS',
        attempts: ['npm install', 'deleted node_modules'],
      },
    },
    executor
  );

  assert(guidance !== null, 'Dev guidance returns result');
  assert(typeof guidance.root_cause === 'string' && guidance.root_cause.length > 0, `Root cause: "${guidance.root_cause.slice(0, 60)}..."`);
  assert(typeof guidance.immediate_fix === 'string' && guidance.immediate_fix.length > 0, `Immediate fix: "${guidance.immediate_fix.slice(0, 60)}..."`);
  assert(typeof guidance.consensus_confidence === 'number', `Confidence: ${(guidance.consensus_confidence * 100).toFixed(0)}%`);
  assert(Array.isArray(guidance.per_model_analysis), `Per-model analysis: ${guidance.per_model_analysis.length} model(s)`);
  assert(typeof guidance.timestamp === 'string', 'Has timestamp');

  for (const p of guidance.per_model_analysis) {
    console.log(`    ${p.model} (${(p.confidence * 100).toFixed(0)}%): ${p.perspective.slice(0, 60)}`);
  }
} catch (e) {
  assert(false, `Dev guidance threw: ${e.message}`);
}

// ── Test 5: Ring buffer has history ──

console.log(`\n\u2500\u2500 Test 5: Event History \u2500\u2500\n`);

const recent = eventBus.getRecentRequests();
assert(recent.length >= 2, `Ring buffer has ${recent.length} entries (expected >= 2)`);
assert(recent[0].completedAt !== undefined, 'Most recent request is completed');
assert(recent[0].models.size > 0, 'Request has model data');

// ── Cleanup ──

try { fs.unlinkSync(testLogFile); } catch (e) {}

// ── Results ──

console.log(`\n\u2500\u2500 E2E Results \u2500\u2500\n`);
console.log(`\u2713 Passed: ${passed}`);
console.log(`\u2717 Failed: ${failed}`);
console.log(`Total:   ${passed + failed}`);
console.log(`Models tested: ${availableKeys.join(', ')}\n`);

if (failed === 0) {
  console.log('\u2705 All E2E tests passed!\n');
} else {
  console.log(`\u274C ${failed} E2E test(s) failed\n`);
}

process.exit(failed > 0 ? 1 : 0);
