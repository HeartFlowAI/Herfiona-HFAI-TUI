import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { contextBar, contextWindow, estimateTokens, formatTokens } from '../dist/agent/usage.js';
import { detectLsps } from '../dist/agent/lsp.js';

test('estimateTokens grows with length and is never zero for text', () => {
  assert.equal(estimateTokens(''), 0);
  assert.ok(estimateTokens('hello world') > 0);
  assert.ok(estimateTokens('hello world '.repeat(50)) > estimateTokens('hello world'));
});

test('formatTokens uses k and M suffixes', () => {
  assert.equal(formatTokens(523), '523');
  assert.equal(formatTokens(1500), '1.5k');
  assert.equal(formatTokens(2_500_000), '2.5M');
});

test('contextWindow knows common models', () => {
  assert.equal(contextWindow('qwen3:0.6b', 'ollama'), 32768);
  assert.equal(contextWindow('openai/gpt-4o-mini', 'openrouter'), 128000);
  assert.equal(contextWindow('unknown-model', 'ollama'), 8192);
});

test('contextBar fills proportionally', () => {
  assert.equal(contextBar(0, 10), '\u2591'.repeat(10));
  assert.equal(contextBar(100, 10), '\u2588'.repeat(10));
  assert.equal(contextBar(50, 10), '\u2588'.repeat(5) + '\u2591'.repeat(5));
});

test('detectLsps finds typescript in a node project', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aurora-lsp-'));
  writeFileSync(join(dir, 'package.json'), '{}');
  const lsps = detectLsps(dir);
  assert.equal(lsps.some((l) => l.name === 'typescript'), true);
  assert.equal(lsps.some((l) => l.name === 'javascript'), false, 'typescript supersedes javascript');
  rmSync(dir, { recursive: true, force: true });
});

test('detectLsps finds rust and python markers', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aurora-lsp2-'));
  writeFileSync(join(dir, 'Cargo.toml'), '');
  writeFileSync(join(dir, 'pyproject.toml'), '');
  const names = detectLsps(dir).map((l) => l.name).sort();
  assert.deepEqual(names, ['python', 'rust']);
  rmSync(dir, { recursive: true, force: true });
});
