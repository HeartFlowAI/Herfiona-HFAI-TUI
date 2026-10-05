export interface GitStatus {
    branch: string;
    dirty: boolean;
    ahead: number;
    behind: number;
}
/**
 * Read git branch and dirty state for a workspace. Read-only: runs only
 * `rev-parse` and `status`. Returns null when the directory isn't a repo or
 * git isn't installed.
 */
export declare function gitStatus(workspace: string): GitStatus | null;
