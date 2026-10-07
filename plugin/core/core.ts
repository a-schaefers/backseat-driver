import type { Watch } from '../types'
import type { Throttle } from './gate'
import type { Health, HealthEvent, ModelResult, Outcome, Pressure, Trouble } from './health'
import * as K from './kernel.js'
import type { HealthWire, PlayFactsWire, WaitingWire } from './kernel.js'
import type { Growth, GrowthFacts } from './growth'
import type { Lease } from './lease'
import type { LicenseFacts, Standing } from './license'
import type { Play, PlayFacts, Why } from './play'
import type { ReviewQueue, Waiting, Wanted } from './reviewqueue'
import type { Bound, SessionBook, SessionEntry } from './sessions'
import { clockTime } from './clock'
import type { FocusFacts, ScanFacts } from './sensor'
import type { HealthFacts } from './status'

/**
 * The one bridge between the kernel and the rest of the mod.
 *
 * The kernel is PureScript (kernel/src in the repository), compiled into
 * kernel.js. Its types carry the rules: a state that cannot happen cannot be
 * built there, and a transition that is not handled does not compile. What
 * crosses to TypeScript is plain data, and this file is where it crosses:
 * PureScript's curried functions are called here, and the flat records the
 * kernel speaks are turned into the tagged unions the rest of the mod uses,
 * and back. Nothing else imports kernel.js.
 *
 * Keep this file thin. A decision made here is a decision the kernel's types
 * did not check.
 */

export const HEALTHY: Health = { state: 'ok' }

function healthToWire(health: Health): HealthWire {
  switch (health.state) {
    case 'ok':
      return { state: 'ok', trouble: '', detail: '', until: 0, failures: 0 }
    case 'waiting':
      return { state: 'waiting', trouble: health.trouble, detail: health.detail, until: health.until, failures: health.failures }
    case 'recovering':
    case 'probing':
      return { state: health.state, trouble: health.trouble, detail: health.detail, until: 0, failures: health.failures }
    case 'blocked':
      return { state: 'blocked', trouble: '', detail: health.detail, until: 0, failures: 0 }
  }
}

function healthFromWire(wire: HealthWire): Health {
  const trouble = wire.trouble as Trouble
  switch (wire.state) {
    case 'waiting':
      return { state: 'waiting', trouble, detail: wire.detail, until: wire.until, failures: wire.failures }
    case 'recovering':
      return { state: 'recovering', trouble, detail: wire.detail, failures: wire.failures }
    case 'probing':
      return { state: 'probing', trouble, detail: wire.detail, failures: wire.failures }
    case 'blocked':
      return { state: 'blocked', detail: wire.detail }
    default:
      return HEALTHY
  }
}

function isSameHealth(a: HealthWire, b: HealthWire): boolean {
  return a.state === b.state && a.trouble === b.trouble && a.detail === b.detail && a.until === b.until && a.failures === b.failures
}

/**
 * The health after an event. When the event changes nothing, the health that
 * was passed in comes back, the same object, so that the caller can tell.
 */
export function stepHealth(health: Health, event: HealthEvent): Health {
  const before = healthToWire(health)
  const failed = event.type === 'failed' ? event : null
  const after = K.stepWire(before)({
    kind: event.type,
    trouble: failed?.trouble ?? '',
    detail: failed?.detail ?? '',
    at: failed?.at ?? 0,
    random: failed?.random ?? 0,
    hasResetsAt: typeof failed?.resetsAt === 'number',
    resetsAt: typeof failed?.resetsAt === 'number' ? failed.resetsAt : 0,
  })

  return isSameHealth(before, after) ? health : healthFromWire(after)
}

/** Whether a job may ask by itself now. What the person asks for is always tried. */
export function mayAsk(health: Health): boolean {
  return K.mayAskWire(healthToWire(health))
}

/**
 * How long to wait after the nth failure in a row: 30 seconds, doubling, ten
 * minutes at most, and somewhere in the upper half of that.
 */
