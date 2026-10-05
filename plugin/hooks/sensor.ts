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
 *
 * The numbers and the arithmetic are the kernel's (kernel/src/Kernel/Sensor.purs),
 * through core.ts.
 */

export {
  FOCUS_SCAN_MS,
  focusGapMs,
  HOT_FOR_MS,
  HOT_SCAN_MS,
  IDLE_AFTER_MS,
  IDLE_SCAN_MS,
  LONGEST_FOCUS_GAP_MS,
  LONGEST_SCAN_GAP_MS,
  SCAN_MS,
  scanGapMs,
} from './core'

export type ScanFacts = {
  now: number
  /** When something last happened: a save, a commit, a caret move, a prompt, a key. Null when nothing has yet. */
  activeAt: number | null
  /** How long the scan that just finished took. */
  lastScanMs: number
}
