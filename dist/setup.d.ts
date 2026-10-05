import { type Config } from './config.js';
export interface KeyPatch {
    ollamaApiKey?: string;
    openRouterApiKey?: string;
}
/** Apply a key patch, persist it (0600), and return the updated config. */
export declare function applyKeys(patch: KeyPatch): Config;
/** A one-line status summary for both providers. */
export declare function keysSummary(config?: Config): string[];
/**
 * Interactive setup wizard. Prompts for provider keys, validates them live,
 * and writes the config (0600). Keys are never echoed back in full.
 *
 * Works both interactively (TTY) and with piped input; on EOF remaining
 * prompts are treated as "skip".
 */
export declare function runSetup(args?: string[]): Promise<number>;