export function retryDelayMs(trouble: Trouble, failures: number, random: number): number {
  return K.retryDelayMsWire(trouble)(Math.trunc(failures))(random)
}

/** The trouble behind one of Claude Code's words for an API error. One it does not know is taken to pass. */
export function troubleOf(error: string): Trouble {
  return K.troubleOfWire(error) as Trouble
}

function outcomeFromWire(wire: K.OutcomeWire): Outcome {
  return wire.ok ? { ok: true } : { ok: false, trouble: wire.trouble as Trouble, detail: wire.detail }
}

/** How a model call went. */
export function outcomeOf(result: ModelResult): Outcome {
  if (result.isAnswered) return { ok: true }
  const status = typeof result.status === 'number' && Number.isFinite(result.status) ? Math.trunc(result.status) : null

  return outcomeFromWire(
    K.outcomeOfWire({ isAnswered: false, reason: result.reason, hasStatus: status !== null, status: status ?? 0, error: result.error ?? '' }),
  )
}

/** How an API error that ended a turn, the conversation's or a subagent's, counts. */
export function outcomeOfError(error: string): Outcome {
  return outcomeFromWire(K.outcomeOfErrorWire(error))
}

// --- Pacing (Kernel.Pace)

/** How long failed looks hold the next one back: 30 seconds, doubling, up to 10 minutes. */
export function backoffMs(failures: number): number {
  return K.backoffMs(Math.trunc(failures))
}

/** The minimum gap while slowed down: the setting stretched, and never under four minutes. */
export function slowedGapMs(minGapMs: number, gapFactor: number): number {
  return K.slowedGapMs(minGapMs)(gapFactor)
}

/** From 80% of a usage window, looks are spaced four times further apart. From 95%, they wait to be asked for. */
export function throttle(pressure: number): Throttle {
  return { gapFactor: K.gapFactor(pressure), isHeld: K.isHeldAt(pressure) }
}

// --- The scan (Kernel.Sensor)

/** Between scans while something has just happened. */
export const HOT_SCAN_MS: number = K.hotScanMs
/** Between scans otherwise. */
export const SCAN_MS: number = K.scanMs
/** Between scans once nothing has happened for a while. */
export const IDLE_SCAN_MS: number = K.idleScanMs
/** How long after something happened the scans stay close together. */
export const HOT_FOR_MS: number = K.hotForMs
/** How long nothing has to happen before they grow far apart. */
export const IDLE_AFTER_MS: number = K.idleAfterMs
/** However slow git is, the working tree is looked at this often. */
export const LONGEST_SCAN_GAP_MS: number = K.longestScanGapMs
/** Between checks of the spot in focus while someone is watching it. */
export const FOCUS_SCAN_MS: number = K.focusScanMs
/** However slow the disk is, the spot in focus is checked this often. */
export const LONGEST_FOCUS_GAP_MS: number = K.longestFocusGapMs
/** Between scans while a watcher pushes the working tree's changes. */
export const PUSHED_SCAN_MS: number = K.pushedScanMs
/** Between checks of the spot in focus while a watcher pushes the changes to it. */
export const PUSHED_FOCUS_MS: number = K.pushedFocusMs

/** How long to wait before the next scan. */
export function scanGapMs(facts: ScanFacts): number {
  return K.scanGapMsWire({ now: facts.now, hasActiveAt: facts.activeAt !== null, activeAt: facts.activeAt ?? 0, lastScanMs: facts.lastScanMs, isPushed: facts.isPushed })
}

/** How long to wait before the next check of the spot in focus. A check that was slow is not run back to back. */
export function focusGapMs(facts: FocusFacts): number {
  return K.focusGapMs(facts)
}

// --- The lease (Kernel.Lease)

