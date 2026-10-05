/**
 * What kernel.js exports: the kernel of the mod, compiled from PureScript
 * (kernel/src in the repository, entry `Kernel.Main`). Functions are curried,
 * as PureScript's are, and take and return plain records. Only core.ts
 * imports this.
 */

/** Every field is always there. The ones a state does not have are empty. */
export type HealthWire = { state: string; trouble: string; detail: string; until: number; failures: number }
/** `kind` is `failed`, `answered`, `due`, `probing` or `abandoned`. */
export type HealthEventWire = {
  kind: string
  trouble: string
  detail: string
  at: number
  random: number
  hasResetsAt: boolean
  resetsAt: number
}
export type ResultWire = { isAnswered: boolean; reason: string; hasStatus: boolean; status: number; error: string }
export type OutcomeWire = { ok: boolean; trouble: string; detail: string }

export const stepWire: (health: HealthWire) => (event: HealthEventWire) => HealthWire
export const mayAskWire: (health: HealthWire) => boolean
export const retryDelayMsWire: (trouble: string) => (failures: number) => (random: number) => number
export const troubleOfWire: (error: string) => string
export const outcomeOfWire: (result: ResultWire) => OutcomeWire
export const outcomeOfErrorWire: (error: string) => OutcomeWire

// Pacing
export const backoffMs: (failures: number) => number
export const slowedGapMs: (minGapMs: number) => (gapFactor: number) => number
export const gapFactor: (percent: number) => number
export const isHeldAt: (percent: number) => boolean

// The scan
export type ScanFactsWire = { now: number; hasActiveAt: boolean; activeAt: number; lastScanMs: number }
export const scanGapMsWire: (facts: ScanFactsWire) => number
export const focusGapMs: (tookMs: number) => number
export const hotScanMs: number
export const scanMs: number
export const idleScanMs: number
export const hotForMs: number
export const idleAfterMs: number
export const longestScanGapMs: number
export const focusScanMs: number
export const longestFocusGapMs: number

// The lease
export type LeaseWire = { session: string; at: number }
export const leaseIsHeld: (lease: LeaseWire) => (now: number) => boolean
export const leaseClaimed: (lease: LeaseWire) => (me: string) => (now: number) => (also: string) => LeaseWire
export const leaseReleased: (lease: LeaseWire) => (me: string) => LeaseWire
export const leaseNextCheck: (lease: LeaseWire) => (me: string) => (now: number) => (random: number) => number
export const leaseBeatMs: number
export const leaseTtlMs: number
export const leaseSlackMs: number

// The play-by-play
export type PressureWire = { level: string; percent: number; window: string; hasResetsAt: boolean; resetsAt: number }
export type PlayFactsWire = {
  isPaused: boolean
  isReady: boolean
  hasRepo: boolean
  isFollowing: boolean
  isAutomatic: boolean
  hasPending: boolean
  hasLastChangeAt: boolean
  lastChangeAt: number
  hasLastLookAt: boolean
  lastLookAt: number
  isLooking: boolean
  failures: number
  failure: string
  quietMs: number
  minGapMs: number
  health: HealthWire
  pressure: PressureWire
  jobBlock: string
}
/** `why` is '' unless `at` is `waiting`, and then `failed`, `trouble`, `plan`, `account` or `job`. */
export type PlayWire = {
  at: string
  dueAt: number
  isSpacing: boolean
  hasUntil: boolean
  until: number
  why: string
  detail: string
  trouble: string
  percent: number
  window: string
}
export const playOfWire: (facts: PlayFactsWire) => PlayWire
export const wakeAtWire: (facts: PlayFactsWire) => { has: boolean; at: number }
export const isLookDueWire: (facts: PlayFactsWire) => (now: number) => boolean

// The review queue
/** `isReviewed` is the stage: true once the review is done with. `attempts` is a whole number. */
export type WaitingWire = { hash: string; title: string; at: number; isReviewed: boolean; attempts: number }
export type WantedWire = { wantsReview: boolean; wantsAssessment: boolean }
/** `has` is false when there is no such commit, and `commit` is then empty. */
export type NextWire = { has: boolean; commit: WaitingWire }
export const currentQueueWire: (commits: WaitingWire[]) => (now: number) => WaitingWire[]
export const withCommitWire: (commits: WaitingWire[]) => (hash: string) => (title: string) => (at: number) => WaitingWire[]
export const withoutCommitWire: (commits: WaitingWire[]) => (hash: string) => WaitingWire[]
export const reviewedWire: (commits: WaitingWire[]) => (hash: string) => WaitingWire[]
export const withAttemptWire: (commits: WaitingWire[]) => (hash: string) => WaitingWire[]
export const isSpentWire: (commits: WaitingWire[]) => (hash: string) => boolean
export const nextToReviewWire: (commits: WaitingWire[]) => (wanted: WantedWire) => NextWire
export const nextToAssessWire: (commits: WaitingWire[]) => (wanted: WantedWire) => NextWire
export const settledInWire: (commits: WaitingWire[]) => (wanted: WantedWire) => string[]
export const retryMs: (attempts: number) => number
/** `jobBlock` is '' when the job's request is not refused. */
export const heldTextWire: (
  clock: (ms: number) => string,
) => (health: HealthWire) => (pressure: PressureWire) => (jobBlock: string) => (hasRetryAt: boolean) => (retryAt: number) => string
export const failedTextWire: (clock: (ms: number) => string) => (detail: string) => (hasRetryAt: boolean) => (retryAt: number) => string
export const planHeld: string
export const maxWaiting: number
export const maxWaitMs: number
export const maxAttempts: number
export const retryBaseMs: number
export const watchdogMs: number
export const watchdogLimitMs: number
export const verdictMs: number

// The store's retry policy
/** `found` is `missing`, `parsed` or `unreadable`. `next` is `absent`, `sound`, `again` or `broken`. */
export const afterReadWire: (attempt: number) => (found: string) => { next: string; waitMs: number }
/** `unchanged`, `check` or `write`. */
export const stepOfWire: (facts: { attempt: number; hasLock: boolean; isSound: boolean; isSame: boolean }) => string
export const keepsBackupWire: (facts: { wantsBackup: boolean; isSound: boolean; exists: boolean }) => boolean
/** `next` is `done`, `unconfirmed` or `again`. */
export const afterWriteWire: (attempt: number) => (isConfirmed: boolean) => { next: string; waitMs: number }
export const readTries: number
export const readRetryMs: number
export const writeTries: number

// The status line
export const playLineWire: (clock: (ms: number) => string) => (play: PlayWire) => string
export const healthLineWire: (
  clock: (ms: number) => string,
) => (facts: { play: PlayWire; health: HealthWire; pressure: PressureWire; lastScanMs: number; failing: string[] }) => string
/** `starting`, `no-git`, `looking`, `settling`, `waiting` or `idle`. */
export const watchStateWire: (play: PlayWire) => string
export const slowScanMs: number

// Deadlines
export type DeadlineWire = { name: string; at: number }
/** `next` is `keep`, `disarm` or `arm`, and `at` is the time to arm the timer for. */
export const armingWire: (isArmed: boolean) => (armedFor: number) => (deadlines: DeadlineWire[]) => { next: string; at: number }
export const delayMsWire: (at: number) => (now: number) => number
export const dueNowWire: (deadlines: DeadlineWire[]) => (now: number) => string[]
