# Changelog

## 0.3.0 (2026-02-22)

- Structured output format with severity/confidence ratings
- Consensus arbitrator selection (biases toward cautious model)
- Token usage tracking and cost estimation per review
- Content-type specific review prompts (code, proposal, legal, medical, financial)
- Severity filtering (min_severity parameter)
- Confidence calibration in adversarial prompts

## 0.2.0 (2026-02-08)

- Added scrutiny levels (quick, standard, adversarial, redteam)
- Consensus synthesis across model reviews
- Prompt engineering for epistemic hedging

## 0.1.0 (2026-02-07)

- Initial prototype with GPT-4o and Gemini 2.0 Flash
- Basic adversarial review prompts
- MCP server with stdio transport
