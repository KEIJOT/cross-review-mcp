// Quick key validation (v0.4.0, 2026-02-22)
import 'dotenv/config';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

const tests = [];

// Test OpenAI
async function testOpenAI() {
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const r = await client.chat.completions.create({
      model: 'gpt-5.2',
      messages: [{ role: 'user', content: 'Say OK' }],
      max_completion_tokens: 5
    });
    console.log('✓ OpenAI GPT-5.2:', r.choices[0]?.message?.content);
  } catch (e) {
    console.log('✗ OpenAI GPT-5.2:', e.message?.substring(0, 120));
  }
}

// Test Gemini
async function testGemini() {
  try {
    const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genai.getGenerativeModel({ model: 'gemini-3-flash-preview' });
    const r = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: 'Say OK' }] }] });
    console.log('✓ Gemini 3 Flash:', r.response.text().trim());
  } catch (e) {
    console.log('✗ Gemini 3 Flash:', e.message?.substring(0, 120));
  }
}

// Test DeepSeek
async function testDeepSeek() {
  try {
    const client = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com' });
    const r = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: 'Say OK' }],
      max_tokens: 5
    });
    console.log('✓ DeepSeek V3:', r.choices[0]?.message?.content);
  } catch (e) {
    console.log('✗ DeepSeek V3:', e.message?.substring(0, 120));
  }
}

// Test Mistral
async function testMistral() {
  try {
    const client = new OpenAI({ apiKey: process.env.MISTRAL_API_KEY, baseURL: 'https://api.mistral.ai/v1' });
    const r = await client.chat.completions.create({
      model: 'mistral-large-latest',
      messages: [{ role: 'user', content: 'Say OK' }],
      max_tokens: 5
    });
    console.log('✓ Mistral Large:', r.choices[0]?.message?.content);
  } catch (e) {
    console.log('✗ Mistral Large:', e.message?.substring(0, 120));
  }
}

// Test OpenRouter (Llama free)
async function testOpenRouter() {
  try {
    const client = new OpenAI({ apiKey: process.env.OPENROUTER_API_KEY, baseURL: 'https://openrouter.ai/api/v1' });
    const r = await client.chat.completions.create({
      model: 'meta-llama/llama-3.3-70b-instruct:free',
      messages: [{ role: 'user', content: 'Say OK' }],
      max_tokens: 5
    });
    console.log('✓ OpenRouter Llama:', r.choices[0]?.message?.content);
  } catch (e) {
    console.log('✗ OpenRouter Llama:', e.message?.substring(0, 120));
  }
}

console.log('Testing all API keys...\n');
Promise.all([testOpenAI(), testGemini(), testDeepSeek(), testMistral(), testOpenRouter()])
  .then(() => console.log('\nDone.'));
