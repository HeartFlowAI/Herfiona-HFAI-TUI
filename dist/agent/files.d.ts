export interface FileEntry {
    /** Relative path from the workspace root, using forward slashes. */
    path: string;
}
/**
 * List workspace files for @-reference autocomplete. Read-only, bounded, and
 * skips common heavy/build directories.
 */
export declare function listWorkspaceFiles(root: string, limit?: number): FileEntry[];
/** True when a file is likely safe to inline as text. */
export declare function isTextFile(path: string): boolean;
