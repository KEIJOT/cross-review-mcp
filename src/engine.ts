// Cross-LLM Review Protocol - Core Engine (v0.4.0, 2026-02-22)
// Changes: Multi-provider support (OpenAI-compatible APIs), configurable reviewers via env

import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import {
  buildAdversarialPrompt,
  buildConsensusPrompt,
  SCRUTINY_LEVELS,
  type ScrutinyLevel,
  type ContentType,
} from "./prompts.js";

export interface ReviewerConfig {
  id: string;
  name: string;
  provider: "openai" | "gemini" | "openai-compatible";
  model: string;
  baseUrl?: string;
  apiKeyEnv?: string;
}

const ReviewerConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  provider: z.enum(["openai", "gemini", "openai-compatible"]),
  model: z.string().min(1),
  baseUrl: z.string().url().refine(
    (url) => url.startsWith("https://"),
    { message: "baseUrl must use HTTPS" }
  ).optional(),
  apiKeyEnv: z.string().optional(),
});

const ReviewerConfigArraySchema = z.array(
  z.union([
    z.string().min(1),  // shorthand provider id
    ReviewerConfigSchema,
  ])
);

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface ReviewResult {
  model: string;
  status: "success" | "error";
  critique?: string;
  error?: string;
  durationMs?: number;
  tokenUsage?: TokenUsage;
}

export interface CrossReviewResult {
  contentLength: number;
  scrutinyLevel: ScrutinyLevel;
  contentType: ContentType;
  reviewers: string[];
  reviews: ReviewResult[];
  consensus?: {
    verdict: "proceed" | "revise" | "abort";
    arbitrator: string;
    summary: string;
    error?: string;  // human-readable failure reason; present when consensus was attempted but failed
  };
  totalDurationMs: number;
  cost: {
    inputTokens: number;
    outputTokens: number;
    estimatedUsd: number;
  };
  warning?: string;  // present when content triggers a soft size limit (SAFE-01)
}

const DEFAULT_REVIEWERS: ReviewerConfig[] = [
  {
    id: "gpt-5.2",
    name: "GPT-5.2",
    provider: "openai",
    model: "gpt-5.2",
  },
  {
    id: "gemini-flash",
    name: "Gemini 3 Flash",
    provider: "gemini",
    model: "gemini-3-flash-preview",
  },
];

// Pre-configured providers users can reference by id
const KNOWN_PROVIDERS: Record<string, Omit<ReviewerConfig, "id">> = {
  // OpenAI
  "gpt-5.2": { name: "GPT-5.2", provider: "openai", model: "gpt-5.2", apiKeyEnv: "OPENAI_API_KEY" },
  "gpt-5.2-instant": { name: "GPT-5.2 Instant", provider: "openai", model: "gpt-5.2-chat-latest", apiKeyEnv: "OPENAI_API_KEY" },
  "gpt-4o": { name: "GPT-4o", provider: "openai", model: "gpt-4o", apiKeyEnv: "OPENAI_API_KEY" },
  // Google Gemini
  "gemini-3.1-pro": { name: "Gemini 3.1 Pro", provider: "gemini", model: "gemini-3.1-pro-preview", apiKeyEnv: "GEMINI_API_KEY" },
  "gemini-3-pro": { name: "Gemini 3 Pro", provider: "gemini", model: "gemini-3-pro-preview", apiKeyEnv: "GEMINI_API_KEY" },
  "gemini-flash": { name: "Gemini 3 Flash", provider: "gemini", model: "gemini-3-flash-preview", apiKeyEnv: "GEMINI_API_KEY" },
  "gemini-2.5-flash": { name: "Gemini 2.5 Flash", provider: "gemini", model: "gemini-2.5-flash", apiKeyEnv: "GEMINI_API_KEY" },
  // DeepSeek (direct)
  "deepseek": { name: "DeepSeek V3", provider: "openai-compatible", model: "deepseek-chat", baseUrl: "https://api.deepseek.com", apiKeyEnv: "DEEPSEEK_API_KEY" },
  "deepseek-r1": { name: "DeepSeek R1", provider: "openai-compatible", model: "deepseek-reasoner", baseUrl: "https://api.deepseek.com", apiKeyEnv: "DEEPSEEK_API_KEY" },
  // Mistral (direct)
  "mistral": { name: "Mistral Large", provider: "openai-compatible", model: "mistral-large-latest", baseUrl: "https://api.mistral.ai/v1", apiKeyEnv: "MISTRAL_API_KEY" },
  // OpenRouter (free models — note: prompts may be used for training)
  "qwen": { name: "Qwen3 32B", provider: "openai-compatible", model: "qwen/qwen3-32b", baseUrl: "https://openrouter.ai/api/v1", apiKeyEnv: "OPENROUTER_API_KEY" },
  "llama": { name: "Llama 3.3 70B", provider: "openai-compatible", model: "meta-llama/llama-3.3-70b-instruct:free", baseUrl: "https://openrouter.ai/api/v1", apiKeyEnv: "OPENROUTER_API_KEY" },
};

