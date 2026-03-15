// Cross-Review MCP v0.5.0 - Smoke Tests
// Tests core functionality without requiring API keys

import { loadConfig } from "../dist/config.js";
import { TokenTracker } from "../dist/tracking.js";
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
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

console.log("\n── Configuration ──\n");

const config = loadConfig();
assert(config !== null, "Configuration loads successfully");
assert(config.execution !== undefined, "Execution config exists");
assert(config.reviewers !== undefined, "Reviewers config exists");
assert(Array.isArray(config.reviewers), "Reviewers is an array");
assert(config.reviewers.length > 0, "At least one reviewer configured");

// Check reviewers have required fields
config.reviewers.forEach((reviewer, index) => {
  assert(reviewer.id !== undefined, `Reviewer ${index} has id`);
  assert(reviewer.provider !== undefined, `Reviewer ${index} has provider`);
  assert(reviewer.model !== undefined, `Reviewer ${index} has model`);
});

console.log("\n── Token Tracking ──\n");

const tracker = new TokenTracker(testLogFile);
assert(tracker !== null, "TokenTracker instantiates");
assert(typeof tracker.logReview === "function", "TokenTracker has logReview method");

// Log a test review
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
  fs.unlinkSync(testLogFile); // Cleanup
}

console.log("\n── Configuration Validation ──\n");

assert(config.costs !== undefined, "Cost configuration exists");
assert(config.costs.models !== undefined, "Model costs defined");
assert(config.tracking !== undefined, "Tracking configuration exists");
assert(config.execution.strategy !== undefined, "Execution strategy configured");

const executionStrategies = ["wait_all", "fastest_2", "wait_max_30s"];
assert(
  executionStrategies.includes(config.execution.strategy),
  `Execution strategy is valid: ${config.execution.strategy}`
);

console.log("\n── Results ──\n");
console.log(`✓ Passed: ${passed}`);
console.log(`✗ Failed: ${failed}`);
console.log(`Total:   ${passed + failed}\n`);

if (failed === 0) {
  console.log("✅ All smoke tests passed!");
  process.exit(0);
} else {
  console.log(`❌ ${failed} test(s) failed`);
  process.exit(1);
}
