// test-providers.mjs — Live test of all providers via the current ReviewExecutor
// Validates that each provider returns actual content (not 0-token ghosts)
import 'dotenv/config';
import { loadConfig } from '../dist/config.js';
import { ReviewExecutor } from '../dist/executor.js';
import { TokenTracker } from '../dist/tracking.js';
import { CacheManager } from '../dist/cache.js';
import { CostManager } from '../dist/cost-manager.js';
import { eventBus } from '../dist/events.js';
import { configureLogger } from '../dist/logger.js';

configureLogger({ enabled: true, level: 'info' });

const config = loadConfig();
const tracker = new TokenTracker('.test_provider_usage.json');
const cache = new CacheManager({ enabled: false, ttl: 0, maxSize: 0, strategy: 'lru' });
const costManager = new CostManager({ trackingEnabled: true, dailyThreshold: 10, configCosts: config.costs.models });

const executor = new ReviewExecutor(config, tracker, cache, costManager);

// Collect model:complete events
const modelResults = [];
eventBus.on('model:complete', (data) => { modelResults.push(data); });

console.log('\nTesting all providers with a simple prompt...\n');

const result = await executor.execute({
  content: 'Respond with exactly: "Hello from [your model name]". Nothing else.',
  type: 'general',
  models: 'thorough', // Use ALL providers
});

console.log('\n' + '='.repeat(60));
console.log('  PROVIDER TEST RESULTS');
console.log('='.repeat(60));

let allGood = true;
for (const [id, response] of Object.entries(result.reviews)) {
  const ok = !response.error && response.outputTokens > 0 && response.content.trim().length > 0;
  const status = ok ? '✓' : '✗';
  if (!ok) allGood = false;

  console.log(`\n  ${status} ${id}`);
  console.log(`    Content:  ${(response.content || '(empty)').substring(0, 80)}`);
  console.log(`    Tokens:   ${response.inputTokens} in / ${response.outputTokens} out`);
  console.log(`    Latency:  ${response.executionTimeMs}ms`);
  if (response.error) {
    console.log(`    Error:    ${response.error}`);
  }
}

console.log(`\n  Total cost: $${result.totalCost.toFixed(6)}`);
console.log(`  Total time: ${result.executionTimeMs}ms`);
console.log(`\n  ${allGood ? '✅ All providers working!' : '❌ Some providers failed — see above'}`);
console.log('='.repeat(60) + '\n');

// Cleanup
import fs from 'fs';
try { fs.unlinkSync('.test_provider_usage.json'); } catch {}

process.exit(allGood ? 0 : 1);
