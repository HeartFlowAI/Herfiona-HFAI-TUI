import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Agent } from '../dist/agent/loop.js';

/** A fake adapter that streams a chunk every `delayMs` until finished. */
function slowAdapter(chunks, delayMs = 20) {
  return {
    id: 'slow',
    provider: 'ollama',
    model: 'slow',
    async locality() {
      return { local: true, detail: 'fake' };
    },
    async *stream(_messages, _tools, signal) {
      for (const chunk of chunks) {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, delayMs);
          signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new Error('aborted'));
          }, { once: true });
        });
        yield { content: chunk };
      }
      yield { done: true };
    },
  };
}

test('aborting a turn stops the stream and reports aborted', async () => {
  const agent = new Agent({
    adapter: slowAdapter(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], 30),
    workspace: process.cwd(),
    systemPrompt: 'test',
    maxTurns: 2,
    callbacks: { requestApproval: async () => false, onText: () => {} },
  });
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 50);
  const result = await agent.send('go', controller.signal);
  assert.equal(result.stopped, 'aborted');
  assert.ok(result.text.length < 'abcdefgh'.length, 'stream stopped early');
});

test('a completed turn is not marked aborted', async () => {
  const agent = new Agent({
    adapter: slowAdapter(['hi'], 5),
    workspace: process.cwd(),
    systemPrompt: 'test',
    maxTurns: 2,
    callbacks: { requestApproval: async () => false },
  });
  const result = await agent.send('go');
  assert.equal(result.stopped, 'done');
  assert.equal(result.text, 'hi');
});

test('setSystemPrompt and dropLastTurn edit messages', async () => {
  const agent = new Agent({
    adapter: slowAdapter(['x'], 1),
    workspace: process.cwd(),
    systemPrompt: 'first',
    maxTurns: 1,
    callbacks: { requestApproval: async () => false },
  });
  agent.setSystemPrompt('second');
  assert.equal(agent.messages[0].content, 'second');
  await agent.send('hello');
  const before = agent.messages.length;
  const removed = agent.dropLastTurn();
  assert.ok(removed >= 2, 'removes user + assistant');
  assert.ok(agent.messages.length < before);
});