/** How often the driving session renews the lease. */
export const LEASE_BEAT_MS: number = K.leaseBeatMs
/** A lease not renewed for this long is free: its session is gone. */
export const LEASE_TTL_MS: number = K.leaseTtlMs
/** A waiting session looks again up to this long after the lease runs out. */
export const LEASE_SLACK_MS: number = K.leaseSlackMs

export const NO_LEASE: Lease = { v: 1, session: '', at: 0 }

/** Whether some session holds the lease at `now`. */
export function isHeld(lease: Lease, now: number): boolean {
  return K.leaseIsHeld({ session: lease.session, at: lease.at })(now)
}

/**
 * The lease after `me` has tried for it at `now`. Held by another, it comes
 * back as it was, the same object, so that the caller can tell nothing has
 * to be written.
 */
export function claimed(lease: Lease, me: string, now: number, also = ''): Lease {
  const next = K.leaseClaimed({ session: lease.session, at: lease.at })(me)(now)(also)

  return next.session === lease.session && next.at === lease.at ? lease : { v: 1, session: next.session, at: next.at }
}

/** The lease after `me` has given it back. Another session's is left alone, and comes back the same object. */
export function released(lease: Lease, me: string): Lease {
  const next = K.leaseReleased({ session: lease.session, at: lease.at })(me)

  return next.session === lease.session && next.at === lease.at ? lease : NO_LEASE
}

/** When to look at the lease again. `random` is a number from 0 up to 1. */
export function nextLeaseCheck(lease: Lease, me: string, now: number, random: number): number {
  return K.leaseNextCheck({ session: lease.session, at: lease.at })(me)(now)(random)
}

// --- The sessions the tutor is on in (Kernel.Sessions)

/** How often a session says again that it has the tutor on. */
export const SAY_EVERY_MS: number = K.sessionsSayEveryMs
/** An entry whose session has not said so for this long is not carried on from. */
export const ALIVE_MS: number = K.sessionsAliveMs
/** How long after a session's goodbye its entry is still carried on from. */
export const HANDOFF_MS: number = K.sessionsHandoffMs
/** An entry nobody has stood behind for this long is dropped. */
export const SESSIONS_KEEP_MS: number = K.sessionsKeepMs
/** How long after a session found nowhere to draw it looks again. */
export const RECHECK_MS: number = K.sessionsRecheckMs
/** How often a session with the tutor on looks at itself. */
export const SELF_CHECK_MS: number = K.sessionsCheckEveryMs

function entriesOf(book: SessionBook): SessionEntry[] {
  return book.sessions.map(entry => ({ ...entry }))
}

function bookOf(entries: readonly { session: string; born: number; cwd: string; mode: string; at: number; leftAt: number }[]): SessionBook {
  return { v: 1, sessions: entries.map(entry => ({ ...entry, mode: entry.mode === 'paused' ? 'paused' : 'on' })) }
}

/** What a process that starts by forking or resuming carries the tutor on from, or null when it starts off. */
export function carriedFrom(book: SessionBook, asking: { born: number; cwd: string; now: number }): { session: string; mode: 'on' | 'paused' } | null {
  const found = K.sessionsCarriedFrom(entriesOf(book))(asking)

  return found.isFound ? { session: found.session, mode: found.mode === 'paused' ? 'paused' : 'on' } : null
}

/** The sessions after `entry`'s session has said it has the tutor on. */
export function saidOn(book: SessionBook, entry: SessionEntry): SessionBook {
  return bookOf(K.sessionsSaid(entriesOf(book))({ ...entry }))
}

/** The sessions after `session` said goodbye at `now`. */
export function saidLeft(book: SessionBook, session: string, now: number): SessionBook {
  return bookOf(K.sessionsLeft(entriesOf(book))(session)(now))
}

/** The sessions after the tutor was switched off in `session`. */
export function withdrawn(book: SessionBook, session: string): SessionBook {
  return bookOf(K.sessionsWithdrawn(entriesOf(book))(session))
}

