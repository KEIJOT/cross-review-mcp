# Security

## What cross-review accesses

cross-review is a **read-only, outbound-only** MCP server. It:

- Reads content you send for review (text only, in memory)
- Sends that content to OpenAI and Google Gemini APIs for analysis
- Returns the results to your MCP client

It does **not**:

- Access your filesystem
- Open any network ports (stdio transport only)
- Store or log reviewed content
- Persist any data between sessions
- Execute any code from reviewed content

## API key handling

Your OpenAI and Gemini API keys are configured in your MCP client's config file and passed as environment variables at runtime. cross-review never stores, logs, or transmits your keys anywhere except directly to the respective LLM provider APIs.

**Recommendation:** Rotate your API keys periodically and use keys with appropriate spending limits set in your OpenAI and Google AI dashboards.

## Content privacy

Content you submit for review is sent to third-party LLM APIs (OpenAI, Google). Their data handling policies apply:

- [OpenAI API Data Usage Policy](https://openai.com/policies/api-data-usage-policies)
- [Google AI Terms of Service](https://ai.google.dev/gemini-api/terms)

Do not submit content containing secrets, credentials, PII, or classified information unless you've reviewed these providers' data handling terms.

## Reporting a vulnerability

Email: ketuomin@hotmail.com

We will acknowledge reports within 48 hours and aim to resolve critical issues within 14 days.

## Supply chain

Dependencies are minimal and intentional:

- `@modelcontextprotocol/sdk` — Official MCP protocol SDK
- `openai` — Official OpenAI Node.js client
- `@google/generative-ai` — Official Google Generative AI client
- `zod` — Input validation

All dependencies use exact versions locked in `package-lock.json`.
