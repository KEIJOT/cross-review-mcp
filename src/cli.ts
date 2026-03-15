#!/usr/bin/env node
// src/cli.ts - Command-line interface (v0.6.0, 2026-03-15)

import { program } from 'commander';
import { loadConfig } from './config.js';
import { ReviewExecutor } from './executor.js';
import { TokenTracker } from './tracking.js';
import { analyzeDevelopmentProblem, formatGuidanceForCLI } from './dev-guidance.js';
import { CacheManager } from './cache.js';
import { CostManager } from './cost-manager.js';
import { configureLogger } from './logger.js';

const version = '0.6.0';

// Shared instances that persist across CLI commands within one process
const cache = new CacheManager({
  enabled: true,
  ttl: 86400,
  maxSize: 1000,
  strategy: 'lru',
});

const costManager = new CostManager({
  trackingEnabled: true,
  dailyThreshold: 10,
});

configureLogger({ enabled: true, level: 'info' });

function createExecutor(): ReviewExecutor {
  const config = loadConfig();
  const tracker = new TokenTracker('.llmapi_usage.json');
  return new ReviewExecutor(config, tracker, cache, costManager);
}

program.version(version);

/**
 * `cross-review dev <e>` - Get guidance on a development blocker
 */
program
  .command('dev <e>')
  .description('Get cross-LLM guidance for a development problem')
  .option('-t, --technology <tech>', 'Technology (e.g., Docker, Node.js)', 'Unknown')
  .option('--env <env>', 'Environment (e.g., macOS, Linux)', process.platform)
  .option('-a, --attempts <attempts...>', 'What you\'ve already tried', [])
  .option('-c, --code <snippet>', 'Optional code snippet')
  .action(async (error, options) => {
    try {
      console.log('\n🔍 Analyzing your problem with cross-LLM consensus...\n');

      const executor = createExecutor();

      const guidance = await analyzeDevelopmentProblem(
        {
          error,
          context: {
            technology: options.technology,
            environment: options.env,
            attempts: options.attempts || [],
          },
          codeSnippet: options.code,
        },
        executor
      );

      console.log(formatGuidanceForCLI(guidance));
      process.exit(0);
    } catch (error: any) {
      console.error('\n❌ Error:', error.message);
      process.exit(1);
    }
  });

/**
 * `cross-review review <content>` - Review content across models
 */
program
  .command('review <content>')
  .description('Submit content for cross-LLM peer review')
  .action(async (content) => {
    try {
      console.log('\n📋 Reviewing with 5 models...\n');

      const executor = createExecutor();

      const result = await executor.execute({
        content,
      });

      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    } catch (error: any) {
      console.error('\n❌ Error:', error.message);
      process.exit(1);
    }
  });

/**
 * `cross-review cost` - Show cost tracking
 */
program
  .command('cost')
  .description('Show API cost summary')
  .option('-m, --month <month>', 'Month to report on (YYYY-MM)')
  .action((options) => {
    if (options.month) {
      const report = costManager.getMonthlyReport(options.month);
      console.log('\n💰 MONTHLY COST REPORT');
      console.log('═'.repeat(50));
      console.log(`Month: ${report.month}`);
      console.log(`Total: ${report.totalCost}`);
      console.log('\nDaily Breakdown:');
      Object.entries(report.dailyBreakdown).forEach(([date, cost]) => {
        console.log(`  ${date}: ${cost}`);
      });
      console.log('\nPer-Model:');
      Object.entries(report.perModel).forEach(([model, cost]) => {
        console.log(`  ${model}: ${cost}`);
      });
    } else {
      const stats = costManager.getStats();
      console.log('\n💰 COST SUMMARY');
      console.log('═'.repeat(50));
      Object.entries(stats).forEach(([key, value]) => {
        console.log(`${key}: ${value}`);
      });
    }

    process.exit(0);
  });

/**
 * `cross-review cache` - Cache statistics
 */
program
  .command('cache')
  .description('Show cache statistics')
  .option('-c, --clear', 'Clear the cache')
  .action((options) => {
    if (options.clear) {
      cache.clear();
      console.log('✅ Cache cleared');
    } else {
      const stats = cache.getStats();
      console.log('\n📊 CACHE STATISTICS');
      console.log('═'.repeat(50));
      console.log(`Hits: ${stats.hits}`);
      console.log(`Misses: ${stats.misses}`);
      console.log(`Hit Rate: ${(stats.hitRate * 100).toFixed(1)}%`);
      console.log(`Entries: ${stats.entries}/${stats.maxSize}`);
      console.log(`Evictions: ${stats.evictions}`);
    }

    process.exit(0);
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
