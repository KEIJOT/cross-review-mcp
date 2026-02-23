// Cross-Review MCP - Smoke Tests (v0.3.0, 2026-02-22)
// Tests structural correctness without requiring API keys

import { buildAdversarialPrompt, buildConsensusPrompt, SCRUTINY_LEVELS, CONTENT_TYPES } from "../dist/prompts.js";
import { CrossReviewEngine, parseVerdict, countHighConfidenceClaims, validateConfiguration } from "../dist/engine.js";

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

console.log("\n── Consensus Error Reporting ──\n");

// ERR-01: When no API clients are available, consensus should carry a structured error
// rather than being undefined (which is indistinguishable from "not requested").
const engineNoKeys = new CrossReviewEngine([
  { id: "r1", name: "Model A", provider: "openai", model: "gpt-4o", apiKeyEnv: "NONEXISTENT_KEY_12345" },
  { id: "r2", name: "Model B", provider: "openai", model: "gpt-4o", apiKeyEnv: "NONEXISTENT_KEY_67890" },
]);

const resultNoKeys = await engineNoKeys.review("Test content for consensus error", { includeConsensus: true });

// ERR-01: consensus must be defined (not undefined) so callers know an attempt was made
assert(resultNoKeys.consensus !== undefined, "consensus error: consensus object is defined (not undefined) when attempt was made");

// ERR-01: consensus must carry an error field explaining the failure
assert(
  typeof resultNoKeys.consensus?.error === "string" && resultNoKeys.consensus.error.length > 0,
  "consensus error: error field is a non-empty string when consensus fails"
);

// ERR-02: the error message must be human-readable (contains a meaningful word)
const errorMsg = resultNoKeys.consensus?.error || "";
const isHumanReadable = /fail|error|no |cannot|unable|not available|requires|unavailable/i.test(errorMsg);
assert(isHumanReadable, `consensus error: error message is human-readable (got: "${errorMsg}")`);

// ERR-01: a caller can distinguish failed consensus from missing consensus via error field
// When consensus.error is defined → attempted-and-failed; when consensus is undefined → not requested
const notRequestedResult = await engineNoKeys.review("Test content", { includeConsensus: false });
assert(notRequestedResult.consensus === undefined, "consensus error: consensus is undefined when not requested (distinguishable from failure)");

// Type contract: successful consensus objects have error as optional (undefined)
const mockSuccessConsensus = {
  verdict: /** @type {"proceed"} */ ("proceed"),
  arbitrator: "Model A",
  summary: "All good",
  // error intentionally absent — should be valid per interface
};
assert(mockSuccessConsensus.error === undefined, "consensus type: error field is optional (undefined when not present)");

console.log("\n── Verdict Parsing ──\n");

// Plain text (regression — must still work)
assert(parseVerdict("VERDICT: PROCEED\n\nSome analysis...") === "proceed", "Plain VERDICT: PROCEED");
assert(parseVerdict("VERDICT: REVISE\n\nSome analysis...") === "revise", "Plain VERDICT: REVISE");
assert(parseVerdict("VERDICT: ABORT\n\nSome analysis...") === "abort", "Plain VERDICT: ABORT");

// Markdown bold formatting (PARSE-01 — currently fails)
assert(parseVerdict("**VERDICT: PROCEED**\n\nAnalysis...") === "proceed", "Bold VERDICT: PROCEED");
assert(parseVerdict("**VERDICT: REVISE**\n\nAnalysis...") === "revise", "Bold VERDICT: REVISE");
assert(parseVerdict("**VERDICT: ABORT**\n\nAnalysis...") === "abort", "Bold VERDICT: ABORT");

// Lowercase (currently fails)
assert(parseVerdict("verdict: proceed\n\nAnalysis...") === "proceed", "Lowercase verdict: proceed");
assert(parseVerdict("Verdict: Revise\n\nAnalysis...") === "revise", "Mixed case Verdict: Revise");

// Bold with extra whitespace (currently fails)
assert(parseVerdict("**VERDICT:  PROCEED**\n\nAnalysis...") === "proceed", "Bold with extra space");
assert(parseVerdict("  **VERDICT: ABORT**  \n\nAnalysis...") === "abort", "Bold with leading/trailing whitespace");

// Bold verdict word only (currently fails — some models bold just the value)
assert(parseVerdict("VERDICT: **PROCEED**\n\nAnalysis...") === "proceed", "Bold value only");

// OVERALL VERDICT variant with bold
assert(parseVerdict("**OVERALL VERDICT: PROCEED**\n\nAnalysis...") === "proceed", "Bold OVERALL VERDICT");

