# Codebase Concerns

**Analysis Date:** 2026-02-23

## Tech Debt

**Silent consensus fallback:**
- Issue: When `buildConsensus()` fails for the arbitrator model, it silently returns `undefined` rather than retrying or escalating. This causes the final result to lack consensus even when both individual reviews succeeded.
- Files: `src/engine.ts` (lines 364-459)
- Impact: Users get review results without the key synthesis feature that adds value (the consensus verdict). A network hiccup or API rate limit during consensus phase silently degrades the tool without warning the user about the loss of consensus.
- Fix approach: Return error details in the result, allow caller to decide whether to include partial results. Log the failure reason with more detail.

**Verdict parsing is brittle:**
- Issue: The `parseVerdict()` method relies on regex patterns that may fail if the LLM returns unexpected formatting. Falls back to "revise" as default, masking parsing failures.
- Files: `src/engine.ts` (lines 462-488)
- Impact: If the consensus model returns a well-reasoned verdict in a slightly different format (e.g., "verdict: PROCEED" instead of "VERDICT: PROCEED"), it defaults to "revise" rather than reporting the parse failure. This could lead to incorrect recommendations.
- Fix approach: Add logging for unparseable verdicts, consider stricter validation or ask LLM to repair/retry on parse failure.

**Consensus arbitrator selection under-tested:**
- Issue: Arbitrator is selected based on fewest HIGH-confidence claims in the critique text, but this is measured by simple regex matching for "Confidence: HIGH", which could be fragile if model output format changes.
- Files: `src/engine.ts` (lines 359-362, 377-383)
- Impact: If a model changes its output format for confidence labels, arbitrator selection could be wrong, leading to biased consensus synthesis.
- Fix approach: Add explicit test cases for different confidence label formats, or parse structured confidence data if models support it in the future.

**No validation of API key availability before review:**
- Issue: `initClients()` silently continues if an API key is missing (logs warning only), but then `reviewWithModel()` throws an error when trying to use that client. This means users only discover missing keys when the review runs.
- Files: `src/engine.ts` (lines 151-181, 282-357)
- Impact: On first use, users might get partial failures if API keys are misconfigured, forcing them to debug mid-review.
- Fix approach: Add a `validateConfiguration()` method that's called before any review starts, returning a clear list of misconfigured reviewers.

## Known Bugs

**Consensus undefined return case not handled in main review flow:**
- Symptoms: If all individual reviews succeed but consensus fails, the result object has `consensus: undefined`. This is valid per the type signature, but formatResult() in index.ts assumes consensus exists when checking it (line 145). Edge case but possible.
- Files: `src/index.ts` (lines 145-162), `src/engine.ts` (lines 225-241)
- Trigger: Run a review where individual reviews succeed but the consensus model call times out or is rate-limited.
- Workaround: The code does check `if (result.consensus)` before using it, so it handles this gracefully. Not actually a bug, just a concern about silent degradation.

**Token usage may be missing from individual reviews:**
- Symptoms: ReviewResult has optional `tokenUsage`, but cost calculation aggregates only present usages, potentially under-reporting actual spend.
- Files: `src/engine.ts` (lines 248-264)
- Trigger: A model API that doesn't return token counts (theoretical, most do now).
- Workaround: Log warnings when token usage is unavailable.

## Security Considerations

**Content sent to third-party APIs:**
- Risk: All reviewed content is sent to OpenAI, Google Gemini, DeepSeek, Mistral, or OpenRouter APIs depending on configuration. No encryption in transit beyond HTTPS, no local processing option.
- Files: `src/engine.ts` (lines 293-340)
- Current mitigation: Documentation in SECURITY.md clearly states this, recommends users review provider data policies. Code does not transmit API keys except to their respective providers.
- Recommendations:
  - Add a content size warning in the review tool (warn if >50KB being sent).
  - Consider offering a dry-run mode that shows what would be sent without actually sending it.
  - Document recommended provider configuration for HIPAA/PCI-DSS compliance use cases.

**API key storage in environment variables:**
- Risk: API keys passed via environment variables at runtime. If environment is dumped, keys are visible. Parent process can read environment of child process.
- Files: `src/engine.ts` (lines 152-159)
- Current mitigation: SECURITY.md recommends API key rotation and spending limits. Keys are never logged or stored.
- Recommendations:
  - Add audit logging for when API key is used (info level: "Using model X with provider Y").
  - Consider supporting credential files or integration with OS credential stores in future versions.

**No rate limiting on review requests:**
- Risk: A malicious or buggy client could repeatedly call `cross_review` without backoff, exhausting API quotas and draining billing.
- Files: `src/index.ts` (lines 29-88)
- Current mitigation: Rate limiting is left to the MCP server/client layer.
- Recommendations:
  - Add optional per-minute rate limiting configuration.
  - Track usage and warn when approaching cost thresholds.
  - Implement request deduplication for identical content reviewed multiple times in quick succession.

