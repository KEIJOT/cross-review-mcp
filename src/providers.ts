// src/providers.ts - LLM Provider implementations (v0.5)
import { ReviewerConfig } from './config';

export interface LLMResponse {
  modelId: string;
  content: string;
  inputTokens: number;
  outputTokens: number;
  finishReason: string;
  error?: string;
  executionTimeMs: number;
}

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
      const response = await fetch(\`\${this.baseUrl}/chat/completions\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${this.apiKey}\`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            ...(system ? [{ role: 'system', content: system }] : []),
            { role: 'user', content },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          modelId: this.id,
          content: '',
          inputTokens: 0,
          outputTokens: 0,
          finishReason: 'error',
          error: \`API error: \${response.status}\`,
          executionTimeMs: Date.now() - startTime,
        };
      }

      const data = await response.json();
      const message = data.choices?.[0]?.message?.content || '';

      return {
        modelId: this.id,
        content: message,
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
        finishReason: data.choices?.[0]?.finish_reason || 'stop',
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        modelId: this.id,
        content: '',
        inputTokens: 0,
        outputTokens: 0,
        finishReason: 'error',
        error: error instanceof Error ? error.message : String(error),
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
        \`https://generativelanguage.googleapis.com/v1beta/models/\${this.model}:generateContent?key=\${this.apiKey}\`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: system,
            contents: { parts: [{ text: content }] },
          }),
        }
      );

      if (!response.ok) {
        return {
          modelId: this.id,
          content: '',
          inputTokens: 0,
          outputTokens: 0,
          finishReason: 'error',
          error: \`API error: \${response.status}\`,
          executionTimeMs: Date.now() - startTime,
        };
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      return {
        modelId: this.id,
        content: text,
        inputTokens: data.usageMetadata?.promptTokenCount || 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
        finishReason: 'stop',
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        modelId: this.id,
        content: '',
        inputTokens: 0,
        outputTokens: 0,
        finishReason: 'error',
        error: error instanceof Error ? error.message : String(error),
        executionTimeMs: Date.now() - startTime,
      };
    }
  }
}

export function createProvider(config: ReviewerConfig): LLMProvider {
  let apiKey = '';

  if (config.provider === 'openai') {
    apiKey = process.env.OPENAI_API_KEY || '';
    if (!apiKey) throw new Error(\`Missing OPENAI_API_KEY for \${config.id}\`);
    return new OpenAICompatibleProvider(config, apiKey);
  } else if (config.provider === 'gemini') {
    apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey) throw new Error(\`Missing GEMINI_API_KEY for \${config.id}\`);
    return new GeminiProvider(config, apiKey);
  } else if (config.provider === 'openai-compatible') {
    apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || '';
    if (!apiKey) throw new Error(\`Missing API key for \${config.id}\`);
    return new OpenAICompatibleProvider(config, apiKey);
  }

  throw new Error(\`Unknown provider: \${config.provider}\`);
}