console.log("\n── Confidence Counting ──\n");

// Plain text (regression — must still work)
assert(countHighConfidenceClaims("Confidence: HIGH\nConfidence: HIGH\nConfidence: LOW") === 2, "Plain HIGH count");
assert(countHighConfidenceClaims("Confidence: LOW\nConfidence: MEDIUM") === 0, "No HIGH claims");

// Markdown bold formatting (PARSE-02 — currently fails)
assert(countHighConfidenceClaims("**Confidence: HIGH**\n**Confidence: HIGH**") === 2, "Bold Confidence: HIGH");
assert(countHighConfidenceClaims("**Confidence:** HIGH\nConfidence: **HIGH**") === 2, "Partially bold confidence");

// Case variations (currently fails)
assert(countHighConfidenceClaims("confidence: high\nCONFIDENCE: HIGH") === 2, "Mixed case confidence");
assert(countHighConfidenceClaims("Confidence: High\nConfidence: high") === 2, "Title and lower case");

// Extra whitespace (currently fails)
assert(countHighConfidenceClaims("Confidence:  HIGH\nConfidence:   HIGH") === 2, "Extra whitespace");

// Bold with whitespace
assert(countHighConfidenceClaims("**Confidence:  HIGH**") === 1, "Bold with extra space");

console.log("\n── API Key Validation ──\n");

// VALID-01: Missing keys detected
const reviewersMissingKeys = [
  { id: "r1", name: "Model A", provider: "openai", model: "gpt-4o", apiKeyEnv: "NONEXISTENT_KEY_VALID01" },
  { id: "r2", name: "Model B", provider: "gemini", model: "gemini-3-flash-preview", apiKeyEnv: "NONEXISTENT_KEY_VALID01_B" },
];
const resultMissing = validateConfiguration(reviewersMissingKeys);
assert(resultMissing.valid === false, "VALID-01: Missing keys detected — valid is false when keys are absent");

// VALID-02: Error lists misconfigured models
assert(resultMissing.errors.length === 2, "VALID-02: Error array has one entry per misconfigured reviewer");
assert(
  typeof resultMissing.errors[0] === "string" && resultMissing.errors[0].includes("Model A"),
  "VALID-02: First error includes first model name (Model A)"
);
assert(
  typeof resultMissing.errors[1] === "string" && resultMissing.errors[1].includes("Model B"),
  "VALID-02: Second error includes second model name (Model B)"
);

// VALID-01: All keys present returns valid
process.env.TEST_VALID_KEY = "test-key-123";
const reviewersAllValid = [
  { id: "r1", name: "Model Valid", provider: "openai", model: "gpt-4o", apiKeyEnv: "TEST_VALID_KEY" },
];
const resultAllValid = validateConfiguration(reviewersAllValid);
assert(resultAllValid.valid === true, "VALID-01: All keys present — valid is true");
assert(resultAllValid.errors.length === 0, "VALID-01: No errors when all keys are present");
delete process.env.TEST_VALID_KEY;

// VALID-02: Error message includes env var name
const reviewersMissingEnv = [
  { id: "r1", name: "Model X", provider: "openai", model: "gpt-4o", apiKeyEnv: "MISSING_XYZZY" },
];
const resultMissingEnv = validateConfiguration(reviewersMissingEnv);
assert(
  typeof resultMissingEnv.errors[0] === "string" && resultMissingEnv.errors[0].includes("MISSING_XYZZY"),
  "VALID-02: Error message includes env var name (MISSING_XYZZY)"
);

// VALID-01: Mixed valid/invalid — only misconfigured model appears in errors
process.env.TEST_VALID_KEY_MIXED = "test-key-456";
const reviewersMixed = [
  { id: "r1", name: "Model Good", provider: "openai", model: "gpt-4o", apiKeyEnv: "TEST_VALID_KEY_MIXED" },
  { id: "r2", name: "Model Bad", provider: "openai", model: "gpt-4o", apiKeyEnv: "NONEXISTENT_MIXED_KEY" },
];
const resultMixed = validateConfiguration(reviewersMixed);
assert(resultMixed.valid === false, "VALID-01: Mixed — valid is false when any key is missing");
assert(resultMixed.errors.length === 1, "VALID-01: Mixed — only one error for the misconfigured model");
assert(
  typeof resultMixed.errors[0] === "string" && resultMixed.errors[0].includes("Model Bad"),
  "VALID-01: Mixed — error mentions the misconfigured model name (Model Bad)"
);
delete process.env.TEST_VALID_KEY_MIXED;

console.log("\n── Results ──\n");
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
