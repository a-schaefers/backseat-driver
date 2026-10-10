---
paths:
  - "scripts/jack.py"
  - "scripts/test_jack.py"
  - "scripts/dev-session.sh"
  - "scripts/outage-proxy.py"
  - "scripts/debug-tail.sh"
  - "plugin/hooks/shown.ts"
  - ".claude/skills/**"
---

# Jack in and live checks

History (every ui-truth pass, dated, with its findings): `.claude/history.md`, "Jack in" and "Live checks".

## Live checks (tests stub everything; a milestone is done only when seen live)

- `scripts/dev-session.sh` starts tmux in a throwaway git repo with `BACKSEAT_DRIVER_HOME` pointed at a scratch folder (`BSD_DATA_DIR`).
- With parallel sessions, set your own `BSD_SESSION`, `BSD_RIDE_DIR` and `BSD_DATA_DIR`, and use that session name in every tmux command: on the shared default name two sessions killed and typed into each other's.
- `scripts/jack.py` is how a live check is read: `screen`, `truth`, `log`, `model`, `watch` (below, and the `jack-in` skill). `scripts/jack.py keys <tmux name> /backseat Enter` types with the pauses that keep the Enter. A check is done when `truth` passes on the session and its `screen` has been read.
- The owner's `claude` is a `~/.bashrc` function loading the live copy (`local/live/plugin`, see `sync`); scripts call the binary. A session of theirs on in this repository takes every save made here, yours included, as theirs (looks, Explain maps). If a marketplace copy is installed again, a working-copy session must switch it off: `--settings '{"enabledPlugins":{"backseat-driver@backseat-driver":false}}'`.
- A backgrounded session runs under the daemon's environment with the session's flags, so `dev-session.sh` also puts `BACKSEAT_DRIVER_HOME` into `--settings`'s `env` (merging a JSON `--settings`); else the owner's real data folder is used.
- A left arrow on an empty prompt sends the conversation to the background, at once and mid-answer too; Esc or Enter in the agent view opens it again. `/background` needs one message first ("Nothing to background yet").
- After a check: `claude agents --json`, then `claude stop <id>`, `claude rm <id>` for yours only (the owner's are in the same list).
- `cut -c` counts bytes, so a row with box-drawing characters is cut short. Read a screen with `scripts/jack.py screen`.
- In a cloud container, a `claude` started under the container's own session takes that session's id (log folder, lease, `sessions.json` then name the wrong session). Start the dev session with `env -u CLAUDE_CODE_SESSION_ID -u CLAUDE_CODE_REMOTE_SESSION_ID -u CLAUDE_CODE_CHILD_SESSION -u CLAUDE_PID -u CLAUDE_CODE_SYNC_SESSION_REFS -u CLAUDE_CODE_PROJECTS_SESSION`.
- A cloud container can run a real session: `claude -p` and an interactive `claude` in tmux are logged in through the environment if it is kept (not `dev-session.sh`'s `env -i`) and onboarding is skipped: own `CLAUDE_CONFIG_DIR` holding a `.claude.json` with `hasCompletedOnboarding: true`, `theme`, the account fields (`userID`, `oauthAccount`) copied from `~/.claude.json`, and `projects.<ride>.hasTrustDialogAccepted: true`, plus a `settings.json` for `pluginConfigs["backseat-driver@inline"]` (cheap models). Claude Code is not on `env -i`'s PATH there (`/opt/node22/bin`).
- Drive: `tmux send-keys -t bsd '/backseat'`, wait a second, then `tmux send-keys -t bsd Enter` separately (sent together, or 0.4 s apart, Enter is often swallowed). Check the prompt box is empty afterwards. Read with `tmux capture-pane -p -t bsd` after a moment.
- `BSD_DEBUG=1` switches the tutor's debug log on in that session's data folder and passes `--debug-file`, so Claude Code's own log lands beside it (`debug/claude-code.log`, with a `latest` link). Follow it with `scripts/debug-tail.sh -d "$BSD_DATA_DIR"`.
- A new folder shows the trust prompt first: `Down`, `Enter`. Keys sent before startup finishes are lost.
- Keep the throwaway repo path plain: with long dashed paths the model mistyped them and hit permission prompts.
- `C-x Tab` focuses the pane (hotkeys work then), `Escape` unfocuses.
- At 170 columns the pane docks beside the conversation: read it with `cut -c1-94` (conversation) and `cut -c95-` (pane). tmux gets the main-screen layout (pane inline above the prompt) unless `BSD_FULLSCREEN=1`.
- Settings: `--settings '{"pluginConfigs":{"backseat-driver":{"options":{"deep_review_model":"sonnet"}}}}'`. Keep deep-review checks cheap this way.
- Real model calls are on the owner's plan: short prompts, `--model sonnet` unless needed otherwise.
- The owner's default permission mode is bypass. Pass `--permission-mode default` when the check involves Claude running tools.
- Saving under `plugin/` reloads a `plugin/` session (mode and pane come back, the pending look is dropped); idle, it polls every 30 s (`plugin-dir watch … idle, polling every 30000ms`). Don't save there mid-check unless the reload is the check. The owner's sessions are reached only by `scripts/jack.py sync`, once the change is whole and `npm run check` green. Never write into `local/live/` by hand.
- Outage: `scripts/outage-proxy.py <port>`; start the session with `--settings '{"env":{"HTTPS_PROXY":"http://127.0.0.1:<port>","NO_PROXY":"127.0.0.1,localhost"}}'`, kill the proxy for the outage, start it again to end it. Without `NO_PROXY` Claude Code cannot reach the mod's own tools (served on a loopback port): every `$.tool.register` waits out 8 s (64 s for the eight tools).
- With no connection, a `$.model.complete` fails within a second, and a subagent only after Claude Code's own 11 tries: 170 s.

## Jack in

For whoever develops Backseat Driver with the owner at the keyboard: `scripts/jack.py` (Python 3, standard library, dev side) and the skill `.claude/skills/jack-in/SKILL.md`. The owner says "jack in". The product decision behind it is in `CLAUDE.md`, Product.

- Three accounts of one session side by side. SAYS: the state the tutor writes beside its debug log (`state.json`, from `fullState` in `register.tsx`), and what it tells other sessions (`sessions.json`, `lease.json`). DID: the debug log. IS: what the tool reads from outside, the screen first. `!!` is a disagreement and where to look; `··` is a note (explained, the person's view, or a record).
- Rule: when the mod comes to believe something new about the screen or the world, it goes into `fullState`, gets a check in `scripts/jack.py` and a test in `scripts/test_jack.py`, in the same commit. A wrong `!!` is fixed in the check, never silenced.
- The tool duplicates tutor numbers (`LEASE_TTL_MS`, `SELF_CHECK_MS`, `ALIVE_MS`, `EDITOR_TTL_MS`) and the name `FOLLOWS_SWITCH` (`followSwitch` in `core/debugging.ts`); `test_jack.py` holds them to the source. Other tables are read out of the mod's source: hellos (`core/avatar.ts`), `PLACE_*` (`core/progress.ts`), `RETIRED_SETTINGS` (`core/settings.ts`), the vendored rules (`mod_tables`, `mod_own_files`), the two hashes of `hash.ts` ported (`source_print`, held to values computed under Node).

### Finding and seeing sessions

- `claude agents --json` lists every session of one config folder. The tool asks once per config folder in use (its own and each running `claude`'s `CLAUDE_CONFIG_DIR`, `config_dirs`); `claude logs` is asked under the folder its session belongs to. A session's data folder comes from its environment and the `env` of its `--settings`; a background session's flags are in `~/.claude/daemon/roster.json` (`dispatch.launch.flagArgs`), not its command line. `--plugin-dir` in the flags is a working copy, else the installed one.
- `names_a_session`: a session argument is the start of an id (running or gone), a background session's short id, or a tmux session's name; anything else is a part (`state <session> [path]`). Claude Code's rows carry no `id`/`short`.
- A session's log folder can name its first id (after `/clear`): find it by the id in its `state.json` (`debug_dir`).
- Eyes: tmux, `capture-pane` of the pane found by walking the session's parents up to a pane's process, on every socket in `/tmp/tmux-<uid>/` (exact). Background: `claude logs <id>` replayed into a scratch tmux server of the terminal's size (`TIOCGWINSZ` on its pty), then captured. Plain terminal: none; the tool says so and does not count the screen as checked.
- Replays remove their socket (tmux 3.6 keeps `/tmp/tmux-<uid>/bsd-jack-replay-<pid>` after `kill-server`), and every command sweeps those of runs that are gone.
- `plugin_copy`: which copy a session runs (a `--plugin-dir` folder, or the installed one through `installed_plugins.json`: folder, version, commit; `ps` says how many commits behind). A copy without `followSwitch` reads the debug switch only at switch-on and reload and writes no state before: the status table says `cannot say`, and its pane on screen is a `··` naming the copy and the two ways to start its log (`/backseat debug on` typed in, `/reload-plugins` while the switch is on), not a `!!`.

### Commands

- `in` writes `debug.json` (`{ on, since, by: 'jack', was }`) in every data folder in use and waits up to 22 s for each session with the tutor on to write its state. `out` undoes what `in` switched on. `--home <folder>` keeps both to one folder (a dev session's scratch folder, not the owner's).
- `status` checks the same sessions `truth` does, including one that says nothing (for a pane on its screen).
- `watch` follows: log records as written, the screen rows that changed (conversation and pane apart; spinners and running clocks left out), disagreements as they appear and go. Each `said` record is looked for until it shows (`ok … on screen 0.7s after it was said`) or should have (`!! … never showed on its screen`). One line each, for Monitor or a background shell.
- `tour` drives a tmux session as a person would and runs the checks after each step: `on` (Esc skips the questions), `tabs` (Ctrl+X Tab and each digit; `TAB_IDS` names the six), `status`, `save` (an average off by one, then the look), `commit` (and its review), `pause` (and resume), `off`. `--steps` picks some. Save and commit write only into a repository under the temp folder unless `--write`. Needs `in` first; makes real model calls. A step that disagrees prints the screen under it. Only a dev session, or when asked.
- `log`, `model` (a call word for word), `state [path]`, `files`, `ps`, `keys` (types into tmux: only when asked). A gone session is still read by id from its log.
- `bundle [S]`: one page per session with the tutor on, for a reader: screen, pieces last drawn, every pane atom tab by tab, the project folder (notes, reviews, queue, journal, lease), the person's record, editors' files, `sessions.json`, what the person was told lately (`said_lately`: the log's last ten minutes when the ring was lost), the session checks, then the data folder's (`check_homes`). The ledger by title and place, never an issue's quoted line. "provisional" only beside a level. Dates with their day (`day_clock`): audits, explanations, the copy a session runs (with its name).
- ui-truth (`.claude/skills/ui-truth/SKILL.md`): an agent reads `bundle` and judges the screen against state and cache as the owner would: at the start of a jack-in, after every `sync`, and hourly by a `CronCreate` in the jacked-in session (cron has no 45-minute period). Never in `npm run check` or CI. Cron firings wait while the session is busy and arrive together: one look answers them all.
- `sync`: the owner's sessions load `local/live/plugin` (`LIVE`); `sync` is its one writer. `live_diff` names files that differ from `plugin/` (tests, `node_modules`, Claude Code's types left out). It waits up to 90 s while a look, review, progress look or audit runs (`is_busy`, from the `watch`, `review`, `progress` atoms; `--now` skips), rsyncs with `--delete`, waits up to 50 s for each session on the live copy to show a newer `loaded.at` (and 3 s more), then runs the checks. `ps` says `live copy · N file(s) behind the working copy` or `as the working copy`. After a release, `sync` (an old live copy would announce the release). A dev session loads `plugin/` itself.

### Timing rules

- Screen and state are read a moment apart. A check finding something missing reads both again after `RECHECK_S` (1.2 s), up to `RECHECKS` (3) times, before `!!` (a lookup's badge flips fast while the caret moves).
- The caret check judges by `state.at` (when the belief was written), not now.
- A drawing recorded as `dock` while the terminal (`eyes.cols`) is under `DOCK_COLUMNS` (110) is the pane moving above the prompt: `··`, the next drawing is checked. A terminal wide enough for a dock that lacks the pane is `!!`.
- Watchers not matching the `inotifywait` processes within `WATCHERS_GRACE_MS` (5 s) of a reload are being restarted.
- Cache graces: `DRIVER_GRACE_MS` (5 s) for files the driver writes, `FOLLOW_GRACE_MS` (a lease beat + 5 s) for a session that does not drive, `SHARED_GRACE_MS` (15 s) for the shared record, `LEDGER_GRACE_MS` (40 s) for `findings.json`.

### Checks: the world and the data folder (`check_homes`, `check_world`)

- Lease held by a session not running, one that says it does not drive, or one drawing nowhere.
- A session that said it is on and is not running, with no goodbye; a running one that stopped saying so; a background session listed with no process (the daemon let it go): `··`.
- `state.json` older than 30 s with the log on: its timers do not run (a gone session read by id is a `··` record).
- Mode held twice and differing; on and not in `sessions.json`; on and drawing nowhere; no pane in Claude Code's list; a pane open and not drawn. A pane the person closed or minimized (`shown.minimized`) is `··`; the strip (`shown.band`) is then checked instead.
- A session on without the `self` deadline after `SELF_GRACE_MS`; any deadline over 15 s past its time.
- Live watchers vs `inotifywait` processes under it; the editors' light vs editors' files; `check_editor_roots`: an editor report without `root` for a file in a repository (`git rev-parse --show-toplevel`) is `··`.
- `check_marker`: the data folder's marker text.
- `error` records of the last ten minutes, and Claude Code's own log lines refusing something of the plugin's (`is_trouble`).
- `check_world`, each once the world had time to reach it: the code (a working copy's newest `plugin/` file, tests and types aside, newer than `loaded.at` and over 45 s old); the settings (`loaded.options` vs `pluginConfigs` in the config folder's `settings.json`, project `.claude/settings.json` and `settings.local.json`, then `--settings`; `@inline` for a working copy; managed settings not read); HEAD (`review.lastHead`) when `.git/logs/HEAD` changed before the last scan; the tree (`watcher.dirty`, `watcher.noise`) vs `git status` for files saved before the last scan; the queue in memory vs `queue.json`; the caret (the speaking editor's `changed` over 3 s after `explain.editorFocusAt`); the fast lane running for a caret past `EDITOR_LIVE_MS` with the tab closed, or in a session that does not drive.

### Checks: the screen

- Per session: `check_session` runs `check_session_once` up to `RECHECKS` times; the screen checks below are its.

- Pieces: each of `shown.pane.texts` (or the band's) is looked for by its first 28 characters (`HEAD_CHARS`; under `NARROW_COLUMNS` (40) by what a row holds, `piece_head`), frames and Markdown marks dropped on both sides (`demark`), spinner frames ignored (`despin`), in the whole screen and in each side of a docked pane (`flows`, `divider`). Only the first `HEAD_PIECES` (6: the tabs) make a `!!` alone.
- Top missing while lower pieces show: scrolled, `··` naming the pieces (`quoted_pieces`). First piece on screen and a later top piece not: cut off its row, `!!`.
- `squeezed_pieces`: a piece missing while a later one shows, searched in the pane's side in drawing order (a piece drawn twice never says how far down): `!!`. A pane cut at the bottom is `··`, naming the keys row only when it is cut.
- `check_keys_row`: "Keys off"/"Keys on" on screen must show the hint's end ("to use the keys.", "back to the prompt."), wrapped or not.
- `check_keys_walk`: two keys under one label; "j k move" with no `j: next` drawn; `j: next` with no row to walk (`shown.pane.rowKeys`); a `▸`/`▾` piece not among `shown.pane.rowLabels`; words sending the person to Tab (`TAB_WORDS`; "Ctrl+X Tab" allowed); "Review N of M" without `p: older` (N < M) or `n: newer` (N > 1): each `!!`. A ring on a row no longer drawn (`shown.pane.ring`) and a prompt holding only pane hotkeys while the pane lacks the keyboard (`prompt_text`) are `··`.
- `check_press_keyboard` (this load, from the log): a press with no keyboard that did not take it; a strip press that drew nothing.
- `check_strip_badges`: the strip's Play and Review badges vs state. A strip wider than its row: `··`.
- Scroll: a pane scrolled past its top since a tab was opened (`TAB_SETTLE_MS`), with no person's move since (`shown.pane.scroll`, `ui / scroll`): `!!`. `check_pick_kept_page`: the window before an outline pick vs after, with no scroll between: `!!`.
- `check_said`: each `said` from 1.5 s to 10 s old (a toast to 3.5 s) looked for by its first 24 characters; an open dialog's question. `check_said_twice`: the same prompt sent twice with no turn end between: `··`.
- `check_speech`: a hello not of the current voice; a line ending "…". `check_speech_kept`: the last line given the character in this load vs the one it says.
- Follower: light not `following`, or offers `look now`/`review now`; `check_following_words` (what it says of the driver's start and of the looks); its "Working on" time vs the journal as read, a beat's grace, no slack.
- `check_no_look_yet`: "No look yet" after a look since switch-on; "Nothing has changed since the last look" or "No notes. Keep going." under a null `look.lastLookAt`.
- `check_working_share`: a percentage of the window, or a time the journal's caret time cannot hold.
- `check_settings_tab`: the tab's keys vs the manifest's `userConfig` less `RETIRED_SETTINGS`.
- Dates: a review of another day drawn as today's on the open tab: `!!`.

### Checks: the cache (`check_cache`, every session on in a project)

- Deep review tab empty while `reviews.json` has reviews; history shorter than the file (the first look around counted); latest review not the file's latest (the survey excepted).
- A note the file keeps about an unchanged file, missing from the pane and not dismissed there; `check_notes_lines`: each open note's line at its line on disk (moved once elsewhere `··`, gone `!!`; a file saved since the last look is the next look's).
- What they said they are working on vs the journal's `said` (the driver only once it wrote after it); waiting commits as the tab counts them vs `queue.json` (a session that does not drive).
- The latest commit review must be assessed in a record, waiting, or named in the skip reason, else `!!`. HEAD, the person's own and over `HEAD_GRACE_MS` (20 min) old, with no review and no account: `!!`. The watched paths vs `git show --name-only` of the skipped commit (a file saved since it is watched for the next one).
- Patch size (`patch_size`) vs `OUTPUT_CAP` for the skipped commit whose numbers are not said as a floor, and each record's latest `ASSESSED_MEASURED` (5) assessed commits.
- Growth: the placed level vs `progress/<language>.json`; a provisional level under the bar; `check_progress_files` (under no level, a report written after the level the history last reached and before the withdrawal, or with none marked: `!!`; a level the history did not reach: `!!`; the unplaced report's praise: `··` on file, `!!` drawn); `lines_recount`/`added_nonblank` (`··` for an older recount, `!!` for one counted as the rules count); `check_growth_counts` (counts vs the records drawn); `check_growth_twice` (a subject twice in one list, `··`); `check_lately` (a commit no repository here has, `··`). A caret slice begun before the window and ended in it counts whole (`endOf`).
- Explain: `check_explain_fresh` (the cache entry `files/<fnv(path)>-<name>.json`'s fingerprint must be the file's `sourcePrint`); `check_explain_uses` (a section relying on a later one; a comments-only section relying on anything); `check_explain_voice` (first person, `··`); a doubt of a name the file sets elsewhere (`··`; names the nearest name before the doubt); an explanation older than the overview (`··`) or sending the reader to the notes (`!!`); one written before an issue shown under it (`··`); a spot the pane chose after the caret's last move shown as the editor's; the wording says whose the spot is and when the caret was followed.
- `check_explain_insights`: credited to a review the Deep review tab does not have (`··`), or to a review while the audit holds it; an insight nothing in the file is named by (`··`); a nameless insight its review named; a whole-file insight under a symbol without saying so; one quoting one part shown under another, or as whole-file under its own.
- `check_issues` (the ledger): open issues vs `findings.json`; on tab 2 nothing closed drawn as open (`drawn_issue_rows`), worst first and the reviewer's order within a severity, nothing above low left out, counts as drawn, what the audit read or that none ran (`check_audit_line`: its figures; their own files by the mod's count; its day; a path both read and skipped; an audit naming only its commit whose issues quote a line the commit lacks); under an empty Play-by-play tab the ledger's line (`ledger_line`, `LEDGER_LINE_STARTS`); the audit's reading vs `git ls-files`; a placed issue's line must read as the issue's once its file has been still a minute; on Play-by-play what it shows from the review must be open and every tracked issue shown while no more than `PLAY_PICKS`; "Raised while you worked" lists every open bug and risk note; Explain's issues open in that file; `o` on a project-wide issue; a bug or risk note on an open issue's line `··` until a review adopts it; a ledger with no version.
