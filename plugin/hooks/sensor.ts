/**
 * How often the working tree is looked at.
 *
 * Claude Code tells the mod about everything that happens inside it. It does
 * not say when the person saves a file in their editor, commits in their own
 * terminal or moves their caret, and nothing else on the machine does either
 * without an extra install. So those are found by looking: one scan of the
 * working tree at a time, the next one scheduled when the last has finished.
 * This is the only place the mod polls.
 *
 * The scan is as frequent as it needs to be and no more: every second for a
 * minute after something happened (a save, a prompt, a key in the pane),
 * every two seconds otherwise, every five once nothing has happened for ten
 * minutes. Anything Claude Code does tell the mod about makes it scan at once.
 *
 * One thing is looked at more often, and only while someone is watching it:
 * the file the Explain view is about, and the file an editor writes its
 * caret to. Two stats, ten times a second (`focusGapMs`), because an
 * explanation of code that was just edited must not stay on screen.
 */

/** Between scans while something has just happened. */
export const HOT_SCAN_MS = 1000
/** Between scans otherwise. */
export const SCAN_MS = 2000
/** Between scans once nothing has happened for a while. */
export const IDLE_SCAN_MS = 5000
/** How long after something happened the scans stay close together. */
export const HOT_FOR_MS = 60_000
/** How long nothing has to happen before they grow far apart. */
export const IDLE_AFTER_MS = 600_000
/** Each quarter second a scan takes adds this much to the wait for the next, so that a slow `git status` is not run back to back. */
const SLOW_SCAN_STEP_MS = 250
const SLOW_SCAN_WAIT_MS = 2000
/** However slow git is, the working tree is looked at this often. */
export const LONGEST_SCAN_GAP_MS = 32_000

export type ScanFacts = {
  now: number
  /** When something last happened: a save, a commit, a caret move, a prompt, a key. Null when nothing has yet. */
  activeAt: number | null
  /** How long the scan that just finished took. */
  lastScanMs: number
}

/** How long to wait before the next scan. */
export function scanGapMs(facts: ScanFacts): number {
  const quietFor = facts.activeAt === null ? Number.POSITIVE_INFINITY : facts.now - facts.activeAt
  const base = quietFor < HOT_FOR_MS ? HOT_SCAN_MS : quietFor >= IDLE_AFTER_MS ? IDLE_SCAN_MS : SCAN_MS
  const slowness = Math.floor(facts.lastScanMs / SLOW_SCAN_STEP_MS) * SLOW_SCAN_WAIT_MS

  return Math.min(LONGEST_SCAN_GAP_MS, base + slowness)
}

/**
 * Between checks of the spot in focus while someone is watching it. A stat
 * takes about a millisecond. This is the longest the pane can show an
 * explanation of code that was just edited, and the longest an editor waits
 * for its caret to be noticed.
 */
export const FOCUS_SCAN_MS = 100
/** However slow the disk is, the spot in focus is checked this often. */
export const LONGEST_FOCUS_GAP_MS = 2000

/** How long to wait before the next check of the spot in focus. A check that was slow is not run back to back. */
export function focusGapMs(tookMs: number): number {
  return Math.min(LONGEST_FOCUS_GAP_MS, Math.max(FOCUS_SCAN_MS, tookMs * 4))
}
