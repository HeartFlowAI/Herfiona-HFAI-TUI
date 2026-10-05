import { OllamaAdapter } from './ollama.js';
import { OpenRouterAdapter } from './openrouter.js';
import { ollamaKey, openRouterKey, type Config } from '../config.js';
import type { ModelAdapter } from '../agent/types.js';

export async function createAdapter(config: Config, modelOverride?: string): Promise<ModelAdapter> {
  const model = modelOverride ?? config.model;
  if (config.provider === 'openrouter') {
    const key = openRouterKey(config);
    if (!key) {
      throw new Error('No OpenRouter API key. Run `aurora setup openrouter` or press ctrl+p → "set openrouter key".');
    }
    return new OpenRouterAdapter({ apiKey: key, model, temperature: config.temperature });
  }
  return new OllamaAdapter({ host: config.ollamaHost, model, temperature: config.temperature, apiKey: ollamaKey(config) });
}

export interface ConnectionTest {
  ok: boolean;
  detail: string;
  modelCount?: number;
}

/** Quick, read-only connectivity check for a provider. */
export async function testProvider(config: Config, provider: 'ollama' | 'openrouter'): Promise<ConnectionTest> {
  try {
    if (provider === 'openrouter') {
      const key = openRouterKey(config);
      if (!key) return { ok: false, detail: 'no API key set' };
      // `/key` is authenticated, so it actually validates the key.
      const authRes = await fetch('https://openrouter.ai/api/v1/key', {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(8000),
      });
      if (authRes.status === 401) return { ok: false, detail: 'key rejected (401) — check it and try again' };
      if (!authRes.ok) return { ok: false, detail: `OpenRouter returned HTTP ${authRes.status}` };
      // Count models from the public list for a friendly detail string.
      const modelsRes = await fetch('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(8000) }).catch(() => null);
      const modelCount = modelsRes?.ok ? ((await modelsRes.json()) as { data?: unknown[] }).data?.length : undefined;
      return { ok: true, detail: 'openrouter key is valid', modelCount };
    }
    const headers: Record<string, string> = {};
    const key = ollamaKey(config);
    if (key) headers.Authorization = `Bearer ${key}`;
    const res = await fetch(`${config.ollamaHost.replace(/\/$/, '')}/api/tags`, { headers, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return { ok: false, detail: `Ollama daemon returned HTTP ${res.status}` };
    const body = (await res.json()) as { models?: unknown[] };
    return { ok: true, detail: `Ollama daemon reachable at ${config.ollamaHost}`, modelCount: body.models?.length };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

export { OllamaAdapter } from './ollama.js';
export { OpenRouterAdapter } from './openrouter.js';