**Untrusted config parsing:**
- Risk: `resolveReviewers()` parses JSON from `CROSS_REVIEW_MODELS` env var without strict schema validation. A malformed custom provider object could have unexpected side effects.
- Files: `src/engine.ts` (lines 92-116)
- Current mitigation: Basic type checks (`entry.id && entry.provider && entry.model`), catches exceptions on parse failure.
- Recommendations:
  - Use Zod schema to validate the entire reviewer configuration structure.
  - Validate baseUrl is a valid HTTPS URL (prevent data exfiltration to wrong endpoints).
  - Test with adversarial config inputs (missing fields, wrong types, XSS-like payloads in model names).

## Performance Bottlenecks

**Sequential regex matching in verdict parsing:**
- Problem: `parseVerdict()` does three separate regex.match() calls in sequence, falls back on splitting and searching. Inefficient for large summary text.
- Files: `src/engine.ts` (lines 462-488)
- Cause: Defensive coding trying multiple formats, but no early exit after first match.
- Improvement path: Compile regex once at module load, use a single combined pattern with named groups, extract verdict in one pass.

**String replacement in severity filtering:**
- Problem: `filterBySeverity()` uses `filtered.replace(blockText, "")` on potentially large critique strings. If regex matches many blocks, this is O(n*m) complexity.
- Files: `src/index.ts` (lines 233-253)
- Cause: Iterating through matches and replacing each one individually.
- Improvement path: Collect ranges of text to keep, build result in one pass. Or use a single regex with negative lookahead instead of iterative replacement.

**No result caching for identical content:**
- Problem: If the same content is reviewed twice in quick succession with same scrutiny level, both API calls are made independently.
- Files: `src/engine.ts` (lines 198-280)
- Cause: No caching layer implemented.
- Improvement path: Add optional in-memory cache keyed on hash(content, scrutinyLevel, contentType), with TTL config. Note: complicates reasoning about freshness.

**Content length not validated before sending:**
- Problem: Very large content (>100K tokens) could be sent to multiple models in parallel, consuming all quota quickly or timing out. No early warning.
- Files: `src/engine.ts` (lines 198-280)
- Cause: No pre-flight validation of content size.
- Improvement path: Calculate approximate token count before review starts, warn or reject if too large. Implement streaming for very large content.

## Fragile Areas

**Consensus prompt is not validated for model compatibility:**
- Files: `src/prompts.ts` (lines 170-225)
- Why fragile: The consensus prompt is hard-coded with specific formatting instructions (VERDICT: PROCEED on first line, etc.). If a model doesn't follow instructions precisely, parsing breaks. Different models have different instruction-following reliability.
- Safe modification:
  - Before changing consensus prompt, run through all configured models and validate verdict parsing still works.
  - Test with adversarial inputs: models returning "verdict: proceed" (lowercase), models adding preamble before VERDICT line, models including reasoning before the verdict.
  - Add a `--validate-consensus-format` mode that tests the full consensus flow without counting tokens/cost.
- Test coverage: smoke tests validate that consensus prompt includes required sections, but don't test actual parsing of model outputs with the real prompt.

**Error handling in MCP tool callbacks:**
- Files: `src/index.ts` (lines 60-87)
- Why fragile: All errors are caught and returned as text in a response. If an unexpected error occurs, users only see a string message with no structured error code or recovery path.
- Safe modification:
  - Return structured errors with error codes so clients can distinguish "no API key" from "model overloaded" from "content rejected as unsafe".
  - Add context to error messages (which model failed, at what step).
  - Test with various failure scenarios: API timeouts, rate limits, invalid API keys, malformed model responses.
- Test coverage: No tests for error cases in MCP callbacks.

**Regex patterns for issue extraction in formatResult:**
- Files: `src/index.ts` (lines 212-231, 237-253)
- Why fragile: Multiple regex patterns try to extract issue counts and filter by severity. Patterns assume consistent model output format ("ISSUE 1:", "Severity: CRITICAL", etc.). If a model uses slightly different formatting, extraction fails silently.
- Safe modification:
  - Test extraction patterns against real model outputs from all configured models.
  - Add a `--debug-format` mode that shows raw critique and extracted sections side-by-side.
  - Consider parsing models to return JSON instead of prose (if future model support allows).
- Test coverage: smoke.test.js validates that patterns exist in prompts, but doesn't validate they work on realistic model outputs.

**ReviewerConfig with no API key continues silently:**
- Files: `src/engine.ts` (lines 151-181)
- Why fragile: initClients() logs a warning but continues, leaving the reviewer configured but unable to run. When review() is called later, it fails with "API key not configured" if that reviewer is selected.
- Safe modification:
  - Validate all reviewers have API keys before starting review, report clearly which ones are missing.
  - Option to fail fast if any configured reviewer is unavailable.
  - Option to run review with available reviewers only (subset mode).
- Test coverage: No tests for missing API key scenarios.

## Scaling Limits

**Parallel review scaling:**
- Current capacity: Tested with 4 reviewers (GPT-5.2, Gemini, Mistral, Llama). Each review runs in ~4-8 seconds depending on content length and scrutiny level.
- Limit: Most users have 2-3 configured reviewers. Adding more models increases latency proportionally (requests run in parallel, but consensus phase is sequential). Beyond 8-10 reviewers, consensus phase becomes the bottleneck as only one arbitrator runs.
- Scaling path: Implement optional parallel consensus (multiple arbitrators + voting), add timeout handling for slow models, allow users to skip consensus for faster results.

