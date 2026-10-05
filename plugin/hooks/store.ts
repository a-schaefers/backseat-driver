import { afterRead, afterWrite, changeStep, keepsBackup } from './core'
import type { Lock } from './locks'
import type { Disk } from './storage'

// When to read again, write again or give up is the kernel's (kernel/src/Kernel/Store.purs), through core.ts. The reading and writing are here.
export { READ_RETRY_MS, READ_TRIES, WRITE_TRIES } from './core'

/**
 * The tutor's JSON files, safe with several sessions at once.
 *
 * `$.fs.write` empties a file and then fills it, so another session can read
 * it empty or half-written, and two sessions that read, change and write the
 * same file can each undo the other's change. Every read and every change of
 * a file in the data folder therefore goes through here:
 *
 * - A file that is empty or does not parse is read again a moment later. One
 *   that stays that way is kept aside as `<file>.broken`, and the last good
 *   copy, `<file>.bak`, is used when there is one. It is never treated as
 *   "nothing there" and written over.
 * - A change is read, apply, write as one step: one change at a time per file
 *   in this session, and a lock that holds across sessions (`locks.ts`).
 * - What was written is read back. If it is not there, another session wrote
 *   at the same moment, and the change is made again on top of what it wrote.
 */

export type StorePorts = {
  disk: Disk
  /**
   * Locks that hold across sessions. Null where there are none, as in a test
   * of something else: a change is then only checked before and after.
   */
  locks: { acquire: (name: string) => Promise<Lock | null>; release: (lock: Lock) => Promise<void> } | null
  sleep: (ms: number) => Promise<void>
  /** Told when something out of the ordinary happens to a file, for the debug log. */
  note: (what: string, detail: Record<string, unknown>) => void
}

export type UpdateOptions = {
  /** Keeps the file as it was before the change, as `<file>.bak`. For what cannot be worked out again: profiles and progress. */
  keepBackup?: boolean
}

export function backupPath(path: string): string {
  return `${path}.bak`
}

export function brokenPath(path: string): string {
  return `${path}.broken`
}

/** A value as the text of its file. */
export function toText(value: unknown): string {
  return `${JSON.stringify(value, null, 1)}\n`
}

type Loaded = {
  /** The file's text as read, or null when it is not there. */
  text: string | null
  /** What it holds, or null when it is not there, or broken with no backup. */
  value: unknown
  /** False when the text is not what the value was read from: the file is broken. */
  isSound: boolean
}

export function createStore(ports: StorePorts) {
  /** The last change queued for each file. The next one waits for it. */
  const queues = new Map<string, Promise<unknown>>()

  async function load(path: string): Promise<Loaded> {
    let text: string | null = null
    for (let attempt = 1; ; attempt += 1) {
      text = await ports.disk.read(path)
      let value: unknown = null
      let found: 'missing' | 'parsed' | 'unreadable' = text === null ? 'missing' : 'unreadable'
      if (text !== null && text.trim() !== '') {
        try {
          value = JSON.parse(text) as unknown
          found = 'parsed'
        } catch {
          // Caught while another session was writing it, or broken. The next read tells.
        }
      }
      const next = afterRead(attempt, found)
      if (next.next === 'absent' || next.next === 'sound') return { text, value, isSound: true }
      if (next.next === 'broken') break
      await ports.sleep(next.waitMs)
    }

    // Still empty or unreadable: whoever was writing it did not finish. It is kept aside, never thrown away.
    ports.note('a file is broken', { path, chars: text?.length ?? 0 })
    try {
      if (text !== null && text.trim() !== '') await ports.disk.write(brokenPath(path), text)
    } catch {
      // Keeping it aside is a courtesy. Going on matters more.
    }
    const backup = await ports.disk.read(backupPath(path))
    if (backup !== null) {
      try {
        const value = JSON.parse(backup) as unknown
        ports.note('a file was restored from its backup', { path })

        return { text, value, isSound: false }
      } catch {
        // The backup is no better.
      }
    }

    return { text, value: null, isSound: false }
  }

  async function change(path: string, apply: (stored: unknown) => unknown, options: UpdateOptions): Promise<unknown> {
    const lock = ports.locks === null ? null : await ports.locks.acquire(path)
    if (ports.locks !== null && lock === null) ports.note('a file is changed without its lock', { path })
    try {
      for (let attempt = 1; ; attempt += 1) {
        const before = await load(path)
        const value = apply(before.value)
        const text = toText(value)
        const step = changeStep(attempt, { hasLock: lock !== null, isSound: before.isSound, isSame: text === before.text })
        // Nothing to change, and the file already says so.
        if (step === 'unchanged') return value

        if (step === 'check') {
          // Without a lock, make sure at least that nobody wrote since this was read.
          const now = await ports.disk.read(path)
          if (now !== before.text) {
            ports.note('a file changed while it was being changed', { path, attempt })
            continue
          }
        }
        if (keepsBackup({ wantsBackup: options.keepBackup === true, isSound: before.isSound, exists: before.text !== null }) && before.text !== null) {
          await ports.disk.write(backupPath(path), before.text)
        }
        await ports.disk.write(path, text)

        // Read back: what is there now must be what was just written.
        const after = afterWrite(attempt, (await ports.disk.read(path)) === text)
        if (after.next === 'done') return value
        if (after.next === 'unconfirmed') {
          ports.note('a change could not be confirmed', { path, attempts: attempt })

          return value
        }
        ports.note('another session wrote the file at the same moment', { path, attempt })
        await ports.sleep(after.waitMs)
      }
    } finally {
      if (lock !== null) await ports.locks?.release(lock)
    }
  }

  return {
    /** What a file holds, or null when it is not there. Never a half-written file's "nothing". */
    async read(path: string): Promise<unknown> {
      return (await load(path)).value
    },

    /**
     * Changes a file: `apply` is given what the file holds (null when it is
     * not there) and returns what it should hold. It may be called more than
     * once, when another session's write got in the way, so it must not have
     * effects that count twice. Resolves to what was written.
     */
    update(path: string, apply: (stored: unknown) => unknown, options: UpdateOptions = {}): Promise<unknown> {
      const before = queues.get(path) ?? Promise.resolve()
      const mine = before.catch(() => undefined).then(() => change(path, apply, options))
      queues.set(path, mine)
      // The map holds a file only while a change to it is waiting or running.
      void mine
        .catch(() => undefined)
        .then(() => {
          if (queues.get(path) === mine) queues.delete(path)
        })

      return mine
    },
  }
}

export type Store = ReturnType<typeof createStore>

/** A store with no locks and nothing to wait for: for tests, and for a folder only one session can reach. */
export function plainStore(disk: Disk): Store {
  return createStore({ disk, locks: null, sleep: async () => undefined, note: () => undefined })
}

/**
 * Changes a file whose contents have a type: `parse` reads what is stored,
 * `apply` changes it, and what was written comes back. `apply` may run more
 * than once.
 */
export async function updateJson<T>(
  store: Store,
  path: string,
  parse: (stored: unknown) => T,
  apply: (current: T) => T,
  options: UpdateOptions = {},
): Promise<T> {
  let written: { value: T } | null = null
  await store.update(
    path,
    stored => {
      written = { value: apply(parse(stored)) }

      return written.value
    },
    options,
  )
  // `update` resolved, so `apply` ran at least once.
  const done = written as { value: T } | null
  if (done === null) throw new Error(`nothing was written to ${path}`)

  return done.value
}
