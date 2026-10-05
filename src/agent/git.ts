import { execFileSync } from 'node:child_process';

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
export function gitStatus(workspace: string): GitStatus | null {
  const run = (args: string[]): string => execFileSync('git', args, { cwd: workspace, stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000 }).toString().trim();
  try {
    const branch = run(['rev-parse', '--abbrev-ref', 'HEAD']) || 'HEAD';
    const porcelain = run(['status', '--porcelain']);
    let ahead = 0;
    let behind = 0;
    try {
      const counts = run(['rev-list', '--left-right', '--count', '@{upstream}...HEAD']).split(/\s+/);
      behind = Number(counts[0] ?? 0) || 0;
      ahead = Number(counts[1] ?? 0) || 0;
    } catch {
      /* no upstream configured */
    }
    return { branch, dirty: porcelain.length > 0, ahead, behind };
  } catch {
    return null;
  }
}
