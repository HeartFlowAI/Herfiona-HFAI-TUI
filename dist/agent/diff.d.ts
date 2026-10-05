/**
 * A tiny LCS-based unified diff for approval previews and tool output.
 * Bounded and dependency-free; falls back to a simple line replacement when
 * inputs are too large to diff cheaply.
 */
/** Produce a compact unified diff (without @@ hunk headers). */
export declare function unifiedDiff(oldText: string, newText: string, context?: number): string;
