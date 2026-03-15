// Cross-Review MCP - Integration Tests
// Tests executor flow with mock LLM providers (no real API calls)

import { ReviewExecutor } from "../dist/executor.js";
import { CacheManager } from "../dist/cache.js";
import { CostManager } from "../dist/cost-manager.js";
import { TokenTracker } from "../dist/tracking.js";
import { eventBus } from "../dist/events.js";
import { configureLogger } from "../dist/logger.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testLogFile = path.join(__dirname, ".test_integration_usage.json");

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

// ── Mock Provider Setup ──
// We create a config with reviewers but set no API keys,
// so ReviewExecutor skips all providers. Then we test the
// cache and cost wiring paths.

console.log("\n\u2500\u2500 Executor with Cache Integration \u2500\u2500\n");

{
  const cache = new CacheManager({ enabled: true, ttl: 60, maxSize: 10, strategy: "lru" });
  const costMgr = new CostManager({ trackingEnabled: true, dailyThreshold: 10 });
  const tracker = new TokenTracker(testLogFile);

  // Minimal config with no reviewers that would have keys
  const config = {
    reviewers: [],
    execution: { strategy: "wait_all", allow_partial_results: true },
    costs: { models: {} },
    tracking: { enabled: true, log_file: testLogFile },
  };

  const executor = new ReviewExecutor(config, tracker, cache, costMgr);

  // Execute with no providers - should return empty result and cache it
  const result = await executor.execute({ content: "test content", type: "general" });
  assert(result !== null, "Executor returns result with no providers");
  assert(result.executionTimeMs >= 0, "Execution time is non-negative");
  assert(result.totalCost === 0, "Zero cost with no providers");
  assert(Object.keys(result.reviews).length === 0, "No reviews with no providers");

  // Second call should hit cache
  const cacheStats1 = cache.getStats();
  const missesBeforeSecondCall = cacheStats1.misses;

  const result2 = await executor.execute({ content: "test content", type: "general" });
  const cacheStats2 = cache.getStats();
  assert(cacheStats2.hits > cacheStats1.hits, "Second call hits cache");
  assert(result2.totalCost === 0, "Cached result preserves cost");

  // Different content should miss
  const result3 = await executor.execute({ content: "different content", type: "general" });
  const cacheStats3 = cache.getStats();
  assert(cacheStats3.misses > cacheStats1.misses, "Different content causes cache miss");

  // Different type same content should miss
  const result4 = await executor.execute({ content: "test content", type: "security" });
  const cacheStats4 = cache.getStats();
  assert(cacheStats4.misses > cacheStats3.misses, "Different review type causes cache miss");

  // Cleanup
  try { fs.unlinkSync(testLogFile); } catch (e) {}
}

// ── Event Emission During Execution ──

console.log("\n\u2500\u2500 Event Emission During Execution \u2500\u2500\n");

{
  const cache = new CacheManager({ enabled: false, ttl: 60, maxSize: 10, strategy: "lru" });
  const costMgr = new CostManager({ trackingEnabled: true, dailyThreshold: 10 });
  const tracker = new TokenTracker(testLogFile);

  const config = {
    reviewers: [],
    execution: { strategy: "wait_all", allow_partial_results: true },
    costs: { models: {} },
    tracking: { enabled: true, log_file: testLogFile },
  };

  const executor = new ReviewExecutor(config, tracker, cache, costMgr);

  let startEvents = 0;
  let completeEvents = 0;

  const onStart = () => { startEvents++; };
  const onComplete = () => { completeEvents++; };

  eventBus.on("request:start", onStart);
  eventBus.on("request:complete", onComplete);

  await executor.execute({ content: "event test", type: "general" });

  assert(startEvents > 0, "request:start emitted during execution");
  assert(completeEvents > 0, "request:complete emitted during execution");

  eventBus.off("request:start", onStart);
  eventBus.off("request:complete", onComplete);

  try { fs.unlinkSync(testLogFile); } catch (e) {}
}

// ── HTTP Server API ──

console.log("\n\u2500\u2500 HTTP Server API \u2500\u2500\n");

