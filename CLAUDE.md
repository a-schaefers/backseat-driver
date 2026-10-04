# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working agreement

These are standing instructions from the repository's owner. Follow them without being asked again.

- **Keep this file current.** Whenever a change adds, removes or alters something this file describes (commands, layout, architecture, invariants, API gotchas), update this file in the same commit. Do the same when you learn something about the mod API that the next session would otherwise have to rediscover.
- **Write product decisions down as they are made.** When the owner states a requirement or a preference for the product, record it in `README.md`, which is the design spec, in the same session.
- **Commit and push when a piece of work is complete.** Push to `origin main` without waiting to be asked. This does not cover force-pushing or rewriting pushed history. Ask before either.

## Status

Design stage. The repository holds only `README.md` and this file. The README is the design spec: the user flow, what the tutor remembers, the ground rules, a table mapping each behavior to a Claude Code mechanism, the settings and their defaults, limits, the planned file layout and the roadmap. Read it before changing anything.

The README also makes statements about the present ("Nothing is implemented yet", "Not yet" under Install, the note above the layout tree, unchecked roadmap items). Update them in the same change that makes them false.

## What this repository is

Backseat Driver is a Claude Code plugin. There is no application, build step or runtime of its own: Claude Code loads the plugin's files as they are.

The plugin turns a session into a tutor for someone who writes their own code. The README's ground rules, such as "Claude does not edit your files", describe that product behavior in an end user's session. They are not rules for working in this repository.

The repository root is a plugin marketplace (`.claude-plugin/marketplace.json`) and the plugin itself lives in `plugin/`. Keep that split. Everything in `plugin/` is installed on users' machines, and Claude Code's validator warns about a `CLAUDE.md` at a plugin's root, which `--strict` turns into a failure. So this file stays at the repository root and nothing like it goes in `plugin/`.

## Product decisions

Decided by the owner. Do not re-propose what was rejected, and do not design around the rest.

- **Learning happens through the user's own projects.** No exercises, quizzes or practice mode (rejected). The tutor chimes in from the background, and the user tunes how often, how deeply and in what voice.
- **One command, then hands off.** `/backseat-driver` or `/bsd` is all a user has to type. Every setting has a default, every question can be skipped, and setup never blocks work: a language first met mid-session gets defaults, and its questions are offered in the pane instead of interrupting.
- **One profile per language, never per project.** The subject is `python`, not "python project 1", so it carries across projects. A language's profile matters only once the user works in that language. The tutor may read other profiles when that helps.
- **The user has the last word.** Pushback in chat is weighed. A contested point goes to the deep review model for a second opinion, and the user is told that is happening. "Do it my way" always stands. The play-by-play may keep flagging the point until the user says to hush, and a hush is saved to that language's profile at once.
- **Play-by-play is the pane's default view.** The deep review and the profile are other tabs.
- **Personas are style only.** A persona sets teaching style, voice and emphasis in notes, deep reviews and conversation. It never overrides the contract. A persona named after a real person is "in the spirit of": the tutor never claims to be that person or to quote them, and it is hard on the code, never on the user.

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

- **Contract**: `plugin/skills/tutor/SKILL.md`, the tutor's rules as Markdown. It is the single source of tutor behavior. The mod injects this text into the system prompt and must not carry a second copy. Personas are separate style sheets in `plugin/personas/`, one Markdown file each, and the chosen one is injected alongside the contract and into both review prompts.
- **Mod**: `plugin/hooks/register.tsx`, function hooks that run inside Claude Code. It owns the `/backseat-driver` and `/bsd` switch, the watcher, both kinds of review, the profiles, the pane, the prompt override and the edit guard.

### Reviews

Two kinds of background review, configured separately (README, "Models and settings"):

- **Play-by-play**: one `$.model.complete` request with no tools and no history. Its notes go to the pane's Play-by-play tab.
- **Deep review**: a read-only subagent whose written review goes to the pane's Deep review tab. Two independent triggers: after each commit (on by default) and every N minutes (off by default). With both off it runs only on request. A commit-triggered review covers that commit. A timed review covers everything since the previous deep review, and is skipped when nothing has changed.

A contested point is the one review that does land in the conversation. The tutor delegates it to the same deep reviewer and reports the verdict in chat, because the user asked there.

### Watcher

The watcher polls git and never calls a model. A play-by-play look needs all of: the working tree still for the quiet time (default 10 s), the minimum gap since the previous look elapsed (default 1 min), a real change (not whitespace-only, not only ignored, binary, generated or lock files), and no look in flight. A look sends the net change since the previous look.

- Polling is deliberate. Claude Code's `FileChanged` hook watches named files (a matcher of literal filenames, or `watchPaths` set at session start), not a working tree, and native watchers (inotify-tools, fswatch, Watchman) are extra installs. None of them is on the owner's machine.
- The poll interval is not a setting. Start around 2 s and stretch it when `git status` is slow.
- Run every background git command as `git --no-optional-locks ...`. A plain `git status` refreshes the index under a lock and can make the user's own git commands fail.
- Commits are detected from `HEAD` and the reflog. The reflog subject (`commit:`, `commit (amend):`, `checkout:`, `pull:`, `rebase`) tells a real commit apart from other moves of `HEAD`.

