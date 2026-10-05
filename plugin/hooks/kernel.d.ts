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

// The license
export type LicenseFactsWire = {
  use: string
  key: string
  expiresAt: number
  keySince: number
  hasServer: boolean
  answer: string
  answeredAt: number
  triedAt: number
  now: number
}
export const licenseStandingWire: (facts: LicenseFactsWire) => string
export const licenseNextCheckWire: (facts: LicenseFactsWire) => number
