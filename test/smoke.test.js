// Cross-Review MCP - Smoke Tests
// Tests core functionality without requiring API keys

import { loadConfig } from "../dist/config.js";
import { TokenTracker } from "../dist/tracking.js";
import { CacheManager } from "../dist/cache.js";
import { CostManager } from "../dist/cost-manager.js";
import { buildConsensus, scoreModelResponse, detectParadigmShift } from "../dist/consensus-algorithm.js";
import { eventBus } from "../dist/events.js";
import { configureLogger } from "../dist/logger.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testLogFile = path.join(__dirname, ".test_usage.json");

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

// Suppress structured log output during tests
configureLogger({ enabled: false });

// ── Configuration ──

console.log("\n\u2500\u2500 Configuration \u2500\u2500\n");

const config = loadConfig();
assert(config !== null, "Configuration loads successfully");
assert(config.execution !== undefined, "Execution config exists");
assert(config.reviewers !== undefined, "Reviewers config exists");
assert(Array.isArray(config.reviewers), "Reviewers is an array");
assert(config.reviewers.length > 0, "At least one reviewer configured");

config.reviewers.forEach((reviewer, index) => {
  assert(reviewer.id !== undefined, `Reviewer ${index} has id`);
  assert(reviewer.provider !== undefined, `Reviewer ${index} has provider`);
  assert(reviewer.model !== undefined, `Reviewer ${index} has model`);
});

// ── Token Tracking ──

console.log("\n\u2500\u2500 Token Tracking \u2500\u2500\n");

const tracker = new TokenTracker(testLogFile);
assert(tracker !== null, "TokenTracker instantiates");
assert(typeof tracker.logReview === "function", "TokenTracker has logReview method");

const testReview = {
  timestamp: new Date().toISOString(),
  content_hash: "test-hash-123",
  execution_strategy: "wait_all",
  total_cost_usd: 0.0049,
  models: ["openai", "gemini"]
};

tracker.logReview(testReview);
const logExists = fs.existsSync(testLogFile);
assert(logExists, "Review log file created");

if (logExists) {
  const content = fs.readFileSync(testLogFile, "utf-8");
  assert(content.includes("test-hash-123"), "Review logged correctly");
  assert(content.includes("0.0049"), "Cost tracked correctly");
  fs.unlinkSync(testLogFile);
}

// ── Configuration Validation ──

console.log("\n\u2500\u2500 Configuration Validation \u2500\u2500\n");

assert(config.costs !== undefined, "Cost configuration exists");
assert(config.costs.models !== undefined, "Model costs defined");
assert(config.tracking !== undefined, "Tracking configuration exists");
assert(config.execution.strategy !== undefined, "Execution strategy configured");

const executionStrategies = ["wait_all", "fastest_2", "wait_max_30s"];
assert(
  executionStrategies.includes(config.execution.strategy),
  `Execution strategy is valid: ${config.execution.strategy}`
);

// ── CacheManager ──

console.log("\n\u2500\u2500 CacheManager \u2500\u2500\n");

const cache = new CacheManager({
  enabled: true,
  ttl: 5,
  maxSize: 3,
  strategy: 'lru',
});

assert(cache.get("test content", "general") === null, "Cache miss returns null");

cache.set("test content", "general", { result: "cached" });
const cached = cache.get("test content", "general");
assert(cached !== null, "Cache hit after set");
assert(cached.result === "cached", "Cache returns correct value");

assert(cache.get("test content", "security") === null, "Different type is cache miss");

cache.set("content A", "general", { a: 1 });
cache.set("content B", "general", { b: 2 });
cache.set("content C", "general", { c: 3 });
// maxSize is 3, adding 4th should evict
cache.set("content D", "general", { d: 4 });

const stats = cache.getStats();
assert(stats.evictions >= 1, "Eviction occurred when maxSize exceeded");
assert(stats.entries <= 3, "Cache respects maxSize");
assert(stats.hits > 0, "Cache tracks hits");
assert(stats.misses > 0, "Cache tracks misses");
assert(typeof stats.hitRate === "number", "Cache reports hit rate");

