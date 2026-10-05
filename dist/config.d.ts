import { z } from 'zod';
export declare const ProviderSchema: z.ZodEnum<{
    ollama: "ollama";
    openrouter: "openrouter";
}>;
export type Provider = z.infer<typeof ProviderSchema>;
export declare const ConfigSchema: z.ZodObject<{
    provider: z.ZodDefault<z.ZodEnum<{
        ollama: "ollama";
        openrouter: "openrouter";
    }>>;
    model: z.ZodDefault<z.ZodString>;
    ollamaHost: z.ZodDefault<z.ZodString>;
    ollamaApiKey: z.ZodDefault<z.ZodString>;
    openRouterApiKey: z.ZodDefault<z.ZodString>;
    workspace: z.ZodDefault<z.ZodString>;
    temperature: z.ZodDefault<z.ZodNumber>;
    persona: z.ZodDefault<z.ZodEnum<{
        playful: "playful";
        warm: "warm";
        focused: "focused";
    }>>;
    maxTurns: z.ZodDefault<z.ZodNumber>;
    autoApprove: z.ZodDefault<z.ZodBoolean>;
    showThinking: z.ZodDefault<z.ZodBoolean>;
    theme: z.ZodDefault<z.ZodString>;
}, z.core.$strip>;
export type Config = z.infer<typeof ConfigSchema>;
export declare const DEFAULT_CONFIG: Config;
export declare function configDir(): string;
export declare function configPath(): string;
export declare function sessionsDir(): string;
export declare function ensureConfigDir(): void;
export declare function loadConfig(): Config;
export declare function saveConfig(config: Config): void;
/** Effective Ollama Cloud / remote API key: env wins over the config file. */
export declare function ollamaKey(config?: Config): string | undefined;
/** Effective OpenRouter key: env wins over the config file. */
export declare function openRouterKey(config?: Config): string | undefined;
/** Mask a key for display: keep the first and last few characters. */
export declare function maskKey(key: string | undefined): string;
/** Whether a provider is ready to use, and why not if it isn't. */
export declare function providerStatus(config: Config, provider: 'ollama' | 'openrouter'): {
    ready: boolean;
    detail: string;
};
/** Ollama Cloud models end in `:cloud` or are listed under the cloud alias. */
export declare function isCloudModel(model: string): boolean;
