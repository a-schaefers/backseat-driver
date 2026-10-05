import type { Health, Pressure, Trouble } from './health'

// The decision is the kernel's (kernel/src/Kernel/Play.purs), through core.ts. Its types, as the rest of the mod uses them, are here.
export { isLookDue, playOf, wakeAt } from './core'

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
