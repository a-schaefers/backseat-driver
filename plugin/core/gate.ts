// The arithmetic is the kernel's (kernel/src/Kernel/Pace.purs), through core.ts.
export { backoffMs, slowedGapMs, throttle } from './core'

/** What decides whether the play-by-play looks now. Times are clock milliseconds. */
export type GateInput = {
  now: number
  /** When the working tree last changed, or null if it has not since the tutor was switched on. */
  lastChangeAt: number | null
  /** When the previous look ended, or null if there has been none. */
  lastLookAt: number | null
  /** Whether anything differs from what the previous look saw. */
  hasPendingChange: boolean
  isLookRunning: boolean
  quietMs: number
  minGapMs: number
  /** Extra wait after failed looks, so that a rate limit is not hammered. */
  backoffMs: number
}

/**
 * A save is not a look. All of these have to hold: something changed, the
 * tree has been still for the quiet time, the minimum gap since the previous
 * look has passed, and no look is running.
 */
export function shouldLook(input: GateInput): boolean {
  if (input.isLookRunning || !input.hasPendingChange || input.lastChangeAt === null) return false
  if (input.now - input.lastChangeAt < input.quietMs) return false
  if (input.lastLookAt === null) return true

  return input.now - input.lastLookAt >= input.minGapMs + input.backoffMs
}

/** How much of the tightest usage window is spent, 0 to 100. 0 when Claude Code reports none. */
export function usagePressure(limits: readonly { percentUsed: number }[]): number {
  return limits.reduce((highest, limit) => Math.max(highest, limit.percentUsed), 0)
}

/** How the background work holds back as a plan's usage limit gets close. */
export type Throttle = {
  /** The minimum gap between looks is multiplied by this. */
  gapFactor: number
  /** True when nothing runs unless the user asks for it. */
  isHeld: boolean
}
