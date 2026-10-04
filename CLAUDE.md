# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working agreement

These are standing instructions from the repository's owner. Follow them without being asked again.

- **Keep this file current.** Whenever a change adds, removes or alters something this file describes (commands, layout, architecture, invariants, API gotchas), update this file in the same commit. Do the same when you learn something about the mod API that the next session would otherwise have to rediscover.
- **Write product decisions down as they are made.** When the owner states a requirement or a preference for the product, record it in `DESIGN.md`, which is the design spec, in the same session.
- **Keep the README short and human.** `README.md` says what the plugin is, why it was made, who it is for, how to get it and how to use it, and nothing more. Detail goes in `DESIGN.md`, and the README links to it. A new feature gets at most a line in the README. The README never reports internal status, such as what has or has not been tried, tested or installed: the owner called that invasive. That belongs in DESIGN.md's Status note.
- **Commit and push when a piece of work is complete.** Push to `origin main` without waiting to be asked. This does not cover force-pushing or rewriting pushed history. Ask before either.

## Status

Part one is built and not yet lived with. Part two (DESIGN.md, "Part two, being built") is under way: its milestones are the unchecked lines of the roadmap in DESIGN.md, built in that order. Every checked milestone was seen working in a short real session, with these exceptions. Tests only: the slow-down near plan limits (a real session cannot be put at 95% of its plan on demand), the edit guard (the tutor declined to edit before the hook was needed), and the deep review on its default model and thinking level (live runs used Sonnet at low thinking to keep them cheap). Since the persona was split into a voice and an engineering half, two pairs have been run: the `eli5-tldr-kiss-terse` voice with the `knuth` engineering persona, and the `primeagen` voice with the `torvalds` engineering persona. The animated persona has been seen in real sessions with every voice. The journal's sitting roll-up, two sessions sharing one journal, and the deep reviewer reading it have been run only in tests. Never run at all: the `primeagen` engineering persona, and installing from the marketplace. Nobody has done real work with the tutor yet, so the prompts in `plugin/prompts/` and `plugin/skills/tutor/SKILL.md` are the part most likely to need changing. The roadmap in DESIGN.md lists the milestones in build order and which are done. The approved plan for part two is in `~/.claude/plans/dynamic-wandering-micali.md` on the owner's machine. It lists nine decisions the owner approved and the risks to probe at the start of each milestone.

`DESIGN.md` is the design spec: the user flow, what the tutor remembers, the ground rules, a table mapping each behavior to a Claude Code mechanism, the settings and their defaults, limits, the file layout and the roadmap. Read it before changing anything.

`DESIGN.md` also makes statements about the present: the Status note, what Install says has and has not been tried, the layout tree and the roadmap checkboxes. So does the README, more briefly: the install commands and the minimum Claude Code version in its text and badge. Update them in the same change that makes them false.

## What this repository is

Backseat Driver is a Claude Code plugin. There is no application, build step or runtime of its own: Claude Code loads the plugin's files as they are, TypeScript included.

The plugin turns a session into a tutor for someone who writes their own code. The ground rules in the README and DESIGN.md, such as "Claude does not edit your files", describe that product behavior in an end user's session. They are not rules for working in this repository.

The repository root is a plugin marketplace (`.claude-plugin/marketplace.json`) and the plugin itself lives in `plugin/`. Keep that split. Everything in `plugin/` is installed on users' machines, and Claude Code's validator warns about a `CLAUDE.md` at a plugin's root, which `--strict` turns into a failure. So this file stays at the repository root and nothing like it goes in `plugin/`. `package.json`, `node_modules/` and `scripts/` are dev tooling and stay at the root for the same reason.

## Product decisions

Decided by the owner. Do not re-propose what was rejected, and do not design around the rest.

- **Why it exists.** The owner is concerned about the long-term cost of outsourcing our thinking to AI: unused skills fade, and an industry of engineers who can no longer write or judge code is fragile. They want to stay in the driver's seat, and they love learning: they are in it for the love of the game. Every other decision serves that: the person writes the code, and the AI makes them sharper. The README says this in plain words, and DESIGN.md ("Why it exists") records it.
- **The AI never drives, and is never sold as the faster way.** The project is against letting Claude write the user's code, not neutral about it. It is fine to say plainly that the tutor is not for having Claude write your code, and that `/bsd off` puts Claude Code back to normal. It is not fine to frame the tutor against "getting code written as fast as possible" or anything like it, because that casts writing your own code as the slow, second-best option. The owner rejected exactly that wording in the README.

- **Learning happens through the user's own projects.** No exercises, quizzes or practice mode (rejected). The tutor chimes in from the background, and the user tunes how often, how deeply and in what voice.
- **One command, then hands off.** `/backseat-driver` or `/bsd` is all a user has to type. Every setting has a default, every question can be skipped, and setup never blocks work: a language first met mid-session gets defaults, and its questions are offered in the pane instead of interrupting.
- **One profile per language, never per project.** The subject is `python`, not "python project 1", so it carries across projects. A language's profile matters only once the user works in that language. The tutor may read other profiles when that helps.
- **The user has the last word.** Pushback in chat is weighed. A contested point goes to the deep review model for a second opinion, and the user is told that is happening. "Do it my way" always stands. The play-by-play may keep flagging the point until the user says to hush, and a hush is saved to that language's profile at once.
- **Play-by-play is the pane's default view.** The deep review and the profile are other tabs.
- **First-run questions are few and single choice.** One about the language they know best, asked once ever, then three per new language, and never more than ten in one go.
- **Three jobs, each with its own model and thinking level.** The play-by-play comments while the user hacks. The deep review checks up on what they committed. Explain helps them read the codebase. Explain's cache is per project, where profiles are per language, and all three jobs feed it and read it.
- **Explain is never stale.** Where freshness and speed pull apart, freshness wins. Nothing is shown unless it matches the file on disk at that moment.
- **No editor plugins yet.** Plugins for vim and emacs come later. Build only the side they will talk to. The docs do not suggest autosave as a way to make the tutor closer to live: the owner rejected that, because the editor plugins are the answer.
- **Progress is honest.** One report per language across projects, with a level (beginner, junior, mid, senior), why, what the next level needs, recent notes and encouragement. Only the user's own work counts, so that hacking on someone else's excellent code cannot inflate it. A level can come back down. It stays in step with the deep reviews. The owner said it is worth the token burn.
- **State is never cleared by accident.** Clearing is deliberate and confirmed: one project, one language, or everything. Uninstalling clears everything.
- **Users stay up to date.** A newer release upstream is announced in the pane, one command fetches it, and the tutor comes back on by itself.
- **Everything feels instant.** No command waits on git or a model. The questions can be answered again in an obvious way.
- **The persona has a face, and it can be switched off.** A small animated character for the voice stands in the pane and speaks one short line at a time: at critical points and decision points in the user's code, a deep review's takeaway, and now and then a joke. Fun but unobtrusive: dim at rest, quiet unless a look gives it something to say, one line where rows are scarce, no model calls of its own, and off with one setting. A persona named after a real person gets an ASCII caricature of that person, in good spirit: the owner's call, after a first version with mascots was rejected as too timid. A caricature is a drawing, not an impersonation, and the tutor still never claims to be them or quotes them.
- **The tutor knows what the user is doing, and does not make them say it.** A journal per project records, in time order, what they save and what each save changed, where their editor's caret stays and for how long, which buffers are open and on screen, their commits and the notes raised, so that every model the tutor calls has an at-a-glance picture. What they are working on is worked out from that and shown in the pane. Being asked is a chore, so the one question, "What are you working on right now?", is asked only when they press `w` or run `/bsd working`, or by the tutor in chat when it is unclear and matters. Their answer overrides what was worked out, and they can take it back so that the tutor infers again. Borrowed from the owner's topstep-claudebot, whose journal and briefings keep its model aware of what is going on. Its reflection loop and inbox were not borrowed.
- **A persona has two halves, chosen apart.** The voice sets teaching style, tone and wording. The engineering persona sets what the tutor values, flags and recommends, and its `default` is Claude's own judgment, not tilted toward anyone's. Both apply in notes, deep reviews and conversation. A voice never brings its namesake's opinions about code, and an engineering persona never brings its namesake's manner. Neither overrides the contract. A persona named after a real person is "in the spirit of": the tutor never claims to be that person or to quote them, and it is hard on the code, never on the user.

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
- The type check reads the API types from `plugin/.claude-plugin/types/`. Claude Code writes that folder each time it loads the plugin from this working copy, so run `scripts/dev-session.sh` once on a fresh clone and again after a Claude Code update. A print-mode run writes it too, even with no login: `claude -p hi --plugin-dir ./plugin` fails at the model call after the types are written. The folder ignores itself in git.
- CI: `.github/workflows/check.yml` runs `npm run check` on every push to `main` and every pull request, on the Claude Code version the code was last verified against (see "Working on the mod"; bump `CLAUDE_CODE_VERSION` in the workflow with it). `nightly.yml` runs the same check once a day on the newest Claude Code, and a failure there means a release changed the mod API, not that `main` is broken. The README shows both as badges. `claude plugin validate` and `claude plugin test` need no login. Read a run with `gh run list` and `gh run view --log-failed`.
- A `--plugin-dir` session reloads the mod whenever one of its files is saved. A hook that throws or times out is skipped and the session carries on, and an invalid render tree is replaced by Claude Code's own drawing. Such a session shows one dim transcript line for each, and `claude --debug` logs every occurrence with its reason.