cache.clear();
const clearedStats = cache.getStats();
assert(clearedStats.entries === 0, "Cache clears all entries");
assert(clearedStats.hits === 0, "Cache clear resets hit count");

// ── CostManager ──

console.log("\n\u2500\u2500 CostManager \u2500\u2500\n");

const costFile = path.join(__dirname, ".test_costs.json");
const costMgr = new CostManager({
  trackingEnabled: true,
  dailyThreshold: 10,
});

costMgr.trackUsage("openai", 1000, 500);
const costStats = costMgr.getStats();
assert(costStats.totalInputTokens === 1000, "CostManager tracks input tokens");
assert(costStats.totalOutputTokens === 500, "CostManager tracks output tokens");
assert(costStats.dailySpend !== "$0.00", "CostManager calculates daily spend");
assert(Object.keys(costStats.perModel).length > 0, "CostManager tracks per-model spend");

costMgr.trackUsage("gemini", 2000, 1000);
const costStats2 = costMgr.getStats();
assert(costStats2.totalInputTokens === 3000, "CostManager accumulates input tokens");
assert(costStats2.totalOutputTokens === 1500, "CostManager accumulates output tokens");
assert(Object.keys(costStats2.perModel).length === 2, "CostManager tracks multiple models");

const report = costMgr.getMonthlyReport();
assert(report.month !== undefined, "Monthly report has month");
assert(report.totalCost !== undefined, "Monthly report has total cost");

costMgr.reset();
const resetStats = costMgr.getStats();
assert(resetStats.totalInputTokens === 0, "CostManager reset clears tokens");

// ── Consensus Algorithm ──

console.log("\n\u2500\u2500 Consensus Algorithm \u2500\u2500\n");

// Test empty input
const emptyConsensus = buildConsensus([]);
assert(emptyConsensus.confidence === 0, "Empty input returns 0 confidence");
assert(emptyConsensus.perModelAnalysis.length === 0, "Empty input returns no analysis");

// Test unanimous agreement
const unanimousResponses = [
  { model: "openai", diagnosis: "Missing import", suggestion: "Add import React", confidence: 0.95, alternatives: [] },
  { model: "gemini", diagnosis: "Missing import", suggestion: "Add import React", confidence: 0.90, alternatives: [] },
  { model: "deepseek", diagnosis: "Missing import", suggestion: "Add import React", confidence: 0.85, alternatives: [] },
];
const unanimousResult = buildConsensus(unanimousResponses);
assert(unanimousResult.confidence === 1.0, "Unanimous agreement = 100% confidence");
assert(unanimousResult.rootCause === "Missing import", "Correct root cause identified");
assert(unanimousResult.divergentPerspectives.length === 0, "No divergent perspectives when unanimous");
assert(unanimousResult.perModelAnalysis.length === 3, "All models in analysis");
assert(unanimousResult.perModelAnalysis.every(m => m.agreesWithConsensus), "All models agree with consensus");

// Test split decision
const splitResponses = [
  { model: "openai", diagnosis: "Missing import", suggestion: "Add import", confidence: 0.90, alternatives: [] },
  { model: "gemini", diagnosis: "Missing import", suggestion: "Add import", confidence: 0.85, alternatives: [] },
  { model: "deepseek", diagnosis: "Wrong version", suggestion: "Upgrade to v2", confidence: 0.75, alternatives: [] },
];
const splitResult = buildConsensus(splitResponses);
assert(splitResult.rootCause === "Missing import", "Majority diagnosis wins");
assert(Math.abs(splitResult.confidence - 2/3) < 0.01, "Split confidence is 2/3");
assert(splitResult.divergentPerspectives.length === 1, "One divergent perspective captured");

// Test scoreModelResponse
const score1 = scoreModelResponse(
  { model: "test", diagnosis: "Missing import", suggestion: "", confidence: 0.8, alternatives: [] },
  "Missing import"
);
assert(score1 > 0.8, "Agreeing model gets score bonus");

