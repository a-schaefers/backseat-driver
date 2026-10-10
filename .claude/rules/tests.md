---
paths:
  - "plugin/tests/**"
  - "scripts/test_jack.py"
---

# Tests

History (the flaky-test hunt, timings under load): `.claude/history.md`, "Tests".

## Tests

- `stubSession(on, options)` (`plugin/tests/kit.ts`) is the fake world: a session, a git repo at `/work` (`write`, `commit(message, { author, body, isMerge })`, `checkout`), a clock (`session.clock.advance(ms)` resolves after fired timers and their work settle; `session.clock.settle()`), the model via `session.reply(...)`, subagents finished by `$.turn.complete(session.finish(n, answer))`.
- Options: `email` (default `me@example.com`, `''` = none), `data` (seed the data disk), `isNewProject`, `install: 'clone'|'installed'`, `tags`, `isCloneDirty`, `isCloneCurrent`, `head`, `hasInotify`, `ignored`. It registers every stub needed to start and switch modes: extend it, never register a second stub (one stub per event).
- `test(name, { options: { engineering: 'knuth' } }, body)` sets `userConfig` per test. `sessionTest` gives every test `KIT_PACE` (`quiet_time` 10 s, `minimum_gap` 1 min; the product's defaults are 5 s and none) unless the test's options say otherwise.
- Nearly every `$` call needs a stub before the test's first `$` call (except `$.state`, `$.ui.invalidate`). `session.start` runs only if fired. The test's own `$` has no `state`: assert via the pane, sends and logs.
- Types are strict: `$.command.run` needs `origin` and `presentation` (`typed()` in kit); a `command.register` stub returns `{ value: { command: e.name } }`. `promptText` reads 2.1.292's `ModelTextBlock` (every request's prompt as one string); a `tool.register` stub's event is cast (2.1.293's optional `isDeferred`).
- Each test starts freshly loaded with default state. `session.logs` = `$.ui.log` output (swallowed errors appear there).

### Time

- Kit time starts at 0; the first scan is 1 s after switch-on. A look is due exactly `quietMs` after the scan that saw the save: `advance(9999)` no request, `advance(1)` one.
- The health wait is jittered with `Math.random`: assert on the look's own pacing or on bounds.
- `$.command.run` resolves when the hook returns, not when its background work finishes: `await session.clock.settle()` after `/backseat` before touching the repo, or the first save becomes the baseline. `settle()` before asserting on any timer-started work.
- Timers move only with the clock: the hello stays at its first word until advanced by `TALK_MS` per word.
- A wait in the store or for a lock is a `$.clock.sleep`: start the call, `await session.clock.advance(...)`, then await it.
- A `$.clock.every` period is one dispatch with 10 s of real time ("exceeded 10000ms budget" under load). The timed deep review is a deadline, not one.

### Data, sessions, handoff

- Data disk: `session.disk` (absolute path → text), `session.data(rel)`, `session.removed` (rm targets). Deletion needs the marker: `session.disk.set(MARKER_PATH, …)` or a prior write.
- `session.unreadable` stages a read that fails (not missing) (`restart.test.ts`). `session.halfWritten.set(path, n)`: the next n reads find it empty.
- Locks: the fake git keeps `locks.git/HEAD` and one file per held ref in `session.disk`. `session.locking` lists `take`, `steal`, `give`, `refused` with the ref (`lockRef(path)` names it). `session.lockedElsewhere(ref, agoMs)` is another session's lock.
- Another session is what it leaves on disk: `data: { 'projects/<id>/lease.json': { v: 1, session: 'someone-else', at: 0 } }` (runs out at 60 s), or `session.disk.set(...)` a profile mid-test for a hush made elsewhere. What a driver writes (`notes.json`, `reviews.json`, `queue.json`, `journal.json`) is seeded the same way (`lease.test.ts`); set mid-test for the follower's next beat, the new text must differ in size (`disk.set` leaves the kit's mtime alone). `session.scans` counts one `git status` at switch-on even in a session that does not drive.
- `session.sessionId` is this session's id: set it and fire `$.classic.SessionStart({ source: 'clear' })` for a `/clear`. A full `/clear`: `$.session.end({ reason: 'clear', … })`, then `$.classic.SessionStart({ source: 'clear' })`. The kit cannot empty `$.state` in between, so change the pane by hand there (dismiss a note) and check it is put back. `/clear` can only be approximated.
- Handoff: seed `data: { 'sessions.json': { v: 1, sessions: [ … ] } }` with the left session's entry, set `session.born` (what `$.session.usage().startedAt` answers) to its `born`, fire `$.session.start(SESSION)` then `$.classic.SessionStart({ source: 'fork' })`. `session.surfaces` is where it draws: `[]` lays the tutor down `SELF_CHECK_MS` then `RECHECK_MS` later, only for a session that began in a terminal (a test that never fires `session.start` is never laid down). `session.paneWaits` (a reason) makes `$.ui.open` answer open and not drawn.

