import { z } from 'zod';
import { isCloudModel, ollamaKey, openRouterKey, type Config } from '../config.js';

export interface ModelOption {
  id: string;
  provider: 'ollama' | 'openrouter';
  label: string;
  note?: string;
}

const OllamaTagsSchema = z.object({
  models: z.array(z.object({ name: z.string(), model: z.string().optional() })).default([]),
});

/** Curated cloud/local models shown even when the daemon can't be reached. */
export const CURATED_OLLAMA: ModelOption[] = [
  { id: 'deepseek-v4.1-flash:cloud', provider: 'ollama', label: 'deepseek v4.1 flash', note: 'cloud' },
  { id: 'kimi-k2.7-code:cloud', provider: 'ollama', label: 'kimi k2.7 code', note: 'cloud' },
  { id: 'glm-5.2:cloud', provider: 'ollama', label: 'glm 5.2', note: 'cloud' },
  { id: 'minimax-m3:cloud', provider: 'ollama', label: 'minimax m3', note: 'cloud' },
  { id: 'qwen3:0.6b', provider: 'ollama', label: 'qwen3 0.6b', note: 'local' },
];

/** Popular OpenRouter models, used when a key is present but listing fails. */
export const CURATED_OPENROUTER: ModelOption[] = [
  { id: 'deepseek/deepseek-v4.1-flash', provider: 'openrouter', label: 'deepseek v4.1 flash' },
  { id: 'deepseek/deepseek-v4-pro', provider: 'openrouter', label: 'deepseek v4 pro' },
  { id: 'anthropic/claude-sonnet-4.5', provider: 'openrouter', label: 'claude sonnet 4.5' },
  { id: 'openai/gpt-4o-mini', provider: 'openrouter', label: 'gpt-4o mini' },
];

/** List models from the local Ollama daemon, falling back to a curated set. */
export async function listOllamaModels(
  host: string,
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
  apiKey?: string,
): Promise<ModelOption[]> {
  const merged = new Map<string, ModelOption>();
  for (const option of CURATED_OLLAMA) merged.set(option.id, option);
  try {
    const headers: Record<string, string> = {};
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    const res = await fetchImpl(`${host.replace(/\/$/, '')}/api/tags`, { headers, signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const parsed = OllamaTagsSchema.safeParse(await res.json());
      if (parsed.success) {
        for (const model of parsed.data.models) {
          const id = model.name;
          if (!id) continue;
          merged.set(id, {
            id,
            provider: 'ollama',
            label: id.replace(/:latest$/, ''),
            note: isCloudModel(id) ? 'cloud' : 'local',
          });
        }
      }
    }
  } catch {
    /* keep curated list */
  }
  return [...merged.values()].sort((a, b) => a.id.localeCompare(b.id));
}

const OpenRouterModelsSchema = z.object({
  data: z.array(z.object({ id: z.string(), name: z.string().optional() })).default([]),
});

/** List OpenRouter models when a key is available, else the curated set. */
export async function listOpenRouterModels(
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
  key?: string,
): Promise<ModelOption[]> {
  const merged = new Map<string, ModelOption>();
  for (const option of CURATED_OPENROUTER) merged.set(option.id, option);
  if (!key) return [...merged.values()];
  try {
    const res = await fetchImpl('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const parsed = OpenRouterModelsSchema.safeParse(await res.json());
      if (parsed.success) {
        for (const model of parsed.data.data) {
          if (!model.id) continue;
          // Keep the list focused on the models people actually pick.
          if (!/deepseek|claude|gpt-4o|gpt-4\.1|gemini|qwen|llama|grok/i.test(model.id)) continue;
          merged.set(model.id, {
            id: model.id,
            provider: 'openrouter',
            label: (model.name ?? model.id).toLowerCase(),
          });
        }
      }
    }
  } catch {
    /* keep curated list */
  }
  return [...merged.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export async function listModelsByProvider(provider: 'ollama' | 'openrouter', config: Config): Promise<ModelOption[]> {
  return provider === 'openrouter'
    ? listOpenRouterModels(globalThis.fetch, openRouterKey(config))
    : listOllamaModels(config.ollamaHost, globalThis.fetch, ollamaKey(config));
}
