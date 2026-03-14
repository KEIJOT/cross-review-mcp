# Security Posture

## What cross-review-mcp Does NOT Do

- ❌ Access your local filesystem
- ❌ Execute any code from reviewed content
- ❌ Open inbound network ports
- ❌ Store or log review content beyond the current session
- ❌ Modify your system outside the MCP protocol
- ❌ Require authentication or send identifying information

## What It DOES Do

✅ Sends your review content to external LLM APIs (OpenAI, Google, DeepSeek, Mistral, etc.)
✅ Communicates over HTTPS only to configured provider APIs
✅ Tracks token usage and cost locally (not uploaded anywhere)
✅ Retains API keys only in your local .env file or MCP configuration (never transmitted, never logged)
✅ Returns structured critique in plain text (no code execution, no side effects)

## Data Retention & Privacy

### What is NOT stored
- No content is persisted after the review completes
- No cookies or tracking
- No session logs containing your content
- No analytics about what you reviewed

### What IS stored locally
- API keys in your .env or MCP config (your responsibility to protect)
- Cost/token tallies in memory during this session only
- Model response text, returned to you in plaintext

### What IS sent to providers
Your review content is transmitted to:
- OpenAI (GPT models) — follows OpenAI's privacy policy
- Google (Gemini models) — follows Google's privacy policy
- DeepSeek — based in China; **may** use prompts for training
- Mistral — follows Mistral's privacy policy
- OpenRouter proxy — free tier **may** use prompts for training

**Free tier models** (DeepSeek, OpenRouter) explicitly state they may use your prompts to improve their models.

## API Key Security

Store keys safely:
- ✅ Use a .env file (add to .gitignore)
- ✅ Use OS environment variables
- ✅ Use your MCP client's secure configuration
- ❌ Do NOT hardcode keys in code
- ❌ Do NOT commit .env to version control

## Network Security

Outbound connections ONLY to:
- api.openai.com (OpenAI)
- generativelanguage.googleapis.com (Google Gemini)
- api.deepseek.com (DeepSeek)
- api.mistral.ai (Mistral)
- openrouter.ai (OpenRouter proxy)

All connections use HTTPS with certificate validation.

## Responsible Disclosure

If you discover a security vulnerability:
1. Do NOT open a public GitHub issue
2. Email: keijo@boxsight.ai
3. Include: Severity, reproducible steps, suggested fix
4. Expect: Response within 48 hours

## Compliance

This tool does **not** implement:
- ❌ HIPAA compliance (don't send healthcare data)
- ❌ GDPR-specific features
- ❌ SOC2 attestation
- ❌ PCI-DSS

---

**Last Updated:** 2026-03-14
**Version:** v0.4.1+
**License:** MIT