/** Whether a session that last said so at `saidAt` says so again at `now`. */
export function isSayDue(saidAt: number, now: number): boolean {
  return K.sessionsIsSayDue(saidAt)(now)
}

/** Whether a session still has somewhere to draw. A word the kernel names that this file does not know is `drawn`, which changes nothing. */
export function boundOf(drawing: { surfaces: number; wasUnsure: boolean; isTerminal: boolean }): Bound {
  const named = K.sessionsBound(drawing)

  return named === 'unsure' || named === 'gone' ? named : 'drawn'
}

// --- The play-by-play (Kernel.Play)

function pressureToWire(pressure: Pressure): PlayFactsWire['pressure'] {
  return {
    level: pressure.level,
    percent: pressure.percent,
    window: pressure.window,
    hasResetsAt: pressure.resetsAt !== null,
    resetsAt: pressure.resetsAt ?? 0,
  }
}

function factsToWire(facts: PlayFacts): PlayFactsWire {
  return {
    isPaused: facts.mode === 'paused',
    isReady: facts.isReady,
    hasRepo: facts.hasRepo,
    isFollowing: facts.isFollowing,
    isAutomatic: facts.isAutomatic,
    hasPending: facts.hasPending,
    hasLastChangeAt: facts.lastChangeAt !== null,
    lastChangeAt: facts.lastChangeAt ?? 0,
    hasLastLookAt: facts.lastLookAt !== null,
    lastLookAt: facts.lastLookAt ?? 0,
    isLooking: facts.isLooking,
    failures: Math.trunc(facts.failures),
    failure: facts.failure,
    quietMs: facts.quietMs,
    minGapMs: facts.minGapMs,
    health: healthToWire(facts.health),
    pressure: pressureToWire(facts.pressure),
    jobBlock: facts.jobBlock,
  }
}

function whyFromWire(wire: K.PlayWire): Why {
  switch (wire.why) {
    case 'trouble':
      return { kind: 'trouble', trouble: wire.trouble as Trouble, detail: wire.detail }
    case 'plan':
      return { kind: 'plan', percent: wire.percent, window: wire.window }
    case 'account':
      return { kind: 'account', detail: wire.detail }
    case 'job':
      return { kind: 'job', detail: wire.detail }
    default:
      return { kind: 'failed', detail: wire.detail }
  }
}

/** What the play-by-play is doing, worked out from the facts. */
export function playOf(facts: PlayFacts): Play {
  const wire = K.playOfWire(factsToWire(facts))
  switch (wire.at) {
    case 'settling':
      return { at: 'settling', dueAt: wire.dueAt, isSpacing: wire.isSpacing }
    case 'waiting':
      return { at: 'waiting', until: wire.hasUntil ? wire.until : null, why: whyFromWire(wire) }
    case 'no-git':
    case 'following':
    case 'paused':
    case 'watching':
    case 'on-request':
    case 'looking':
      return { at: wire.at }
    default:
      return { at: 'starting' }
  }
}

/** When to come back and see whether a look can start. Null when there is nothing to wait for, or no time to give. */
export function wakeAt(facts: PlayFacts): number | null {
  const wake = K.wakeAtWire(factsToWire(facts))

  return wake.has ? wake.at : null
}

/** Whether a look may start by itself at `now`. */
export function isLookDue(facts: PlayFacts, now: number): boolean {
  return K.isLookDueWire(factsToWire(facts))(now)
}

// --- The review queue (Kernel.Queue)

