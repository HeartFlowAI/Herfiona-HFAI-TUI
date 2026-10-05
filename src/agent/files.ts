import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const IGNORED = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.cache', '.turbo', 'coverage', '.venv', 'venv', '__pycache__']);
const MAX_FILES = 4000;
const MAX_DEPTH = 8;

export interface FileEntry {
  /** Relative path from the workspace root, using forward slashes. */
  path: string;
}

/**
 * List workspace files for @-reference autocomplete. Read-only, bounded, and
 * skips common heavy/build directories.
 */
export function listWorkspaceFiles(root: string, limit = MAX_FILES): FileEntry[] {
  const out: FileEntry[] = [];
  const walk = (dir: string, depth: number): void => {
    if (out.length >= limit || depth > MAX_DEPTH) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (out.length >= limit) return;
      if (IGNORED.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, depth + 1);
      } else if (entry.isFile()) {
        out.push({ path: relative(root, full).split('\\').join('/') });
      }
    }
  };
  walk(root, 0);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

const BINARY_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'pdf', 'zip', 'gz', 'tar', 'mp3', 'mp4', 'mov', 'woff', 'woff2', 'ttf', 'otf', 'lock']);

/** True when a file is likely safe to inline as text. */
export function isTextFile(path: string): boolean {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return !BINARY_EXT.has(ext);
}
