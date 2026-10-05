import type { Watch } from '../types'
import type { Health, Pressure } from './health'
import type { Play } from './play'
import { healthLine, playLine, watchState } from './core'

/**
 * The pane's status line: what the play-by-play is doing, said so that it is
 * true the moment it is read. A wait says what it is waiting for and until
 * when, as a time of day, so that the line does not have to be redrawn every
 * second to stay right.
 */

// The wording is the kernel's (kernel/src/Kernel/Status.purs), through core.ts.
export { clockTime } from './clock'
export { healthLine, playLine, SLOW_SCAN_MS } from './core'

export type HealthFacts = {
  play: Play
  health: Health
  pressure: Pressure
  /** How long the last scan of the working tree took. */
  lastScanMs: number
  /** What has failed more than once lately, in a few words each. */
  failing: readonly string[]
}

/** What the pane is told: the line, the row under it, and the state the animated character takes its pose from. */
export function watchOf(play: Play, lastLookAt: number | null, health = ''): Watch {
  const state = watchState(play)

  return health === '' ? { state, lastLookAt, line: playLine(play) } : { state, lastLookAt, line: playLine(play), health }
}
