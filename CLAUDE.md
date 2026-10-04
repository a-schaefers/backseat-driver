# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working agreement

These are standing instructions from the repository's owner. Follow them without being asked again.

- **Keep this file current.** Whenever a change adds, removes or alters something this file describes (commands, layout, architecture, invariants, API gotchas), update this file in the same commit. Do the same when you learn something about the mod API that the next session would otherwise have to rediscover.
- **Write product decisions down as they are made.** When the owner states a requirement or a preference for the product, record it in `README.md`, which is the design spec, in the same session.
- **Commit and push when a piece of work is complete.** Push to `origin main` without waiting to be asked. This does not cover force-pushing or rewriting pushed history. Ask before either.

## Status

Design stage. The repository holds only `README.md` and this file. The README is the design spec: product behavior, the tutor's ground rules, a table mapping each behavior to a Claude Code mechanism, the settings and their defaults, limits, the planned file layout and the roadmap. Read it before changing anything.

The README also makes statements about the present ("Nothing is implemented yet", "Not yet" under Install, the note above the layout tree, unchecked roadmap items). Update them in the same change that makes them false.

## What this repository is

Backseat Driver is a Claude Code plugin. There is no application, build step or runtime of its own: Claude Code loads the plugin's files as they are.

The plugin turns a session into a tutor for someone who writes their own code. The README's ground rules, such as "Claude does not edit your files", describe that product behavior in an end user's session. They are not rules for working in this repository.

The repository root is a plugin marketplace (`.claude-plugin/marketplace.json`) and the plugin itself lives in `plugin/`. Keep that split. Everything in `plugin/` is installed on users' machines, and Claude Code's validator warns about a `CLAUDE.md` at a plugin's root, which `--strict` turns into a failure. So this file stays at the repository root and nothing like it goes in `plugin/`.

## Commands

Nothing can be run until the scaffold exists. After that:

```bash
claude plugin validate . --strict          # the marketplace manifest
claude plugin validate ./plugin --strict   # plugin manifest, skills, agents, and what the mod hooks and calls
claude plugin test ./plugin                # every *.test.ts and *.test.tsx under plugin/
claude --plugin-dir /path/to/backseat-driver/plugin   # from a scratch project: load the working copy
```

- `claude plugin test` cannot run a single test. It accepts only the plugin's root (a subdirectory or a file path is an error), and the test kit has no `only` or name filter.
- A `--plugin-dir` session reloads the mod whenever one of its files is saved. A hook that throws or times out is skipped and the session carries on, and an invalid render tree is replaced by Claude Code's own drawing. Such a session shows one dim transcript line for each, and `--debug` logs every occurrence with its reason.
- Loading the plugin with `--plugin-dir` makes Claude Code write generated type declarations into `plugin/.claude-plugin/types/`. Keep that directory out of git and do not edit it.

## Architecture

Two layers (README, "How it works"):

- **Contract**: `plugin/skills/tutor/SKILL.md`, the tutor's rules as Markdown. It is the single source of tutor behavior. The mod injects this text into the system prompt and must not carry a second copy.
- **Mod**: `plugin/hooks/register.tsx`, function hooks that run inside Claude Code. It owns the `/backseat-driver` switch, the watcher, both kinds of review, the pane, the prompt override and the edit guard.

Two kinds of background review, configured separately (README, "Models and settings"):

- **Play-by-play**: runs when the working tree settles after a save. One `$.model.complete` request with no tools and no history. Its notes go to the pane's Notes tab.
- **Deep review**: a read-only subagent whose written review goes to the pane's Review tab. Two independent triggers: after each commit (on by default) and every N minutes (off by default). With both off it runs only on request. A commit-triggered review covers that commit. A timed review covers everything since the previous deep review, and is skipped when nothing has changed.

Invariants that cut across the mod's hooks:

- **Dormant until switched on.** Claude Code registers a plugin's hooks at session start, whether or not the user ever runs `/backseat-driver`. While the mode is off, every hook passes through with `next(e)`: no pane, no model call, no prompt change, no denied tool call.
- **Reviews stay out of the conversation.** Neither kind of review may become a turn in the user's conversation. Only the user's own questions, and an explicit "explain" on a note, become turns. Not yet verified: whether a subagent the mod spawns posts a completion notice into the main conversation. Check that first when implementing the deep review.
- **Model and thinking level are the user's settings.** Both reviews read their model and thinking level from `userConfig`. Nothing is hard-coded and no model id is pinned. Defaults: play-by-play `sonnet` at `medium`, deep review `opus` at `high`. "Thinking level" in the README is Claude Code's effort level (`low`, `medium`, `high`, `xhigh`, `max`).
- **Hard rules are hooks, teaching style is the contract.** "Claude never edits the user's files" is a `tool.call` denial of `Edit`, `Write` and `NotebookEdit`. How to hint and explain lives in the skill, and applies to deep reviews as much as to notes.
- **Small, auditable footprint.** The README promises that the mod only runs `git`, reads files inside the repository and its own plugin folder, calls models and draws a pane. `claude plugin validate ./plugin` prints the mod's `calls:` list. A new kind of call there (`http.fetch`, `fs.write`, a process other than `git`) breaks that promise and needs a deliberate README change.
- **No git hooks.** Commits are detected by polling (`HEAD` and the reflog), because installing a `post-commit` hook would write into the user's repository. The reflog entry tells a real commit apart from a checkout, pull or rebase that also moves `HEAD`.

## Working on the mod

The mod API is early access and changes between Claude Code releases. Mods need 2.1.287 or later, and the design was checked against 2.1.289. Load the `plugin-authoring` skill before writing or debugging hooks. It writes the type declarations for the installed build, and those outrank memory, the docs site and the API names in the README.

Easy to get wrong:

- The hooks module has no Node and no DOM, and may not use `import()`. Everything outside the module goes through `$`.
- State that a drawing reads belongs in `$.state`, declared in `plugin/types/index.d.ts` and named by `types` in `plugin.json`. Module variables are lost on reload. A `ui.render` hook can read state but not write it.
- `/clear`, `/resume` and `/branch` reset `$.state` without firing `session.start` again. `classic.SessionStart` fires instead.
- A pane opened by the user's own command is placed at any terminal width. One opened unprompted waits for 144 columns.
- `$.model.complete` takes the thinking level directly, as `effort`. `$.agent.spawn` takes a `model` but no effort. A subagent's effort comes from its definition (`effort` in the agent file's frontmatter or in a `$.agent.register` spec) or from a `turn.step` hook, so the user's deep review thinking level has to travel one of those routes.
- A `userConfig` picker (`options`) works only on string fields. The timer interval is therefore a string picker and the after-commit trigger a separate boolean. Changing a setting in `/config` reloads the mod with the new `options`.
- In tests nothing is real. Almost every `$` call the mod makes needs a stub registered with `on(...)` before the test's first call on `$` (`$.state` and `$.ui.invalidate` are the exceptions), and `session.start` runs only if the test fires it.
