/**
 * Approximate token accounting and context-window tracking.
 *
 * Exact tokenizers are provider-specific and not always available locally, so
 * counts are estimates from character lengths. They are labelled as estimates
 * in the UI and never presented as billing-grade numbers.
 */
/** Rough token estimate: ~4 chars/token for English, with punctuation overhead. */
export declare function estimateTokens(text: string): number;
export interface UsageSnapshot {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    contextUsed: number;
    contextMax: number;
    contextPercent: number;
    lastOutputTokens: number;
    turns: number;
}
export interface ModelContext {
    /** Context window in tokens, if the provider declared one. */
    max: number;
    /** Human-readable model name. */
    label: string;
}
export declare function contextWindow(model: string, provider: 'ollama' | 'openrouter'): number;
export declare function formatTokens(n: number): string;
/** A compact progress bar for context usage. */
export declare function contextBar(percent: number, width: number): string;
