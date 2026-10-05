import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

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

interface LspRule {
  name: string;
  markers: string[];
  command: string;
}

const RULES: LspRule[] = [
  { name: 'typescript', markers: ['tsconfig.json', 'package.json'], command: 'typescript-language-server' },
  { name: 'javascript', markers: ['package.json', 'jsconfig.json'], command: 'typescript-language-server' },
  { name: 'python', markers: ['pyproject.toml', 'requirements.txt', 'setup.py'], command: 'pyright-langserver' },
  { name: 'rust', markers: ['Cargo.toml'], command: 'rust-analyzer' },
  { name: 'go', markers: ['go.mod'], command: 'gopls' },
  { name: 'ruby', markers: ['Gemfile'], command: 'solargraph' },
  { name: 'elixir', markers: ['mix.exs'], command: 'elixir-ls' },
  { name: 'java', markers: ['pom.xml', 'build.gradle'], command: 'jdtls' },
  { name: 'c/cpp', markers: ['compile_commands.json', 'CMakeLists.txt'], command: 'clangd' },
  { name: 'lua', markers: ['.luarc.json', 'stylua.toml'], command: 'lua-language-server' },
  { name: 'php', markers: ['composer.json'], command: 'intelephense' },
];

function onPath(command: string, workspace?: string): boolean {
  if (workspace && existsSync(join(workspace, 'node_modules', '.bin', command))) return true;
  const dirs = (process.env.PATH ?? '').split(':').filter(Boolean);
  for (const dir of dirs) {
    if (existsSync(join(dir, command))) return true;
  }
  // Also check common global prefix for npm/pip installs.
  for (const guess of ['/opt/homebrew/bin', '/usr/local/bin', `${process.env.HOME}/.local/bin`]) {
    if (existsSync(join(guess, command))) return true;
  }
  return false;
}

/** Detect language servers that apply to a workspace. Read-only; no network. */
export function detectLsps(workspace: string): LspInfo[] {
  let entries: string[] = [];
  try {
    entries = readdirSync(workspace);
  } catch {
    return [];
  }
  const present = new Set(entries);
  const found: LspInfo[] = [];
  const seen = new Set<string>();
  for (const rule of RULES) {
    const marker = rule.markers.find((m) => present.has(m));
    if (!marker || seen.has(rule.name)) continue;
    // TypeScript covers JavaScript; don't list both.
    if (rule.name === 'javascript' && seen.has('typescript')) continue;
    seen.add(rule.name);
    found.push({ name: rule.name, marker, installed: onPath(rule.command, workspace), command: rule.command });
  }
  return found;
}