### Checking a change in a real session

Tests stub everything, so a milestone is only done when it has also been seen working in a real session. `scripts/dev-session.sh` starts one in tmux, in a throwaway git repository. Drive it with `tmux send-keys -t bsd '/bsd' Enter` and read the screen with `tmux capture-pane -p -t bsd`. Give the screen a moment between the two. Things to know:

- The script kills any tmux session with the name it uses, `bsd` unless `BSD_SESSION` gives another, and its throwaway repository and data folder are shared by default. With other Claude Code sessions working on this repository, set `BSD_SESSION`, `BSD_RIDE_DIR` and `BSD_DATA_DIR` to names of your own and use that session name in every `tmux` command below. Two sessions on the default name kill each other's sessions and type into them: it happened once, mid-check.
- To try a setting, pass `--settings '{"pluginConfigs":{"backseat-driver":{"options":{"deep_review_model":"sonnet"}}}}'`. Use it to keep real-session checks of the deep review cheap.
- A new folder shows the workspace trust prompt first: `Down`, then `Enter`. Keys sent before the session has finished starting are lost, so check the screen before typing.
- Send text and `Enter` as two separate `tmux send-keys` commands, and check that the prompt box is empty afterwards. Sent together, the `Enter` is often swallowed and the text just sits in the box.
- Keep the throwaway repository's path plain. With a long path full of dashes, the model mistypes it and the session stops on a permission prompt for a file outside the project.
- `tmux send-keys -t bsd C-x Tab` gives the pane the keyboard, after which its hotkeys (`e`, `d`, `l`, `1` to `3`) work. `Escape` gives it back.
- At 170 columns the pane docks beside the conversation even in tmux. `tmux capture-pane -p -t bsd | cut -c1-94` reads the conversation, and `cut -c95-` the pane.
- Saving a file under `plugin/` while the session runs reloads the mod, and the transcript says so. The mode and the pane come back by themselves.
- The session makes real model calls on the owner's plan. Keep prompts short, and pass `--model sonnet` unless the check needs another model.
- The owner's default permission mode is bypass. Pass `--permission-mode default` when the check involves Claude running tools.
- tmux gets the main-screen layout, where a pane opens inline above the prompt. `BSD_FULLSCREEN=1` asks for the fullscreen layout, where it docks beside the conversation.

## Architecture

Two layers (DESIGN.md, "How it works"):

- **Contract**: `plugin/skills/tutor/SKILL.md`, the tutor's rules as Markdown. It is the single source of tutor behavior. The mod injects this text into the system prompt and must not carry a second copy. Personas are Markdown files in two folders, `plugin/personas/voice/` and `plugin/personas/engineering/`, and the chosen engineering persona and voice, in that order, are injected after the contract and into both review prompts. Each file says which half it is and that it leaves the other half alone. That paragraph is what keeps a mixed pair apart, so a new persona file needs one too.
- **Mod**: `plugin/hooks/`, function hooks that run inside Claude Code.

### How the mod's code is split

Claude Code refuses a hooks module that passes `$` (the engine interface) to a function imported from another file, and it requires every `on(...)` and every `$.noun.method(...)` to be spelled in the module itself. That gives the code its shape:

- `register.tsx` is the only file with effects. Every hook is registered there, every call on `$` is written there, and functions that take `$` are declared there.
- Every other file in `plugin/hooks/` is pure logic: plain values in, plain values out. They are tested directly, without stubs.
- When logic in another file needs an effect, `register.tsx` hands it a capability: a closure such as `args => $.process.run(['git', ...args])`. Passing a closure over `$` across an import is allowed. Passing `$` is not.
- `atom(...)` definitions live in `register.tsx` too, with literal `plugin` and `key` strings, and every state key is declared in `plugin/types/index.d.ts`.
- Register each event once per matcher. Two `on('session.start', ...)` calls without a matcher stop the module from loading.
- A function that takes `$` must have a name no other declaration in the file shares, a local variable included. A `const [skill, look] = …` inside another function stopped the module loading, because `look` is also the function that makes a look.
- Write matchers as literals (`{ command: ['backseat-driver', 'bsd'] }`), not spreads or variables. The validator prints `command=?` for anything it cannot read, and that line is what a user audits.

Current files:

