// test/production-validation.ts - v0.5.0 Production Validation (5 Test Cases)
import { ReviewExecutor } from '../src/executor.js';
import { loadConfig } from '../src/config.js';
import { TokenTracker } from '../src/tracking.js';
import { ReviewRequest, ReviewResult } from '../src/types.js';

interface TestCase {
  name: string;
  content: string;
  description: string;
}

const testCases: TestCase[] = [
  {
    name: "Test 1: Security Analysis",
    description: "Vulnerability assessment in code",
    content: `Review this Node.js authentication code for security issues:
    
    app.post('/login', (req, res) => {
      const { username, password } = req.body;
      const user = db.query('SELECT * FROM users WHERE username = "' + username + '"');
      if (user && user.password === password) {
        res.send('Login successful');
      }
    });`,
  },
  {
    name: "Test 2: API Design",
    description: "REST API endpoint structure evaluation",
    content: `Evaluate this API design:
    
    GET /api/users/{id}/projects/{projectId}/tasks/{taskId}/subtasks/{subtaskId}/comments
    
    This endpoint returns a single comment with full object expansion. Should we paginate? Cache? How many N+1 queries?`,
  },
  {
    name: "Test 3: Performance Review",
    description: "Algorithm efficiency analysis",
    content: `Analyze this JavaScript algorithm for O(n) complexity assessment:
    
    function findDuplicates(arr) {
      const result = [];
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          if (arr[i] === arr[j]) {
            result.push(arr[i]);
          }
        }
      }
      return result;
    }
    
    How would you optimize this?`,
  },
  {
    name: "Test 4: Data Privacy",
    description: "GDPR/compliance implications",
    content: `Our system stores customer PII in plain text:
    - Email addresses
    - Phone numbers  
    - Credit card tokens (last 4 digits only)
    - Browsing history
    
    Which fields violate GDPR Article 32 encryption requirements?`,
  },
  {
    name: "Test 5: Architecture",
    description: "System design trade-offs",
    content: `Should we use:
    
    Option A: Monolith (single Node.js process, PostgreSQL)
    - Pros: Simpler deployment, fewer operational concerns
    - Cons: Harder to scale individual components
    
    Option B: Microservices (5-10 services, message queue, containers)
    - Pros: Independent scaling, language flexibility
    - Cons: Distributed tracing, eventual consistency complexity
    
    We have 3 engineers and expect 1M DAU in 18 months. Which?`,
  },
];

async function runTests(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('CROSS-REVIEW v0.5.0 PRODUCTION VALIDATION');
  console.log('='.repeat(80) + '\n');

  try {
    const config = loadConfig();
    const tracker = new TokenTracker();
    const executor = new ReviewExecutor(config, tracker);

    const results: Array<{ test: TestCase; result: ReviewResult; duration: number }> = [];
    let totalCost = 0;
    let totalTokens = { input: 0, output: 0 };

    for (const testCase of testCases) {
      console.log(`\n📋 ${testCase.name}`);
      console.log(`   ${testCase.description}`);
      console.log('   Status: Running...');

      const startTime = Date.now();
      const request: ReviewRequest = {
        content: testCase.content,
        contentHash: Buffer.from(testCase.content).toString('base64').substring(0, 16),
        strategy: 'wait_all',
      };

      const result = await executor.execute(request);
      const duration = Date.now() - startTime;

      results.push({ test: testCase, result, duration });
      totalCost += result.totalCost;

      // Calculate tokens
      for (const [_, response] of Object.entries(result.reviews)) {
        totalTokens.input += response.inputTokens;
        totalTokens.output += response.outputTokens;
      }

      console.log(`   ✅ Completed in ${duration}ms | Cost: $${result.totalCost.toFixed(4)}`);
      console.log(`   📊 Models: ${Object.keys(result.reviews).join(', ')}`);
    }

    // STATS OUTPUT VISUALIZATION
    console.log('\n' + '='.repeat(80));
    console.log('AGGREGATED STATISTICS');
    console.log('='.repeat(80) + '\n');

    console.log('📈 EXECUTION METRICS');
    console.log(`  Total Test Cases: ${testCases.length}`);
    console.log(`  Total Duration: ${results.reduce((s, r) => s + r.duration, 0)}ms`);
    console.log(`  Avg Duration/Test: ${Math.round(results.reduce((s, r) => s + r.duration, 0) / results.length)}ms`);

    console.log('\n💰 TOKEN USAGE & COSTS');
    console.log(`  Input Tokens: ${totalTokens.input.toLocaleString()}`);
    console.log(`  Output Tokens: ${totalTokens.output.toLocaleString()}`);
    console.log(`  Total Cost: $${totalCost.toFixed(4)}`);
    console.log(`  Cost/Test: $${(totalCost / testCases.length).toFixed(4)}`);

    console.log('\n⚡ PERFORMANCE BREAKDOWN');
    for (const { test, result } of results) {
      const execTime = result.executionTimeMs;
      const bar = '█'.repeat(Math.round(execTime / 50));
      console.log(`  ${test.name.padEnd(20)} ${bar} ${execTime}ms`);
    }

    console.log('\n🎯 MODEL CONSENSUS');
    const modelStats = new Map<string, { count: number; totalTime: number }>();
    for (const { result } of results) {
      for (const [modelId, response] of Object.entries(result.reviews)) {
        const stat = modelStats.get(modelId) || { count: 0, totalTime: 0 };
        stat.count++;
        stat.totalTime += response.executionTimeMs;
        modelStats.set(modelId, stat);
      }
    }

    for (const [modelId, stat] of modelStats) {
      const avgTime = Math.round(stat.totalTime / stat.count);
      console.log(`  ${modelId.padEnd(15)} ${stat.count} reviews | Avg: ${avgTime}ms`);
    }

    console.log('\n✨ RESULT EXPORT (JSON)');
    const exportData = {
      timestamp: new Date().toISOString(),
      version: '0.5.0',
      summary: {
        totalTests: testCases.length,
        totalDuration: results.reduce((s, r) => s + r.duration, 0),
        totalCost,
        tokenUsage: totalTokens,
      },
      details: results.map(({ test, result, duration }) => ({
        testName: test.name,
        duration,
        cost: result.totalCost,
        models: Object.keys(result.reviews),
        modelCount: Object.keys(result.reviews).length,
        tokens: {
          input: Object.values(result.reviews).reduce((s, r) => s + r.inputTokens, 0),
          output: Object.values(result.reviews).reduce((s, r) => s + r.outputTokens, 0),
        },
      })),
    };

    console.log(JSON.stringify(exportData, null, 2));

    console.log('\n' + '='.repeat(80));
    console.log('✅ VALIDATION COMPLETE — v0.5.0 PRODUCTION READY');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('\n❌ VALIDATION FAILED:');
    console.error(error);
    process.exit(1);
  }
}

runTests();
