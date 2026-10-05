import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigSchema, maskKey, providerStatus, isCloudModel, saveConfig } from '../dist/config.js';

test('maskKey hides the middle of a key', () => {
  assert.equal(maskKey(undefined), 'not set');
  assert.equal(maskKey(''), 'not set');
  assert.equal(maskKey('short'), '****');
  assert.match(maskKey('sk-or-v1-1234567890abcdef'), /^sk-o…cdef$/);
});

test('isCloudModel detects cloud tags', () => {
  assert.equal(isCloudModel('deepseek-v4.1-flash:cloud'), true);
  assert.equal(isCloudModel('qwen3:0.6b'), false);
});

test('providerStatus reports missing keys', () => {
  const base = ConfigSchema.parse({});
  const or = providerStatus(base, 'openrouter');
  assert.equal(or.ready, false);
  assert.match(or.detail, /OpenRouter API key/);
});

test('providerStatus is ready when a key is present', () => {
  const config = { ...ConfigSchema.parse({}), openRouterApiKey: 'sk-or-v1-abcdef123456' };
  const or = providerStatus(config, 'openrouter');
  assert.equal(or.ready, true);
  assert.match(or.detail, /sk-o/);
});

test('cloud ollama needs a key but local does not', () => {
  const cloud = { ...ConfigSchema.parse({ model: 'deepseek-v4.1-flash:cloud' }) };
  assert.equal(providerStatus(cloud, 'ollama').ready, false);
  const local = { ...ConfigSchema.parse({ model: 'qwen3:0.6b' }) };
  assert.equal(providerStatus(local, 'ollama').ready, true);
});

test('config file is written with 0600 permissions', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aurora-perm-'));
  process.env.AURORA_HOME = dir;
  saveConfig(ConfigSchema.parse({ openRouterApiKey: 'secret' }));
  const mode = statSync(join(dir, 'config.json')).mode & 0o777;
  delete process.env.AURORA_HOME;
  assert.equal(mode, 0o600);
  rmSync(dir, { recursive: true, force: true });
});
