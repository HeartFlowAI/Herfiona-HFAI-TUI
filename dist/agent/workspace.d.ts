/** True when `candidate` is the root itself or a descendant of it. */
export declare function isInside(root: string, candidate: string): boolean;
export declare class WorkspaceBoundaryError extends Error {
    constructor(message: string);
}
/**
 * Resolve a user/model supplied path inside the workspace, refusing escapes.
 * Symlinked components are resolved so a link cannot point outside the root.
 */
export declare function confine(workspace: string, target: string): string;
export declare function displayPath(workspace: string, target: string): string;
