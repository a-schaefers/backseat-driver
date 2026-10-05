import { safeName } from './datahome'
import { shortHash } from './hash'

/**
 * Locks that hold across sessions, so that two tutors never change one file
 * of the data folder at the same moment.
 *
 * `$.fs` cannot create a file only if it is not there, which is what a lock
 * file needs. Git can: `git update-ref <ref> <new> <old>` changes a ref only
 * while it still holds `<old>`, and creates one only while there is none. So
 * a lock is a ref in a small bare repository of the tutor's own, in its data
 * folder, and whoever creates the ref holds the lock. No other program runs.
 *
 * A session that dies holding a lock would hold it for ever. A lock older
 * than `LOCK_TTL_MS` is therefore taken over, by the same compare-and-swap,
 * so that of two sessions that try, one wins.
 */

export type LockPorts = {
  /** Runs git with these arguments, and this text on its standard input when given. */
  git: (args: readonly string[], stdin?: string) => Promise<{ exitCode: number; stdout: string }>
  /** When a file was last written, in clock milliseconds, or null when it is not there. */
  modifiedAt: (path: string) => Promise<number | null>
  /** A file's text, or null when it is not there. */
  read: (path: string) => Promise<string | null>
  /** Writes a file whole. Used only to mend a lock that git itself can no longer read. */
  write: (path: string, text: string) => Promise<void>
  now: () => Promise<number>
  sleep: (ms: number) => Promise<void>
  /** A number from 0 up to 1, to spread retries out. */
  random: () => number
  /** Who is asking: the session's id. Every lock this session takes is marked with it. */
  owner: () => Promise<string>
}

/** A lock that is held, for handing back. */
export type Lock = { name: string; ref: string }

/** A lock older than this was left by a session that is gone, and is taken over. A write holds one for milliseconds. */
export const LOCK_TTL_MS = 30_000
/** How long to wait for a lock another session holds, before going on without it. */
export const LOCK_WAIT_MS = 2000
const FIRST_RETRY_MS = 15
const MAX_RETRY_MS = 250
/** How often in a row a lock may turn out to have just been given back before something is taken to be wrong. */
const MAX_NEAR_MISSES = 20

/** The ref that stands for a lock on `name`: flat, so that no lock's name is the folder of another. */
export function lockRef(name: string): string {
  const last = name.split(/[\\/]/).pop() ?? ''

  // A ref's name may not end in a dot, nor in `.lock`, which is what git calls its own lock files.
  return `refs/locks/${shortHash(name)}-${safeName(last).replace(/\.+$/, '').replace(/\.lock$/, '_lock')}`
}

export function createLocks(ports: LockPorts, repo: string) {
  /**
   * This session's mark: the id of a blob in the repository that holds the
   * session's id. Null until a lock is first asked for.
   */
  let token: string | null = null

  const git = (args: readonly string[], stdin?: string) => ports.git([`--git-dir=${repo}`, ...args], stdin)

  /** Makes the repository when it is not there, and this session's mark in it. Null when git cannot do that. */
  async function prepare(): Promise<string | null> {
    if (token !== null) return token
    // Every git repository has a HEAD.
    if ((await ports.read(`${repo}/HEAD`)) === null && (await ports.git(['init', '--bare', '-q', repo])).exitCode !== 0) return null
    const hashed = await git(['hash-object', '-w', '--stdin'], `${await ports.owner()}\n`)
    const id = hashed.stdout.trim()
    if (hashed.exitCode !== 0 || !/^[0-9a-f]{40,64}$/.test(id)) return null
    token = id

    return id
  }

  /**
   * One try at the lock: taken, held by somebody else, free again (its holder
   * gave it back in the moment between the try and the look at who holds it),
   * or not possible at all.
   */
  async function attempt(ref: string, mine: string): Promise<'taken' | 'held' | 'free' | 'broken'> {
    // The old value of all zeros means: only if there is no such ref.
    if ((await git(['update-ref', ref, mine, '0'.repeat(mine.length)])).exitCode === 0) return 'taken'
    const file = `${repo}/${ref}`
    const takenAt = await ports.modifiedAt(file)
    // It could not be made and is not there. With the repository gone, nothing can be. Otherwise it was just given back.
    if (takenAt === null) return (await ports.read(`${repo}/HEAD`)) === null ? 'broken' : 'free'
    const holder = (await ports.read(file))?.trim() ?? ''
    // This session's own mark, on a lock it is not holding now: left over from before a reload of the mod.
    if (holder === mine) return 'taken'
    if ((await ports.now()) - takenAt <= LOCK_TTL_MS) return 'held'
    if (/^[0-9a-f]{40,64}$/.test(holder)) {
      // Left by a session that is gone. Only one of those who try to take it over gets it.
      return (await git(['update-ref', ref, mine, holder])).exitCode === 0 ? 'taken' : 'held'
    }
    // Old, and not something git can read: git will neither take it over nor delete it,
    // and nobody holds it. It is written afresh, or this file would never have a lock again.
    try {
      await ports.write(file, `${mine}\n`)
    } catch {
      return 'held'
    }

    return (await ports.read(file))?.trim() === mine ? 'taken' : 'held'
  }

  return {
    /**
     * Takes the lock on `name`, waiting up to `waitMs` for whoever holds it.
     * Null when it could not be had in that time, or when git cannot be used:
     * the caller then goes on without it, and checks its own work.
     */
    async acquire(name: string, waitMs = LOCK_WAIT_MS): Promise<Lock | null> {
      const ref = lockRef(name)
      let mine = await prepare()
      if (mine === null) return null
      const deadline = (await ports.now()) + waitMs
      let delay = FIRST_RETRY_MS
      let hasRepaired = false
      let nearMisses = 0
      for (;;) {
        let outcome = await attempt(ref, mine)
        if (outcome === 'taken') return { name, ref }
        if (outcome === 'free') {
          // Tried for again at once. A lock that keeps slipping away like this is not a lock: something is wrong.
          nearMisses += 1
          if (nearMisses <= MAX_NEAR_MISSES) continue
          outcome = 'broken'
        }
        nearMisses = 0
        if (outcome === 'broken') {
          // The repository may have been deleted since it was made, as forgetting everything does. Once more, from nothing.
          if (hasRepaired) return null
          hasRepaired = true
          token = null
          mine = await prepare()
          if (mine === null) return null
          continue
        }
        if ((await ports.now()) >= deadline) return null
        await ports.sleep(Math.round(delay * (0.5 + ports.random())))
        delay = Math.min(MAX_RETRY_MS, delay * 2)
      }
    },

    /** Hands a lock back. Only its holder can: a lock that was taken over in the meantime stays with its new holder. */
    async release(lock: Lock): Promise<void> {
      if (token === null) return
      await git(['update-ref', '-d', lock.ref, token])
    },
  }
}

export type Locks = ReturnType<typeof createLocks>
