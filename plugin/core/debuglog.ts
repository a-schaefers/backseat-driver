/**
 * The debug log: everything the tutor does, for whoever is developing
 * Backseat Driver. It is about the tutor itself, so there is one log for
 * every project, and each line says which project it happened in.
 *
 *   debug.json                      the switch: {"on": true}
 *   debug/<session>/000000.jsonl    the log, one JSON record a line, in chunks
 *   debug/<session>/state.json      the tutor's whole state, as of the last change
 *
 * `$.fs.write` writes a whole file and cannot append. So the log is cut into
 * chunks, and the chunk being filled is written again, whole, each time it
 * grows. A chunk that is full is never touched again, until so many newer
 * ones exist that it is emptied to keep the log's size bounded.
 */

/** One line of the log. */
export type DebugRecord = {
  /** When, in milliseconds since the epoch. */
  t: number
  /** Counts up from 1 for each load of the mod. */
  seq: number
  /** The session, by the first characters of its id. */
  s: string
  /** The project it happened in, or '' before one is known. */
  p: string
  /** What kind of thing happened: `cmd`, `hook`, `git`, `fs`, `model`, `state`, `error` and so on. */
  k: string
  /** Which one. */
  n: string
  /** How long it took, for the things that take time. */
  ms?: number
  /** Everything else worth knowing about it. */
  d?: unknown
}

/** What is kept of each record in memory, whether or not the log is on. */
export type RingEntry = Pick<DebugRecord, 't' | 'seq' | 'k' | 'n' | 'ms'>

/** The effects the log needs. register.tsx supplies them as closures over `$`. */
export type DebugPorts = {
  /** Writes the whole file, creating its folders. */
  write: (path: string, text: string) => Promise<void>
  /** The names in a folder, or none when it is not there. */
  list: (path: string) => Promise<string[]>
}

/** A chunk is closed once it holds this many characters. One record may take it past that. */
export const CHUNK_CHARS = 128_000
/** How many chunks a session keeps. Older ones are emptied. */
export const MAX_CHUNKS = 64
/** The log is written at most this often while records keep coming. */
export const FLUSH_MS = 200
/** How many of the latest records are kept in memory for a dump. */
export const RING_SIZE = 300
/** A string inside a record is cut past this length, so that one huge prompt cannot fill the log. */
export const MAX_STRING_CHARS = 400_000

export function chunkName(index: number): string {
  return `${String(index).padStart(6, '0')}.jsonl`
}

/** The number in a chunk's file name, or null for any other file. */
export function chunkIndex(name: string): number | null {
  const match = /^(\d{6})\.jsonl$/.exec(name)

  return match === null ? null : Number(match[1])
}

/** A session's id as it appears in its folder's name and in every record. */
export function shortSession(sessionId: string): string {
  return sessionId.replace(/[^A-Za-z0-9]/g, '').slice(0, 8) || 'session'
}

/**
 * The folder one session logs into: when its log began (UTC), then the start
 * of its id, so that folders sort by time. A session that already has a
 * folder among `existing` keeps it, so a reload of the mod carries on there.
 */
export function sessionFolder(existing: readonly string[], now: number, sessionId: string): string {
  const id = shortSession(sessionId)
  const mine = existing.filter(name => name.endsWith(`-${id}`)).sort()
  const latest = mine[mine.length - 1]
  if (latest !== undefined) return latest
  const stamp = new Date(now).toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)

  return `${stamp}-${id}`
}

/** What `debug.json` says. Anything but an explicit `"on": true` is off. */
export function parseSwitch(stored: unknown): boolean {
  return typeof stored === 'object' && stored !== null && (stored as Record<string, unknown>).on === true
}

function cut(_key: string, value: unknown): unknown {
  if (typeof value === 'string' && value.length > MAX_STRING_CHARS) {
    return `${value.slice(0, MAX_STRING_CHARS)}… (cut, ${value.length} characters in all)`
  }
  if (typeof value === 'bigint') return String(value)
  if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack }
  if (value instanceof Map) return Object.fromEntries(value)
  if (value instanceof Set) return [...value]

  return value
}

/**
 * A record as one line of JSON, newline included. A value that cannot be
 * written (a cycle) is replaced by a note saying so: a log line never throws.
 */
export function toLine(record: DebugRecord): string {
  try {
    return `${JSON.stringify(record, cut)}\n`
  } catch (error) {
    return `${JSON.stringify({ ...record, d: `(could not be written: ${String(error)})` })}\n`
  }
}

