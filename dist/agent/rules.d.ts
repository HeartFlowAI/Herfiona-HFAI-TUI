export interface RulesResult {
    /** The rule files that were found and loaded. */
    files: string[];
    /** Combined rule text, or '' when nothing was found. */
    text: string;
    /** True when content was clipped to the size cap. */
    truncated: boolean;
}
/**
 * Look for project rule files starting at the workspace and walking up to the
 * filesystem root (opencode-style), plus a couple of tool-specific locations.
 * Read-only; no network.
 */
export declare function loadProjectRules(workspace: string): RulesResult;