### Profiles

README, "What it remembers about you". Profiles live in `$.store`, one key per subject:

- `subject/<language>` and `subject/general`: first-run answers (level, known languages, goals), hushed topics, and the lesson memory (topics explained and topics that recur, with counts).
- `project/<id>`: the languages a project has, and whether its first-run questions have been offered.

A subject is in play when the user changes a file in that language. A project's main languages come from `git ls-files` and an extension table. The profiles in play go into both review prompts and the conversation's system prompt. Hushes arrive through a tool the mod registers, which the tutor calls when the user states a preference, or through the `m` key on a note.

Why `$.store` and not SQLite or plain files: the hooks module cannot load SQLite, so it would mean shelling out to a `sqlite3` binary that many machines lack (the owner's included), for a few kilobytes per language. `$.fs.write` is not atomic, and the mod docs point data that several sessions change at `$.store`.

### Invariants

- **Dormant until switched on.** Claude Code registers a plugin's hooks at session start, whether or not the user ever runs `/backseat-driver`. While the mode is off, every hook passes through with `next(e)`: no pane, no model call, no prompt change, no denied tool call. The one exception is a single `$.store` read at `session.start`, which keeps the profiles from expiring. Each session starts with the mode off.
- **Background reviews stay out of the conversation.** Neither the play-by-play nor an automatic deep review may become a turn in the user's conversation. Only what the user does in chat or in the pane becomes a turn. Not yet verified: whether a subagent the mod spawns posts a completion notice into the main conversation. Check that first when implementing the deep review.
- **Model and thinking level are the user's settings.** Both reviews read their model and thinking level from `userConfig`. Nothing is hard-coded and no model id is pinned. Defaults: play-by-play `sonnet` at `medium`, deep review `opus` at `high`. "Thinking level" in the README is Claude Code's effort level (`low`, `medium`, `high`, `xhigh`, `max`).
- **Hard rules are hooks, teaching style is the contract.** "Claude never edits the user's files" is a `tool.call` denial of `Edit`, `Write` and `NotebookEdit`. How to hint and explain lives in the skill, and applies to deep reviews as much as to notes.
- **Small, auditable footprint.** The README promises that the mod only runs `git`, reads files inside the repository and its own plugin folder, calls models, keeps profiles in its own store and draws a pane. `claude plugin validate ./plugin` prints the mod's `calls:` list. A new kind of call there (`http.fetch`, `fs.write`, a process other than `git`) breaks that promise and needs a deliberate README change.
- **No git hooks.** Installing a `post-commit` hook would write into the user's repository, so commits are found by polling.

## Working on the mod

The mod API is early access and changes between Claude Code releases. Mods need 2.1.287 or later, and the design was checked against 2.1.289. Load the `plugin-authoring` skill before writing or debugging hooks. It writes the type declarations for the installed build, and those outrank memory, the docs site and the API names in the README.

Easy to get wrong:

- The hooks module has no Node and no DOM, and may not use `import()`. Everything outside the module goes through `$`.
- State that a drawing reads belongs in `$.state`, declared in `plugin/types/index.d.ts` and named by `types` in `plugin.json`. Module variables are lost on reload. A `ui.render` hook can read state but not write it.
- `/clear`, `/resume` and `/branch` reset `$.state` without firing `session.start` again. `classic.SessionStart` fires instead.
- A pane opened by the user's own command is placed at any terminal width. One opened unprompted waits for 144 columns.
- `$.model.complete` takes the thinking level directly, as `effort`. `$.agent.spawn` takes a `model` but no effort. A subagent's effort comes from its definition (`effort` in the agent file's frontmatter or in a `$.agent.register` spec) or from a `turn.step` hook, so the user's deep review thinking level has to travel one of those routes.
- A `userConfig` picker (`options`) works only on string fields. The timer interval is therefore a string picker and the after-commit trigger a separate boolean. Changing a setting in `/config` reloads the mod with the new `options`.
- `$.ui.ask` asks one question per call, with two to four options plus free text. It rejects when the user dismisses the dialog, which the first-run questions must treat as "skip the rest", and it rejects under `claude -p`.
- `$.store` holds 4 MiB of JSON in total, and a `get` followed by a `set` is not atomic. Keep one key per subject, read right before writing, and cap the lesson memory. Claude Code clears a store that no session has touched for `cleanupPeriodDays`. The default length of that period was not confirmed.
- `$.tool.register` lists a tool as `mcp__backseat-driver__<name>`, served by a `tool.call` hook. Not yet verified: whether the model calling it raises a permission prompt. A hush must apply without one, so check, and allow it from a `tool.check` hook if needed.
- In tests nothing is real. Almost every `$` call the mod makes needs a stub registered with `on(...)` before the test's first call on `$` (`$.state` and `$.ui.invalidate` are the exceptions), and `session.start` runs only if the test fires it.
