#!/usr/bin/env node
// Cross-LLM Review Protocol - MCP Server (v0.4.0, 2026-02-22)

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { CrossReviewEngine, resolveReviewers, validateConfiguration, KNOWN_PROVIDERS, type CrossReviewResult } from "./engine.js";
import { SCRUTINY_LEVELS, CONTENT_TYPES } from "./prompts.js";

let reviewers;
try {
  reviewers = resolveReviewers(process.env.CROSS_REVIEW_MODELS);
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}

const configCheck = validateConfiguration(reviewers);
if (!configCheck.valid) {
  console.error("Configuration errors:");
  for (const err of configCheck.errors) {
    console.error(`  - ${err}`);
  }
  console.error("\nFix the above issues and restart.");
  process.exit(1);
}

const engine = new CrossReviewEngine(reviewers);

console.error(`Reviewers: ${reviewers.map(r => r.name).join(", ")}`);

const server = new McpServer({
  name: "cross-review-mcp",
  version: "0.4.0",
});

type MinSeverity = "minor" | "major" | "critical";

const SEVERITY_RANK: Record<string, number> = {
  minor: 0,
  major: 1,
  critical: 2,
};

// Register the cross_review tool
server.tool(
  "cross_review",
  {
    content: z.string().describe("The content to review"),
    scrutiny_level: z
      .enum(["quick", "standard", "adversarial", "redteam"])
      .optional()
      .describe("Level of scrutiny: quick, standard, adversarial, or redteam"),
    content_type: z
      .enum([
        "general",
        "paper",
        "code",
        "proposal",
        "legal",
        "medical",
        "financial",
      ])
      .optional()
      .describe("Type of content being reviewed"),
    include_consensus: z
      .boolean()
      .optional()
      .describe("Whether to include consensus analysis (default: true)"),
    min_severity: z
      .enum(["minor", "major", "critical"])
      .optional()
      .describe(
        "Minimum issue severity to display: minor (all), major (hide minor), critical (only critical)"
      ),
  },
  async (params) => {
    try {
      const result = await engine.review(params.content, {
        scrutinyLevel: params.scrutiny_level,
        contentType: params.content_type,
        includeConsensus: params.include_consensus,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: formatResult(result, params.min_severity || "minor"),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool("list_scrutiny_levels", {}, async () => {
  const levels = Object.entries(SCRUTINY_LEVELS).map(([key, value]) => ({
    level: key,
    name: value.name,
    description: value.description,
  }));

  return {
    content: [{ type: "text" as const, text: JSON.stringify(levels, null, 2) }],
  };
});

server.tool("list_models", {}, async () => {
  const active = reviewers.map((r) => `✓ ${r.name} (${r.id})`);
  const available = Object.entries(KNOWN_PROVIDERS).map(
    ([id, cfg]) => `  ${id} → ${cfg.name} (${cfg.provider}, key: ${cfg.apiKeyEnv})`
  );

  return {
    content: [
      {
        type: "text" as const,
        text: [
          "ACTIVE REVIEWERS:",
          ...active,
          "",
          "AVAILABLE SHORTHANDS (use in CROSS_REVIEW_MODELS):",
          ...available,
          "",
          'Config: set CROSS_REVIEW_MODELS=["deepseek","gemini-flash","llama"] in your env',
        ].join("\n"),
      },
    ],
  };
});

server.tool("list_content_types", {}, async () => {
  const types = Object.entries(CONTENT_TYPES).map(([key, value]) => ({
    type: key,
    description: value,
  }));

  return {
    content: [{ type: "text" as const, text: JSON.stringify(types, null, 2) }],
  };
});

function formatResult(result: CrossReviewResult, minSeverity: MinSeverity): string {
  const lines: string[] = [];

  // ── EXECUTIVE SUMMARY ──
  lines.push("CROSS-LLM PEER REVIEW");
  lines.push("═".repeat(40));
  lines.push("");

  if (result.warning) {
    lines.push(`WARNING: ${result.warning}`);
    lines.push("");
  }

  if (result.consensus) {
    lines.push(`VERDICT: ${result.consensus.verdict.toUpperCase()}`);
    lines.push(`Arbitrator: ${result.consensus.arbitrator}`);
    lines.push("");

    const consensusIssues = extractSection(
      result.consensus.summary,
      "CONSENSUS ISSUES"
    );
    if (consensusIssues) {
      lines.push("Consensus Issues:");
      lines.push(consensusIssues);
      lines.push("");
    }
  } else {
    lines.push("VERDICT: N/A (consensus unavailable)");
    lines.push("");
  }

  lines.push("Issue Counts:");
  for (const review of result.reviews) {
    if (review.status === "success" && review.critique) {
      lines.push(`  ${review.model}: ${extractIssueCounts(review.critique)}`);
    } else {
      lines.push(`  ${review.model}: error`);
    }
  }
  lines.push("");

  // ── DETAILED REVIEWS ──
  for (const review of result.reviews) {
    lines.push("─".repeat(40));
    if (review.status === "success") {
      lines.push(`${review.model} (${review.durationMs}ms)`);
      lines.push("");
      lines.push(filterBySeverity(review.critique || "", minSeverity));
    } else {
      lines.push(`${review.model}: ERROR — ${review.error}`);
    }
    lines.push("");
  }

  // ── CONSENSUS DETAIL ──
  if (result.consensus) {
    lines.push("─".repeat(40));
    lines.push(`CONSENSUS (${result.consensus.arbitrator})`);
    lines.push("");
    lines.push(result.consensus.summary);
    lines.push("");
  }

  // ── FOOTER ──
  lines.push("─".repeat(40));
  const costStr =
    result.cost.estimatedUsd < 0.01
      ? "<$0.01"
      : `~$${result.cost.estimatedUsd.toFixed(4)}`;
  lines.push(
    `Cost: ${costStr} (${result.cost.inputTokens.toLocaleString()} in + ${result.cost.outputTokens.toLocaleString()} out tokens)`
  );
  lines.push(
    `${result.totalDurationMs}ms | ${SCRUTINY_LEVELS[result.scrutinyLevel].name} | ${CONTENT_TYPES[result.contentType]}${minSeverity !== "minor" ? ` | Filter: ${minSeverity}+` : ""}`
  );

  return lines.join("\n");
}

function extractSection(text: string, sectionName: string): string | null {
  const pattern = new RegExp(
    `${sectionName}[^:]*:\\s*\\n([\\s\\S]*?)(?=\\n(?:SINGLE-MODEL|DISPUTED|CONSENSUS|SUMMARY|VERDICT)[^:]*:|$)`,
    "i"
  );
  const match = text.match(pattern);
  if (match) {
    const content = match[1].trim();
    return content || null;
  }
  return null;
}

function extractIssueCounts(critique: string): string {
  const match = critique.match(/ISSUE COUNT:\s*(.+)/i);
  if (match) return match[1].trim();
  // Fallback: count individual issue headers (handles markdown-bold variants)
  const issues = critique.match(/\**\s*ISSUE\s+\d+\s*:?\**\s*:?/gim);
  return issues ? `${issues.length} issues found` : "no issues";
}

function filterBySeverity(critique: string, minSeverity: MinSeverity): string {
  if (minSeverity === "minor") return critique;

  const minRank = SEVERITY_RANK[minSeverity];
  const issueBlockRegex =
    /\**\s*ISSUE\s+\d+\s*:?\**\s*:?\s*\n[\s\S]*?(?=\**\s*ISSUE\s+\d+|OVERALL\s+SEVERITY:|$)/gi;

  let filtered = critique;
  for (const block of critique.matchAll(issueBlockRegex)) {
    const blockText = block[0];
    const severityMatch = blockText.match(/Severity:\s*(CRITICAL|MAJOR|MINOR)/i);
    if (severityMatch) {
      const rank = SEVERITY_RANK[severityMatch[1].toLowerCase()] ?? 0;
      if (rank < minRank) {
        filtered = filtered.replace(blockText, "");
      }
    }
  }

  return filtered.replace(/\n{3,}/g, "\n\n").trim();
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Cross-Review MCP Server started");
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