/** How many commits wait at most. A newer one pushes the oldest out. */
export const MAX_WAITING: number = K.maxWaiting
/** A commit that has waited this long is let go. */
export const MAX_WAIT_MS: number = K.maxWaitMs
/** How often one stage of one commit is tried before it is given up on. */
export const MAX_ATTEMPTS: number = K.maxAttempts
/** After a try that got no answer, the next one waits this long, doubling. */
export const RETRY_MS: number = K.retryBaseMs
/** A review that has not reported back after this long is looked for. */
export const WATCHDOG_MS: number = K.watchdogMs
/** One that is still running then gets until this long after it started, and no longer. */
export const WATCHDOG_LIMIT_MS: number = K.watchdogLimitMs
/** How long a review that ended in "error" waits to be told which error. */
export const VERDICT_MS: number = K.verdictMs
/** What the Deep review tab says about a commit whose review is held back by the plan's limit. */
export const PLAN_HELD: string = K.planHeld

function commitsToWire(queue: ReviewQueue): WaitingWire[] {
  return queue.commits.map(commit => ({ ...commit, attempts: Math.trunc(commit.attempts) }))
}

function queueFromWire(commits: WaitingWire[]): ReviewQueue {
  return { v: 1, commits: commits.map(commit => ({ hash: commit.hash, title: commit.title, at: commit.at, isReviewed: commit.isReviewed, attempts: commit.attempts })) }
}

/** Whether two lists of commits are the same commits at the same stages. */
function isSameQueue(queue: ReviewQueue, commits: WaitingWire[]): boolean {
  return (
    queue.commits.length === commits.length &&
    queue.commits.every((commit, at) => {
      const other = commits[at]

      return other !== undefined && commit.hash === other.hash && commit.isReviewed === other.isReviewed && commit.attempts === other.attempts
    })
  )
}

/** The queue without what has waited too long. Nothing let go, the same object comes back. */
export function current(queue: ReviewQueue, now: number): ReviewQueue {
  const next = K.currentQueueWire(commitsToWire(queue))(now)

  return isSameQueue(queue, next) ? queue : queueFromWire(next)
}

/** A commit that was just seen joins the end. One already waiting stays as it is, and the same object comes back. */
export function withCommit(queue: ReviewQueue, commit: { hash: string; title: string }, at: number): ReviewQueue {
  const next = K.withCommitWire(commitsToWire(queue))(commit.hash)(commit.title)(at)

  return isSameQueue(queue, next) ? queue : queueFromWire(next)
}

export function withoutCommit(queue: ReviewQueue, hash: string): ReviewQueue {
  return queueFromWire(K.withoutCommitWire(commitsToWire(queue))(hash))
}

/** The commit's review is done, or given up on: what is left is the look at the person's progress. */
export function reviewed(queue: ReviewQueue, hash: string): ReviewQueue {
  return queueFromWire(K.reviewedWire(commitsToWire(queue))(hash))
}

/** One more try at the commit's present stage got no answer. */
export function withAttempt(queue: ReviewQueue, hash: string): ReviewQueue {
  return queueFromWire(K.withAttemptWire(commitsToWire(queue))(hash))
}

/** Whether the commit's present stage has been tried as often as it will be. */
export function isSpent(queue: ReviewQueue, hash: string): boolean {
  return K.isSpentWire(commitsToWire(queue))(hash)
}

/** How long to wait after the nth try in a row that got no answer. */
export function retryMs(attempts: number): number {
  return K.retryMs(Math.trunc(attempts))
}

function nextFromWire(next: K.NextWire): Waiting | null {
  return next.has ? queueFromWire([next.commit]).commits[0] ?? null : null
}

/** The oldest commit that still needs its review. */
export function nextToReview(queue: ReviewQueue, wanted: Wanted): Waiting | null {
  return nextFromWire(K.nextToReviewWire(commitsToWire(queue))(wanted))
}

/** The oldest commit whose review is done with and which still needs the look at the person's progress. */
export function nextToAssess(queue: ReviewQueue, wanted: Wanted): Waiting | null {
  return nextFromWire(K.nextToAssessWire(commitsToWire(queue))(wanted))
}

/** The commits that need nothing more under these settings, to be taken out. */
export function settledIn(queue: ReviewQueue, wanted: Wanted): string[] {
  return K.settledInWire(commitsToWire(queue))(wanted)
}