| File | What it holds |
| --- | --- |
| `settings.ts` | The `/config` values as typed settings |
| `mode.ts` | What a `/bsd` argument asks for, which mode it leads to, and the text of `/bsd help` |
| `contract.ts` | What goes into the system prompt and how instruction files are reframed |
| `guard.ts` | Which paths count as the user's files |
| `git.ts`, `noise.ts`, `diff.ts` | Parsing `git status`, which files and edits never deserve a look, a line diff |
| `watcher.ts` | What changed since the previous look. Takes its effects as ports, so its tests use a tree in memory |
| `gate.ts` | Whether a look is due |
| `notes.ts`, `prompts.ts` | Reading the reviewer's reply into notes, and building what the reviewer and the conversation are told |
| `review.ts` | The deep review's scope: reading the reflog, what counts as a commit, the request handed to the reviewer |
| `languages.ts` | File extension to language id, and a project's main languages from its file list |
| `profiles.ts` | A profile as stored and as changed: answers, hushes, lesson memory, and the text every prompt gets about the person |
| `hash.ts` | Fingerprints of text, for cache keys and folder names |
| `datahome.ts`, `storage.ts` | Every path in the data folder and what may be deleted there. JSON files through a `Disk` port |
| `forget.ts` | What `/bsd forget` can erase, the wording of its dialogs, and the paths each scope deletes |
| `knowledge.ts` | What is known about one source file, and the freshness rule: fingerprints, finding unchanged symbols after an edit, checking a model's outline against the file |
| `explain-prompts.ts` | The two requests Explain makes (map a file, explain a symbol or region) and reading their replies |
| `explainer.ts` | The lookup engine, with its effects as ports: the queue, what may be fetched when, and never storing an answer for text that has changed |
| `focus.ts` | The spot in focus, the two files an editor shares with the tutor, and what the conversation is told about the spot |
| `avatar.ts` | The animated persona: a character per voice, its poses, how a line is said one word a tick, and the speech bubble |
| `authorship.ts` | Whose work a commit is: its author against the person's git email, merges, co-author trailers, bulk imports, and the lines it added by language |
| `progress.ts` | The progress ledger and the rules for moving a level, the request for an assessment, and what the tab, the tool and every prompt are told |
| `project.ts` | What is known about a project as a whole: the notes a deep review leaves, what is kept of them, and what the play-by-play and the next review are told |
| `journal.ts` | The journal as stored: its entries, runs of saves, rolling a finished sitting up, and merging with what another session wrote |
| `attention.ts` | What an editor's `focus.json` says beyond the spot, and adding up the time the caret spends where it is and what is on screen beside it |
| `enclosing.ts` | The name of the definition a line sits in, by indentation and the common shapes of a definition, with no parser |
| `glance.ts` | The journal as text: the pane's "Working on" line, what the reviewers read, what the conversation gets with each prompt |
| `recorder.ts` | The journal's engine, with its effects as ports: what a save changed, the caret's time, writing the file |
| `working.ts` | The one question, "What are you working on right now?": its answers and `/bsd working` |
| `questions.ts` | The first-run questions |
| `pane.tsx` | The pane's tree from plain data, with the handlers passed in |

### The mode

Switching on answers at once. `switchTo` loads the contract, sets the mode and opens the pane, and those are awaited, because the contract has to be in force from the first prompt after the command. Everything else (the watcher, the profiles, the reviewer, the tools, the first-run questions) runs in `engage`, which the command does not wait for. `engagement` counts switches, and each step of `engage` and `startWatching` checks it after every await, so that switching off while git is still answering leaves nothing running. In a real session `/bsd` printed its line 190 ms after Enter and the pane was up at 250 ms.

The mode is `off`, `on` or `paused`, kept twice because each copy is lost by a different event. `$.state` survives a reload of the module (which a `/config` change also causes) but is reset by `/clear`, `/resume` and `/branch`. A module variable survives those but not a reload. `session.start` restores the variable from state, and `classic.SessionStart` with source `clear`, `resume` or `fork` writes the variable back to state. So the tutor stays on through both, and each new session starts with it off.

### Tutor mode

While the mode is `on` or `paused`, three hooks carry the contract:

- `prompt.compose` replaces Claude Code's `doing_tasks` section and appends one section, `backseat-driver:contract`, last and session-scoped. That section is the body of `SKILL.md`, then `SESSION_NOTES` and the profiles, then the engineering persona, then the voice. `doing_tasks` has to go because it says "find the method in the code and modify the code". The full prompt's section ids are `intro`, `system`, `doing_tasks`, `actions`, `tools`, `tone`, then session-scoped ones such as `memory`. A lean prompt has `lean_body` and no `doing_tasks`, and the code copes with that.
- `prompt.context` rewrites the `claudeMd` block. Claude Code opens that block with "These instructions OVERRIDE any default behavior". The hook swaps that paragraph for one that keeps the instructions in force except where they tell Claude to write code. The block also carries the user's global instructions, so it is reframed, not dropped. Switching the mode calls `$.ui.invalidate('prompt.context')`, because that event is cached.
- `tool.call` on `Edit`, `Write` and `NotebookEdit` returns `{ deny }` unless the path is Claude Code's own: under `~/.claude/` (its memory and plans) or its scratch folder `/tmp/claude-<uid>/`. Without that exception the tutor could not save a memory.

`SKILL.md` describes behavior only. Anything that names a command, tool or agent of this plugin goes in `SESSION_NOTES` in `contract.ts`, so that the skill still makes sense when it is used alone with mods off.

Seen in a real session on Sonnet: asked to "add a median function" in a repository whose `CLAUDE.md` says to always edit files yourself, the tutor declined, hinted, and used that file's conventions in its advice. Ordered to use the Edit tool, it still refused. It never called Edit, so the guard's refusal has only been exercised by the tests.

### Reviews

Two kinds of background review, configured separately (DESIGN.md, "Models and settings"):

- **Play-by-play**: one `$.model.complete` request with no tools and no history. Its notes go to the pane's Play-by-play tab. It is given the open notes and the notes the user dismissed in the files it is shown, and `applyReply` drops a new note that makes the same point (same file and topic slug) as either. Dismissed notes live in `$.state` beside the open ones until the tutor is switched off. The lesson memory counts only notes that reached the pane, so a repeat the reviewer sends for an open note is not a second time the idea came up.
- **Deep review**: a read-only subagent whose written review goes to the pane's Deep review tab. Two independent triggers: after each commit (on by default) and every N minutes (off by default). With both off it runs only on request. A commit-triggered review covers that commit. A timed review covers everything since the previous deep review, and is skipped when nothing has changed.

The deep reviewer is registered by the mod with `$.agent.register({ model, effort, tools })`, not shipped as a file in `plugin/agents/`. A subagent the mod spawns skips the mod's own `turn.step` hooks, so a registered spec is the only way to give it the user's thinking level. Its instructions live in `plugin/prompts/deep-review.md`. It is registered when the tutor is switched on, and an `agent.offer` hook withholds it from the model while the tutor is off.

How a deep review runs:

- Each tick compares the size and modification time of `.git/logs/HEAD` with the last tick's. Only when they differ does it run `git reflog -1`. A `commit`, `commit (amend)`, `commit (merge)` or `commit (initial)` entry is a commit to review. Any other move of HEAD (checkout, pull, reset, rebase) resets where "since the previous review" starts.
- `$.agent.spawn` resolves as soon as the reviewer has started, with its `agentId`. The answer arrives later as a `turn.complete` event carrying that id, and the hook there puts it in `$.state` for the Deep review tab.
- One review runs at a time. A commit made meanwhile is queued, latest only, and reviewed when the running one finishes.
- A timed review covers `git diff <where the previous review ended>` against the working tree, plus untracked files by name. A fingerprint of that scope stops the same uncommitted work from being reviewed twice.

Seen in a real session: a commit was noticed within one tick, the reviewer appeared in Claude Code's footer as a background agent, and its review was in the tab 12 seconds later (on Sonnet at low thinking, set through `--settings`). Nothing was appended to the conversation, then or on the following turn: no notification, no attachment, no turn.

A contested point is the one review that does land in the conversation. The tutor delegates it to the same deep reviewer and reports the verdict in chat, because the user asked there.

### Watcher

The watcher polls git and never calls a model. A play-by-play look needs all of: the working tree still for the quiet time (default 10 s), the minimum gap since the previous look elapsed (default 1 min), a real change (not whitespace-only, not only ignored, binary, generated or lock files), and no look in flight. A look sends the net change since the previous look. Work that was already uncommitted when the tutor was switched on is the baseline, not something to review.

How it is built:

