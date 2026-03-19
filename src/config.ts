// src/config.ts - Configuration loading and validation (v0.6.0)
import * as fs from 'fs';
import { z } from 'zod';

export const ReviewerConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  provider: z.enum(['openai', 'gemini', 'openai-compatible']),
  model: z.string().min(1),
  timeout_ms: z.number().int().min(1000).default(60000),
  slack_time_ms: z.number().int().min(0).default(0),
  execution_order: z.number().int().min(1).default(1),
  baseUrl: z.string().optional(),
  apiKeyEnv: z.string().optional(),  // Override default ${ID}_API_KEY env var name
});

export type ReviewerConfig = z.infer<typeof ReviewerConfigSchema>;

const ConfigSchema = z.object({
  reviewers: z.array(ReviewerConfigSchema).min(1),
  execution: z.object({
    strategy: z.enum(['wait_all', 'fastest_2', 'wait_max_30s']).default('wait_all'),
    allow_partial_results: z.boolean().default(true),
  }).optional().default({}),
  costs: z.object({
    models: z.record(z.object({
      input_per_1m: z.number(),
      output_per_1m: z.number(),
    })).default({}),
  }).optional().default({}),
  tracking: z.object({
    enabled: z.boolean().default(true),
    log_file: z.string().default('./llmapi_usage.json'),
  }).optional().default({}),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(configPath: string = './llmapi.config.json'): Config {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }
  const jsonContent = fs.readFileSync(configPath, 'utf-8');
  const parsed = JSON.parse(jsonContent);
  return ConfigSchema.parse(parsed);
}

export function validateConfig(config: unknown) {
  try {
    ConfigSchema.parse(config);
    return { valid: true, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, errors: error.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`) };
    }
    return { valid: false, errors: [String(error)] };
  }
}
