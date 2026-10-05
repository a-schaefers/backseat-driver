import type { Throttle } from './gate'
import type { Health, HealthEvent, ModelResult, Outcome, Pressure, Trouble } from './health'
import * as K from './kernel.js'
import type { HealthWire, PlayFactsWire } from './kernel.js'
import type { Lease } from './lease'
import type { LicenseFacts, Standing } from './license'
import type { Play, PlayFacts, Why } from './play'
import type { ScanFacts } from './sensor'

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

/** How long to wait before the next scan. */
export function scanGapMs(facts: ScanFacts): number {
  return K.scanGapMsWire({ now: facts.now, hasActiveAt: facts.activeAt !== null, activeAt: facts.activeAt ?? 0, lastScanMs: facts.lastScanMs })
}

/** How long to wait before the next check of the spot in focus. A check that was slow is not run back to back. */
export function focusGapMs(tookMs: number): number {
  return K.focusGapMs(tookMs)
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
