// src/providers.ts - LLM Provider implementations (v0.6.0)
import { ReviewerConfig } from './config.js';
import { LLMResponse } from './types.js';

export interface LLMProvider {
  sendRequest(content: string, system?: string): Promise<LLMResponse>;
}

export class OpenAICompatibleProvider implements LLMProvider {
  id: string;
  name: string;
  private model: string;
  private apiKey: string;
  private baseUrl: string;

  constructor(config: ReviewerConfig, apiKey: string) {
    this.id = config.id;
    this.name = config.name || config.id;
    this.model = config.model;
    this.apiKey = apiKey;
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
  }

  async sendRequest(content: string, system?: string): Promise<LLMResponse> {
    const startTime = Date.now();
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            ...(system ? [{ role: 'system', content: system }] : []),
            { role: 'user', content },
          ],
          temperature: 0.7,
          max_completion_tokens: 2000,
        }),
      });

      const data = await response.json() as any;
      const executionTimeMs = Date.now() - startTime;

      if (!response.ok) {
        return {
          modelId: this.id,
          content: '',
          inputTokens: 0,
          outputTokens: 0,
          finishReason: 'error',
          error: data.error?.message || 'Unknown API error',
          executionTimeMs,
        };
      }

      const choice = data.choices[0];
      return {
        modelId: this.id,
        content: choice.message.content,
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
        finishReason: 'stop',
        executionTimeMs,
      };
    } catch (error) {
      return {
        modelId: this.id,
        content: '',
        inputTokens: 0,
        outputTokens: 0,
        finishReason: 'error',
        error: String(error),
        executionTimeMs: Date.now() - startTime,
      };
    }
  }
}

export class GeminiProvider implements LLMProvider {
  id: string;
  name: string;
  private model: string;
  private apiKey: string;

  constructor(config: ReviewerConfig, apiKey: string) {
    this.id = config.id;
    this.name = config.name || config.id;
    this.model = config.model;
    this.apiKey = apiKey;
  }

  async sendRequest(content: string, system?: string): Promise<LLMResponse> {
    const startTime = Date.now();
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...(system ? { system_instruction: system } : {}),
            contents: [{ parts: [{ text: content }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 2000,
            },
          }),
        }
      );

      const data = await response.json() as any;
      const executionTimeMs = Date.now() - startTime;

      if (!response.ok) {
        return {
          modelId: this.id,
          content: '',
          inputTokens: 0,
          outputTokens: 0,
          finishReason: 'error',
          error: data.error?.message || 'Gemini API error',
          executionTimeMs,
        };
      }

      const part = data.candidates[0].content.parts[0];
      const usage = data.usageMetadata;
      return {
        modelId: this.id,
        content: part.text,
        inputTokens: usage.promptTokenCount,
        outputTokens: usage.candidatesTokenCount,
        finishReason: 'stop',
        executionTimeMs,
      };
    } catch (error) {
      return {
        modelId: this.id,
        content: '',
        inputTokens: 0,
        outputTokens: 0,
        finishReason: 'error',
        error: String(error),
        executionTimeMs: Date.now() - startTime,
      };
    }
  }
}

export function createProvider(config: ReviewerConfig, apiKey: string): LLMProvider {
  switch (config.provider) {
    case 'openai':
    case 'openai-compatible':
      return new OpenAICompatibleProvider(config, apiKey);
    case 'gemini':
      return new GeminiProvider(config, apiKey);
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}
