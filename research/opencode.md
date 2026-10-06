# Backseat Driver on OpenCode: the plan

Plan, 2026-10-05. Read against Claude Code 2.1.289, `@opencode-ai/plugin` 1.18.34 (its `dev` branch), and `main` at `1b2ce36`.

## In one paragraph

Pull the host-neutral half of the mod into `plugin/core/`, behind one `Host` interface, and make `register.tsx` the Claude Code adapter for it. Then write a second adapter, an OpenCode plugin under `clients/opencode/`, that imports the same core. Both clients share one data folder, so a person who uses both keeps one profile, one progress report and one journal per project. Claude Code stays first class: it keeps everything it has today, its adapter is the one the tests and live checks cover first, and nothing in the core is shaped by OpenCode's limits. OpenCode gets every model it supports (OpenAI, Google, Ollama with Qwen, and the rest) because the conversation and the tutor's background jobs both go through OpenCode's own providers.

## Why OpenCode

- MIT-licensed, TypeScript, runs plugins in Bun.
- Its providers cover OpenAI, Google and Ollama out of the box. The tutor never talks to a provider itself, so there's no provider code to write or maintain.
- It has every hook the tutor needs, in two plugin kinds:
  - **Server plugins** (`opencode.json` → `plugin`): `experimental.chat.system.transform` to put the contract in the system prompt, `tool.execute.before` and `permission.ask` to refuse edits, custom tools, `chat.message` to attach notes to a prompt, `config` to add an agent and commands, `event` for file and session events, and an SDK client that can run a model in a session of its own.
  - **TUI plugins** (`tui.json` → `plugin`, Solid on opentui): a `sidebar_content` slot, full-screen routes, dialogs (`DialogSelect` for the first-run questions), toasts, a keymap with slash commands, and a theme.
- Claude Code's own terms don't come into it: no Anthropic service runs in the OpenCode client. Two rules still apply: the name and the art can't use "Claude Code" or its mascot (see "What changes for OpenCode").

## What's already shared, and what isn't

`plugin/hooks/` holds 15,700 lines. All of it except four files is already free of Claude Code:

| Kind | Files | Claude Code? |
| --- | --- | --- |
| Pure logic | `watcher`, `git`, `diff`, `noise`, `journal`, `attention`, `enclosing`, `glance`, `knowledge`, `explain-prompts`, `notes`, `prompts`, `review`, `reviewqueue`, `progress`, `authorship`, `profiles`, `project`, `languages`, `store`, `locks`, `lease`, `scheduler`, `sensor`, `play`, `gate`, `health`, `status`, `focus`, `working`, `questions`, `forget`, `mode`, `datahome`, `storage`, `hash`, `avatar`, `debuglog`, `update` | No |
| Engines with ports | `explainer`, `recorder` | No |
| Kernel | `kernel.js`, `core.ts` | No |
| Text the models read | `prompts/*.md`, `personas/**`, `skills/tutor/SKILL.md` | No |
| Domain types | `plugin/types/index.d.ts` (all but its `declare module 'claude-code'` block) | No |
| Type imports only | `settings.ts` (`PluginOptions`), `contract.ts` (`PromptComposeSection`) | Yes, types only |
| Drawing | `pane.tsx` (`Elements`) | Yes |
| Every effect | `register.tsx` (3,950 lines, 134 functions) | Yes |

So the shared part is most of the code. The problem is `register.tsx`: besides the hooks, it holds the tutor's running state and the logic that ties the engines together (when to look, how a review is started and collected, how the journal and Explain are fed). That's the part to move.

## Target layout

