# CLAUDE.md

AI-only reference for this repository. Terse by design. `README.md` is the only human document; this file is everything else. There is no separate design spec.

## Rules (owner's standing instructions)

- Keep this file current: any change to what it describes (commands, layout, behavior, invariants, API gotchas, verification status) updates it in the same commit. Record mod-API discoveries the next session would otherwise rediscover.
- Record product decisions here (section "Product") the session the owner states them.
- Commit and push to `origin main` when work is complete, unasked. Never force-push or rewrite pushed history without asking. Other sessions push to `main` too: fetch and rebase before pushing, stage by path, never `git add -A`. To push without publishing another session's unpushed local commit, commit from a worktree based on `origin/main` and `git push origin HEAD:main`.
- README rules:
  - Sections only: why, what it is, what it is not, who it's for (and not for), how to use it. Nothing said twice. Short.
  - Owner's voice, as in their Enchant Games Journal (https://enchant.games/?slug=journal, feed `/rss.xml`, articles are YAML under `/news/`, listed in `/news.json`): first person, short punchy lines, blunt, a little irreverent, quotes as punctuation. Keep that voice.
  - No internal status (what was or wasn't tried, tested or installed): the owner called it invasive.
  - Never tell users how to run their workflow (which terminal or editor, where to run `claude`). State what works and where.
  - Never frame writing your own code as the slow option (no "for getting code written as fast as possible"). Saying the tutor isn't for having Claude write code, and that `/bsd off` restores normal Claude Code, is fine.
  - Never suggest autosave to make it closer to live: editor plugins are the answer.
  - Never link to this file or to design detail. A new feature gets a line at most.
  - It carries facts that must stay true: install commands, minimum Claude Code version (text and badge), the `/bsd` command table, the footprint line under "What it is not".
- Pronouns: the owner's are not stated. Use "the owner" or they/them.

## Product

### Why it exists (owner's reasons; every decision serves them)

- Ownership of understanding over speed: "if it takes me longer, but I grok it".
- The progressive surrender of engineers' technical autonomy (environment, tools, stack, now their brains). Unused skills fade. Developers who handed their work to agents commonly report losing the ability to code within months. People steering an agent think they are in the driver's seat while the machine thinks for them.
- The love of the game: the craft is the point.
- Iron sharpens iron: mentorship with a beginner's mind.

Stance: the project is against Claude writing the user's code, not neutral. While on, the AI never drives, and nothing presents handing code to it as faster or better.

### Decisions (do not re-propose rejected ones; do not design around the rest)

- Learning happens through the user's own projects. No exercises, quizzes or practice mode (rejected). The tutor chimes in from the background; the user tunes how often, how deeply, in what voice.
- One command, then hands off: `/backseat-driver` or `/bsd`. Every setting has a default, every question is skippable, setup never blocks work. A language first met mid-session gets defaults; its questions are offered in the pane, never interrupting.
- One profile per language, never per project (`python`, not "python project 1"). It matters only once the user works in that language. The tutor may read other profiles (e.g. explain Rust via Python).
- The user has the last word. Pushback is weighed. A contested point goes to the deep review model for a second opinion, and the user is told. "Do it my way" always stands. The play-by-play may keep flagging until the user hushes it; a hush saves to that language's profile at once.
- The pane's default view is the play-by-play. Tabs: 1 Play-by-play, 2 Deep review, 3 Explain, 4 Progress.
- First-run questions are few and single choice: the language they know best (once ever), then three per new language (level, goals, focus). Never more than ten at once. Esc skips the rest. Re-ask with `/bsd questions` or `q` in Progress.
- Three background jobs, each with its own model and thinking level: play-by-play (while hacking), deep review (commits), Explain (reading). The conversation uses the session's model. Explain's cache is per project (profiles are per language); all three jobs feed it and read it.
- Learning and Explanatory modes, read-only (owner, 2026-10-04): take the good parts of Anthropic's `learning-output-style` plugin and leave all the driving to the user. Its decision-point criteria and its `★ Insight` format are adapted into the play-by-play, the deep review and the contract. A decision point is pointed out as the user's call, with what each way costs, never handed over to be written. Insights are about this codebase and this code, never general concepts, and never a defect in disguise.
- License: MIT (owner's preference). The adapted parts stay under Apache-2.0: `THIRD_PARTY_NOTICES.md` (root and `plugin/`, identical; `npm run licenses` compares them) holds the attribution, what changed and the license text. Each adapted prompt credits it in an HTML comment at its top, which `stripComments` removes before a model sees the file. Credit the same way when adapting anything else.
- Explain is never stale: freshness beats speed. Nothing is shown unless it matches the file on disk at that moment.
- No editor plugins yet (vim and emacs come later). Build only the side they talk to (`focus.json`/`view.json`, below).
- Progress is honest: one report per language across projects. A level (beginner, junior, mid, senior), why, what the next level needs, recent notes, and encouragement kept apart from the level. Only the user's own work counts. A level can come back down. It stays in step with deep reviews. The owner says it is worth the token burn.
- State is never cleared by accident: clearing is deliberate and confirmed (one project, one language, or everything). Uninstalling can clear everything.
- Users stay up to date: a newer release is announced in the pane, one command fetches it, and the tutor comes back on by itself.
- Everything feels instant: no command waits on git or a model.
- The persona has two halves, chosen apart. The voice sets teaching style, tone and wording. The engineering persona sets what the tutor values, flags and recommends; its `default` is Claude's own judgment. Both apply to notes, deep reviews and conversation. A voice never brings its namesake's opinions about code; an engineering persona never brings its namesake's manner. Neither overrides the contract. A persona named after a real person is "in the spirit of": the tutor never claims to be them or quotes them, and is hard on the code, never on the user.
  - Voices: `default`, `torvalds`, `knuth`, `primeagen`, `eli5-tldr-kiss-terse`. Engineering: `default`, `torvalds`, `knuth`, `primeagen`.
- The persona has a face and can be switched off. A small animated character per voice speaks one short line at a time: a critical or design point in the user's latest save, a deep review's takeaway, now and then a joke. Dim at rest, quiet unless a look gives it something to say, one line where rows are scarce, no model calls of its own, off with one setting. Real-person personas get ASCII caricatures in good spirit (owner's call; a first version with mascots was rejected as too timid): Linus with square glasses, Knuth with round glasses, ThePrimeagen with headphones and mustache, the KISS Linux penguin in a top hat, and Claude Code's mascot for `default`.
- The tutor knows what the user is doing without making them say it: a per-project journal (below). "What are you working on right now?" is asked only on `w`, `/bsd working`, or by the tutor in chat when it is unclear and matters. The user's answer overrides the inference and persists across sessions until changed or taken back. Borrowed from the owner's topstep-claudebot (journal and briefings; not its reflection loop or inbox).
- Event-driven, not polled (owner, 2026-10-04): a state machine driven by Claude Code's own events and exact deadlines, preferring built-in signals over polling listeners. The owner accepts the extra complexity for a faster, more elegant mod. Polling is confined to one adaptive sensor for what Claude Code cannot push: the user's own saves, commits made outside it, and the editor's caret.
- Failures are handled gracefully (owner, 2026-10-04): API rate limits, plan limits and Claude outages are told apart, retried with delayed backoff, and nothing pending is lost.
- Several sessions at once are safe (owner, 2026-10-04: "a seatbelt and suspenders"): writes to the data folder are locked and queued so two sessions never clobber a file, and one session drives a project's background jobs.
- The pane is always up to date: instant, fresh, async (owner, 2026-10-04).
- A verbose debug mode, switched on and off (owner, 2026-10-04): everything the tutor does goes to a log file in the data folder, so a developer can have Claude monitor it while working on Backseat Driver. It is about the product itself: one log for all projects, never per project.
- Functional where possible (owner, 2026-10-04): logic goes in a PureScript kernel modeled on `../merecatholicity.com` (`purescript/src/Domain/*`, one `core.ts` membrane), to detect, prevent and reduce bugs, provided it integrates with Claude Code. It is the last step of the event-driven plan.

## Status

Every roadmap milestone is built and was seen working in short scripted real sessions on 2.1.289. Nobody has done real work with it yet, so the prompts (`plugin/prompts/`, `plugin/skills/tutor/SKILL.md`) are what will most likely need changing.

- Tests only:
  - the slow-down near plan limits (a session can't be put at 95% on demand)
  - the edit guard's refusal (the tutor never tried to edit)
  - the deep review on its default model and effort (live runs used Sonnet at low)
  - the journal's sitting roll-up, two sessions sharing a journal, and the deep reviewer reading the journal
- Never run: the `primeagen` engineering persona.
- Persona pairs run live: `eli5-tldr-kiss-terse`+`knuth`, `primeagen`+`torvalds`. Every voice's character has been seen live.
- The editor side has been tried only with a script writing `focus.json`.
- Decision points and insights (from `learning-output-style`): seen live in the play-by-play, the deep review and the conversation on Sonnet at low thinking. A play-by-play `insight` has not been seen live.
- Marketplace install, `/bsd update` and `/bsd uninstall` were run against a local git server at one project's scope, not GitHub. No release has been published, so installed copies stay at 0.1.0.
- Open owner decisions:
  - which ref new installs get (see Updates)
  - whether to submit to Anthropic's directory
  - whether the mod may name watch paths at session start, while still off (open since M0, 2026-10-04). It would give pushed commits (`.git/logs/HEAD`), a pushed editor caret and pushed changes from other sessions, about 0.6 s after the write, with no file read. It bends "dormant until switched on": Claude Code would watch a handful of paths in every session that has the plugin. Saves in the working tree stay on the sensor either way, because a watched folder reports its direct children only.
  - whether the event-driven machines are written in TypeScript first and ported (the approved order) or born in PureScript, now that the load probe passed
- Directory facts (checked 2026-10-04):
  - It lists mods, for Claude Code only.
  - Submit at claude.ai/directory/manage. It tracks a branch or tag, and the plugin path can be `plugin`.
  - Blocking: no README of 40+ words inside `plugin/`. (A LICENSE was the other blocker; `plugin/LICENSE` and `"license": "MIT"` now settle it.)
  - Limits: files under 256 KiB, at most 512 files.
  - Directory installs load as `<name>@synced`.
- Approved plan for part two: `~/.claude/plans/dynamic-wandering-micali.md` on the owner's machine (nine decisions, risks per milestone).
- In progress: the event-driven plan, `~/.claude/plans/wild-jumping-clover.md` on the owner's machine (approved 2026-10-04). Milestones M0 probes, M1 debug log, M2 locked store, M3 kernel (events, deadlines, health, play-by-play machine, sensor), M4 deep review queue, M5 Explain and journal on deadlines, M6 one driver per project, M7 pane pass, M8 optional push sources, M9 PureScript kernel. Done so far: M0 (see "Probed live" under Mod API) and M1 (see "Debug log"; it also added the `session.end` flush of the journal). Until M3 lands, the sections below describe the polling design.

## Repository

The root is a plugin marketplace (`.claude-plugin/marketplace.json`, one entry with source `./plugin`). The plugin is `plugin/`, and everything in it ships to users. The validator warns about a `CLAUDE.md` at a plugin root (a failure under `--strict`), so dev files (`CLAUDE.md`, `package.json`, `node_modules/`, `scripts/`, `.github/`) stay at the root. There is no build step: Claude Code loads the TypeScript as it is.

```text
.claude-plugin/marketplace.json
plugin/.claude-plugin/plugin.json   manifest + userConfig (source of truth for settings and defaults)
plugin/skills/tutor/SKILL.md        the contract
plugin/personas/{voice,engineering}/*.md
plugin/prompts/                     play-by-play.md, deep-review.md, explain.md, progress.md, speech-bubble.md
LICENSE, plugin/LICENSE             MIT, identical
THIRD_PARTY_NOTICES.md (also plugin/) the Apache-2.0 parts: learning-output-style, adapted
plugin/hooks/hooks.json             {"modules": ["./register.tsx"]}
plugin/hooks/register.tsx           all effects
plugin/hooks/*.ts, pane.tsx         pure logic
plugin/types/index.d.ts             state keys, tool inputs
plugin/tests/                       claude plugin test; kit.ts is the fake world
scripts/dev-session.sh              live session in tmux
scripts/release.sh                  cut a release
.github/workflows/check.yml         npm run check on push/PR, pinned Claude Code
.github/workflows/nightly.yml       same check daily on newest Claude Code
```

The ground rules in README ("Claude does not edit your files" etc.) describe end-user product behavior, not rules for working in this repo.

## Commands

```bash
npm install                      # once: TypeScript, the only dev dependency
npm run check                    # validate + licenses + test + typecheck
npm run licenses                 # LICENSE and THIRD_PARTY_NOTICES.md: root and plugin/ copies identical
npm run validate                 # claude plugin validate . --strict && ./plugin --strict
npm test                         # claude plugin test ./plugin
npm run typecheck                # tsc -p plugin/tsconfig.json
scripts/dev-session.sh           # live session in tmux (default session name bsd)
scripts/release.sh minor --push  # patch|minor|major|X.Y.Z: bump plugin.json, check, commit, tag, push
scripts/debug-tail.sh            # follow the tutor's debug log (see "Debug log")
```

- `claude plugin test` takes only the plugin root. It can't run one test, and the kit has no `only` or filter.
- `npm run validate` prints the mod's `hooks:`, `calls:` and `env reads:`. Read them after every change to `register.tsx`: they are what a user audits.
- Typecheck needs `plugin/.claude-plugin/types/` (self-gitignored). Claude Code writes it whenever it loads the plugin from this folder: a dev session, or `claude -p hi --plugin-dir ./plugin`, which writes the types even without a login and then fails at the model call. Rerun after a Claude Code update.
- CI:
  - `check.yml` pins `CLAUDE_CODE_VERSION` to the last-verified version (bump it with "last verified" below).
  - `nightly.yml` runs on `latest`. Red there means a new Claude Code changed the mod API, not that `main` is broken. Both are README badges.
  - Validate and test need no login.
  - `gh run list`, `gh run view --log-failed`.
- A `--plugin-dir` session reloads the mod on every save under `plugin/`. A hook that throws or times out is skipped, and an invalid render tree is replaced by Claude Code's own drawing; each shows one dim transcript line. `claude --debug` logs reasons.

### Live checks (tests stub everything; a milestone is done only when seen live)

- `scripts/dev-session.sh` starts tmux in a throwaway git repo with `BACKSEAT_DRIVER_HOME` pointed at a scratch folder (`BSD_DATA_DIR`).
- With parallel sessions, set your own `BSD_SESSION`, `BSD_RIDE_DIR` and `BSD_DATA_DIR`, and use that session name in every tmux command. On the shared default name, two sessions killed and typed into each other's sessions.
- Drive: `tmux send-keys -t bsd '/bsd'` then, separately, `tmux send-keys -t bsd Enter` (sent together, Enter is often swallowed, and so it was 0.4 s after the text: wait a second). Check the prompt box is empty afterwards. Read with `tmux capture-pane -p -t bsd`, after a moment.
- `BSD_DEBUG=1` switches the tutor's debug log on in that session's data folder and passes `--debug-file`, so Claude Code's own log lands beside it (`debug/claude-code.log`; Claude Code also makes a `latest` link there). Follow it with `scripts/debug-tail.sh -d "$BSD_DATA_DIR"`.
- A new folder shows the trust prompt first: `Down`, `Enter`. Keys sent before startup finishes are lost.
- Keep the throwaway repo path plain: with long dashed paths the model mistyped them and hit permission prompts.
- `C-x Tab` focuses the pane (hotkeys work then), `Escape` unfocuses.
- At 170 columns the pane docks beside the conversation. Read it with `cut -c1-94` (conversation) and `cut -c95-` (pane). tmux gets the main-screen layout (pane inline above the prompt) unless `BSD_FULLSCREEN=1`.
- Settings: `--settings '{"pluginConfigs":{"backseat-driver":{"options":{"deep_review_model":"sonnet"}}}}'`. Keep deep-review checks cheap this way.
- Real model calls on the owner's plan: short prompts, `--model sonnet` unless needed otherwise.
- The owner's default permission mode is bypass. Pass `--permission-mode default` when the check involves Claude running tools.
- Saving under `plugin/` reloads the mod mid-session; the mode and pane come back.

## Architecture

- Contract: `SKILL.md`, the single source of tutor behavior. The mod injects it and never carries a copy.
  - `SKILL.md` describes behavior only. Anything naming this plugin's commands, tools or agents goes in `SESSION_NOTES` in `contract.ts`, so the skill works alone (as `/backseat-driver:tutor`) with mods off. That fallback is a conversational tutor without background reviews.
- Personas: the chosen engineering file, then the voice file, are injected after the contract and into both review prompts. Each persona file states which half it is and that it leaves the other alone; a new persona file needs that paragraph too.
- Mod: `plugin/hooks/`. Commands via `$.command.register` (`/backseat-driver`, `/bsd`, `/backseat-driver-update`); tools via `$.tool.register` (`hush`, `unhush`, `record`, `lookup`, `progress`, `profile`, `working`, `activity`); pane via `$.ui.open` plus a `ui.render` hook, contents in `$.state`. Why a mod, not a skill plus a monitor: a monitor would turn every save into a conversation turn on the main model. The mod reviews out of band.

### Module shape (enforced by Claude Code)

A hooks module may not pass `$` to an imported function. Every `on(...)` and `$.noun.method(...)` must be spelled in the module itself. Hence:

- `register.tsx` is the only file with effects: all hooks, all `$` calls, all functions taking `$`.
- Every other file is pure (plain values in and out), tested directly without stubs.
- Effects cross imports as capabilities, i.e. closures over `$` (`args => $.process.run(['git', ...args])`). Passing a closure is allowed; passing `$` is not.
- `atom(...)` definitions live in `register.tsx` with literal `plugin` and `key`. Every state key is declared in `plugin/types/index.d.ts`.
- One `on` per event per matcher. Two unmatched `on('session.start')` stop the module loading.
- A function taking `$` must have a name unique in the file, locals included. `const [skill, look] = …` broke loading because `look` was also a function.
- Matchers must be literals (`{ command: ['backseat-driver', 'bsd'] }`). The validator prints `command=?` for spreads and variables.

### Files

| File | Holds |
| --- | --- |
| `settings.ts` | `/config` values as typed settings |
| `mode.ts` | `/bsd` argument parsing, mode transitions, `HELP` (the authoritative command and key list) |
| `contract.ts` | system prompt contents, `SESSION_NOTES`, instruction-file reframing |
| `guard.ts` | which paths are the user's |
| `git.ts`, `noise.ts`, `diff.ts` | `git status` parsing, files and edits never worth a look, line diff |
| `watcher.ts` | change since the last look (ports; tests use an in-memory tree) |
| `gate.ts` | whether a look is due |
| `notes.ts`, `prompts.ts` | reviewer reply → notes; reviewer and conversation prompt text |
| `review.ts` | deep review scope: reflog, what counts as a commit, the request |
| `languages.ts` | extension → language; a project's main languages |
| `profiles.ts` | profile storage and changes: answers, hushes, lesson memory, person text |
| `hash.ts` | fingerprints |
| `datahome.ts`, `storage.ts` | data folder paths, what is removable, `Disk` port, JSON I/O |
| `forget.ts` | forget scopes, dialog wording, paths per scope |
| `knowledge.ts` | per-file knowledge and the freshness rule |
| `explain-prompts.ts` | map-a-file and explain-a-symbol requests and replies |
| `explainer.ts` | Explain engine (ports): queue, fetch policy, never storing answers for changed text |
| `focus.ts` | spot in focus, editor files, conversation's view of the spot |
| `avatar.ts` | characters, poses, word-by-word speech, bubble |
| `authorship.ts` | whose work a commit is; added lines by language |
| `progress.ts` | ledger, level rules, assessment request, report text |
| `project.ts` | project knowledge from deep reviews; what reviewers are told |
| `journal.ts` | journal storage: entries, save runs, sitting roll-up, cross-session merge |
| `attention.ts` | `focus.json` beyond the spot; caret and on-screen time |
| `enclosing.ts` | enclosing definition name by indentation, no parser |
| `glance.ts` | journal as text for pane, reviewers, conversation |
| `recorder.ts` | journal engine (ports) |
| `working.ts` | "What are you working on right now?" and `/bsd working` |
| `update.ts` | install kind, versions, release tags, update and uninstall commands |
| `questions.ts` | first-run questions |
| `debuglog.ts` | the debug log: records, chunks, the ring of latest records, the tracer, `/bsd debug` parsing |
| `pane.tsx` | pane tree from plain data, handlers passed in |

### Mode

- `/bsd` returns at once (live: line at 190 ms, pane at 250 ms). `switchTo` awaits only loading the contract, setting the mode and opening the pane, because the contract must be in force from the next prompt. Everything else (watcher, profiles, reviewer, tools, questions, survey, update check) runs in un-awaited `engage`. `engagement` counts switches, and every step of `engage` and `startWatching` re-checks it after each await, so switching off mid-setup leaves nothing running.
- Modes: `off | on | paused`, stored twice. `$.state` survives a module reload (including a `/config` change) but is reset by `/clear`, `/resume` and `/branch`. A module variable survives those but not a reload. `session.start` restores the variable from state; `classic.SessionStart` (source `clear|resume|fork`) writes it back to state. Result: on survives both; every new session starts off.

### Tutor mode (while `on` or `paused`)

- `prompt.compose` removes Claude Code's `doing_tasks` section ("find the method and modify the code"). It appends a last, session-scoped section `backseat-driver:contract`: SKILL body, `SESSION_NOTES`, person text (profiles + progress), engineering persona, voice. Full prompt section ids: `intro, system, doing_tasks, actions, tools, tone`, then session-scoped ones such as `memory`. A lean prompt has `lean_body` and no `doing_tasks`; the code handles both.
- `prompt.context` rewrites the `claudeMd` block's opening ("These instructions OVERRIDE…") so the project's instructions stay in force except where they say to write code. The block also holds the user's global instructions, so reframe, never drop. A mode switch calls `$.ui.invalidate('prompt.context')` (cached event).
- `prompt.submit` attaches the open notes, the latest review, the character's last line and the journal brief.
- `tool.call` on `Edit|Write|NotebookEdit` denies unless the path is Claude Code's own (`~/.claude/`, or `/tmp/claude-<uid>/`), so the tutor can still save memories.
- Note buttons send questions with `$.prompt.submit`.
- The contract's "Decision points are theirs" and "Insights" sections are the conversation's half of the adapted Learning and Explanatory modes: name a decision as the user's, with the trade-offs, and step back; offer a `★ Insight` box (two or three points about this code) when explaining, not in every reply.
- Live: told to "add a median function" in a repo whose CLAUDE.md says to edit files, the tutor declined, hinted, and used that file's conventions. Ordered to use Edit, it refused without calling it.

### Play-by-play and watcher

- The watcher polls git and never calls a model. Interval about 2 s, stretched when `git status` is slow; not a setting.
- Every background git command is `git --no-optional-locks …`; a plain `git status` takes the index lock and breaks the user's git. `register.tsx` has one literal `$.process.run` call so readers and the validator see git is the process.
- Polling is deliberate. `FileChanged` watches named files only (literal matchers or `watchPaths`), not a tree. inotify-tools, fswatch and Watchman are extra installs, absent on the owner's machine. Anthropic's `diff` mod also polls.
- A look needs all of:
  - the tree still for the quiet time (default 10 s)
  - the minimum gap since the last look (default 1 min)
  - a real change (not whitespace-only; not only ignored, binary, generated or lock files)
  - no look in flight
- A look sends the net change since the last look. Work already uncommitted at switch-on is the baseline, not reviewed.
- `watcher.ts` fingerprints (size, mtime) every changed file at the last poll and at the last look; what differs is pending. It keeps each file's text at the last look as the next diff base. A file never seen dirty diffs against `git show HEAD:path`.
- `collect()` returns real changes. `settle()` records what a look saw, using collection-time fingerprints, so a file changed during the model call stays pending.
- A failed look settles nothing; backoff is 30 s, doubling, up to 10 min. An unparseable reply is settled and dropped, never retried or shown. Files beyond the prompt size limit stay unsettled for the next look. After a reload the watcher restarts from the current tree; notes survive in state.
- The play-by-play is one `$.model.complete`, no tools, no history. It is given the open notes and the dismissed notes for the files shown. `applyReply` drops a note with the same file and topic slug as either. Dismissed notes live in state until switch-off. Lesson memory counts only notes that reached the pane.
- The prompt says one idea per note, under 40 words (the first live note bundled three).
- Note kinds, in sort order: `bug`, `risk`, `decision`, `idiom`, `tip`, `insight`. `decision` marks a meaningful choice (just made, or ahead in a stub or TODO: the one exception to "no notes on unfinished code"), framed as theirs with its trade-offs. `insight` is an implementation choice or a codebase pattern. Priority, in the prompt only: a bug or a risk before a decision, a decision before anything else, never more than one insight (a cap of one decision was dropped: a live save with two real open choices got both, which was right). The pane draws decisions first under `◆ Your call` (magenta), the problems by file, then insights under `★ Insight` (cyan) (`DECISION_HEADING`, `INSIGHT_HEADING`). `isProblem` is false for both: they never count in the lesson memory (`flagged` or `explained`). `e` on a decision asks the conversation to lay out the options and leave the choice to the user; on an insight, where else it shows up.
- Live (decision points): a TODO for the even-count median got `◆ Your call` with the trade-off (the textbook median versus keeping the input's type) and no choice made, beside a separate `risk` for an unclosed file. An uncommented tie rule in `mode()` was flagged as an open decision, and adding a comment that made it deliberate resolved the note at the next look. `e` on a decision got six options with their costs and the questions that decide between them, then "tell me which way you're leaning". "Which would you pick?" got a question back about what they weighed. No play-by-play `insight` has been seen live yet: the model has preferred decisions.
- `d` dismisses (the same point isn't raised about that file again until switch-off). `m` hushes the topic. `e` asks the conversation for the concept, then an example on request, never a patch. `l` looks now.
- Plan limits: `tick` reads `$.session.usage().rateLimits` (free) at most twice a minute, and only when something is pending.
  - At 80% of the tightest window: the gap is ×4, minimum 4 min.
  - At 95%: no automatic look or deep review; the pane says "Holding back". Look now and review now still work.
- Live: a planted bug got its note 14 s after the save, nothing appeared in the conversation, `e` sent the explain request, and saving the fix cleared the note.

### Deep review

- A read-only subagent (`Read`, `Grep`, `Glob`) registered with `$.agent.register({ model, effort, tools })`, not a file in `plugin/agents/`. A spawned subagent skips the mod's own `turn.step` hooks, so registration is the only way to give it the user's effort level.
- Instructions in `prompts/deep-review.md`. Registered at switch-on; `agent.offer` withholds it from the model while off. Re-registered whenever the person text changes, because a spawn can't take parameters.
- Triggers, independent: after each commit (default on), and every N minutes (default off). With both off, only on request (`r`).
- Commit detection: each tick compares `.git/logs/HEAD` size and mtime. Only on change does it run `git reflog -1`.
  - `commit`, `commit (amend)`, `commit (merge)`, `commit (initial)` → review that commit.
  - Any other HEAD move (checkout, pull, reset, rebase) → reset the "since last review" base.
  - No git hooks (they would write into the user's repo).
- A timed review covers `git diff <base>` against the working tree, plus untracked files by name. A scope fingerprint prevents re-reviewing the same uncommitted work; it is skipped when nothing changed.
- `$.agent.spawn` resolves at start, with `agentId`. The answer arrives as a `turn.complete` carrying that id and goes to state, never the conversation. One review at a time; a commit made meanwhile is queued (latest only). Done → short notice, and the tab is marked new.
- The notes block also carries `decisions` (file, line, choice, tradeoff; at most `MAX_DECISIONS` = 3). The review's `decisions` and `insights` go into the `Review` state; the tab draws the decisions before the review text and the insights after it, so the text should not repeat them. `insights` must describe choices and patterns, not defects. With the first wording, a live review's insights were defects. With "an insight is never a problem", a fresh session's were choices (`Counter`'s insertion order giving first-seen ties, `sorted()` leaving the caller's list alone) while the defects went to decisions and the review: one run each.
- A contested point is the one review that lands in chat: the tutor delegates it to the same reviewer and reports the verdict.
- Live: commit noticed within one tick, footer showed a background agent, review in the tab 12 s later. No conversation row, notification or attachment, then or on the next turn. Contested point verdict in chat after 32 s. The 5-min timer with after-commit off reviewed uncommitted work at 5 min.

### Profiles

- `profiles/<language>.json` and `profiles/general.json` in the data folder: first-run answers, hushes, lesson memory (`flagged` when the play-by-play raises a topic, `explained` when the user presses explain; 3+ flags = recurring).
- In play: the project's main languages (`git ls-files` + extension table; at least 15% of source files, and the largest always counts) plus any language the user changes a file in.
- `aboutPerson()` (profiles + progress) goes into the conversation's system prompt, both reviewers and Explain.
- Questions via `$.ui.ask` at the end of switch-on, after the pane and watcher run, so dismissing loses nothing. Every subject asked is marked `isAsked`, answered or not, and never asked again unprompted. Re-ask from the Progress tab; new answers replace old.
- All single choice: one keypress each. A multi-select costs a toggle, Submit, Enter and a review screen.
- `record` tool: one of `level|goals|focus|knows` for a language, in the user's words, from chat. It doesn't set `isAsked`.
- `hush` tool (the tutor calls it on a stated preference) or `m`: it takes the open note's number when there is one and uses that note's topic and language. (Live, the model once invented a slug and claimed success.) The result reports how many notes left the pane, and the contract says to report only that.
- A hush works twice: the reviewers are told "Do not bring up" (catches any wording), and a note whose slug matches is dropped regardless.
- `unhush`, and `profile` (read a language not in play) tools.
- Live: the four questions appeared with Python detected; Esc skipped all with the tutor running; `hush` and `record` were called with no permission prompt; a hushed topic got no note while two real bugs beside it did; a dismissed note stayed away while a new bug in the same file got its own.

### Explain

- Spot = whichever moved last:
  - the editor's `focus.json`
  - `/bsd explain path:line[-end]`
  - `n`/`p` in the tab
  - the `lookup` tool
  - a save, which goes to `firstChange` past blank lines, and doesn't steal focus from an editor active in the last 10 min
- The tab shows: what, how, why, watch, relies-on, the file outline, and the deep review's insight with its commit.
- Never-stale, enforced in `knowledge.ts`/`explainer.ts`, not by callers:
  - A symbol stores a fingerprint of its exact lines and its first line. `freshSymbols` re-finds each in the current file wherever it moved, and drops any whose text changed. Views are built only from those.
  - An explanation stores the fingerprints of the symbols it relies on. `trusted()` drops it if any changed. Names resolve in the same file, or in another mapped file when exactly one has that name.
  - `placeSymbols` checks a model outline: each symbol must quote its first line, found at the named line or within 5 lines; otherwise it's dropped.
  - A lookup reads the file before and after the model call. If the text changed, the answer isn't stored (`stale`; a mapping returns `again` and is redone).
  - File and outline summaries show only while the file fingerprint matches.
- `createExplainer(ports)`: reads never wait on a model. `view(spot, intent)` answers from memory and disk and queues what's missing.

  | Intent | From | Priority | Waits to settle | Stops near limit |
  | --- | --- | --- | --- | --- |
  | `asked` | `/bsd explain`, `n` `p` `f`, lookup tool | first | no | never |
  | `browsing` | editor cursor, refresh of a shown spot | first | yes | 95% |
  | `following` | save | after those | yes | 80% |
  | ahead | 2 unexplained symbols after a mapping | last | — | 80% |

- `SETTLE_MS` 2.5 s after a file's last change before mapping. Explaining a symbol never waits. Concurrency is 2, plus 1 for a watched spot. `commit()` applies results to the latest state synchronously and writes one at a time (two landing together once lost one). Re-check the cache just before calling the model. Failed lookups aren't retried for `RETRY_MS` (1 min).
- Setting `explain`: `automatic | on request | off`. Near limits, `automatic` degrades to on-request (saves first, then everything).
- `register.tsx`: `startExplaining` (in `engage`) builds the ports. `refreshView` builds the focused view into state and writes `view.json`. While the tab is open or an editor is live, `fastPoll` stats the focused file and `focus.json` every 100 ms and refreshes on change, which is why stale text leaves the screen within about 0.1 s. It stops when nobody watches. `readFocus` is the only reader of `focus.json`; `pollFocus` feeds the journal, then Explain (`followEditor`).
- Live: first explanation in an unseen file in 6.6 s; cached `n`/`p` in 40–80 ms; edit removed the explanation in about 60 ms, new one after 9 s; a script's `focus.json` → `view.json` in 40–80 ms; the tutor called `lookup` with no permission prompt when it hadn't already read the file.

### Editor protocol (for future vim and emacs plugins)

Both files are in the data folder. The editor writes `focus.json` atomically (temp file plus rename) on cursor, selection or field change; a few writes a second is plenty.

```json
{ "file": "/abs/path/src/stats.py", "line": 12, "endLine": 15, "modified": true,
  "buffers": ["/abs/..."], "visible": ["/abs/..."], "active": true }
```

- `file` is absolute; files outside the session's repo are ignored, so sessions can share one focus file. `line` is 1-based. `endLine` only while selecting.
- Explain needs only `file` and `line`. The rest feed the journal: `modified` = unsaved changes in the caret's buffer, `buffers` = open files, `visible` = other files on screen, `active: false` = the editor window lacks the keyboard.
- The editor never reports durations; the tutor credits time per poll.

The tutor writes `view.json` in answer and whenever its knowledge of the spot changes: `{ v: 1, at, root, source, spot: {path, line}, status, fileSummary, outline: [{name, kind, startLine, endLine, summary}], isOutlineCurrent, isMappable, target, detail: {what, how, why, watch, uses} }`.

- `status`: `fresh | updating | waiting | held | failed | no-file | off`.
- Everything is already checked against disk, so an editor shows it as is.
- `target` is null between symbols; `detail` is null until it arrives.

### Project cache

- `projects/<name>-<hash>/`: `project.json` (overview, file roles, insights), `reviews.json` (text of the last 12 reviews), `files/<hash>-<name>.json` (Explain), `journal.json`.
- Each deep review ends with a fenced `backseat-notes` JSON block (asked for in `deep-review.md`). `splitReview` strips it before the pane, parsed or not. `keepReview` re-reads `project.json`, merges (`withReviewNotes`), and appends to `reviews.json`.
- Each insight is kept with the fingerprint of its symbol (when mapped) or of its file, and which one it is; one that can't be fingerprinted isn't kept. `insightsFor` (Explain) and `currentInsights` (play-by-play) pass it only while the fingerprint matches. For the play-by-play the file just changed, so file-level insights drop and symbol-level ones survive for unedited symbols.
- The overview is project-wide and unfingerprintable. It carries its commit, and the reviewer is told to correct it.
- Survey: `ReviewScope` kind `survey`, run by `maybeSurvey` once per project (`isSurveyed`), from `engage` on a fresh switch-on. Not run when both deep review triggers are off or usage is ≥80%. Its text goes to the tab, not `reviews.json`.
- `reviewRequest(scope, { overview, earlier })` adds the overview and `reviewDigest` of the last 3 reviews.
- Live: survey in the tab about 10 s after switch-on, with the overview and roles in `project.json`; a commit review gave 3 insights and no visible notes block; an insight showed beside a function in Explain and vanished 200 ms after an edit.

### Journal

- `projects/<id>/journal.json`; engine `recorder.ts` (disk and repo as ports). `register.tsx` starts it in `engage` (`startJournal`), feeds it each tick (`keepJournal`) and from `pollFocus`, and drops it at switch-off. It holds paths, line numbers, definition names, commit titles and user statements, never code.
- Saves: each tick's changed files are diffed against the last save's text, else HEAD for clean files, else switch-on text for files already dirty (so pre-existing work isn't a save).
  - A `save` entry holds added and removed counts, merged line runs and touched definitions (`enclosing.ts`).
  - Saves of one file under 2 min apart form one run, until a commit or HEAD move.
  - Other entries: commits, HEAD moves, notes raised, notes fixed, dismissals, deep reviews, switch-on, working-on statements.
  - The last 3 files' diffs stay in memory for the `activity` tool.
- Attention: `attention.ts` credits each poll's time (max 10 s, so sleep adds nothing) to the caret line and to `visible` files, while the editor wrote within `LINGER_MS` (2 min) and isn't `active: false`.
  - Every `SLICE_MS` (2 min) → `focus` entries: up to 3 regions per file plus the remainder. A region is lines within 20 of each other inside one definition, named for the line held longest. Visible files get `screen` entries.
  - The definition name is resolved at the next tick, so one read per caret position.
  - `focus.json` from before switch-on is a baseline and earns no time until rewritten.
- Sittings: an hour idle ends one. On every read or write, finished sittings roll up (`digest`: files, commit titles, statements); only the open sitting keeps entries. Keep the last 20. A sitting with no save, no commit and under 1 min of editor time leaves nothing.
- Writes: at most every 30 s when something is new; at once on a working-on statement; at switch-off; and when the session ends (`session.end`).
  - Every write re-reads and merges (`sync`). An unseen entry is another session's and is kept. A seen-but-gone entry was rolled up or merged, and is dropped.
  - For said and inferred working-on, later wins; ties go to this session.
  - Every entry passes `parseEntry` so JSON is canonical for comparison.
- Readers:
  - `glanceText` comes first in every play-by-play prompt and last in every deep review request: what they said; what the last look inferred while it `holds` (under 1 h old, and activity still touches a file that look saw); where the last 10 min went by file (a save weighs 1 editor-minute, beside-time ¼); the caret; this sitting, max 14 lines; the previous sitting.
  - `briefText` goes with every typed prompt.
  - The `activity` tool returns the glance plus the latest diffs.
- Working on:
  - The play-by-play reply's `working_on` is stored as `inferred` with the paths seen; a non-commit HEAD move clears it.
  - The pane line shows, in order: said, else inferred while it holds, else `workingOf` (where activity is). Hidden outside a git repo.
  - `w` or bare `/bsd working` asks with two answers plus free text. Enter gives the first, which never loses anything (`workingChoices`).
  - The user's words come via `/bsd working <words>`, the `working` tool, or a typed answer. Take-back: "Let the tutor work it out", `/bsd working clear`, or the tool with an empty string. A tool call without `on` records nothing (a live call without it once cleared the line).
- `/bsd forget project` deletes the folder, and `recorder.reset()` stops the next write from restoring it.
- Live (script as editor): "Working on stats.py, in mean" 4 s after the caret moved; after a save, `working_on` became "writing a median function in stats.py"; "this" in chat resolved to `median`; `working`, `activity` and a commit were written within 30 s; a reload kept everything. Regions now also end where the definition changes (one once merged `mean` and `median`).

### Progress

- The model observes and code decides. One `$.model.complete` on the deep review model (`prompts/progress.md` rubric) returns observations (skill slug, `shown | missed`, the skill's level, a note), a proposed level, and the report text.
- `decideLevel` (`progress.ts`):
  - No level before 5 observations from 2 commits.
  - The first placement is capped at the highest level with 2 weight of evidence.
  - One step at a time.
  - Up: 4 weight of next-level evidence from 2 commits, and the model agrees.
  - Down: 2 weight of misses at or below the level from 2 commits, and the model proposes lower or the misses outweigh what was shown.
  - Provisional until 12 observations from 4 commits.
  - Every change goes in `history` with its reason and the observation count; "since last change" counts from there.
- Slipping is per commit: shown in an earlier commit, and only missed in the latest commit that touched it. Shown and missed in one commit is mixed. A first placement keeps commits in time order so a skill learned later isn't marked slipping.
- Whose work (`judge`, `authorship.ts`):
  - The author email is in `identity` (`git config --get user.email`, plus `--global` when it differs).
  - Not a merge; no `Co-authored-by` trailer or tool line.
  - At most 600 added lines and 25 files (otherwise import, vendored or generated).
  - At least `MIN_LINES` (3) non-blank added lines in one language.
  - Only added lines are read (`git show --unified=0`); lock files and generated folders never are. The tab's status line says why the last commit didn't count.
- Weight 1 if the watcher saw at least half the commit's files change before it was made (`watchedPaths`, filled by `tick`, emptied as commits are assessed), else 0.5. First-placement commits are always 0.5.
- When:
  - `assessCommit` runs from `turn.complete` after a commit's deep review (with its text, or without on failure), or from `checkHead` when after-commit reviews are off. Not near the plan limit.
  - `placeFirst` runs on a fresh switch-on for the first 2 languages in play without a level: up to 5 of the user's commits among the last 30, in one request.
  - `progressQueue` runs one at a time, each re-reading before writing. Full hashes go in `assessed`, so no commit counts twice anywhere.
- Observations are keyed by full hash (the kit's short hashes are all `0000000`).
- `aboutPerson()` adds `progressText` to every prompt. The `progress` tool answers "how am I doing?". The reviewer is re-registered after each assessment.
- The tab's id is still `profile` (`tab-profile`, hotkey 4), labelled Progress; other tests press it.
- Setting `progress_report` turns it off. Stored in `progress/<language>.json`.
- Live: in a repo of polished commits by a "Famous Maintainer" plus one 4-line function of the user's, only the user's commit was read ("no level yet: 4 of 5 observations, from 1 of 2 commits"); a watched second commit placed junior (provisional); a `Co-Authored-By: Claude` commit was ruled out; the `progress` tool answered with no permission prompt.

### Animated persona

- `avatar.ts` holds the art and rules; `register.tsx` moves it. It stands at the top of the Play-by-play and Deep review tabs.
- Lines:
  - The play-by-play reply's `say` field. `prompts/speech-bubble.md` goes into the reviewer's system prompt only while the setting is on. The request's last line says `insight`, or `remark` after `QUIET_LOOKS_BEFORE_REMARK` (4) silent looks.
  - Each look's `say` replaces the line, so a quiet look means silence, and it never speaks about outdated code.
  - A finished deep review gives its last line (`deep-review.md` makes that the one thing to do next).
  - Switch-on gives `hello`. No line costs a model call.
- Motion:
  - `say` writes the `speech` atom at tick 0 and starts `$.clock.every(TALK_MS)`. Each tick reveals one word via `update` with `nextTick` (compare-and-set, so a stale tick can't overwrite a newer line). The mouth moves on alternate ticks; the timer stops when done.
  - A blink every `BLINK_MS` (with `$.clock.after` to reopen), only while `on` and not talking.
  - Switch-off cancels both timers and resets the speech. A reload loses the timers, so `startAnimating` marks a half-said line as said.
- `poseOf` decides at render from the mode, watcher and speech: asleep (paused), talking, eyes up (look running), blinking, rest (drawn dim).
- The bubble is sized to the whole line from the first word (no reflow) and only as wide as needed. Above the prompt, or off-terminal, it uses one-line `mini` frames.
- Art rules (`avatar.test.ts` checks them):
  - Every pose of a character has the same height, and every line the same width.
  - Only printable ASCII plus the block elements Claude Code's mascot uses (nothing double-width).
  - Each character names its `mouth` row, and `bubbleColumn` pads above so the bubble's tail meets the mouth.
  - ASCII characters use the ASCII bubble (`bubbleStyle`); Claude's mascot uses box lines.
  - The README pane drawing avoids block elements (GitHub's font may lack them).
- Live: all characters seen saying hello with mouth movement, blinking, sleeping when paused, and with the tail at the mouth. One-line mode at 100 columns.

### Updates and uninstall

- `update.ts` is pure. Effects live in `detectInstall`, `checkForUpdate`, `runUpdate`, `removeHome` and `runUninstall` in `register.tsx`.
- Install kind:
  - `clone`: `git rev-parse --show-toplevel` from `$.plugin.root` gives a folder whose `plugin/` is the root and which has `.claude-plugin/marketplace.json`. Both conditions guard against a dotfiles repo around `~/.claude`.
  - `synced`: the root is under `<config>/plugins/synced/` (claude.ai org or directory installs). These self-update and have no `installed_plugins.json` entry.
  - `installed`: an entry in `<config>/plugins/installed_plugins.json` whose `installPath` contains the root.
  - `<config>` = `CLAUDE_CONFIG_DIR` or `~/.claude`.
- Versions and releases:
  - An installed copy is pinned to `plugin.json` `version`; `claude plugin update` does nothing until it changes.
  - New installs copy whatever `main` has (the entry is relative `./plugin`). Pointing the entry at a release ref (e.g. a `git-subdir` source with `ref`) is the owner's open decision.
  - Tags: `backseat-driver--vX.Y.Z` (`claude plugin tag`); `newestRelease` also accepts `vX.Y.Z`.
  - `scripts/release.sh` refuses a dirty tree, a branch other than main, or being behind origin.
- Check: on a fresh switch-on, when `update.json` is missing or 6 h old.
  - `git ls-remote --tags --refs` against the clone's `origin`, Claude Code's own marketplace clone, or the manifest `repository`.
  - Network git goes through `git(…, isNetwork = true)`: `GIT_TERMINAL_PROMPT=0` and `GIT_SSH_COMMAND=ssh -o BatchMode=yes` (`$.process.run` `env` overlays the host env). It never prompts.
  - Failure writes nothing and retries at the next switch-on.
  - Off with the setting or `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`. The notice lives in the `update` state key, under the pane's status line.
- `/bsd update` (also `/backseat-driver-update`):
  - clone: `git pull --ff-only`, only if `git status --porcelain --untracked-files=no` is empty. The `--plugin-dir` reload follows, and the mode survives in state.
  - installed: `claude plugin marketplace update <mp>`, `claude plugin update <id>`, then `$.command.run({ command: 'reload-plugins' })`. Until the reload the old version runs. `$.plugin.root` changes per version (the cache is `cache/<mp>/<plugin>/<version>/`; old versions are deleted 14 days later).
  - synced: tells the user that updates arrive by themselves.
  - Says when there was nothing new.
- `/bsd uninstall`: Keep (Enter), uninstall and erase, or uninstall and keep.
  - Erase needs the typed phrase. `removeHome` deletes the folder itself only if `isOwnFolder` (only the marker and `REMOVABLE` entries).
  - Installed: `claude plugin uninstall <id> --yes`. The marketplace stays, and the final line says how to remove it and what settings remain. A clone is told how to remove itself.
- Marketplace facts (2.1.289): auto-update is off by default for third-party marketplaces (`/plugin` → Marketplaces → enable). npm's `stable` dist-tag of Claude Code was 2.1.285, below the 2.1.287 mods need.
- Testing the marketplace path without GitHub: `marketplace add` accepts `owner/repo`, https, http or a path, but not `file://`. A path loads in place, so it never exercises update. Plain HTTP fails because the clone is shallow. What works:
  - Serve a bare clone with `git http-backend` via `python3 -m http.server --cgi` (`cgi-bin/git` exporting `GIT_PROJECT_ROOT`, `GIT_HTTP_EXPORT_ALL`).
  - `claude plugin marketplace add http://127.0.0.1:<port>/cgi-bin/git/<repo>.git --scope local`, then `claude plugin install … --scope local` from a scratch project.
  - Clean up: `/bsd uninstall`, `claude plugin marketplace remove backseat-driver --scope local`, and delete `~/.claude/plugins/cache/backseat-driver` (uninstall leaves it).
- Live: from a 0.1.0 clone against a local upstream with `backseat-driver--v0.2.0`, the notice appeared, update pulled, the mod reloaded and stayed on; a dirty clone wasn't pulled. An installed 0.1.0 (project scope) updated to 0.2.0 via both commands plus reload and stayed on. Uninstall with erase removed the plugin and the data folder.

### Data folder

`$BACKSEAT_DRIVER_HOME`, else `$XDG_DATA_HOME/backseat-driver`, else `~/.local/share/backseat-driver`. `datahome.ts` builds every path.

```text
.backseat-driver              marker; required before any delete
profiles/<language>.json      answers, hushes, lesson memory
progress/<language>.json      evidence, level, report
projects/<name>-<hash>/       journal.json, project.json, reviews.json, files/
focus.json                    written by an editor
view.json                     written by the tutor
update.json                   last release check
debug.json                    the debug log's switch: {"on": true}
debug/<session>/              one session's debug log (see "Debug log")
```

- Not `$.store`: it's capped at 4 MiB total, separate per install method, and cleared after `cleanupPeriodDays`. Editor plugins also need a findable path. `moveOutOfStore` migrates old `subject/<x>` keys at switch-on; a file wins over a key.
- Not SQLite: the module can't load it, and the `sqlite3` binary is often missing (the owner's machine included).
- I/O goes through `Disk` (`storage.ts`), four closures built by `diskOf($)` from `$.fs` and `$.process`. Engines take it as a port; tests use `memoryDisk()`. Writes are whole-file and non-atomic, so `readJson` treats unparseable as missing, and every writer re-reads right before writing.
- Delete: `$.fs` has none, so `Disk.remove` runs `rm -rf -- <path>`. Guarded by `isRemovable` (only under `REMOVABLE` children, no `.` or `..` segments) and by the marker (`markHome` writes it before the first write). A misdirected `BACKSEAT_DRIVER_HOME` loses nothing.
- `/bsd forget [project|<language>|everything]` (`forget.ts`; dialogs in `forget()`):
  - Every dialog has "Keep it" first, so Enter keeps. Only the exact "Forget it" proceeds.
  - Everything also needs the typed phrase "forget everything".
  - Returns at once; the result is a `$.ui.log` line. Works while off.
- Live timings: an outside write 8–16 ms, a read or listing 3 ms, a stat 1 ms, `rm` 5 ms. Migration, keep-on-Enter, delete, and forget-everything leaving only the marker were all seen.

### Debug log

For developing Backseat Driver, not for its users: everything the tutor does, in one place for every project (owner: "nothing to do with individual projects"). A developer tells Claude to follow it while they exercise the tutor.

- Switch: `/bsd debug on | off | status | dump | clear` (no word = status). It works while the tutor is off. The switch is `debug.json`, so it holds across sessions and restarts; a session reads it when its tutor is switched on (and on a reload). Nothing reads it at session start.
- Files, under `debug/<YYYYMMDD-HHMMSS>-<first 8 of the session id>/` (UTC; a session keeps its folder across reloads):
  - `NNNNNN.jsonl`: the log. `$.fs.write` cannot append, so the chunk being filled is written again, whole, each time it grows (at most every `FLUSH_MS`, 200 ms). A chunk closes at `CHUNK_CHARS` (128 000) and is never touched again, until `MAX_CHUNKS` (64) newer ones exist and it is emptied (there is no delete). After a reload or an off and on, the log carries on in a new chunk.
  - `state.json`: the tutor's whole state after the latest flush: `snapshot()` (module variables: watcher, look, review, timers, slowdown, focus) plus every pane atom.
  - `debug/dump-<stamp>-<session>.json`: what `/bsd debug dump` writes: the state and the ring.
- Record: `{ t, seq, s, p, k, n, ms?, d? }`. `t` is `Date.now()` (free; `$.clock.now()` would cost a dispatch per record, and in the kit the two differ). `s` session, `p` project id, `k` kind, `n` name, `ms` duration, `d` details. A string over `MAX_STRING_CHARS` (400 000) is cut.
- Kinds:
  - `meta`: log started, log stopped (with why)
  - `cmd`: every `/bsd` request
  - `hook`: `session.start`, `classic.SessionStart`, `session.end`, `prompt.compose` (when what it adds changes), `prompt.context`, `prompt.submit` (with what was attached)
  - `git`: argv, exit code, output
  - `fs`: `read`, `write`, `list`, `remove` in the data folder; `source` for a file of the repository, by size
  - `model`: the whole request and result, by job (`play-by-play`, `explain`, `progress`)
  - `agent`: `register`, `spawn`, `finished`, with prompts and answers
  - `tool`: input and answer of the tutor's own tools. `guard`: an edit denied or let through
  - `state`: `mode`, `watch`, `review`, `progress`, `working`, `speech`
  - `watch`: `saved`, `head moved`. `look`: `start`, `done`, `nothing to look at`, `reply not understood`
  - `start`: `engaging`, `engaged` (with how long). `timer`. `ui`: every pane key. `process`: `claude`. `explain`. `error`: with the stack
- Counted, not logged one by one: a `git status` that answered what the last one did, every stat, every pane render, every unchanged `prompt.compose`. `poll / nothing new` sums them up every 30 s. (M3 removes most of these with the polling.)
- `trace($, kind, name, detail?, ms?)` in `register.tsx` is the one entry. `detail` is a function, called only while the log is on, so with the log off a trace costs a few assignments. The tracer always keeps the latest `RING_SIZE` (300) records in memory without details, which is what a dump shows of the time before the log was on.
- `fail($, what, error)` is for an error the tutor survives: Claude Code's debug log as before (same text, tests read it in `session.logs`), plus an `error` record.
- Every answer of the tutor's own tools goes through `answered($, e, text)`.
- `scripts/debug-tail.sh [-a] [-k kinds] [-s session] [-d folder] [-1]` prints each record as it is written. `tail -f` cannot follow chunks that are written again; the script reads whole lines, moves to the next chunk, and to a newer session when one starts. Under Claude Code's Monitor tool each record becomes an event.
- Forgetting everything, and uninstalling with erase, remove `debug/` and `debug.json` (both are in `REMOVABLE`). `forget()` stops the log first, or the next flush would write it back.
- Footprint: no new process. New calls: `$.session.id`, `$.session.version` (for the first record), and the hook `session.end`.
- Live (Sonnet, low): `/bsd` with `BSD_DEBUG=1` logged its start (engaged in 1.8 s), every git call with its timing, the survey's whole prompt, a save 1.1 s after it was written, three Explain requests, the look's request and reply, the notes and the bubble's line. `off` and `on` carried on in chunk 1 of the same folder, `dump` wrote 84 records, `clear` left one new folder, and `/exit` ended the log with `the session ended (prompt_input_exit)` 5 ms after `session.end`. The follower printed each record as it came, across the chunk change.

## Invariants

- Dormant until switched on. While off, every hook passes through with `next(e)`: no pane, model call, prompt change or denial. No reads or writes at session start. Only `/bsd forget`, `/bsd help`, `/bsd debug` (and update or uninstall when asked) act while off. The debug log itself is written only while the tutor is on.
- Background reviews never become conversation turns. Only what the user does in chat or the pane does. Verified live for `$.model.complete` and `$.agent.spawn`.
- Model and effort per job come from `userConfig`; no model id is pinned (aliases only). Defaults: play-by-play `sonnet`/`medium`, deep review `opus`/`high`, Explain `sonnet`/`low`. "Thinking level" = Claude Code effort (`low|medium|high|xhigh|max`).
- Hard rules are hooks; teaching style is the contract. The edit guard covers only `Edit`, `Write` and `NotebookEdit`; a shell command could still write, which rests on the contract and Claude Code's permission prompts.
- Footprint (the README's "What it is not" states it to users):
  - Runs `git`, reads the repo and its own plugin folder, calls models, writes only its data folder, draws a pane.
  - Other processes only on request: `rm` inside the data folder (forget, `/bsd debug clear`), `claude plugin` (update, uninstall).
  - The debug log, when the user switches it on, holds their code and prompts. It stays in the data folder.
  - Network of its own: the release check (`git ls-remote`, at most every 6 h, opt-out) and `/bsd update`'s fetch.
  - No git hooks, never writes the working tree.
  - Any new kind of call in the validator's `calls:` (`http.fetch`, a write outside the data folder, another process) breaks this and needs the owner's decision plus a README update.
  - `env reads:` must stay `BACKSEAT_DRIVER_HOME, CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC, CLAUDE_CONFIG_DIR, HOME, USERPROFILE, XDG_DATA_HOME`.

## Mod API (early access; last verified 2.1.289; mods need 2.1.287+)

The authority is `plugin/.claude-plugin/types/claude-code/index.d.ts`, above memory and docs; grep it. Load the `plugin-authoring` skill before writing hooks.

- No Node, no DOM, no `import()`. Everything external goes through `$`.
- State a drawing reads lives in `$.state`; module variables are lost on reload. A `ui.render` hook reads state but can't write it.
- `/clear`, `/resume`, `/branch` reset `$.state` without `session.start`; `classic.SessionStart` fires instead.
- A pane opened by the user's command places at any width; one opened unprompted waits for 144 columns.
- `prompt.compose` is uncached and can't be invalidated (it runs every render). `prompt.context`, `prompt.section` and `tool.describe` are cached until `$.ui.invalidate` names them.
- `$.model.complete` takes `effort`. `$.agent.spawn` takes `model`, no effort, and the mod's own `turn.step`/`tool.call` hooks don't see its subagents.
- `$.model.complete(req, { signal })`: an abort resolves, it doesn't reject.
- A mod's tool is served by answering `tool.call` without `next`; no permission prompt. Declare inputs under `McpToolInputs` in `plugin/types/index.d.ts`, or matchers won't type-check. A no-input tool is `Record<never, never>` (with `Record<string, never>`, `$.tool.call({ tool })` fails).
- `update($, atom, fn)` gives a misleading "Atom<…> is not assignable to StateRef" when `fn` returns literal-union fields. Annotate: `(w): Watch => ({ ...w, state: 'looking' })`.
- `userConfig` `options` pickers work on string fields only. A stored value outside the options reads as the default, with a warning (in tests too). A `/config` change reloads the mod with new options, and the tutor stays on. For the working copy, values go to `~/.claude/settings.json` `pluginConfigs["backseat-driver@inline"]`: restore the owner's settings after a check.
- `$.ui.ask`: one question, 2–4 options plus free text. It rejects on dismiss (first-run treats that as skip all) and under `claude -p`. In tests it reaches the `tool.call` stub as `AskUserQuestion`.
- `$.store`: 4 MiB total, per install, expires (unused now). `get`, `set`, `delete`, `keys`.
- `$.fs`: `read` (≤4 MiB), `write` (makes folders), `list`, `exists`, `stat`, `ancestors`. No delete or rename. `list`/`read` reject on missing. Absolute paths outside the project work without a prompt.
- `$.env.get` takes a string literal; the validator lists the names.
- A hook gets 10 s of its own time per dispatch. Time inside `$` calls doesn't count, except `$.clock.sleep` and awaited plain promises. So the `lookup` tool waits ≤6 s, then answers with what it has.
- A mod's `$` calls go through other plugins' hooks, never its own. `$.prompt.submit` bypasses its own `prompt.submit` hook, so put needed context in the text or a tool.
- `$.clock.after` is one-shot; `$.clock.every` repeats. Both return a `Timer` with `cancel()`. A reload cancels all.
- `dimColor` plus `color` on `Text` renders theme gray (it replaces the color). `color` takes a theme key (`claude` = orange) or a terminal color.
- State-driven redraws and `$.ui.invalidate` are capped at 30/s in the terminal. The persona ticks about 7/s while talking, zero at rest.
- `e.props.isFocused` in the pane's `ui.render` says whether it has the keyboard; hotkeys are dead until then, and the pane says how to focus.
- `Text` takes no `key`. Keys go on `Button`, `Input`, `Select`, `Markdown`. Find text via `ui.find({ type: 'Text', text })`; an undefined result after a clean mount usually means this.

### Probed live (2.1.289, 2026-10-04, a scratch mod; the event-driven plan's M0)

- `$.fs.write` truncates in place (same inode; a hard link sees the new text): not atomic. 1 KB 2 ms, 128 KB 3 ms, 2 MB 15 ms. `stat` 2 ms. `list` 3 ms, and it returns `{ name, kind, size, mtimeMs }` per entry, so one call stamps a whole folder.
- Module environment:
  - Present: `Date` in the local time zone, `Intl`, `toLocaleTimeString`, `Math.random`, `setTimeout`, `setInterval`, `AbortController`, `crypto`, `structuredClone`.
  - Absent: `queueMicrotask`, `process`, `fetch`, `WeakRef`.
  - `Date.now()` agrees with `$.clock.now()`. Keep `$.clock.now()`: tests move that clock.
- `$.clock.after(ms)` fires 15 to 80 ms late. `cancel()` holds.
- `$.model.complete`: about 0.5 s on haiku. `timeoutMs` elapsed resolves `{ reason: 'aborted' }`. An unknown model resolves `{ reason: 'api-error', status: 404, error: 'model_not_found' }`; it does not reject.
- `session.measure` fires around main-thread turns, the first time naming every unit, with `rateLimits` (`kind`, `percentUsed`, `resetsAt`). It did not fire after a `$.model.complete` alone. `$.session.usage()` is free and holds the same figures.
- `$.agent.spawn` resolves in about 130 ms with `{ model, agentId }`. `$.agent.list()` rows are `{ id, description, type, status, spawnedBy }`, status `running | completed | failed`; a finished row drops out later.
- A subagent that dies on an API error raises `turn.complete` with `reason: 'error'` and an empty answer, about 16 s after the spawn (the engine retries first). At the same moment `classic.StopFailure` fires with the error kind (`model_not_found`) and `agent_id`: that is where a failed review's reason comes from.
- `session.end`: `next.budget` was `{ ms: 1491 }`. Twelve writes and a git run took 109 ms, so a flush at exit fits.
- `classic.FileChanged` reaches a function hook with no settings hook configured, for paths returned as `watchPaths` from `classic.SessionStart`.
  - `classic.SessionStart` is the only event that takes the list: one returned from `classic.FileChanged` is ignored. So nothing can start a watch when `/bsd` is typed mid-session.
  - It takes files, files that do not exist yet (`add`), and folders. A folder gives its direct children only.
  - Events are `add | change | unlink`, about 570 ms after the write (it waits for the write to settle). `.git/logs/HEAD` fired on a commit.
- `$.session.send({ to: { sessionId }, text })` between two sessions on one machine arrives in under a second. The receiver's `session.receive` sees `origin: { kind: 'peer', plugin }` and the text inside a `<cross-session-message …>` envelope, so match with `includes`, not `startsWith`. `{ consumed }` keeps it out of the conversation. Passed on, it becomes a row and a model turn there. Both sessions were in bypass mode; different modes are untested.
- git as a lock, in a bare repository:
  - `update-ref <ref> <new> <40 zeros>` creates only when absent (exit 128 when held). `update-ref -d <ref> <holder>` deletes only on a match (exit 1 otherwise). `update-ref <ref> <new> <old>` steals.
  - 40 racing processes: one winner. Two writers making 100 locked increments each lost none.
  - Through `$.process.run`: 10 ms per `update-ref`, 14 ms for `hash-object -w --stdin`, 34 ms for `init --bare`. The ref file's mtime is when the lock was taken.
- Compiled PureScript loads. `purs` output bundled by esbuild into one ES module and imported by the hooks module (`import * as K from './kernel.js'`) passes `claude plugin validate`, runs in a live session, and runs under `claude plugin test`. A 100-line module using prelude, arrays, maybe and integers bundled to 12 KB.

## Tests

- `stubSession(on, options)` (`plugin/tests/kit.ts`) is the fake world:
  - a session, and a git repo at `/work` (`write`, `commit(message, { author, body, isMerge })`, `checkout`)
  - a clock: `session.clock.advance(ms)` resolves after fired timers and their work settle; `session.clock.settle()`
  - the model via `session.reply(...)`
  - subagents finished by `$.turn.complete(session.finish(n, answer))`
- Options: `email` (default `me@example.com`, `''` = none), `data` (seed the data disk), `isNewProject`, `install: 'clone'|'installed'`, `tags`, `isCloneDirty`, `isCloneCurrent`, `head`. Registers every stub needed to start and switch modes: extend it, don't register a second stub (one stub per event).
- Data disk: `session.disk` (absolute path → text), `session.data(rel)`, `session.removed` (rm targets). Deletion needs the marker: `session.disk.set(MARKER_PATH, …)` or a prior write.
- Explain in the kit: `session.lookups`, answered with `session.explain(reply, 'text the prompt contains')`. Order isn't guaranteed. With no answer, a file maps to no symbols. `session.editor(file, line, …, extra)` writes `focus.json`. Journal tests set `explain: 'off'` (a live editor triggers the 100 ms poll and slows minute-scale tests).
- Progress: `session.assess(reply)`, `session.assessments`. Updates: `session.ran` (claude and network git commands in order). A clone's top is the plugin folder's parent; an installed copy's `installPath` is `/`.
- `session.logs` = `$.ui.log` output (swallowed errors appear there).
- The tutor's own debug log in the kit: seed `data: { 'debug.json': { on: true } }` (and the marker), or run `/bsd debug on`. `session.debugLog()` returns every record across chunks. Records are written `FLUSH_MS` after they are noted, so `await session.clock.advance(FLUSH_MS)` before reading. The kit stubs `session.id` (`SESSION_ID`), `session.version` and `session.end`.
- Engines with ports are tested without the kit: `explain.test.ts` has `world()`, whose model is answered by hand with `w.answer(request, reply)`, which is how a test changes a file mid-call.
- `sessionTest` (30 s limit) for anything that starts a session; plain `test` (5 s) for pure functions. All files run in parallel processes, and each test loads the whole mod, so a busy machine takes seconds before the first action.
- A `$.clock.every` period is one dispatch with 10 s of real time. The 5-min deep-review timer spanning about 150 ticks can exceed it under load ("exceeded 10000ms budget"), failing when several sessions test at once. `await session.clock.settle()` before asserting on timer-started work.
- `$.command.run` resolves when the hook returns, not when its background work finishes: `await session.clock.settle()` after `/bsd` before touching the repo, or the first save becomes the baseline.
- `$.agent.spawn` in the kit: the stub gets `subagent_type`, must return `{ model }`, and the returned `agentId` is dropped (the plugin sees `{ model: 'inherit' }`). Hence `register.tsx` falls back to `$.agent.list()` by type (also needed when another mod answers the spawn); the kit stubs `agent.list`.
- The kit auto-answers `$.ui.invalidate('ui.render')` but not prompt-event invalidations: stub `ui.invalidate`.
- `test(name, { options: { engineering: 'knuth' } }, body)` sets `userConfig` per test.
- Nearly every `$` call needs a stub before the test's first `$` call (except `$.state`, `$.ui.invalidate`). `session.start` runs only if fired. The test's own `$` has no `state`: assert via the pane or via sends and logs.
- Types are strict: `$.command.run` needs `origin` and `presentation` (`typed()` in kit); a `command.register` stub returns `{ value: { command: e.name } }`.
- Timers move only with the clock: after `/bsd` the hello stays at its first word until advanced by `TALK_MS` per word.
- Each test starts freshly loaded with default state; `/clear` can only be approximated.
- Remove debug lines by hand: `git checkout <file>` discards other uncommitted changes too.

## References

Claude Code docs: mods overview, reference, events and API (`code.claude.com/docs/en/plugins/mods/*`); plugins (`/plugins/components`, `/plugins/manifest-reference`, `/plugins/create-marketplace`, `/plugins/host-marketplace`, `/plugins/loading`, `/plugins/publish`). Directory: `claude.com/docs/plugins/submit`, `/plugins/pre-submission-checklist`. Related: Anthropic's `learning-output-style` plugin (Claude writes most of it and leaves pieces for the user; this project leaves all of it to the user).
