import { isAbsolute, relative, resolve, sep } from 'node:path';
import { realpathSync } from 'node:fs';

/** True when `candidate` is the root itself or a descendant of it. */
export function isInside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

export class WorkspaceBoundaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkspaceBoundaryError';
  }
}

/**
 * Resolve a user/model supplied path inside the workspace, refusing escapes.
 * Symlinked components are resolved so a link cannot point outside the root.
 */
export function confine(workspace: string, target: string): string {
  const root = realpathSync(workspace);
  const resolved = resolve(root, target);
  if (!isInside(root, resolved)) {
    throw new WorkspaceBoundaryError(`Path "${target}" is outside the workspace.`);
  }
  let cursor = root;
  for (const part of relative(root, resolved).split(sep).filter(Boolean)) {
    cursor = resolve(cursor, part);
    try {
      const real = realpathSync(cursor);
      if (!isInside(root, real)) {
        throw new WorkspaceBoundaryError(`Path "${target}" escapes the workspace through a symlink.`);
      }
    } catch (error) {
      if (error instanceof WorkspaceBoundaryError) throw error;
      // Path does not exist yet (e.g. a new file): remaining components are safe.
      break;
    }
  }
  return resolved;
}

export function displayPath(workspace: string, target: string): string {
  let root = workspace;
  try {
    root = realpathSync(workspace);
  } catch {
    /* keep the provided path */
  }
  const rel = relative(root, target);
  return rel === '' ? '.' : rel;
}
