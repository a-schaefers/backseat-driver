---
paths:
  - "kernel/**"
  - "plugin/core/core.ts"
  - "plugin/core/kernel.js"
  - "plugin/core/kernel.d.ts"
  - "scripts/build-kernel.sh"
  - "scripts/toolchain.py"
  - "plugin/tests/kernel.test.ts"
---

# Kernel

## Kernel (PureScript)

The mod's decisions live in `kernel/src/Kernel/*.purs` (owner: "to detect, prevent and reduce bugs"): an impossible state cannot be built, an unhandled transition does not compile. Modeled on `../merecatholicity.com` (`purescript/src/Domain/*`, `app/core.ts`).

- Rule: new decision logic is written in PureScript. TypeScript is the shell (`register.tsx`: effects), the pane, the engines with ports, text parsing, and the membrane. Claude Code reads `on(...)` and `$` calls from TypeScript source, so those cannot move.
- Ported from TypeScript:
  - `Kernel.Health`: the shared wait after failures, what an API error means.
  - `Kernel.Play`: what the play-by-play is doing, when to come back, whether a look is due.
  - `Kernel.Pace`: backoff after failed looks, the gap near the plan limit.
  - `Kernel.Sensor`: how often to scan, and to check the spot in focus.
  - `Kernel.Lease`: who may take a project's lease, when to look at it again.
  - `Kernel.Queue`: waiting commits: at most three, each once, one stage at a time (`ToReview | ToAssess`), tries and spacing, the tab's text.
  - `Kernel.Store`: the store's retry policy (`afterRead`, `changeStep`, `keepsBackup`, `afterWrite`; `store.ts` keeps the I/O).
  - `Kernel.Status`: the status line, the row under it, the pose's state (`playFromWire`: unknown state `Starting`, unknown reason a failed look).
  - `Kernel.Schedule`: arming the one timer, which deadlines are due, in first-set name order (moving one keeps its place).
- Born in PureScript:
  - `Kernel.Growth`: growth score, level placed, what the Growth tab lists (`growth.ts`).
  - `Kernel.License`: where the person stands with the license, when to ask the server.
  - `Kernel.Sessions`: which session a new process carries the tutor on from, how long a session's word counts, whether it can still draw (see `sessions.md`).
  - `Kernel.Ledger`: issues: same file, topic and quoted line (or within `ledgerNearLines`, 3) is on record; `mayRule`; prune to open plus `ledgerMaxClosed` (60) closed; `rankOrder` and views (see `deep-review.md`).
- The TypeScript files of ported modules (`health.ts`, `play.ts`, `gate.ts`, `sensor.ts`, `lease.ts`, `reviewqueue.ts`, `store.ts`, `status.ts`, `scheduler.ts`) keep the types and parsing and re-export the kernel's functions from `core.ts`.
- TO PORT: nothing. `explainer.ts`, `recorder.ts`, `watcher.ts` hold effects and text and stay TypeScript; a decision found in one is a candidate. Not for the kernel: parsing text or JSON from outside (`parseLease`, `parseQueue`, `pressureOf`'s dates): that stays at the edge.
- Build:
  - `scripts/build-kernel.sh` (`npm run build:kernel`): `scripts/toolchain.py` puts `purs` 0.15.16 in `local/bin` (GitHub release, tarball and binary checked against the sha256 in `kernel/toolchain.json`); `spago build` with the package set pinned in `kernel/spago.yaml` and `spago.lock`; esbuild (pinned exactly in `package.json`) bundles entry `Kernel.Main` into one ES module, `plugin/core/kernel.js`.
  - `kernel.js` is committed (nothing builds on a user's machine). Never edit it. 149 KB; a plugin file must stay under 256 KiB.
  - `npm run kernel` builds beside it and compares. First step of `npm run check` and CI (CI caches `local/bin` and `kernel/.spago`).
  - `Kernel.Main` re-exports what crosses; what it does not export is not in the bundle.
- The membrane, `core.ts`, is the only importer of `kernel.js`:
  - PureScript functions are curried: `K.stepWire(health)(event)`.
  - What crosses is plain data as flat records with every field always present (`HealthWire`: `{ state, trouble, detail, until, failures }`), since one PureScript record type cannot be a union of shapes. The kernel converts (`healthFromWire`, `healthToWire`); `core.ts` maps to the mod's tagged unions. An unknown tag becomes the safe value (`Ok`, a server error), never an exception.
  - Identity is kept: an event that changes nothing hands back the same object (`stepHealth`), `ok` is always the one `HEALTHY`; `noteOutcome` detects change by `health === before`. Same-object rule holds for the lease and `Kernel.Queue`'s `current`/`withCommit`.
  - Keep it thin: a decision made in `core.ts` is one the kernel's types did not check.
  - Wording naming a time of day takes `clockTime` (`clock.ts`) as first argument, a plain `Number -> String`: the kernel cannot read the time zone.
  - Opaque types keep rules no caller can break: `Kernel.Queue`'s `Queue` is made only by `fromCommits` (latest three, each hash once) and functions beside it; a queue read from disk naming a commit twice keeps it once.
- Porting a module: write `Kernel.X` with the same rules; export its `…Wire` functions from `Kernel.Main`; declare them in `kernel.d.ts`; write membrane functions in `core.ts` under the names the TypeScript module exported; re-export from that module so no caller changes. Copy the old TypeScript into a temporary reference under `plugin/tests/`, run both over seeded random histories until they agree, delete the reference and the old logic, keep property tests (rules over random histories) beside the table tests. A module with nothing to compare against gets a property test against a model written beside it (`sessions.test.ts`).
- Property tests (`kernel.test.ts`, `seeded(seed)`) run against the committed bundle; a failure names its seed and turn.
- PureScript gotchas:
  - `Int` is 32 bits: clock times are `Number`.
  - `type` is reserved: an event's tag is `kind` on the wire.
  - `Data.Number.round` is JS `Math.round`.
  - Two modules may name a constructor alike (`Health.Waiting`, `Play.Waiting`): import one qualified.
  - `Kernel.Main` re-exports names as they are; names too plain for the bundle (`claimed`, `isHeld`) get a prefixed alias with its own signature (`leaseClaimed`).
- Sandbox where `packages.registry.purescript.org` is blocked: clone each package of `spago.lock` at its tag into `kernel/.spago/p/<name>-<version>` (`git clone --depth 1 --branch v<version> https://github.com/purescript/purescript-<name>.git`, drop its `.git`); spago builds from there, byte-identical bundle.
- Running some tests: `claude plugin test` runs every file. Copy `plugin/` without the other tests to a scratch folder (symlinks are refused as path traversal) and run there.
- `npm audit`'s three "high" (`braces` via spago): dev only, the fix is a spago downgrade: leave it.
- Verified: parity runs agreed for every ported module (see `.claude/history.md`); live with bundle (save → look 10.0 s after; outage and recovery through `Kernel.Health`). Tests only: `Kernel.Store`, `Kernel.Status`, `Kernel.Schedule`, `Kernel.Queue` (ported 2026-10-05, no live session yet).
