import { backoffMs, slowedGapMs } from './gate'
import { gapFactorOf, mayAsk } from './health'
import type { Health, Pressure, Trouble } from './health'

/**
 * What the play-by-play is doing, and when it looks next.
 *
 * Both are worked out from the facts each time one of them changes: what is
 * pending, when the last save and the last look were, how the last request
 * went, and how close the plan's limit is. Nothing here is remembered, so it
 * cannot disagree with the facts.
 */

/** Why a look that is wanted is not happening yet. */
export type Why =
  /** The last look got no answer. It is tried again at `until`. */
  | { kind: 'failed'; detail: string }
  /** Claude is not answering, which another job found out. */
  | { kind: 'trouble'; trouble: Trouble; detail: string }
  /** A usage window of the plan is nearly spent. */
  | { kind: 'plan'; percent: number; window: string }
  /** The account is refused: a login, a bill. */
  | { kind: 'account'; detail: string }
  /** The play-by-play's own setting is wrong, such as its model. */
  | { kind: 'job'; detail: string }

export type Play =
  /** Just switched on: the working tree has not been read yet. */
  | { at: 'starting' }
  | { at: 'no-git' }
  /** Another session drives this project's background jobs. This one is for the conversation. */
  | { at: 'following' }
  | { at: 'paused' }
  /** Nothing has changed since the last look. */
  | { at: 'watching' }
  /** It looks only when asked. */
  | { at: 'on-request' }
  /** A save was seen. A look is due at `dueAt`: after the quiet time, or later when the last look was not long ago (`isSpacing`). */
  | { at: 'settling'; dueAt: number; isSpacing: boolean }
  | { at: 'looking' }
  /** A look is wanted and held back. `until` is when it is tried again, or null when something else has to happen first. */
  | { at: 'waiting'; until: number | null; why: Why }

export type PlayFacts = {
  mode: 'on' | 'paused'
  /** False until the watcher has read the working tree. */
  isReady: boolean
  hasRepo: boolean
  /** True when another session holds this project's lease (`lease.ts`). */
  isFollowing: boolean
  isAutomatic: boolean
  /** Whether anything differs from what the last look saw. */
  hasPending: boolean
  lastChangeAt: number | null
  lastLookAt: number | null
  isLooking: boolean
  /** Looks in a row that got no answer, and why the last of them did not. */
  failures: number
  failure: string
  quietMs: number
  minGapMs: number
  health: Health
  pressure: Pressure
  /** Why the play-by-play's own request is refused, such as a model that does not exist. '' when it is not. */
  jobBlock: string
}

/** When the pacing alone allows the next look: the quiet time, the minimum gap, and the wait after a failed look. */
function paced(facts: PlayFacts): number | null {
  if (!facts.hasPending || facts.lastChangeAt === null) return null
  const quiet = facts.lastChangeAt + facts.quietMs
  if (facts.lastLookAt === null) return quiet

  return Math.max(quiet, facts.lastLookAt + slowedGapMs(facts.minGapMs, gapFactorOf(facts.pressure)) + backoffMs(facts.failures))
}

export function playOf(facts: PlayFacts): Play {
  if (!facts.isReady) return { at: 'starting' }
  if (!facts.hasRepo) return { at: 'no-git' }
  if (facts.mode === 'paused') return { at: 'paused' }
  if (facts.isFollowing) return { at: 'following' }
  if (facts.isLooking) return { at: 'looking' }
  if (!facts.isAutomatic) return { at: 'on-request' }
  const dueAt = paced(facts)
  if (dueAt === null) return { at: 'watching' }

  if (facts.jobBlock !== '') return { at: 'waiting', until: null, why: { kind: 'job', detail: facts.jobBlock } }
  const { health, pressure } = facts
  if (health.state === 'blocked') return { at: 'waiting', until: null, why: { kind: 'account', detail: health.detail } }
  if (pressure.level === 'held') {
    return { at: 'waiting', until: pressure.resetsAt, why: { kind: 'plan', percent: pressure.percent, window: pressure.window } }
  }
  const failed: Why | null = facts.failures > 0 ? { kind: 'failed', detail: facts.failure } : null
  if (health.state === 'waiting' || health.state === 'probing') {
    // While another job finds out whether Claude is back, there is no time to give.
    const until = health.state === 'waiting' ? Math.max(health.until, dueAt) : null

    return { at: 'waiting', until, why: failed ?? { kind: 'trouble', trouble: health.trouble, detail: health.detail } }
  }
  if (failed !== null) return { at: 'waiting', until: dueAt, why: failed }

  return { at: 'settling', dueAt, isSpacing: facts.lastChangeAt !== null && dueAt > facts.lastChangeAt + facts.quietMs }
}

/** When to come back and see whether a look can start. Null when there is nothing to wait for, or no time to give. */
export function wakeAt(facts: PlayFacts): number | null {
  const play = playOf(facts)
  if (play.at === 'settling') return play.dueAt
  if (play.at === 'waiting') return play.until

  return null
}

/** Whether a look may start by itself at `now`. */
export function isLookDue(facts: PlayFacts, now: number): boolean {
  const play = playOf(facts)
  if (play.at === 'settling') return play.dueAt <= now && mayAsk(facts.health)
  // The wait after a failure is over: this look is the one that finds out whether Claude is back.
  if (play.at === 'waiting' && (play.why.kind === 'failed' || play.why.kind === 'trouble')) {
    return play.until !== null && play.until <= now && (mayAsk(facts.health) || facts.health.state === 'waiting')
  }

  return false
}
