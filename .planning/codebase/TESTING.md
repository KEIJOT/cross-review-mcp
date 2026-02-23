# Testing Patterns

**Analysis Date:** 2026-02-23

## Test Framework

**Runner:**
- Node.js built-in (no Jest, Vitest, or similar framework)
- Manual test files using Node.js runtime directly
- Run via `npm test` which executes: `npm run build && node test/smoke.test.js`

**Assertion Library:**
- Custom assertion function (no external library like Chai, Jest matchers, or Vitest)
- Manual boolean checks with console output

**Run Commands:**
```bash
npm test              # Build and run smoke tests
npm run build         # Compile TypeScript to dist/
npm run dev           # Watch mode for development
node test/smoke.test.js           # Run smoke tests directly
node test/test-keys.mjs           # Validate all API keys
node test/test-live.mjs           # Run live 4-model adversarial tests
node test/test-single.mjs         # Test single scenario (needs env vars)
```

## Test File Organization

**Location:**
- Tests co-located in `/Users/keijotuominen/PROJECTS/LLMAPI/test/` directory (separate from source)
- Source in `src/`, compiled to `dist/`, tests import from `dist/`

**Naming:**
- `smoke.test.js`: Structural/unit tests (no API calls needed)
- `test-*.mjs`: Integration tests (require API keys and actual model calls)
  - `test-keys.mjs`: API key validation
  - `test-live.mjs`: Full 4-model adversarial scenarios
  - `test-single.mjs`: Single scenario tester

**Structure:**
```
/Users/keijotuominen/PROJECTS/LLMAPI/
├── test/
│   ├── smoke.test.js       # Unit tests (no API calls)
│   ├── test-keys.mjs       # Integration: validate API keys
│   ├── test-live.mjs       # Integration: full review workflows
│   └── test-single.mjs     # Integration: single test scenario
└── src/
    ├── index.ts
    ├── engine.ts
    └── prompts.ts
```

## Test Structure

**Suite Organization:**

The codebase uses **named test groups** with console logging, not a traditional testing framework:

```javascript
// smoke.test.js pattern:
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
assert(prompt.includes("skeptical peer reviewer"), "Message 1");
assert(prompt.includes("Test content"), "Message 2");

console.log("\n── Results ──\n");
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
```

**Patterns:**
- **Setup**: Direct imports and variable initialization (no beforeEach, beforeAll)
- **Test execution**: Sequential assertion calls within logical groups
- **Teardown**: `process.exit()` with status code (0 for pass, 1 for fail)
- **Assertions**: Simple boolean conditions with pass/fail messages
- **Output**: Categorized under ASCII section headers (`── Name ──`)

## Mocking

**Framework:** None (no Sinon, Jest mocks, or similar)

**Patterns:**
- No mocking in smoke tests (tests pure functions)
- Live tests use actual API clients (real network calls required)
- Environment variables control which models run: `process.env.CROSS_REVIEW_MODELS`

**What to Mock:**
- Not mocked; tests call real APIs for integration tests
- Smoke tests avoid API by testing prompt builders and constants only

**What NOT to Mock:**
- OpenAI/Gemini clients: used directly in integration tests
- API responses: captured and parsed from real calls
- Token usage: extracted from actual response metadata

## Fixtures and Factories

**Test Data:**

**Smoke test fixtures** (hardcoded in test file):
```javascript
// From test/smoke.test.js
const prompt = buildAdversarialPrompt("Test content", "general", "standard");
const codePrompt = buildAdversarialPrompt("function test() {}", "code", "adversarial");
const legalPrompt = buildAdversarialPrompt("This agreement...", "legal", "standard");
```