```text
plugin/                         the Claude Code plugin; still the only folder Claude Code installs
  core/                         host-neutral: everything both clients run
    *.ts                        the pure modules and engines, moved from hooks/
    kernel.js, kernel.d.ts, core.ts
    host.ts                     the Host interface (below)
    tutor.ts                    createTutor(host, settings): the running tutor
    pane-model.ts               PaneView → rows of styled text, the drawing logic of pane.tsx
    tools.ts                    the eight tools' inputs and answers
    defaults.ts                 settings and their defaults, read from plugin.json at build time for OpenCode
  hooks/                        the Claude Code adapter
    register.tsx                hooks, $ calls, and the Host built from $
    pane.tsx                    pane-model rows → Claude Code Elements
    contract.ts                 Claude Code's prompt sections (doing_tasks, claudeMd)
  prompts/, personas/, skills/  unchanged, read by both clients
  types/index.d.ts              domain types, plus the claude-code module block
clients/opencode/               the OpenCode client (dev side of the repo; not in plugin/)
  package.json                  name backseat-driver-opencode, exports ./server and ./tui
  src/server.ts                 server plugin: Host built from the SDK client and Bun
  src/tui.tsx                   TUI plugin: sidebar, Backseat route, dialogs, /backseat
  build.ts                      bundles src + ../../plugin/core and copies prompts, personas, SKILL.md
editors/                        the editor plugins (on claude/editor-plugins), unchanged
```

The core stays inside `plugin/` because Claude Code installs only that folder. I checked that this works: with `hash.ts` moved to `plugin/core/` and imported as `../core/hash`, `claude plugin validate --strict` passed and all 446 tests passed. The validator still listed every hook and call. A live session load hasn't been tried yet, and it's step one of milestone O0.

## The seam: one `Host` interface

`createTutor` gets everything it touches from outside through `Host`. That's the existing capability pattern (closures over `$`, like the `Disk` and the engines' ports) widened to cover all of it. Each line names what Claude Code and OpenCode plug in.

