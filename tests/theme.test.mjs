import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTheme, THEMES, themeNames, C } from '../dist/ui/chrome.js';
import { fetchWithRetry } from '../dist/adapters/retry.js';

test('themeNames lists all palettes', () => {
  const names = themeNames();
  assert.ok(names.includes('pink'));
  assert.ok(names.includes('sakura'));
  assert.ok(names.includes('midnight'));
  assert.equal(names.length, Object.keys(THEMES).length);
});

test('setTheme mutates the shared palette', () => {
  const original = C.pink;
  const applied = setTheme('midnight');
  assert.equal(applied, 'midnight');
  assert.notEqual(C.pink, original);
  setTheme('pink');
  assert.equal(C.pink, original);
});

test('setTheme falls back to pink for unknown names', () => {
  assert.equal(setTheme('does-not-exist'), 'pink');
});

test('fetchWithRetry retries transient failures then succeeds', async () => {
  let calls = 0;
  const fakeFetch = async () => {
    calls++;
    if (calls < 3) return { ok: false, status: 503, body: { cancel: async () => {} } };
    return { ok: true, status: 200 };
  };
  const res = await fetchWithRetry('http://x', {}, { fetchImpl: fakeFetch, baseDelayMs: 1, attempts: 5 });
  assert.equal(res.status, 200);
  assert.equal(calls, 3);
});

test('fetchWithRetry does not retry 400', async () => {
  let calls = 0;
  const fakeFetch = async () => {
    calls++;
    return { ok: false, status: 400, body: { cancel: async () => {} } };
  };
  const res = await fetchWithRetry('http://x', {}, { fetchImpl: fakeFetch, baseDelayMs: 1 });
  assert.equal(res.status, 400);
  assert.equal(calls, 1);
});

test('fetchWithRetry stops on abort', async () => {
  const controller = new AbortController();
  controller.abort();
  const fakeFetch = async () => ({ ok: true, status: 200 });
  await assert.rejects(() => fetchWithRetry('http://x', {}, { fetchImpl: fakeFetch, signal: controller.signal }));
});
