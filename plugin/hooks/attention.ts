import { relativeTo } from './focus'
import type { Entry, Span } from './journal'

/**
 * Where the person's attention is, from what an editor says about itself.
 *
 * An editor writes its report (`editors.ts`) whenever the caret moves. The file says where the caret is at that moment and nothing about
 * time. The tutor notes when each report arrives and adds the time up itself,
 * from one report to the next: which file was in front for how long, where
 * in it the caret stayed, and which files were on screen beside it. How
 * often the tutor happens to look does not change the sum. So an editor plugin stays a few lines long,
 * and two editors are counted alike.
 *
 *   {"file": "/abs/path/stats.py", "line": 12, "modified": true,
 *    "buffers": ["/abs/path/stats.py", "/abs/path/test_stats.py"],
 *    "visible": ["/abs/path/test_stats.py"], "active": true}
 *
 * `file` and `line` are what Explain reads too (`focus.ts`). Everything else
 * is optional.
 */

/** What an editor says about itself, with every path taken from the repository root. */
export type EditorReport = {
  /** The file with the caret, or null when that file is outside this repository. */
  path: string | null
  line: number
  /** The other files of this repository open in the editor, in the editor's own order. */
  open: string[]
  /** The other files of this repository on screen beside the one with the caret. */
  visible: string[]
  /** True when the file with the caret has changes that are not saved yet. */
  isModified: boolean
  /** False when the editor says its window does not have the keyboard. */
  isActive: boolean
}

/** Where the caret is right now, while the editor is still reporting. */
export type Caret = { path: string; line: number; where: string; isModified: boolean; open: string[]; visible: string[] }

/** Time is credited for this long after the editor last said where the caret is. Past it they are reading, or away. */
export const LINGER_MS = 120_000
/** A slice of attention becomes journal entries after this long. */
export const SLICE_MS = 120_000
/** Longer than this between two looks at the clock and the laptop slept, or the tutor was paused: none of that is attention. */
export const MAX_GAP_MS = 60_000
/** Carets further apart than this many lines are in different parts of a file. */
const REGION_GAP = 20
/** Less than this in one slice is passing through, not attention. */
const MIN_MS = 3000
const MAX_REGIONS = 3
const MAX_LISTED = 12

function listed(value: unknown, repoRoot: string, except: string | null): string[] {
  const paths: string[] = []
  for (const item of Array.isArray(value) ? value : []) {
    const path = typeof item === 'string' ? relativeTo(repoRoot, item) : null
    if (path !== null && path !== except && !paths.includes(path)) paths.push(path)
  }

  return paths.slice(0, MAX_LISTED)
}

/** What an editor's report says, or null when it does not parse or names no file. */
export function parseEditorReport(text: string, repoRoot: string): EditorReport | null {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null
  const stored = data as Record<string, unknown>
  if (typeof stored.file !== 'string' || stored.file.trim() === '') return null

  // Read the way Explain reads it, so that the two never disagree about which file is in front.
  const path = relativeTo(repoRoot, stored.file)
  const line = typeof stored.line === 'number' && Number.isFinite(stored.line) && stored.line >= 1 ? Math.floor(stored.line) : 1

  return {
    path,
    line,
    open: listed(stored.buffers, repoRoot, path),
    visible: listed(stored.visible, repoRoot, path),
    isModified: stored.modified === true,
    isActive: stored.active !== false,
  }
}

type Dwell = { ms: number; where: string }

/**
 * The parts of a file the caret stayed in, from the time spent on each line:
 * the longest stays first. A part ends where the lines grow far apart, or
 * where the caret crossed into another definition.
 */
function regions(lines: ReadonlyMap<number, Dwell>): { span: Span; ms: number; where: string }[] {
  const found: { span: Span; ms: number; where: string; peak: number; last: string }[] = []
  for (const [line, dwell] of [...lines].sort((a, b) => a[0] - b[0])) {
    const current = found[found.length - 1]
    const isElsewhere = current !== undefined && dwell.where !== '' && current.last !== '' && dwell.where !== current.last
    if (current === undefined || line - current.span[1] > REGION_GAP || isElsewhere) {
      found.push({ span: [line, line], ms: dwell.ms, where: dwell.where, peak: dwell.ms, last: dwell.where })
      continue
    }
    current.span[1] = line
    current.ms += dwell.ms
    if (dwell.where !== '') current.last = dwell.where
    // A region is named after the line the caret stayed on longest.
    if (dwell.ms > current.peak) {
      current.peak = dwell.ms
      current.where = dwell.where
    }
  }

  return found.sort((a, b) => b.ms - a.ms).map(({ span, ms, where }) => ({ span, ms, where }))
}

/**
 * Adds up where the caret has been. `observe` is told each time the editor
 * writes its file, `tick` brings the sum up to now, and `drain` hands over
 * what has built up as journal entries.
 */
