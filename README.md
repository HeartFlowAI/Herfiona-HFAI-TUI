# Aurora

A pink AI companion for your terminal. Aurora is a coding agent with a waifu who
talks back — she lives in your terminal, reads your workspace, writes files,
runs commands, and always asks first.

Built with Node + TypeScript, [Ink](https://github.com/vadimdemedes/ink) and
React. Inspired by the heartflow desktop companion.

```
   ♥  h e a r t f l o w                    ♥ Aurora
      a u r o r a   c l i                  ✨ your companion
                                           in the terminal
╭──────────────────────────────────────╮  ✧ idle
│ › what shall we build?█              │
╰──────────────────────────────────────╯
here for you ♡ · deepseek-v4.1-flash:cloud · ollama · /help
```

## Install / run

**From GitHub** (no npm publish needed):

```sh
# try it without installing
npx github:HeartFlowAI/Herfiona-HFAI-TUI

# or install globally
npm install -g github:HeartFlowAI/Herfiona-HFAI-TUI
aurora
```

**From a clone:**

```sh
git clone https://github.com/HeartFlowAI/Herfiona-HFAI-TUI
cd Herfiona-HFAI-TUI
npm install        # installs deps; dist/ is already committed
npm link           # puts `aurora` on your PATH
aurora
```

**Run from source:**

```sh
npm install
npm run build
node dist/index.js
```

Aurora needs Node 20+. It works immediately with a local Ollama daemon and
needs no API key for local models.

## Providers

Aurora works **local-first** through [Ollama](https://ollama.com), and can also
route through **Ollama Cloud** and **OpenRouter**.

### Easy setup

```sh
aurora setup              # connect both providers interactively
aurora setup ollama       # just Ollama Cloud
aurora setup openrouter   # just OpenRouter
```

The wizard asks for keys, validates them live, and saves them to
`~/.aurora/config.json` with `0600` permissions. You can also set keys directly:

```sh
aurora --ollama-key <key> --openrouter-key <key>
```

In the TUI, `Ctrl+P → "set up providers"` (or `/key ollama`, `/key openrouter`)
opens a masked input box; `/test` checks the active provider's connection.

Environment variables override the config file (handy for CI):

| Variable             | Purpose                                          |
| -------------------- | ------------------------------------------------ |
| `OLLAMA_HOST`        | Local daemon (default `http://127.0.0.1:11434`)  |
| `OLLAMA_API_KEY`     | Ollama Cloud key                                 |
| `OPENROUTER_API_KEY` | OpenRouter key                                   |
| `AURORA_HOME`        | Config dir (default `~/.aurora`)                 |

Aurora tells you whether a model runs locally or leaves your machine before she
uses it. Cloud models are labelled as egress.

## One-shot mode

For scripts and quick answers, skip the TUI:

```sh
aurora --print "explain this error" < error.log
aurora -P "write a haiku about pink" -m qwen3:0.6b
```

## What she can do

Aurora uses tools, and every side effect asks for your approval first:

- **fs_read / fs_list** — inspect the workspace (free).
- **fs_write / fs_edit** — create or modify files (asks: *"May I write this file?"*).
- **shell_exec** — run a command in the workspace (asks first).
- **http_fetch** — fetch a URL (asks first, because it leaves your machine).

Paths are confined to the workspace; symlink and `..` escapes are refused.

## Layout (matches opencode)

Aurora follows the opencode TUI layout:

- **Top bar** — session title on the left, estimated context tokens + percent on
  the right.
- **Transcript** — the conversation, with Aurora's panel on the right.
- **Above the input** — the active agent and model (`♡ build · model`).
- **Input box** — a full-width bordered field.
- **Below the input** — `build ♡ model on provider`.
- **Footer** — keybinds (`esc stop`, `tab agents`, `ctrl+p commands`) on the
  left, runtime info (`lsp`, locality, status) on the right.

Aurora's right panel shows her kaomoji face, an animated pink **matrix rain**,
and — below the rain, opencode-style — the **context** bar plus token counts
(`input` / `output` / `turns`), the model, provider, and detected language
servers.

## Agent modes

| Mode  | Tools                                   | Use it for                          |
| ----- | --------------------------------------- | ----------------------------------- |
| Build | read, list, write, edit, shell, fetch   | Actually making changes             |
| Plan  | read, list only                         | Investigating and proposing a plan  |

Plan mode cannot write, edit, or run commands — the tools simply are not
presented to the model, so it can only investigate and describe a plan.

Switch with **Tab** while typing, or `/mode build` / `/mode plan`.

## No emoji, all lowercase

Aurora talks like a sweet, upbeat girl and always writes in **lowercase**. Emoji
and decorative symbols are stripped from model output, and prose is lowercased
while code is preserved — a safety net so the vibe holds even when a small local
model ignores the instructions.

## Commands

In the TUI:

- `/help` — list commands
- `/model [name]` — switch model (no name opens the model picker)
- `/provider [ollama|openrouter]` — switch provider
- `/persona [playful|warm|focused]` — change Aurora's tone
- `/temperature [0-2]` — change sampling temperature
- `/theme [name]` — change color theme
- `/workspace [path]` — change the workspace
- `/mode [build|plan]` — switch agent
- `/sessions` — resume a previous conversation
- `/undo` · `/redo` — drop/restore the last turn
- `/compact` — summarize the conversation to free context
- `/thinking` — show/hide model reasoning blocks
- `/rules` — reload `AGENTS.md`
- `/clear` — start a fresh conversation
- `/exit` — quit

Input shortcuts:

- `@path` — attach a file's contents to your message (fuzzy file picker)
- `!command` — run a shell command through the approval flow
- `Ctrl+P` — command palette
- `Tab` — switch agent · `↑/↓` scroll · `y`/`n` approve · `Ctrl+C` stop or quit

## Project rules

If an `AGENTS.md` (or `CLAUDE.md`, `.aurora/rules.md`) exists in the workspace or
any parent directory, Aurora loads it into her system prompt automatically.
Reload with `/rules`.

## Resuming sessions

Conversations are saved to `~/.aurora/sessions/`. `/sessions` (or the palette)
lists them with message counts and relative times so you can pick up where you
left off.

## Themes

`/theme` (or the palette) switches palettes: `pink`, `sakura`, `violet`,
`midnight`, `matcha`. The choice is saved.

## Command palette (Ctrl+P)

Press **Ctrl+P** for a fuzzy command palette, just like opencode. It has:

- **switch model** — live list from your Ollama daemon (plus Ollama Cloud and
  curated OpenRouter models), with `cloud`/`local` notes and the current pick
  marked
- **switch provider** — `ollama` or `openrouter`
- **change persona / temperature / theme**
- **toggle agent mode** — build ↔ plan
- **resume session** · **undo** · **redo** · **compact**
- **reload project rules**
- **enable/disable auto-approve**
- **change workspace**
- **new conversation**, **help**, **exit**

Type to filter, `↑/↓` to move, `Enter` to choose, `Esc` to close. Every change
is written to `~/.aurora/config.json`. Switching model or provider rebuilds the
adapter live — no restart. If a provider can't be used (e.g. a missing
`OPENROUTER_API_KEY`), the change is rolled back and Aurora keeps the previous
model.

## Configuration

On first run Aurora creates `~/.aurora/config.json`. Everything in it can be
changed live from the Ctrl+P palette or the slash commands above — no restart.
You can also set values with flags (`--model`, `--provider`, `--workspace`,
`--persona`, `--auto-approve`). `--auto-approve` skips the approval prompts — use
it only in trusted, sandboxed workspaces.

The file holds `provider`, `model`, `ollamaHost`, `workspace`, `temperature`,
`persona`, `theme`, `showThinking`, `maxTurns`, and `autoApprove`.

## The panel

Aurora's panel shows her as a cute kaomoji face that changes with her state
(`(˶ᵔ ᵕ ᵔ˶)` idle, `( ˘ ³˘)♡` thinking, `(๑˃ᴗ˂)ﻭ` coding, `ヽ(o＾▽＾o)ノ`
celebrating, `(｡•́︿•̀｡)` concerned, `(◕‿◕✿)` waiting), above a pink **matrix
rain** — falling katakana mixed with hearts, stars and flowers. Below the rain
are the context bar and token counts.

She writes in **lowercase**, like a sharp, sweet friend, with no emoji. That's
enforced as a safety net (`src/agent/text.ts:styleReply`) so small local models
can't break the vibe: emoji are stripped and prose is lowercased, while code,
paths and inline `` `code` `` keep their real casing.

## Development

```sh
npm run typecheck
npm run build
npm test
npm run dev            # run from source with tsx
```

## License

MIT
`/strategy "path to package.json"` opens local-only rule package inspection. See [strategy packages](STRATEGY-PACKAGES.md) for boundaries and pending acceptance.
