import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';
import { loadConfig, maskKey, ollamaKey, openRouterKey, providerStatus, saveConfig, type Config, type Provider } from './config.js';
import { testProvider } from './adapters/index.js';

export interface KeyPatch {
  ollamaApiKey?: string;
  openRouterApiKey?: string;
}

/** Apply a key patch, persist it (0600), and return the updated config. */
export function applyKeys(patch: KeyPatch): Config {
  const config = { ...loadConfig(), ...patch };
  saveConfig(config);
  return config;
}

/** A one-line status summary for both providers. */
export function keysSummary(config: Config = loadConfig()): string[] {
  const orKey = openRouterKey(config);
  const olKey = ollamaKey(config);
  const or = providerStatus(config, 'openrouter');
  const ol = providerStatus(config, 'ollama');
  return [
    `ollama        ${olKey ? `key ${maskKey(olKey)}` : 'no key'}  ·  ${ol.detail}`,
    `openrouter    ${orKey ? `key ${maskKey(orKey)}` : 'not set'}  ·  ${or.detail}`,
  ];
}

/**
 * Interactive setup wizard. Prompts for provider keys, validates them live,
 * and writes the config (0600). Keys are never echoed back in full.
 *
 * Works both interactively (TTY) and with piped input; on EOF remaining
 * prompts are treated as "skip".
 */
export async function runSetup(args: string[] = []): Promise<number> {
  const target = args[0];
  const config = loadConfig();

  if (target && target !== 'ollama' && target !== 'openrouter') {
    stdout.write(`unknown target "${target}" — use ollama or openrouter\n`);
    return 1;
  }

  stdout.write('\naurora setup — connect your models\n\n');

  const interactive = Boolean(stdin.isTTY);

  // Non-interactive: read every line up front so piped input never races us.
  if (!interactive) {
    const chunks: Buffer[] = [];
    for await (const chunk of stdin) chunks.push(Buffer.from(chunk));
    const lines = Buffer.concat(chunks).toString('utf8').split(/\r?\n/);
    let cursor = 0;
    const askPipe = (prompt: string): string => {
      stdout.write(prompt);
      const line = cursor < lines.length ? (lines[cursor++] ?? '').trim() : '';
      stdout.write('\n');
      return line;
    };
    return finishSetup(target, config, askPipe);
  }

  const rl = createInterface({ input: stdin, output: stdout });
  const ask = (prompt: string): Promise<string> =>
    new Promise((resolve) => {
      rl.question(prompt, (answer) => resolve(answer.trim()));
    });

  try {
    return await finishSetup(target, config, ask);
  } finally {
    rl.close();
  }
}

/** Shared body for interactive and piped modes. */
async function finishSetup(
  target: string | undefined,
  config: Config,
  ask: (prompt: string) => string | Promise<string>,
): Promise<number> {
  if (target === undefined || target === 'ollama') {
    stdout.write('1) ollama\n');
    stdout.write('   local models work with no key. cloud models (e.g. deepseek-v4.1:cloud)\n');
    stdout.write('   need an API key from https://ollama.com/settings/keys\n');
    const current = ollamaKey(config);
    const answer = await ask(`   paste ollama api key (enter to skip, currently ${current ? maskKey(current) : 'none'}): `);
    if (answer) {
      config.ollamaApiKey = answer;
      stdout.write('   saved ollama key.\n');
    } else {
      stdout.write('   skipped.\n');
    }
  }

  if (target === undefined || target === 'openrouter') {
    stdout.write('\n2) openrouter\n');
    stdout.write('   get a key from https://openrouter.ai/keys\n');
    const current = openRouterKey(config);
    const answer = await ask(`   paste openrouter api key (enter to skip, currently ${current ? maskKey(current) : 'none'}): `);
    if (answer) {
      config.openRouterApiKey = answer;
      stdout.write('   saved openrouter key.\n');
    } else {
      stdout.write('   skipped.\n');
    }
  }

  saveConfig(config);
  stdout.write('\nchecking connections...\n');
  for (const provider of ['ollama', 'openrouter'] as Provider[]) {
    const result = await testProvider(config, provider);
    const mark = result.ok ? '\u2713' : '\u2717';
    const extra = result.modelCount !== undefined ? ` (${result.modelCount} models)` : '';
    stdout.write(`  ${mark} ${provider.padEnd(11)} ${result.detail}${extra}\n`);
  }
  stdout.write(`\nconfig saved to ~/.aurora/config.json (chmod 600)\n`);
  stdout.write('run `aurora` to start.\n\n');
  return 0;
}