- `watcher.ts` keeps a fingerprint (size and modification time) of every changed file at the last poll and at the last look. What differs is pending. It also keeps each changed file's text from the last look, which is what the next look is diffed against. A file not in that map was clean, so its baseline is `git show HEAD:path`.
- `collect()` returns the real changes. `settle()` records what a look saw, using the fingerprints from collection time, so a file that changed again while the model was thinking stays pending.
- A look that gets no answer settles nothing and counts as a failure, and each failure pushes the next look out (30 seconds, doubling, up to 10 minutes). A look whose answer cannot be parsed is settled and dropped, so a bad reply is never retried or shown.
- The prompt has a size limit. Files that do not fit are not settled and wait for the next look.
- After a reload of the mod, the watcher starts again from the tree as it stands. Notes survive in `$.state`.
- `register.tsx` writes `git --no-optional-locks` as a literal in its one `$.process.run` call, so that a reader of that file and the validator's output can both see that git is the only process.

Seen in a real session with the defaults: a file saved with a planted bug got its note 14 seconds later, nothing appeared in the conversation, `e` in the focused pane sent the explain request, and saving the fix cleared the note at the next look. The first live note bundled three problems into five lines, which is why `prompts/play-by-play.md` now says one idea per note and under 40 words.

- Near the plan's usage limit the background work holds back. `tick` reads `$.session.usage().rateLimits` (a free call) at most twice a minute, and only when something is pending. From 80% of the tightest window the minimum gap is four times longer and at least four minutes. From 95% no look or automatic deep review starts, the pane says "Holding back", and "look now" and "review now" still work.
- Polling is deliberate. Claude Code's `FileChanged` hook watches named files (a matcher of literal filenames, or `watchPaths` set at session start), not a working tree, and native watchers (inotify-tools, fswatch, Watchman) are extra installs. None of them is on the owner's machine. Anthropic's own `diff` mod polls `HEAD` the same way.
- The poll interval is not a setting. Start around 2 s and stretch it when `git status` is slow.
- Run every background git command as `git --no-optional-locks ...`. A plain `git status` refreshes the index under a lock and can make the user's own git commands fail.
- Commits are detected from `HEAD` and the reflog. The reflog subject (`commit:`, `commit (amend):`, `checkout:`, `pull:`, `rebase`) tells a real commit apart from other moves of `HEAD`.

### Profiles

DESIGN.md, "What it remembers about you". A profile is one JSON file per subject in the data folder (see "The data folder" below): `profiles/<language>.json` and `profiles/general.json`. It holds the first-run answers, the hushed topics, and the lesson memory (topics explained and topics that recur, with counts).

A subject is in play when it is one of the project's main languages (from `git ls-files` and an extension table) or the user changes a file in it. `personText()` turns the profiles in play into the text that goes into the conversation's system prompt, the play-by-play's system prompt and the deep reviewer's registered prompt. The reviewer is registered again whenever a profile changes, because a spawned subagent cannot be given anything at spawn time.

- **First-run questions** are asked with `$.ui.ask` at the end of switching on, after the pane and the watcher are running, so dismissing them loses nothing. Every subject asked about is marked `isAsked`, answered or not, and is never asked about again unprompted. The Progress tab (once the Profile tab) offers them for every subject in play, as "answer a few questions" or "answer again", and new answers replace the old.
- **What the user says about themselves in chat** goes through the `record` tool: one of the four answers (`level`, `goals`, `focus`, `knows`) for a language, in their words. It does not set `isAsked`, so a language first mentioned in chat still gets its questions when it first comes into play. Without it, answers could never be changed except by editing the store file.
- **Every question is single choice.** In Claude Code's dialog a single choice is one keypress. A multi-select needs a toggle, a move to Submit, Enter, and then a "Review your answers" screen. Four of those in a row is not a short questionnaire.
- **Hushes** arrive through the `hush` tool, which the tutor calls when the user states a preference, or through the `m` key on a note. The tool takes the open note's number when there is one, and then uses the note's own topic and language. In the first live test the model invented its own slug, the note stayed in the pane, and the tutor told the user it was gone. The tool's result now says how many notes left the pane, and the contract tells the tutor to say only what the tool reported.
- A hush works twice over: the reviewers are told ("Do not bring up"), which catches the idea however it is worded, and a note whose topic slug matches a hush is dropped even if a reviewer sends one.
- **Lesson memory** counts topics per language: `flagged` when the play-by-play raises one, `explained` when the user presses explain. Three or more flags make a recurring theme.

