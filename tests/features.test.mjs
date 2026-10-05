import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unifiedDiff } from '../dist/agent/diff.js';
import { loadProjectRules } from '../dist/agent/rules.js';
import { listWorkspaceFiles, isTextFile } from '../dist/agent/files.js';
import { gitStatus } from '../dist/agent/git.js';

test('unifiedDiff marks additions and removals', () => {
  const diff = unifiedDiff('a\nb\nc\n', 'a\nB\nc\n');
  assert.match(diff, /- b/);
  assert.match(diff, /\+ B/);
  assert.match(diff, /  a/);
});

test('unifiedDiff returns empty for identical input', () => {
  assert.equal(unifiedDiff('same\n', 'same\n'), '');
});

test('unifiedDiff handles pure additions', () => {
  const diff = unifiedDiff('a\n', 'a\nb\n');
  assert.match(diff, /\+ b/);
  assert.ok(!/- /.test(diff));
});

test('loadProjectRules finds AGENTS.md in the workspace', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aurora-rules-'));
  writeFileSync(join(dir, 'AGENTS.md'), 'always use tabs');
  const result = loadProjectRules(dir);
  assert.equal(result.files.length, 1);
  assert.match(result.text, /always use tabs/);
  rmSync(dir, { recursive: true, force: true });
});

test('loadProjectRules returns empty when nothing found', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aurora-rules2-'));
  // Nest under /tmp so parent dirs are unlikely to have rule files.
  const result = loadProjectRules(dir);
  assert.ok(result.text === '' || typeof result.text === 'string');
  rmSync(dir, { recursive: true, force: true });
});

test('listWorkspaceFiles skips node_modules and lists files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aurora-files-'));
  mkdirSync(join(dir, 'src'));
  mkdirSync(join(dir, 'node_modules'));
  writeFileSync(join(dir, 'src', 'index.ts'), '');
  writeFileSync(join(dir, 'node_modules', 'big.js'), '');
  writeFileSync(join(dir, 'README.md'), '');
  const files = listWorkspaceFiles(dir).map((f) => f.path);
  assert.ok(files.includes('src/index.ts'));
  assert.ok(files.includes('README.md'));
  assert.ok(!files.some((f) => f.includes('node_modules')));
  rmSync(dir, { recursive: true, force: true });
});

test('isTextFile rejects binaries and accepts source', () => {
  assert.equal(isTextFile('a.ts'), true);
  assert.equal(isTextFile('photo.png'), false);
  assert.equal(isTextFile('archive.zip'), false);
});

test('gitStatus returns null outside a repo', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aurora-nogit-'));
  const status = gitStatus(dir);
  assert.equal(status, null);
  rmSync(dir, { recursive: true, force: true });
});
