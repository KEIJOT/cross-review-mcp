// Cross-Review 4-model live test (v0.4.0, 2026-02-22)
import 'dotenv/config';
import { CrossReviewEngine, resolveReviewers } from '../dist/engine.js';

const reviewers = resolveReviewers(process.env.CROSS_REVIEW_MODELS);
console.log(`Active reviewers: ${reviewers.map(r => r.name).join(', ')}\n`);

const engine = new CrossReviewEngine(reviewers);

const content = `
Our new microservices architecture will reduce latency by 95% while also improving
security and cutting infrastructure costs by 80%. By moving from a monolith to 47
microservices, each team will be fully autonomous and we expect zero coordination
overhead. We plan to complete the migration in 6 weeks with our team of 3 developers.
The system will handle 10 million concurrent users on day one with no load testing needed,
because Kubernetes auto-scales infinitely. We will use MongoDB for all data because
joins are an anti-pattern. Authentication will be handled by passing JWTs in URL
query parameters for maximum compatibility.
`;

console.log('Sending to all models (adversarial, proposal)...\n');

try {
  const result = await engine.review(content, {
    scrutinyLevel: 'adversarial',
    contentType: 'proposal'
  });
  
  for (const r of result.reviews) {
    console.log(`--- ${r.model} [${r.status}] (${r.durationMs}ms) ---`);
    if (r.critique) {
      // Show first 300 chars of critique
      console.log(r.critique.substring(0, 300));
    } else if (r.error) {
      console.log(`ERROR: ${r.error}`);
    }
    console.log();
  }

  if (result.consensus) {
    console.log(`\nCONSENSUS: ${result.consensus.verdict}`);
    console.log(`Arbitrator: ${result.consensus.arbitrator}`);
    console.log(result.consensus.summary?.substring(0, 400));
  }

  console.log(`\nReviewers: ${result.reviewers.join(', ')}`);
  console.log(`Total time: ${result.totalDurationMs}ms`);
  console.log(`Cost: ~$${result.cost.estimatedUsd.toFixed(4)}`);
  console.log(`Tokens: ${result.cost.inputTokens} in / ${result.cost.outputTokens} out`);
} catch (e) {
  console.log(`ERROR: ${e.message}`);
  console.log(e.stack);
}
