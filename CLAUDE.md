# CLAUDE.md

AI-only reference for this repository. Terse by design. `README.md` is the only human document (plus `plugin/README.md`, its one-paragraph summary); everything else is here and in the files below. There is no separate design spec.

- This file: what every session needs (rules, product, layout, commands, architecture, invariants, mod API).
- `.claude/rules/*.md`: one per subsystem, path-scoped. Claude Code loads one when a file in its `paths:` is read or edited. Before changing a subsystem's behavior from `register.tsx` (which touches all of them), read its rule file. Section names are kept from the old single file, so a code comment's "see 'Pane'" is findable:

  | Rule file | Sections |
  | --- | --- |
  | `play-by-play.md` | Play-by-play and watcher (deadlines, scan, pushed changes, failures and health, plan limits, notes), Profiles |
  | `deep-review.md` | Deep review (queue, audit, ledger of issues), Project cache |
  | `pane.md` | Pane placement (minimize, keys walk), Pane (tabs, grammar, Settings tab, settings effects), Animated persona |
  | `explain.md` | Explain, Editor protocol |
  | `growth.md` | Progress, Growth, Lessons |
  | `sessions.md` | Handoff, Several sessions (lease), Journal |
  | `data.md` | Data folder (store, locks, forget), Debug log |
  | `jack.md` | Jack in, Live checks |
  | `tests.md` | Tests (the kit) |
  | `kernel.md` | Kernel (PureScript): porting, membrane, gotchas |
  | `distribution.md` | License, Updates and uninstall |
  | `cicd.md` | CI/CD: the road to main (ruleset, owner-merge, shipping), repository settings, workflows |

- `.claude/history.md`: dated history (ui-truth passes, live sessions, parity runs, what changed when and why). Never loaded automatically: grep it when you need why something is the way it is.

## Rules (owner's standing instructions)

