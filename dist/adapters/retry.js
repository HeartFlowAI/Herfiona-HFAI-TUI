const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
export async function fetchWithRetry(url, init, options = {}) {
    const attempts = options.attempts ?? 3;
    const baseDelay = options.baseDelayMs ?? 400;
    const doFetch = options.fetchImpl ?? globalThis.fetch;
    let lastError;
    for (let attempt = 0; attempt < attempts; attempt++) {
        if (options.signal?.aborted)
            throw new Error('aborted');
        try {
            const response = await doFetch(url, init);
            if (response.ok || !RETRYABLE_STATUS.has(response.status) || attempt === attempts - 1) {
                return response;
            }
            lastError = new Error(`HTTP ${response.status}`);
            await response.body?.cancel().catch(() => undefined);
        }
        catch (error) {
            if (options.signal?.aborted)
                throw error;
            lastError = error;
            if (attempt === attempts - 1)
                throw error;
        }
        options.onRetry?.(attempt + 1, lastError);
        await delay(baseDelay * 2 ** attempt, options.signal);
    }
    throw lastError instanceof Error ? lastError : new Error('request failed');
}
function delay(ms, signal) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, ms);
        signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new Error('aborted'));
        }, { once: true });
    });
}
//# sourceMappingURL=retry.js.map