Seen in real sessions: the four questions appeared with Python detected, and the answers were saved (in the plugin's store at the time, in `profiles/` now). Told "stop telling me to use built-ins instead of my own loops", the tutor called `hush` at once with no permission prompt. In a second project the questions were not asked, and code whose only possible note was that topic got none, while two real bugs beside it were flagged. A contested note went to the deep reviewer, whose verdict came back into the chat 32 seconds later. Esc on the first question skipped all of them and left the tutor running. One chat message ("I have written Python for about six years... what I want most now is performance") produced two `record` calls with no permission prompt, and the Profile tab showed both. A note dismissed with `d` stayed away at the next look, while a new bug in the same file got its own note. With the timer at 5 minutes and the after-commit trigger off, a review of the uncommitted work started five minutes after switching on and was in the tab ten seconds later, with nothing in the conversation.

### Explain

DESIGN.md, "While you read" and "The editor side". The third background job: it explains the code the user is reading, from a cache that is per project.

**The never-stale rule** is the owner's hardest requirement for it, and it is enforced in `knowledge.ts` and `explainer.ts`, not left to callers:

- A symbol stores a fingerprint of the exact lines it covers, and its first line. `freshSymbols` finds each symbol again in the file as it is now, wherever its lines moved, and leaves out any whose text changed at all. A view is built only from those.
- An explanation stores the fingerprints of the symbols it said it relies on. `trusted()` drops it when any of them is no longer what it was. Names are resolved in the same file, or in another mapped file when exactly one has a symbol of that name.
- A model's outline is checked by `placeSymbols`: each symbol must quote its first line, which has to be found at the line it names or within five lines of it. An entry that fails is dropped.
- A lookup reads the file before and after the model call. An answer for text that changed in between is not stored (`stale`, or `again` for a mapping, which is then redone).
- The file summary and the outline's one-line summaries are shown only while the file's fingerprint is the one they were written for.

**The engine** (`createExplainer(ports)`) never makes a read wait on a model. `view(spot, intent)` answers from memory and disk and queues what is missing. The intent decides how eagerly:

| Intent | Who | Priority | Waits for the file to settle | Stops near the plan limit |
| --- | --- | --- | --- | --- |
| `asked` | `/bsd explain`, `n`, `p`, `f`, the lookup tool | first | no | never |
| `browsing` | an editor's cursor, a refresh of a spot already shown | first | yes | at 95% |
| `following` | a save | after those | yes | at 80% |
| (ahead) | two unexplained symbols after a file is mapped | last | n/a | at 80% |

- Settling: a file that changed on disk is not mapped for `SETTLE_MS` (2.5 s) after its last change, so that typing with frequent saves costs one mapping. Explaining a symbol never waits, because it is of text that is in the file right now.
- Two lookups run at once, plus one more for a spot someone is looking at.
- Lookups for one file land side by side, so `commit()` applies each change to the latest state with nothing awaited in between, and writes the file one write at a time. Before that, two explanations landing together lost one of them.
- A lookup checks again, right before it calls the model, whether its answer is already there. Two things that noticed the same gap cost one request.
- A failed lookup is not retried for a minute (`RETRY_MS`).

**In `register.tsx`**: `startExplaining` builds the ports and is part of `engage`. `refreshView` makes the view for the spot in focus, puts it in `$.state` for the tab and writes `view.json`. The focus moves with whatever moved last: the editor's `focus.json`, `/bsd explain`, the pane's keys, the lookup tool, or a save (which goes to the first symbol that changed, and does not pull the focus away from an editor that reported its cursor in the last ten minutes).

While the tab is open or an editor is live, `fastPoll` runs every 100 ms: it stats the focused file and the focus file, and refreshes the view when either changed. That is what takes an old explanation off the screen within a tenth of a second of an edit, instead of at the watcher's next two-second poll. With nobody watching, it stops. `focus.json` is read in one place, `readFocus`, and `pollFocus` hands each new reading to the journal and then to Explain (`followEditor`), so the two never disagree about where the caret is.

Seen in a real session, on Sonnet at low thinking: `/bsd explain stats.py:11` in a file never seen before showed the full explanation 6.6 seconds later. Stepping through cached symbols with `n` and `p` took 40 to 80 ms each. Editing the function on screen took its explanation off after about 60 ms, and the new one arrived 9 seconds later. A script writing `focus.json` got its answer in `view.json` in 40 to 80 ms. In a fresh conversation, asked what a function does, the tutor called `lookup` with no permission prompt. In a conversation where it had already read the file, it answered from that instead, which is fine.

### The animated persona

DESIGN.md, "The animated persona". A character per voice stands at the top of the Play-by-play and Deep review tabs and says one line at a time. `avatar.ts` holds the art and every rule about it, and `register.tsx` moves it.

- **Where its lines come from.** The play-by-play's reply has a `say` field. `prompts/speech-bubble.md` asks for it and goes into the reviewer's system prompt only while the setting is on, and the last line of each request says what the bubble may hold: `insight` normally, `remark` after `QUIET_LOOKS_BEFORE_REMARK` (four) looks in a row that said nothing. Each look's `say` replaces the line, so a quiet look leaves it quiet and it never talks about code that has changed since. A finished deep review gives it the review's last line, which `deep-review.md` makes the one thing most worth doing next. Switching on gives it its `hello`. No line costs a model call of its own.
- **How it moves.** `say` writes the line to the `speech` atom at `tick` 0 and starts a `$.clock.every(TALK_MS)` timer. Each tick says one more word through `update` with `nextTick`, which is a compare-and-set, so a tick cannot overwrite a newer line. The mouth moves on alternate ticks, and the timer stops when the line is out. A second timer blinks it every `BLINK_MS`, with a `$.clock.after` to open its eyes, only while the mode is `on` and it is not talking. Switching off cancels both and resets the speech. A reload loses the timers, so `startAnimating` marks a half-said line as said.
- **How it is drawn.** `poseOf` works out the pose at render time from the mode, the watcher and the speech: asleep while paused, talking, eyes up while a look runs, blinking, or at rest. At rest it is drawn dim. The bubble is sized for the whole line from its first word, so the pane does not reflow while it talks, and no wider than the line needs. Above the prompt, or on a surface other than the terminal, it is one line from the `mini` frames.
- **Art rules.** Every pose of a character has the same height and every line the same width, drawn only with printable ASCII and the block elements Claude Code draws its own mascot with, so that nothing is double width. `avatar.test.ts` checks both. Each character names its `mouth` row, and `bubbleColumn` puts blank rows above the bubble so that its tail is level with it: a tall face otherwise speaks from its hair. The ASCII characters speak in an ASCII bubble (`bubbleStyle`), Claude's mascot in Claude Code's own box lines. The pane drawing in DESIGN.md uses Linus, because GitHub's code font may lack the block elements.

Seen in real sessions on Sonnet at low thinking: switched on, the mascot said its hello word by word in Claude's orange and then dimmed to gray. It blinked, and its eyes turned up while a look ran. Then, arms flapping, it said "Every membership check on a list is a scan; think about what this collection is for." about a list used for membership tests, and paused it slept. With the `primeagen` voice and the `torvalds` engineering persona in a 100-column terminal, the pane sat above the prompt and the character said, in one line, "Factory, abstract base, one square. That's a lot of ceremony for four sides, chat." beside a note asking what each layer of a one-class hierarchy buys. Each of the four caricatures was later seen saying its hello with its mouth moving, blinking, and asleep while paused, with the bubble's tail at its mouth.

### The project cache

DESIGN.md, "What it learns about a project". `projects/<id>/project.json` holds the overview, each file's role and the deep review's insights. `reviews.json` holds the last twelve reviews' text. `files/` is Explain's.

- **The deep review writes it.** `prompts/deep-review.md` asks every review to end with a fenced `backseat-notes` JSON block. `splitReview` takes the block off before the review reaches the pane, whether or not it parses, so the person never sees it. `keepReview` in `register.tsx` reads the project file right before writing it, merges the notes (`withReviewNotes`), and appends the review's text to `reviews.json`.
- **An insight is tied to code.** It is kept with the fingerprint of the symbol it names (from the explainer, when the file has been mapped) or of the whole file, and with which of the two that is. One that cannot be fingerprinted is not kept. `insightsFor` shows it in Explain only while that fingerprint matches, and `currentInsights` passes it to the play-by-play only on the same condition. In the play-by-play's case the file has just changed, so a file-level insight is dropped and a symbol-level one survives when that symbol was not edited.
- **The overview** is project-wide and cannot be fingerprinted. It carries the commit it was written at, and the reviewer is given it with an instruction to correct it.
- **The survey** is a `ReviewScope` of kind `survey`: no change, a request to look around. `maybeSurvey` runs it once per project (`isSurveyed`), from `engage` on a fresh switch-on, and not when both deep review triggers are off or usage is at 80% or more. A survey's text goes to the Deep review tab and is not kept in `reviews.json`.
- **The next review follows up.** `reviewRequest(scope, { overview, earlier })` gives it the overview and `reviewDigest` of the last three reviews.
- In the kit, a project counts as surveyed already unless `stubSession(on, { isNewProject: true })`, so that a test's first subagent is its own.
- Seen in a real session on Sonnet at low thinking, in a fresh two-file project: the survey started on switch-on and was in the Deep review tab about ten seconds later, as plain prose, with the overview and both files' roles in `project.json`. A commit's review landed twelve seconds after the commit, with no notes block in the tab and three insights in the cache. `/bsd explain` on a function then showed the review's insight beside it with its commit, and editing the file took the insight off the screen 200 ms later.
- **A save moves the Explain focus to where the change began**: `firstChange` between the text the explainer last read and the new one, past blank lines. Before, it went to the first symbol that had changed, which is line 1 when the change is a new function.

### The journal

DESIGN.md, "What you are working on". What the person does in one project's code, in time order, so that every model the tutor calls knows what is going on: `projects/<name>-<hash>/journal.json` in the data folder. `recorder.ts` is the engine, with the disk and the repository as ports. `register.tsx` starts it in `engage` (`startJournal`), feeds it from every watcher tick (`keepJournal`) and from `pollFocus`, and drops it when the tutor is switched off.

- **What goes in.** Each tick hands the recorder the files `git status` saw change since the last poll. It diffs each against its text at the previous save, or at HEAD for a file that was clean, or as it was at switch-on for a file already dirty, so that uncommitted work is not counted as a save. A `save` entry holds the lines added and removed, where (a few merged runs of lines) and the names of the definitions it touched (`enclosing.ts`). Saves of one file under two minutes apart are one run, until a commit or another move of HEAD comes in between. Commits, other moves of HEAD, notes raised, notes dealt with in the code, dismissals, deep reviews, switching on, and what the person says they are working on are entries too. No entry holds code. The diffs of the three files saved last are kept in memory only, for the `activity` tool.
- **Attention.** An editor writes only where its caret is, in `focus.json`, and never a duration. `attention.ts` credits each poll's time, ten seconds at most so that a laptop that slept adds nothing, to the caret's line, and to the files `visible` beside it. It does so while the editor has written in the last two minutes (`LINGER_MS`) and does not say `active: false`. Every two minutes (`SLICE_MS`) that becomes `focus` entries: up to three regions per file, plus the rest of the file's time. A region is a run of lines within 20 of each other and inside one definition, named after the line the caret stayed on longest. Files beside it get `screen` entries. The definition the caret is in is named at the next tick, so a caret that stays put costs one read of its file however often the editor writes. What `focus.json` said before the tutor was switched on is a baseline, and earns no time until the editor writes again.
- **Sittings.** An hour with nothing recorded ends a sitting. Whenever the journal is read or written, every sitting that is over is rolled up (`digest`) into its files, its commit titles and what was said, and only the open sitting keeps its entries. The last twenty sittings are kept. One with no save, no commit and under a minute of editor time leaves nothing.
- **Writing.** The recorder writes at most every 30 seconds while something new has come in, at once when the person says what they are working on, and when the tutor is switched off. Before every write it reads the file again and merges (`sync`). An entry this session never saw is another session's, and is kept. One it saw and no longer holds was rolled up or grew into a run, and is dropped. For what was said and what was inferred, the later wins, and a tie goes to this session. Every entry goes through `parseEntry` before it is held, so that one entry always has the same JSON, which is what `sync` compares.
- **What reads it.** `glanceText` comes first in every play-by-play prompt and last in every deep review request. It holds what they said they are working on, what the last look made of it while that still fits (`holds`: under an hour old, and the activity still touches a file that look saw), and where the last ten minutes went, by file. A save weighs as much as a minute in the editor, and time beside the file in front a quarter of it. Then come the caret, the sitting so far in order (fourteen lines at most) and the previous sitting. `briefText`, a few lines of the same, goes with every prompt the person types, through `prompt.submit`. The `activity` tool answers with the glance and the latest diffs.
- **Working on.** The play-by-play's reply has a `working_on` field, which `prompts/play-by-play.md` asks for on every look. It is kept as `inferred`, with the paths that look saw, and a move of HEAD that is not a commit clears it. The pane's line shows what they said, else what was inferred while it holds, else where their activity is (`workingOf`), and it is hidden outside a git repository. `w`, and `/bsd working` with nothing after it, ask "What are you working on right now?" with two answers and free text. The first answer is what Enter gives, and it never loses anything (`workingChoices`). Their words come in through `/bsd working <words>`, the `working` tool or a typed answer. "Let the tutor work it out", `/bsd working clear` and the tool with an empty string take them back.
- `/bsd forget project` deletes the journal with the project's folder, and `recorder.reset()` drops what the session holds, or the next write would bring it back.

Seen in a real session on Sonnet, with a script writing `focus.json` in place of an editor. The pane said "Working on stats.py, in mean" four seconds after the script put the caret there, with "100% of the last 10 minutes in the editor". Twelve seconds after a save that added a `median`, the look's `working_on` turned the line into "writing a median function in stats.py", beside a note on the even-length case. Asked "why does this give the wrong answer for four numbers?", the tutor knew "this" was `median`. Told "I'm working on the summary stats for the weekly report", it called `working` with no permission prompt. Its first call had no `on` at all, and at the time that cleared the line, which is why a call without `on` now records nothing. `/bsd working clear` brought back the inferred line. `w` showed the dialog with the inferred guess as its second answer, and a typed answer replaced it. A reload of the mod kept everything, because it is read back from the file. A commit was in the file within 30 seconds, and `/bsd off` wrote the last two minutes of editor time. Asked what it had been up to, the tutor called `activity` and summed it up in two accurate lines. The first slice merged eleven seconds in `mean` and two minutes in `median` into one region named `median`, which is why a region now also ends where the definition changes. Only in tests: a sitting rolled up after an hour, two sessions writing one journal, and the deep reviewer reading the journal, because the after-commit review was off in that session.

### Progress

DESIGN.md, "How you are doing". The owner's requirements: honest levels (beginner, junior, mid, senior) per language across projects, judged only on the person's own work so that a polished codebase cannot inflate them, able to come back down, in step with the deep reviews, and "worth the token burn".

- **Model observes, code decides.** One `$.model.complete` on the deep review model (`prompts/progress.md` holds the rubric) returns observations, each a skill slug, `shown` or `missed`, the level the skill belongs to, and a note, plus a proposed level and the report's text. `decideLevel` in `progress.ts` decides what the level becomes: nothing before five observations from two commits, a first placement capped by the highest level with two observations' worth of evidence, one step at a time, up only on four weight of next-level evidence from two commits with the model agreeing, down on two weight of missed evidence at or below the level from two commits when the model proposes lower or the misses outweigh what was shown. Provisional until twelve observations from four commits. Every change is in `history` with its reason and the observation count it happened at, and "since the last change" is counted from there.
- **Whose work.** `judge` in `authorship.ts`: the author's email must be in `identity` (`git config --get user.email` in the repository, which falls back to the global one, plus `--global` when it differs), not a merge, no `Co-authored-by` trailer or tool line, at most 600 added lines and 25 files, and at least `MIN_LINES` (3) non-blank added lines in a language. Only added lines are read (`git show --unified=0`). The Progress tab's dim status line says why the last commit did not count.
- **Weight.** A commit counts 1 when the watcher saw at least half of its files change before it was made (`watchedPaths`, filled from `tick` and emptied as commits are assessed), else 0.5. A first placement's commits are always 0.5.
- **When.** `assessCommit` runs from `turn.complete` after a commit's deep review (with the review's text, or without it when the review failed), or from `checkHead` when after-commit reviews are off. Not near the plan limit. `placeFirst` runs on a fresh switch-on for each of the first two languages in play that has no level: up to five of the person's commits among the last 30, in one request. `progressQueue` runs one assessment at a time, and each reads the record again right before writing it. A commit's full hash goes in `assessed`, so none counts twice, in any project.
- **Who is told.** `aboutPerson()` adds `progressText` to the profile text in every prompt: the conversation, both reviewers and Explain. The `progress` tool answers "how am I doing?". The deep reviewer is registered again after each assessment.
- **Observations are keyed by the full commit hash.** In the kit every commit's short hash is `0000000`, which first made two commits count as one.
- **Slipping** is decided per commit: a skill is slipping when an earlier commit showed it and the latest commit that touched it only missed it. Showing and missing it in one commit is a mixed result. In the first live run, a commit that handled negative sizes but not strings had the skill marked slipping, which is what led to this rule.
- **The tab** is still `profile` inside (`tab-profile`, hotkey 4), labelled Progress. Other sessions' tests press that key.
- In the kit, `session.commit(message, { author, body, isMerge })`, the person's email is `stubSession(on, { email })` (default `me@example.com`, `''` for none), assessments are answered with `session.assess(reply)` and recorded in `session.assessments`.

