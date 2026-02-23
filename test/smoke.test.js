// Cross-Review MCP - Smoke Tests (v0.3.0, 2026-02-22)
// Tests structural correctness without requiring API keys

import { buildAdversarialPrompt, buildConsensusPrompt, SCRUTINY_LEVELS, CONTENT_TYPES } from "../src/prompts.js";

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

console.log("\n── Prompt Building ──\n");

const prompt = buildAdversarialPrompt("Test content", "general", "standard");
assert(prompt.includes("skeptical peer reviewer"), "Adversarial prompt contains reviewer role");
assert(prompt.includes("Test content"), "Adversarial prompt contains content");
assert(prompt.includes("CONFIDENCE"), "Adversarial prompt includes confidence instructions");
assert(prompt.includes("Standard"), "Prompt reflects scrutiny level name");

const codePrompt = buildAdversarialPrompt("function test() {}", "code", "adversarial");
assert(codePrompt.includes("edge cases"), "Code content type includes code-specific checks");
assert(codePrompt.includes("security vulnerabilities"), "Code review checks for security");

const legalPrompt = buildAdversarialPrompt("This agreement...", "legal", "standard");
assert(legalPrompt.includes("loopholes"), "Legal content type includes legal-specific checks");

console.log("\n── Consensus Prompt ──\n");

const consensusPrompt = buildConsensusPrompt([
  { model: "GPT-4o", critique: "Issue found: overclaim" },
  { model: "Gemini", critique: "No issues found" }
]);
assert(consensusPrompt.includes("VERDICT:"), "Consensus prompt requests verdict format");
assert(consensusPrompt.includes("CONSENSUS ISSUES"), "Consensus prompt requests consensus section");
assert(consensusPrompt.includes("SINGLE-MODEL"), "Consensus prompt distinguishes single-model flags");
assert(consensusPrompt.includes("GPT-4o"), "Consensus prompt includes model names");

console.log("\n── Scrutiny Levels ──\n");

assert(Object.keys(SCRUTINY_LEVELS).length === 4, "Four scrutiny levels defined");
assert(SCRUTINY_LEVELS.quick.temperature < SCRUTINY_LEVELS.redteam.temperature, "Temperature increases with scrutiny");
assert(SCRUTINY_LEVELS.quick.maxTokens < SCRUTINY_LEVELS.redteam.maxTokens, "Max tokens increase with scrutiny");

console.log("\n── Content Types ──\n");

assert(Object.keys(CONTENT_TYPES).length === 7, "Seven content types defined");
assert(CONTENT_TYPES.general !== undefined, "General content type exists");
assert(CONTENT_TYPES.code !== undefined, "Code content type exists");

console.log("\n── Results ──\n");
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
