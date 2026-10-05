import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';

export const ProviderSchema = z.enum(['ollama', 'openrouter']);
export type Provider = z.infer<typeof ProviderSchema>;

export const ConfigSchema = z.object({
  provider: ProviderSchema.default('ollama'),
  model: z.string().default('deepseek-v4.1-flash:cloud'),
  ollamaHost: z.string().default('http://127.0.0.1:11434'),
  ollamaApiKey: z.string().default(''),
  openRouterApiKey: z.string().default(''),
  workspace: z.string().default(process.cwd()),
  temperature: z.number().min(0).max(2).default(0.7),
  persona: z.enum(['playful', 'warm', 'focused']).default('playful'),
  maxTurns: z.number().int().positive().default(12),
  autoApprove: z.boolean().default(false),
  showThinking: z.boolean().default(false),
  theme: z.string().default('pink'),
});
export type Config = z.infer<typeof ConfigSchema>;

export const DEFAULT_CONFIG: Config = ConfigSchema.parse({});

export function configDir(): string {
  return process.env.AURORA_HOME ?? join(homedir(), '.aurora');
}

export function configPath(): string {
  return join(configDir(), 'config.json');
}

export function sessionsDir(): string {
  return join(configDir(), 'sessions');
}

export function ensureConfigDir(): void {
  const dir = configDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const sessions = sessionsDir();
  if (!existsSync(sessions)) mkdirSync(sessions, { recursive: true });
}

export function loadConfig(): Config {
  ensureConfigDir();
  const path = configPath();
  let fromFile: unknown = {};
  if (existsSync(path)) {
    try {
      fromFile = JSON.parse(readFileSync(path, 'utf8'));
    } catch {
      fromFile = {};
    }
  }
  const merged = {
    ...(fromFile as Record<string, unknown>),
    workspace: process.env.AURORA_WORKSPACE ?? (fromFile as Record<string, unknown>).workspace ?? process.cwd(),
    ollamaHost: process.env.OLLAMA_HOST ?? (fromFile as Record<string, unknown>).ollamaHost,
  };
  const parsed = ConfigSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_CONFIG;
}

export function saveConfig(config: Config): void {
  ensureConfigDir();
  const path = configPath();
  writeFileSync(path, JSON.stringify(config, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
}

/** Effective Ollama Cloud / remote API key: env wins over the config file. */
export function ollamaKey(config?: Config): string | undefined {
  return (
    process.env.OLLAMA_API_KEY ??
    process.env.AURORA_OLLAMA_KEY ??
    (config?.ollamaApiKey ? config.ollamaApiKey : undefined)
  );
}

/** Effective OpenRouter key: env wins over the config file. */
export function openRouterKey(config?: Config): string | undefined {
  return (
    process.env.OPENROUTER_API_KEY ??
    process.env.AURORA_OPENROUTER_KEY ??
    (config?.openRouterApiKey ? config.openRouterApiKey : undefined)
  );
}

/** Mask a key for display: keep the first and last few characters. */
export function maskKey(key: string | undefined): string {
  if (!key) return 'not set';
  if (key.length <= 8) return '****';
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

/** Whether a provider is ready to use, and why not if it isn't. */
export function providerStatus(config: Config, provider: 'ollama' | 'openrouter'): { ready: boolean; detail: string } {
  if (provider === 'openrouter') {
    const key = openRouterKey(config);
    return key ? { ready: true, detail: `key ${maskKey(key)}` } : { ready: false, detail: 'needs an OpenRouter API key' };
  }
  const cloud = isCloudModel(config.model);
  if (cloud) {
    const key = ollamaKey(config);
    return key ? { ready: true, detail: `cloud key ${maskKey(key)}` } : { ready: false, detail: 'cloud models need an Ollama API key (or run a local model)' };
  }
  return { ready: true, detail: `daemon at ${config.ollamaHost}` };
}

/** Ollama Cloud models end in `:cloud` or are listed under the cloud alias. */
export function isCloudModel(model: string): boolean {
  return /:cloud$/i.test(model) || /cloud$/i.test(model);
}
