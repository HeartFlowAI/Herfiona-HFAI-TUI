import { type Config } from '../config.js';
import type { ModelAdapter } from '../agent/types.js';
export declare function createAdapter(config: Config, modelOverride?: string): Promise<ModelAdapter>;
export interface ConnectionTest {
    ok: boolean;
    detail: string;
    modelCount?: number;
}
/** Quick, read-only connectivity check for a provider. */
export declare function testProvider(config: Config, provider: 'ollama' | 'openrouter'): Promise<ConnectionTest>;
export { OllamaAdapter } from './ollama.js';
export { OpenRouterAdapter } from './openrouter.js';