const score2 = scoreModelResponse(
  { model: "test", diagnosis: "Wrong version", suggestion: "", confidence: 0.8, alternatives: [] },
  "Missing import"
);
assert(score2 < 0.8, "Disagreeing model gets score penalty");

// Test paradigm shift detection
const shiftResult = detectParadigmShift([
  { model: "a", diagnosis: "Problem A", suggestion: "", confidence: 0.9, alternatives: [] },
  { model: "b", diagnosis: "Problem B", suggestion: "", confidence: 0.9, alternatives: [] },
]);
assert(shiftResult.hasShift === true, "Detects paradigm shift");
assert(shiftResult.shift !== undefined, "Provides shift details");

const noShiftResult = detectParadigmShift([
  { model: "a", diagnosis: "Same", suggestion: "", confidence: 0.9, alternatives: [] },
  { model: "b", diagnosis: "Same", suggestion: "", confidence: 0.9, alternatives: [] },
]);
assert(noShiftResult.hasShift === false, "No shift when diagnoses match");

// ── EventBus ──

console.log("\n\u2500\u2500 EventBus \u2500\u2500\n");

assert(typeof eventBus.generateRequestId === "function", "EventBus has generateRequestId");
const reqId = eventBus.generateRequestId();
assert(typeof reqId === "string" && reqId.length > 0, "generateRequestId returns non-empty string");

// Test event emission and ring buffer
let startReceived = false;
let modelReceived = false;
let completeReceived = false;

eventBus.on("request:start", () => { startReceived = true; });
eventBus.on("model:complete", () => { modelReceived = true; });
eventBus.on("request:complete", () => { completeReceived = true; });

const testReqId = eventBus.generateRequestId();
eventBus.emitRequestStart({
  requestId: testReqId,
  timestamp: new Date().toISOString(),
  contentLength: 100,
  type: "general",
  models: ["openai", "gemini"],
});
assert(startReceived, "request:start event emitted and received");

eventBus.emitModelComplete({
  requestId: testReqId,
  modelId: "openai",
  timestamp: new Date().toISOString(),
  success: true,
  inputTokens: 100,
  outputTokens: 50,
  executionTimeMs: 500,
});
assert(modelReceived, "model:complete event emitted and received");

eventBus.emitRequestComplete({
  requestId: testReqId,
  timestamp: new Date().toISOString(),
  executionTimeMs: 1000,
  totalCost: 0.01,
  modelCount: 2,
  successCount: 1,
});
assert(completeReceived, "request:complete event emitted and received");

const recent = eventBus.getRecentRequests();
assert(recent.length > 0, "Ring buffer stores completed requests");
assert(recent[0].requestId === testReqId, "Ring buffer has correct request ID");
assert(recent[0].models.size > 0, "Ring buffer has model data");

assert(eventBus.getUptimeMs() > 0, "Uptime is positive");
assert(eventBus.getTotalRequests() > 0, "Total requests tracked");

// Clean up event listeners
eventBus.removeAllListeners();

// ── Logger ──

console.log("\n\u2500\u2500 Logger \u2500\u2500\n");

assert(typeof configureLogger === "function", "configureLogger is a function");
// Logger was disabled at top of file, so just verify it doesn't crash
configureLogger({ enabled: false, level: "debug" });
assert(true, "Logger configures without error");
configureLogger({ enabled: true, level: "error" });
assert(true, "Logger reconfigures without error");
// Disable again for clean test output
configureLogger({ enabled: false });

// ── Results ──

console.log("\n\u2500\u2500 Results \u2500\u2500\n");
console.log(`\u2713 Passed: ${passed}`);
console.log(`\u2717 Failed: ${failed}`);
console.log(`Total:   ${passed + failed}\n`);

if (failed === 0) {
  console.log("\u2705 All smoke tests passed!");
  process.exit(0);
} else {
  console.log(`\u274C ${failed} test(s) failed`);
  process.exit(1);
}
