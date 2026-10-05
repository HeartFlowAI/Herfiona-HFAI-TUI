/**
 * Approximate token accounting and context-window tracking.
 *
 * Exact tokenizers are provider-specific and not always available locally, so
 * counts are estimates from character lengths. They are labelled as estimates
 * in the UI and never presented as billing-grade numbers.
 */
/** Rough token estimate: ~4 chars/token for English, with punctuation overhead. */
export function estimateTokens(text) {
    if (!text)
        return 0;
    const chars = text.length;
    const words = text.split(/\s+/).filter(Boolean).length;
    // Blend char-based and word-based estimates; code skews char-heavy.
    return Math.max(1, Math.round(chars / 4 + words / 6));
}
/** Common context windows; overridden by a provider when known. */
const CONTEXT_WINDOWS = [
    [/qwen3|qwen2\.5/i, 32768],
    [/qwen3-coder/i, 262144],
    [/llama3\.3|llama3\.2/i, 131072],
    [/gpt-oss:120b/i, 131072],
    [/gpt-4o|gpt-4\.1/i, 128000],
    [/glm/i, 200000],
    [/kimi/i, 256000],
    [/minimax/i, 1000000],
    [/deepseek-v4\.1/i, 1048576],
    [/deepseek/i, 128000],
    [/claude/i, 200000],
];
export function contextWindow(model, provider) {
    for (const [pattern, size] of CONTEXT_WINDOWS) {
        if (pattern.test(model))
            return size;
    }
    return provider === 'openrouter' ? 128000 : 8192;
}
export function formatTokens(n) {
    const trim = (v) => {
        const rounded = Math.round(v * 10) / 10;
        return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    };
    if (n >= 1_000_000)
        return `${trim(n / 1_000_000)}M`;
    if (n >= 1_000)
        return `${trim(n / 1_000)}k`;
    return String(n);
}
/** A compact progress bar for context usage. */
export function contextBar(percent, width) {
    const filled = Math.max(0, Math.min(width, Math.round((percent / 100) * width)));
    return '\u2588'.repeat(filled) + '\u2591'.repeat(Math.max(0, width - filled));
}
//# sourceMappingURL=usage.js.map