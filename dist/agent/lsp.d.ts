export interface LspInfo {
    /** Display name, e.g. "typescript". */
    name: string;
    /** The marker file that enabled it. */
    marker: string;
    /** Whether the language server binary is on PATH. */
    installed: boolean;
    /** Command to run, when known. */
    command: string;
}
/** Detect language servers that apply to a workspace. Read-only; no network. */
export declare function detectLsps(workspace: string): LspInfo[];
