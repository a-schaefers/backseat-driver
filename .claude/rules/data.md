---
paths:
  - "plugin/core/store.ts"
  - "plugin/core/locks.ts"
  - "plugin/core/datahome.ts"
  - "plugin/core/storage.ts"
  - "plugin/core/forget.ts"
  - "plugin/core/debuglog.ts"
  - "plugin/core/debugging.ts"
  - "kernel/src/Kernel/Store.purs"
  - "plugin/tests/store.test.ts"
  - "plugin/tests/locks.test.ts"
  - "plugin/tests/datahome.test.ts"
  - "plugin/tests/restart.test.ts"
  - "plugin/tests/debuglog.test.ts"
  - "plugin/tests/debugging.test.ts"
  - "plugin/tests/running-debug.test.ts"
  - "scripts/debug-tail.sh"
  - "scripts/jack.py"
---

# Data folder and debug log

## Data folder

`$BACKSEAT_DRIVER_HOME`, else `$XDG_DATA_HOME/backseat-driver`, else `~/.local/share/backseat-driver`. `datahome.ts` builds every path.

```text
.backseat-driver              marker; required before any delete
profiles/<language>.json      answers, hushes, lesson memory
progress/<language>.json      evidence, level, report
lessons/<language>/<id>.json  where they are in one learning path
projects/<name>-<hash>/       journal.json, project.json, reviews.json, notes.json, queue.json, lease.json, watched.json, findings.json, files/
editors/<editor>-<pid>.json   one per running editor (see "Editor protocol")
view.json                     written by the tutor
update.json                   last release check
license.json                  personal or commercial, the key, what the server last said
sessions.json                 the sessions the tutor is on in (see "Handoff")
debug.json                    the debug log's switch: {"on": true}
debug/<session>/              one session's debug log (see "Debug log")
locks.git/                    bare git repository; its refs are the locks on the files above
<file>.bak, <file>.broken     beside a profile or progress file: as it was before the last change; a copy that would not parse
```

- Not `$.store` (4 MiB cap, per install, expires; editors need a path); `moveOutOfStore` migrates old `subject/<x>` keys at switch-on, a file wins. Not SQLite (unloadable; `sqlite3` often missing).
- Raw I/O is `Disk` (`storage.ts`): four closures from `diskOf($)` over `$.fs` and `$.process`. No JSON file of the data folder is read or changed through it directly: that is the store, `storeOf($)`, one per load. Engines take `store: Pick<Store, 'read' | 'update'>`; tests use `plainStore(memoryDisk())`.
- Several sessions ("a seatbelt and suspenders"): `$.fs.write` empties then fills (not atomic), so readers can see it empty and two read-change-write cycles can undo each other. `store.ts` (decisions in `Kernel.Store`: `afterRead`, `changeStep`, `keepsBackup`, `afterWrite`):
  - Read: empty or unparseable is retried after `READ_RETRY_MS` (25 ms), `READ_TRIES` (3). Still broken: copied to `<file>.broken`, `<file>.bak` used if present. Never taken for "nothing there" (that reset a profile on the next write).
  - Change: `store.update(path, apply)`, typed `updateJson(store, path, parse, apply, { keepBackup })`. One change at a time per file per session (queue), under a cross-session lock, then read back; if it differs another session wrote, and the change is redone on top, up to `WRITE_TRIES` (4). `apply` may run more than once: pure. No write when nothing changed.
  - `keepBackup` writes the old file to `<file>.bak` first: profiles and progress, which nothing can rebuild.
  - Without the lock (held 2 s, or git unusable) the change still happens, with one extra check that the file did not change between read and write.
- The lock (`locks.ts`): `$.fs` has no create-if-absent, git does. Ref `refs/locks/<hash of path>-<file name>` in `locks.git`; take `git update-ref <ref> <mark> <zeros>`, give `update-ref -d <ref> <mark>` (holder only). The mark is a blob of the session id, so a lock with this session's mark (left before a reload) is taken at once.
  - Wait: 15 ms doubling to 250 ms with jitter, `LOCK_WAIT_MS` (2 s) total. `$.clock.sleep` counts against a hook's 10 s.
  - Older than `LOCK_TTL_MS` (30 s; a write holds ~15 ms): taken over with `update-ref <ref> <mine> <holder>`, one of two takers wins.
  - Given back between a refused try and the look at its holder: tried again at once. An unreadable ref file, once old, is rewritten with `$.fs.write`. A gone repository is made again.