{
  const { startHTTPServer } = await import("../dist/server.js");
  // Import registerTools - index.ts suppresses console, so restore after
  const savedLog = console.log;
  const savedErr = console.error;
  const savedWarn = console.warn;
  const { registerTools } = await import("../dist/index.js");
  console.log = savedLog;
  console.error = savedErr;
  console.warn = savedWarn;

  const testCache = new CacheManager({ enabled: true, ttl: 60, maxSize: 10, strategy: "lru" });
  const testCostMgr = new CostManager({ trackingEnabled: true, dailyThreshold: 10 });

  const port = 16280;
  const serverPromise = startHTTPServer({
    port,
    host: "127.0.0.1",
    cache: testCache,
    costManager: testCostMgr,
    registerTools,
  });

  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test dashboard endpoint
  try {
    const dashRes = await fetch(`http://127.0.0.1:${port}/`);
    assert(dashRes.status === 200, "Dashboard returns 200");
    const html = await dashRes.text();
    assert(html.includes("Cross-Review MCP"), "Dashboard contains title");
    assert(html.includes("EventSource"), "Dashboard includes SSE client code");
  } catch (e) {
    assert(false, `Dashboard request failed: ${e.message}`);
  }

  // Test stats API
  try {
    const statsRes = await fetch(`http://127.0.0.1:${port}/api/stats`);
    assert(statsRes.status === 200, "Stats API returns 200");
    const stats = await statsRes.json();
    assert(stats.uptimeMs > 0, "Stats has uptime");
    assert(stats.costs !== undefined, "Stats has costs");
    assert(stats.cache !== undefined, "Stats has cache");
    assert(Array.isArray(stats.recentRequests), "Stats has recentRequests array");
  } catch (e) {
    assert(false, `Stats request failed: ${e.message}`);
  }

  // Test SSE endpoint connects
  try {
    const sseRes = await fetch(`http://127.0.0.1:${port}/api/events`);
    assert(sseRes.status === 200, "SSE endpoint returns 200");
    assert(sseRes.headers.get("content-type").includes("text/event-stream"), "SSE has correct content-type");
    // Don't consume the body - just verify headers
  } catch (e) {
    assert(false, `SSE request failed: ${e.message}`);
  }

  // Test health endpoint
  try {
    const healthRes = await fetch(`http://127.0.0.1:${port}/health`);
    assert(healthRes.status === 200, "Health endpoint returns 200");
    const health = await healthRes.json();
    assert(health.status === "ok", "Health status is ok");
    assert(typeof health.uptime === "number", "Health includes uptime");
    assert(typeof health.providers === "object", "Health includes providers");
    assert(health.version !== undefined, "Health includes version");
  } catch (e) {
    assert(false, `Health request failed: ${e.message}`);
  }

  // Test MCP endpoint handles initialization request
  try {
    const mcpRes = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", method: "initialize", id: 1, params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "1.0" } } }),
    });
    assert(mcpRes.status === 200, "MCP endpoint handles initialization request");
    if (mcpRes.status === 200) {
      const mcpSessionId = mcpRes.headers.get("mcp-session-id");
      assert(mcpSessionId !== null, "MCP returns session ID header");
    }
  } catch (e) {
    assert(false, `MCP request failed: ${e.message}`);
  }

  // ── Auth Token ──
  console.log("\n── Auth Token ──\n");

  const authPort = 16281;
  const testToken = "test-secret-token";
  const authCache = new CacheManager({ enabled: true, ttl: 60, maxSize: 10, strategy: "lru" });
  const authCostMgr = new CostManager({ trackingEnabled: true, dailyThreshold: 10 });
  startHTTPServer({
    port: authPort,
    host: "127.0.0.1",
    cache: authCache,
    costManager: authCostMgr,
    registerTools,
    authToken: testToken,
  });
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Health always works without auth
  try {
    const healthRes = await fetch(`http://127.0.0.1:${authPort}/health`);
    assert(healthRes.status === 200, "Health bypasses auth");
  } catch (e) {
    assert(false, `Auth health failed: ${e.message}`);
  }

  // Dashboard without token should fail
  try {
    const noAuthRes = await fetch(`http://127.0.0.1:${authPort}/`);
    assert(noAuthRes.status === 401, "Dashboard without auth returns 401");
  } catch (e) {
    assert(false, `Auth dashboard failed: ${e.message}`);
  }

  // Dashboard with token query param should work
  try {
    const tokenRes = await fetch(`http://127.0.0.1:${authPort}/?token=${testToken}`);
    assert(tokenRes.status === 200, "Dashboard with token query param returns 200");
  } catch (e) {
    assert(false, `Auth token query failed: ${e.message}`);
  }

  // Stats with Bearer header should work
  try {
    const bearerRes = await fetch(`http://127.0.0.1:${authPort}/api/stats`, {
      headers: { Authorization: `Bearer ${testToken}` },
    });
    assert(bearerRes.status === 200, "Stats with Bearer token returns 200");
  } catch (e) {
    assert(false, `Auth bearer failed: ${e.message}`);
  }

  // Stats without auth should fail
  try {
    const noAuthStats = await fetch(`http://127.0.0.1:${authPort}/api/stats`);
    assert(noAuthStats.status === 401, "Stats without auth returns 401");
  } catch (e) {
    assert(false, `Auth stats failed: ${e.message}`);
  }

  // ── Model Selection (Executor) ──
  console.log("\n── Model Selection ──\n");

  {
    const selCache = new CacheManager({ enabled: false, ttl: 60, maxSize: 10, strategy: "lru" });
    const selCostMgr = new CostManager({ trackingEnabled: true, dailyThreshold: 10 });
    const selTracker = new TokenTracker(testLogFile);
    const selConfig = {
      reviewers: [],
      execution: { strategy: "wait_all", allow_partial_results: true },
      costs: { models: { a: { input_per_1m: 1, output_per_1m: 1 }, b: { input_per_1m: 10, output_per_1m: 10 } } },
      tracking: { enabled: true, log_file: testLogFile },
    };
    const selExecutor = new ReviewExecutor(selConfig, selTracker, selCache, selCostMgr);

    // With no providers, models param is harmless
    const fastResult = await selExecutor.execute({ content: "test", type: "general", models: "fast" });
    assert(fastResult !== null, "Fast preset executes without error");

    const specificResult = await selExecutor.execute({ content: "test2", type: "general", models: ["openai"] });
    assert(specificResult !== null, "Specific model selection executes without error");

    try { fs.unlinkSync(testLogFile); } catch (e) {}
  }

  // Print results before exit
  console.log("\n\u2500\u2500 Results \u2500\u2500\n");
  console.log(`\u2713 Passed: ${passed}`);
  console.log(`\u2717 Failed: ${failed}`);
  console.log(`Total:   ${passed + failed}\n`);
  if (failed === 0) {
    console.log("\u2705 All integration tests passed!");
  } else {
    console.log(`\u274C ${failed} test(s) failed`);
  }

  // Force exit since server keeps process alive
  process.exit(failed > 0 ? 1 : 0);
}

