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

/** How long failed looks hold the next one back: 30 seconds, doubling, up to 10 minutes. */
export function backoffMs(failures: number): number {
  if (failures <= 0) return 0

  return Math.min(600_000, 30_000 * 2 ** (failures - 1))
}
