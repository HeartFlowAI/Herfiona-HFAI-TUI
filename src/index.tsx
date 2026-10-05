#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { loadConfig } from './config.js';
import { createAdapter } from './adapters/index.js';
import { detectColorLevel, paint } from './theme.js';
import { personaPrompt } from './persona.js';
import { Agent, buildSystemPrompt } from './agent/loop.js';
import { styleReply } from './agent/text.js';
import type { ModelAdapter } from './agent/types.js';
import type { Config } from './config.js';

interface CliArgs {
  config: Partial<Config>;
  model?: string;
  prompt?: string;
  help: boolean;
  version: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { config: {}, help: false, version: false };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    switch (arg) {
      case '-h':
      case '--help':
        args.help = true;
        break;
      case '-v':
      case '--version':
        args.version = true;
        break;
      case '-m':
      case '--model':
        args.model = argv[++index];
        break;
      case '-P':
      case '--print':
      case '--prompt':
        args.prompt = argv[++index];
        break;
      case '-w':
      case '--workspace':
        args.config.workspace = argv[++index];
        break;
      case '-p':
      case '--provider':
        if (argv[index + 1] === 'ollama' || argv[index + 1] === 'openrouter') {
          args.config.provider = argv[++index] as Config['provider'];
        }
        break;
      case '--persona':
        if (['playful', 'warm', 'focused'].includes(argv[index + 1] ?? '')) {
          args.config.persona = argv[++index] as Config['persona'];
        }
        break;
      case '--temperature':
      case '--temp': {
        const value = Number(argv[++index]);
        if (!Number.isNaN(value)) args.config.temperature = Math.max(0, Math.min(2, value));
        break;
      }
      case '--auto-approve':
        args.config.autoApprove = true;
        break;
      case '--ollama-key':
        args.config.ollamaApiKey = argv[++index] ?? '';
        break;
      case '--openrouter-key':
        args.config.openRouterApiKey = argv[++index] ?? '';
        break;
    }
  }
  return args;
}

const HELP = `Aurora — a pink AI companion for your terminal

Usage
  aurora [options]
  aurora setup [ollama|openrouter]   # connect providers interactively

Options
  -m, --model <name>        Model to use (default: deepseek-v4.1-flash:cloud)
  -p, --provider <name>     ollama | openrouter
  -w, --workspace <path>    Workspace Aurora may read and edit
      --persona <mode>      playful | warm | focused
      --temperature <n>     Sampling temperature (0-2)
      --ollama-key <key>    Store an Ollama Cloud API key
      --openrouter-key <k>  Store an OpenRouter API key
  -P, --print <prompt>      One-shot answer, then exit (no TUI)
      --auto-approve        Skip approval prompts (use with care)
  -h, --help                Show this help
  -v, --version             Show version

In the TUI
  ctrl+p                    command palette (model, provider, persona, theme, ...)
  tab                       switch agent (build / plan)
  @file                     attach a file's contents to your message
  !command                  run a shell command (with approval)
  enter send · y/n approve · ctrl+c stop or quit

Slash commands
  /model /provider /persona /temperature /theme /workspace
  /mode /sessions /undo /redo /compact /thinking /rules /clear /exit

Environment
  OLLAMA_HOST               Local Ollama daemon (default http://127.0.0.1:11434)
  OPENROUTER_API_KEY        Key for the openrouter provider
  AURORA_HOME               Config directory (default ~/.aurora)

Examples
  aurora                                   # deepseek v4.1 via ollama cloud (default)
  aurora -m qwen3:0.6b                     # a small local model
  aurora -p openrouter -m deepseek/deepseek-v4.1-flash
`;

async function runOnce(
  config: Config,
  adapter: ModelAdapter,
  locality: string,
  prompt: string,
  truecolor: boolean,
): Promise<void> {
  const paintC = paint(truecolor ? 3 : process.env.FORCE_COLOR === '0' ? 0 : 2);
  let reply = '';
  const agent = new Agent({
    adapter,
    workspace: config.workspace,
    systemPrompt: buildSystemPrompt(personaPrompt(config.persona), config.workspace, locality),
    maxTurns: config.maxTurns,
    callbacks: {
      requestApproval: async (request) => {
        process.stderr.write(`\n${paintC.warm(request.title)}\n${request.detail}\n`);
        return false;
      },
      onText: (delta) => {
        reply += delta;
      },
      onToolStart: (name) => process.stderr.write(`${paintC.muted(`\n[tool] ${name}`)}\n`),
    },
  });
  const result = await agent.send(prompt);
  process.stdout.write(`${styleReply(reply)}\n`);
  if (result.toolCalls.length) {
    process.stderr.write(paintC.muted(`\n${result.toolCalls.length} tool call(s) used\n`));
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  // `aurora setup [ollama|openrouter]` — connect providers easily.
  if (argv[0] === 'setup' || argv[0] === 'connect' || argv[0] === 'login') {
    const { runSetup } = await import('./setup.js');
    process.exitCode = await runSetup(argv.slice(1));
    return;
  }

  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write(HELP);
    return;
  }
  if (args.version) {
    process.stdout.write('aurora 0.2.0\n');
    return;
  }

  const config = { ...loadConfig(), ...args.config };
  if (args.model) config.model = args.model;
  // Persist keys passed on the command line.
  if (args.config.ollamaApiKey !== undefined || args.config.openRouterApiKey !== undefined) {
    const { saveConfig } = await import('./config.js');
    saveConfig(config);
  }
  if (args.config.workspace && !existsSync(config.workspace)) {
    process.stderr.write(`Workspace does not exist: ${config.workspace}\n`);
    process.exitCode = 1;
    return;
  }

  let adapter;
  try {
    adapter = await createAdapter(config, args.model);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
    return;
  }

  const local = await adapter.locality();
  const colorLevel = detectColorLevel();
  const truecolor = colorLevel === 3;

  if (args.prompt) {
    await runOnce(config, adapter, local.detail, args.prompt, truecolor);
    return;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    process.stderr.write('Aurora needs an interactive terminal for chat mode.\nUse `aurora --print "your question"` for a one-shot answer.\n');
    process.exitCode = 1;
    return;
  }

  const { default: React } = await import('react');
  const { render } = await import('ink');
  const { default: App } = await import('./ui/App.js');

  const element = React.createElement(App, {
    config,
    adapter,
    locality: local.detail,
    truecolor,
  });
  const app = render(element, { exitOnCtrlC: false, patchConsole: false });

  // Restore the terminal on signals so a killed session doesn't leave raw mode on.
  const restore = () => {
    try {
      app.unmount();
    } catch {
      /* ignore */
    }
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    process.stdout.write('\u001b[?25h');
  };
  process.once('SIGINT', () => {
    restore();
    process.exit(0);
  });
  process.once('SIGTERM', () => {
    restore();
    process.exit(0);
  });

  await app.waitUntilExit();
}

main().catch((error) => {
  process.stderr.write(`Fatal: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
