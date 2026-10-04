# Backseat Driver

A coding tutor that rides along while you write the code yourself.

Backseat Driver is a plugin for [Claude Code](https://claude.com/claude-code). Switch it on in any project and Claude stops writing your code. Instead it watches your working tree as you save, points out bugs, risky patterns and better idioms in a side pane, reviews each commit in more depth, and answers questions when you ask. You stay at the keyboard, because the goal is a better programmer rather than faster code.

You learn by building whatever you want to build. The tutor sets no exercises and runs no quizzes. It chimes in from the background, and how often, how deeply and in what voice is yours to tune.

> **Status: design stage.** Nothing is implemented yet. This README is the plan: what the project is for and how it will be built. The [roadmap](#roadmap) tracks what exists.

## Using it

One command starts it, and after that there is nothing to manage. Every setting has a default and every question can be skipped.

### Start

Run `claude` in a terminal next to your editor and type `/backseat-driver`, or `/bsd` for short. A Backseat pane opens beside the conversation.

### The first time

Backseat Driver works out the project's main languages from its tracked files.

- For a language it already knows you in, it picks up where you left off, even if that was in a different project.
- For a new one it asks up to ten quick multiple-choice questions: how much of the language you have written, which languages you already know, and where you want to get to. Press Esc to skip them. It then starts from sensible defaults and learns from your code instead.

A language you only touch later, such as the one shell script in a Python project, never interrupts you with questions. The tutor uses defaults for it and offers the questions in the pane for when you have a minute.

### While you work

- **You write code in your own editor.** Each time you save and then pause for a few seconds, a fast model reads what changed. If something deserves a comment, a note appears in the pane: a bug, a risky pattern, a more idiomatic way to say it in this language, or a standard-library or tooling feature that would have done the job. This running commentary is the play-by-play, and it is what the pane shows by default.
- **Notes are nudges, not patches.** A note says where to look and what to think about. You can ask for the concept behind it, and then for a small example. Typing the fix stays your job.
- **Commits get a deeper review.** After each commit, a stronger model reads the whole commit together with the code around it and writes a longer review in the pane's Deep review tab. It can also run on a timer, or only when you ask.

```text
┌─ conversation ─────────────────────────┬─ Backseat ───────────────────────────────────┐
│                                        │ [ Play-by-play ]   Deep review   Profile     │
│ > /backseat-driver                     │                                              │
│   Backseat Driver is on. You drive.    │ src/cache.rs                                 │
│                                        │ 1  risk · line 42                            │
│ > why does note 1 matter? the tests    │    This guard is still held when you reach   │
│   pass                                 │    the .await on line 47. Who else is        │
│                                        │    waiting on it?                            │
│ ● They pass because nothing in them    │                                              │
│   competes for the lock. Look at what  │ 2  idiom · line 18                           │
│   is still alive when you reach the    │    This match only changes the Some case.    │
│   .await on line 47. While this task   │    Option has a method for exactly that.     │
│   is parked there, what can every      │                                              │
│   other task that wants the cache do?  │                                              │
│                                        │                                              │
│ >                                      │ e: explain  d: dismiss  m: mute  r: review   │
└────────────────────────────────────────┴──────────────────────────────────────────────┘
```

In a narrow terminal the pane sits above the prompt instead of beside the conversation.

### Talk back

The play-by-play and the deep review are not announcements to be read in silence. The prompt is a normal conversation, and the tutor has seen your recent changes, its own notes and the latest review.

- **Ask anything**, about a note, a review or the language in general.
- **Disagree.** Say why you think a note is wrong and the tutor weighs your argument. If you are contesting the point, it tells you it is sending it to the deep review model for a second opinion, and that model either concedes or explains.
- **Do it your way.** You can always overrule the tutor, and it will not argue the point again. The play-by-play may still flag it.
- **Tell it to hush.** Say "stop warning me about missing type hints", or press `m` on a note. It stops at once and remembers, in this project and in every other project in that language.

### Stop

`/bsd pause` silences it without closing anything. `/bsd off` ends the ride, and Claude Code behaves normally again. Each new session starts with it off.

Nothing needs configuring, but the models, thinking levels, pacing and the tutor's persona are all yours to change. See [Models and settings](#models-and-settings).

## What it remembers about you

Backseat Driver keeps one profile per language, not per project. Your Python profile is the same in every Python project, so the tutor picks up where you left off wherever you switch it on. A general profile holds what is not tied to one language.

A profile holds:

- **Where you are.** Your answers to the first-run questions, such as how much of the language you have written and which languages you know well. "Rust, coming from Python" means Rust idioms get explained by comparison with the Python you already know.
- **Where you want to get to.** Your goals for that language.
- **What you don't want to hear about.** Everything you have told it to hush about.
- **What you have covered.** The ideas it has explained to you and the mistakes that keep coming back, so it stops repeating itself, builds on earlier lessons and can show you your recurring themes.

A profile comes into play when you work on a file in that language. In a project that mixes languages several can be active, and your Bash profile stays out of the way until you touch a shell script. The tutor can also look at your other profiles when that helps, for example to explain a Rust idea in terms of Python.

Profiles are saved automatically, on your machine and outside any project, in the store Claude Code gives each plugin. They are never written into your repository. The pane's Profile tab shows what the tutor has on record for the languages in play, and you can remove any line of it.

## Ground rules

The tutor follows a short contract. It defines the project, so here it is in plain words:

1. **You drive.** While Backseat Driver is on, Claude does not edit your files. A hook refuses the editing tools, so this does not depend on the model behaving.
2. **Hints before answers.** Every note starts as a nudge. More comes only when you ask, one step at a time: first the concept, then a worked example of the idea. An example is not a patch for your file.
3. **Explain the why.** A note names the underlying idea, such as ownership, short-circuit evaluation or an N+1 query, so you can look it up and recognize it next time.
4. **Stay out of the way.** Few notes, ranked by how much they matter. Nothing a formatter or linter would catch. Silence when there is nothing worth saying. No exercises and no quizzes: the project you chose to build is the lesson.
5. **Always open to questions.** You never have to wait for a note before asking something.
6. **You have the last word.** The tutor reconsiders when you push back, gets a second opinion when you contest a point, and yields when you say to do it your way. Tell it to hush about something and it drops it for good.
7. **Your project's rules still count.** The project's own `CLAUDE.md` stays loaded so the advice fits your codebase. Where it conflicts with this contract, the contract wins.

## How it works

Backseat Driver is one Claude Code plugin with two layers:

- **The contract** is a skill: a Markdown file holding the ground rules above. A skill is the standard way for a plugin to carry instructions.
- **The live layer** is a [mod](https://code.claude.com/docs/en/plugins/mods/overview): TypeScript handlers that run inside Claude Code. A mod can draw panes, add commands, change the system prompt, intercept tool calls and call models in the background, which covers everything the ride-along needs.

The plugin is installed once and stays dormant in every session until you switch it on: no pane, no model calls, no prompt changes.

```text
PLAY-BY-PLAY

you save a file
      │
      ▼
watcher         Asks git what changed every couple of seconds. Nothing
      │         reaches a model at this stage.
      ▼
gate            Waits for the working tree to go quiet and for the minimum
      │         gap since the last look. Drops the look if nothing real
      │         changed.
      ▼
reviewer        One background request to the play-by-play model with the
      │         change since the last look, the code around it, your profile
      │         and the notes already open. No tools, no turn in your chat.
      ▼
Play-by-play    New notes appear. Notes you have dealt with disappear.
tab


DEEP REVIEW

you commit, the timer fires, or you ask
      │
      ▼
watcher         Spots a new commit by polling git. No git hooks are installed
      │         in your repository.
      ▼
deep reviewer   A read-only subagent on the deep review model reads the commit
      │         and explores the code around it.
      ▼
Deep review     The written review replaces the previous one.
tab


CONVERSATION

Your questions go to the session's model, which is given your profile, the
open notes and the latest review as context. A point you contest goes to the
deep review model for a second opinion.
```

### When the play-by-play looks

Saving a file does not call a model. The watcher only notices that something changed. A look happens when all of these hold:

- The working tree has been still for the quiet time, 10 seconds by default. A burst of saves, or an editor that autosaves as you type, counts once.
- The minimum gap since the previous look has passed, 1 minute by default.
- Something real changed since the previous look. Whitespace-only edits don't count, and neither do files that git ignores, binary files, generated files or lock files.
- No other look is still running.

A look covers the net change since the previous look, however many saves that took. Looks also slow down by themselves as you approach your plan's usage limits.

### Why the watcher polls

The watcher asks git what changed every couple of seconds, and stretches that interval by itself in repositories where git is slow. Polling is the dependable option. Claude Code's own file watching is built for a short list of named files, such as `.env`, not for a whole working tree, and the tools that can watch a tree (inotify-tools, fswatch, Watchman) would each be an extra install. A poll costs one `git status` and never reaches a model.

### What each part is built on

| Behavior | Mechanism |
| --- | --- |
| `/backseat-driver` and `/bsd` | Two commands the mod registers with `$.command.register`, answered by the same hook. They run at once, without a model turn. |
| The tutor contract | `plugin/skills/tutor/SKILL.md`. While the mode is on, a `prompt.compose` hook adds it, and the profiles in play, to the system prompt. |
| Tutor persona | One Markdown style sheet per persona in `plugin/personas/`. The chosen one is added to the system prompt and to both review prompts. |
| The contract outranks the project's `CLAUDE.md` | A `prompt.context` hook keeps the project's instruction files loaded but reframes them as background that yields to the contract. |
| Claude never edits your files | A `tool.call` hook refuses `Edit`, `Write` and `NotebookEdit` while the mode is on. |
| Noticing saves and commits | A `$.clock.every` timer runs `git` through `$.process.run`: status and diff for saves, `HEAD` and the reflog for commits. |
| Finding the project's languages | `git ls-files` and a table of file extensions. |
| First-run questions | `$.ui.ask`, the same question dialog Claude uses. |
| Profiles | `$.store`, the key-value store Claude Code gives each plugin: one small JSON document per language. |
| Play-by-play review | `$.model.complete` with the chosen model and thinking level: one request, no tools, no conversation history. |
| Deep review | A read-only subagent defined in `plugin/agents/`, started with `$.agent.spawn` on the chosen model and thinking level. Its review goes to the pane, not into the conversation. |
| Second opinion on a contested point | The tutor hands the point to the same read-only subagent and reports its verdict in the conversation. |
| "Stop warning me about that" | A tool the mod registers with `$.tool.register`. The tutor calls it when you state a preference, and the mod saves it to the profile and drops the matching notes. |
| The pane | `$.ui.open` plus a `ui.render` hook, with Play-by-play, Deep review and Profile tabs. Their contents live in `$.state`, so the pane redraws when they change. Buttons on a note send a question into the conversation with `$.prompt.submit`. |
| The conversation knows the notes | A `prompt.submit` hook attaches the open notes and the latest review as context. |
| Settings | `userConfig` in `plugin.json`. Each setting is a row in `/config`, listed under [Models and settings](#models-and-settings). |

Why a mod and not a skill alone? A skill could carry the contract, and a plugin monitor (a background script whose output is fed to Claude) could report file changes. But every save would then become a turn in your conversation, paid for on your main model and mixed in with your questions. The mod reviews out of band, on the models you choose, and leaves the conversation for what you ask. Where mods are turned off, the skill still works alone as `/backseat-driver:tutor`: the same tutor, without the play-by-play and the automatic reviews.

## Models and settings

There are three jobs, and each runs on its own model:

| Job | Model | How it runs |
| --- | --- | --- |
| **Play-by-play**: running commentary on each settled change | Your choice. Sonnet by default | Background request that sees the change and the code around it |
| **Deep review**: a longer review of your commits, and second opinions | Your choice. Opus by default | Read-only subagent that can explore the codebase |
| **Talk**: your questions, and "explain" on a note | The session's model and thinking level, set with `/model` and `/effort` | Normal conversation turn under the tutor contract |

Everything is configured in `/config`, and the two background jobs have separate settings. A change applies at once, without restarting the session.

| Setting | Choices | Default |
| --- | --- | --- |
| Tutor persona | `none`, `torvalds`, `knuth`, `primeagen`, `eli5-tldr-kiss-terse` | `none` |
| Play-by-play | automatic, on request | automatic |
| Play-by-play quiet time | 5, 10, 20, 30 or 60 seconds | 10 seconds |
| Play-by-play minimum gap | none, 30 seconds, 1, 2 or 5 minutes | 1 minute |
| Play-by-play model | `haiku`, `sonnet`, `opus`, `fable` | `sonnet` |
| Play-by-play thinking level | `low`, `medium`, `high`, `xhigh`, `max` | `medium` |
| Deep review after each commit | on, off | on |
| Deep review every | none, 5, 15, 30, 45, 60, 90 or 180 minutes | none |
| Deep review model | `haiku`, `sonnet`, `opus`, `fable` | `opus` |
| Deep review thinking level | `low`, `medium`, `high`, `xhigh`, `max` | `high` |

The quiet time is how long the working tree must be still before the play-by-play looks, and the minimum gap is the shortest time between two looks. Lower both for commentary that keeps closer to your typing, or raise them for fewer interruptions and less usage. Set the play-by-play to "on request" and it looks only when you ask for a look from the pane.

How often the watcher polls, what counts as a real change, and the slow-down near your plan's limits are not settings. They adapt by themselves.

The two deep review triggers are independent, so reviews can run after commits, on a timer, on both, or on neither. With both off, a deep review runs only when you ask for one from the pane.

What a deep review covers depends on what triggered it:

- **After a commit**: that commit.
- **On the timer**: everything since the previous deep review, meaning any commits made in between plus the uncommitted work on top of the last commit. A timed review is skipped when nothing has changed.

A deep review follows the same ground rules as a note. It explains and points, and it does not rewrite your code.

Models are addressed by alias, so each setting follows the current model of that family. Thinking levels are Claude Code's effort levels. Everything runs through your existing Claude Code login. There is no API key to set up, and usage counts against the same plan.

### Personas

A persona sets the tutor's teaching style, voice and emphasis, in the notes, the deep reviews and the conversation alike. You can switch it at any time.

| Persona | Voice and emphasis |
| --- | --- |
| `none` | The default. Plain, calm and to the point. |
| `torvalds` | Blunt and exacting. Cares about good taste: simple code, the right data structure, no needless abstraction. Hard on the code, never on you. |
| `knuth` | Patient and precise. Cares about correctness, edge cases, and why an algorithm works and what it costs. |
| `primeagen` | Fast, energetic and funny. Cares about fundamentals, performance and not hiding behind a framework. |
| `eli5-tldr-kiss-terse` | The shortest plain-words version. One idea per note, and no jargon without a definition. |

A persona changes how the tutor talks and what it dwells on. It never changes the ground rules. The personas named after people are styles in their spirit: the tutor does not claim to be them or to quote them.

## Limits

- **It sees saves, not keystrokes.** The plugin reads files on disk, not your editor's unsaved buffer. With autosave on, that is close to live.
- **It needs git.** Changes are found by diffing the working tree, and files that git ignores are never sent.
- **It spends usage in the background.** Every play-by-play look and every deep review is a model call on your plan. The play-by-play waits for a pause, sends only the change and its surroundings, runs one look at a time, and can be paused. A deep review costs more, because it runs a stronger model at a higher thinking level, so how often it runs is yours to set.
- **Mods are new.** The mod API is early access and can change between Claude Code releases. Panes are drawn by the terminal CLI and by the Code tab of the desktop app. The VS Code extension's chat panel runs mods but does not draw them, so use `claude` in the editor's integrated terminal there.
- **A mod is code that runs with your permissions.** This one is meant to stay small and auditable: it runs `git`, reads files inside the repository and its own plugin folder, calls models, keeps your profiles in its own store and draws a pane. It makes no network requests of its own, installs no git hooks and never writes to your working tree. `claude plugin validate` lists every event a mod hooks and every call it makes, so you can check that before installing.
- **The edit guard covers the editing tools.** A shell command can still write a file, so that part rests on the contract and on Claude Code's normal permission prompts.
- **Profiles last as long as you keep using Claude Code.** Claude Code clears a plugin's store once no session has touched it for its retention period (the `cleanupPeriodDays` setting). Backseat Driver touches its store whenever Claude Code starts, so a long break from the tutor alone does not lose your profiles.

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
│   ├── personas/               one style sheet per tutor persona
│   ├── agents/
│   │   └── deep-reviewer.md    read-only reviewer for deep reviews
│   ├── hooks/
│   │   ├── hooks.json          points Claude Code at the mod
│   │   └── register.tsx        the mod: switch, watcher, reviews, profiles, pane, guard
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
- [ ] **Tutor mode.** The contract as a skill, the `/backseat-driver` and `/bsd` switch, the system-prompt override, the edit guard and the personas. Useful by itself as a conversational tutor.
- [ ] **Play-by-play.** Watcher, gate, reviewer on the chosen model and thinking level, and the Play-by-play tab.
- [ ] **Deep review.** Commit detection, the timer, the read-only reviewer with its own model and thinking level, and the Deep review tab.
- [ ] **Profiles.** Language detection, the first-run questions, one profile per language shared across projects, hushing in chat or by key, lesson memory and the Profile tab.
- [ ] **Follow-through.** Explain and dismiss on each note, notes and reviews shared with the conversation, second opinions on contested points.
- [ ] **Tuning.** Fewer repeated notes, usage back-off and per-language guidance.

## Related

- [learning-output-style](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/learning-output-style), Anthropic's learning mode plugin: Claude writes most of the code and hands you small pieces to fill in. Backseat Driver goes the rest of the way, and you write all of it.
- Claude Code docs: [Mods overview](https://code.claude.com/docs/en/plugins/mods/overview), [Mods reference](https://code.claude.com/docs/en/plugins/mods/reference), [Plugin components](https://code.claude.com/docs/en/plugins/components), [Plugin manifest reference](https://code.claude.com/docs/en/plugins/manifest-reference), [Create a marketplace](https://code.claude.com/docs/en/plugins/create-marketplace).