export function validateConfiguration(reviewers: ReviewerConfig[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const reviewer of reviewers) {
    const envVar = reviewer.apiKeyEnv
      || (reviewer.provider === "openai" ? "OPENAI_API_KEY"
        : reviewer.provider === "gemini" ? "GEMINI_API_KEY"
        : undefined);
    if (!envVar) {
      errors.push(`${reviewer.name} (${reviewer.id}): no API key environment variable configured`);
      continue;
    }
    if (!process.env[envVar]) {
      errors.push(`${reviewer.name} (${reviewer.id}): missing API key — set ${envVar}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function resolveReviewers(envModels?: string): ReviewerConfig[] {
  if (!envModels) return DEFAULT_REVIEWERS;

  let parsed: unknown;
  try {
    parsed = JSON.parse(envModels);
  } catch (e) {
    throw new Error(`CROSS_REVIEW_MODELS is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }

  let validated: z.infer<typeof ReviewerConfigArraySchema>;
  try {
    validated = ReviewerConfigArraySchema.parse(parsed);
  } catch (e) {
    if (e instanceof z.ZodError) {
      const issues = e.issues.map(i => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
      throw new Error(`CROSS_REVIEW_MODELS validation failed:\n${issues}`);
    }
    throw e;
  }

  return validated.map((entry) => {
    if (typeof entry === "string") {
      const known = KNOWN_PROVIDERS[entry];
      if (!known) {
        throw new Error(`Unknown model shorthand: ${entry}. Known: ${Object.keys(KNOWN_PROVIDERS).join(", ")}`);
      }
      return { id: entry, ...known };
    }
    return { ...entry, name: entry.name || entry.id };
  });
}

export { KNOWN_PROVIDERS };

// USD per 1M tokens (as of Feb 2026)
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  // OpenAI
  "gpt-5.2": { input: 1.75, output: 14.00 },
  "gpt-5.2-chat-latest": { input: 0.80, output: 3.20 },
  "gpt-4o": { input: 2.50, output: 10.00 },
  // Google Gemini
  "gemini-3.1-pro-preview": { input: 1.25, output: 5.00 },
  "gemini-3-pro-preview": { input: 1.25, output: 5.00 },
  "gemini-3-flash-preview": { input: 0.10, output: 0.40 },
  "gemini-2.5-flash": { input: 0.15, output: 0.60 },
  // DeepSeek
  "deepseek-chat": { input: 0.14, output: 0.28 },
  "deepseek-reasoner": { input: 0.55, output: 2.19 },
  // Mistral
  "mistral-large-latest": { input: 2.00, output: 6.00 },
  // OpenRouter free models
  "meta-llama/llama-3.3-70b-instruct:free": { input: 0, output: 0 },
  "qwen/qwen3-32b": { input: 0, output: 0 },
};

export function parseVerdict(summary: string): "proceed" | "revise" | "abort" {
  // Strip markdown bold markers for consistent matching
  const cleaned = summary.replace(/\*\*/g, "");

  // Try explicit VERDICT: line first (most reliable), handles OVERALL VERDICT too
  const verdictMatch = cleaned.match(
    /^\s*(?:OVERALL\s+)?VERDICT:\s*(PROCEED|REVISE|ABORT)/im
  );
  if (verdictMatch) {
    return verdictMatch[1].toLowerCase() as "proceed" | "revise" | "abort";
  }

  // Fallback: search in summary/conclusion/recommendation section
  const lowerCleaned = cleaned.toLowerCase();
  const summarySection =
    lowerCleaned.split(/summary:|conclusion:|recommendation:/i).pop() || "";

  if (summarySection.includes("abort")) {
    return "abort";
  } else if (summarySection.includes("proceed")) {
    return "proceed";
  }

  return "revise";
}

export function countHighConfidenceClaims(critique: string): number {
  // Strip markdown bold markers for consistent matching
  const cleaned = critique.replace(/\*\*/g, "");
  const matches = cleaned.match(/Confidence:\s*HIGH/gi);
  return matches ? matches.length : 0;
}

export function estimateTokens(text: string): number {
  return 0; // stub
}

export class CrossReviewEngine {
  private openaiClients: Map<string, OpenAI> = new Map();
  private gemini: GoogleGenerativeAI | null = null;
  private reviewers: ReviewerConfig[];

  constructor(reviewers?: ReviewerConfig[]) {
    this.reviewers = reviewers || DEFAULT_REVIEWERS;
    this.initClients();
  }

  private initClients(): void {
    for (const reviewer of this.reviewers) {
      const apiKey = reviewer.apiKeyEnv
        ? process.env[reviewer.apiKeyEnv]
        : reviewer.provider === "openai"
          ? process.env.OPENAI_API_KEY
          : reviewer.provider === "gemini"
            ? process.env.GEMINI_API_KEY
            : undefined;

      if (!apiKey) {
        console.error(`No API key found for ${reviewer.name} (env: ${reviewer.apiKeyEnv || "auto"})`);
        continue;
      }

      if (reviewer.provider === "openai" || reviewer.provider === "openai-compatible") {
        const clientKey = `${reviewer.provider}:${reviewer.baseUrl || "default"}`;
        if (!this.openaiClients.has(clientKey)) {
          this.openaiClients.set(
            clientKey,
            new OpenAI({
              apiKey,
              ...(reviewer.baseUrl ? { baseURL: reviewer.baseUrl } : {}),
            })
          );
        }
      } else if (reviewer.provider === "gemini" && !this.gemini) {
        this.gemini = new GoogleGenerativeAI(apiKey);
      }
    }
  }

  private getOpenAIClient(reviewer: ReviewerConfig): OpenAI | null {
    const clientKey = `${reviewer.provider}:${reviewer.baseUrl || "default"}`;
    return this.openaiClients.get(clientKey) || null;
  }

  private estimateCost(modelId: string, usage: TokenUsage): number {
    const rates = MODEL_COSTS[modelId];
    if (!rates) return 0;
    return (
      (usage.inputTokens * rates.input +
        usage.outputTokens * rates.output) /
      1_000_000
    );
  }

  async review(
    content: string,
    options: {
      scrutinyLevel?: ScrutinyLevel;
      contentType?: ContentType;
      includeConsensus?: boolean;
    } = {}
  ): Promise<CrossReviewResult> {
    const startTime = Date.now();
    const scrutinyLevel = options.scrutinyLevel || "standard";
    const contentType = options.contentType || "general";
    const includeConsensus = options.includeConsensus ?? true;

    const levelConfig = SCRUTINY_LEVELS[scrutinyLevel];
    const prompt = buildAdversarialPrompt(content, contentType, scrutinyLevel);

    // Run reviews in parallel
    const reviewPromises = this.reviewers.map((reviewer) =>
      this.reviewWithModel(reviewer, prompt, levelConfig)
    );

    const reviews = await Promise.all(reviewPromises);

    // Build consensus if requested and we have 2+ successful reviews
    let consensus: CrossReviewResult["consensus"];
    let consensusTokenUsage: TokenUsage | undefined;
    let consensusModelId: string | undefined;
    if (includeConsensus) {
      const successfulReviews = reviews.filter(
        (r): r is ReviewResult & { critique: string } =>
          r.status === "success" && !!r.critique
      );
      if (successfulReviews.length >= 2) {
        const result = await this.buildConsensus(
          successfulReviews,
          levelConfig
        );
        consensus = result.consensus;
        consensusTokenUsage = result.tokenUsage;
        consensusModelId = result.modelId;
      } else {
        consensus = {
          verdict: "revise" as const,
          arbitrator: "none",
          summary: "",
          error: `Consensus requires at least 2 successful reviews, got ${successfulReviews.length}`,
        };
      }
    }

    // Aggregate token usage and cost
    let totalInput = 0;
    let totalOutput = 0;
    let totalCost = 0;

    for (let i = 0; i < reviews.length; i++) {
      const review = reviews[i];
      if (review.tokenUsage) {
        totalInput += review.tokenUsage.inputTokens;
        totalOutput += review.tokenUsage.outputTokens;
        totalCost += this.estimateCost(
          this.reviewers[i].model,
          review.tokenUsage
        );
      }
    }

    if (consensusTokenUsage && consensusModelId) {
      totalInput += consensusTokenUsage.inputTokens;
      totalOutput += consensusTokenUsage.outputTokens;
      totalCost += this.estimateCost(consensusModelId, consensusTokenUsage);
    }

    return {
      contentLength: content.length,
      scrutinyLevel,
      contentType,
      reviewers: this.reviewers.map((r) => r.name),
      reviews,
      consensus,
      totalDurationMs: Date.now() - startTime,
      cost: {
        inputTokens: totalInput,
        outputTokens: totalOutput,
        estimatedUsd: totalCost,
      },
    };
  }

  private async reviewWithModel(
    reviewer: ReviewerConfig,
    prompt: string,
    levelConfig: (typeof SCRUTINY_LEVELS)[ScrutinyLevel]
  ): Promise<ReviewResult> {
    const startTime = Date.now();

    try {
      let critique: string;
      let tokenUsage: TokenUsage | undefined;

      switch (reviewer.provider) {
        case "openai":
        case "openai-compatible": {
          const client = this.getOpenAIClient(reviewer);
          if (!client) throw new Error(`API key not configured for ${reviewer.name}`);
          // GPT-5.x requires max_completion_tokens; older/compatible APIs use max_tokens
          const tokenParam = reviewer.provider === "openai" && reviewer.model.startsWith("gpt-5")
            ? { max_completion_tokens: levelConfig.maxTokens }
            : { max_tokens: levelConfig.maxTokens };
          const openaiResponse = await client.chat.completions.create({
            model: reviewer.model,
            messages: [{ role: "user", content: prompt }],
            ...tokenParam,
            temperature: levelConfig.temperature,
          });
          critique = openaiResponse.choices[0]?.message?.content || "";
          tokenUsage = {
            inputTokens: openaiResponse.usage?.prompt_tokens || 0,
            outputTokens: openaiResponse.usage?.completion_tokens || 0,
          };
          break;
        }

        case "gemini": {
          if (!this.gemini) throw new Error("Gemini API key not configured");
          const geminiModel = this.gemini.getGenerativeModel({
            model: reviewer.model,
          });
          const geminiResponse = await geminiModel.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              maxOutputTokens: levelConfig.maxTokens,
              temperature: levelConfig.temperature,
            },
          });
          critique = geminiResponse.response.text();
          tokenUsage = {
            inputTokens:
              geminiResponse.response.usageMetadata?.promptTokenCount || 0,
            outputTokens:
              geminiResponse.response.usageMetadata?.candidatesTokenCount || 0,
          };
          break;
        }

        default:
          throw new Error(`Unsupported provider: ${reviewer.provider}`);
      }

      return {
        model: reviewer.name,
        status: "success",
        critique,
        durationMs: Date.now() - startTime,
        tokenUsage,
      };
    } catch (error) {
      return {
        model: reviewer.name,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      };
    }
  }

  private async buildConsensus(
    reviews: Array<{ model: string; critique: string }>,
    levelConfig: (typeof SCRUTINY_LEVELS)[ScrutinyLevel]
  ): Promise<{
    consensus: NonNullable<CrossReviewResult["consensus"]>;
    tokenUsage?: TokenUsage;
    modelId: string;
  }> {
    const consensusPrompt = buildConsensusPrompt(reviews);

    // Pick arbitrator: reviewer with fewest HIGH-confidence claims (most cautious)
    const reviewsWithCounts = reviews.map((r) => ({
      ...r,
      highCount: countHighConfidenceClaims(r.critique),
    }));
    reviewsWithCounts.sort((a, b) => a.highCount - b.highCount);
    const arbitratorName = reviewsWithCounts[0].model;

    // Find the reviewer config for the arbitrator
    const arbitratorConfig = this.reviewers.find((r) => r.name === arbitratorName);

    try {
      let summary: string;
      let arbitrator: string;
      let tokenUsage: TokenUsage | undefined;
      let modelId: string;

      if (arbitratorConfig && (arbitratorConfig.provider === "openai" || arbitratorConfig.provider === "openai-compatible")) {
        const client = this.getOpenAIClient(arbitratorConfig);
        if (!client) {
          return {
            consensus: {
              verdict: "revise" as const,
              arbitrator: arbitratorName,
              summary: "",
              error: `Consensus failed: no API client available for arbitrator ${arbitratorName}`,
            },
            tokenUsage: undefined,
            modelId: arbitratorConfig.model,
          };
        }
        const tokenParam = arbitratorConfig.provider === "openai" && arbitratorConfig.model.startsWith("gpt-5")
          ? { max_completion_tokens: levelConfig.maxTokens }
          : { max_tokens: levelConfig.maxTokens };
        const response = await client.chat.completions.create({
          model: arbitratorConfig.model,
          messages: [{ role: "user", content: consensusPrompt }],
          ...tokenParam,
          temperature: 0.2,
        });
        summary = response.choices[0]?.message?.content || "";
        arbitrator = arbitratorConfig.name;
        modelId = arbitratorConfig.model;
        tokenUsage = {
          inputTokens: response.usage?.prompt_tokens || 0,
          outputTokens: response.usage?.completion_tokens || 0,
        };
      } else if (arbitratorConfig?.provider === "gemini" && this.gemini) {
        const model = this.gemini.getGenerativeModel({ model: arbitratorConfig.model });
        const response = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: consensusPrompt }] }],
          generationConfig: { maxOutputTokens: levelConfig.maxTokens, temperature: 0.2 },
        });
        summary = response.response.text();
        arbitrator = arbitratorConfig.name;
        modelId = arbitratorConfig.model;
        tokenUsage = {
          inputTokens: response.response.usageMetadata?.promptTokenCount || 0,
          outputTokens: response.response.usageMetadata?.candidatesTokenCount || 0,
        };
      } else {
        // Fallback: use first available openai-compatible client
        const firstClient = this.openaiClients.values().next().value;
        if (!firstClient) {
          return {
            consensus: {
              verdict: "revise" as const,
              arbitrator: "none",
              summary: "",
              error: "Consensus failed: no API clients available for arbitration",
            },
            tokenUsage: undefined,
            modelId: "unknown",
          };
        }
        const fallbackReviewer = this.reviewers[0];
        const fallbackTokenParam = fallbackReviewer.provider === "openai" && fallbackReviewer.model.startsWith("gpt-5")
          ? { max_completion_tokens: levelConfig.maxTokens }
          : { max_tokens: levelConfig.maxTokens };
        const response = await firstClient.chat.completions.create({
          model: fallbackReviewer.model,
          messages: [{ role: "user", content: consensusPrompt }],
          ...fallbackTokenParam,
          temperature: 0.2,
        });
        summary = response.choices[0]?.message?.content || "";
        arbitrator = fallbackReviewer.name;
        modelId = fallbackReviewer.model;
        tokenUsage = {
          inputTokens: response.usage?.prompt_tokens || 0,
          outputTokens: response.usage?.completion_tokens || 0,
        };
      }

      const verdict = parseVerdict(summary);

      return {
        consensus: { verdict, arbitrator, summary },
        tokenUsage,
        modelId,
      };
    } catch (error) {
      console.error("Failed to build consensus:", error);
      return {
        consensus: {
          verdict: "revise" as const,
          arbitrator: arbitratorName || "unknown",
          summary: "",
          error: `Consensus synthesis failed: ${error instanceof Error ? error.message : String(error)}`,
        },
        tokenUsage: undefined,
        modelId: arbitratorConfig?.model || "unknown",
      };
    }
  }

}