| Port | What the core asks | Claude Code | OpenCode |
| --- | --- | --- | --- |
| `clock` | `now`, `after(ms, fn)` | `$.clock` | `Date.now`, `setTimeout` |
| `git(args)` | run git, `--no-optional-locks` added by the core | `$.process.run` | `Bun.spawn` |
| `disk` | read, write, list, stat, remove (today's `Disk`) | `$.fs`, `rm` | `node:fs` |
| `assets` | prompt, persona and contract text | `$.fs.read` under `$.plugin.root` | files bundled in the package |
| `complete(job, request)` | one model call, no tools, back as a `ModelResult` | `$.model.complete` | `client.session.create` and `session.prompt` with the job's model, every tool off, and `format` set to a JSON schema when the reply is JSON; then the session is deleted |
| `reviewer` | `start(request) → id`, and an `ended(id, answer or why)` callback | `$.agent.register`, `$.agent.spawn`, `turn.complete`, `classic.StopFailure` | an agent `backseat-reviewer` added by the `config` hook (read, grep, glob only), run in a child session; `session.idle` and `session.error` events end it |
| `pressure()` | how close the plan limit is | `$.session.usage`, `session.measure` | none (`NO_PRESSURE`); a `429` still counts as `rate-limit` |
| `outcomeOf` | a failure, as one of the health troubles | Anthropic's error words (as now) | OpenCode's error names and status codes, mapped in the adapter |
| `ui` | `show(paneView)`, `toast`, `ask(question)` | `$.state` atoms, `$.ui.toast`, `$.ui.ask` | a `pane.json` in the data folder that the TUI plugin redraws from; the TUI's toast and `DialogSelect` |
| `log` | the debug log's sink | as now | as now (same data folder) |

What is not a port, because it is how a client is wired into its host and nothing about it is shared:

| Concern | Claude Code | OpenCode |
| --- | --- | --- |
| Contract in the system prompt | `prompt.compose` (removes `doing_tasks`) | `experimental.chat.system.transform` appends the contract |
| Instruction files reframed | `prompt.context` (`claudeMd` block) | the same reframing text, applied to the `AGENTS.md` / `CLAUDE.md` part of `system` |
| Notes attached to a typed prompt | `prompt.submit` | `chat.message` adds a text part |
| Never edit the user's files | `tool.call` on `Edit`, `Write`, `NotebookEdit` | `tool.execute.before` throws on `edit`, `write`, `patch`; `permission.ask` answers `deny` for them |
| The eight tools | `$.tool.register` + `tool.call` | `tool({ description, args, execute })` |
| `/backseat` and its words | `$.command.register` | a slash command in the TUI keymap |
| Settings | `userConfig` in `plugin.json`, `/config` | plugin options in `opencode.json`, defaults from `plugin.json` |
| Update and uninstall | `claude plugin`, `update.ts` | OpenCode installs npm plugins by itself; `/backseat update` says so |

What stays exactly one copy: the contract (`SKILL.md`), the prompts, the personas and their art, the kernel, every reply parser, the scan cadence, the play-by-play's pacing, the review queue, Explain's freshness rule, the journal, progress levels, profiles, hushes, the store and its locks, the lease, the debug log, and the status lines. The tool bodies are shared too: `tools.ts` turns an input into an answer, and each adapter only declares the tool.

## The pane in OpenCode

The core already builds a plain `PaneView`. `pane.tsx` turns it into Claude Code elements, and today that file holds layout logic too (tab badges, rows that fit, the persona's frames and bubble). Split it:

- `core/pane-model.ts` takes `PaneView` and a width, and returns rows of styled spans: `{ text, color, dim, bold, action? }`. Every decision is made here, tested once.
- `hooks/pane.tsx` turns the rows into `Text`, `Button`, `Box`. It gets thin.
- `clients/opencode/src/tui.tsx` turns the same rows into opentui `<text>` and boxes, in two places:
  - the `sidebar_content` slot: the status line, the play-by-play notes and the persona, the part that should always be in sight
  - a `backseat` route opened from `/backseat` or a key: the four tabs at full size

The server plugin writes `pane.json` beside `view.json` in the data folder whenever the view changes, and the TUI plugin watches it. Same-machine files are already how the tutor talks to editors, and the store's locks and the lease already make the folder safe for several writers. If O0 finds a direct channel from a server plugin to its TUI half, use that instead and keep `pane.json` for editors.

## What changes for OpenCode

- **Persona art.** The `default` voice uses Claude Code's mascot. The OpenCode client needs its own default character, because the mascot is Anthropic's. The real-person caricatures and the penguin carry over.
- **Wording.** Status lines say "Claude is not answering". The core takes the host's name for the model ("the model", or the provider's name in OpenCode).
- **Effort.** Claude Code's `low…max` maps to a provider's reasoning option where it has one (through `chat.params` options) and is left out where it doesn't.
- **Models.** Each job's model is a `provider/model` string such as `ollama/qwen3-coder`. Empty means the session's own model. The Claude aliases stay the Claude Code defaults.
- **No plan limits.** OpenCode has no subscription windows, so the 80% and 95% slow-downs never fire. The health machine's backoff on `429`, outages and timeouts works unchanged.
- **Weak models.** Small local models get JSON wrong more often. OpenCode's `format` (a JSON schema, retried by OpenCode) is asked for on every JSON reply, and the parsers already drop what they can't read.
- **Background sessions.** Each background call is a session of its own, deleted when done. O0 has to show they don't clutter the user's session list, or find the flag that hides them.

## Milestones

Each one ends green on `npm run check` and, for Claude Code, a live check in `scripts/dev-session.sh`. Nothing in Claude Code's behavior changes before O4.

**O0. Probes (a day).** In Claude Code: the moved `hash.ts` loads in a live session. In OpenCode, with a scratch plugin:
1. A server plugin's `experimental.chat.system.transform` reaches the system prompt, and `tool.execute.before` throwing stops an edit.
2. `session.create` and `session.prompt` with a different model, tools off and `format`, then `session.delete`. Does it show in the session list?
3. A child session with an agent added by the `config` hook, read-only tools, ended by `session.idle`.
4. One npm package carrying both the server and the TUI plugin (two `exports`).
5. A slash command from the TUI plugin, and how it reaches the server half.
6. `sidebar_content` width at 120 columns, and a route with key bindings.
7. Which `session.error` names and status codes mean which health trouble.

**O1. Move the core (mechanical).** `git mv` the host-neutral files to `plugin/core/`, fix the imports, move `PluginOptions` and `PromptComposeSection` out of `settings.ts` and `contract.ts` into the adapter, and split `pane.tsx` into `pane-model.ts` and the renderer. No behavior change. Land it in one commit after the in-flight branches (`finish-kernel-port`, `watch-files`, `editor-plugins` and the rest) have merged, so nobody rebases across every file at once. Add a test that nothing under `plugin/core/` imports `claude-code`.

**O2. `Host` and `createTutor`.** Move `register.tsx`'s module state and wiring into `core/tutor.ts`, one engine at a time, the way the kernel was ported: the look first, then the review queue and reviewer, then progress, then the journal, Explain, the lease and the debug log. After each move, `register.tsx` builds the `Host` from `$` and calls in, and the 446 tests still pass unchanged. The kit stays Claude Code's. A fake `Host` (`core/tests/host.ts`) tests `tutor.ts` directly. New decision logic found on the way goes into the kernel, per the rule. Expect `register.tsx` to shrink to the hooks, the `Host` and the Claude Code-only features (prompt sections, edit guard, update, uninstall).

**O3. OpenCode server plugin.** `clients/opencode/src/server.ts`: the `Host` from the SDK client and Bun, the contract, the edit guard, the eight tools, the `config` hook (the reviewer agent), the scan, and `pane.json`. Tests with `bun test` against a fake SDK client. A live check in OpenCode with `ollama/qwen3-coder`.

**O4. OpenCode TUI plugin.** The sidebar, the Backseat route with the four tabs and their keys, the first-run questions as `DialogSelect`, `/backseat` and its words, the OpenCode default character, toasts.

**O5. Ship.** `build.ts` bundles to one file per entry, with prompts, personas and `SKILL.md` copied in. Publish `backseat-driver-opencode` to npm. Add a CI job that runs the OpenCode tests against a pinned OpenCode version (the `experimental.` hooks can move), plus a nightly on the newest, the way `check.yml` and `nightly.yml` do for Claude Code. Add one line and the install steps to the README, and CLAUDE.md sections for the core, the `Host` and the OpenCode client.

## Setup, once it ships

```jsonc
// opencode.json
{ "plugin": ["backseat-driver-opencode"] }
```

```jsonc
// tui.json
{ "plugin": ["backseat-driver-opencode/tui"] }
```

For a local Qwen:

```bash
# install Ollama (https://ollama.com), then:
ollama pull qwen3-coder
# and pick ollama/qwen3-coder as the model in OpenCode
```

Options go beside the package name, the same names as in Claude Code's `/config`:

```jsonc
{ "plugin": [["backseat-driver-opencode", { "voice": "knuth", "play_by_play_model": "ollama/qwen3-coder" }]] }
```

For development, symlink `clients/opencode/src/server.ts` into a scratch project's `.opencode/plugins/`, and list `src/tui.tsx` in that project's `tui.json`. Bun loads TypeScript as it is, as Claude Code does.

## Risks

- **`register.tsx` is the hard part.** O2 moves about 4,000 lines of the code that was hardest to get right (the review slot, interleaved hooks, `/clear`). Doing it one engine at a time, with the existing tests green after each step, is what keeps Claude Code safe.
- **OpenCode's plugin API moves.** The system prompt hook is `experimental.`, and a v2 plugin API is already in the package. Pin the version, and keep the OpenCode adapter thin so a change costs one file.
- **One data folder, two clients.** A Claude Code session and an OpenCode session in the same project share the lease, so only one drives. That's the intended behavior. Older Claude Code installs must read what a newer core writes. New fields stay optional, as they are today.
- **Live checks.** Cloud threads have no Claude login, and have no OpenCode or Ollama install unless one is set up. The O0 probes and every live check are on the owner's machine.

## Sources

- OpenCode: [plugin API types](https://github.com/sst/opencode/blob/dev/packages/plugin/src/index.ts), [TUI plugin types](https://github.com/sst/opencode/blob/dev/packages/plugin/src/tui.ts), [plugins](https://opencode.ai/docs/plugins/), [SDK](https://opencode.ai/docs/sdk/) (`session.prompt`, structured output), [`@opencode-ai/plugin` package.json](https://github.com/sst/opencode/blob/dev/packages/plugin/package.json)
- TUI plugins in practice (`tui.json`, `sidebar_content`): [opencode-tui-context](https://github.com/SolitudeRA/opencode-tui-context), [opencode-sessions-watch](https://github.com/llucax/opencode-sessions-watch)
- Ollama: [Anthropic compatibility](https://github.com/ollama/ollama/blob/main/docs/api/anthropic-compatibility.mdx)
- Claude Code: [Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance) (names and logos), mod API types (`plugin/.claude-plugin/types/claude-code/index.d.ts`, 2.1.289)