Seen in a real session on Sonnet at low thinking, in a project of two polished commits by a "Famous Maintainer" and one four-line `area` function of the person's: switching on read only the person's commit, said "no level yet: 4 of 5 observations, from 1 of 2 commits", and called the function's `print` and missing validation early habits. A second commit, saved while watched, placed them at junior (provisional), with what mid would need. A commit with a `Co-Authored-By: Claude` line was ruled out in the tab. Asked "how am I doing in Python?", the tutor called the `progress` tool with no permission prompt and gave the same honest answer.

### The data folder

Everything the tutor keeps between sessions is a JSON file under one folder: `$BACKSEAT_DRIVER_HOME`, else `$XDG_DATA_HOME/backseat-driver`, else `~/.local/share/backseat-driver`. `datahome.ts` builds every path in it. `scripts/dev-session.sh` sets `BACKSEAT_DRIVER_HOME` to a scratch folder (`BSD_DATA_DIR`), so a live check never touches the owner's real data.

- **Why files and not `$.store`.** Profiles lived in the plugin's store until part two. The store is capped at 4 MiB in total, is a separate file for each way the plugin is installed (`--plugin-dir` and a marketplace install did not share profiles), and is cleared after `cleanupPeriodDays` without use. None of that suits a database that is meant to grow, and future editor plugins need a path they can find. `moveOutOfStore` copies any `subject/<x>` key into `profiles/<x>.json` when the tutor is switched on and deletes the key. A profile already in a file wins.
- **Why not SQLite.** The hooks module cannot load it, and the `sqlite3` binary is missing from many machines, the owner's included.
- **Reads and writes** go through a `Disk` (`storage.ts`): four closures that `diskOf($)` in `register.tsx` builds from `$.fs` and `$.process`. Engines take a `Disk` as a port, and tests hand them `memoryDisk()`. A write is the whole file and is not atomic, so `readJson` treats a file that does not parse as missing, and every writer reads right before it writes.
- **Deleting.** `$.fs` has no delete, so `Disk.remove` runs `rm -rf -- <path>`. It is the only process besides git. Two guards stand in front of it: `isRemovable` accepts only a path under one of the folder's own children (`profiles`, `progress`, `projects`, `focus.json`, `view.json`, `update.json`) with no `.` or `..` segment, and the folder must hold the marker file `.backseat-driver`, which `markHome` writes before the first write. A `BACKSEAT_DRIVER_HOME` that points at somebody's documents therefore loses nothing.
- **`/bsd forget`** (`forget.ts` for what each scope deletes, `forget()` in `register.tsx` for the dialogs). Every dialog is `$.ui.ask` with "Keep it" first, so Enter keeps. Only the exact answer "Forget it" goes on, and forgetting everything also needs the phrase typed into the dialog's free-text row. The command itself returns at once and the result arrives as a transcript line from `$.ui.log`, which Claude Code already prefixes with the plugin's name. It works while the tutor is off.

