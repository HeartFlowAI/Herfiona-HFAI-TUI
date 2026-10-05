import { type Config } from '../config.js';
export interface ModelOption {
    id: string;
    provider: 'ollama' | 'openrouter';
    label: string;
    note?: string;
}
/** Curated cloud/local models shown even when the daemon can't be reached. */
export declare const CURATED_OLLAMA: ModelOption[];
/** Popular OpenRouter models, used when a key is present but listing fails. */
export declare const CURATED_OPENROUTER: ModelOption[];
/** List models from the local Ollama daemon, falling back to a curated set. */
export declare function listOllamaModels(host: string, fetchImpl?: typeof globalThis.fetch, apiKey?: string): Promise<ModelOption[]>;
/** List OpenRouter models when a key is available, else the curated set. */
export declare function listOpenRouterModels(fetchImpl?: typeof globalThis.fetch, key?: string): Promise<ModelOption[]>;
export declare function listModelsByProvider(provider: 'ollama' | 'openrouter', config: Config): Promise<ModelOption[]>;