- Every data-folder write is preceded by `markHome($)` (store disk and lock both): rewrites the marker when its text is not `MARKER_TEXT` (once per load).
- A failed read is not a missing file: `diskOf.read` answers null only for a missing file (error says so, or `$.fs.exists` false) and throws otherwise; `saveSubject`/`loadSubject` keep what is held and say so (`could not keep the profile`, `could not read the profile`). Kit: `session.unreadable` (`restart.test.ts`).
- Delete: `$.fs` has none; `Disk.remove` runs `rm -rf -- <path>`, guarded by `isRemovable` (only under `REMOVABLE` children, no `.`/`..`) and by the marker. A misdirected `BACKSEAT_DRIVER_HOME` loses nothing.
- `/backseat forget [project|<language>|everything]` (`forget.ts`; dialogs in `forget()`):
  - Every dialog has "Keep it" first (Enter keeps); only the exact "Forget it" proceeds. Everything also needs the typed phrase "forget everything". Returns at once; result is a `$.ui.log` line. Works while off.
  - A language also deletes its `.bak` and `.broken`. Everything also deletes `locks.git` and `sessions.json`.
  - A project also fences what is in flight: the running review's id and scope dropped (its answer is nobody's), watchdog cancelled, watched files and skip reason emptied, Explain's `reset()` bumps a generation that `commit` checks, so nothing writes the folder back. Code only, no kit test.
- Verified: live (2 sessions × 150 concurrent changes: 300/300 with the lock, 292–294 without; `.bak`, stale-lock takeover, migration, forget flows). Write 8–16 ms, read/list 3 ms, stat 1 ms, `rm` 5 ms.

## Debug log

For developing Backseat Driver, not for users: everything the tutor does, one log for all projects, never per project.

- Switch: `/backseat debug on | off | status | dump | clear` (no word = status), works while off. The switch is `debug.json`, holding across sessions; read at switch-on, on a reload, and every 10 s while on (`followSwitch`, in `checkSelf`), so another session's `/backseat debug` or `scripts/jack.py in` starts or stops the log untyped. Never read at session start. A log starting mid-session opens with `meta / before the log`: the ring.
- Folder `debug/<YYYYMMDD-HHMMSS>-<first 8 of session id>/` (UTC), kept across reloads and `/clear` (so it may name an id the session no longer has; jack finds it by the id in `state.json`, `debug_dir`):
  - `NNNNNN.jsonl`: `$.fs.write` can't append, so the open chunk is rewritten whole as it grows (at most every `FLUSH_MS`, 200 ms). Closes at `CHUNK_CHARS` (128 000), never touched again until `MAX_CHUNKS` (64) newer exist, then emptied (no delete), whether the newest came from a fill or a reload. A reload or off/on continues in a new chunk.
  - `state.json`: the whole state after the latest flush: `snapshot()` (watcher, look, review, timers, slowdown, focus) plus every pane atom, plus what jack checks: `at`; `session` (`selfState`: id, `born`, directory, surfaces, Claude Code's list of the plugin's panes, layout, plugin folder, last `sessions.json` word); `shown` (pane and band drawings via `textsOf`, the hint line's ending, `$.ui.open`'s last answer, last close and by whom); `said` (last twelve `{ at, how, text }` told outside the pane); `asking` (an open dialog's question); `loaded` (module load time and options); and `scan.lastScanAt`, `watcher.noise`, `explain.focusText`. While on it is rewritten every 10 s even if unchanged (`flushDebug`'s `isBeat`): quiet and stuck must differ.
  - `debug/dump-<stamp>-<session>.json`: `/backseat debug dump`, state plus ring.
