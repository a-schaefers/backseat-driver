# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working agreement

These are standing instructions from the repository's owner. Follow them without being asked again.

- **Keep this file current.** Whenever a change adds, removes or alters something this file describes (commands, layout, architecture, invariants, API gotchas), update this file in the same commit. Do the same when you learn something about the mod API that the next session would otherwise have to rediscover.
- **Write product decisions down as they are made.** When the owner states a requirement or a preference for the product, record it in `README.md`, which is the design spec, in the same session.
- **Commit and push when a piece of work is complete.** Push to `origin main` without waiting to be asked. This does not cover force-pushing or rewriting pushed history. Ask before either.

## Status

Early build. Tutor mode works: the commands, the contract and personas in the system prompt, the edit guard, and a pane whose three tabs are still empty. The watcher, both reviews and profiles are not built. The README's roadmap lists the milestones in build order and which are done. The approved build plan is in `~/.claude/plans/dynamic-wandering-micali.md` on the owner's machine.

The README is the design spec: the user flow, what the tutor remembers, the ground rules, a table mapping each behavior to a Claude Code mechanism, the settings and their defaults, limits, the file layout and the roadmap. Read it before changing anything.

The README also makes statements about the present (the Status note, "Not yet" under Install, "planned" marks in the layout tree, roadmap checkboxes). Update them in the same change that makes them false.

## What this repository is

Backseat Driver is a Claude Code plugin. There is no application, build step or runtime of its own: Claude Code loads the plugin's files as they are, TypeScript included.

The plugin turns a session into a tutor for someone who writes their own code. The README's ground rules, such as "Claude does not edit your files", describe that product behavior in an end user's session. They are not rules for working in this repository.

The repository root is a plugin marketplace (`.claude-plugin/marketplace.json`) and the plugin itself lives in `plugin/`. Keep that split. Everything in `plugin/` is installed on users' machines, and Claude Code's validator warns about a `CLAUDE.md` at a plugin's root, which `--strict` turns into a failure. So this file stays at the repository root and nothing like it goes in `plugin/`. `package.json`, `node_modules/` and `scripts/` are dev tooling and stay at the root for the same reason.

## Product decisions

Decided by the owner. Do not re-propose what was rejected, and do not design around the rest.

- **Learning happens through the user's own projects.** No exercises, quizzes or practice mode (rejected). The tutor chimes in from the background, and the user tunes how often, how deeply and in what voice.
- **One command, then hands off.** `/backseat-driver` or `/bsd` is all a user has to type. Every setting has a default, every question can be skipped, and setup never blocks work: a language first met mid-session gets defaults, and its questions are offered in the pane instead of interrupting.
- **One profile per language, never per project.** The subject is `python`, not "python project 1", so it carries across projects. A language's profile matters only once the user works in that language. The tutor may read other profiles when that helps.
- **The user has the last word.** Pushback in chat is weighed. A contested point goes to the deep review model for a second opinion, and the user is told that is happening. "Do it my way" always stands. The play-by-play may keep flagging the point until the user says to hush, and a hush is saved to that language's profile at once.
- **Play-by-play is the pane's default view.** The deep review and the profile are other tabs.
- **Personas are style only.** A persona sets teaching style, voice and emphasis in notes, deep reviews and conversation. It never overrides the contract. A persona named after a real person is "in the spirit of": the tutor never claims to be that person or to quote them, and it is hard on the code, never on the user.

## Commands

```bash
npm install            # once: TypeScript, the only dev dependency
npm run check          # everything below, in order
npm run validate       # claude plugin validate, for the marketplace and for plugin/ (--strict)
npm test               # claude plugin test ./plugin: every *.test.ts under plugin/
npm run typecheck      # tsc -p plugin/tsconfig.json
scripts/dev-session.sh # a real session with the working copy, inside tmux (session name: bsd)
```