**Live test scenarios** (in test-live.mjs):
```javascript
const tests = [
  {
    name: "TEST 1: Hideous Claim (proposal / adversarial)",
    content: `Our new microservices architecture will reduce latency by 95%...`,
    scrutinyLevel: "adversarial",
    contentType: "proposal",
  },
  {
    name: "TEST 2: Flawed Architecture (code / adversarial)",
    content: `# Payment Processing System Architecture\n\n## Components\n...`,
    scrutinyLevel: "adversarial",
    contentType: "code",
  },
  // ... more test scenarios
];
```

**Location:**
- Hardcoded in test files (no separate fixture files)
- Realistic adversarial examples: deliberately flawed content to trigger issues
- Varied content types: proposals, code, architecture docs

## Coverage

**Requirements:** No coverage enforcement (no config, no targets)

**View Coverage:**
- Not configured; no coverage tools used
- Manual testing approach only

**Test Coverage Gaps:**
- Smoke tests: cover prompt builders, constants, and payload structures
- No coverage: actual API client initialization, token calculation logic, consensus parsing edge cases
- No tests for: error recovery in buildConsensus(), getOpenAIClient() fallback logic, parseVerdict() regex variants

## Test Types

**Unit Tests:**
- **Scope**: Pure functions (prompt builders, payload construction)
- **Approach**: Hardcoded content, string matching assertions
- **File**: `test/smoke.test.js`
- **Example**:
  ```javascript
  const prompt = buildAdversarialPrompt("Test content", "general", "standard");
  assert(prompt.includes("skeptical peer reviewer"), "Prompt contains role");
  assert(SCRUTINY_LEVELS.quick.temperature < SCRUTINY_LEVELS.redteam.temperature, "Temperature increases");
  ```

**Integration Tests:**
- **Scope**: Full review workflows with real API calls
- **Approach**: Call CrossReviewEngine with real models, extract results, validate structure
- **Files**: `test/test-live.mjs`, `test/test-keys.mjs`, `test/test-single.mjs`
- **Example** (test-live.mjs):
  ```javascript
  const result = await engine.review(test.content, {
    scrutinyLevel: test.scrutinyLevel,
    contentType: test.contentType,
    includeConsensus: true,
  });
  for (const r of result.reviews) {
    const severity = extractOverallSeverity(r.critique);
    const count = countIssues(r.critique);
    console.log(`  ${r.model}: severity=${severity}, count=${count}`);
  }
  ```

**E2E Tests:**
- **Framework**: Not used
- **Note**: Integration tests function as E2E for this single-purpose tool

## Common Patterns

**Async Testing:**
```javascript
// From test-live.mjs
for (const test of tests) {
  try {
    const result = await engine.review(test.content, {
      scrutinyLevel: test.scrutinyLevel,
      contentType: test.contentType,
      includeConsensus: true,
    });
    // Process result
  } catch (e) {
    console.error(`\n  ERROR: ${e.message}`);
  }
}
```

**Error Testing:**
```javascript
// From test-keys.mjs - implicit error testing
async function testOpenAI() {
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const r = await client.chat.completions.create({
      model: 'gpt-5.2',
      messages: [{ role: 'user', content: 'Say OK' }],
      max_completion_tokens: 5
    });
    console.log('✓ OpenAI GPT-5.2:', r.choices[0]?.message?.content);
  } catch (e) {
    console.log('✗ OpenAI GPT-5.2:', e.message?.substring(0, 120));
  }
}
```

**Assertion Patterns:**
```javascript
// String inclusion checks
assert(prompt.includes("skeptical peer reviewer"), "Message");
assert(codePrompt.includes("edge cases"), "Message");

// Object property checks
assert(Object.keys(SCRUTINY_LEVELS).length === 4, "Count check");
assert(SCRUTINY_LEVELS.quick !== undefined, "Existence check");

// Numeric comparisons
assert(SCRUTINY_LEVELS.quick.temperature < SCRUTINY_LEVELS.redteam.temperature, "Ordering");

// Regex matching (in integration tests)
const severity = critique?.match(/OVERALL\s+SEVERITY:\s*(CRITICAL|MAJOR|MINOR|NONE)/i);
```

## Testing Workflow

**For Smoke Tests (no API keys needed):**
```bash
npm test
# Runs: npm run build && node test/smoke.test.js
# Output: Pass/fail counts, exits with code 1 on failure
```

**For API Key Validation:**
```bash
# Set environment variables for desired models
export OPENAI_API_KEY="sk-..."
export GEMINI_API_KEY="..."
export DEEPSEEK_API_KEY="..."

node test/test-keys.mjs
# Output: ✓ or ✗ for each model tested
```

**For Full Integration Tests:**
```bash
# Set CROSS_REVIEW_MODELS and all required API keys
export CROSS_REVIEW_MODELS='["gpt-5.2", "gemini-flash", "deepseek"]'
export OPENAI_API_KEY="..."
export GEMINI_API_KEY="..."
export DEEPSEEK_API_KEY="..."

node test/test-live.mjs
# Output: Detailed per-model and consensus results with costs
```

---

*Testing analysis: 2026-02-23*