/**
 * Why a waiting review is not running, as the tab says it. '' when nothing
 * holds it back. `retryAt` is the review's own next try, when it has one
 * planned: the time named is the later of the two.
 */
export function heldText(health: Health, pressure: Pressure, jobBlock: string | undefined, retryAt: number | null): string {
  return K.heldTextWire(clockTime)(healthToWire(health))(pressureToWire(pressure))(jobBlock ?? '')(retryAt !== null)(retryAt ?? 0)
}

/** What the tab says after a try that got no answer: when the next one is, or that there will be none. */
export function failedText(detail: string, retryAt: number | null): string {
  return K.failedTextWire(clockTime)(detail)(retryAt !== null)(retryAt ?? 0)
}

// --- The store's retry policy (Kernel.Store)

/** How often a file that is empty or does not parse is read again before it counts as broken. */
export const READ_TRIES: number = K.readTries
/** How long to wait before reading it again: a write takes a few milliseconds. */
export const READ_RETRY_MS: number = K.readRetryMs
/** How often a change is made again after another session's write got in its way. */
export const WRITE_TRIES: number = K.writeTries

export type AfterRead = { next: 'absent' } | { next: 'sound' } | { next: 'broken' } | { next: 'again'; waitMs: number }

/** What to do after the nth read of a file found it missing, parsed, or empty or unparseable. */
export function afterRead(attempt: number, found: 'missing' | 'parsed' | 'unreadable'): AfterRead {
  const wire = K.afterReadWire(Math.trunc(attempt))(found)
  switch (wire.next) {
    case 'absent':
      return { next: 'absent' }
    case 'sound':
      return { next: 'sound' }
    case 'again':
      return { next: 'again', waitMs: wire.waitMs }
    default:
      return { next: 'broken' }
  }
}

/** What the nth try at a change does once it has the new text: nothing, check that nobody wrote first, or write. */
export function changeStep(attempt: number, facts: { hasLock: boolean; isSound: boolean; isSame: boolean }): 'unchanged' | 'check' | 'write' {
  const step = K.stepOfWire({ attempt: Math.trunc(attempt), ...facts })

  return step === 'unchanged' || step === 'check' ? step : 'write'
}

/** Whether to keep the file as it was before writing over it. */
export function keepsBackup(facts: { wantsBackup: boolean; isSound: boolean; exists: boolean }): boolean {
  return K.keepsBackupWire(facts)
}

export type AfterWrite = { next: 'done' } | { next: 'unconfirmed' } | { next: 'again'; waitMs: number }

/** What the nth try does after reading back what it wrote. */
export function afterWrite(attempt: number, isConfirmed: boolean): AfterWrite {
  const wire = K.afterWriteWire(Math.trunc(attempt))(isConfirmed)
  switch (wire.next) {
    case 'done':
      return { next: 'done' }
    case 'again':
      return { next: 'again', waitMs: wire.waitMs }
    default:
      return { next: 'unconfirmed' }
  }
}

// --- The status line (Kernel.Status)

function playToWire(play: Play): K.PlayWire {
  const wire: K.PlayWire = { at: play.at, dueAt: 0, isSpacing: false, hasUntil: false, until: 0, why: '', detail: '', trouble: '', percent: 0, window: '' }
  switch (play.at) {
    case 'settling':
      return { ...wire, dueAt: play.dueAt, isSpacing: play.isSpacing }
    case 'waiting': {
      const waiting = { ...wire, hasUntil: play.until !== null, until: play.until ?? 0, why: play.why.kind }
      switch (play.why.kind) {
        case 'trouble':
          return { ...waiting, trouble: play.why.trouble, detail: play.why.detail }
        case 'plan':
          return { ...waiting, percent: play.why.percent, window: play.why.window }
        default:
          return { ...waiting, detail: play.why.detail }
      }
    }
    default:
      return wire
  }
}

