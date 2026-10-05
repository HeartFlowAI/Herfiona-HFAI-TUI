import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Agent } from '../dist/agent/loop.js';

function fakeAdapter(script) {
  let call = 0;
  return {
    id: 'fake',
    provider: 'ollama',
    model: 'fake',
    async locality() {
      return { local: true, detail: 'fake local' };
    },
    async *stream() {
      const step = script[Math.min(call, script.length - 1)];
      call++;
      for (const delta of step) yield delta;
    },
  };
}

test('agent streams text and finishes', async () => {
  const adapter = fakeAdapter([[{ content: 'hi ' }, { content: 'there' }, { done: true }]]);
  const agent = new Agent({
    adapter,
    workspace: process.cwd(),
    systemPrompt: 'test',
    maxTurns: 4,
    callbacks: {
      requestApproval: async () => true,
      onText: () => {},
    },
  });
  const result = await agent.send('hello');
  assert.equal(result.text, 'hi there');
  assert.equal(result.stopped, 'done');
  assert.equal(agent.messages.filter((m) => m.role === 'assistant').length, 1);
});

test('agent executes a tool then replies', async () => {
  const adapter = fakeAdapter([
    [{ toolCalls: [{ id: 'c1', name: 'fs_list', arguments: { path: '.' } }], done: true }],
    [{ content: 'listed!', done: true }],
  ]);
  const seen = [];
  const agent = new Agent({
    adapter,
    workspace: process.cwd(),
    systemPrompt: 'test',
    maxTurns: 4,
    callbacks: {
      requestApproval: async () => true,
      onToolStart: (name) => seen.push(name),
      onText: () => {},
    },
  });
  const result = await agent.send('list files');
  assert.deepEqual(seen, ['fs_list']);
  assert.equal(result.text, 'listed!');
  assert.equal(result.toolCalls[0].name, 'fs_list');
  assert.equal(agent.messages.some((m) => m.role === 'tool'), true);
});

test('agent stops at max turns', async () => {
  const adapter = fakeAdapter([[{ toolCalls: [{ id: 'c1', name: 'fs_list', arguments: {} }], done: true }]]);
  const agent = new Agent({
    adapter,
    workspace: process.cwd(),
    systemPrompt: 'test',
    maxTurns: 2,
    callbacks: { requestApproval: async () => true },
  });
  const result = await agent.send('keep going');
  assert.equal(result.stopped, 'max-turns');
  assert.equal(result.turns, 2);
});