Seen in a real session under `--permission-mode default`: a profile seeded in the old store file moved into `profiles/` with the marker beside it and left the store file as `{}`. `/bsd forget python` with Enter kept the file, and with "Forget it" deleted it. Forgetting everything took the typed phrase and left only the marker. Measured there: a write outside the project took 8 to 16 ms, a read or a listing 3 ms, a stat 1 ms and `rm` 5 ms.

### Invariants

- **Dormant until switched on.** Claude Code registers a plugin's hooks at session start, whether or not the user ever runs `/backseat-driver`. While the mode is off, every hook passes through with `next(e)`: no pane, no model call, no prompt change, no denied tool call. There is no exception: starting a session with the tutor off reads nothing and writes nothing. `/bsd forget` and `/bsd help` work while it is off, because the user asked.
- **Background reviews stay out of the conversation.** Neither the play-by-play nor an automatic deep review may become a turn in the user's conversation. Only what the user does in chat or in the pane becomes a turn. Both were checked in real sessions: `$.model.complete` and a subagent started with `$.agent.spawn` leave no row in the conversation.
- **Model and thinking level are the user's settings.** Both reviews read their model and thinking level from `userConfig`. Nothing is hard-coded and no model id is pinned. Defaults: play-by-play `sonnet` at `medium`, deep review `opus` at `high`. "Thinking level" in DESIGN.md is Claude Code's effort level (`low`, `medium`, `high`, `xhigh`, `max`).
- **Hard rules are hooks, teaching style is the contract.** "Claude never edits the user's files" is a `tool.call` denial of `Edit`, `Write` and `NotebookEdit`. How to hint and explain lives in the skill, and applies to deep reviews as much as to notes.
- **Small, auditable footprint.** DESIGN.md ("Limits") promises that the mod runs `git`, reads files inside the repository and its own plugin folder, calls models, keeps what it remembers in its own data folder and draws a pane, and that the only other program it runs is `rm` inside that folder when the user asks it to forget. A new kind of call in the validator's `calls:` list (`http.fetch`, a write outside the data folder, a process other than `git` and that `rm`) breaks the promise and needs a deliberate change to that promise in DESIGN.md, and to "Good to know" in the README. The validator also prints `env reads:`, which should stay at `BACKSEAT_DRIVER_HOME`, `HOME`, `USERPROFILE` and `XDG_DATA_HOME`.
- **No git hooks.** Installing a `post-commit` hook would write into the user's repository, so commits are found by polling.

## Working on the mod

The mod API is early access and changes between Claude Code releases. Mods need 2.1.287 or later, and the code was last verified against 2.1.289. Load the `plugin-authoring` skill before writing or debugging hooks. The type declarations in `plugin/.claude-plugin/types/claude-code/index.d.ts` are the authority: they outrank memory, the docs site and the API names in DESIGN.md. Grep them for the name at hand.

Easy to get wrong:

