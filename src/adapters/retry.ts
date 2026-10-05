/**
 * Retry a fetch-like request on transient network failures only.
 * Returns the Response, or throws the last error. Streams are not retried
 * mid-body; this covers connection/DNS/5xx-before-body failures.
 */
export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  signal?: AbortSignal;
  fetchImpl?: typeof globalThis.fetch;
  onRetry?: (attempt: number, error: unknown) => void;
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export async function fetchWithRetry(
  url: string | URL,
  init: RequestInit,
  options: RetryOptions = {},
): Promise<Response> {
  const attempts = options.attempts ?? 3;
  const baseDelay = options.baseDelayMs ?? 400;
  const doFetch = options.fetchImpl ?? globalThis.fetch;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (options.signal?.aborted) throw new Error('aborted');
    try {
      const response = await doFetch(url, init);
      if (response.ok || !RETRYABLE_STATUS.has(response.status) || attempt === attempts - 1) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status}`);
      await response.body?.cancel().catch(() => undefined);
    } catch (error) {
      if (options.signal?.aborted) throw error;
      lastError = error;
      if (attempt === attempts - 1) throw error;
    }
    options.onRetry?.(attempt + 1, lastError);
    await delay(baseDelay * 2 ** attempt, options.signal);
  }
  throw lastError instanceof Error ? lastError : new Error('request failed');
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new Error('aborted'));
    }, { once: true });
  });
}
