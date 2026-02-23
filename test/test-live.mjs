// Cross-Review 4-model live test (v0.4.0, 2026-02-23)
// Tests 3 adversarial scenarios with all configured models
import 'dotenv/config';
import { CrossReviewEngine, resolveReviewers } from '../dist/engine.js';

// ── Load reviewers from env ────────────────────────────────────────────
const reviewers = resolveReviewers(process.env.CROSS_REVIEW_MODELS);
console.log(`Active reviewers (${reviewers.length}): ${reviewers.map(r => r.name).join(', ')}\n`);
const engine = new CrossReviewEngine(reviewers);

// ── Helpers ────────────────────────────────────────────────────────────
function cleanMarkdown(text) {
  return text?.replace(/\*\*/g, '').replace(/^#{1,6}\s*/gm, '') ?? '';
}

function extractOverallSeverity(critique) {
  const m = cleanMarkdown(critique).match(/OVERALL\s+SEVERITY\s*:\s*(CRITICAL|MAJOR|MINOR|NONE)/i);
  return m ? m[1].toUpperCase() : 'N/A';
}

function extractIssueCount(critique) {
  const m = cleanMarkdown(critique).match(/ISSUE\s+COUNT\s*:\s*(.+)/i);
  return m ? m[1].trim() : 'N/A';
}

function countIssues(critique) {
  const matches = cleanMarkdown(critique).match(/^ISSUE\s+\d+\s*:/gim);
  return matches ? matches.length : 0;
}

// ── Test cases ─────────────────────────────────────────────────────────
const tests = [
  {
    name: "TEST 1: Hideous Claim (proposal / adversarial)",
    content: `
Our new microservices architecture will reduce latency by 95% while also improving
security and cutting infrastructure costs by 80%. By moving from a monolith to 47
microservices, each team will be fully autonomous and we expect zero coordination
overhead. We plan to complete the migration in 6 weeks with our team of 3 developers.
The system will handle 10 million concurrent users on day one with no load testing needed,
because Kubernetes auto-scales infinitely. We will use MongoDB for all data because
joins are an anti-pattern. Authentication will be handled by passing JWTs in URL
query parameters for maximum compatibility.
    `.trim(),
    scrutinyLevel: "adversarial",
    contentType: "proposal",
  },
  {
    name: "TEST 2: Flawed Architecture (code / adversarial)",
    content: `
# Payment Processing System Architecture

## Components
- React frontend talks directly to Stripe API using secret key embedded in bundle
- User passwords stored as MD5 hashes in a public S3 bucket
- All microservices communicate via shared PostgreSQL database (polling every 100ms)
- Retry logic: on any failure, retry infinitely with no backoff
- Logging: all PII including SSNs written to CloudWatch in plaintext
- Deployment: single EC2 instance, no redundancy, manual SSH deploys
- Caching: entire database replicated into localStorage on each page load
    `.trim(),
    scrutinyLevel: "adversarial",
    contentType: "code",
  },
  {
    name: "TEST 3: Buggy Code (code / adversarial)",
    content: `
// Transfer funds between accounts
async function transferFunds(fromId, toId, amount) {
  const from = await db.accounts.findOne({ id: fromId });
  const to = await db.accounts.findOne({ id: toId });

  // Check balance
  if (from.balance >= amount) {
    // Update balances
    await db.accounts.update({ id: fromId }, { balance: from.balance - amount });
    await db.accounts.update({ id: toId }, { balance: to.balance + amount });

    // Log the transfer
    console.log('Transfer of $' + amount + ' complete');
    return { success: true };
  }
  return { success: false };
}

// API endpoint
app.get('/transfer', async (req, res) => {
  const { from, to, amount } = req.query;
  const result = await transferFunds(from, to, amount);
  res.json(result);
});
    `.trim(),
    scrutinyLevel: "adversarial",
    contentType: "code",
  },
];

// ── Run tests ──────────────────────────────────────────────────────────
let grandTotal = 0;

for (const test of tests) {
  console.log(`\n${'='.repeat(72)}`);
  console.log(`  ${test.name}`);
  console.log('='.repeat(72));

  try {
    const result = await engine.review(test.content, {
      scrutinyLevel: test.scrutinyLevel,
      contentType: test.contentType,
      includeConsensus: true,
    });

    // Per-model results
    for (const r of result.reviews) {
      const severity = r.status === 'success' ? extractOverallSeverity(r.critique) : 'ERROR';
      const count = r.status === 'success' ? countIssues(r.critique) : 0;
      const issueLine = r.status === 'success' ? extractIssueCount(r.critique) : r.error;
      const dur = r.durationMs ? `${(r.durationMs / 1000).toFixed(1)}s` : '-';
      const tok = r.tokenUsage
        ? `${r.tokenUsage.inputTokens}in/${r.tokenUsage.outputTokens}out`
        : '-';

      console.log(`\n  ${r.model}`);
      console.log(`    Status:     ${r.status}`);
      console.log(`    Severity:   ${severity}`);
      console.log(`    Issues:     ${count} total  (${issueLine})`);
      console.log(`    Tokens:     ${tok}`);
      console.log(`    Duration:   ${dur}`);
    }

    // Consensus
    if (result.consensus) {
      console.log(`\n  CONSENSUS`);
      console.log(`    Verdict:    ${result.consensus.verdict.toUpperCase()}`);
      console.log(`    Arbitrator: ${result.consensus.arbitrator}`);
      // Show first 300 chars of summary
      const short = result.consensus.summary?.substring(0, 300).replace(/\n/g, '\n              ');
      console.log(`    Summary:    ${short}...`);
    } else {
      console.log(`\n  CONSENSUS: not available (need 2+ successful reviews)`);
    }

    // Cost & timing
    const cost = result.cost.estimatedUsd;
    grandTotal += cost;
    console.log(`\n  Cost:         $${cost.toFixed(4)}`);
    console.log(`  Tokens:       ${result.cost.inputTokens} in / ${result.cost.outputTokens} out`);
    console.log(`  Total time:   ${(result.totalDurationMs / 1000).toFixed(1)}s`);

  } catch (e) {
    console.error(`\n  ERROR: ${e.message}`);
  }
}

// ── Grand total ────────────────────────────────────────────────────────
console.log(`\n${'='.repeat(72)}`);
console.log(`  GRAND TOTAL COST: $${grandTotal.toFixed(4)}`);
console.log('='.repeat(72));