- The hooks module has no Node and no DOM, and may not use `import()`. Everything outside the module goes through `$`.
- State that a drawing reads belongs in `$.state`. Module variables are lost on reload. A `ui.render` hook can read state but not write it.
- `/clear`, `/resume` and `/branch` reset `$.state` without firing `session.start` again. `classic.SessionStart` fires instead.
- A pane opened by the user's own command is placed at any terminal width. One opened unprompted waits for 144 columns.
- `prompt.compose` is not cached and cannot be invalidated: it runs each time a system prompt is rendered. `prompt.context`, `prompt.section` and `tool.describe` are cached until `$.ui.invalidate` names them.
- `$.model.complete` takes the thinking level directly, as `effort`. `$.agent.spawn` takes a `model` but no effort, and the mod's own `turn.step` and `tool.call` hooks do not see a subagent the mod spawned.
- A mod's tool is served by answering `tool.call` without calling `next`, and no permission prompt appears: seen in a real session. Declare the tool's input in `plugin/types/index.d.ts` under `McpToolInputs`, or a matcher on its name does not type-check. Declare a tool with no input as `Record<never, never>`: with `Record<string, never>`, `$.tool.call({ tool })` does not type-check, because the index signature forbids the `tool` field.
- `update($, atom, fn)` fails to type-check with a misleading "Atom<...> is not assignable to StateRef" when `fn` builds an object whose fields are a union of literals. Annotate the return type: `(watch): Watch => ({ ...watch, state: 'looking' })`.
- A `userConfig` string field with `options` only ever arrives as one of them: Claude Code reads any other saved value as the field's default and reports it ("option engineering in settings is not one of ..."), in tests too.
- A `userConfig` picker (`options`) works only on string fields. The timer interval is therefore a string picker and the after-commit trigger a separate boolean. Changing a setting in `/config` reloads the mod with the new `options`. Seen in a real session: each setting is a row there (search for its title), the transcript says "options changed — reloaded", and the tutor stays on with the pane open. For the working copy the value is saved in `~/.claude/settings.json` under `pluginConfigs["backseat-driver@inline"]`, so a check made this way changes the owner's own settings: put the value back afterwards.
- `$.ui.ask` asks one question per call, with two to four options plus free text. It rejects when the user dismisses the dialog, which the first-run questions treat as "skip the rest", and it rejects under `claude -p`. In tests it reaches the `tool.call` stub as a call to `AskUserQuestion`.
- `$.store` holds 4 MiB of JSON in total, is per install, and is cleared after `cleanupPeriodDays` without use, which is why nothing is kept there any more. It has `get`, `set`, `delete` and `keys`.
- `$.fs` has `read` (4 MiB at most), `write` (creates folders), `list`, `exists`, `stat` and `ancestors`. It has no delete and no rename. `list` rejects on a missing folder, and `read` on a missing file. Paths may be absolute and outside the project, and no permission prompt appears.
- `$.env.get` takes the variable's name as a string literal, and the validator lists the names.
- A hook has ten seconds of its own time per dispatch. Time spent inside a `$` call does not count, except `$.clock.sleep`, and awaiting a plain promise does. The `lookup` tool therefore waits at most six seconds for an answer and then says what it has.
- A call a mod makes on `$` goes through every other plugin's hooks and skips its own. A prompt the mod submits with `$.prompt.submit` does not pass its own `prompt.submit` hook, so nothing that hook attaches goes with it. Put what the model needs in the prompt's text, or give it a tool.
- `$.model.complete(request, { signal })` can be cut short. An aborted call resolves, it does not reject.
- `$.clock.after(ms, fn)` is a one-shot timer, beside `$.clock.every`. Both return a `Timer` with `cancel()`, and a reload of the mod cancels them all.
- `dimColor` on a `Text` that also has a `color` draws it in the theme's gray: the color is replaced, not dimmed. `color` takes a theme key such as `claude`, Claude's orange, or a terminal color name.
- A state write that a drawing read redraws a shown pane at most thirty times a second in the terminal, and `$.ui.invalidate` follows the same limit. The animated persona ticks about seven times a second while it talks and not at all at rest, apart from a blink.

In tests:

- `stubSession(on, options)` in `plugin/tests/kit.ts` is the whole fake world: the session, a git repository under `/work` with `write()`, `commit()` and `checkout()`, a clock (`session.clock.advance(ms)`), a model that answers from `session.reply(...)`, and subagents that finish when the test fires `$.turn.complete(session.finish(n, answer))`. `advance` resolves after the timers it fired and the work they started have settled, so an assertion can follow it directly.
- A plugin's `$.agent.spawn` behaves differently in the kit than in a session. The `agent.spawn` stub receives the Agent tool's spelling (`subagent_type`, not `subagentType`), has to return `{ model }`, and whatever `agentId` it returns is dropped: the plugin gets `{ model: 'inherit' }`. Claude Code sets the id itself in a real session. So `register.tsx` falls back to `$.agent.list()` to find its reviewer by type, which is also what it needs when another mod answers the spawn, and the kit stubs `agent.list`.
- `session.logs` holds what the plugin wrote with `$.ui.log`. A swallowed error shows up there.
- Engines that take ports are tested without the kit. `explain.test.ts` has a `world()` whose model is answered by hand (`w.answer(request, reply)`), which is how a test changes a file while the model is still "thinking".
- In the kit, Explain's requests are kept apart from the play-by-play's: `session.lookups`, answered with `session.explain(reply, 'text the prompt contains')`. Lookups run side by side, so a test cannot count on their order. With no answer set, a file maps to no symbols. `session.editor(file, line)` writes the focus file as an editor would, and a fourth argument adds the protocol's other fields, such as `buffers`. A test about the journal's time in the editor sets `explain: 'off'`, because a live editor also starts Explain's poll ten times a second, which makes a test that advances minutes slow.
- Each period of a `$.clock.every` timer is one dispatch, and the kit gives it ten seconds of real time. A timer whose period spans many simulated ticks, such as the five-minute deep review timer over 150 polls, can run out of time on a loaded machine. The engine then reports "test's clock.every hook was skipped: exceeded 10000ms budget", and the interval ends. The deep review timer test fails this way when several sessions run tests at once.
- The kit has a second disk for everything outside the fake repository: `session.disk` (absolute path to text), seeded with `stubSession(on, { data: { 'profiles/python.json': profile } })` and read back with `session.data('profiles/python.json')`. `session.removed` lists what the plugin deleted with `rm`. Forgetting needs the marker, so a test that expects a deletion sets `session.disk.set(MARKER_PATH, …)` or makes the plugin write something first.
- A test that starts a session is written with `sessionTest` from `kit.ts`, not `test`. It is the same function with a 30-second limit in place of the default five. Every test file runs at once, each in its own process, and each test loads the whole mod first, so on a busy machine a session test can take four seconds before it has done anything. Tests of pure functions keep `test`.
- Under heavy load (two sessions running the suite at once), `advance` once resolved before a deep review that the timer had started had finished spawning, and the assertion after it failed. An `await session.clock.settle()` before asserting on what timers started makes that reliable.
- A stub can be registered only once per event. To see inside a failing test, add what you need to `stubSession` rather than registering a second `ui.log` or `tool.call`.
- Take temporary debug lines out by hand. `git checkout <file>` also throws away every other uncommitted change in that file.

- `$.command.run` resolves when the command's hook returns, not when work the hook left running has finished. After switching the tutor on, `await session.clock.settle()` before touching the fake repository, or the test's first save lands before the watcher has read the tree and becomes part of the baseline.
- `e.props.isFocused` in the pane's `ui.render` hook says whether the pane has the keyboard. Hotkeys do nothing until it does (Ctrl+X Tab or a click, Esc to hand it back), so the pane says how while it is not focused.

- `Text` takes no `key`. Give keys to `Button`, `Input`, `Select` and `Markdown`, and find text with `ui.find({ type: 'Text', text })`. A `find` that comes back undefined after a mount that did not reject usually means this.
- The kit answers `$.ui.invalidate('ui.render')` by itself, but not the invalidation of a prompt event. Stub `ui.invalidate` or the call is dropped with a line under "the engine reported".
- `test(name, { options: { engineering: 'knuth' } }, body)` sets `userConfig` values for one test.
- `stubSession(on)` in `plugin/tests/kit.ts` registers every stub the plugin needs to start and switch modes. Use it and add to it.

- Nothing is real. Almost every `$` call the mod makes needs a stub registered with `on(...)` before the test's first call on `$` (`$.state` and `$.ui.invalidate` are the exceptions), and `session.start` runs only if the test fires it.
- Tests are type-checked, and the types are stricter than the docs' examples. `$.command.run` needs `origin` and `presentation` (use `typed()` from `plugin/tests/kit.ts`), and a `command.register` stub returns `{ value: { command: e.name } }`, not `{ value: undefined }`.
- A test's own `$` has no `state`. Check state through what the pane draws, or through what the plugin sends and logs.
- The plugin's timers move only when the test moves the clock. After `/bsd` the animated persona's hello stands at its first word until the test advances by `TALK_MS` a word.
- Each test starts with the module freshly loaded and `$.state` at its defaults. A test cannot reset `$.state` halfway through, so what `/clear` does can only be approximated.