/** A scan of the working tree that took this long is worth a word. */
export const SLOW_SCAN_MS: number = K.slowScanMs

/** What the status line says while the tutor is on or paused. */
export function playLine(play: Play): string {
  return K.playLineWire(clockTime)(playToWire(play))
}

/**
 * What keeps going wrong in the background, for the dim row under the status
 * line. '' when nothing does. It leaves out what the status line itself says.
 */
export function healthLine(facts: HealthFacts): string {
  return K.healthLineWire(clockTime)({
    play: playToWire(facts.play),
    health: healthToWire(facts.health),
    pressure: pressureToWire(facts.pressure),
    lastScanMs: facts.lastScanMs,
    failing: [...facts.failing],
  })
}

/** The state the animated character takes its pose from. */
export function watchState(play: Play): Watch['state'] {
  const state = K.watchStateWire(playToWire(play))

  return state === 'starting' || state === 'no-git' || state === 'looking' || state === 'settling' || state === 'waiting' || state === 'following' ? state : 'idle'
}

// --- Deadlines (Kernel.Schedule)

export type Arm = { next: 'keep' } | { next: 'disarm' } | { next: 'arm'; at: number }

/** What to do with a timer armed for `armedFor` (null: none), given the deadlines as they are now. */
export function arming(armedFor: number | null, deadlines: { name: string; at: number }[]): Arm {
  const wire = K.armingWire(armedFor !== null)(armedFor ?? 0)(deadlines)
  switch (wire.next) {
    case 'keep':
      return { next: 'keep' }
    case 'arm':
      return { next: 'arm', at: wire.at }
    default:
      return { next: 'disarm' }
  }
}

/** How long from `now` until `at`. A time already past is now. */
export function delayMs(at: number, now: number): number {
  return K.delayMsWire(at)(now)
}

/** The names of the deadlines due at `now`, the earliest first, in the order given among those due together. */
export function dueNow(deadlines: { name: string; at: number }[], now: number): string[] {
  return K.dueNowWire(deadlines)(now)
}

// --- The license (Kernel.License)

const STANDINGS: readonly Standing[] = ['unchosen', 'personal', 'licensed', 'needs-key', 'bad-key', 'expired', 'withdrawn', 'unchecked']

/** Where the person stands with the license. A standing the kernel names that this file does not know is `licensed`, which shows nothing. */
export function licenseStanding(facts: LicenseFacts): Standing {
  const named = K.licenseStandingWire(facts)

  return STANDINGS.find(standing => standing === named) ?? 'licensed'
}

/** When to ask the license server about the key, or null for not at all. */
export function nextLicenseCheck(facts: LicenseFacts): number | null {
  const at = K.licenseNextCheckWire(facts)

  return at === 0 ? null : at
}

// --- Growth (Kernel.Growth)

const RANKS = ['beginner', 'junior', 'mid', 'senior'] as const

/** The growth score of one language, and what to show with it. */
export function growthOfFacts(facts: GrowthFacts): Growth {
  const wire = K.growthWire({
    seen: facts.seen.map(seen => ({ commit: seen.commit, skill: seen.skill, rank: RANKS.indexOf(seen.level), isShown: seen.isShown, weight: seen.weight })),
    lessons: facts.lessons.map(({ level, ...lesson }) => ({ ...lesson, rank: RANKS.indexOf(level) })),
    topics: facts.topics,
    linesRead: facts.linesRead,
  })

  return {
    level: RANKS[wire.rank] ?? null,
    score: wire.score,
    toNext: wire.toNext,
    shown: wire.shown,
    missed: wire.missed,
    lessonSteps: wire.lessonSteps,
    habitsImproved: wire.habitsImproved,
    stillComing: wire.stillComing,
    workOn: wire.workOn,
    neededHelp: wire.neededHelp,
    improved: wire.improved,
    toRaise: wire.toRaise,
    encouragement: wire.encouragement[0] ?? null,
  }
}