- Record `{ t, seq, s, p, k, n, ms?, d? }`: `t` is `Date.now()` (free; `$.clock.now()` costs a dispatch and differs in the kit), session, project id, kind, name, duration, details. Strings over `MAX_STRING_CHARS` (400 000) cut.
- Kinds:
  - `meta` (started, stopped with why); `cmd` (every `/backseat`); `hook` (`session.start`, `classic.SessionStart`, `session.end`, `prompt.compose` when its addition changes, `prompt.context`, `prompt.submit` with attachments, main `turn.complete` with reason, `session.attach`/`detach`)
  - `git` (argv, exit, output, named by verb); `store` (broken file, restore, change without lock, another session's write); `fs` (`read`, `write`, `list`, `remove` in the data folder; `source` for a repo file, by size)
  - `model` (whole request and result, by job); `agent` (`register`, `spawn`, `finished`); `tool` (input and answer); `guard` (edit denied or let through)
  - `state`: `mode`, `watch`, `review`, `progress`, `working`, `speech`, `carried on`, `said on`, `said goodbye`, `said off`, `nowhere to draw`, `editors`
  - `watch` (`saved`, `head moved`); `look` (`start`, `done`, `nothing to look at`, `reply not understood`); `start` (`engaging`, `engaged` with duration); `timer`; `process` (`claude`); `explain`; `error` (with stack)
  - `ui`: every pane key; `pane opened` (`isPlaced`, reason), `pane closed` (`person`, `plugin`, `unload`), `answered`/`not answered`, `scroll` (offset, by, `person`/`plugin`; a wheel at the edge asking for its own offset is not logged), `scroll to top` (with the host's answer), `row step`, `ring` (with the host's answer), `ring kept` (a person's move refused), `pane refocused`
  - `shown`: a drawing (`pane` or `band`) once it stood `SHOWN_SETTLE_MS` (500 ms) and differs from the last logged (`isSameShown` treats spinner frames as one). A word-by-word line is a few records.
  - `said`: everything told outside pane and band: `toast`, `transcript`, `command` (with arguments), `asked` (question and options), `prompt` (sent in their name). Only through `toastPerson`, `tellPerson`, `askPerson`, `submitForPerson`, `noteSaid`; never a bare `$.ui.toast` or `$.ui.log`.
  - `heard`: other plugins' and Claude Code's toasts and logs while on (pass-through `ui.toast`/`ui.log` hooks). Own toasts come through `ui.toast` and are left out; own `$.ui.log` does not come through `ui.log`.
- Counted, not logged singly: a `git status` that repeated the last answer, stats, pane renders, unchanged `prompt.compose`. `poll / nothing new` sums them every 30 s.
- `trace($, kind, name, detail?, ms?)` in `register.tsx` is the one entry; `detail` is a function called only while on (cheap when off). The tracer always keeps the last `RING_SIZE` (300) records without details (what a dump shows from before the log was on).
- `fail($, what, error)`: a survived error, to Claude Code's debug log (same text; tests read `session.logs`) plus an `error` record. Tool answers go through `answered($, e, text)`.
- `scripts/debug-tail.sh [-a] [-k kinds] [-s session] [-d folder] [-1]`: prints records as written, reading whole lines, following chunk changes and newer sessions (`tail -f` can't: chunks are rewritten). Under Monitor each record is an event.
- Forget everything and uninstall-with-erase remove `debug/` and `debug.json` (`REMOVABLE`); `forget()` stops the log first or the next flush writes it back.
- Footprint: no new process. Calls: `$.session.id`, `$.session.version`, hook `session.end`. Observe-only hooks `ui.close`, `session.attach`, `session.detach`, `ui.toast`, `ui.log`, `ui.scroll` pass events on unchanged and write nothing while off.
- A reload cancels timers, losing a record waiting `FLUSH_MS`. `changeSetting` writes the log before `$.config.set`, and a reloaded module starts its log first in `session.start` (`resolveHome`, `startDebug`) before naming changed settings. The one gap: what the old module noted after the set.
- Verified: live (`BSD_DEBUG=1`, off/on in one folder, `dump`, `clear`, `/exit` logged, `debug-tail.sh` across a chunk change).
