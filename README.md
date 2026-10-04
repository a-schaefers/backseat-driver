# Backseat Driver

A coding tutor that rides along while you write the code yourself.

Backseat Driver is a plugin for [Claude Code](https://claude.com/claude-code). Switch it on in any project and Claude stops writing your code. Instead it watches your working tree as you save, points out bugs, risky patterns and better idioms in a side pane, and answers questions when you ask. You stay at the keyboard, because the goal is a better programmer rather than faster code.

> **Status: design stage.** Nothing is implemented yet. This README is the plan: what the project is for and how it will be built. The [roadmap](#roadmap) tracks what exists.

## What a session looks like

Run `claude` in a terminal next to your editor and type `/backseat-driver`. A Backseat pane opens beside the conversation. From then on:

- **You write code in your own editor.** Each time you save and then pause for a few seconds, a fast model reads what changed. If something deserves a comment, a note appears in the pane: a bug, a risky pattern, a more idiomatic way to say it in this language, or a standard-library or tooling feature that would have done the job.
- **Notes are nudges, not patches.** A note says where to look and what to think about. You can ask for the concept behind it, and then for a small example. Typing the fix stays your job.
- **The prompt is still a conversation.** Ask anything, about a note or about the language in general. The tutor has seen your recent changes and its own notes.
- **`/backseat-driver off` ends the ride.** Claude Code behaves normally again.

```text
┌─ conversation ─────────────────────────┬─ Backseat ──────────────────────────────┐
│                                        │ src/cache.rs                            │
│ > /backseat-driver                     │                                         │
│   Backseat Driver is on. You drive.    │ 1  risk · line 42                       │
│                                        │    This guard is still held when        │
│ > why does note 1 matter? the tests    │    you reach the .await on line 47.     │
│   pass                                 │    Who else is waiting on it?           │
│                                        │                                         │
│ ● They pass because nothing in them    │ 2  idiom · line 18                      │
│   competes for the lock. Look at what  │    This match only changes the Some     │
│   is still alive when you reach the    │    case. Option has a method for        │
│   .await on line 47. While this task   │    exactly that.                        │
│   is parked there, what can every      │                                         │
│   other task that wants the cache do?  │                                         │
│                                        │                                         │
│ >                                      │ e: explain  d: dismiss  r: deep review  │
└────────────────────────────────────────┴─────────────────────────────────────────┘
```

In a narrow terminal the pane sits above the prompt instead of beside the conversation.

## Ground rules

The tutor follows a short contract. It defines the project, so here it is in plain words:

1. **You drive.** While Backseat Driver is on, Claude does not edit your files. A hook refuses the editing tools, so this does not depend on the model behaving.
2. **Hints before answers.** Every note starts as a nudge. More comes only when you ask, one step at a time: first the concept, then a worked example of the idea. An example is not a patch for your file.
3. **Explain the why.** A note names the underlying idea, such as ownership, short-circuit evaluation or an N+1 query, so you can look it up and recognize it next time.
4. **Stay out of the way.** Few notes, ranked by how much they matter. Nothing a formatter or linter would catch. Silence when there is nothing worth saying.
5. **Always open to questions.** You never have to wait for a note before asking something.
6. **Your project's rules still count.** The project's own `CLAUDE.md` stays loaded so the advice fits your codebase. Where it conflicts with this contract, the contract wins.

## How it works

Backseat Driver is one Claude Code plugin with two layers:

- **The contract** is a skill: a Markdown file holding the ground rules above. A skill is the standard way for a plugin to carry instructions.
- **The live layer** is a [mod](https://code.claude.com/docs/en/plugins/mods/overview): TypeScript handlers that run inside Claude Code. A mod can draw panes, add commands, change the system prompt, intercept tool calls and call models in the background, which covers everything the ride-along needs.

The plugin is installed once and stays dormant in every session until you switch it on: no pane, no model calls, no prompt changes.

```text
you save a file
      │
      ▼
watcher         A timer polls git. Once the working tree has been quiet for a
      │         few seconds, it takes the diff since the last review.
      ▼
reviewer        One background request to Sonnet with the diff, the code around
      │         it and the notes already open. No tools, no turn in your chat.
      ▼
Backseat pane   New notes appear. Notes you have dealt with disappear.
      │
      ▼
conversation    Your questions go to the session's model, which is given the
                open notes as context.
```

Each behavior maps onto one Claude Code mechanism:

| Behavior | Mechanism |
| --- | --- |
| `/backseat-driver` on and off | A command the mod registers with `$.command.register`. It runs at once, without a model turn. |
| The tutor contract | `plugin/skills/tutor/SKILL.md`. While the mode is on, a `prompt.compose` hook adds it to the system prompt. |
| The contract outranks the project's `CLAUDE.md` | A `prompt.context` hook keeps the project's instruction files loaded but reframes them as background that yields to the contract. |
| Claude never edits your files | A `tool.call` hook refuses `Edit`, `Write` and `NotebookEdit` while the mode is on. |
| Noticing changes | A `$.clock.every` timer runs `git status` and `git diff` through `$.process.run`. |
| Background review | `$.model.complete` with the `sonnet` alias: one request, no tools, no conversation history. |
| The notes pane | `$.ui.open` plus a `ui.render` hook. Notes live in `$.state`, so the pane redraws when they change. Buttons on a note send a question into the conversation with `$.prompt.submit`. |
| The conversation knows the notes | A `prompt.submit` hook attaches the open notes as context. |
| Deep review | A read-only subagent defined in `plugin/agents/` and started with `$.agent.spawn`. |
| Settings | `userConfig` in `plugin.json`: watch model, deep-review model, quiet time, note limit. Shown in `/config`. |

Why a mod and not a skill alone? A skill could carry the contract, and a plugin monitor (a background script whose output is fed to Claude) could report file changes. But every save would then become a turn in your conversation, paid for on your main model and mixed in with your questions. The mod reviews out of band on a cheaper model and leaves the conversation for what you ask. Where mods are turned off, the skill still works alone as `/backseat-driver:tutor`: the same tutor, without the live notes.

## Models

| Job | Model | How it runs |
| --- | --- | --- |
| **Watch**: review each settled change | Sonnet | Background request that sees the diff and the code around it |
| **Talk**: your questions, and "explain" on a note | The session's model (`/model`). Opus or Fable recommended | Normal conversation turn under the tutor contract |
| **Deep review**: a file, a branch or a design question, on request | Opus or Fable | Read-only subagent that can explore the codebase |

Models are addressed by alias (`sonnet`, `opus`, `fable`), so each tier follows the current model of that family, and both background tiers are configurable. Everything runs through your existing Claude Code login. There is no API key to set up, and usage counts against the same plan.

## Limits

- **It sees saves, not keystrokes.** The plugin reads files on disk, not your editor's unsaved buffer. With autosave on, that is close to live.
- **It needs git.** Changes are found by diffing the working tree, and files that git ignores are never sent.
- **It spends usage in the background.** Every review is a model call on your plan. Reviews wait for a pause, send only the diff and its surroundings, run one at a time, and can be paused.
- **Mods are new.** The mod API is early access and can change between Claude Code releases. Panes are drawn by the terminal CLI and by the Code tab of the desktop app. The VS Code extension's chat panel runs mods but does not draw them, so use `claude` in the editor's integrated terminal there.
- **A mod is code that runs with your permissions.** This one is meant to stay small and auditable: it runs `git`, reads files inside the repository, calls models and draws a pane. It makes no network requests of its own and never writes to your working tree. `claude plugin validate` lists every event a mod hooks and every call it makes, so you can check that before installing.
- **The edit guard covers the editing tools.** A shell command can still write a file, so that part rests on the contract and on Claude Code's normal permission prompts.

## Install

Not yet. Once the scaffold milestone lands, this repository will double as its own plugin marketplace:

```bash
claude plugin marketplace add a-schaefers/backseat-driver
claude plugin install backseat-driver@backseat-driver
```

Mods need Claude Code 2.1.287 or later. The design targets the mod API as of 2.1.289.

## Repository layout

Planned. Only `README.md` and `CLAUDE.md` exist so far.

```text
backseat-driver/
├── .claude-plugin/
│   └── marketplace.json        lets this repository be added as a marketplace
├── plugin/                     the plugin itself: everything a user installs
│   ├── .claude-plugin/
│   │   └── plugin.json         manifest and user settings
│   ├── skills/
│   │   └── tutor/SKILL.md      the tutor contract
│   ├── agents/
│   │   └── deep-reviewer.md    read-only reviewer for deep dives
│   ├── hooks/
│   │   ├── hooks.json          points Claude Code at the mod
│   │   └── register.tsx        the mod: switch, watcher, reviewer, pane, guard
│   ├── types/index.d.ts        types for the state the pane reads
│   └── tests/                  run with `claude plugin test`
├── CLAUDE.md                   guidance for Claude Code when working on this repository
└── README.md
```

The development loop, once there is code:

```bash
claude plugin validate . --strict          # check the marketplace manifest
claude plugin validate ./plugin --strict   # check the plugin, list what the mod hooks and calls
claude plugin test ./plugin                # run the tests
claude --plugin-dir /path/to/backseat-driver/plugin   # in another project: load this working copy
```

`--plugin-dir` loads the plugin for that session only and reloads the mod whenever one of its files is saved.

## Roadmap

- [ ] **Scaffold.** Plugin manifest, marketplace entry, validation and a first test.
- [ ] **Tutor mode.** The contract as a skill, the `/backseat-driver` switch, the system-prompt override and the edit guard. Useful by itself as a conversational tutor.
- [ ] **Live notes.** Watcher, Sonnet reviewer and the notes pane.
- [ ] **Follow-through.** Explain and dismiss on each note, notes shared with the conversation, deep review.
- [ ] **Tuning.** Fewer repeated notes, usage back-off, per-language guidance, memory of what you have already been taught.

## Related

- [learning-output-style](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/learning-output-style), Anthropic's learning mode plugin: Claude writes most of the code and hands you small pieces to fill in. Backseat Driver goes the rest of the way, and you write all of it.
- Claude Code docs: [Mods overview](https://code.claude.com/docs/en/plugins/mods/overview), [Mods reference](https://code.claude.com/docs/en/plugins/mods/reference), [Plugin components](https://code.claude.com/docs/en/plugins/components), [Plugin manifest reference](https://code.claude.com/docs/en/plugins/manifest-reference), [Create a marketplace](https://code.claude.com/docs/en/plugins/create-marketplace).