**Content size limits:**
- Current capacity: Tested with up to 10K tokens per review (code files, papers). No hard limit enforced.
- Limit: At 100K tokens, all 4-model runs could consume $0.10+, and some models may timeout.
- Scaling path: Implement content chunking for large documents, support summarization of source code before review, add progressive results (stream issues as they're found).

**Token budget predictability:**
- Current capacity: Cost estimation relies on static rates in MODEL_COSTS. Rates change frequently.
- Limit: Estimated costs may be 10-50% off from actual charges due to stale pricing.
- Scaling path: Fetch live pricing from each provider API, cache for 1 hour, warn if estimate is significantly older than 1 week.

## Dependencies at Risk

**@google/generative-ai client:**
- Risk: Google has deprecated AI Studio API multiple times. Current version (0.21.0) targets gemini-3 models, but API changes could break this.
- Impact: Gemini reviewer stops working if API contract changes.
- Migration plan: Monitor Google Cloud AI release notes, have a Vertex AI Generative API fallback, test with gemini-3-flash periodically, pin to specific API version if Google moves fast.

**openai client version lock:**
- Risk: Currently on openai@4.0.0. Major version changes could break streaming, retry behavior, or token counting.
- Impact: If upgraded to 5.0.0+ without testing, reviews using OpenAI models could fail.
- Migration plan: Test minor upgrades (4.1.x, 4.2.x) in integration tests before major version bumps. Use exact version pin in package.json (no ^).

**zod for validation:**
- Risk: Zod is currently used minimally (only imported, not used for runtime validation of tool inputs or env config). If it's removed, no regression. But if we add more strict validation, we become dependent on it staying compatible.
- Impact: Low. Tool input validation is done by MCP SDK, not by this code.
- Migration plan: None needed. Optional dependency at this point.

## Missing Critical Features

**No support for streaming large results:**
- Problem: Very long critiques (from 100+ page documents) could exceed MCP message size limits. Current code returns entire critique as text, no pagination or streaming.
- Blocks: Can't review very large documents (200+ pages) with this tool currently.

**No local/offline review mode:**
- Problem: All review requires live API calls. No way to test the tool with mock data or pre-recorded responses.
- Blocks: Testing without API keys, air-gapped environments, demo/testing scenarios.
- Recommendation: Add optional mock provider that returns canned critiques for testing.

**No review history or logging:**
- Problem: Reviews are processed in-memory and lost after response is sent. No audit trail of what was reviewed, when, by whom.
- Blocks: Using this in regulated environments where content review trail is required.
- Recommendation: Add optional logging to file/database, optionally hash content for privacy.

**No webhook/async callbacks:**
- Problem: Reviews run synchronously and are bounded by client timeout. Very long content could exceed MCP client timeout limits.
- Blocks: Reviewing very large codebases or datasets.
- Recommendation: Add async job mode where review returns a job ID immediately, results available via polling.

## Test Coverage Gaps

**No integration tests with real API calls:**
- What's not tested: Actual network communication with OpenAI, Google, DeepSeek, Mistral APIs. Only smoke tests validate prompt building without running reviews.
- Files: `test/smoke.test.js` (passes), `test/test-live.mjs` (exists but manual, not in CI)
- Risk: A breaking change in MCP SDK or client library could go undetected until user runs the tool. API contract changes (e.g., new required fields in request) could be missed.
- Priority: Medium - test-live.mjs exists and can be run manually, but should be integrated into CI with test API keys.

**No error path testing:**
- What's not tested: What happens when APIs are down, rate-limited, return malformed responses, or time out. How does the tool handle partial failures (1 of 4 models fails)?
- Files: `src/engine.ts` (lines 282-357 has error handling but no test coverage)
- Risk: Error cases discovered by users in production. Silent failures or confusing error messages.
- Priority: High - critical user experience.

**No fuzzing of consensus parsing:**
- What's not tested: What happens when consensus model returns edge cases like empty verdict, verdict on wrong line, missing sections, very long summary.
- Files: `src/index.ts` (lines 212-231), `src/engine.ts` (lines 462-488)
- Risk: Parsing failures lead to incorrect recommendations or cryptic errors.
- Priority: Medium - should add adversarial test inputs to smoke tests.

**No security validation of config parsing:**
- What's not tested: What happens with malformed CROSS_REVIEW_MODELS env var, invalid URLs in baseUrl, SQL injection-like payloads in model names.
- Files: `src/engine.ts` (lines 92-116)
- Risk: Unexpected behavior or data exfiltration via compromised config.
- Priority: Low - this is env-config, not user input, so risk is limited. But should still validate.

**No CLI/tool integration tests:**
- What's not tested: MCP protocol integration, whether tools are registered correctly, whether input/output schema validation works.
- Files: `src/index.ts` (lines 29-135)
- Risk: Tool not discoverable in MCP client, parameters parsed incorrectly, response format incompatible.
- Priority: Medium - should test with MCP inspector.

---

*Concerns audit: 2026-02-23*
