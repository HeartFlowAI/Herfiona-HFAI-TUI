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
export declare function fetchWithRetry(url: string | URL, init: RequestInit, options?: RetryOptions): Promise<Response>;