- `claude plugin test` cannot run a single test. It accepts only the plugin's root (a subdirectory or a file path is an error), and the test kit has no `only` or name filter.
- `npm run validate` prints the mod's `hooks:` and `calls:` lists. Read them after every change to `register.tsx`: they are what a user audits.
- The type check reads the API types from `plugin/.claude-plugin/types/`. Claude Code writes that folder each time it loads the plugin from this working copy in an interactive session, so run `scripts/dev-session.sh` once on a fresh clone and again after a Claude Code update. The folder ignores itself in git.
- A `--plugin-dir` session reloads the mod whenever one of its files is saved. A hook that throws or times out is skipped and the session carries on, and an invalid render tree is replaced by Claude Code's own drawing. Such a session shows one dim transcript line for each, and `claude --debug` logs every occurrence with its reason.

### Checking a change in a real session

Tests stub everything, so a milestone is only done when it has also been seen working in a real session. `scripts/dev-session.sh` starts one in tmux, in a throwaway git repository. Drive it with `tmux send-keys -t bsd '/bsd' Enter` and read the screen with `tmux capture-pane -p -t bsd`. Give the screen a moment between the two. Things to know:

- A new folder shows the workspace trust prompt first: `Down`, then `Enter`. Keys sent before the session has finished starting are lost, so check the screen before typing.
- At 170 columns the pane docks beside the conversation even in tmux. `tmux capture-pane -p -t bsd | cut -c1-94` reads the conversation, and `cut -c95-` the pane.
- Saving a file under `plugin/` while the session runs reloads the mod, and the transcript says so. The mode and the pane come back by themselves.
- The session makes real model calls on the owner's plan. Keep prompts short, and pass `--model sonnet` unless the check needs another model.
- The owner's default permission mode is bypass. Pass `--permission-mode default` when the check involves Claude running tools.
- tmux gets the main-screen layout, where a pane opens inline above the prompt. `BSD_FULLSCREEN=1` asks for the fullscreen layout, where it docks beside the conversation.

## Architecture

Two layers (README, "How it works"):

- **Contract**: `plugin/skills/tutor/SKILL.md`, the tutor's rules as Markdown. It is the single source of tutor behavior. The mod injects this text into the system prompt and must not carry a second copy. Personas are separate style sheets in `plugin/personas/`, one Markdown file each, and the chosen one is injected alongside the contract and into both review prompts.
- **Mod**: `plugin/hooks/`, function hooks that run inside Claude Code.

### How the mod's code is split

Claude Code refuses a hooks module that passes `$` (the engine interface) to a function imported from another file, and it requires every `on(...)` and every `$.noun.method(...)` to be spelled in the module itself. That gives the code its shape:

- `register.tsx` is the only file with effects. Every hook is registered there, every call on `$` is written there, and functions that take `$` are declared there.
- Every other file in `plugin/hooks/` is pure logic: plain values in, plain values out. They are tested directly, without stubs.
- When logic in another file needs an effect, `register.tsx` hands it a capability: a closure such as `args => $.process.run(['git', ...args])`. Passing a closure over `$` across an import is allowed. Passing `$` is not.
- `atom(...)` definitions live in `register.tsx` too, with literal `plugin` and `key` strings, and every state key is declared in `plugin/types/index.d.ts`.
- Register each event once per matcher. Two `on('session.start', ...)` calls without a matcher stop the module from loading.
- Write matchers as literals (`{ command: ['backseat-driver', 'bsd'] }`), not spreads or variables. The validator prints `command=?` for anything it cannot read, and that line is what a user audits.

Current files: `settings.ts` (the `/config` values as typed settings), `mode.ts` (what a `/bsd` argument asks for and which mode it leads to), `contract.ts` (what goes into the system prompt and how instruction files are reframed), `guard.ts` (which paths count as the user's files), `pane.tsx` (the pane's tree from plain data, with the handlers passed in).

### The mode

`off`, `on` or `paused`, kept twice because each copy is lost by a different event. `$.state` survives a reload of the module (which a `/config` change also causes) but is reset by `/clear`, `/resume` and `/branch`. A module variable survives those but not a reload. `session.start` restores the variable from state, and `classic.SessionStart` with source `clear`, `resume` or `fork` writes the variable back to state. So the tutor stays on through both, and each new session starts with it off.

### Tutor mode

While the mode is `on` or `paused`, three hooks carry the contract:

- `prompt.compose` replaces Claude Code's `doing_tasks` section and appends one section, `backseat-driver:contract`, last and session-scoped. That section is the body of `SKILL.md`, then `SESSION_NOTES` and (later) the profiles, then the persona. `doing_tasks` has to go because it says "find the method in the code and modify the code". The full prompt's section ids are `intro`, `system`, `doing_tasks`, `actions`, `tools`, `tone`, then session-scoped ones such as `memory`. A lean prompt has `lean_body` and no `doing_tasks`, and the code copes with that.
- `prompt.context` rewrites the `claudeMd` block. Claude Code opens that block with "These instructions OVERRIDE any default behavior". The hook swaps that paragraph for one that keeps the instructions in force except where they tell Claude to write code. The block also carries the user's global instructions, so it is reframed, not dropped. Switching the mode calls `$.ui.invalidate('prompt.context')`, because that event is cached.
- `tool.call` on `Edit`, `Write` and `NotebookEdit` returns `{ deny }` unless the path is Claude Code's own: under `~/.claude/` (its memory and plans) or its scratch folder `/tmp/claude-<uid>/`. Without that exception the tutor could not save a memory.

`SKILL.md` describes behavior only. Anything that names a command, tool or agent of this plugin goes in `SESSION_NOTES` in `contract.ts`, so that the skill still makes sense when it is used alone with mods off.

Seen in a real session on Sonnet: asked to "add a median function" in a repository whose `CLAUDE.md` says to always edit files yourself, the tutor declined, hinted, and used that file's conventions in its advice. Ordered to use the Edit tool, it still refused. It never called Edit, so the guard's refusal has only been exercised by the tests.

### Reviews

Two kinds of background review, configured separately (README, "Models and settings"):

- **Play-by-play**: one `$.model.complete` request with no tools and no history. Its notes go to the pane's Play-by-play tab.
- **Deep review**: a read-only subagent whose written review goes to the pane's Deep review tab. Two independent triggers: after each commit (on by default) and every N minutes (off by default). With both off it runs only on request. A commit-triggered review covers that commit. A timed review covers everything since the previous deep review, and is skipped when nothing has changed.

The deep reviewer is registered by the mod with `$.agent.register({ model, effort, tools })`, not shipped as a file in `plugin/agents/`. A subagent the mod spawns skips the mod's own `turn.step` hooks, so a registered spec is the only way to give it the user's thinking level. Its instructions live in `plugin/prompts/deep-review.md`.

A contested point is the one review that does land in the conversation. The tutor delegates it to the same deep reviewer and reports the verdict in chat, because the user asked there.

### Watcher

The watcher polls git and never calls a model. A play-by-play look needs all of: the working tree still for the quiet time (default 10 s), the minimum gap since the previous look elapsed (default 1 min), a real change (not whitespace-only, not only ignored, binary, generated or lock files), and no look in flight. A look sends the net change since the previous look. Work that was already uncommitted when the tutor was switched on is the baseline, not something to review.

- Polling is deliberate. Claude Code's `FileChanged` hook watches named files (a matcher of literal filenames, or `watchPaths` set at session start), not a working tree, and native watchers (inotify-tools, fswatch, Watchman) are extra installs. None of them is on the owner's machine. Anthropic's own `diff` mod polls `HEAD` the same way.
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

- **Dormant until switched on.** Claude Code registers a plugin's hooks at session start, whether or not the user ever runs `/backseat-driver`. While the mode is off, every hook passes through with `next(e)`: no pane, no model call, no prompt change, no denied tool call. The one exception is a single `$.store` read at `session.start`, which keeps the profiles from expiring.
- **Background reviews stay out of the conversation.** Neither the play-by-play nor an automatic deep review may become a turn in the user's conversation. Only what the user does in chat or in the pane becomes a turn. Not yet verified: whether a subagent the mod spawns posts a completion notice into the main conversation. Check that first when implementing the deep review. A `session.receive` hook can swallow such a notice.
- **Model and thinking level are the user's settings.** Both reviews read their model and thinking level from `userConfig`. Nothing is hard-coded and no model id is pinned. Defaults: play-by-play `sonnet` at `medium`, deep review `opus` at `high`. "Thinking level" in the README is Claude Code's effort level (`low`, `medium`, `high`, `xhigh`, `max`).
- **Hard rules are hooks, teaching style is the contract.** "Claude never edits the user's files" is a `tool.call` denial of `Edit`, `Write` and `NotebookEdit`. How to hint and explain lives in the skill, and applies to deep reviews as much as to notes.
- **Small, auditable footprint.** The README promises that the mod only runs `git`, reads files inside the repository and its own plugin folder, calls models, keeps profiles in its own store and draws a pane. A new kind of call in the validator's `calls:` list (`http.fetch`, `fs.write`, a process other than `git`) breaks that promise and needs a deliberate README change.
- **No git hooks.** Installing a `post-commit` hook would write into the user's repository, so commits are found by polling.

