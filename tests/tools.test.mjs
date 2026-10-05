import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { confine, isInside, displayPath } from '../dist/agent/workspace.js';
import { allTools, findTool } from '../dist/agent/tools.js';

function makeWorkspace() {
  const dir = mkdtempSync(join(tmpdir(), 'aurora-ws-'));
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src', 'hello.txt'), 'hello world\nsecond line\n');
  return dir;
}

test('isInside accepts descendants and the root', () => {
  assert.equal(isInside('/a/b', '/a/b'), true);
  assert.equal(isInside('/a/b', '/a/b/c'), true);
  assert.equal(isInside('/a/b', '/a/bc'), false);
  assert.equal(isInside('/a/b', '/a'), false);
});

test('confine refuses path traversal', () => {
  const ws = makeWorkspace();
  assert.throws(() => confine(ws, '../outside.txt'));
  assert.throws(() => confine(ws, '/etc/passwd'));
  rmSync(ws, { recursive: true, force: true });
});

test('confine allows normal paths and displayPath is relative', () => {
  const ws = makeWorkspace();
  const resolved = confine(ws, 'src/hello.txt');
  assert.equal(displayPath(ws, resolved), join('src', 'hello.txt'));
  rmSync(ws, { recursive: true, force: true });
});

test('fs_read returns numbered lines', async () => {
  const ws = makeWorkspace();
  const tool = findTool(allTools(), 'fs_read');
  const result = await tool.invoke({ path: 'src/hello.txt' }, { workspace: ws, requestApproval: async () => true });
  assert.match(result, /1: hello world/);
  assert.match(result, /2: second line/);
  rmSync(ws, { recursive: true, force: true });
});

test('fs_write requires approval and writes', async () => {
  const ws = makeWorkspace();
  const tool = findTool(allTools(), 'fs_write');
  let asked = null;
  const denied = await tool.invoke(
    { path: 'src/new.txt', content: 'data' },
    { workspace: ws, requestApproval: async (request) => { asked = request; return false; } },
  );
  assert.match(denied, /Declined/);
  assert.equal(asked.kind, 'write');

  const approved = await tool.invoke(
    { path: 'src/new.txt', content: 'data' },
    { workspace: ws, requestApproval: async () => true },
  );
  assert.match(approved, /Wrote/);
  const read = await findTool(allTools(), 'fs_read').invoke(
    { path: 'src/new.txt' },
    { workspace: ws, requestApproval: async () => true },
  );
  assert.match(read, /data/);
  rmSync(ws, { recursive: true, force: true });
});

test('fs_edit replaces unique text and refuses ambiguous text', async () => {
  const ws = makeWorkspace();
  const tool = findTool(allTools(), 'fs_edit');
  const ok = await tool.invoke(
    { path: 'src/hello.txt', oldString: 'hello world', newString: 'hi aurora' },
    { workspace: ws, requestApproval: async () => true },
  );
  assert.match(ok, /Edited/);
  const ambiguous = await tool.invoke(
    { path: 'src/hello.txt', oldString: 'i', newString: 'x' },
    { workspace: ws, requestApproval: async () => true },
  );
  assert.match(ambiguous, /matches/);
  rmSync(ws, { recursive: true, force: true });
});

test('fs_write refuses to escape the workspace even when approved', async () => {
  const ws = makeWorkspace();
  const tool = findTool(allTools(), 'fs_write');
  const result = await tool.invoke(
    { path: '../escape.txt', content: 'nope' },
    { workspace: ws, requestApproval: async () => true },
  );
  assert.match(result, /Refused/);
  rmSync(ws, { recursive: true, force: true });
});