### Model, failures, jobs

- Failures: `session.failing.push('overloaded')` fails the next model request, whichever job; `'look:overloaded'`, `'explain:…'`, `'progress:…'` name the job. Words: Claude Code's API errors, or `offline`, `timeout`, `empty`. Explain asks 2.5 s after a save, before the look: name the job or set `explain: 'off'`.
- `$.classic.StopFailure({ error })` is a turn that died; `$.turn.complete(session.turnEnded())` a conversation turn that answered; `$.session.measure({ context, rateLimits, changed: ['rateLimits'] })` the plan's limits arriving (set `session.limits` too: the tutor reads them again before a look). `session.scans` counts `git status` calls.
- A slow model: `session.stall('explain' | 'look' | 'progress')` holds that job's requests open until `session.release()`. Requests are recorded when asked, not answered.
- Explain: `session.lookups`, answered with `session.explain(reply, 'text the prompt contains')`; order not guaranteed; unanswered, a file maps to no symbols. `session.editor(file, line, …, extra)` writes `editors/<extra.editor ?? 'test'>-1.json`, beating for the whole test unless `extra.at` is given (an `at` of 0 does not parse: advance first). Journal tests set `explain: 'off'` (a live editor starts the 100 ms poll and slows minute-scale tests).
- Progress: `session.assess(reply)`, `session.assessments`. Updates: `session.ran` (claude and network git commands in order). A clone's top is the plugin folder's parent; an installed copy's `installPath` is `/`.
- Deep reviews: `session.spawned`, `$.turn.complete(session.finish(n, answer, reason))`, `$.classic.StopFailure({ error, agent_id: session.agentId(n) })` for why a reviewer died, `session.lostAgents.push(id)` for one Claude Code no longer lists (watchdog), `data: { 'projects/<id>/queue.json': … }` for commits left waiting. A reload cannot be staged, so `adoptReview` is checked live only.
- `$.agent.spawn` stub gets `subagent_type`, must return `{ model }`, and the returned `agentId` is dropped (the plugin sees `{ model: 'inherit' }`): `register.tsx` falls back to `$.agent.list()` by type (also needed when another mod answers the spawn); the kit stubs `agent.list`.
- The kit's default project is seeded `isSurveyed` and `isAudited`, so no test spawns an audit unasked; an audit test seeds `project.json` with `isAudited: false` (`issues.test.ts`). The kit's `git show <hash>` gives a `diff --git` header per changed file, which is how a review finds its files' issues.
- Lessons: `pluginFiles` keys under `/lessons/` (`'/lessons/x.md': text`) are read and listed (a `$.fs.list` of a folder ending like a key's folder lists them). `session.data('lessons/<language>/<id>.json')` is a record.
- inotifywait: `hasInotify: true` makes `$.process.spawn` of it succeed (anything else refused, as when not on PATH); `ignored` lists git-ignored folders. `session.watchers`: each child's `argv`, `report(...absolutePaths)`, `end(complaint)`, `isStopped`. `session.spawnedProcesses`: every command tried. A child the tutor stops ends at its next output (in Claude Code at once). A reported change needs `await session.clock.settle()` and `advance(1)` before its scan ran.

### UI in the kit

- Mount `BAND` and `HINT` (kit.ts) for the band above the prompt (the minimized strip) and the hint line. The kit draws `ENGINE_BAND` in the band and the hint plus any `tail` beneath the plugin. The pane opens with the tutor; no option needed.
- A test's `$` cannot raise the person's close (`ui.close` is not among its events): `minimize.test.ts` goes through the pane's `x`, which ends in the same `minimizePane`; the `ui.close` hook is checked live only.
- `session.config` is `/config`'s rows (`$.config.list`), `session.configured` what `$.config.set` changed, `session.configDeny` refuses the next one.
- The kit auto-answers `$.ui.invalidate('ui.render')` but not prompt-event invalidations: stub `ui.invalidate`.
- No implementation of `$.ui.focus` or stub for `$.ui.scroll`: the call throws, the mod notes the refusal and each ring move in the debug log (`ui / ring`), and tests read it there.
- `Text` takes no `key`: find text via `ui.find({ type: 'Text', text })`. The persona's drawing is `{ type: 'Raster', key: 'persona' }`; compare its `cells` with `rasterCells` for the expected pose. The kit has no theme: a test session is dark.
- The kit's views have no spinner tick and draw the first mark, `·`.

### Debug log, engines, properties

- Debug log: seed `data: { 'debug.json': { on: true } }` (and the marker), or run `/backseat debug on`. `session.debugLog()` returns every record across chunks. Records are written `FLUSH_MS` after they are noted: `await session.clock.advance(FLUSH_MS)` before reading. The kit stubs `session.id` (`SESSION_ID`), `session.version`, `session.end`.
- Engines with ports are tested without the kit: `explain.test.ts`'s `world()`, whose model is answered by hand with `w.answer(request, reply)` (how a test changes a file mid-call); `w.state.wakeAt` is what the engine last asked for, `w.explainer.wake()` the deadline firing. Pure modules are tested with plain `test`.
- Property tests (`kernel.test.ts`, also `growth.test.ts`, `sessions.test.ts`, `findings.test.ts`): a rule over seeded random histories (`seeded(seed)`); a failure names its seed and turn. They run against the committed bundle, which is what users get.
- Observations are keyed by full hash: the kit's short hashes are all `0000000`.
- `scripts/test_jack.py` (`npm run tools`, in `npm run check`): the jack tool on fixtures with no session running. The test that replays terminal output needs tmux and is skipped without it.

### Running

- `claude plugin test` takes only the plugin root, runs every file in parallel processes, and has no `only` or filter. To run some, copy `plugin/` without its other tests to a scratch folder (symlinks are refused as path traversal) and run there.
- `sessionTest` (30 s limit) for anything that starts a session; plain `test` (5 s) for pure functions. Each test loads the whole mod, so a busy machine takes seconds before the first action.
- A failure of only a slow test under load (`editors.test.ts` alone takes 10 s; the timed review in `deepreview.test.ts`; `resilience.test.ts`, the watchdog in `reviewqueue.test.ts`, the queue property in `kernel.test.ts` with two suites running) is load, not a Claude Code change: rerun the file alone.
- Code that can run after the module unloads (a timer, a stream's `finally`, a lookup's continuation) must swallow a refused host call: the kit ends inotifywait streams at unload, and an uncaught `$.clock.now refused` failed `filewatch.test.ts` at the end of full runs (caught in `runPusher`; the spinner, persona, settings' reload watch, scheduler and Explain's stopped lookup also guard).
- Remove debug lines by hand: `git checkout <file>` discards other uncommitted changes too.
