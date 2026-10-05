import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fuzzyScore, filterPalette } from '../dist/ui/palette.js';
import { listOllamaModels } from '../dist/agent/models.js';

const items = [
  { id: 'cmd:model', label: 'switch model', group: 'model' },
  { id: 'cmd:provider', label: 'switch provider', group: 'model' },
  { id: 'cmd:persona', label: 'change persona', group: 'style' },
  { id: 'cmd:temperature', label: 'change temperature', group: 'style' },
  { id: 'cmd:clear', label: 'new conversation', group: 'session' },
];

test('fuzzyScore matches subsequences and rejects non-matches', () => {
  assert.ok(fuzzyScore('', 'anything') > 0);
  assert.ok(fuzzyScore('mod', 'switch model') > 0);
  assert.ok(fuzzyScore('mdl', 'switch model') > 0, 'subsequence');
  assert.equal(fuzzyScore('xyz', 'switch model'), -1);
});

test('fuzzyScore prefers tighter matches', () => {
  assert.ok(fuzzyScore('model', 'model') > fuzzyScore('model', 'switch model later'));
});

test('filterPalette returns all items for an empty query', () => {
  assert.equal(filterPalette(items, '').length, items.length);
  assert.equal(filterPalette(items, '   ').length, items.length);
});

test('filterPalette narrows by query', () => {
  const result = filterPalette(items, 'persona');
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'cmd:persona');
});

test('filterPalette matches on id and hint too', () => {
  const withHint = [{ id: 'model:qwen3', label: 'qwen3', hint: 'local model' }];
  assert.equal(filterPalette(withHint, 'qwen3').length, 1);
});

test('listOllamaModels parses a daemon response', async () => {
  const fakeFetch = async () => ({
    ok: true,
    json: async () => ({ models: [{ name: 'qwen3:0.6b' }, { name: 'glm-5.2:cloud' }] }),
  });
  const models = await listOllamaModels('http://127.0.0.1:11434', fakeFetch);
  assert.ok(models.some((m) => m.id === 'qwen3:0.6b'));
  const cloud = models.find((m) => m.id === 'glm-5.2:cloud');
  assert.equal(cloud?.note, 'cloud');
});

test('listOllamaModels falls back to curated models when the daemon fails', async () => {
  const failing = async () => {
    throw new Error('unreachable');
  };
  const models = await listOllamaModels('http://127.0.0.1:11434', failing);
  assert.ok(models.length > 0);
  assert.ok(models.some((m) => m.id === 'deepseek-v4.1-flash:cloud'));
});