- Keep these files current: any change to what they describe (commands, layout, behavior, invariants, API gotchas, verification status) updates the right file (this one, a rule file) in the same commit. Record mod-API discoveries the next session would otherwise rediscover. Rule files state current truth; what happened and when goes in `.claude/history.md` as a dated bullet. Keep this file under 100k characters (Claude Code warns at 150k and may not read past it): new subsystem detail goes in a rule file, and a new subsystem gets its own rule file with `paths:` and a row in the table above.
- Record product decisions in "Product" below the session the owner states them.
- Ship when work is complete, unasked. `main` takes no direct push (owner, 2026-10-10): every change is a pull request that merges once `check` is green. Locally `scripts/ship.sh` from a branch or a worktree based on `origin/main` (pushes, opens the pull request, arms auto-merge, waits); a cloud session pushes its branch, opens the pull request and arms auto-merge. The owner's pull requests, this session's included, are approved by `owner-merge.yml`; anyone else's wait for the owner (`cicd.md`). Never force-push or rewrite pushed history without asking. Other sessions ship too: merge `origin/main` into your branch when it conflicts, stage by path, never `git add -A`.
- README rules:
  - Sections only: why, what it is, who it's for (and not for), how to use it. Nothing said twice. Short.
  - Owner's voice, as in their Enchant Games Journal (https://enchant.games/?slug=journal, feed `/rss.xml`, articles are YAML under `/news/`, listed in `/news.json`): first person, short punchy lines, blunt, a little irreverent, quotes as punctuation.
  - No internal status (what was or wasn't tried, tested or installed): the owner called it invasive.
  - Never tell users how to run their workflow (which terminal or editor, where to run `claude`). State what works and where.
  - Never frame writing your own code as the slow option. Saying the tutor isn't for having Claude write code, and that `/backseat off` restores normal Claude Code, is fine.
  - Never apologize for the project or hedge it ("trying to", "I see the irony").
  - Never suggest autosave to make it closer to live: editor plugins are the answer.
  - Never link to this file or to design detail. A new feature gets a line at most.
  - Every feature name says what it does to a newcomer ("play-by-play commentary", not "play-by-play"). Teams get a bullet in "Who it's for".
  - `plugin/README.md` is the same story in one paragraph; keep it in step.
  - Facts that must stay true: install commands, minimum Claude Code version (text and badge), the `/backseat` command table, the footprint paragraph at the end of "What it is". The alpha line at the top names other back ends to come (OpenCode, OpenAI, local models).
- Client-specific code stays in the adapter (owner, 2026-10-05: everything Claude Code specific stays modular, for the OpenCode client and other back ends). Anything that knows Claude Code (its `$` calls, element tree, events and their words, settings, session and process behavior) goes in `plugin/hooks/`; `plugin/core/` gets plain data through ports. A core module that exists only because of something Claude Code does is listed under "Host seam" in the same commit. `npm run core` does not catch a module that reads a Claude Code shape through `unknown`, or a port field named after Claude Code: check every new `plugin/core/` file by hand.
- Pronouns: the owner's are not stated. Use "the owner" or they/them.

## Product

### Why it exists (owner's reasons; every decision serves them)

- Ownership of understanding over speed: "if it takes me longer, but I grok it".
- The progressive surrender of engineers' technical autonomy (environment, tools, stack, now their brains). Unused skills fade. Developers who handed their work to agents commonly report losing the ability to code within months. People steering an agent think they are in the driver's seat while the machine thinks for them.
- The love of the game: the craft is the point.
- Iron sharpens iron: mentorship with a beginner's mind.

Stance: the project is against Claude writing the user's code, not neutral. While on, the AI never drives, and nothing presents handing code to it as faster or better.

### Decisions (do not re-propose rejected ones; do not design around the rest)

Dated history of each is in `.claude/history.md`.

- Learning happens through the user's own projects. The tutor never makes up exercises, quizzes or homework (the contract forbids them); lessons are the exception the person chooses. The README calls nothing "not a linter" (the owner: it's quite similar to one). The tutor chimes in from the background; the user tunes how often, how deeply, in what voice.
- One command, then hands off: `/backseat`, one name everywhere (`/bsd`, `/backseat-driver`, `/backseat-driver-update` are gone; `/backseat update` fetches a release). Nothing else the plugin ships shows in the slash menu: the contract is `prompts/contract.md`, never a skill or `commands/` file again (`/backseat-driver:tutor` in autocompletion "confuse the user"). Every setting has a default, every question is skippable, setup never blocks work. A language first met mid-session gets defaults; its questions are offered in the pane, never interrupting.
- One profile per language, never per project. It matters only once the user works in that language. The tutor may read other profiles (explain Rust via Python).
- The user has the last word. Pushback is weighed. A contested point goes to the deep review model for a second opinion, and the user is told. "Do it my way" always stands. The play-by-play may keep flagging until hushed; a hush saves to that language's profile at once.
- Tabs: 1 Play-by-play (default view), 2 Deep review, 3 Explain, 4 Growth, 5 Lessons, 6 Settings.
- One layout, the pane. The `horizontal` and `unified` layouts, the `layout` setting and `/backseat layout` were removed (2026-10-05); do not bring back layouts. A fullscreen terminal narrowed until Claude Code moves the pane above the prompt still gets the whole pane, never another look ("i'd rather it just look wrong until i resize").
- The pane minimizes; only `/backseat off` shuts the tutor down. Claude Code paints the pane's × and a mod cannot repaint it; a close puts the pane away, a strip above the prompt stands in, the tutor stays on, and keyboard and mouse both restore it obviously (`pane.md`, Pane placement).
- Settings are one press away: a mod cannot add to `/config`, so the Settings tab edits the same rows, and `/backseat settings` opens it.
- The tutor belongs to the conversation, not the process. A conversation Claude Code moves into another process keeps its tutor (on or paused, pane, notes, lease); the process it left lays the tutor down. Every new session still starts off, and so does a conversation picked up more than a minute after its session closed (`sessions.md`, Handoff).
- The editors' light: green with the editor's name while one is connected to the project, red while none is.
- First-run questions are few and single choice: the language they know best (once ever), then three per new language (level, goals, focus). Never more than ten at once. Esc skips the rest. Re-ask with `/backseat questions` or `q`.
- Three background jobs, each with its own model and thinking level: play-by-play (while hacking), deep review (commits), Explain (reading). The conversation uses the session's model. Explain's cache is per project; all three jobs feed it and read it.
- Decision points and insights: the play-by-play, the deep review and the contract point out forks that are the user's call, with what each way costs, never handed over to be written, and offer `★ Insight` notes about this codebase and this code, never general concepts and never a defect in disguise. The wording is the project's own (see "No third-party text").
- The Deep review is the critique: one ledger of issues per project (`findings.json`), ranked worst first on tab 2 with what was read and skipped. Every project gets one audit of the codebase as it stands (after the first look around; `a` audits again); every commit review rules on the issues on record in its files and adds its own. The map (first look around) stays one key away (`v`), not a tab. Issues are dismissed, never muted (a muted topic would silence the reviewers). Silence never reads as health: the empty play-by-play says what the ledger holds, and the conversation is told what was found and read. All three stages are done (plan: `~/.claude/plans/compressed-plotting-sun.md`).
- License: source-available, free for personal use, paid for commercial use. PolyForm Noncommercial 1.0.0 (`LICENSE`, root and `plugin/`, `Required Notice:` copyright line on top) plus `COMMERCIAL-LICENSE.md` (root and `plugin/`: who needs it, what it grants, no lockouts, "not on sale yet"). Never call it open source. The commercial terms say nothing about earlier versions or the prior license: do not add it back. SPDX `PolyForm-Noncommercial-1.0.0` in `plugin.json`, `package.json`, `editors/vscode/package.json` and the Emacs header. It was MIT until 2026-10-05.
- Licensing is light ("this is not Microsoft, don't be paranoid, a way for ethical companies to pay us"): asked once at the first switch-on, personal or commercial; commercial asks for a key. Nothing ever stops working: a missing, bad, expired or withdrawn key only puts one dim line in the pane. Payment and the server's deployment are for a later discussion with the owner.
- No third-party text. Do not copy or closely paraphrase another project's prompts (the decision-point and `★ Insight` passages were once close to Anthropic's `learning-output-style` and were rewritten in 2026-10-06). If something is adapted, credit it in an HTML comment at the file's top (`stripComments` removes it before a model sees it) and bring back `THIRD_PARTY_NOTICES.md`.
- Explain is never stale: freshness beats speed. Nothing is shown unless it matches the file on disk at that moment.
- Editor plugins: Emacs, Neovim (Lua), VS Code, in `editors/`. Simple, plug and play; they send what is useful (open files, focused file, caret, selection, unsaved changes, keyboard focus). More can come; the protocol is the contract. Transport: one file per running editor in the data folder (the mod cannot listen on a socket and has no network of its own). An editor that finds no data folder writes nothing. Every driver reads every editor's file and keeps what is about its own repository; the last caret to move speaks for a project; a nested repository's caret goes to the inner one's tutor (`explain.md`, Editor protocol).
- Lessons: one markdown file per learning path in `plugin/lessons/`; a file merged there is approved and every install offers it (the folder is read at switch-on, nothing lists the files). Done one step at a time in the user's own code; a step started from the Lessons tab is taught in chat under the contract, and the tutor never writes it. Skipping costs nothing. Two ship as examples: `python-errors.md`, `commits-that-explain.md`.
- Growth: one score per language from everything seen: own commits above all, lessons done, help needed, habits improved. The tab shows level and score, what to work on, where they needed help, what would raise the score, what improved, and one plain line of encouragement only when something did ("don't flatter them"). The headline is a ladder of four rungs (Padawan, Apprentice, Journeyman, Gandalf over beginner, junior, mid, senior), the current one filling red, orange, yellow, green (`growth.md`).
- Everything pressable looks pressable, and mouse and keyboard both work 100%: one grammar across the pane. A control with a key reads `k: label`, one without `[ label ]`, a list row `▸ …`; every tab's keyed controls stand at its top under the "Working on" row, then the keys row, then a rule; the open tab is underlined; the status line has a light; the keys row always says whether the keys work and how the pane is driven. No emojis: double-width glyphs misalign Ink's layout.
- Keys (owner, 2026-10-07): `1`–`6` open a tab; `j`/`k` walk the rows of whatever list the tab draws, on every tab, and Enter presses the ring's row; `e`, `d`, `t` (and `m` on a note) act on the note or issue the ring is on; arrows scroll a row, PgUp/PgDn a page; Tab and Shift+Tab do nothing in the pane.
- The tabs' spinner is bare and never an ellipsis or in parentheses: `2: Deep review ✻`, for as long as the work runs (slower after a minute).
- A tab pressed in the band opens, whichever way the press came; never a digit leaked into the prompt.
- No early judgement: a first placement needs 8 observations from 3 commits and 80 of their own added lines; beginner needs evidence like every other level. Evidence for no level is no level ("Not placed yet", with what is missing). A provisional level that no longer meets the bar is withdrawn. The bar says "provisional" while it is.
- Progress is honest: one report per language across projects: level (beginner, junior, mid, senior), why, what the next level needs, recent notes, encouragement kept apart from the level. Only the user's own work counts. A level can come down. Worth the token burn.
- State is never cleared by accident: clearing is deliberate and confirmed (one project, one language, or everything). Uninstalling can clear everything.
- Users stay up to date: a newer release is announced in the pane, one command fetches it, the tutor comes back on by itself.
- Everything feels instant: no command waits on git or a model.
- No burn-token mode ("it was a bad idea, immature"): `burn_tokens` is retired (`RETIRED_SETTINGS`); never re-propose sending requests to a big model just to spend tokens.
- Quick by default: the play-by-play looks 5 s after the last save, no minimum gap. `quiet_time` (2–60 s) and `minimum_gap` (none–5 min) stay in `/config` to cap spend.
- The persona has two halves chosen apart. The voice sets teaching style, tone, wording; the engineering persona sets what the tutor values, flags and recommends (`default` = Claude's own judgment). Both apply to notes, reviews and conversation. A voice never brings its namesake's opinions about code; an engineering persona never brings its namesake's manner. Neither overrides the contract. A persona named after a real person is "in the spirit of": never claims to be them or quotes them, hard on the code, never on the user. Voices: `default`, `torvalds`, `knuth`, `primeagen`, `eli5-tldr-kiss-terse`. Engineering: `default`, `torvalds`, `knuth`, `primeagen`.
- Open in the editor: `editor_command`, free text with `{file}`, `{line}`, `{column}` (a command without a placeholder gets `+{line} {file}`). Set, the Jump-to rows, notes (`o`) and the Explain spot (`o`) open there; empty, they open the Explain tab. Runs as given, no shell, only on a click.
- The character stands on the Play-by-play tab only. It has a face per voice and can be switched off: one short line at a time (a critical or design point in the latest save, a review's takeaway, now and then a joke), dim at rest, no model calls of its own. Real-person personas get caricatures in good spirit (a timid mascot version was rejected): Linus with square glasses, Knuth with round glasses, ThePrimeagen with headphones and mustache, the KISS Linux penguin in a top hat, Claude Code's mascot for `default`.
- The tutor knows what the user is doing without making them say it: a per-project journal. "What are you working on right now?" is asked only on `w`, `/backseat working`, or by the tutor in chat when unclear and it matters. Their answer overrides the inference and persists until changed or taken back. Borrowed from the owner's topstep-claudebot (journal and briefings; not its reflection loop or inbox).
- Event-driven, not polled: a state machine on Claude Code's events and exact deadlines; the owner accepts the complexity. Polling is confined to one adaptive sensor for what Claude Code cannot push: the user's saves, commits made outside it, the editor's caret.
- File watching: use inotifywait when on PATH, never break without it. Started at switch-on as children, not `watchPaths` at session start, so "dormant until switched on" holds.
- Failures handled gracefully: rate limits, plan limits and outages told apart, retried with delayed backoff, nothing pending lost. Commits made meanwhile are reviewed later: the last three, up to a day old.
- Several sessions at once are safe ("a seatbelt and suspenders"): data-folder writes are locked and queued, and one session drives a project's background jobs.
- The pane is always up to date: instant, fresh, async.
- A verbose debug mode, switched on and off: everything the tutor does goes to one log for all projects in the data folder, so a developer can have Claude monitor it.
- Jack in ("give yourself eyes to see what I see … when what you see differs from what it SAYS you are able to dive in and fix"): `scripts/jack.py` and the `jack-in` skill, modeled on `../topstep-claudebot`'s `tools/jack.py` (`jack.md`).
- Functional where possible: decision logic in a PureScript kernel modeled on `../merecatholicity.com`, one `core.ts` membrane (`kernel.md`).
- Pull requests only, after merecatholicity.com's pipeline (owner, 2026-10-10: "no more pushing main but PR required and no auto merge unless it's me and you everyone else including other clauses I have to manually approve it"): auto-merge only for the owner and the Claude sessions the owner drives; everyone else, other Claudes and Dependabot included, waits for the owner's approval (`cicd.md`).

## Status

Every roadmap milestone is built and was seen working in short scripted real sessions (2.1.289 to 2.1.293), and the owner has used it for real in a few projects (`bashscripts`, `php-hello`). The prompts (`plugin/prompts/`, the contract above all) are what will most likely need changing. Each rule file has a `Verified:` line saying what is live-checked and what is tests only. The first GitHub release is 0.2.0 (`backseat-driver--v0.2.0`, 2026-10-06).

- Never run live: the `primeagen` engineering persona; an install from GitHub being told of a release and updating; Neovim or VS Code driving a live session; Windows. The license server is not deployed and `PUBLIC_KEYS` is empty, so a well-formed key is taken on trust.
- The owner runs the live copy: `claude` in their shell is a `~/.bashrc` function adding `--plugin-dir ~/repos/backseat-driver/local/live/plugin`, a git-ignored copy of `plugin/` that only `scripts/jack.py sync` writes. A save under `plugin/` reloads nothing of theirs; a sync does, within 30 s. Nothing is installed (`command claude` is the bare binary). Their options live under `pluginConfigs["backseat-driver@inline"]` (voice `default`).
- `npm run validate` on 2.1.290+ prints a `gating hook without .catch` note per gating hook: informational, not a `--strict` failure.
- Open owner decisions:
  - whether a project folder (notes, reviews, journal) carries across a re-initialized repository, and how Growth names a commit of a project since made again.
  - whether an Explain explanation written under a since-rewritten project overview, or under the prompt's older words, is redone. Today it stands while the file reads the same.
  - whether the Growth tab's lists become rows `j`/`k` walk, and what Enter on one does. Today they are text.
  - which ref new installs get (see `distribution.md`).
  - whether to submit to Anthropic's directory.
  - whether a conversation picked up later (`claude --continue` after an exit) comes back with the tutor on. Today only one moved within a minute does.
- Directory facts (checked 2026-10-04): lists mods, for Claude Code only. Submit at claude.ai/directory/manage; it tracks a branch or tag, plugin path can be `plugin`. Requires a README of 40+ words inside `plugin/` and a LICENSE (both there; whether it takes a noncommercial license is unknown). Files under 256 KiB, at most 512 files. Directory installs load as `<name>@synced`.
- Plans on the owner's machine: part two `~/.claude/plans/dynamic-wandering-micali.md`; the event-driven plan `~/.claude/plans/wild-jumping-clover.md`, M0–M9 all done (M8: inotifywait only; Claude Code's `watchPaths` are not used). Nothing in the mod runs on a repeating timer except the persona's mouth and blink and the spinner while work runs.

## Repository

The root is a plugin marketplace (`.claude-plugin/marketplace.json`, one entry with source `./plugin`). The plugin is `plugin/`, and everything in it ships to users. The validator warns about a `CLAUDE.md` at a plugin root (a failure under `--strict`), so dev files (`CLAUDE.md`, `.claude/`, `package.json`, `node_modules/`, `scripts/`, `.github/`) stay at the root. No build step: Claude Code loads the TypeScript as it is.

```text
.claude-plugin/marketplace.json
plugin/.claude-plugin/plugin.json   manifest + userConfig (source of truth for settings and defaults)
plugin/prompts/                     contract.md (the contract: plain text, no skill), play-by-play.md, deep-review.md, explain.md, progress.md, speech-bubble.md
plugin/personas/{voice,engineering}/*.md
plugin/lessons/*.md                 learning paths, found at switch-on
LICENSE, plugin/LICENSE             PolyForm Noncommercial 1.0.0, identical
COMMERCIAL-LICENSE.md (also plugin/) the commercial terms, identical
plugin/hooks/                       the Claude Code adapter (see "Host seam")
plugin/hooks/hooks.json             {"modules": ["./register.tsx"]}
plugin/hooks/register.tsx           all effects
plugin/hooks/pane.tsx, character.tsx, contract.ts, shown.ts  the pane's and the prompt's Claude Code side
plugin/core/                        shared: every module that does not know Claude Code
plugin/core/art/<voice>.ts          each character's pixel art
plugin/core/kernel.js               the kernel, compiled from PureScript; committed, never edited by hand
plugin/core/kernel.d.ts, core.ts    what the kernel exports, and the one file that calls it
kernel/src/Kernel/*.purs            the kernel's source (dev only)
kernel/spago.yaml, spago.lock, toolchain.json  package set and compiler, pinned
plugin/types/index.d.ts             state keys, tool inputs
plugin/types/runtime.d.ts           globals shared modules may assume (tsconfig.core.json only)
plugin/tsconfig.core.json           shared modules checked without Claude Code's types
plugin/tests/                       claude plugin test; kit.ts is the fake world
scripts/                            dev-session.sh, outage-proxy.py, jack.py (+ test_jack.py), toolchain.py, build-kernel.sh, release.sh, ship.sh, github-settings.sh (+ test_workflows.py), persona-preview.ts, debug-tail.sh
.claude/skills/jack-in/, ui-truth/  dev skills (not shipped)
.claude/rules/, .claude/history.md  this file's subsystem detail and history
editors/                            neovim/, emacs/, vscode/ (dev side, not shipped with the mod)
license-server/                     reference license server (not shipped, not deployed)
.github/workflows/                  check.yml (pinned Claude Code; the required check), nightly.yml (newest), owner-merge.yml (approves the owner's pull requests)
.github/rulesets/main.json          main's ruleset; .github/dependabot.yml bumps the action pins and the dev toolchain
research/                           opencode.md (the OpenCode client plan); personas/ (research behind each persona prompt)
```

The ground rules in README ("Claude does not edit your files" etc.) describe end-user product behavior, not rules for working in this repo.

## Commands

```bash
npm install                      # once: TypeScript, spago, esbuild
npm run check                    # kernel + validate + licenses + test + typecheck + core + server + tools
npm run build:kernel             # kernel/src -> plugin/core/kernel.js
npm run kernel                   # fails when kernel.js is not what kernel/src builds
npm run licenses                 # root and plugin/ license copies identical
npm run validate                 # claude plugin validate . --strict && ./plugin --strict
npm test                         # claude plugin test ./plugin
npm run typecheck                # tsc -p plugin/tsconfig.json
npm run core                     # shared modules typecheck without Claude Code's types
npm run server                   # license server typecheck and tests
npm run tools                    # python3 scripts/test_jack.py, test_workflows.py
scripts/dev-session.sh           # live session in tmux (default session name bsd)
scripts/ship.sh                  # the road to main: push a branch, open the PR, arm auto-merge, wait
scripts/release.sh minor --push  # patch|minor|major|X.Y.Z: bump, check, ship as a PR, tag the merge, push the tag
scripts/github-settings.sh check # repository settings and ruleset vs GitHub (apply writes them)
npm run persona -- [dir] [voice] # persona art in truecolor, and PNGs of every pose
scripts/debug-tail.sh            # follow the tutor's debug log
scripts/jack.py [in|bundle|sync|truth|watch|tour|…]  # see jack.md
scripts/outage-proxy.py 18080    # stage an outage in a live session
```

- `claude plugin test` takes only the plugin root; it can't run one test (see `tests.md` for running a subset).
- `npm run validate` prints the mod's `hooks:`, `calls:` and `env reads:`. Read them after every change to `register.tsx`: they are what a user audits.
- Typecheck needs `plugin/.claude-plugin/types/` (self-gitignored). Claude Code writes it whenever it loads the plugin from this folder: a dev session, or `CLAUDE_CODE_PLUGIN_DIR_WATCH=1 claude -p hi --plugin-dir ./plugin` (writes the types even without a login, then fails at the model call). Since 2.1.295 the types are written only for a folder under hot reload, which `-p` leaves off without that variable. Rerun after a Claude Code update.
- CI: `check.yml` pins `CLAUDE_CODE_VERSION` to the last-verified version; bump it with "last verified" below, and whenever the code relies on a newer version's types (`kit.ts`'s `promptText` needs 2.1.292's `ModelTextBlock`). `nightly.yml` runs `latest`: red there means Claude Code changed the mod API, not that `main` is broken. `check` is main's required check: never path-filter or rename it (`cicd.md`). Every `uses:` names a commit. Validate and test need no login. `gh run list`, `gh run view --log-failed`.
- A `--plugin-dir` session reloads the mod on every save under `plugin/` (an idle one looks every 30 s). A hook that throws or times out is skipped, and an invalid render tree is replaced by Claude Code's own drawing; each shows one dim transcript line. `claude --debug` logs reasons.
- Live checks (tmux, env, the owner's live copy, `sync`): `jack.md`. A milestone is done only when seen live; tests stub everything.

## Architecture

- Contract: `prompts/contract.md`, the single source of tutor behavior. The mod injects it and never carries a copy. Never put it under `skills/` or add a `commands/` file: either shows in the slash menu. It describes behavior only; anything naming this plugin's commands, tools or agents goes in `SESSION_NOTES` in `contract.ts` (host-neutral for OpenCode, `research/opencode.md`).
- Personas: the chosen engineering file, then the voice file, are injected after the contract and into both review prompts. Each file states which half it is and that it leaves the other alone; a new one needs that paragraph and a research file in `research/personas/` first (read it before changing a persona prompt).
- Mod: `plugin/hooks/` (adapter) over `plugin/core/` (shared). One command, `$.command.register` `/backseat`; tools via `$.tool.register` (`hush`, `unhush`, `record`, `lookup`, `progress`, `lesson`, `profile`, `working`, `activity`, `issue`); pane via `$.ui.open` plus a `ui.render` hook, contents in `$.state`. A mod, not a skill plus a monitor: a monitor would turn every save into a conversation turn on the main model. The mod reviews out of band.

### Module shape (enforced by Claude Code)

A hooks module may not pass `$` to an imported function. Every `on(...)` and `$.noun.method(...)` is spelled in the module itself:

- `register.tsx` is the only file with effects: all hooks, all `$` calls, all functions taking `$`. It imports shared modules as `../core/<name>`.
- Every other file is pure (plain values in and out), tested directly.
- Effects cross imports as capabilities, closures over `$` (`args => $.process.run(['git', ...args])`). Passing a closure is allowed; passing `$` is not.
- `atom(...)` definitions live in `register.tsx` with literal `plugin` and `key`. Every state key is declared in `plugin/types/index.d.ts`.
- One `on` per event per matcher. Two unmatched `on('session.start')` stop the module loading.
- A function taking `$` needs a name unique in the file, locals and parameters included (`const [skill, look] = …` broke loading because `look` was a function; so did a parameter named `ask`).
- Matchers must be literals (`{ command: 'backseat' }`, or an array of literals); the validator prints `command=?` otherwise.

### Files (`plugin/core/` unless marked)

| File | Holds |
| --- | --- |
| `host.ts` | `Host`: everything engines ask of their program (clock, deadlines, trace, failures, session, paths, data folder, git, model) and `ModelRequest`, `ModelReply`, `AskModel`, `Trace`, `Deadlines`. Each engine's ports are `Pick<Host, …>` plus its own |
| `opening.ts` | the editor command as argv: `splitCommand` (quotes, no expansion), `editorArgv` |
| `settings.ts` | `/config` values typed; the Settings tab's rows; `SETTING_EFFECTS`, `RETIRED_SETTINGS` |
| `mode.ts` | `/backseat` argument parsing, mode transitions, `HELP` (the authoritative command and key list) |
| `guard.ts` | which paths are the user's |
| `git.ts`, `noise.ts`, `diff.ts` | `git status` parsing; files and edits never worth a look; line diff |
| `watcher.ts` | change since the last look (ports) |
| `gate.ts` (also `usagePressure`), `scheduler.ts`, `sensor.ts`, `health.ts`, `play.ts`, `status.ts`, `lease.ts`, `reviewqueue.ts`, `store.ts`, `sessions.ts` | types and parsing around a kernel module (`Kernel.Pace`, `Schedule`, `Sensor`, `Health`, `Play`, `Status`, `Lease`, `Queue`, `Store`, `Sessions`), whose functions they re-export from `core.ts` |
| `filewatch.ts` | inotifywait command lines, output as lines, `Nudge` |
| `core.ts`, `kernel.js`, `kernel.d.ts` | the membrane (only importer of `kernel.js`), the compiled kernel, its exports |
| `clock.ts` | `clockTime`, `dayTime`: times of day in the person's zone, handed to the kernel |
| `look.ts` | one play-by-play pass: `runLook(ports, state, isAsked)`, `LookPorts`, `LookState` |
| `reviewing.ts` | waiting commits and deep reviews: slot, failures, watchdog, `adoptReview`, what starts next. `ReviewPorts`, `ReviewState` |
| `progressing.ts` | the look at progress: whose commits, `assessCommit`, `placeFirst`, the queue. `ProgressPorts`, `ProgressState` |
| `progress.ts`, `authorship.ts` | level rules, ledger, report text; whose work a commit is |
| `growth.ts` | growth facts and words (rules: `Kernel.Growth`) |
| `lessons.ts`, `learning.ts` | `parsePath`, `LessonRecord`, the tab's view, a step's request; keeping lessons (`loadLessons`, `startStep`, `markDone`, `lessonTool`, `LearningPorts`, `LearningState`) |
| `journaling.ts`, `recorder.ts`, `journal.ts`, `glance.ts`, `working.ts`, `attention.ts`, `enclosing.ts` | keeping the journal while on (`startJournal`, `keepJournal`, `journalDue`, `sayWorking`, `showWorking`, `showStoredWorking`; `JournalPorts`, `JournalState`); its engine; storage and merge; journal as text; working-on; caret time; enclosing definition by indentation |
| `following.ts` | following the spot in focus: `readFocus`, `refreshView`, `followEditor`, `followSaves`, `fastPoll`, `moveFocus`, `lookUp`. `FollowPorts`, `StartPorts`, `FollowState` |
| `explainer.ts`, `knowledge.ts`, `explain-prompts.ts`, `focus.ts`, `editors.ts` | Explain engine; per-file knowledge and freshness; requests; spot; the editors' files |
| `leasing.ts` | holding a project's lease: `keepLease`, `giveLease`. `LeasePorts`, `LeaseState` |
| `carrying.ts` | the handoff: `carryOn`, `sayOn`, `sayLeft`, `sayOff`, `checkBound`, `checkSelf`. `CarryPorts`, `CarryState` |
| `debugging.ts`, `debuglog.ts` | running the debug log (`trace`, `flushDebug`, `startDebug`, `stopDebug`, `debugCommand`; `DebuggingPorts`, `DebuggingState`); its records, chunks, ring |
| `notes.ts`, `prompts.ts` | reviewer reply → notes; reviewer and conversation prompt text |
| `review.ts`, `findings.ts`, `project.ts` | review scope and request; the ledger of issues: parsing, `anchorIssue`, `placeIssues`, words (rules: `Kernel.Ledger`); project knowledge from reviews |
| `languages.ts`, `profiles.ts`, `questions.ts` | extension → language; profile storage; first-run questions |
| `hash.ts`, `datahome.ts`, `storage.ts`, `locks.ts`, `forget.ts` | fingerprints; data-folder paths and `REMOVABLE`; `Disk`, `memoryDisk()`; cross-session locks; forget scopes |
| `avatar.ts`, `sprite.ts` | characters, poses, speech, bubble; pixel art → Raster cells |
| `update.ts`, `license.ts`, `licensekey.ts` | install kind, releases, update and uninstall commands; license standing and words; key verification (imports nothing) |
| `hooks/contract.ts` | system prompt contents, `SESSION_NOTES`, instruction-file reframing |
| `hooks/pane.tsx`, `hooks/character.tsx` | the drawing from plain data (`PaneView`); `characterArt` |
| `hooks/shown.ts` | what the tutor says it shows: `textsOf`, `rowKeysOf`, `Shown`, `isSameShown` |

### Host seam (Claude Code vs shared)

Preparation for a second client (`research/opencode.md`: one shared core, Claude Code first class, nothing duplicated). The decoupling pass is done; the OpenCode client is next, when the owner asks.

- Builders in `register.tsx`: `lookPortsOf`, `reviewPortsOf`, `progressPortsOf`, `journalPortsOf`, `followPortsOf`, `leasePortsOf`, `carryPortsOf`, `learningPortsOf`, `debugPortsOf`. What stays in `register.tsx` because it is Claude Code's: `startReview` and collecting its `turn.complete`, `askWorking` (the dialog), `startExplaining` (model, project knowledge, pressure), `startDriving`/`stopDriving`/`followDriver`, `comeUp`/`standDown`, `fullState`, `fail`, `openInEditor`.
- Pattern: an engine takes a `…Ports` object and a state record it owns; `register.tsx` builds ports with `…PortsOf($)` (spreading `hostOf($, settings)`) and keeps only checks that name Claude Code (`isDriver`, toasts). A port is read when the engine needs it, never earlier. A port's types are the engine's own (`host.ts`), never Claude Code's; the adapter maps them. Where settings are `null` (journal, following, debug log) a model request is refused, and those engines do not take `ask`. A port whose shape differs per engine stays the engine's own.
- Adapter files, which may know Claude Code: `register.tsx`, `pane.tsx`, `character.tsx`, `shown.ts` (walks the element tree), `contract.ts` (`doing_tasks` swapped, `claudeMd` preamble reframed, `SESSION_NOTES` names tools `mcp__backseat-driver__…`). All in `plugin/hooks/`. `plugin/core/` imports nothing from `hooks/`.
- Enforced by `npm run core`: `plugin/core/` typechecks with no Claude Code types and no globals beyond ES2023 and `types/runtime.d.ts` (`AbortController`, `AbortSignal`). An import of `claude-code` or an adapter file, a timer or `fetch` fails it. A global goes in `runtime.d.ts` only if every host has it.
- Where shared code needs a Claude Code type it spells the shape itself: `Options` (`PluginOptions`), `ConfigRowLike` (`ConfigRow`), `ModelResult` in `health.ts`.
- Shared files that still carry a Claude Code assumption (seams, not bugs):
  - `health.ts`, `Kernel.Health`: error words are Claude Code's and the API's; `pressureOf` reads plan windows.
  - `Kernel.Status`, `Kernel.Queue`'s tab text, `Kernel.Play`'s comments: "Claude is not answering".
  - `mode.ts`: "Claude Code is back to normal", `/config` in `HELP` and `SETTINGS_OFF`.
  - `settings.ts`: `Thinking` is Claude Code's effort scale; `settingRows` reads `/config` rows; `SETTING_EFFECTS` assumes a host that reloads on option changes; `notReloadedText` names `/reload-plugins`.
  - `guard.ts`: `~/.claude/`, `/tmp/claude-<uid>/`.
  - `update.ts`: `claude plugin`, `installed_plugins.json`, `plugins/synced/`, marketplace clones.
  - `avatar.ts`, `art/default.ts`: the `default` voice is Claude Code's mascot.
  - `sprite.ts`: theme names from `/config`.
  - `carrying.ts`, `sessions.ts`, `Kernel.Sessions`: the handoff exists because Claude Code moves a conversation into another process; `isTerminal` and the surface count are Claude Code's.
  - `questions.ts`: the shape of Claude Code's question dialog (2–4 options, a header chip, a typed answer).
- Checks before new work lands: a new file goes in `plugin/core/` only if another client could run it unchanged with its own ports (walking the element tree, reading event words, naming commands or tools is the adapter's). Port and field names say what the core needs, not who provides it (`host`, not `claudeCode`; `surfaces`, not `$.session.surfaces`). Core comments may explain in Claude Code's terms; code may not depend on it beyond the ports. A Claude Code assumption the core must carry goes in the list above, same commit.
- Not shared, by nature: `prompt.compose`, `prompt.context`, `prompt.submit`, the edit guard's hook, tool and command registration, `$.state` atoms, `/config`, update and uninstall.

### Kernel (summary; detail in `kernel.md`)

- New decision logic is written in PureScript (`kernel/src/Kernel/*.purs`): types carry the rules, a state that cannot happen cannot be built. TypeScript is the shell (effects), the pane, the engines with ports, text and JSON parsing, and the membrane `core.ts`. Claude Code reads `on(...)` and `$` from TypeScript source, so those cannot move.
- Modules: `Health`, `Play`, `Pace`, `Sensor`, `Lease`, `Queue`, `Store`, `Status`, `Schedule` (ported, each after a parity run), and `Growth`, `License`, `Sessions`, `Ledger` (born there).
- `plugin/core/kernel.js` is committed and never edited by hand; `npm run build:kernel` makes it, `npm run kernel` checks it.

### Mode

- `/backseat` returns at once (line ~190 ms, pane ~250 ms). `switchTo` awaits only loading the contract, setting the mode and opening the pane (the contract must be in force from the next prompt). Everything else (watcher, profiles, reviewer, tools, questions, survey, update check) runs in un-awaited `engage`, which also does not wait for `registerTools` (`$.tool.register` resolves once connected, or after 8 s). `engagement` counts switches, and every step of `engage` and `startWatching` re-checks it after each await, so switching off mid-setup leaves nothing running.
- Modes: `off | on | paused`, stored twice. `$.state` survives a module reload (including a `/config` change) but is reset by `/clear`, `/resume`, `/branch`; a module variable survives those but not a reload. `session.start` restores the variable from state; `classic.SessionStart` (source `clear|resume|fork`) writes it back. Result: on survives both; every new session starts off.
- The pane survives `/clear` and `/resume`: `session.end` (reason `clear` or `resume`) fires before `$.state` is emptied, and `carryPane` reads the pane's atoms into the module (well inside the hook's 1.5 s); `restorePane`, from `classic.SessionStart`, writes them back: tab, notes, dismissed notes, review, profiles, Explain, Progress, status line, the character's line, the open list, whether keys act on a note or an issue. After `/branch` (`fork`), what can be worked out is recomputed and the notes and review come back from the project folder (`restorePaneFromDisk`; `followProject` in a session that does not drive).

### Tutor mode (while `on` or `paused`)

- `prompt.compose` removes Claude Code's `doing_tasks` section and appends a last, session-scoped section `backseat-driver:contract`: contract, `SESSION_NOTES`, person text (profiles + progress), engineering persona, voice. Prompt section ids: `intro, system, doing_tasks, actions, tools, tone`, then session-scoped ones such as `memory`. A lean prompt has `lean_body` and no `doing_tasks`; the code handles both.
- `prompt.context` rewrites the `claudeMd` block's opening ("These instructions OVERRIDE…") so the project's instructions stay in force except where they say to write code. The block also holds the user's global instructions: reframe, never drop. A mode switch calls `$.ui.invalidate('prompt.context')`.
- `prompt.submit` attaches the open notes, the latest review, the character's last line and the journal brief.
- `tool.call` on `Edit|Write|NotebookEdit` denies unless the path is Claude Code's own (`~/.claude/`, `/tmp/claude-<uid>/`), so the tutor can still save memories.
- Pane buttons send questions with `$.prompt.submit` (`submitForPerson`). The same question is not sent again before the turn answering it ends (`unanswered`, cleared at the main thread's `turn.complete` once the prompt's turn started; `ASK_AGAIN_MS` 5 min bounds it); a toast says it is on its way (`ALREADY_ASKED`).
- The contract's "Decision points are theirs" and "Insights" sections are the conversation's half: name a decision as the user's with trade-offs and step back; offer a `★ Insight` line and two or three bullets about this code when explaining, not in every reply.
- Verified live: told to "add a median function" in a repo whose CLAUDE.md says to edit files, the tutor declined, hinted, used that file's conventions; ordered to use Edit, it refused without calling it.

## Invariants

- Dormant until switched on. While off, every hook passes through with `next(e)`: no pane, model call, prompt change or denial. No reads or writes at session start. Only `/backseat forget`, `help`, `debug`, `license` (and update or uninstall when asked) act while off. The debug log is written only while on. One exception to the reads: a process that starts by forking or resuming a conversation reads `sessions.json` once, and the tutor comes up when that conversation had it on a moment ago. A session started afresh reads nothing.
- Background reviews never become conversation turns. Only what the user does in chat or the pane does. Verified live for `$.model.complete` and `$.agent.spawn`.
- Model and effort per job come from `userConfig`; no model id is pinned (aliases only). Defaults: play-by-play `sonnet`/`medium`, deep review `opus`/`high`, Explain `sonnet`/`low`. "Thinking level" = Claude Code effort (`low|medium|high|xhigh|max`).
- Hard rules are hooks; teaching style is the contract. The edit guard covers only `Edit`, `Write`, `NotebookEdit`; a shell command could still write, which rests on the contract and Claude Code's permission prompts.
- Footprint (the paragraph closing the README's "What it is" states it):
  - Runs `git`, reads the repo and its own plugin folder, calls models, writes only its data folder, draws a pane. One git repository it runs git in is its own: `locks.git` in the data folder.
  - Asks Claude Code about the session itself, reading and writing nothing: `$.session.surfaces`, `$.session.cwd`, `$.session.usage`.
  - Changes Claude Code's settings only when the person picks a value in the Settings tab, through `$.config.set`, as `/config` would.
  - Other processes only on request: `rm` inside the data folder (forget, `/backseat debug clear`), `claude plugin` (update, uninstall), the person's own `editor_command` on a click (no shell; 10 s timeout). The one exception, approved by the owner: `inotifywait`, while on, when on PATH.
  - The debug log, when switched on, holds their code and prompts. It stays in the data folder.
  - Network of its own: the release check (`git ls-remote`, at most every 6 h, opt-out), `/backseat update`'s fetch, and the license check (`$.http.fetch`, only with a commercial key and a `LICENSE_SERVER`, about weekly, only the key's id, off with `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`). `LICENSE_SERVER` is '' until deployed.
  - No git hooks, never writes the working tree.
  - Any new kind of call in the validator's `calls:` (`http.fetch`, a write outside the data folder, another process) needs the owner's decision and a README update.
  - `env reads:` must stay `BACKSEAT_DRIVER_HOME, CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC, CLAUDE_CONFIG_DIR, HOME, USERPROFILE, XDG_DATA_HOME`.

## Mod API (early access; last verified 2.1.293; mods need 2.1.287+)

The authority is `plugin/.claude-plugin/types/claude-code/index.d.ts`, above memory and docs; grep it. Load the `plugin-authoring` skill before writing hooks.

- No Node, no DOM, no `import()`. Everything external goes through `$`. Present: `Date` (local zone), `Intl`, `Math.random`, `setTimeout`, `setInterval`, `AbortController`, `crypto` (`crypto.subtle` is `digest` only: hence the BigInt ECDSA in `licensekey.ts`), `structuredClone`, `BigInt`. Absent: `queueMicrotask`, `process`, `fetch`, `WeakRef`. Use `$.clock.now()`, not `Date.now()`: tests move that clock (the debug log's `t` is the exception, on purpose).
- A hooks module may import from a sibling folder of `hooks/` inside the plugin (`../core/x`). Compiled PureScript bundled to one ES module loads, validates and runs under `claude plugin test`.
- State a drawing reads lives in `$.state`; module variables are lost on reload. A `ui.render` hook reads state but can't write it.
- `/clear`, `/resume`, `/branch` reset `$.state` without `session.start`; `classic.SessionStart` fires instead.
- A pane opened by the user's command places at any width; one opened unprompted waits for 144 columns (110 for a pane the person opened before); `$.ui.open` then answers `{ isPlaced: false, reason }`: open, not drawn.
- `prompt.compose` is uncached and can't be invalidated (runs every render). `prompt.context`, `prompt.section`, `tool.describe` are cached until `$.ui.invalidate` names them.
- `$.model.complete` takes `effort`; `$.agent.spawn` takes `model`, no effort, and the mod's own `turn.step`/`tool.call` hooks don't see its subagents. `$.model.complete(req, { signal })`: an abort resolves, it doesn't reject. `timeoutMs` elapsed resolves `{ reason: 'aborted' }`. An unknown model resolves `{ reason: 'api-error', status: 404, error: 'model_not_found' }`. Its `prompt` is a string or `ModelTextBlock`s (2.1.292); the mod sends strings, the kit records one string (`promptText`).
- 2.1.293 made `ToolSpec.isDeferred` optional, so a `tool.register` stub's event is no `Required<ToolSpec>`: the kit casts it.
- A mod's tool is served by answering `tool.call` without `next`; no permission prompt. Declare inputs under `McpToolInputs` in `plugin/types/index.d.ts`, or matchers won't type-check. A no-input tool is `Record<never, never>` (with `Record<string, never>`, `$.tool.call({ tool })` fails).
- `update($, atom, fn)` gives a misleading "Atom<…> is not assignable to StateRef" when `fn` returns literal-union fields. Annotate: `(w): Watch => ({ ...w, state: 'looking' })`.
- `userConfig` `options` pickers work on string fields only. A stored value outside the options reads as the default, with a warning (in tests too). A `/config` change reloads the mod with new options. A plugin field's `/config` row is keyed `<name>.<field>` and owned (`provider.plugin`) by `<name>@<marketplace>` (`@inline` for `--plugin-dir`). For the working copy, values go to `~/.claude/settings.json` `pluginConfigs["backseat-driver@inline"]`: restore the owner's settings after a check.
- `$.config.list()` returns every row (`key`, `kind`, `value`, `options`, `provider`, `isLocked`); `$.config.set({ key, value })` changes one as the menu would, resolving `{ value }` or `{ deny }`. A mod cannot add a row, button or shortcut to `/config`: `config.describe` only relabels, re-describes or hides. `Select` is missing from one surface's element table (`Kit` takes it as optional).
- `$.ui.ask`: one question, 2–4 options plus free text. Rejects on dismiss and under `claude -p`. In tests it reaches the `tool.call` stub as `AskUserQuestion`.
- `$.store`: 4 MiB total, per install, expires (unused).
- `$.fs`: `read` (≤4 MiB), `write` (makes folders; truncates in place, not atomic), `list` (returns `{ name, kind, size, mtimeMs }`: one call stamps a folder), `exists`, `stat`, `ancestors`. No delete or rename. `list`/`read` reject on missing. Absolute paths outside the project work without a prompt. Timings: write 2–15 ms, stat 1–2 ms, list 3 ms.
- `$.process.run` keeps the first 4 MiB of stdout and says so (`isStdoutTruncated`, `isStderrTruncated`). With no `cwd` it runs where the process started, which is not `$.session.cwd()` when the session is elsewhere: hand it the session's directory. ~10 ms per small git call.
- `$.env.get` takes a string literal; the validator lists the names.
- A hook gets 10 s of its own time per dispatch. Time inside `$` calls doesn't count, except `$.clock.sleep` and awaited plain promises. `session.end`'s `next.budget` was ~1.5 s.
- A mod's `$` calls go through other plugins' hooks, never its own. `$.prompt.submit` bypasses its own `prompt.submit` hook: put needed context in the text or a tool. Its own `$.ui.toast` goes through its own `ui.toast` hook; its own `$.ui.log` does not go through `ui.log`. `ui.close`'s `e.origin` is `{ kind: 'person' | 'plugin' | 'unload' }`.
- `$.clock.after` is one-shot (fires 15–80 ms late; `cancel()` holds); `$.clock.every` repeats. A reload cancels all timers.
- Hooks for events raised together run interleaved: the first to await lets the next start. `classic.StopFailure` and `turn.complete` for a dead subagent arrive that way, so what one hook's awaited work establishes is not yet true in the other: hand the other the promise (`reviewFailureNoted`), or set what it needs before the first await.
- `session.measure` fires around main-thread turns (not after a `$.model.complete` alone), with `rateLimits` (`kind`, `percentUsed`, `resetsAt`). `$.session.usage()` is free and holds the same figures.
- `$.agent.spawn` resolves in ~130 ms with `{ model, agentId }`. `$.agent.list()` rows: `{ id, description, type, status, spawnedBy }`, status `running | completed | failed`; a finished row drops out later. A subagent dying on an API error raises `turn.complete` (`reason: 'error'`, empty answer; ~16 s for a missing model, ~170 s offline after 11 retries, word `server_error`) and at the same moment `classic.StopFailure` with the error kind and `agent_id`.
- `classic.FileChanged` reaches a function hook only for paths returned as `watchPaths` from `classic.SessionStart` (the only event that takes the list), so nothing can start a watch mid-session. Files, missing files and folders (direct children only); events `add | change | unlink` ~570 ms after the write. Not used.
- `$.session.send({ to: { sessionId }, text })` between local sessions arrives in under a second; the receiver's `session.receive` sees `origin: { kind: 'peer', plugin }` and the text inside a `<cross-session-message …>` envelope (match with `includes`); `{ consumed }` keeps it out of the conversation. Not used.
- git as a lock in a bare repository: `update-ref <ref> <new> <40 zeros>` creates only when absent (exit 128 when held), `update-ref -d <ref> <holder>` deletes only on a match, `update-ref <ref> <new> <old>` steals. 40 racing processes: one winner.
- Background (2.1.289): a left arrow on an empty prompt (also mid-answer) or `/background` continues the conversation as a fork in a daemon process (`claude daemon run`, a `bg-pty-host` per session): `session.start`, then `classic.SessionStart` `source: 'fork'`, new session id, `$.session.usage().startedAt` the parent's, `$.state` empty, no pane; `$.session.surfaces()` is `['terminal']` attached or not. The parent after a left arrow gets no `session.end` (mid-answer: `turn.complete` `aborted`); then `surfaces()` is `[]`, `$.session.messages()` rejects, `$.ui.panes()` still lists the pane, timers fire, no `ui.render`. After `/background` the parent gets `session.end` `prompt_input_exit` and exits before the fork starts. A background session's flags are in `~/.claude/daemon/roster.json`, its environment the daemon's (a `--settings` `env` block travels). `claude agents --json` lists every session (`pid`, `sessionId`, `kind`, `cwd`, `status`, short `id`); `claude logs <id>`, `attach`, `stop`, `rm`. The daemon retires a background session idle for an hour.
- `dimColor` plus `color` on `Text` renders theme gray. `color` takes a theme key (`claude` = orange) or a terminal color. `Text` takes no `key` (keys go on `Button`, `Input`, `Select`, `Markdown`); find text via `ui.find({ type: 'Text', text })`.
- State-driven redraws and `$.ui.invalidate` are capped at 30/s in the terminal.
- `e.props.isFocused` in a pane's `ui.render` says whether it has the keyboard; hotkeys are dead until then. `e.props.scroll` (`offset`, 0 at top; `bodyRows`) is the pane's window. The engine keeps the offset across a change of what the hook draws. `$.ui.scroll({ in: '<pane id>', to: 'start' | 'end' | { key } , block })` moves it, answering `{}` or `{ deny }`, and raises `ui.scroll` (origin `plugin`; the person's wheel and keys: `person`, with `offset`, `by`). The kit has no stub for `$.ui.scroll` or `$.ui.focus`.
- Keys in a focused `Pane` (2.1.293): Tab and Shift+Tab move the focus ring (`ui.focus`, origin `person`). Up/down arrows scroll a row while there are rows to scroll, and move the ring when not; PgUp/PgDn a page, Home/End the ends. A `ui.focus` hook answering `{}` without `next` keeps the ring put (Tab does nothing). A click (SGR mouse report, `tmux send-keys -l $'\e[<0;x;yM'` and release) presses the Button and raises no `ui.focus`. `$.ui.focus({ requestId, key })` moves the ring (the mod's own hook doesn't see it), drawn in reverse video; Enter presses it. Tab, arrows and a click are all `origin.kind: 'person'`. `$.ui.open({ id, focus: true })` on an open pane takes the keyboard when the prompt has it over an empty composer.
- Claude Code's own tmux hints (`tmux detected · scroll with PgUp/PgDn …`, `tmux focus-events off …`) print at its start while tmux's `mouse` (or `focus-events`) is off; they never reach the mod's hooks. Both options on in `~/.tmux.conf` silence them. `dev-session.sh`'s `env -i` drops `TMUX`, so it never shows them.

## References

Claude Code docs: mods overview, reference, events and API (`code.claude.com/docs/en/plugins/mods/*`); plugins (`/plugins/components`, `/plugins/manifest-reference`, `/plugins/create-marketplace`, `/plugins/host-marketplace`, `/plugins/loading`, `/plugins/publish`); memory and `.claude/rules` (`/memory`). Directory: `claude.com/docs/plugins/submit`, `/plugins/pre-submission-checklist`. Related: Anthropic's `learning-output-style` plugin (Claude writes most and leaves pieces for the user; this project leaves all of it to the user).
