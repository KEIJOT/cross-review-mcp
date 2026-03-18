# Contributing to Cross-Review MCP

Thanks for your interest in contributing! This document explains how to report bugs, suggest features, and submit code.

---

## Reporting Bugs

### Before You Report
- Check if the bug has already been reported in [Issues](https://github.com/KEIJOT/cross-review-mcp/issues)
- Test with the latest version (might already be fixed)
- Gather information: OS, Node version, error messages, steps to reproduce

### How to Report

1. Go to [Issues](https://github.com/KEIJOT/cross-review-mcp/issues)
2. Click **"New Issue"**
3. Fill in the template:

**Title:** Short, descriptive
```
Query logs endpoint fails with auth enabled
```

**Description:** Include steps to reproduce, expected behavior, actual behavior
```
## Steps to Reproduce
1. Start server with: AUTH_TOKEN=secret node dist/index.js --mode http
2. Call: curl -H "Authorization: Bearer secret" http://localhost:6280/api/query-logs
3. See 500 error

## Expected
JSON response with query logs

## Actual
HTTP 500: Internal Server Error

## Environment
- OS: Linux Ubuntu 22.04
- Node: 18.16.0
- v0.6.3
```

---

## Suggesting Features

1. Open an [Issue](https://github.com/KEIJOT/cross-review-mcp/issues)
2. Title: `[FEATURE] Brief idea`
3. Describe the feature, why it's useful, and how users would use it

**Example:**
```
Title: [FEATURE] Filter query logs by date range

Description:
Currently you can view recent logs, but there's no way to query logs from a specific date range.
This would be useful for analyzing cost trends over time.

Proposed API:
GET /api/query-logs?since=2026-03-01&until=2026-03-31
```

---

## Submitting Code (Pull Requests)

### Setup

1. **Fork the repo** (click "Fork" on GitHub)
2. **Clone your fork:**
   ```bash
   git clone https://github.com/YOUR-USERNAME/cross-review-mcp.git
   cd cross-review-mcp
   ```

3. **Create a branch** (based on what you're fixing):
   ```bash
   git checkout -b fix/query-logs-auth
   # or
   git checkout -b feature/date-range-filtering
   ```

4. **Install dependencies:**
   ```bash
   npm install
   ```

5. **Create a `.env` file** for testing (copy from `.env.example` if it exists):
   ```bash
   OPENAI_API_KEY=sk-...
   GEMINI_API_KEY=AIza...
   ```

### Making Changes

1. **Make your changes** to the code
2. **Run tests:**
   ```bash
   npm run test:all
   ```

3. **Build:**
   ```bash
   npm run build
   ```

4. **Commit your changes** with clear messages:
   ```bash
   git add .
   git commit -m "fix: handle auth errors in query logs endpoint"
   ```

   Good commit message format:
   - `fix:` for bug fixes
   - `feat:` for new features
   - `docs:` for documentation
   - `test:` for tests
   - `refactor:` for code cleanup

5. **Push to your fork:**
   ```bash
   git push origin fix/query-logs-auth
   ```

### Creating a Pull Request

1. Go to [Pull Requests](https://github.com/KEIJOT/cross-review-mcp/pulls)
2. Click **"New Pull Request"**
3. Select your branch on the right
4. Fill in the description:

```
## Description
Fixes the issue where query logs endpoint returns 500 when authentication is enabled.

## Changes
- Added proper error handling in /api/query-logs endpoint
- Added test case for authenticated query logs endpoint

## Related Issue
Fixes #42

## Testing
- [x] Tested with AUTH_TOKEN enabled
- [x] Tested without AUTH_TOKEN
- [x] All tests pass (npm run test:all)
```

---

## Code Standards

### Style
- Use TypeScript where possible
- Follow existing code patterns in the project
- 2-space indentation
- No trailing whitespace

### Testing
- Add tests for new features
- Make sure `npm run test:all` passes
- Test edge cases (empty input, large input, errors)

### Documentation
- Update README.md if your change affects usage
- Add inline comments for complex logic
- Update CHANGELOG.md with your change

---

## What Happens After You Submit a PR

1. **Automated checks run** (linter, tests)
2. **I review your code** and might ask for changes
3. **Discussion** happens in the PR (GitHub shows comments)
4. **Once approved:** Your code gets merged to `main`
5. **Release:** Your fix/feature goes into the next version

---

## Code Review Process

When I review your PR, I might ask for:
- Better error handling
- Additional tests
- Updated documentation
- Code style changes

This is normal! It's not personal — it's about keeping the code quality high.

---

## Questions?

If you have questions about contributing:
- Comment on the issue or PR
- Check existing issues for similar questions
- Open a new issue labeled `question`

---

## Thanks!

Every contribution helps make this project better for everyone. Thanks for being part of the community! 🙏

**GitHub:** https://github.com/KEIJOT/cross-review-mcp
**Issues:** https://github.com/KEIJOT/cross-review-mcp/issues
