import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const MAX_BYTES = 16_000;
const RULE_FILES = ['AGENTS.md', 'CLAUDE.md', '.aurora/rules.md', '.opencode/AGENTS.md'];

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
export function loadProjectRules(workspace: string): RulesResult {
  const found: string[] = [];
  const seen = new Set<string>();
  let dir = resolve(workspace);
  const root = resolve('/');

  while (true) {
    for (const name of RULE_FILES) {
      const candidate = join(dir, name);
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      if (existsSync(candidate)) found.push(candidate);
    }
    if (dir === root) break;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  if (found.length === 0) return { files: [], text: '', truncated: false };

  let text = '';
  let truncated = false;
  for (const file of found) {
    try {
      if (statSync(file).size > MAX_BYTES) truncated = true;
      const content = readFileSync(file, 'utf8').slice(0, MAX_BYTES).trim();
      if (!content) continue;
      text += `\n\n# Project rules (${file})\n${content}`;
    } catch {
      /* skip unreadable */
    }
  }
  return { files: found, text: text.trim(), truncated };
}