## Working on the mod

The mod API is early access and changes between Claude Code releases. Mods need 2.1.287 or later, and the code was last verified against 2.1.289. Load the `plugin-authoring` skill before writing or debugging hooks. The type declarations in `plugin/.claude-plugin/types/claude-code/index.d.ts` are the authority: they outrank memory, the docs site and the API names in the README. Grep them for the name at hand.

Easy to get wrong:

- The hooks module has no Node and no DOM, and may not use `import()`. Everything outside the module goes through `$`.
- State that a drawing reads belongs in `$.state`. Module variables are lost on reload. A `ui.render` hook can read state but not write it.
- `/clear`, `/resume` and `/branch` reset `$.state` without firing `session.start` again. `classic.SessionStart` fires instead.
- A pane opened by the user's own command is placed at any terminal width. One opened unprompted waits for 144 columns.
- `prompt.compose` is not cached and cannot be invalidated: it runs each time a system prompt is rendered. `prompt.context`, `prompt.section` and `tool.describe` are cached until `$.ui.invalidate` names them.
- `$.model.complete` takes the thinking level directly, as `effort`. `$.agent.spawn` takes a `model` but no effort, and the mod's own `turn.step` and `tool.call` hooks do not see a subagent the mod spawned.
- A mod's tool is served by answering `tool.call` without calling `next`, and the docs say no permission prompt appears in that case. Not yet seen in a real session.
- A `userConfig` picker (`options`) works only on string fields. The timer interval is therefore a string picker and the after-commit trigger a separate boolean. Changing a setting in `/config` reloads the mod with the new `options`.
- `$.ui.ask` asks one question per call, with two to four options plus free text. It rejects when the user dismisses the dialog, which the first-run questions must treat as "skip the rest", and it rejects under `claude -p`.
- `$.store` holds 4 MiB of JSON in total, and a `get` followed by a `set` is not atomic. Keep one key per subject, read right before writing, and cap the lesson memory. Claude Code clears a store that no session has touched for `cleanupPeriodDays`. The default length of that period was not confirmed.

In tests:

- `Text` takes no `key`. Give keys to `Button`, `Input`, `Select` and `Markdown`, and find text with `ui.find({ type: 'Text', text })`. A `find` that comes back undefined after a mount that did not reject usually means this.
- The kit answers `$.ui.invalidate('ui.render')` by itself, but not the invalidation of a prompt event. Stub `ui.invalidate` or the call is dropped with a line under "the engine reported".
- `test(name, { options: { persona: 'knuth' } }, body)` sets `userConfig` values for one test.
- `stubSession(on)` in `plugin/tests/kit.ts` registers every stub the plugin needs to start and switch modes. Use it and add to it.

- Nothing is real. Almost every `$` call the mod makes needs a stub registered with `on(...)` before the test's first call on `$` (`$.state` and `$.ui.invalidate` are the exceptions), and `session.start` runs only if the test fires it.
- Tests are type-checked, and the types are stricter than the docs' examples. `$.command.run` needs `origin` and `presentation` (use `typed()` from `plugin/tests/kit.ts`), and a `command.register` stub returns `{ value: { command: e.name } }`, not `{ value: undefined }`.
- Each test starts with the module freshly loaded and `$.state` at its defaults. A test cannot reset `$.state` halfway through, so what `/clear` does can only be approximated.
