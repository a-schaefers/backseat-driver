# CLAUDE.md

AI-only reference for this repository. Terse by design. `README.md` is the only human document (plus `plugin/README.md`, its short summary for the plugin directory); this file is everything else. There is no separate design spec.

## Rules (owner's standing instructions)

- Keep this file current: any change to what it describes (commands, layout, behavior, invariants, API gotchas, verification status) updates it in the same commit. Record mod-API discoveries the next session would otherwise rediscover.
- Record product decisions here (section "Product") the session the owner states them.
- Commit and push to `origin main` when work is complete, unasked. Never force-push or rewrite pushed history without asking. Other sessions push to `main` too: fetch and rebase before pushing, stage by path, never `git add -A`. To push without publishing another session's unpushed local commit, commit from a worktree based on `origin/main` and `git push origin HEAD:main`.
- README rules:
  - Sections only: why, what it is, who it's for (and not for), how to use it. Nothing said twice. Short.
  - Owner's voice, as in their Enchant Games Journal (https://enchant.games/?slug=journal, feed `/rss.xml`, articles are YAML under `/news/`, listed in `/news.json`): first person, short punchy lines, blunt, a little irreverent, quotes as punctuation. Keep that voice.
  - No internal status (what was or wasn't tried, tested or installed): the owner called it invasive.
  - Never tell users how to run their workflow (which terminal or editor, where to run `claude`). State what works and where.
  - Never frame writing your own code as the slow option (no "for getting code written as fast as possible"). Saying the tutor isn't for having Claude write code, and that `/bsd off` restores normal Claude Code, is fine.
  - Never apologize for the project or hedge it ("trying to", "I see the irony"). State what it does with confidence.
  - Never suggest autosave to make it closer to live: editor plugins are the answer.
  - Never link to this file or to design detail. A new feature gets a line at most.
  - Every feature name says what it does to a newcomer (owner, 2026-10-05: "play-by-play" alone says nothing; it is play-by-play commentary). Teams get a bullet in "Who it's for".
  - `plugin/README.md` is the same story in one paragraph; keep it in step.
  - It carries facts that must stay true: install commands, minimum Claude Code version (text and badge), the `/bsd` command table, the footprint paragraph at the end of "What it is".
- Pronouns: the owner's are not stated. Use "the owner" or they/them.

## Product

### Why it exists (owner's reasons; every decision serves them)

- Ownership of understanding over speed: "if it takes me longer, but I grok it".
- The progressive surrender of engineers' technical autonomy (environment, tools, stack, now their brains). Unused skills fade. Developers who handed their work to agents commonly report losing the ability to code within months. People steering an agent think they are in the driver's seat while the machine thinks for them.
- The love of the game: the craft is the point.
- Iron sharpens iron: mentorship with a beginner's mind.

Stance: the project is against Claude writing the user's code, not neutral. While on, the AI never drives, and nothing presents handing code to it as faster or better.

### Decisions (do not re-propose rejected ones; do not design around the rest)

- Learning happens through the user's own projects. Exercises are planned but not built: until they are, the contract forbids them and the README doesn't promise or rule them out. The README calls nothing "not a linter" (the owner: it's quite similar to one). The tutor chimes in from the background; the user tunes how often, how deeply, in what voice.
- One command, then hands off: `/backseat-driver` or `/bsd`. Every setting has a default, every question is skippable, setup never blocks work. A language first met mid-session gets defaults; its questions are offered in the pane, never interrupting.
- One profile per language, never per project (`python`, not "python project 1"). It matters only once the user works in that language. The tutor may read other profiles (e.g. explain Rust via Python).
- The user has the last word. Pushback is weighed. A contested point goes to the deep review model for a second opinion, and the user is told. "Do it my way" always stands. The play-by-play may keep flagging until the user hushes it; a hush saves to that language's profile at once.
- The pane's default view is the play-by-play. Tabs: 1 Play-by-play, 2 Deep review, 3 Explain, 4 Progress, 5 Settings.
- Three layouts, one setting (owner, 2026-10-05): `unified` (the default) fits into Claude Code's own interface with no pane, `horizontal` is the whole view framed above the prompt, `vertical` is the pane. A three-way `/config` option, remembered; `/bsd layout` changes it. The unified layout was reviewed by UI/UX workers in live sessions before it was called done, as the owner asked.
- Settings are one press away (owner, 2026-10-05: surprised `/config` had no shortcut when the tab buttons work so well). A mod cannot add a row or a button to `/config`, so the pane's Settings tab edits the same rows, and `/bsd settings` opens it.
- First-run questions are few and single choice: the language they know best (once ever), then three per new language (level, goals, focus). Never more than ten at once. Esc skips the rest. Re-ask with `/bsd questions` or `q` in Progress.
- Three background jobs, each with its own model and thinking level: play-by-play (while hacking), deep review (commits), Explain (reading). The conversation uses the session's model. Explain's cache is per project (profiles are per language); all three jobs feed it and read it.
- Learning and Explanatory modes, read-only (owner, 2026-10-04): take the good parts of Anthropic's `learning-output-style` plugin and leave all the driving to the user. Its decision-point criteria and its `★ Insight` format are adapted into the play-by-play, the deep review and the contract. A decision point is pointed out as the user's call, with what each way costs, never handed over to be written. Insights are about this codebase and this code, never general concepts, and never a defect in disguise.
- License (owner, 2026-10-05): source-available, free for personal use, paid for commercial use. The terms are the PolyForm Noncommercial License 1.0.0 (`LICENSE`, root and `plugin/`, with a `Required Notice:` copyright line on top), plus `COMMERCIAL-LICENSE.md` (root and `plugin/`): who needs it, what it grants, no lockouts, "not on sale yet". Never call it open source. Each commit is under its own `LICENSE`: commits that carry MIT (everything before this change) stay MIT for whoever has them. SPDX `PolyForm-Noncommercial-1.0.0` in `plugin.json`, `package.json`, `editors/vscode/package.json` and the Emacs header. Until 2026-10-05 the license was MIT.
- Licensing is light (owner: "this is not Microsoft, don't be paranoid, a way for ethical companies to pay us"). Asked once at the first switch-on, personal or commercial; commercial asks for a key. Nothing ever stops working: a missing, bad, expired or withdrawn key only puts one dim line in the pane. Payment and deploying the server are for a later discussion with the owner.
- The adapted parts (an audit on 2026-10-05 found the decision-point lists and the `★ Insight` box are close paraphrases or copies of `learning-output-style`; everything else, and all 50 commits, are the owner's own) stay under Apache-2.0: `THIRD_PARTY_NOTICES.md` (root and `plugin/`, identical; `npm run licenses` compares them) holds the attribution, what changed and the license text. Each adapted prompt credits it in an HTML comment at its top, which `stripComments` removes before a model sees the file. Credit the same way when adapting anything else.
- Explain is never stale: freshness beats speed. Nothing is shown unless it matches the file on disk at that moment.
- Editor plugins (owner, 2026-10-05): Emacs, Neovim in Lua, and VS Code, in this repository under `editors/`. Simple and plug and play: they send what is useful (open files, the focused one, the caret's line and column, the selection, unsaved changes, whether the editor has the keyboard), and the pane says when an editor is connected. More editors can come; the protocol is the contract (see "Editor protocol").
  - Transport (decided by the editor-plugins thread, 2026-10-05): files, one per running editor, in the data folder. The mod cannot listen on a socket (no Node, and no network of its own is a footprint invariant), and the data folder is already where every session looks. An editor that finds no data folder writes nothing.
  - Two tutors at once: every driver reads every editor's file and keeps what is about its own repository. One editor serves every project it has files in; two editors in one project, the last caret to move speaks for it; a caret in a repository nested in another goes to the inner one's tutor. Within one project only the lease holder reads (see "Several sessions").
- Progress is honest: one report per language across projects. A level (beginner, junior, mid, senior), why, what the next level needs, recent notes, and encouragement kept apart from the level. Only the user's own work counts. A level can come back down. It stays in step with deep reviews. The owner says it is worth the token burn.
- State is never cleared by accident: clearing is deliberate and confirmed (one project, one language, or everything). Uninstalling can clear everything.
- Users stay up to date: a newer release is announced in the pane, one command fetches it, and the tutor comes back on by itself.
- Everything feels instant: no command waits on git or a model.
- The persona has two halves, chosen apart. The voice sets teaching style, tone and wording. The engineering persona sets what the tutor values, flags and recommends; its `default` is Claude's own judgment. Both apply to notes, deep reviews and conversation. A voice never brings its namesake's opinions about code; an engineering persona never brings its namesake's manner. Neither overrides the contract. A persona named after a real person is "in the spirit of": the tutor never claims to be them or quotes them, and is hard on the code, never on the user.
  - Voices: `default`, `torvalds`, `knuth`, `primeagen`, `eli5-tldr-kiss-terse`. Engineering: `default`, `torvalds`, `knuth`, `primeagen`.
- The persona has a face and can be switched off. A small animated character per voice speaks one short line at a time: a critical or design point in the user's latest save, a deep review's takeaway, now and then a joke. Dim at rest, quiet unless a look gives it something to say, one line where rows are scarce, no model calls of its own, off with one setting. Real-person personas get ASCII caricatures in good spirit (owner's call; a first version with mascots was rejected as too timid): Linus with square glasses, Knuth with round glasses, ThePrimeagen with headphones and mustache, the KISS Linux penguin in a top hat, and Claude Code's mascot for `default`.
- The tutor knows what the user is doing without making them say it: a per-project journal (below). "What are you working on right now?" is asked only on `w`, `/bsd working`, or by the tutor in chat when it is unclear and matters. The user's answer overrides the inference and persists across sessions until changed or taken back. Borrowed from the owner's topstep-claudebot (journal and briefings; not its reflection loop or inbox).
- Event-driven, not polled (owner, 2026-10-04): a state machine driven by Claude Code's own events and exact deadlines, preferring built-in signals over polling listeners. The owner accepts the extra complexity for a faster, more elegant mod. Polling is confined to one adaptive sensor for what Claude Code cannot push: the user's own saves, commits made outside it, and the editor's caret.
- File watching (owner, 2026-10-05, settling the open question from M0): watch files, provided a watcher such as inotifywait is found on PATH, and never break without one. Built as inotifywait children started at switch-on, not as `watchPaths` at session start, so "dormant until switched on" still holds (see "Pushed changes"). Editor plugins will push events too: a watcher is one source of nudges, not the only one.
- Failures are handled gracefully (owner, 2026-10-04): API rate limits, plan limits and Claude outages are told apart, retried with delayed backoff, and nothing pending is lost. Commits made meanwhile are reviewed later: the last three, up to a day old (approved with the plan, the owner can overrule the numbers).
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
  - the deep review's watchdog, a review given up on after three tries, and the retries of the look at progress
- Never run: the `primeagen` engineering persona.
- The Settings tab, `/bsd settings` and changing a setting while on: seen live (2026-10-05, see "Settings"). Not seen live: a change that Claude Code did not follow with a reload (`notReloadedText`), which tests cover.
- The license question, `/bsd license` and the key check: tests only. No server is deployed and `PUBLIC_KEYS` is empty, so a well-formed key is taken on trust.
- Persona pairs run live: `eli5-tldr-kiss-terse`+`knuth`, `primeagen`+`torvalds`. Every voice's character has been seen live.
- Editor plugins: each was run for real (Neovim 0.9.5 and Emacs 29.3 headless, the VS Code extension under Node against a stand-in `vscode` module and packaged with vsce) and wrote, beat and removed its file as the protocol says. Not yet seen: one of them driving a live tutor session (the cloud session that built them could not log in interactively), real VS Code, Windows.
- Decision points and insights (from `learning-output-style`): seen live in the play-by-play, the deep review and the conversation on Sonnet at low thinking. A play-by-play `insight` has not been seen live.
- Marketplace install, `/bsd update` and `/bsd uninstall` were run against a local git server at one project's scope, not GitHub. No release has been published, so installed copies stay at 0.1.0.
- The event-driven plan's last check (2026-10-04): one real session with the debug log on, through a save, ten seconds on the Explain tab, a commit with its review and progress look, and a hundred idle seconds. No errors. What runs in the background, read from the log: a scan of the working tree every second for a minute after something happened and every two seconds after that (five after ten idle minutes, by test); two stats ten times a second only while the Explain tab was open; a lease renewal every 20 s (two git calls, two small reads, one write); a journal write when something is new; and, with the animated persona on, its blink. Nothing else polled, retried or redrew.
- Open owner decisions:
  - which ref new installs get (see Updates)
  - whether to submit to Anthropic's directory
  - (settled by doing: the machines were written in TypeScript first, as approved, and then ported. New decision logic is born in PureScript from here on, see "Kernel".)
- Directory facts (checked 2026-10-04):
  - It lists mods, for Claude Code only.
  - Submit at claude.ai/directory/manage. It tracks a branch or tag, and the plugin path can be `plugin`.
  - A README of 40+ words inside `plugin/` and a LICENSE were required. `plugin/README.md` and `plugin/LICENSE` settle both. Whether the directory takes a noncommercial license is not known.
  - Limits: files under 256 KiB, at most 512 files.
  - Directory installs load as `<name>@synced`.
- Approved plan for part two: `~/.claude/plans/dynamic-wandering-micali.md` on the owner's machine (nine decisions, risks per milestone).
- In progress: the event-driven plan, `~/.claude/plans/wild-jumping-clover.md` on the owner's machine (approved 2026-10-04). Milestones M0 probes, M1 debug log, M2 locked store, M3 kernel (events, deadlines, health, play-by-play machine, sensor), M4 deep review queue, M5 Explain and journal on deadlines, M6 one driver per project, M7 pane pass, M8 optional push sources, M9 PureScript kernel. Done so far: M0 (see "Probed live" under Mod API), M1 (see "Debug log"; it also added the `session.end` flush of the journal) and M2 (the store and the locks, under "Data folder"). M3 (the kernel: deadlines, the scan, health, the play-by-play's state and status line; under "Play-by-play and watcher") and M4 (the queue of commits waiting for their review, its retries and watchdog; under "Deep review") are done too, and so is M5 (Explain and the journal on deadlines, the caret's fast lane, attention from timestamps; under "Explain" and "Journal"). Nothing in the mod runs on a repeating timer now except the animated persona's mouth and blink. M6 (one session drives a project, and what is on record about the person is read again when another session changes it; under "Several sessions") and M7 (the pane pass, under "Pane") are done as well. M8, the optional push sources: inotifywait is built (owner's approval, 2026-10-05; "Pushed changes" under "Play-by-play and watcher"). Claude Code's own `watchPaths` at session start are not used. M9, the PureScript kernel, is ported (see "Kernel"): the toolchain, the membrane, the check that the committed bundle is what the source builds, and nine modules: health, the play-by-play's decision, the pacing arithmetic, the scan cadence, the lease, the review queue, the store's retry policy, the status line and the deadlines. Each was ported after a parity run against the TypeScript it replaced. The last four (2026-10-05) have been run in tests only, not yet in a live session.

## Repository

The root is a plugin marketplace (`.claude-plugin/marketplace.json`, one entry with source `./plugin`). The plugin is `plugin/`, and everything in it ships to users. The validator warns about a `CLAUDE.md` at a plugin root (a failure under `--strict`), so dev files (`CLAUDE.md`, `package.json`, `node_modules/`, `scripts/`, `.github/`) stay at the root. There is no build step: Claude Code loads the TypeScript as it is.

```text
.claude-plugin/marketplace.json
plugin/.claude-plugin/plugin.json   manifest + userConfig (source of truth for settings and defaults)
plugin/skills/tutor/SKILL.md        the contract
plugin/personas/{voice,engineering}/*.md
plugin/prompts/                     play-by-play.md, deep-review.md, explain.md, progress.md, speech-bubble.md
LICENSE, plugin/LICENSE             PolyForm Noncommercial 1.0.0, identical
COMMERCIAL-LICENSE.md (also plugin/) the commercial terms, identical
THIRD_PARTY_NOTICES.md (also plugin/) the Apache-2.0 parts: learning-output-style, adapted
plugin/hooks/                       the Claude Code adapter (see "Host seam")
plugin/hooks/hooks.json             {"modules": ["./register.tsx"]}
plugin/hooks/register.tsx           all effects
plugin/hooks/pane.tsx, character.tsx, contract.ts  the pane's and the prompt's Claude Code side
plugin/core/                        shared: every module that does not know Claude Code
plugin/core/*.ts                    pure logic, and the engines with ports
plugin/core/art/<voice>.ts          each character's pixel art (palette + rows of letters)
plugin/core/kernel.js               the kernel, compiled from PureScript; committed, never edited by hand
plugin/core/kernel.d.ts, core.ts    what the kernel exports, and the one file that calls it
kernel/src/Kernel/*.purs            the kernel's source (dev tooling: not shipped)
kernel/spago.yaml, spago.lock       its package set, pinned
kernel/toolchain.json               the PureScript compiler, pinned by sha256
plugin/types/index.d.ts             state keys, tool inputs
plugin/types/runtime.d.ts           the globals shared modules may assume (read by tsconfig.core.json only)
plugin/tsconfig.core.json           the shared modules, checked without Claude Code's types
plugin/tests/                       claude plugin test; kit.ts is the fake world
scripts/dev-session.sh              live session in tmux
scripts/outage-proxy.py             a proxy to cut one live session off from Claude
scripts/toolchain.py                fetches the pinned compiler into local/bin (git-ignored)
scripts/build-kernel.sh             kernel/src -> plugin/core/kernel.js
scripts/release.sh                  cut a release
scripts/persona-preview.ts          the persona art as a terminal shows it, and as PNGs
editors/                            editor plugins: neovim/, emacs/, vscode/ (dev side: not shipped with the mod)
license-server/                     reference license server: issue, check, revoke keys (dev tooling: not shipped, not deployed)
.github/workflows/check.yml         npm run check on push/PR, pinned Claude Code
.github/workflows/nightly.yml       same check daily on newest Claude Code
research/                           research notes for the owner (not shipped): opencode.md, the plan for an OpenCode client
research/personas/                  one file per persona: how the person speaks and judges code, with sources; what the persona prompts are checked against
```

The ground rules in README ("Claude does not edit your files" etc.) describe end-user product behavior, not rules for working in this repo.

## Commands

```bash
npm install                      # once: TypeScript, and spago and esbuild for the kernel
npm run check                    # kernel + validate + licenses + test + typecheck + core + server
npm run build:kernel             # kernel/src -> plugin/core/kernel.js (fetches the pinned compiler the first time)
npm run kernel                   # fails when plugin/core/kernel.js is not what kernel/src builds
npm run licenses                 # LICENSE, COMMERCIAL-LICENSE.md, THIRD_PARTY_NOTICES.md: root and plugin/ copies identical
npm run validate                 # claude plugin validate . --strict && ./plugin --strict
npm test                         # claude plugin test ./plugin
npm run typecheck                # tsc -p plugin/tsconfig.json
npm run core                     # tsc -p plugin/tsconfig.core.json: the shared modules typecheck without Claude Code's types (see "Host seam")
npm run server                   # the license server's typecheck and node:test tests (they check its keys with the plugin's checker)
scripts/dev-session.sh           # live session in tmux (default session name bsd)
scripts/release.sh minor --push  # patch|minor|major|X.Y.Z: bump plugin.json, check, commit, tag, push
npm run persona -- [dir] [voice] # print the persona art in truecolor, and write PNGs of every pose to dir (default local/persona-preview)
scripts/debug-tail.sh            # follow the tutor's debug log (see "Debug log")
scripts/outage-proxy.py 18080    # a proxy for staging an outage in a live session (see "Live checks")
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
- A cloud container can run a real session (found 2026-10-05; earlier threads thought not). `claude -p` there is logged in through the environment, and so is an interactive `claude` in tmux, provided it keeps that environment (not `dev-session.sh`, whose `env -i` drops it) and skips onboarding: give it its own `CLAUDE_CONFIG_DIR` holding a `.claude.json` with `hasCompletedOnboarding: true`, `theme`, the account fields (`userID`, `oauthAccount`) copied from `~/.claude.json`, and `projects.<ride>.hasTrustDialogAccepted: true`, plus a `settings.json` for `pluginConfigs["backseat-driver@inline"]` (cheap models). Claude Code is not on `env -i`'s PATH there either (`/opt/node22/bin`).
- Drive: `tmux send-keys -t bsd '/bsd'` then, separately, `tmux send-keys -t bsd Enter` (sent together, Enter is often swallowed, and so it was 0.4 s after the text: wait a second). Check the prompt box is empty afterwards. Read with `tmux capture-pane -p -t bsd`, after a moment.
- `BSD_DEBUG=1` switches the tutor's debug log on in that session's data folder and passes `--debug-file`, so Claude Code's own log lands beside it (`debug/claude-code.log`; Claude Code also makes a `latest` link there). Follow it with `scripts/debug-tail.sh -d "$BSD_DATA_DIR"`.
- A new folder shows the trust prompt first: `Down`, `Enter`. Keys sent before startup finishes are lost.
- Keep the throwaway repo path plain: with long dashed paths the model mistyped them and hit permission prompts.
- `C-x Tab` focuses the pane (hotkeys work then), `Escape` unfocuses.
- At 170 columns the pane docks beside the conversation. Read it with `cut -c1-94` (conversation) and `cut -c95-` (pane). tmux gets the main-screen layout (pane inline above the prompt) unless `BSD_FULLSCREEN=1`.
- Settings: `--settings '{"pluginConfigs":{"backseat-driver":{"options":{"deep_review_model":"sonnet"}}}}'`. Keep deep-review checks cheap this way.
- Real model calls on the owner's plan: short prompts, `--model sonnet` unless needed otherwise.
- The owner's default permission mode is bypass. Pass `--permission-mode default` when the check involves Claude running tools.
- Saving under `plugin/` reloads the mod mid-session; the mode and pane come back. An idle session looks for the change only every 30 s (`plugin-dir watch … idle, polling every 30000ms` in Claude Code's log), so the reload can be that late. Do not save under `plugin/` while a live check runs unless the reload is the check.
- An outage is staged with `scripts/outage-proxy.py <port>`: start the session with `--settings '{"env":{"HTTPS_PROXY":"http://127.0.0.1:<port>","NO_PROXY":"127.0.0.1,localhost"}}'`, kill the proxy for the outage, start it again to end it. Without `NO_PROXY` Claude Code cannot reach the mod's own tools, which it serves on a loopback port: every `$.tool.register` then waits out 8 s (64 s for the eight tools, seen live).
- With no connection, a `$.model.complete` fails within a second, and a subagent only after Claude Code's own 11 tries: 170 s.

## Architecture

- Contract: `SKILL.md`, the single source of tutor behavior. The mod injects it and never carries a copy.
  - `SKILL.md` describes behavior only. Anything naming this plugin's commands, tools or agents goes in `SESSION_NOTES` in `contract.ts`, so the skill works alone (as `/backseat-driver:tutor`) with mods off. That fallback is a conversational tutor without background reviews.
- Personas: the chosen engineering file, then the voice file, are injected after the contract and into both review prompts. Each persona file states which half it is and that it leaves the other alone; a new persona file needs that paragraph too.
  - `research/personas/` holds the research behind each persona (voice and engineering judgment, with sources, folklore marked) and where the prompts diverge from it (2026-10-05). Read it before changing a persona prompt; a new persona gets a research file first.
- Mod: `plugin/hooks/` (the adapter) over `plugin/core/` (shared). Commands via `$.command.register` (`/backseat-driver`, `/bsd`, `/backseat-driver-update`); tools via `$.tool.register` (`hush`, `unhush`, `record`, `lookup`, `progress`, `profile`, `working`, `activity`); pane via `$.ui.open` plus a `ui.render` hook, contents in `$.state`. Why a mod, not a skill plus a monitor: a monitor would turn every save into a conversation turn on the main model. The mod reviews out of band.

### Module shape (enforced by Claude Code)

A hooks module may not pass `$` to an imported function. Every `on(...)` and `$.noun.method(...)` must be spelled in the module itself. Hence:

- `register.tsx` is the only file with effects: all hooks, all `$` calls, all functions taking `$`. It imports the shared modules as `../core/<name>`.
- Every other file is pure (plain values in and out), tested directly without stubs.
- Effects cross imports as capabilities, i.e. closures over `$` (`args => $.process.run(['git', ...args])`). Passing a closure is allowed; passing `$` is not.
- `atom(...)` definitions live in `register.tsx` with literal `plugin` and `key`. Every state key is declared in `plugin/types/index.d.ts`.
- One `on` per event per matcher. Two unmatched `on('session.start')` stop the module loading.
- A function taking `$` must have a name unique in the file, locals included. `const [skill, look] = …` broke loading because `look` was also a function.
- Matchers must be literals (`{ command: ['backseat-driver', 'bsd'] }`). The validator prints `command=?` for spreads and variables.

### Files

| File | Holds |
| --- | --- |
| `settings.ts` | `/config` values as typed settings; the plugin's `/config` rows for the Settings tab; when a change to each takes effect (`SETTING_EFFECTS`) and what is said about it |
| `mode.ts` | `/bsd` argument parsing, mode transitions, `HELP` (the authoritative command and key list) |
| `contract.ts` | system prompt contents, `SESSION_NOTES`, instruction-file reframing |
| `guard.ts` | which paths are the user's |
| `git.ts`, `noise.ts`, `diff.ts` | `git status` parsing, files and edits never worth a look, line diff |
| `watcher.ts` | change since the last look (ports; tests use an in-memory tree) |
| `gate.ts` | the pacing arithmetic's types, and `usagePressure`. The arithmetic is the kernel's (`Kernel.Pace`) |
| `scheduler.ts` | deadlines: named things to do at a known time, one timer for the earliest. When to arm it and what is due are the kernel's (`Kernel.Schedule`) |
| `sensor.ts` | how often the working tree is scanned, and how often the spot in focus is checked while someone watches it. The kernel's (`Kernel.Sensor`) |
| `filewatch.ts` | pushed changes: inotifywait's command lines, its output read as lines, and what a reported path means (`Nudge`) |
| `health.ts` | whether Claude is answering: the types, and the plan's pressure. The decisions are the kernel's (`Kernel.Health`) |
| `core.ts` | the membrane: the one file that imports `kernel.js`, turning the kernel's flat records into the mod's tagged unions and back |
| `kernel.js`, `kernel.d.ts` | the kernel, compiled from PureScript, and what it exports |
| `play.ts` | what the play-by-play is doing and when it looks next, worked out from the facts: the types. The decision is the kernel's (`Kernel.Play`) |
| `status.ts` | the pane's status line as a sentence, with a clock time for every wait. The wording is the kernel's (`Kernel.Status`) |
| `clock.ts` | `clockTime`: a time of day in the person's time zone, handed to the kernel wherever its wording names a time |
| `notes.ts`, `prompts.ts` | reviewer reply → notes; reviewer and conversation prompt text |
| `review.ts` | deep review scope: reflog, what counts as a commit, the request |
| `reviewqueue.ts` | the commits waiting for their deep review and the look at progress after it: the types and reading `queue.json`. The queue's rules, how often a stage is tried and how far apart, and what the tab says while one waits are the kernel's (`Kernel.Queue`) |
| `languages.ts` | extension → language; a project's main languages |
| `profiles.ts` | profile storage and changes: answers, hushes, lesson memory, person text |
| `hash.ts` | fingerprints |
| `datahome.ts`, `storage.ts` | data folder paths, what is removable, `Disk` port, `memoryDisk()` |
| `store.ts` | every read and change of the tutor's JSON files: half-written files, backups, one change at a time, read-back. When to read again, write again or give up is the kernel's (`Kernel.Store`) |
| `locks.ts` | locks that hold across sessions, as refs in a bare git repository of the tutor's own |
| `lease.ts` | which session drives a project's background jobs: the lease as stored. Who may take it and when to look again are the kernel's (`Kernel.Lease`) |
| `forget.ts` | forget scopes, dialog wording, paths per scope |
| `knowledge.ts` | per-file knowledge and the freshness rule |
| `explain-prompts.ts` | map-a-file and explain-a-symbol requests and replies |
| `explainer.ts` | Explain engine (ports): queue, fetch policy, never storing answers for changed text |
| `focus.ts` | spot in focus, editor files, conversation's view of the spot |
| `avatar.ts` | characters, poses, word-by-word speech, bubble |
| `sprite.ts` | pixel art → Raster cells: poses, half blocks, dim per backdrop, base64 |
| `character.tsx` | `characterArt`: the character in pixels where a Raster can be drawn, in ASCII where not. What a layout calls |
| `authorship.ts` | whose work a commit is; added lines by language |
| `progress.ts` | ledger, level rules, assessment request, report text |
| `project.ts` | project knowledge from deep reviews; what reviewers are told |
| `journal.ts` | journal storage: entries, save runs, sitting roll-up, cross-session merge |
| `editors.ts` | the editors' files: which editors are connected, and which one speaks for this project |
| `attention.ts` | an editor's report beyond the spot; caret and on-screen time |
| `enclosing.ts` | enclosing definition name by indentation, no parser |
| `glance.ts` | journal as text for pane, reviewers, conversation |
| `recorder.ts` | journal engine (ports) |
| `working.ts` | "What are you working on right now?" and `/bsd working` |
| `update.ts` | install kind, versions, release tags, update and uninstall commands |
| `license.ts` | `license.json`, the first-switch-on question, `/bsd license` words, the pane's line, the server's answer. The standing is the kernel's (`Kernel.License`) |
| `licensekey.ts` | key format, `PUBLIC_KEYS`, ECDSA P-256 verification in BigInt. Imports nothing, so the server's tests import it |
| `questions.ts` | first-run questions |
| `debuglog.ts` | the debug log: records, chunks, the ring of latest records, the tracer, `/bsd debug` parsing |
| `pane.tsx` | the tutor's drawing in each layout from plain data, handlers passed in |

### Host seam (Claude Code vs shared)

Preparation for a second client (`research/opencode.md`, owner, 2026-10-05: one shared core, Claude Code first class, nothing duplicated). Started 2026-10-05 as tidiness only: nothing a user sees changes. The shared modules moved to `plugin/core/` (2026-10-05, a pure rename). Next, in the plan's order: pull `register.tsx`'s wiring into the core behind one `Host` interface, one engine at a time.

- Adapter files, which may know Claude Code: `register.tsx` (every hook and `$` call), `pane.tsx` and `character.tsx` (Claude Code's `Elements`), `contract.ts` (its prompt sections: `doing_tasks` swapped, the `claudeMd` preamble reframed; `SESSION_NOTES` names the tools as `mcp__backseat-driver__…`). Its persona and comment helpers are shared and move out when the core does. They are `plugin/hooks/`. Everything in `plugin/core/` is shared, and imports nothing from `hooks/`.
- Enforced by `npm run core` (`plugin/tsconfig.core.json`): `plugin/core/` typechecks with no Claude Code types and no globals beyond ES2023 and `types/runtime.d.ts` (`AbortController`, `AbortSignal`). An import of `claude-code`, of an adapter file, or a use of a timer or `fetch` fails it. A global the shared code needs goes in `runtime.d.ts` only if every host has it (Claude Code's mod environment and Bun both).
- Where the shared code needs a Claude Code type, it spells the shape itself: `Options` in `settings.ts` (Claude Code's `PluginOptions`), `ConfigRowLike` (`ConfigRow`), `ModelResult` in `health.ts`.
- Shared files that still carry a Claude Code assumption in what they say or decide (seams for the `Host`, not bugs):
  - `health.ts`, `Kernel.Health`: the error words are Claude Code's and Anthropic's API's; `pressureOf` reads Claude plan windows (`rateLimits`).
  - `Kernel.Status`, `Kernel.Queue`'s tab text, `Kernel.Play`'s comments: "Claude is not answering".
  - `mode.ts`: "Claude Code is back to normal", `/config` in `HELP` and `SETTINGS_OFF`.
  - `settings.ts`: `Thinking` is Claude Code's effort scale; `settingRows` reads `/config` rows; `SETTING_EFFECTS` assumes a host that loads the module again when the options change, and `notReloadedText` names `/reload-plugins`.
  - `guard.ts`: Claude Code's own paths (`~/.claude/`, `/tmp/claude-<uid>/`).
  - `update.ts`: `claude plugin`, `installed_plugins.json`, `plugins/synced/`, marketplace clones.
  - `avatar.ts`, `art/default.ts`: the `default` voice is Claude Code's mascot, which another client may not use.
  - `sprite.ts`: theme names from `/config`.
- Not shared, by nature: `prompt.compose`, `prompt.context`, `prompt.submit`, the edit guard's hook, tool and command registration, `$.state` atoms, `/config`, update and uninstall. See the plan's "What is not a port".

### Kernel (PureScript)

The owner wants the logic functional where it can be, "to detect, prevent and reduce bugs" (Product). The decisions the mod makes live in `kernel/src/Kernel/*.purs`. Their types carry the rules: a state that cannot happen cannot be built, and a transition that is not handled does not compile. Modeled on `../merecatholicity.com` (`purescript/src/Domain/*`, `app/core.ts`).

- Rule: new decision logic is written in PureScript. TypeScript is the shell (`register.tsx`: effects), the pane, the engines with ports, text parsing, and the membrane. Claude Code reads `on(...)` and `$` calls from TypeScript source, so those cannot move.
- `PORTED`: `Kernel.Health` (the shared wait after failures, what an API error means), `Kernel.Play` (what the play-by-play is doing, when to come back, whether a look is due), `Kernel.Pace` (backoff after failed looks, the gap near the plan limit), `Kernel.Sensor` (how often to scan, and to check the spot in focus), `Kernel.Lease` (who may take a project's lease, and when to look at it again), `Kernel.Queue` (the commits waiting for their review: at most three, each once, one stage at a time, the tries and their spacing, what the tab says while one waits), `Kernel.Store` (the store's retry policy: when a file is read again, counts as broken, is checked before a write without the lock, is written again, or given up on, and when the old copy is kept), `Kernel.Status` (the status line, the row under it, and the state the character's pose comes from), `Kernel.Schedule` (when the one timer is armed and for how long, which deadlines are due and in what order). Born there: `Kernel.License` (where the person stands with the license, when to ask the server). Their TypeScript files (`health.ts`, `play.ts`, `gate.ts`, `sensor.ts`, `lease.ts`, `reviewqueue.ts`, `store.ts`, `status.ts`, `scheduler.ts`) keep the types and the parsing and re-export the kernel's functions from `core.ts`.
- `TO PORT`: nothing. The engines with ports (`explainer.ts`, `recorder.ts`, `watcher.ts`) hold effects and text and stay TypeScript; a decision found in one of them is a candidate. Not for the kernel: anything that parses text or JSON from outside (`parseLease`, `parseQueue`, `pressureOf`'s dates), which stays at the edge.
- How it reaches the mod:
  - `scripts/build-kernel.sh` (`npm run build:kernel`): `scripts/toolchain.py` puts `purs` 0.15.16 in `local/bin` (downloaded from the GitHub release, tarball and binary each checked against the sha256 in `kernel/toolchain.json`), `spago build` compiles `kernel/src` with the package set pinned in `kernel/spago.yaml` and `spago.lock`, and esbuild (pinned exactly in `package.json`) bundles the entry module `Kernel.Main` into one ES module, `plugin/core/kernel.js`.
  - `kernel.js` is committed: installs copy the repository, and nothing is built on a user's machine. It is 89 KB for ten modules (the limit for a file in a plugin directory listing is 256 KiB). Never edit it.
  - `npm run kernel` builds beside it and compares. `npm run check` starts with it, and so does CI, which keeps `local/bin` and `kernel/.spago` between runs.
  - `Kernel.Main` re-exports what crosses. What it does not export is not in the bundle.
- The membrane, `core.ts`, is the only importer of `kernel.js`:
  - PureScript functions are curried: `K.stepWire(health)(event)`.
  - What crosses is plain data, as flat records in which every field is always present (`HealthWire`: `{ state, trouble, detail, until, failures }`), because one PureScript record type cannot be a union of shapes. The kernel turns them into its own types and back (`healthFromWire`, `healthToWire`), and `core.ts` turns them into the tagged unions the rest of the mod uses. A tag the kernel does not know becomes the safe value (`Ok`, a server error), never an exception.
  - The membrane keeps identity: when an event changes nothing, `stepHealth` hands back the object it was given, and `ok` is always the one `HEALTHY`. `noteOutcome` tells a change by `health === before`.
  - Keep it thin. A decision made in `core.ts` is one the kernel's types did not check.
  - Wording that names a time of day takes `clockTime` (`clock.ts`) as its first argument, a plain `Number -> String`: the kernel cannot read the time zone, and the edge can.
  - Opaque types keep a rule no caller can break: `Kernel.Queue`'s `Queue` is made only by `fromCommits` (the latest three, each hash once) and the functions beside it.
- Porting a module: write `Kernel.X` with the same rules, export its `…Wire` functions from `Kernel.Main`, declare them in `kernel.d.ts`, write the membrane functions in `core.ts` under the names the TypeScript module exported, and re-export them from that module so that no caller changes. Then copy the old TypeScript into a temporary reference under `plugin/tests/` and run both over seeded random histories. When they agree, delete the reference and the old logic, and keep property tests (the rules, over random histories) beside the table tests.
- The second parity run (2026-10-04) agreed everywhere on the first try: the pacing arithmetic at every half percent and every failure count, the scan cadence over 20,000 random facts and its exact edges, 40,000 random steps of the lease with its same-object rule, and 60,000 random sets of facts through `playOf`, `wakeAt` and `isLookDue` at four moments each, every state and every reason reached. The one thing the compiler caught on the way that TypeScript would not have: `Waiting` meant two things (Claude not answering, and a look held back), and the play module would not compile until each use said which.
- Health's parity run (2026-10-04): 60,000 random steps of `stepHealth` and `mayAsk`, 20,000 retry delays, every error word and 500 model results agreed, with one difference that is meant: an API error with an empty word used to leave the detail empty ("The last look failed ()") and now names the status ("error 503").
- The queue's parity run (2026-10-05): 2,000 random histories of 30 steps (a commit seen, let go, reviewed, a try that failed, time passing up to a day), every query (`isSpent`, `nextToReview`, `nextToAssess`, `settledIn`) under all four settings after each step, and 20,000 sets of health, pressure, refusal and retry time through `heldText` and `failedText`, agreed on the first run, the same-object rule of `current` and `withCommit` included. The one change that is meant: the stage is a type (`ToReview | ToAssess`), not a flag beside a count, and a queue read from disk naming a commit twice keeps it once.
- The store's parity run (2026-10-05): 3,000 random histories of twelve reads and changes, with no locks, locks, or locks refused, and another session emptying, half-writing or rewriting the file or its backup between any two steps. Every read, write, wait, note and result agreed with the old store, step for step, every note and every wait reached. `store.ts` keeps the reading and writing; each decision in its two loops is one call (`afterRead`, `changeStep`, `keepsBackup`, `afterWrite`).
- The status line's parity run (2026-10-05): 60,000 random states of the play-by-play, every reason for a wait, with and without a time, against every health, pressure, scan time and list of failures, through `playLine`, `healthLine` and `watchOf`. They agreed on the first run. The kernel reads a `Play` back from the wire (`playFromWire`) for this: a state it does not know is `Starting`, a reason it does not know a failed look.
- The scheduler's parity run (2026-10-05): 2,000 random histories of 40 steps, with deadlines set, moved, cancelled and cleared from the shell and from inside a deadline's own work, some of it throwing, and the clock moved by fake timers. Every timer armed and cancelled, every run, failure, `at` and `all` agreed in order. Due deadlines at the same time run in the order the scheduler's `Map` lists them, which is the order their names were first set (moving one keeps its place), as before.
- PureScript things that bite here:
  - `Int` is 32 bits. Clock times are `Number`.
  - `type` is a reserved word, so an event's tag is `kind` on the wire.
  - `Data.Number.round` is JavaScript's `Math.round`, so the arithmetic matches the TypeScript it replaced to the millisecond.
  - Two modules may name a constructor alike (`Health.Waiting`, `Play.Waiting`). Import one of them qualified.
  - `Kernel.Main` can only re-export a name as it is. Where a module's names are too plain to stand alone in the bundle (`claimed`, `isHeld`), `Main` gives them a prefixed alias with its own signature (`leaseClaimed`).
- Where `packages.registry.purescript.org` is blocked (a cloud sandbox), spago cannot fetch the package set. Clone each package of `spago.lock` at its tag into `kernel/.spago/p/<name>-<version>` (`git clone --depth 1 --branch v<version> https://github.com/purescript/purescript-<name>.git`, then drop its `.git`): spago builds from there, and the bundle came out byte-identical.
- `claude plugin test` runs every test file. To run some, copy `plugin/` without its other tests to a scratch folder (symlinks are refused as path traversal) and run it there.
- `npm audit` reports three "high" findings, all one advisory: `braces` through `micromatch` through spago, a stack exhaustion on a hostile glob pattern. spago is a dev tool that globs this repository's own files, nothing of it ships, and the fix npm offers is a downgrade of spago. The reference repository lives with the same one.
- Live with the five modules (2026-10-04): a save was seen at the next scan, the pane said "Saw your save. Looking when you pause.", the look started 10.0 s after it, two notes came back, and the session held its project's lease.
- Live (2026-10-04): a real session on the bundle went through an outage and back: no connection, `waiting offline failures=1`, the wait over 12 s later, a lookup answered, `ok`. The mod loads `kernel.js` through `register.tsx` → `health.ts` → `core.ts`.

### Mode

- `/bsd` returns at once (live: line at 190 ms, pane at 250 ms). `switchTo` awaits only loading the contract, setting the mode and opening the pane, because the contract must be in force from the next prompt. Everything else (watcher, profiles, reviewer, tools, questions, survey, update check) runs in un-awaited `engage`, and `engage` itself does not wait for `registerTools`: `$.tool.register` resolves once Claude Code has connected the tool, or after 8 s. `engagement` counts switches, and every step of `engage` and `startWatching` re-checks it after each await, so switching off mid-setup leaves nothing running.
- Modes: `off | on | paused`, stored twice. `$.state` survives a module reload (including a `/config` change) but is reset by `/clear`, `/resume` and `/branch`. A module variable survives those but not a reload. `session.start` restores the variable from state; `classic.SessionStart` (source `clear|resume|fork`) writes it back to state. Result: on survives both; every new session starts off.
- The pane survives `/clear` and `/resume` too. `session.end` with reason `clear` or `resume` fires before `$.state` is emptied: `carryPane` reads the pane's atoms out into the module (one round, well inside the hook's 1.5 s), and `restorePane`, from `classic.SessionStart`, writes them back: the tab, the notes, the dismissed notes, the review, the profiles, Explain, Progress, the status line. After `/branch` (`fork`), where nothing was read out, what the module can work out again is shown again (status, profiles, progress, Explain), and the notes and the review are not.

### Tutor mode (while `on` or `paused`)

- `prompt.compose` removes Claude Code's `doing_tasks` section ("find the method and modify the code"). It appends a last, session-scoped section `backseat-driver:contract`: SKILL body, `SESSION_NOTES`, person text (profiles + progress), engineering persona, voice. Full prompt section ids: `intro, system, doing_tasks, actions, tools, tone`, then session-scoped ones such as `memory`. A lean prompt has `lean_body` and no `doing_tasks`; the code handles both.
- `prompt.context` rewrites the `claudeMd` block's opening ("These instructions OVERRIDE…") so the project's instructions stay in force except where they say to write code. The block also holds the user's global instructions, so reframe, never drop. A mode switch calls `$.ui.invalidate('prompt.context')` (cached event).
- `prompt.submit` attaches the open notes, the latest review, the character's last line and the journal brief.
- `tool.call` on `Edit|Write|NotebookEdit` denies unless the path is Claude Code's own (`~/.claude/`, or `/tmp/claude-<uid>/`), so the tutor can still save memories.
- Note buttons send questions with `$.prompt.submit`.
- The contract's "Decision points are theirs" and "Insights" sections are the conversation's half of the adapted Learning and Explanatory modes: name a decision as the user's, with the trade-offs, and step back; offer a `★ Insight` box (two or three points about this code) when explaining, not in every reply.
- Live: told to "add a median function" in a repo whose CLAUDE.md says to edit files, the tutor declined, hinted, and used that file's conventions. Ordered to use Edit, it refused without calling it.

### Play-by-play and watcher

- Events and deadlines drive the mod, not a tick (owner, 2026-10-04). Nothing compares the clock against a condition over and over:
  - `scheduler.ts` holds named deadlines and keeps one `$.clock.after` armed for the earliest. Setting a name again moves it. Work that is due is started, not awaited. The names: `scan`, `focus` (the fast lane), `look`, `health`, `review`, `assess`, `review-timer`, `review-watchdog`, `review-verdict`, `explain`, `journal`, `lease`.
  - An engine with ports does not keep time itself. It tells the shell when it next has something to do through a `wakeAt(at | null)` port (`explainer.ts`, `recorder.ts`), and the shell sets or cancels the deadline of that name.
  - A look is the deadline `look`, set by `planLook` whenever a fact it rests on changes (a save, the end of a look, a failure, the plan's limit). It fires at the moment the quiet time ends: live, 10.0 s after the save was seen.
  - `play.ts` works the state out from the facts each time (`playOf`): `starting`, `no-git`, `paused`, `watching`, `on-request`, `settling(dueAt)`, `looking`, `waiting(until, why)`. Nothing is remembered that could disagree with the facts. `wakeAt` is when to come back, `isLookDue` whether a look may start then.
  - `showPlay` writes the `watch` atom (`{ state, lastLookAt, line }`) only when it changed. `status.ts` makes `line`. A wait says why and until when as a clock time (`Next try 12:07`), so nothing redraws every second.
- The one thing the mod polls is the working tree, because nothing tells it about the person's own saves, their commits in their own terminal, or their editor's caret (see "Probed live": no watch in `$.fs`, `FileChanged` only for paths named at session start, no watcher installed). `scan` in `register.tsx` is that poll, one at a time, the next planned when it finishes:
  - `sensor.ts`: 1 s apart for a minute after something happened (`activeAt`: a save, a caret move, a prompt, a key in the pane, switch-on), 2 s otherwise, 5 s once nothing has happened for ten minutes. Each quarter second a scan took adds 2 s, up to 32 s.
  - `kick` scans at once: on `prompt.submit`, when a turn of the conversation ends, on a key in the pane, on resume.
  - The fast lane (`fastPoll`, deadline `focus`): while someone can see the Explain view, a stat of the file in focus and a listing of the editors' folder, ten times a second. Each check plans the next, `focusGapMs` after it (100 ms, four times what the check took when that is more, 2 s at most), and none is planned once nobody is watching. While it runs, the scan leaves the editors' folder to it.
  - Paused, nothing scans and no look is due.
  - A scan never calls a model. It feeds the journal and Explain, checks HEAD, and calls `planLook`.
- Pushed changes (owner, 2026-10-05: "so long as a file watcher like inotifywait is found on PATH, but don't break without it"). `filewatch.ts` is pure; `startPushing`, `runPusher` and `nudged` in `register.tsx` are the shell.
  - The first scan of a watching run (so only in the session that drives the project, and only while on) tries `$.process.spawn` of `inotifywait`. Not on PATH, the spawn rejects at its first pull: trace `push / no watcher`, and the scan carries on exactly as before. It is tried again at the next switch-on or takeover, never in between.
  - Two children. `tree`: `inotifywait -m -r --format %w%f` over the root, events `close_write create delete moved_to moved_from`. The folders git ignores (`git ls-files --others --ignored --exclude-standard --directory`, at most 200) and every folder of `.git` but `logs` are named with `@`, which keeps them out of the watch; `--exclude` does not (3.22 still watches what it matches and drops only the events), so it is there for what appears later. `.git/logs/HEAD` is written on every commit and HEAD move. A git folder outside the root (worktree) gets its `logs` watched beside it. `focus`: the data folder's `editors/` folder, not recursive, where each running editor writes its report (`*.json`; an editor's rename of its `.tmp` shows as `moved_to`, and the `.tmp` itself is ignored). The folder is made first (`editors/.keep`), so that it can be watched before any editor has run. It is started only once the tree's is live, so a missing inotifywait is looked for once.
  - A child is live once its stderr says `Watches established.`. Then it kicks a scan (what changed while the watches were set up), and from then the scan is a safety net: `Kernel.Sensor` gives `PUSHED_SCAN_MS` (30 s) when `isPushed`, and `PUSHED_FOCUS_MS` (2 s) for the fast lane while both children are live.
  - Each piece of output is split into lines (`lineSplitter`; a piece can end mid-line) and turned into at most one nudge per kind (`nudgesOf`): `tree` (the paths), `head`, `focus`. `nudged` is the one entry for a pushed change, whatever the source (an editor plugin is to use it too): a tree or head nudge kicks a scan; a nudge that touches the spot in focus runs the fast lane's check now while someone watches it; a focus-file nudge otherwise kicks a scan. The scan still decides what changed.
  - A child that ends (watch limit reached, killed) is dropped with trace `push / stopped` and its complaint, and the scan goes back to its own pace at once. Nothing is shown in the pane: without a watcher the tutor works as it did.
  - Stopped (`stopPushing`) by `stopWatching` (switch-off, a new switch-on) and `stopDriving`. Leaving the loop, or `return()` on the stream, kills the child; a module reload kills it too.
  - Not seen live yet (no logged-in session in the cloud container where it was built). inotifywait 3.22 was run by hand with the exact command lines: 6 watches for a repo whose `node_modules` and `.git/objects` would have been 25, the save, the commit (`.git/logs/HEAD`) and an editor's rename onto a report in the data folder reported, `node_modules`, `build` and a write to `debug/` not.
  - Not built: another watcher (`fswatch` on macOS would be a second argv and line format in `filewatch.ts`). Without inotifywait on a Mac, the scan does it all.
- Failures (owner: told apart, retried with delayed backoff, nothing pending lost). `health.ts`:
  - `outcomeOf` reads a `$.model.complete` result, `outcomeOfError` one of Claude Code's error words. Troubles: `rate-limit`, `overloaded`, `server`, `offline` (no HTTP status at all), `timeout`, `account` (login, billing, account on hold, cloud credentials), `job` (`model_not_found`, `invalid_request`), `reply` (empty).
  - `callModel` reports every outcome to `noteOutcome`. So does `classic.StopFailure` (the conversation's turn or a subagent died on an API error) and a conversation turn that ended with an answer.
  - The shared wait: a `rate-limit`, `overloaded`, `server`, `offline` or `timeout` makes every background job wait (`waiting(until)`), 30 s doubling to 10 min (15 s first for `offline` and `timeout`), somewhere in the upper half so sessions do not come back together. At `until` the state is `recovering`: the next job that asks is the probe (`probing`), and the others wait for its answer. Any answer, a background job's or the conversation's, ends it at once (`ok`).
  - A deep reviewer is never the probe: it reports only when it ends, minutes later, and every look and lookup would wait that long. A `$.model.complete` that rejects (Claude Code refused to send it) ends a probe as `abandoned` too.
  - The probe cannot leave the others waiting for good. One that was cut short by the tutor itself, never started, or came back with a problem of its own (`job`, `reply`) is `abandoned`: the state goes back to `recovering` and the next job asks (`probeEnded`). Until M4 such a probe left every job waiting until the conversation next answered.
  - A `rate-limit` while the plan says a window is 99% spent waits until that window's `resetsAt`, plus up to 30 s.
  - `account` blocks every job until something is answered again. `job` blocks that job only (`jobBlocks`), until it is asked for by hand and answered, or the mod reloads with other settings. `reply` is the look's own business.
  - The look keeps its own pacing after a failed look on top of that: the minimum gap plus 30 s doubling (`backoffMs`), which is never shorter than the shared wait.
  - Nothing pending is dropped: the watcher keeps the change, and the same diff is sent again.
  - `l`, `r` and `f` always try, and an answer to one ends the wait.
- Plan limits (`Pressure`): `session.measure` pushes them (it fires around conversation turns), and `readPressure` reads them, free, when a save is seen and right before a look. A window whose `resetsAt` has passed is left out: its figure is from before it reopened and no newer one arrives until something is asked.
  - At 80% of the tightest window: the gap is ×4, minimum 4 min.
  - At 95%: no automatic look, lookup or deep review, and no request is spent to find that out. The pane says "Holding back until 13:40". The look goes when the window reopens. Look now and review now still work.
- Every background git command is `git --no-optional-locks …`; a plain `git status` takes the index lock and breaks the user's git. `register.tsx` has one literal `$.process.run` call so readers and the validator see git is the process.
- A look needs all of:
  - the tree still for the quiet time (default 10 s), counted from the scan that saw the save
  - the minimum gap since the last look (default 1 min)
  - a real change (not whitespace-only; not only ignored, binary, generated or lock files)
  - no look in flight
  - Claude answering, the plan not at its limit, and the play-by-play's own model accepted
- A look sends the net change since the last look. Work already uncommitted at switch-on is the baseline, not reviewed.
- `watcher.ts` fingerprints (size, mtime) every changed file at the last poll and at the last look; what differs is pending. It keeps each file's text at the last look as the next diff base. A file never seen dirty diffs against `git show HEAD:path`.
- A file the last look saw changed, and that is clean again with other text than that look saw (`returned`), is still pending: it was changed once more and committed, or put back, between two polls, and git no longer lists it. `poll()` reads such a file once, when it turns clean. Until M7 it was dropped, and a note about code that had been fixed and committed in one breath stayed in the pane (seen live).
- `collect()` returns real changes. `settle()` records what a look saw, using collection-time fingerprints, so a file changed during the model call stays pending.
- A failed look settles nothing. An unparseable reply is settled and dropped, never retried or shown. Files beyond the prompt size limit stay unsettled for the next look. After a reload the watcher restarts from the current tree; notes survive in state.
- The play-by-play is one `$.model.complete`, no tools, no history. It is given the open notes and the dismissed notes for the files shown. `applyReply` drops a note with the same file and topic slug as either. Dismissed notes live in state until switch-off, and on disk (below). Lesson memory counts only notes that reached the pane.
- The prompt says one idea per note, under 40 words (the first live note bundled three).
- Note kinds, in sort order: `bug`, `risk`, `decision`, `idiom`, `tip`, `insight`. `decision` marks a meaningful choice (just made, or ahead in a stub or TODO: the one exception to "no notes on unfinished code"), framed as theirs with its trade-offs. `insight` is an implementation choice or a codebase pattern. Priority, in the prompt only: a bug or a risk before a decision, a decision before anything else, never more than one insight (a cap of one decision was dropped: a live save with two real open choices got both, which was right). The pane draws decisions first under `◆ Your call` (magenta), the problems by file, then insights under `★ Insight` (cyan) (`DECISION_HEADING`, `INSIGHT_HEADING`). `isProblem` is false for both: they never count in the lesson memory (`flagged` or `explained`). `e` on a decision asks the conversation to lay out the options and leave the choice to the user; on an insight, where else it shows up.
- Live (decision points): a TODO for the even-count median got `◆ Your call` with the trade-off (the textbook median versus keeping the input's type) and no choice made, beside a separate `risk` for an unclosed file. An uncommented tie rule in `mode()` was flagged as an open decision, and adding a comment that made it deliberate resolved the note at the next look. `e` on a decision got six options with their costs and the questions that decide between them, then "tell me which way you're leaning". "Which would you pick?" got a question back about what they weighed. No play-by-play `insight` has been seen live yet: the model has preferred decisions.
- `d` dismisses (the same point isn't raised about that file again until switch-off). `m` hushes the topic. `e` asks the conversation for the concept, then an example on request, never a patch. `l` looks now.
- Live: a planted bug got its note 14 s after the save, nothing appeared in the conversation, `e` sent the explain request, and saving the fix cleared the note.
- Live with the kernel (Sonnet, low, through a local proxy that was switched off and on): the pane said "Saw your save. Looking when you pause." a second after a save, and the look started 10.0 s after the save was seen. With the proxy down the look failed with no HTTP status, the pane said "The last look failed (no connection). Next try 18:19", and it was tried again 30, 60 and 120 s later. With the proxy back, the next try was answered and the change that had waited four minutes got its note. Scans were 1 s apart after each save and 2 s apart otherwise.
- Not seen live: a wrong model (the `/config` picker only offers real ones), a refused account, the plan limit by `session.measure`. Tests cover them (`resilience.test.ts`).

### Deep review

- A read-only subagent (`Read`, `Grep`, `Glob`) registered with `$.agent.register({ model, effort, tools })`, not a file in `plugin/agents/`. A spawned subagent skips the mod's own `turn.step` hooks, so registration is the only way to give it the user's effort level.
- Instructions in `prompts/deep-review.md`. Registered at switch-on; `agent.offer` withholds it from the model while off. Re-registered whenever the person text changes, because a spawn can't take parameters.
- Triggers, independent: after each commit (default on), and every N minutes (default off). With both off, only on request (`r`).
- Commit detection: each scan compares `.git/logs/HEAD` size and mtime. Only on change does it run `git reflog -1`.
  - `commit`, `commit (amend)`, `commit (merge)`, `commit (initial)` → review that commit.
  - Any other HEAD move (checkout, pull, reset, rebase) → reset the "since last review" base.
  - No git hooks (they would write into the user's repo).
- A timed review covers `git diff <base>` against the working tree, plus untracked files by name. A scope fingerprint prevents re-reviewing the same uncommitted work; it is skipped when nothing changed.
- `$.agent.spawn` resolves at start, with `agentId`. The answer arrives as a `turn.complete` carrying that id and goes to state, never the conversation. One review at a time. Done → short notice, and the tab is marked new.
- Commits wait in a queue (`reviewqueue.ts`, `projects/<id>/queue.json`). A commit goes in the moment `checkHead` sees it and comes out when its review and the look at the person's progress are both done with. So a commit made while Claude is not answering, at the plan limit, behind a running review, or just before the session closed is still reviewed: when things are back, or the next time the tutor is on in this project.
  - At most `MAX_WAITING` (3) wait, a newer one pushing the oldest out, for at most 24 h. An amend replaces the commit it amended. A waiting commit that `git show` no longer finds is let go. Git that did not answer at all (missing, timed out: `git()` gives exit code -1) is one try, never a commit let go. A look at progress under way when the tutor is switched off leaves its commit waiting.
  - `planReview` starts whatever is next when nothing stands in the way. It is called whenever that may have changed: a commit, the end of a review or of a progress look, `wake` (Claude answering again, the plan's pressure changing), resume, switch-on. The review of the oldest commit without one and the progress look of the oldest commit past its review run side by side, one of each at a time. The deadlines `review` and `assess` are a retry's time or the plan window's `resetsAt`.
  - While something holds a waiting review back, the tab says what and until when (`heldText`): Claude not answering, the plan limit, a refused account, a model the plan does not have.
  - The review slot is `reviewAgentId`, `isReviewBusy` and `endedReview` together (`isReviewFree`). `withReviewSlot` holds it while a review is started or its end is put on record, and calls `planReview` when it lets go with nothing running. Without it two events arriving together start the same review twice: in the first version a review's own answer woke the planner (`noteOutcome` → `wake`) before the queue had been marked, and the commit was reviewed again.
  - A review that ends without a review (`reviewFailed`), for a waiting commit:
    - `service`: `classic.StopFailure` named an API error. It is no try. The commit waits for the shared health, however long, and when that wait ends it is started again. An outage costs a commit none of its tries.
    - `own`: nothing says why (it said nothing, did not start, did not report back, or an `error` nobody explained). One try of `MAX_ATTEMPTS` (3), 60 s doubling apart. Then the review is given up on, the tab says "Press r to run it again", and the commit still goes on to the progress look.
    - `final`: stopped by the person, or refused by the model. Not tried again.
    - A review asked for by hand, a timed one and the look around are not retried: the tab says why it failed.
  - `turn.complete` says only `error`. `classic.StopFailure` says which, at about the same moment, before or after. So an `error` with no reason yet shows "error" and waits `VERDICT_MS` (2 s) for one (`endedReview`, deadline `review-verdict`).
  - A `classic.StopFailure` for any other subagent counts as the conversation's. Otherwise a model that the user's own subagent asked for would block the deep review.
  - Watchdog (deadline `review-watchdog`): 15 min after its start the reviewer is looked up in `$.agent.list()`. Still running, it gets until 45 min. Gone, or at 45 min, that is one failed try and the slot is free. Until M4 a reviewer that died without a `turn.complete` blocked every later review until `/bsd off`.
  - After a reload of the mod, `adoptReview` finds the running reviewer of the first waiting commit in `$.agent.list()` by its description and takes it up again, so that its answer is collected and no second review is paid for. Any other review that was running (timed, by hand, the look around) cannot be collected, and the tab says so.
- The timed review is the deadline `review-timer`, set again after each run. It holds back at the plan limit and while Claude is not answering.
- `r` with a commit waiting reviews that commit, whatever was holding it back.
- The notes block also carries `decisions` (file, line, choice, tradeoff; at most `MAX_DECISIONS` = 3). The review's `decisions` and `insights` go into the `Review` state; the tab draws the decisions before the review text and the insights after it, so the text should not repeat them. `insights` must describe choices and patterns, not defects. With the first wording, a live review's insights were defects. With "an insight is never a problem", a fresh session's were choices (`Counter`'s insertion order giving first-seen ties, `sorted()` leaving the caller's list alone) while the defects went to decisions and the review: one run each.
- A contested point is the one review that lands in chat: the tutor delegates it to the same reviewer and reports the verdict.
- Live: commit noticed within one scan, footer showed a background agent, review in the tab 12 s later. No conversation row, notification or attachment, then or on the next turn. Contested point verdict in chat after 32 s. The 5-min timer with after-commit off reviewed uncommitted work at 5 min.
- Live with the queue (Sonnet at low, through `scripts/outage-proxy.py`): a commit made with the connection down was queued at once, and its reviewer died 185 s later (Claude Code's own eleven tries), `classic.StopFailure` (`server_error`) and `turn.complete` arriving in the same millisecond. The tab said "Claude is not answering (server error). It is tried again at 19:23, or press r.", the commit kept all its tries, and 23 s later, when the wait was over, the review ran again and was in the tab 7 s after that. With the mod saved 2 s into a review and the connection cut, the reload came 20 s later, `adoptReview` found the running reviewer, and its answer was collected once the connection was back: one reviewer for that commit.
- Not seen live: the watchdog (a reviewer that never reports back), a review given up on after three tries, the progress look's retries. Tests cover them (`reviewqueue.test.ts`).

### Layouts

- `settings.layout`: `unified | horizontal | vertical` (`layoutOf`), the `layout` row of `userConfig`. The module variable `layout` holds it; `/bsd layout [name]` (bare: the next one) calls `$.config.set` on the row whose `provider.plugin` is `backseat-driver` before any `@` (a working copy's rows are owned by `backseat-driver@inline`), then shows the new layout at once. The set reloads the mod, and Claude Code prints "options changed — reloaded" in the transcript: not avoidable from the mod.
- `showLayout` opens the pane only for `vertical` (asking for 64 columns when docked) and closes it otherwise. It runs at switch-on, at a reload (`session.start`), on `/bsd` while on, and at switch-off.
- One drawing for all three: `drawTutor` builds the `PaneView` and the actions, and `renderPane` picks `renderStacked` (vertical), `renderStrip` (horizontal: a round frame, the character and "Working on" in a side column beside the tab, `stripColumns`; stacked inside the frame under 44 body columns) or `renderUnified`.
- `horizontal` and `unified` draw in the `AbovePrompt` band (`ui.render` on it; passes with `next(e)` while off, in `vertical`, and while a survey holds the band). A pane would not do: Claude Code docks a pane in fullscreen and puts it inline otherwise, and the mod cannot choose.
- Unified:
  - One row: the voice's mini face, its line (left out under `MIN_SPEECH` columns of room, never squeezed), the tabs with their badges. Under it the open notes one line each (`noteMark`: ◆ decision, ✘ bug, ⚠ risk, ★ insight, · the rest; text dim), at most `previewCount(rows)` (2 under 40 rows, else 3), then "and N more notes". A blank row above it, as Claude Code separates its blocks.
  - A tab's digit opens it under the row (`unfolded`), with a heading carrying `x: fold`; the same digit or `x` folds it. It folds by itself on `prompt.submit` and on pause. `/bsd explain` opens Explain.
  - The play-by-play's state ends Claude Code's hint line under the prompt: a `ui.render` hook on `PromptHint` sets `tail` (`statusEntry`: "backseat watching · ctrl+x tab for keys", or "· esc to leave" while the band has the keys). `$.ui.status` was tried first and rejected: it draws as a warning, "⚠ backseat-driver: …".
  - Switch-on says where the notes are and how to reach them (`BAND_INTRO`), because nothing in the band does.
- Keys above the prompt: Claude Code lets a bare digit typed into an EMPTY prompt press a band button (meant for surveys), so the tab buttons carry their digits only while the band has the keyboard (`hasDigits`, `bandKeys` atom). `bandKeys` comes from `ui.focus` on the band (Ctrl+X Tab raises one with the element). Esc raises nothing, so a digit pressed after it still reaches a tab button: `pressBandTab` first moves the focus ring onto that tab with `$.ui.focus`, which Claude Code refuses when the band does not hold the keyboard, and then puts the digit into the prompt with `$.prompt.fill` instead. The kit cannot answer a plugin's own `$.ui.focus`, so that refusal is checked live only.
- Folded, the preview lines have no keys of their own, so while the band has the keyboard a `j` button ("open the notes") unfolds the play-by-play; `e d m` then act on an open tab and never fall into the prompt. `bandKeys` is also reset on every `/bsd` command and on a reload, since Esc raises no event.
- Open play tab polish: a problem's row carries its `noteMark` glyph; muting is undone with an "unmute" button (not `x`, which folds) beside "Muted: …"; dismissing moves the selection to the next note drawn; `f` ("look this up") toasts "Looking this file up…" so a file that maps to nothing doesn't look like a dead key.
- The focus ring landing on a note (`note-<id>`) selects it, so `e d m` act on the note the person is on. `j`/`k` step through the notes; all layouts draw them in one order (`drawnOrder`: decisions, problems, insights) and the keys start on the first one drawn.
- Live (2026-10-05, a stand-in model on a local port, 80 to 170 columns, main screen and fullscreen): all three layouts drawn and switched by `/bsd layout` in both directions; `vertical` docked at 64 columns in fullscreen; a digit after Esc landed in the prompt (`❯ 3`); at 80 columns the band kept its face on one row and dropped the line.

### Pane

- `pane.tsx` draws from plain data (`PaneView`), and `register.tsx`'s `ui.render` hook reads every atom it needs in one round (`Promise.all`), not one after another for each frame.
- Tabs say what is behind them (`tabBadge`): `Play-by-play (3)` for open notes, `Deep review (new)` until it is opened, `(…)` while a review runs, Explain is looking something up or Progress is assessing, `(!)` for a review that did not finish. `tabRow` keeps the badges for as long as the row fits: full names, then short names with a gap of 2, then 1, then only the review's badge, which is the one that asks for a look.
- The Deep review tab always has something to read. A review that finished stays, as `Review.last`, while a newer one runs, waits or has failed (`withReviewChange`, which every write of the review state goes through; `readableReview` is what the tab and the conversation's context use). Above it: "Reviewing commit a1b2c3d: Title since 12:01." or why it did not finish, and how many more commits wait (`Review.waiting`, set by `changeQueue`).
- The row under the status line (`Watch.health`, from `healthLine` in `status.ts`) says what keeps going wrong in the background and is otherwise absent: Claude not answering and until when, a refused account, the plan limit, a scan of the working tree that took over 1.5 s, and anything `fail()` reported twice within five minutes ("Keeps failing: … /bsd debug dump saves the details."). It leaves out what the status line already says, which is the case whenever a look is the thing held back. Until M7 those errors went to `claude --debug` only.
- After a restart (or `/bsd off` and on), the pane comes back from the project's folder (`restorePaneFromDisk`, in `engage`, driver only): the open notes whose file still reads as the look that raised them saw it (`notes.json`, `stillOpen`), the dismissed notes, and the last review in `reviews.json` with its decisions and insights. A note about text changed since is never shown: the next look at that file says what is true. The driver writes `notes.json` after every look, dismissal and hush.
- Under the health row, `Watch.editors` names the connected editors with something of this project open (`editorsLine`), from `readFocus`. `showPlay` keeps it when it rewrites the watch atom. Hidden while paused.
- Settings tab (5, `settings`): the plugin's own rows of `/config`, read with `$.config.list()` (`showSettings`: when the pane opens, when the tab is opened, after `/clear`) and kept to rows whose `provider.plugin`, before any `@`, is `$.plugin.name` (`settingRows`: the owner is the plugin's id, `backseat-driver@inline` for a working copy, so comparing the whole name left the tab empty in every real session until 2026-10-05). Each row is a `Select`: a choice's options, a toggle as `on`/`off`. A pick goes through `$.config.set` (`changeSetting`), exactly as a change in `/config`, which reloads the mod with the new options; the row shows the pick at once and goes back with a toast if refused. A locked row is text. A surface without `Select` shows the values as text and says to use `/config`.
- Settings, and when a change counts (owner, 2026-10-05: "a lot of configure options do not apply until I restart"; audited the same day in a real session, 2.1.289):
  - A change in `/config`, in the Settings tab, or straight in `settings.json` makes Claude Code load the mod again with the new options ("options changed — reloaded (14 hooks: …)" in the transcript, which the mod cannot quiet). `register` runs with them, module variables start empty, `$.state` stays, and `session.start` fires, which re-engages a tutor that was on (`engage`, `isFresh` false). Every setting is read afresh there. Seen live, each in effect at the reload with no restart: quiet time (the next look 30.0 s after the save), play-by-play on request, Explain off and on, animated persona off, voice and engineering (the character and the prompts), the deep review's model and effort (the reviewer re-registered), deep review after commit, deep review every (its timer armed from the reload), progress report, check for updates, layout.
  - `SETTING_EFFECTS` (`settings.ts`) says, for every `userConfig` field, from when a change counts: `now`, or `next look | next review | next lookup` for a model or thinking level (a request already under way finishes as it began). A field missing from it is reported at every load (`unclassified`), and `settings.test.ts` fails. Add the field there when adding it to plugin.json.
  - `$.state` key `applied` keeps the options the module was last loaded with (`noteSettings` in `session.start`; written again after `/clear`, which empties the state). A reload with other options, while on, says one line in the transcript naming each change with its /config label and when it counts ("Voice persona: knuth, in effect now. Deep review model: sonnet, from the next review."). Off, nothing is said: nothing runs for it to apply to, and `/bsd` reads them anyway. A reload for a change of code says nothing.
  - What waited for a restart before 2026-10-05: work that runs only at a fresh switch-on. `catchUp` starts it at a reload that switches it on: the release check (`update_check` on), the first placement of a level (`progress_report` on), the look around a new project (a deep review trigger on where both were off). The questions and the license question stay at switch-on.
  - When no reload follows: Claude Code itself says so in `/config` ("saved, but the plugin did not reload; /reload-plugins applies it", or "saved; /reload-plugins applies it" when the loaded copy's id differs from the one being set, as after an update). For a pick in the Settings tab the mod tells it: `changeSetting` arms `RELOAD_WAIT_MS` (5 s) after a `$.config.set` that was not refused, and a reload cancels every timer of the module, so the timer fires only when no reload came, with `notReloadedText` ("… is saved, but Claude Code did not load Backseat Driver again, so it is not in effect yet. /reload-plugins applies it."). Live, the reload came 100 to 300 ms after the change.
  - What a reload costs, whatever the setting: a save the play-by-play had not looked at yet is the baseline afterwards and is not looked at until the next save (the watcher starts from the tree as it is); Explain's queue and a look in flight are dropped; the timed deep review counts its interval again from the reload. A deep review running is adopted (`adoptReview`).
  - `Select`'s `label` is drawn with ": " after it in the terminal, so the tab passes the bare label.
- New fields in `$.state` are optional (`Watch.health`, `Watch.editors`, `Review.since`, `Review.waiting`, `Review.last`): after an update the state still holds what the older version wrote.
- Live (2026-10-04): "1: Play (2)  2: Review (new)  3: Explain  4: Progress" after a save with two notes, "Review (…)" while a commit was reviewed. During the second commit's review the tab read "Reviewing commit 5554aa7: Sort a copy since 20:17." then "The review before it:" and the first review. After `/clear` the two notes and the review were still in the pane, on the tab that had been open. With `play_by_play` on request and no connection: "On. Looking only when you ask." and under it "There is no connection to Claude. Background work waits until 20:25.", gone once a lookup was answered. A fix saved and committed within one scan took its note out of the pane at the next look, and left the note that was still true.
- Not seen live: the git-is-slow and keeps-failing parts of the row, the `(!)` badge. Tests cover them (`kernel.test.ts`, `pane.test.ts`).

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
  - the caret of the editor that speaks for this project (`editors.ts`)
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
- Nothing pumps the queue on a timer. `readyAt(job)` is when time lets a job start, `pump` starts what may start and then calls `wakeAt` with the first moment a waiting job becomes ready by time alone (the deadline `explain`), and `wake()` is what the deadline and `wake` in `register.tsx` call. So a saved file is mapped 2.5 s after the scan that saw the save, not at the first scan after that.
- While Claude is not answering, or the plan is at its limit (`pressure()` is `held`), only what was asked for by name starts: a request made into an outage fails and lengthens everyone's wait. A lookup that failed while held is not marked failed. It goes back in the queue as something looked at, and runs when `wake` says Claude is back, without the minute's wait.
- `changed()` resolves when the next lookup ends. The `lookup` tool and `/bsd explain` wait on it (`lookUp`, `soonest`), up to `LOOKUP_WAIT_MS` (6 s) in all, and answer the moment what they asked about lands. Before M5 they slept half a second at a time.
- Setting `explain`: `automatic | on request | off`. Near limits, `automatic` degrades to on-request (saves first, then everything).
- `register.tsx`: `startExplaining` (in `engage`) builds the ports. `refreshView` builds the focused view into state and writes `view.json`. While the tab is open or an editor is live, `fastPoll` stats the focused file and lists the editors' folder every 100 ms and refreshes on change, which is why stale text leaves the screen within about 0.1 s. It stops when nobody watches (see the fast lane under "Play-by-play and watcher"). `readFocus` is the only reader of the editors' files: one `$.fs.list`, a read of each file whose size or time changed, then `focusText` is what the speaking editor says without its times (so a beat is not a move). It also writes the pane's editors row. A source that pushes editor events calls it. `pollFocus` feeds the journal, then Explain (`followEditor`).
- Live: first explanation in an unseen file in 6.6 s; cached `n`/`p` in 40–80 ms; edit removed the explanation in about 60 ms, new one after 9 s; a script's `focus.json` → `view.json` in 40–80 ms; the tutor called `lookup` with no permission prompt when it hadn't already read the file.
- Live on deadlines (2026-10-04): the mapping request left 2.52 s after the scan that saw the save; an edit to the function in focus rewrote `view.json` 50 ms after the save, without the old explanation; a caret written to `focus.json` was followed in 68 and 108 ms. The `lookup` tool's wait on `changed()` has been seen in tests only.

### Editor protocol

The plugins are in `editors/` (dev side of the repository, not shipped with the mod): `neovim/` (`plugin/backseat-driver.lua` starts `lua/backseat-driver/init.lua`), `emacs/backseat-driver.el` (`backseat-driver-mode`), `vscode/` (`package.json`, `extension.js`, plain JavaScript, no build; `npx @vscode/vsce package --skip-license` makes the `.vsix`). Install lines are in README. `editors.ts` is the mod's side.

Each running editor keeps one file, `editors/<editor>-<pid>.json` in the data folder, written whole (temp file `.<name>.tmp`, then rename) when what it says changes (debounced 150 ms), and every `EDITOR_BEAT_MS` (20 s) while nothing does:

```json
{ "v": 1, "editor": "neovim", "pid": 4242, "at": 1759653120000, "changed": 1759653118000,
  "root": "/abs/repo", "file": "/abs/repo/src/stats.py", "line": 12, "column": 5, "endLine": 15,
  "modified": true, "buffers": ["/abs/..."], "visible": ["/abs/..."], "active": true }
```

- `at` is when written, `changed` when what it says last changed (ms since 1970). `root` is the nearest folder above the caret's file with a `.git`. Paths are real paths (symlinks resolved), because the tutor's root comes from git.
- `line` and `column` are 1-based, the column in characters. `endLine` only while more than one line is selected (then `line` is the selection's first). `modified` = unsaved changes in the caret's buffer, `buffers` = open files, `visible` = other files on screen, `active: false` = the editor window lacks the keyboard. Explain reads `file` and `line`; the journal reads the rest. `column` is sent for later use.
- When the current buffer is not a file (a terminal, help), the last file's report stands and keeps beating.
- An editor writes nothing until the data folder has its marker (`.backseat-driver`), makes `editors/` when missing, removes its own file on exit, and at start removes files in `editors/` untouched for a day (editors that crashed).
- The tutor: an editor whose `at` is more than `EDITOR_TTL_MS` (60 s) old is closed. The speaker for a project is the connected editor whose caret is in it (`root` equal to the repository, or, without `root`, the file inside it) with the latest `changed`. The pane's row under the status line names the connected editors with anything of this project open ("Neovim is connected.").
- The editor never reports durations; the tutor credits time per report (`attention.ts`), and a beat that changes nothing is not a report.
- Before 2026-10-05 the protocol was one shared `focus.json`, which two editors would have overwritten. It is no longer read; `focus.json` stays in `REMOVABLE` so an old one can be forgotten.

The tutor writes `view.json` in answer and whenever its knowledge of the spot changes: `{ v: 1, at, root, source, spot: {path, line}, status, fileSummary, outline: [{name, kind, startLine, endLine, summary}], isOutlineCurrent, isMappable, target, detail: {what, how, why, watch, uses} }`.

- `status`: `fresh | updating | waiting | held | failed | no-file | off`.
- Everything is already checked against disk, so an editor shows it as is.
- `target` is null between symbols; `detail` is null until it arrives.

### Project cache

- `projects/<name>-<hash>/`: `project.json` (overview, file roles, insights), `reviews.json` (the last 12 reviews: text, decisions, insights), `notes.json` (the open and dismissed notes, with each noted file's fingerprint), `files/<hash>-<name>.json` (Explain), `journal.json`.
- A commit review's insight is kept only for a file that still reads as the commit left it (`isAsCommitted`): a review that waited in the queue would otherwise tie it to code edited since.
- Each deep review ends with a fenced `backseat-notes` JSON block (asked for in `deep-review.md`). `splitReview` strips it before the pane, parsed or not. `keepReview` re-reads `project.json`, merges (`withReviewNotes`), and appends to `reviews.json`.
- Each insight is kept with the fingerprint of its symbol (when mapped) or of its file, and which one it is; one that can't be fingerprinted isn't kept. `insightsFor` (Explain) and `currentInsights` (play-by-play) pass it only while the fingerprint matches. For the play-by-play the file just changed, so file-level insights drop and symbol-level ones survive for unedited symbols.
- The overview is project-wide and unfingerprintable. It carries its commit, and the reviewer is told to correct it.
- Survey: `ReviewScope` kind `survey`, run by `maybeSurvey` once per project (`isSurveyed`), from `engage` on a fresh switch-on. Not run when both deep review triggers are off or usage is ≥80%. Its text goes to the tab, not `reviews.json`.
- `reviewRequest(scope, { overview, earlier })` adds the overview and `reviewDigest` of the last 3 reviews.
- Live: survey in the tab about 10 s after switch-on, with the overview and roles in `project.json`; a commit review gave 3 insights and no visible notes block; an insight showed beside a function in Explain and vanished 200 ms after an edit.

### Journal

- `projects/<id>/journal.json`; engine `recorder.ts` (disk and repo as ports). `register.tsx` starts it in `engage` (`startJournal`), feeds it each scan (`keepJournal`) and from `pollFocus`, and drops it at switch-off. It holds paths, line numbers, definition names, commit titles and user statements, never code.
- Saves: each scan's changed files are diffed against the last save's text, else HEAD for clean files, else switch-on text for files already dirty (so pre-existing work isn't a save).
  - A `save` entry holds added and removed counts, merged line runs and touched definitions (`enclosing.ts`).
  - Saves of one file under 2 min apart form one run, until a commit or HEAD move.
  - Other entries: commits, HEAD moves, notes raised, notes fixed, dismissals, deep reviews, switch-on, working-on statements.
  - The last 3 files' diffs stay in memory for the `activity` tool.
- Attention: `attention.ts` adds time up from timestamps, not from how often it is looked at. Each report from the editor closes the stretch before it: the time since the last credit goes to the line the caret was on and to the `visible` files, for as long as the editor wrote within `LINGER_MS` (2 min) and isn't `active: false`. `tick(now)` brings the sum up to now. A hundred looks and one give the same sum.
  - A stretch of more than `MAX_GAP_MS` (60 s) in which nothing here looked at the clock is not credited: the laptop slept, or the tutor was paused. A scan is never further apart than that.
  - Every `SLICE_MS` (2 min) → `focus` entries: up to 3 regions per file plus the remainder. A region is lines within 20 of each other inside one definition, named for the line held longest. Visible files get `screen` entries.
  - The definition name is resolved at the next scan, so one read per caret position.
  - What an editor said before switch-on is a baseline and earns no time until it changes.
- Sittings: an hour idle ends one. On every read or write, finished sittings roll up (`digest`: files, commit titles, statements); only the open sitting keeps entries. Keep the last 20. A sitting with no save, no commit and under 1 min of editor time leaves nothing.
- Writes: at most every 30 s when something is new; at once on a working-on statement; at switch-off; and when the session ends (`session.end`).
  - The recorder says when it next has something to do (`wakeAt`: a write that is due, or a slice of attention long enough to keep), and `journalDue` runs then, on the deadline `journal`. A scan no longer asks "is a write due?": it only records what was saved and names where the caret is.
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
- Live on deadlines (2026-10-04): the first write came 30.0 s after switch-on with a save waiting, between two scans. A session closed with `/exit` five seconds after a save had its journal on disk afterwards with the save and the two open stretches of caret time (6.3 s and 4.7 s).
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
- Weight 1 if the watcher saw at least half the commit's files change before it was made (`watchedPaths`, filled by `scan`, emptied once a commit's assessment is settled, so that another try weighs it the same), else 0.5. First-placement commits are always 0.5.
- When:
  - `assessCommit` runs from the review queue (`startAssessment`): after the commit's deep review (with its text), after that review was given up on (without), or straight away when after-commit reviews are off. It is held back like a review, by the plan limit and by Claude not answering, and waits instead of being dropped. A request that got no answer is no try when that was Claude's doing, and otherwise one of three, 60 s doubling apart. `assess` and `assessCommit` resolve false for "worth another try". A commit reviewed by hand that was not waiting is assessed directly from `turn.complete`.
  - `placeFirst` runs on a fresh switch-on for the first 2 languages in play without a level: up to 5 of the user's commits among the last 30, in one request.
  - `progressQueue` runs one at a time, each re-reading before writing. Full hashes go in `assessed`, so no commit counts twice anywhere.
- Observations are keyed by full hash (the kit's short hashes are all `0000000`).
- `aboutPerson()` adds `progressText` to every prompt. The `progress` tool answers "how am I doing?". The reviewer is re-registered after each assessment.
- The tab's id is still `profile` (`tab-profile`, hotkey 4), labelled Progress; other tests press it.
- Setting `progress_report` turns it off. Stored in `progress/<language>.json`.
- Live: in a repo of polished commits by a "Famous Maintainer" plus one 4-line function of the user's, only the user's commit was read ("no level yet: 4 of 5 observations, from 1 of 2 commits"); a watched second commit placed junior (provisional); a `Co-Authored-By: Claude` commit was ruled out; the `progress` tool answered with no permission prompt.

### Animated persona

- `avatar.ts` holds the characters and rules; `register.tsx` moves them. It stands at the top of the Play-by-play and Deep review tabs.
- Drawn in tiers (owner, 2026-10-05: the ASCII "didn't look like the real people; 80s video games were more believable"):
  - Pixels: on the terminal, a `Raster` of truecolor half blocks (`▀`, top pixel as color, bottom as background; `▄` or a space where a pixel is see-through, over the terminal's own background). Humans are 20×22 pixels (20 columns × 11 rows), Tux 20×20, the mascot 16×10. Each human has its own head shape and a signature expression (Linus broad with a deadpan, heavy-lidded look and a raised brow; Knuth long and narrow with a gentle smile; Prime square with wide eyes and a grin under the horseshoe), because cold reads by a second agent showed that props alone (glasses, a mustache) did not make them recognizable. The art is a file per voice in `hooks/art/`, made to be replaced: a palette of letters and rows of pixels, with the other poses giving only the rows that differ. `rasterCells` works out each pose's cells once.
  - ASCII (`frames`): where the kit has no `Raster`. Today every non-terminal surface is compact, so this is the floor for a future layout, not something drawn now.
  - One line (`mini`): above the prompt and off the terminal, as before.
  - Images (`Image`, kitty and Ghostty) were left out: pixel art at cell size looks the same as half blocks there, elsewhere (tmux included) an `Image` draws its `alt` as dim words, and nothing tells the mod beforehand which it will be.
  - The renderer is trusted to bring 24-bit colors down on a 256-color terminal (inferred, not seen).
- Dim at rest: a Raster has no `dimColor`, so `dimmed` greys each color and takes it toward the background. That needs the background: `themeBackdrop` reads the `theme` row of `$.config.list()` on each render while the character is shown (a theme with `light` in its name is light; anything else, `auto` included, dark).
- `characterArt(kit, avatar, pose, isResting, backdrop)` is the one call a layout makes; `artShape` says how big it is and which row the bubble's tail meets.
- The art was drawn and then reviewed by an art-director agent working from PNG renders (`npm run persona`): likeness first (one or two exaggerated features per person, silhouettes that differ), then readability on dark and light terminals. Conventions it set: rest eyes look forward, a blink is a dark line, talk opens the same mouth with its corners kept, think raises the brows and turns the eyes up, dark characters get a slate rim on the edges facing the light.
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
  - Pixel art: an even number of rows, every row as wide, every letter in its palette (an unknown letter would draw as a hole), every pose different from rest, the `mouth` row inside the picture.
  - Each character names its `mouth` row, and `bubbleColumn` pads above so the bubble's tail meets the mouth. The pixel art's row is `art.mouth`, passed to `bubbleColumn`.
  - ASCII characters use the ASCII bubble (`bubbleStyle`); Claude's mascot uses box lines.
- Tests find the drawing as `{ type: 'Raster', key: 'persona' }` and compare its `cells` with `rasterCells` for the pose they expect. The kit has no theme, so a test session is dark.
- Live: all ASCII characters seen saying hello with mouth movement, blinking, sleeping when paused, and with the tail at the mouth. One-line mode at 100 columns. The pixel art was drawn in a real session on 2026-10-05 (`default`, `torvalds` and `knuth` in tmux, while auditing the settings); its colors and likeness on a real terminal are still the owner's to judge.

### License

- `license.json` (data folder, about the person): `use` (`personal | commercial | null`), `isAsked`, `key`, `keySince`, `answer` (`active | revoked | unknown | null`), `answeredAt`, `triedAt`. Forgetting everything removes it, and the question comes back.
- Asked once ever, at a fresh switch-on, after the language questions (`startLicense` in `engage`, `askLicense`): personal or commercial; commercial then asks for the key, with "add it later" as the one option and the key typed as free text. A key typed into the first question counts as commercial. Dismissing either is an answer: `isAsked` is set and nothing is asked again unprompted. Kit tests that count questions seed `LICENSE_ANSWERED`.
- Kept in the data folder, not `userConfig`: it outlives a reinstall and another install method, and changing it does not reload the mod. `/bsd license [personal | commercial | <key> | clear]` changes it, works while off, and answers with where they stand.
- A key is `BSD1.<payload>.<signature>`: payload JSON in base64url (`v, kid, id, to, seats, iat, exp`), ECDSA P-256 SHA-256 over the payload's base64url text, r‖s. `checkKey` says `malformed`, `forged` (signature fails, or an unknown `kid`), `unverified` (no public key or no SHA-256) or `valid`. `PUBLIC_KEYS` is empty until the owner runs `keygen`.
- The standing (`Kernel.License`): `unchosen`, `personal`, `licensed`, `needs-key`, `bad-key`, `expired`, `withdrawn`, and `unchecked` (a fine key, a server, and no answer for 30 days since the last answer or the paste). A server's `unknown` counts as no news. `licenseLine` gives the pane one dim line under the update notice for the commercial problems only (`license` state key; recomputed after `/clear`).
- The server is asked (`checkLicense`) at a fresh switch-on and when a key is pasted, when `nextLicenseCheck` says it is due: at once for a new key, 7 days after an answer, 1 day after a try with none. `GET <server>/v1/keys/<id>`; a 404 is `unknown`, anything unreadable is no answer.
- `license-server/` (dev tooling, Node 22.18+ running TypeScript directly, `"type": "module"`): `keys.ts` makes signing keys and signs, `store.ts` keeps issued licenses (memory, or one JSON file written by rename), `server.ts` answers `GET /v1/keys/<id>`, `GET /v1/public-keys`, and for the owner's bearer token `POST /v1/licenses`, `POST /v1/licenses/<id>/revoke|restore`, `GET /v1/licenses` (closed without a token). `cli.ts`: `keygen`, `issue`, `revoke`, `serve`. No payment, no deployment, no secrets in the repository (`.gitignore` covers `license-server/*.pem` and `licenses.json`). Its tests check every key it signs with the plugin's own `checkKey`.

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

### Several sessions

- One session drives a project (`lease.ts`, `projects/<id>/lease.json`: `{ session, at }`). The driver looks at saves, reviews commits, assesses progress, keeps the journal and writes `view.json`. It renews the lease every `LEASE_BEAT_MS` (20 s). A lease not renewed for `LEASE_TTL_MS` (60 s) is free.
  - `keepLease` runs in `engage` right after `startWatching` (the repository has to be known), on the deadline `lease`, and after `/clear`. It reads the file first: a session that is waiting changes nothing while the lease is held, and so takes no lock. A claim or a renewal goes through `updateJson`, under the store's lock, so of two sessions that try for a free lease together one gets it.
  - `isDriver` gates everything only the driver does: `planScan` and `scan`, `look`, `planReview`, `reviewSince`, `maybeSurvey`, `planTimedReview`, `placeFirst`, `startJournal`, the `view.json` write, and Explain's `mode` port (which reads `on request`). It is true where there is no lease to hold: outside a repository, or with no data folder.
  - A session that does not drive is for the conversation: the contract, the tools, the lookup on request, the contested point. Its status line says "Another session is driving this project. This one is for the conversation." (`Play` state `following`). `l` and `r` answer with a toast. It does not scan at all: one read of `lease.json` every 20 s is everything it does in the background.
  - Takeover (`startDriving`): a waiting session looks again a beat from now, or the moment the lease runs out when that is sooner (plus up to `LEASE_SLACK_MS`), so a lease given back is taken within 20 s and a killed driver's within 60 s of its last renewal. The tree as it stands is the baseline, as at switch-on.
  - Giving way (`stopDriving`): a driver that finds the lease is another's (it was suspended for more than a minute and someone took over) stops scanning and reviewing and writes its journal out.
  - The lease is given back at switch-off and at `session.end`, except for `clear` and `resume`, after which the process carries on.
  - `/clear` gives the session another id (`session.end` says so, and no `session.start` fires). `leaseHolder` is the id the lease is held under, and `claimed(lease, me, now, also)` treats that id as this session, so the session goes on driving under its new id instead of waiting a minute for itself.
- What is on record about the person (profiles, progress) is shared by every session in every project. `refreshShared` lists the two folders (`sharedFolders`: one `$.fs.list` each, about 3 ms), and when names, sizes or times differ from the last look it reads the profiles and records in play again, takes open notes about a topic hushed elsewhere out of the pane, and registers the reviewer again. It runs before every prompt (`prompt.submit`) and, in the driver, from the scan at most every `SHARED_CHECK_MS` (5 s). This session's own writes change the listing too: the read that follows finds nothing new.
- `view.json` has one writer: the session that drives the project the editor's caret is in. `refreshView` writes it only when `isDriver` and an editor's caret is in this repository, or no editor is connected at all. Before M6 two sessions in two projects overwrote each other's.
- Not yet: a session that does not drive does not show the driver's notes or reviews (the owner approved "chat only" with the plan). Two sessions in one project both ask the first-run questions if both are switched on before either is answered.
- Live (2026-10-04, three real sessions sharing one data folder, Sonnet at low): with two sessions in one project the second said "Another session is driving this project", made no `git status` call at all, and a commit got one reviewer, from the first. The first was killed with `kill -9`: the second held the lease 61 s after the first's last renewal (47 s after the kill), its status line went back to normal, and the next commit was reviewed by it. A third session in another project was told in chat never to bring up missing type hints in Python: the tutor called `hush`, and the session in the first project read the profile again within its next look at the shared files and registered its reviewer with "Do not bring up: missing type hints in Python".
- Not seen live: a driver giving way after a sleep, `/clear` while driving, an open note leaving the pane for a hush made elsewhere. Tests cover them (`lease.test.ts`).

### Data folder

`$BACKSEAT_DRIVER_HOME`, else `$XDG_DATA_HOME/backseat-driver`, else `~/.local/share/backseat-driver`. `datahome.ts` builds every path.

```text
.backseat-driver              marker; required before any delete
profiles/<language>.json      answers, hushes, lesson memory
progress/<language>.json      evidence, level, report
projects/<name>-<hash>/       journal.json, project.json, reviews.json, notes.json, queue.json, lease.json, files/
editors/<editor>-<pid>.json   one per running editor (see "Editor protocol")
view.json                     written by the tutor
update.json                   last release check
license.json                  personal or commercial, the key, what the server last said
debug.json                    the debug log's switch: {"on": true}
debug/<session>/              one session's debug log (see "Debug log")
locks.git/                    bare git repository; its refs are the locks on the files above
<file>.bak, <file>.broken     beside a profile or progress file: as it was before the last change; a copy that would not parse
```

- Not `$.store`: it's capped at 4 MiB total, separate per install method, and cleared after `cleanupPeriodDays`. Editor plugins also need a findable path. `moveOutOfStore` migrates old `subject/<x>` keys at switch-on; a file wins over a key.
- Not SQLite: the module can't load it, and the `sqlite3` binary is often missing (the owner's machine included).
- Raw I/O is `Disk` (`storage.ts`), four closures built by `diskOf($)` from `$.fs` and `$.process`. Nothing reads or changes a JSON file of the data folder through it directly: that goes through the store, `storeOf($)`, one per load of the mod. Engines take `store: Pick<Store, 'read' | 'update'>` as a port; tests hand them `plainStore(memoryDisk())`.
- Several sessions at once (owner: "a seatbelt and suspenders"). `$.fs.write` empties a file and then fills it (probed), so another session can read it empty, and two read-change-write cycles can undo each other. `store.ts`:
  - Read: a file that is empty or does not parse is read again after `READ_RETRY_MS` (25 ms), `READ_TRIES` (3) times. Still broken, it is copied to `<file>.broken` and `<file>.bak` is used when there is one. It is never taken for "nothing there": that reset a profile to empty on the next write.
  - Change: `store.update(path, apply)` and the typed `updateJson(store, path, parse, apply, { keepBackup })`. One change at a time per file in this session (a queue), under a lock that holds across sessions, then the write is read back. If the read-back differs, another session wrote at the same moment and the change is made again on top of its write, up to `WRITE_TRIES` (4). `apply` can run more than once, so it must be pure. No write when nothing changed.
  - `keepBackup` writes the file as it was to `<file>.bak` first: profiles and progress, which nothing can work out again.
  - Without the lock (it was held for 2 s, or git is unusable) the change is still made, with one more check that the file did not change between the read and the write.
- The lock (`locks.ts`): `$.fs` cannot create a file only if it is absent, git can. A lock is the ref `refs/locks/<hash of the path>-<file name>` in `locks.git`, made with `git update-ref <ref> <mark> <zeros>` (create only if absent) and removed with `update-ref -d <ref> <mark>` (only its holder can). The mark is the id of a blob holding the session's id, so a lock found with this session's own mark was left before a reload and is taken at once.
  - Waiting: retries from 15 ms doubling to 250 ms with jitter, `LOCK_WAIT_MS` (2 s) in all. A hook's own time includes `$.clock.sleep`, so a tool call can spend 2 of its 10 seconds here.
  - A lock older than `LOCK_TTL_MS` (30 s; a write holds one for about 15 ms) belonged to a session that died, and is taken over with `update-ref <ref> <mine> <holder>`, so of two takers one wins.
  - A lock given back between a refused try and the look at its holder is tried for again at once (live, this was first misread as a broken repository, and three of 300 changes went without their lock).
  - A ref file git cannot read (empty, rubbish) can be neither taken over nor deleted through git. Once old, it is written afresh with `$.fs.write`.
  - A repository that has gone (forgetting everything deletes it) is made again.
- Every data-folder write is preceded by `markHome($)`: the store's disk and the lock both call it.
- Live, two real sessions making 150 changes each to one file at the same moment: with the lock 300 of 300 landed, twice, at about 30 ms a change; with only the checks before and after, 292 and 294. In a tutor session every profile and journal write showed as take, write, give in the debug log, the profile got its `.bak`, and a lock a minute old was taken over.
- `/bsd forget <language>` also deletes the `.bak` and `.broken` beside that language's files, and forgetting everything deletes `locks.git`.
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
  - `git`: argv, exit code, output, named by its verb (`status`, `update-ref`)
  - `store`: what the store noticed (a broken file, a restore, a change without its lock, another session's write)
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

- Dormant until switched on. While off, every hook passes through with `next(e)`: no pane, model call, prompt change or denial. No reads or writes at session start. Only `/bsd forget`, `/bsd help`, `/bsd debug`, `/bsd license` (and update or uninstall when asked) act while off. The debug log itself is written only while the tutor is on.
- Background reviews never become conversation turns. Only what the user does in chat or the pane does. Verified live for `$.model.complete` and `$.agent.spawn`.
- Model and effort per job come from `userConfig`; no model id is pinned (aliases only). Defaults: play-by-play `sonnet`/`medium`, deep review `opus`/`high`, Explain `sonnet`/`low`. "Thinking level" = Claude Code effort (`low|medium|high|xhigh|max`).
- Hard rules are hooks; teaching style is the contract. The edit guard covers only `Edit`, `Write` and `NotebookEdit`; a shell command could still write, which rests on the contract and Claude Code's permission prompts.
- Footprint (the paragraph closing the README's "What it is" states it to users):
  - Runs `git`, reads the repo and its own plugin folder, calls models, writes only its data folder, draws a pane. One of the git repositories it runs git in is its own: `locks.git` in the data folder.
  - Changes Claude Code's own settings only when the person picks a value in the Settings tab, through `$.config.set`, as `/config` would.
  - Other processes only on request: `rm` inside the data folder (forget, `/bsd debug clear`), `claude plugin` (update, uninstall). The one exception, approved by the owner: `inotifywait`, while on, when it is on PATH (`$.process.spawn`; "Pushed changes").
  - The debug log, when the user switches it on, holds their code and prompts. It stays in the data folder.
  - Network of its own: the release check (`git ls-remote`, at most every 6 h, opt-out), `/bsd update`'s fetch, and the license check (`$.http.fetch`, only with a commercial key and a `LICENSE_SERVER`, about weekly, only the key's id, off with `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`). `LICENSE_SERVER` is '' until the owner deploys one, so it sends nothing yet.
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
- `userConfig` `options` pickers work on string fields only. A stored value outside the options reads as the default, with a warning (in tests too). A `/config` change reloads the mod with new options, and the tutor stays on (see "Settings" under "Pane"). A `/config` row of a plugin's field is keyed `<name>.<field>` and owned (`provider.plugin`) by the plugin's id, `<name>@<marketplace>` (`@inline` for `--plugin-dir`). For the working copy, values go to `~/.claude/settings.json` `pluginConfigs["backseat-driver@inline"]`: restore the owner's settings after a check.
- `$.ui.ask`: one question, 2–4 options plus free text. It rejects on dismiss (first-run treats that as skip all) and under `claude -p`. In tests it reaches the `tool.call` stub as `AskUserQuestion`.
- `/config` and a mod: `$.config.list()` returns every row (`key` `<plugin>.<field>` for a `userConfig` field, `kind`, `value`, `options`, `provider`, `isLocked`), and `$.config.set({ key, value })` changes one as the menu would, resolving `{ value }` or `{ deny }`. A mod cannot add a row, a button or a shortcut to the menu: `config.describe` only relabels, re-describes or hides an existing row. `Select` is missing from one surface's element table (`Kit` takes it as optional).
- `$.store`: 4 MiB total, per install, expires (unused now). `get`, `set`, `delete`, `keys`.
- `$.fs`: `read` (≤4 MiB), `write` (makes folders), `list`, `exists`, `stat`, `ancestors`. No delete or rename. `list`/`read` reject on missing. Absolute paths outside the project work without a prompt.
- `$.env.get` takes a string literal; the validator lists the names.
- A hook gets 10 s of its own time per dispatch. Time inside `$` calls doesn't count, except `$.clock.sleep` and awaited plain promises. So the `lookup` tool waits ≤6 s, then answers with what it has.
- A mod's `$` calls go through other plugins' hooks, never its own. `$.prompt.submit` bypasses its own `prompt.submit` hook, so put needed context in the text or a tool.
- `$.clock.after` is one-shot; `$.clock.every` repeats. Both return a `Timer` with `cancel()`. A reload cancels all.
- Hooks for events raised together run interleaved: the first to await lets the next one start. `classic.StopFailure` and `turn.complete` for a subagent that died arrive that way, so what one hook's awaited work establishes is not yet true in the other. Hand the other the promise (`reviewFailureNoted`), or set what it needs before the first await. Seen live: the review's end ran while the failure was still being counted, found Claude still looking well, and took an outage for a failure nobody could explain.
- `dimColor` plus `color` on `Text` renders theme gray (it replaces the color). `color` takes a theme key (`claude` = orange) or a terminal color.
- State-driven redraws and `$.ui.invalidate` are capped at 30/s in the terminal. The persona ticks about 7/s while talking, zero at rest.
- `e.props.isFocused` in the pane's `ui.render` says whether it has the keyboard; hotkeys are dead until then, and the pane says how to focus.
- `Text` takes no `key`. Keys go on `Button`, `Input`, `Select`, `Markdown`. Find text via `ui.find({ type: 'Text', text })`; an undefined result after a clean mount usually means this.

### Probed live (2.1.289, 2026-10-04, a scratch mod; the event-driven plan's M0)

- `$.fs.write` truncates in place (same inode; a hard link sees the new text): not atomic. 1 KB 2 ms, 128 KB 3 ms, 2 MB 15 ms. `stat` 2 ms. `list` 3 ms, and it returns `{ name, kind, size, mtimeMs }` per entry, so one call stamps a whole folder.
- Module environment:
  - Present: `Date` in the local time zone, `Intl`, `toLocaleTimeString`, `Math.random`, `setTimeout`, `setInterval`, `AbortController`, `crypto`, `structuredClone`, `BigInt`.
  - `crypto.subtle` is `digest` only (the types say so, and in `claude plugin test` there is no `generateKey`, `importKey` or `verify`). Hence the license key's signature is checked in BigInt (`licensekey.ts`); tests use keys signed once by Node.
  - Absent: `queueMicrotask`, `process`, `fetch`, `WeakRef`.
  - `Date.now()` agrees with `$.clock.now()`. Keep `$.clock.now()`: tests move that clock.
- `$.clock.after(ms)` fires 15 to 80 ms late. `cancel()` holds.
- `$.model.complete`: about 0.5 s on haiku. `timeoutMs` elapsed resolves `{ reason: 'aborted' }`. An unknown model resolves `{ reason: 'api-error', status: 404, error: 'model_not_found' }`; it does not reject.
- `session.measure` fires around main-thread turns, the first time naming every unit, with `rateLimits` (`kind`, `percentUsed`, `resetsAt`). It did not fire after a `$.model.complete` alone. `$.session.usage()` is free and holds the same figures.
- `$.agent.spawn` resolves in about 130 ms with `{ model, agentId }`. `$.agent.list()` rows are `{ id, description, type, status, spawnedBy }`, status `running | completed | failed`; a finished row drops out later.
- A subagent that dies on an API error raises `turn.complete` with `reason: 'error'` and an empty answer, about 16 s after the spawn for a model that does not exist and 170 s with no connection (the engine retries first, 11 times; the error word is then `server_error`). At the same moment `classic.StopFailure` fires with the error kind (`model_not_found`) and `agent_id`: that is where a failed review's reason comes from.
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
- A hooks module may import from a sibling folder of `hooks/` inside the plugin (2026-10-05, for the move to `plugin/core/`): with `hash.ts` moved to `plugin/core/` and imported as `../core/hash`, `claude plugin validate --strict` passed, `claude -p '/bsd help' --plugin-dir` loaded the module (`hooks module backseat-driver@inline loaded`) and answered, and `claude plugin test` ran the tests (those that need the plugin inside this repository aside).
- Compiled PureScript loads. `purs` output bundled by esbuild into one ES module and imported by the hooks module (`import * as K from './kernel.js'`) passes `claude plugin validate`, runs in a live session, and runs under `claude plugin test`. A 100-line module using prelude, arrays, maybe and integers bundled to 12 KB.

## Tests

- `stubSession(on, options)` (`plugin/tests/kit.ts`) is the fake world:
  - a session, and a git repo at `/work` (`write`, `commit(message, { author, body, isMerge })`, `checkout`)
  - a clock: `session.clock.advance(ms)` resolves after fired timers and their work settle; `session.clock.settle()`
  - the model via `session.reply(...)`
  - subagents finished by `$.turn.complete(session.finish(n, answer))`
- Options: `email` (default `me@example.com`, `''` = none), `data` (seed the data disk), `isNewProject`, `install: 'clone'|'installed'`, `tags`, `isCloneDirty`, `isCloneCurrent`, `head`. Registers every stub needed to start and switch modes: extend it, don't register a second stub (one stub per event).
- Data disk: `session.disk` (absolute path → text), `session.data(rel)`, `session.removed` (rm targets). Deletion needs the marker: `session.disk.set(MARKER_PATH, …)` or a prior write.
- The band above the prompt and the hint line under it: mount `BAND` and `HINT` (kit.ts). Beneath the plugin the kit draws `ENGINE_BAND` in the band and the hint plus any `tail`. `session.config` is `/config`'s rows (`$.config.list`), `session.configured` what `$.config.set` changed, `session.configDeny` refuses the next one. Tests that open the pane set `{ options: { layout: 'vertical' } }`.
- Explain in the kit: `session.lookups`, answered with `session.explain(reply, 'text the prompt contains')`. Order isn't guaranteed. With no answer, a file maps to no symbols. `session.editor(file, line, …, extra)` writes `editors/<extra.editor ?? 'test'>-1.json`, beating for the whole test unless `extra.at` is given (kit time starts at 0, and an `at` of 0 does not parse: advance the clock first). Journal tests set `explain: 'off'` (a live editor triggers the 100 ms poll and slows minute-scale tests).
- Progress: `session.assess(reply)`, `session.assessments`. Updates: `session.ran` (claude and network git commands in order). A clone's top is the plugin folder's parent; an installed copy's `installPath` is `/`.
- `session.logs` = `$.ui.log` output (swallowed errors appear there).
- Failures in the kit: `session.failing.push('overloaded')` makes the next model request fail that way, whichever job makes it; `'look:overloaded'`, `'explain:…'`, `'progress:…'` name the job. Words: Claude Code's API errors, or `offline`, `timeout`, `empty`. Explain asks 2.5 s after a save, before the look, so name the job or set `explain: 'off'`. `$.classic.StopFailure({ error })` is a turn that died, `$.turn.complete(session.turnEnded())` a conversation turn that answered, `$.session.measure({ context, rateLimits, changed: ['rateLimits'] })` the plan's limits arriving (set `session.limits` too: the tutor reads them again before a look). `session.scans` counts `git status` calls.
- Time in the kit starts at 0 and the first scan is 1 s after switch-on. A look is due exactly `quietMs` after the scan that saw the save: `advance(9999)` no request, `advance(1)` one. The health wait is jittered with `Math.random`, so assert on the look's own pacing (deterministic) or on bounds.
- Several sessions in the kit: the fake git keeps the lock repository in `session.disk` (`locks.git/HEAD`, one file per held ref). `session.locking` lists `take`, `steal`, `give` and `refused` with the ref (`lockRef(path)` names it). `session.lockedElsewhere(ref, agoMs)` is another session's lock. `session.halfWritten.set(path, n)` makes the next n reads of a file find it empty. A wait in the store or for a lock is a `$.clock.sleep`, so the test has to move the clock for the call to finish: start the call, `await session.clock.advance(...)`, then await it.
- The tutor's own debug log in the kit: seed `data: { 'debug.json': { on: true } }` (and the marker), or run `/bsd debug on`. `session.debugLog()` returns every record across chunks. Records are written `FLUSH_MS` after they are noted, so `await session.clock.advance(FLUSH_MS)` before reading. The kit stubs `session.id` (`SESSION_ID`), `session.version` and `session.end`.
- Engines with ports are tested without the kit: `explain.test.ts` has `world()`, whose model is answered by hand with `w.answer(request, reply)`, which is how a test changes a file mid-call. `w.state.wakeAt` is what the engine last asked for, and `w.explainer.wake()` is the deadline firing.
- Another session in the kit is what it leaves in the data folder: seed `data: { 'projects/<id>/lease.json': { v: 1, session: 'someone-else', at: 0 } }` for a driver that is there (kit time starts at 0, so that lease runs out at 60 s), or `session.disk.set(...)` a profile mid-test for a hush made elsewhere. `session.sessionId` is this session's id: set it and fire `$.classic.SessionStart({ source: 'clear' })` for a `/clear`. `session.scans` counts one `git status` at switch-on even in a session that does not drive.
- `/clear` in the kit: `$.session.end({ reason: 'clear', … })`, then `$.classic.SessionStart({ source: 'clear' })`. The kit cannot empty `$.state` in between, so a test changes the pane by hand there (dismisses a note) and checks that it is put back.
- Property tests (`kernel.test.ts`): a rule is checked over seeded random histories (`seeded(seed)`), and a failure names its seed and turn, so it can be found again. They run against the committed bundle, which is what users get.
- inotifywait in the kit: `hasInotify: true` makes `$.process.spawn` of it succeed (anything else is refused, as when it is not on PATH), `ignored` lists the folders git ignores. `session.watchers` are the children started, each with `argv`, `report(...absolutePaths)`, `end(complaint)` and `isStopped`; `session.spawnedProcesses` every command tried. A child the tutor stops ends in the kit at its next piece of output (in Claude Code at once), and a reported change needs `await session.clock.settle()` and `advance(1)` before its scan has run.
- A slow model in the kit: `session.stall('explain' | 'look' | 'progress')` holds that job's requests open until `session.release()`. Requests are recorded when asked, not when answered.
- `sessionTest` (30 s limit) for anything that starts a session; plain `test` (5 s) for pure functions. All files run in parallel processes, and each test loads the whole mod, so a busy machine takes seconds before the first action.
- A `$.clock.every` period is one dispatch with 10 s of real time ("exceeded 10000ms budget" under load). The timed deep review is no longer one: it is a deadline. `await session.clock.settle()` before asserting on timer-started work.
- Deep reviews in the kit: `session.spawned`, `$.turn.complete(session.finish(n, answer, reason))`, `$.classic.StopFailure({ error, agent_id: session.agentId(n) })` for why a reviewer died, `session.lostAgents.push(id)` for one Claude Code no longer lists (the watchdog), `data: { 'projects/<id>/queue.json': … }` for commits left waiting. A reload cannot be staged (module variables outlive nothing but the test), so `adoptReview` is checked live only.
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
