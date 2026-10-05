import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modeTools, MODES, modePrompt, cycleMode } from '../dist/agent/modes.js';
import { allTools } from '../dist/agent/tools.js';
import { stripEmoji, lowercaseProse, styleReply } from '../dist/agent/text.js';

test('build mode has write tools, plan mode does not', () => {
  const build = modeTools('build', allTools()).map((t) => t.definition.name);
  const plan = modeTools('plan', allTools()).map((t) => t.definition.name);
  assert.ok(build.includes('fs_write'));
  assert.ok(build.includes('fs_edit'));
  assert.ok(build.includes('shell_exec'));
  assert.ok(!plan.includes('fs_write'));
  assert.ok(!plan.includes('fs_edit'));
  assert.ok(!plan.includes('shell_exec'));
  assert.deepEqual(plan, ['fs_read', 'fs_list']);
});

test('plan mode prompt says read-only', () => {
  assert.match(modePrompt('plan'), /PLAN mode/);
  assert.match(modePrompt('build'), /BUILD mode/);
});

test('cycleMode toggles', () => {
  assert.equal(cycleMode('build'), 'plan');
  assert.equal(cycleMode('plan'), 'build');
});

test('MODES metadata is consistent', () => {
  assert.equal(MODES.build.mutates, true);
  assert.equal(MODES.plan.mutates, false);
});

test('stripEmoji removes emoji and decorative symbols', () => {
  assert.equal(stripEmoji('Hi there! \u2728'), 'Hi there!');
  assert.equal(stripEmoji('Ready \u{1F44D} to go'), 'Ready to go');
  assert.equal(stripEmoji('a \u2665 b'), 'a b');
  assert.equal(stripEmoji('plain text stays'), 'plain text stays');
});

test('stripEmoji keeps code and punctuation intact', () => {
  assert.equal(stripEmoji('const x = a <= b && c > d;'), 'const x = a <= b && c > d;');
  assert.equal(stripEmoji('use `npm run build`'), 'use `npm run build`');
});

test('lowercaseProse lowercases prose but preserves code', () => {
  assert.equal(lowercaseProse('Hello There!'), 'hello there!');
  assert.equal(lowercaseProse('Use `npm run build` now.'), 'use `npm run build` now.');
  assert.equal(lowercaseProse('Open README.md please.'), 'open README.md please.');
  const fenced = 'Here:\n```js\nconst Foo = 1;\n```\ndone.';
  assert.match(lowercaseProse(fenced), /const Foo = 1;/);
  assert.match(lowercaseProse(fenced), /^here:/);
});

test('styleReply strips emoji and lowercases in one pass', () => {
  assert.equal(styleReply('Hi There ✨'), 'hi there');
  assert.equal(styleReply('OK! Run `npm test`.'), 'ok! run `npm test`.');
});
