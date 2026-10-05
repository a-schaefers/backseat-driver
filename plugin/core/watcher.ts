import { diffLines } from './diff'
import { dirtyPaths, parseStatus } from './git'
import { isNoiseFile, isTrivialChange, looksBinary } from './noise'
import type { FileChange } from './prompts'

/** The effects the watcher needs. register.tsx supplies them as closures over `$`. */
export type WatcherPorts = {
  /** Runs git in the repository's root with these arguments. */
  git: (args: readonly string[]) => Promise<{ exitCode: number; stdout: string }>
  /** A file's text by its path from the repository root, or null when it cannot be read. */
  read: (path: string) => Promise<string | null>
  /** A file's size and modification time, or null when it is gone. */
  stat: (path: string) => Promise<{ size: number; mtimeMs: number } | null>
}

/** A change collected for a look, with the fingerprint its file had at that moment. */
export type Collected = FileChange & { print: string }

const STATUS = ['status', '--porcelain=v1', '-z', '--untracked-files=all'] as const
/** Larger files are not sent to a model. */
const MAX_FILE_CHARS = 200_000

function sameMap(a: ReadonlyMap<string, string>, b: ReadonlyMap<string, string>): boolean {
  if (a.size !== b.size) return false
  for (const [key, value] of a) {
    if (b.get(key) !== value) return false
  }

  return true
}

/**
 * Tracks what changed in the working tree since the previous look.
 *
 * A file's fingerprint is its size and modification time. `seen` holds the
 * fingerprints of the changed files at the last poll, `looked` at the last
 * look. Whatever differs between the two is pending.
 */
export function createWatcher(ports: WatcherPorts) {
  let seen = new Map<string, string>()
  let changed: string[] = []
  /** The changed files git listed at the last poll that are never worth a look (lock files, generated folders). */
  let skipped: string[] = []
  const looked = new Map<string, string>()
  /** What each changed file contained at the last look. A file not listed was clean then, so its baseline is HEAD. */
  const baseline = new Map<string, string>()
  /**
   * Files the last look saw changed that are clean again with other text
   * than it saw: changed once more and committed, or put back, all between
   * two polls. Git no longer lists them, and what the last look said about
   * them may no longer hold, so they are still to be looked at.
   */
  const returned = new Set<string>()

  /** Whether a file that is clean now reads differently from what the last look saw of it. */
  async function hasMoved(path: string): Promise<boolean> {
    const before = baseline.get(path)
    const after = await ports.read(path)
    if (before === undefined || after === null || after.length > MAX_FILE_CHARS || looksBinary(after)) return false

    return before !== after && !isTrivialChange(before, after)
  }

  async function fingerprints(): Promise<Map<string, string> | null> {
    const status = await ports.git(STATUS)
    if (status.exitCode !== 0) return null

    const prints = new Map<string, string>()
    const noise: string[] = []
    for (const path of dirtyPaths(parseStatus(status.stdout))) {
      if (isNoiseFile(path)) {
        noise.push(path)
        continue
      }
      const stat = await ports.stat(path)
      if (stat !== null) prints.set(path, `${stat.size}:${stat.mtimeMs}`)
    }
    skipped = noise

    return prints
  }

  async function headText(path: string): Promise<string | null> {
    const shown = await ports.git(['show', `HEAD:${path}`])

    return shown.exitCode === 0 ? shown.stdout : null
  }

  return {
    /**
     * Takes the working tree as it stands for the baseline, so that work
     * already uncommitted when the tutor is switched on is not reviewed.
     * Resolves false when this is not a git repository.
     */
    async start(): Promise<boolean> {
      const prints = await fingerprints()
      if (prints === null) return false

      seen = prints
      looked.clear()
      baseline.clear()
      returned.clear()
      for (const [path, print] of prints) {
        looked.set(path, print)
        const text = await ports.read(path)
        if (text !== null) baseline.set(path, text)
      }

      return true
    },

    /** Asks git what is changed now. Resolves true when that differs from the previous poll. */
    async poll(): Promise<boolean> {
      const prints = await fingerprints()
      if (prints === null) return false
      const hasChanged = !sameMap(prints, seen)
      changed = [...prints].filter(([path, print]) => seen.get(path) !== print).map(([path]) => path)
      seen = prints
      // What the last look saw changed and git no longer lists: read once, when it turns clean.
      for (const path of [...looked.keys()]) {
        if (seen.has(path)) returned.delete(path)
        else if (!returned.has(path)) {
          if (await hasMoved(path)) returned.add(path)
          else {
            // Committed as the last look saw it: HEAD is its baseline again.
            looked.delete(path)
            baseline.delete(path)
          }
        }
      }

      return hasChanged
    },

    /** The files that were saved between the last two polls. */
    changed(): string[] {
      return changed
    },

    /** Whether any file differs from what the previous look saw. */
    hasPending(): boolean {
      if (returned.size > 0) return true
      for (const [path, print] of seen) {
        if (looked.get(path) !== print) return true
      }

      return false
    },

    /** Every file that differs from HEAD as of the last poll. */
    dirty(): string[] {
      return [...seen.keys()]
    },

    /** The files that differ from HEAD as of the last poll and are never looked at. With `dirty()`, everything git listed. */
    noise(): string[] {
      return skipped
    },

    /**
     * The real changes since the previous look. Files that cannot be read,
     * are too large or binary, or changed only in whitespace are settled
     * here and never reach a model.
     */
    async collect(): Promise<Collected[]> {
      const changes: Collected[] = []
      for (const [path, print] of seen) {
        if (looked.get(path) === print) continue

        const after = await ports.read(path)
        if (after === null || after.length > MAX_FILE_CHARS || looksBinary(after)) {
          looked.set(path, print)
          continue
        }
        const before = baseline.get(path) ?? (await headText(path)) ?? ''
        if (before === after || isTrivialChange(before, after)) {
          baseline.set(path, after)
          looked.set(path, print)
          continue
        }
        changes.push({ path, before, after, hunks: diffLines(before, after), print })
      }
      for (const path of [...returned]) {
        const before = baseline.get(path) ?? ''
        const after = await ports.read(path)
        // Changed back in the meantime, or gone: nothing is left to look at.
        if (after === null || !(await hasMoved(path))) {
          returned.delete(path)
          looked.delete(path)
          baseline.delete(path)
          continue
        }
        changes.push({ path, before, after, hunks: diffLines(before, after), print: '' })
      }

      return changes
    },

    /**
     * Records that a look saw these changes. A file that changed again while
     * the look ran keeps a newer fingerprint in `seen`, so it stays pending.
     */
    settle(changes: readonly Collected[]): void {
      for (const change of changes) {
        baseline.set(change.path, change.after)
        looked.set(change.path, change.print)
        returned.delete(change.path)
      }
      // Files that are clean again (committed or reverted) go back to HEAD as their baseline,
      // except one that still has a change no look has seen.
      for (const path of [...looked.keys()]) {
        if (!seen.has(path) && !returned.has(path)) {
          looked.delete(path)
          baseline.delete(path)
        }
      }
    },
  }
}

export type Watcher = ReturnType<typeof createWatcher>
