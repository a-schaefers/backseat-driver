---
paths:
  - "plugin/core/carrying.ts"
  - "plugin/core/sessions.ts"
  - "plugin/core/leasing.ts"
  - "plugin/core/lease.ts"
  - "plugin/core/journaling.ts"
  - "plugin/core/recorder.ts"
  - "plugin/core/journal.ts"
  - "plugin/core/glance.ts"
  - "plugin/core/working.ts"
  - "plugin/core/attention.ts"
  - "kernel/src/Kernel/Sessions.purs"
  - "kernel/src/Kernel/Lease.purs"
  - "plugin/tests/carrying.test.ts"
  - "plugin/tests/handoff.test.ts"
  - "plugin/tests/sessions.test.ts"
  - "plugin/tests/lease.test.ts"
  - "plugin/tests/leasing.test.ts"
  - "plugin/tests/sharing.test.ts"
  - "plugin/tests/journal.test.ts"
  - "plugin/tests/journaling.test.ts"
  - "plugin/tests/keeping.test.ts"
---

# Sessions: handoff, several sessions, journal

## Handoff (a conversation moved into another process)

- Claude Code (CLAUDE.md "Probed live", 2026-10-05): a left arrow on an empty prompt (mid-answer too) or `/background` continues the conversation as a fork in a new daemon process: new session id, mod freshly loaded and off. The process left after a left arrow is told nothing (mid-answer: `turn.complete` `aborted`); its timers run, `$.session.surfaces()` is `[]`, `$.ui.panes()` still says shown. After `/background` it gets `session.end` (`prompt_input_exit`) and exits before the fork starts. Without the handoff the tutor stayed on unseen there, driving and paying, and was off on screen.
- `sessions.json`: each session with the tutor on says `{ session, born, cwd, mode, at, leftAt }`; `born` = `$.session.usage().startedAt` (shared by fork/resume, reset by `/clear`).
  - `sayOn`: at `engage`, pause, resume, after `/clear` (takes back the old id's entry), every `SAY_EVERY_MS` (5 min). `sayLeft`: `session.end` (not `clear`/`resume`), standing down. `sayOff`: switch-off. All via the store, locked.
  - Entries nobody stood behind for a day are dropped at the next write; `left` marks before it drops (a goodbye after a night asleep was otherwise lost).
- `carryOn`: on `classic.SessionStart` `fork`/`resume` with the tutor off; one read. `carriedFrom` (kernel): same `born` and `cwd`, on or paused, still saying so (`ALIVE_MS`, 11 min) or goodbye within `HANDOFF_MS` (60 s); of several, the latest.
  - `comeUp`: `switchTo(mode, { carriedFrom })`, `engage` with `isFresh` false and `takesUp` the left session (no questions, survey, hello). `leaseState.holder` set before `keepLease`, so the lease is claimed at once (`claimed`'s `also`); pane takes up notes and last review from disk. One line, `CARRIED_ON`.
  - Its `sayOn` takes back the carried entry (`saidAs`): one tutor per conversation; off there is off for the conversation.
- Pane opens unasked; drawn from 110 columns (144 if never opened). Under that: open, not drawn; `openPane` keeps `shown.opened`, says `PANE_WAITS` once; `/backseat` draws it.
- `checkSelf` (deadline `self`, `SELF_CHECK_MS` 10 s, while on): re-arms first with the fired time (`run(now)`, so a quiet state lists `self`), then `checkBound`, `sayOn` when due, `followDebug` (`data.md`, Debug log).
  - `checkBound`: a session begun in a terminal (`session.start`'s `surface`) finding no surface twice, `RECHECK_MS` (2 s) apart (`boundOf`), says goodbye and `standDown`s (`switchTo('off', { isStandingDown })`): lease back, all stops, entry kept marked gone.
  - A main-thread `turn.complete` that is no answer runs `checkBound` at once (2 s, not 12). A headless session is never taken to be gone.
- Not carried: another directory (background worktree), another data folder (daemon env). Two processes under one id (`--resume` of an open session) are not told apart, here or by the lease.
- Verified: live (left arrow idle and mid-answer, `/background`: up in 1 s, lease held, old process down in 0–11 s). Not seen: paused carried, a waiting pane, non-terminal surface. `sessions.test.ts` is a property test against a model.

## Several sessions

- One session drives a project (`lease.ts`, `projects/<id>/lease.json` `{ session, at }`): looks, reviews, assesses, keeps the journal, writes `view.json`. Renews every `LEASE_BEAT_MS` (20 s); `LEASE_TTL_MS` (60 s) unrenewed = free.
  - `keepLease`: in `engage` after `startWatching` (needs the repo), on deadline `lease`, after `/clear`. Reads first; a waiter takes no lock while held. Claim/renew via `updateJson` under the store's lock: of two racers one wins.
  - `isDriver` gates `planScan`, `scan`, `look`, `planReview`, `reviewSince`, `maybeSurvey`, `planTimedReview`, `placeFirst`, `startJournal`, the `view.json` write, Explain's `mode` port (`on request`). True with no lease to hold (no repo, no data folder).
- A non-driver is for the conversation (contract, tools, lookup on request, contested point). No journal of its own: `w`, `/backseat working`, the `working` tool write into `journal.json` (`sayWorking`, locked; driver merges, later wins); brief and `activity` glance read from it (`storedSeen`, no diffs).
  - Status: "Another session is driving this project. This one is for the conversation." (`Play` `following`). No `l: look now` or `r: review now` drawn; one dim line under the controls says where looks and reviews run and when that session started (`followingLine` in `pane.tsx`, `Watch.driver` from `showDriver`: `lease.json` vs `sessions.json`, with its day when not today's). A look or review asked for anyway gets the toast `FOLLOWING`.
  - No scan. Each beat (`followDriver`, from `keepLease`): `refreshShared`, `readFocus` (light), `followProject`. A followed file (`FOLLOWED_FILES`: `notes.json`, `reviews.json`, `queue.json`, `journal.json`, `findings.json`) changed in size/time (`followedStamps`) is reread; the pane shows the driver's open notes (still true, less dismissed here), last review and history (new ones get `(new)`, the toast, the character's line), commits waiting, working-on (`showStoredWorking`, recomputed each beat: the editor-time window moves). Taken up at switch-on and after `/branch`. ("Chat only" rejected 2026-10-06: an empty Deep review tab read as a broken cache.)
- Takeover (`startDriving`): a waiter looks again a beat later or at lease expiry if sooner (+ up to `LEASE_SLACK_MS`). Tree as it stands = baseline. Runs `engage` again (not fresh, `takesUp` ''), never only the watcher: `stopWatching` clears every deadline, the lease's own too.
- Giving way (`stopDriving`): a driver finding the lease another's stops scanning/reviewing, writes its journal out.
- Lease given back at switch-off and `session.end` except `clear`/`resume`. `/clear` gives a new id (no `session.start`); `LeaseState.holder` is the held id, and `claimed(lease, me, now, also)` treats it as this session.
- Shared record (profiles, progress, lessons, all projects): `refreshShared` lists the two folders (`sharedFolders`) and lesson folders in play (`lessonsPrint`); on change rereads them (`loadLessons`), drops open notes on a topic hushed elsewhere, re-registers the reviewer. Before every prompt, and in the driver's scan at most every `SHARED_CHECK_MS` (5 s). It also rereads `findings.json` on change; any session may dismiss or restore an issue.
- `view.json` writer: only the driver of the project the caret is in (`refreshView`: `isDriver` and caret here, or no editor).
- Not yet: two sessions both ask first-run questions if switched on before either is answered.
- Verified: live (follower ran no `git status`; one reviewer per commit; `kill -9` driver, takeover 61 s after last renewal; a hush crossed projects; non-driver showed reviews at reload). Tests only (`lease.test.ts`): giving way after sleep, `/clear` while driving, hush-elsewhere note removal, review/dismiss/`w`/`/branch` in a non-driver.

## Journal

- `projects/<id>/journal.json`; engine `recorder.ts` (ports). `startJournal` in `engage`, fed by `keepJournal` each scan and by `pollFocus`, dropped at switch-off. Paths, line numbers, definition names, commit titles, statements; never code.
- Saves: changed files diffed against the last save's text, else HEAD if clean, else switch-on text (pre-existing work is no save). A `save` holds counts, merged line runs, touched definitions (`enclosing.ts`). One file's saves under 2 min apart are one run, until a commit or HEAD move. Other entries: commits, HEAD moves, notes raised/fixed, dismissals, reviews, switch-on, working-on. Last 3 files' diffs kept for `activity`.
- Attention (`attention.ts`): summed from timestamps, never poll counts. Each editor report closes the stretch before it, crediting the caret's line and `visible` files while the editor wrote within `LINGER_MS` (2 min) and isn't `active: false`. `tick(now)` brings it to now.
  - A stretch over `MAX_GAP_MS` (60 s) without a clock look is not credited (sleep, pause).
  - Every `SLICE_MS` (2 min): `focus` entries, up to 3 regions per file plus remainder (lines within 20 inside one definition, named for the line held longest); visible files get `screen`. Definition name resolved next scan.
  - Editor state from before switch-on is baseline until it changes.
- Sittings: an hour idle ends one; finished ones roll up on every read/write (`digest`: files, commit titles, statements); last 20 kept; one with no save, no commit, under 1 min editor time leaves nothing.
- Writes: at most every 30 s when new; at once on a working-on statement; switch-off; `session.end`. The recorder's `wakeAt` sets deadline `journal` (`journalDue`); scans don't ask.
  - Every write rereads and merges (`sync`): unseen entries are another session's, kept; seen-but-gone ones dropped. The driver also `resync`s without writing (`resyncJournal`, on size/time change at the shared-files look), so a non-driver's statement reaches an idle driver. Working-on: later wins, ties to this session. Entries pass `parseEntry` (canonical JSON).
- Readers: `glanceText` (first in every play-by-play prompt, last in every deep review request): said; inferred while it `holds` (under 1 h and activity still touches its files); last 10 min by file (save = 1 editor-minute, beside-time ¼); caret; this sitting (max 14 lines); previous sitting. `briefText` with every typed prompt. `activity`: glance plus latest diffs.
- Working on:
  - Reply's `working_on` stored `inferred` with its paths; a non-commit HEAD move clears it.
  - Pane: said, else inferred while it holds, else `workingOf`; hidden outside a repo. Under it the caret time ("7 s in the editor in the last 10 minutes", `shareWords`) or saves; never a percentage of the window.
  - `w` / bare `/backseat working`: two answers plus free text, Enter = first, which loses nothing (`workingChoices`). Set via `/backseat working <words>`, the `working` tool, typed answer; take back via "Let the tutor work it out", `/backseat working clear`, or the tool with ''. A tool call without `on` records nothing.
- `/backseat forget project` deletes the folder; `recorder.reset()` stops a write restoring it.
- Verified: live (first write 30.0 s after switch-on; `/exit` 5 s after a save kept it; script-as-editor inference and reload). Tests only: roll-up, two sessions sharing, reviewer reading it.