/** The latest records, oldest first, with what happened but not its details. */
export function createRing(size = RING_SIZE) {
  let entries: RingEntry[] = []

  return {
    push(entry: RingEntry): void {
      entries.push(entry)
      if (entries.length > size) entries = entries.slice(entries.length - size)
    },
    entries: (): RingEntry[] => [...entries],
  }
}

/**
 * Writes records into one session's folder. `add` only holds a record, and
 * `flush` writes what is held, so that a burst of records costs one write.
 */
export function createDebugLog(ports: DebugPorts, dir: string) {
  let index = 0
  /** The chunk being filled, whole. */
  let text = ''
  let held: string[] = []
  let isOpen = false
  let writing: Promise<void> = Promise.resolve()

  async function write(): Promise<void> {
    if (!isOpen || held.length === 0) return
    text += held.join('')
    held = []
    const at = index
    const body = text
    const isFull = text.length >= CHUNK_CHARS
    if (isFull) {
      index += 1
      text = ''
    }
    try {
      await ports.write(`${dir}/${chunkName(at)}`, body)
      // The chunk that has just fallen out of the ring is emptied. There is no way to delete it.
      if (isFull && at + 1 >= MAX_CHUNKS) await ports.write(`${dir}/${chunkName(at + 1 - MAX_CHUNKS)}`, '')
    } catch {
      // The disk said no. A log must never take the tutor down with it. The next
      // write of this chunk carries these records again, unless the chunk was full.
    }
  }

  return {
    /** Starts a new chunk after whatever the folder already holds, so that a reload of the mod carries on. */
    async open(): Promise<void> {
      let last = -1
      for (const name of await ports.list(dir)) last = Math.max(last, chunkIndex(name) ?? -1)
      index = last + 1
      text = ''
      isOpen = true
    },

    add(record: DebugRecord): void {
      held.push(toLine(record))
    },

    /** Whether anything is waiting to be written. */
    hasHeld: (): boolean => held.length > 0,

    /** Writes what is held. Writes happen one at a time, in order. */
    flush(): Promise<void> {
      writing = writing.then(write)

      return writing
    },

    /** The folder, and the chunk being filled in it. */
    dir: (): string => dir,
    current: (): string => `${dir}/${chunkName(index)}`,
  }
}

export type DebugLog = ReturnType<typeof createDebugLog>

/**
 * What the rest of the mod calls. A record always goes into the ring. Its
 * details are worked out, and it goes into the log, only while a log is
 * attached: with debug off, a trace costs a few assignments.
 */
export function createTracer(now: () => number) {
  const ring = createRing()
  let seq = 0
  let log: DebugLog | null = null
  let session = ''
  let project = ''

  return {
    attach(next: DebugLog, sessionId: string): void {
      log = next
      session = shortSession(sessionId)
    },
    detach(): DebugLog | null {
      const was = log
      log = null

      return was
    },
    /** Later records are marked as this project's. */
    inProject(id: string): void {
      project = id
    },
    isOn: (): boolean => log !== null,
    log: (): DebugLog | null => log,

    /** Records one thing that happened. `detail` is called only while the log is on. */
    note(kind: string, name: string, detail?: () => unknown, ms?: number): void {
      seq += 1
      const t = now()
      ring.push(ms === undefined ? { t, seq, k: kind, n: name } : { t, seq, k: kind, n: name, ms })
      if (log === null) return
      let d: unknown
      try {
        d = detail?.()
      } catch (error) {
        d = `(the detail threw: ${String(error)})`
      }
      log.add({ t, seq, s: session, p: project, k: kind, n: name, ...(ms === undefined ? {} : { ms }), ...(d === undefined ? {} : { d }) })
    },

    ring: (): RingEntry[] => ring.entries(),
  }
}

export type Tracer = ReturnType<typeof createTracer>

/** What `/backseat debug` is asked to do. No word means status. Null for a word it does not know. */
export type DebugRequest = 'on' | 'off' | 'status' | 'dump' | 'clear'

export function parseDebugRequest(rest: string): DebugRequest | null {
  const word = rest.trim().toLowerCase()
  if (word === '') return 'status'

  return (['on', 'off', 'status', 'dump', 'clear'] as const).find(known => known === word) ?? null
}

export const DEBUG_USAGE = 'Say /backseat debug on, off, status, dump or clear.'
