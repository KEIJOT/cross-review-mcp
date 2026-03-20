#!/usr/bin/env npx ts-node
// smoke-test-fallback.ts — Integration test for adaptive fallback
// Run: npx ts-node smoke-test-fallback.ts
// Expected: nemotron skipped (proactive) or falls back (reactive), fallbackFrom tagged in response

import { ReviewExecutor } from './src/executor.js';
import { loadConfig } from './src/config.js';
import { TokenTracker } from './src/tracking.js';

const LONG_PROMPT = `
You are reviewing a concept called ADL (Application Description Language).
ADL uses two primitives: Entity (a thing with optional states) and Transition (a state change with trigger, actor, condition).

The following is a detailed description of cal.com, an open source scheduling platform.
Please evaluate whether ADL can adequately describe this system.

${'cal.com is a scheduling platform that allows users to book time slots on a host calendar. '.repeat(400)}

Booking states: PENDING, ACCEPTED, REJECTED, CANCELLED, AWAITING_HOST.
Rescheduling is cancel + create, not a state transition.
Teams have members with roles: MEMBER, ADMIN, OWNER.
Team admins can manage bookings for team event types only — not globally.
Side effects: webhooks on every status change, calendar invites on ACCEPTED, emails on CANCELLED and REJECTED.

Question: Does ADL adequately describe this system? Answer in 2-3 sentences.
`.trim();

async function main() {
  const estimatedTokens = Math.ceil(LONG_PROMPT.length / 4);
  const nemotronContext = 4096;
  const threshold = nemotronContext * 0.8;

  console.log(`\nPrompt length : ${LONG_PROMPT.length} chars`);
  console.log(`Estimated     : ~${estimatedTokens} tokens`);
  console.log(`Nemotron limit: ${nemotronContext} tokens (contextLength in config)`);
  console.log(`80% threshold : ${threshold} tokens`);
  console.log(`Proactive skip: ${estimatedTokens > threshold ? 'SHOULD FIRE ✓' : 'will NOT fire — increase repeat count'}`);
  console.log('\n' + '─'.repeat(60));

  const config = loadConfig('./llmapi.config.json');
  const tracker = new TokenTracker(config);
  const executor = new ReviewExecutor(config, tracker);

  const result = await executor.execute({
    content: LONG_PROMPT,
    models: ['nemotron'],
  });

  console.log('\n' + '─'.repeat(60));
  console.log('RESULTS:\n');

  for (const [id, review] of Object.entries(result.reviews)) {
    const r = review as any;
    if (r.error) {
      console.log(`[${id}] FAILED: ${r.error}`);
    } else if (r.fallbackFrom) {
      console.log(`[${id}] FALLBACK from "${r.fallbackFrom}" ✓`);
      console.log(`  Responded by: ${r.modelId}`);
      console.log(`  Preview: ${r.content.substring(0, 200)}...`);
    } else {
      console.log(`[${id}] OK — no fallback triggered`);
      console.log(`  Preview: ${r.content.substring(0, 200)}...`);
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log('Look for "[executor] nemotron → fallback →" in the logs above.');
  console.log('After confirming, reset nemotron contextLength to 262144 in llmapi.config.json\n');
}

main().catch(console.error);