export function createAttention() {
  let report: EditorReport | null = null
  /** The definition the caret is in, once whoever reads the file has named it. */
  let where = ''
  let isNamed = false
  /** When the editor last wrote its file while the tutor was watching. Null until it does. */
  let movedAt: number | null = null
  /** Up to when the time has been added up. Null until the editor writes while the tutor is watching. */
  let creditedAt: number | null = null
  /** When the clock was last looked at, by anything here. */
  let seenAt: number | null = null
  let sliceFrom: number | null = null
  const files = new Map<string, Map<number, Dwell>>()
  /** Time each file spent on screen beside the one with the caret. */
  const screen = new Map<string, number>()

  function isLive(now: number): boolean {
    return report !== null && report.isActive && movedAt !== null && now - movedAt <= LINGER_MS
  }

  /**
   * Credits the time since the last credit to the line the caret is on, and
   * to the files on screen beside it. It runs up to now, or to the moment
   * the editor's last word stopped counting, and not across a stretch in
   * which nothing here looked at the clock at all.
   */
  function credit(now: number): void {
    const from = creditedAt
    const awake = seenAt !== null && now - seenAt > MAX_GAP_MS ? seenAt : now
    seenAt = now
    if (from === null || movedAt === null) return
    creditedAt = now
    const step = Math.min(awake, movedAt + LINGER_MS) - from
    if (step <= 0 || report === null || report.path === null || !report.isActive) return

    sliceFrom ??= from
    const lines = files.get(report.path) ?? new Map<number, Dwell>()
    const dwell = lines.get(report.line) ?? { ms: 0, where }
    lines.set(report.line, { ms: dwell.ms + step, where: where === '' ? dwell.where : where })
    files.set(report.path, lines)
    for (const path of report.visible) screen.set(path, (screen.get(path) ?? 0) + step)
  }

  function rows(): Entry[] {
    if (sliceFrom === null) return []
    const entries: Entry[] = []
    for (const [path, lines] of files) {
      const parts = regions(lines)
      const kept = parts.slice(0, MAX_REGIONS).filter(part => part.ms >= MIN_MS)
      for (const part of kept) {
        entries.push({ at: sliceFrom, kind: 'focus', path, ms: Math.round(part.ms), lines: [part.span], where: part.where })
      }
      // Whatever was spread too thin to be a place still counts as time in the file.
      const rest = parts.reduce((total, part) => total + part.ms, 0) - kept.reduce((total, part) => total + part.ms, 0)
      if (rest >= MIN_MS) entries.push({ at: sliceFrom, kind: 'focus', path, ms: Math.round(rest), lines: [], where: '' })
    }
    for (const [path, ms] of screen) {
      if (ms >= MIN_MS) entries.push({ at: sliceFrom, kind: 'screen', path, ms: Math.round(ms) })
    }

    return entries
  }

  return {
    /**
     * The editor wrote its file. `isBaseline` is true for what the file said
     * before the tutor was watching: it shows where the caret was left, and
     * no time is credited until the editor writes again.
     */
    observe(next: EditorReport | null, now: number, isBaseline: boolean): void {
      // The time up to this moment belongs to where the caret was until now.
      credit(now)
      const isSameLine = next !== null && report !== null && next.path === report.path && next.line === report.line
      report = next
      if (!isSameLine) {
        where = ''
        isNamed = false
      }
      movedAt = isBaseline ? null : now
      creditedAt = movedAt
    },

    /** Where the caret is, when the definition it is in has not been named yet and the editor is still reporting. */
    unnamed(now: number): { path: string; line: number } | null {
      if (isNamed || report === null || report.path === null || !isLive(now)) return null

      return { path: report.path, line: report.line }
    },

    /** The name of the definition the caret is in, '' for none. */
    name(definition: string): void {
      where = definition
      isNamed = true
    },

    /** Brings the sum up to now. */
    tick(now: number): void {
      credit(now)
    },

    /** Whether the slice being built is long enough to hand over. */
    isDue(now: number): boolean {
      return sliceFrom !== null && now - sliceFrom >= SLICE_MS
    },

    /** When the slice being built will be long enough to hand over, or null when none is being built. */
    dueAt(): number | null {
      return sliceFrom === null ? null : sliceFrom + SLICE_MS
    },

    /** The slice being built, as the journal entries it would become. */
    rows,

    /** Hands over the slice being built and starts a new one. */
    drain(): Entry[] {
      const entries = rows()
      files.clear()
      screen.clear()
      sliceFrom = null

      return entries
    },

    /** Where the caret is, or null when no editor has reported lately or the caret is outside this repository. */
    caret(now: number): Caret | null {
      if (report === null || report.path === null || !isLive(now)) return null

      return {
        path: report.path,
        line: report.line,
        where,
        isModified: report.isModified,
        open: report.open,
        visible: report.visible,
      }
    },
  }
}

export type Attention = ReturnType<typeof createAttention>
